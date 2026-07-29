/* ============================================================
   THE INNER CIRCLE — password-gated game (game 4 slot) · SHELL
   Gate: a wordle ("laddoo"). Behind it a level-select. Each level
   is its OWN file that self-registers via window.__innerCircle:
     · assets/vault-soorry.js  — L1 "im soorry"  (red-carpet runner)
     · assets/vault-jahnu.js   — L2 "okay jahnu" (highway quiz drive)
   The shell owns the overlay, a SQUARE letterboxed canvas, the tiny
   audio synth, unified input (keyboard + on-screen buttons), and the
   game-over tally. Levels get all of that through the `env` object
   passed to level.start(env). Registers into the arcade like slumber
   escape via window.__slumberGame.register.
   ============================================================ */
(function(){ 'use strict';

/* ---------------- config ---------------- */
var GATE_ANSWER='laddu';
var GATE_Q="what does khushi's sister sometimes call her?";
var GATE_HINT="an indian sweet";
var PINK='#eb648c', SOFT='#f5c3cf', YEL='#ebd81b', NIGHT='#0b0716', PURP='#2a1a4a', INK='#2a1a2e';
var GREEN='#6fc36f', DARK='#3a2b57';
var PIXEL="'Press Start 2P','VT323',monospace";
var MONO="'VT323',monospace";
var W=600, H=600;                      /* SQUARE logical canvas — plays nice on phones */
var COLORS={ PINK:PINK, SOFT:SOFT, YEL:YEL, NIGHT:NIGHT, PURP:PURP, INK:INK, GREEN:GREEN, DARK:DARK, PIXEL:PIXEL, MONO:MONO };

/* ---------------- level registry ----------------
   Level files call window.__innerCircle.register({...}) whenever they
   load — which may be before OR after this shell finishes booting, so
   we queue and also let a live select-screen re-render. ------------- */
var LEVELS=[];                                   /* {n,key,title,sub,start,playable} */
var onLevelsChanged=null;                         /* set while a select screen is live */
function registerLevel(def){
  if(!def||typeof def.start!=='function') return;
  for(var i=0;i<LEVELS.length;i++){ if(LEVELS[i].n===def.n){ LEVELS[i]=def; if(onLevelsChanged) onLevelsChanged(); return; } }
  LEVELS.push(def); LEVELS.sort(function(a,b){ return a.n-b.n; });
  if(onLevelsChanged) onLevelsChanged();
}
window.__innerCircle={ register:registerLevel, colors:COLORS, W:W, H:H };

function isLocked(){ try{ return localStorage.getItem('ksp-vault')!=='open'; }catch(e){ return true; } }
function bestStored(){ try{ var v=parseInt(localStorage.getItem('ksp-hi-vault'),10); return isFinite(v)?v:0; }catch(e){ return 0; } }

/* ---------------- arcade registration ---------------- */
var regTries=0;
function tryRegister(){
 try{
  if(window.__slumberGame && typeof window.__slumberGame.register==='function'){
   window.__slumberGame.register({ key:'vault', name:'the inner circle', unit:'clout', external:true,
     locked:isLocked, teaser:'🔒 password required — crack it to enter', launch:launchGame });
   return;
  }
 }catch(e){}
 if(regTries++<25) setTimeout(tryRegister,120);
}
tryRegister();

/* ============================================================
   one run — everything below is fresh per launch
   ============================================================ */
function launchGame(opts){
 var exitCb=(opts&&opts.exit)||function(){};
 var finished=false, bestScore=0;
 var timers=[];
 var TOUCH=('ontouchstart' in window)||(typeof navigator!=='undefined'&&navigator.maxTouchPoints>0);
 /* treat narrow / ?device=phone as touch too — matches the arcade's useGamepad() so the
    on-screen controls + keyboard show wherever a physical keyboard likely isn't around */
 var useTouch = TOUCH || window.innerWidth<=640 || /(^|\s)dev-phone(\s|$)/.test(document.documentElement.className);
 function later(fn,ms){ var t=setTimeout(fn,ms); timers.push(t); return t; }

 /* ---- audio (tiny synth, shared mute pref) ---- */
 var actx=null, muted=false;
 try{ muted=localStorage.getItem('ksp-snd')==='off'; }catch(e){}
 function ensureAudio(){ if(actx) return; try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ actx=null; } }
 function tone(f,dur,type,gain,when,slide){
  if(!actx||muted) return;
  try{
   var t0=actx.currentTime+(when||0), o=actx.createOscillator(), g=actx.createGain();
   o.type=type||'square'; o.frequency.setValueAtTime(f,t0);
   if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),t0+dur);
   g.gain.setValueAtTime(gain||0.05,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
   o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0+dur+0.02);
  }catch(e){}
 }
 var snd={
  tick:function(){ tone(700,0.04,'square',0.03); },
  flip:function(i){ tone(520+i*60,0.07,'triangle',0.04); },
  bad:function(){ tone(140,0.2,'sawtooth',0.045); },
  win:function(){ [523,659,784,1047,784,1047].forEach(function(n,i){ tone(n,0.15,'triangle',0.05,i*0.11); }); },
  jump:function(){ tone(420,0.16,'sine',0.05,0,760); },
  good:function(){ tone(660,0.1,'triangle',0.05); tone(880,0.12,'triangle',0.05,0.09); },
  coin:function(){ tone(880,0.07,'square',0.04); tone(1320,0.09,'square',0.04,0.06); },
  iconic:function(){ [784,988,1175,1568].forEach(function(n,i){ tone(n,0.12,'square',0.05,i*0.08); }); },
  sorry:function(){ tone(330,0.18,'sine',0.05,0,180); tone(180,0.25,'sine',0.05,0.15,120); },
  swerve:function(){ tone(300,0.08,'triangle',0.04,0,460); }
 };

 /* ---- overlay dom — mounted INSIDE the CRT screen (#tv) when it exists,
    so the gate/menu/games all play out on the monitor, edge to edge.
    Falls back to a fullscreen fixed overlay (test harness, no #tv). ---- */
 var host=document.getElementById('tv');
 var ov=document.createElement('div');
 /* padding-top clears the absolute header so panel content never underlaps it */
 ov.style.cssText=(host?'position:absolute':'position:fixed')+';inset:0;z-index:9999;background:'+NIGHT+';display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;touch-action:manipulation;pointer-events:auto;'+
  'padding:'+(host?'34px 6px 6px':'56px 8px 8px')+';box-sizing:border-box;';
 var head=document.createElement('div');
 head.style.cssText='position:absolute;top:0;left:0;right:0;display:flex;align-items:center;z-index:5;font-family:'+MONO+';color:'+SOFT+';'+
  (host?'gap:8px;padding:7px 10px;font-size:14px;':'gap:12px;padding:12px 16px;font-size:18px;');
 head.innerHTML='<span id="vaTitle" style="font-family:'+PIXEL+';font-size:'+(host?'9px':'11px')+';letter-spacing:1px;color:'+YEL+';text-shadow:2px 0 0 '+PINK+';white-space:nowrap;">the inner circle</span>'+
  '<span id="vaBest" style="opacity:.8;"></span><span style="flex:1"></span>'+
  '<button id="vaMute" style="all:unset;cursor:pointer;width:34px;height:34px;text-align:center;color:'+SOFT+';font-size:18px;">♪</button>'+
  '<button id="vaExit" style="all:unset;cursor:pointer;width:34px;height:34px;text-align:center;color:'+PINK+';font-size:20px;">✕</button>';
 ov.appendChild(head);
 var panel=document.createElement('div');   /* dom screens: gate / select / tally */
 /* cap to the VIEWPORT (vw/vh), not the CRT: at full camera zoom the CRT overgrows the
    window, and a 600px panel then spilled off both edges of a phone. */
 panel.style.cssText='position:relative;z-index:4;width:min(94%,600px,96vw);max-height:min(100%,90vh);overflow-y:auto;text-align:center;font-family:'+MONO+';color:#fff;';
 ov.appendChild(panel);
 var cv=document.createElement('canvas'); cv.width=W; cv.height=H;
 cv.style.cssText='display:none;position:relative;z-index:3;touch-action:none;';
 ov.appendChild(cv);
 /* button styles matching the site: the send-button shimmer CTA + the .choice chip */
 var css=document.createElement('style');
 css.textContent=
  '.vaBtnP{all:unset;box-sizing:border-box;position:relative;overflow:hidden;cursor:pointer;font-family:'+PIXEL+';font-size:12px;letter-spacing:.06em;color:#fff;'+
   'background:linear-gradient(90deg,#eb648c,#ec642a);border-radius:100px;padding:14px 26px;-webkit-tap-highlight-color:transparent;}'+
  '.vaBtnP:active{transform:scale(.96);}'+
  '.vaBtnP::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:55%;pointer-events:none;'+
   'background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);animation:vaSweep 2.6s ease infinite;}'+
  '@keyframes vaSweep{0%{left:-60%}55%{left:110%}100%{left:110%}}'+
  '.vaBtnS{all:unset;box-sizing:border-box;cursor:pointer;font-family:'+MONO+';font-size:19px;color:#fff;'+
   'background:rgba(255,255,255,.1);border:1px solid rgba(235,100,140,.5);border-radius:100px;padding:.42em 1.2em;-webkit-tap-highlight-color:transparent;}'+
  '.vaBtnS:hover{border-color:'+YEL+';}.vaBtnS:active{transform:scale(.95);background:'+PINK+';}';
 ov.appendChild(css);
 (host||document.body).appendChild(ov);
 var ctx=cv.getContext('2d');

 var muteBtn=head.querySelector('#vaMute'), exitBtn=head.querySelector('#vaExit'), bestEl=head.querySelector('#vaBest'), titleEl=head.querySelector('#vaTitle');
 /* while a game is live the heading + total clash with its HUD — keep only ♪ / ✕ */
 function headPlaying(on){ titleEl.style.display=on?'none':''; bestEl.style.display=on?'none':''; }
 function paintMute(){ muteBtn.style.opacity=muted?'.4':'1'; muteBtn.textContent=muted?'♪̸':'♪'; }
 /* the headline number is the TOTAL across the three games (a+b+c bests);
    that's also what gets posted to the arcade board on exit. */
 function totalClout(){ return bestFor(1)+bestFor(2)+bestFor(3); }
 function paintBest(){ var b=Math.max(bestStored(),totalClout(),bestScore); bestEl.textContent=b>0?('total '+b+' clout'):''; }
 muteBtn.addEventListener('click',function(){ muted=!muted; try{ localStorage.setItem('ksp-snd',muted?'off':'on'); }catch(e){} paintMute(); });
 exitBtn.addEventListener('click',function(){ finish(); });
 paintMute(); paintBest();

 /* ---- letterbox the (square) canvas ----
    The backing store matches the logical grid 1:1 (600) with smoothing OFF:
    the pixel aesthetic comes from the ART (sprites + backdrops are real
    pixel art, pre-scaled to their draw sizes) — the renderer never adds
    pixelation of its own, so sprites stay exactly as authored. */
 var PIXW=600;
 function hostSize(){
  /* at full camera zoom the CRT can outgrow the window — letterbox to the
     VISIBLE part (the screen centre rides the viewport centre, so the
     intersection stays centred) */
  if(host && host.clientWidth>40 && host.clientHeight>40){
   return { w:Math.min(host.clientWidth,window.innerWidth), h:Math.min(host.clientHeight,window.innerHeight) };
  }
  return {w:window.innerWidth,h:window.innerHeight};
 }
 function doResize(){
  var hs=hostSize();
  var s=Math.min(hs.w/W,(hs.h-8)/H);
  cv.style.width=Math.round(W*s)+'px'; cv.style.height=Math.round(H*s)+'px';
  cv.style.imageRendering='pixelated';
  if(cv.width!==PIXW){ cv.width=PIXW; cv.height=PIXW; }
  ctx.setTransform(PIXW/W,0,0,PIXW/H,0,0);    /* draw in 0..W, land on the PIXW grid */
  ctx.imageSmoothingEnabled=false;             /* nearest-neighbour: hard pixels */
  layoutControls();                            /* keep the touch buttons pinned under the (re-letterboxed) canvas */
 }
 window.addEventListener('resize',doResize); doResize();
 /* the CRT rect eases as the page zooms — track it so the game stays letterboxed to the screen */
 var hostRO=null;
 if(host && typeof ResizeObserver!=='undefined'){ try{ hostRO=new ResizeObserver(doResize); hostRO.observe(host); }catch(e){} }

 /* ---- shared drawing helper ---- */
 function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

 /* ---- image loader (levels register their own art) ---- */
 var imgCache={};
 function loadImage(src){
  if(imgCache[src]) return imgCache[src];
  var rec={img:null,ok:false,src:src};
  try{ var im=new Image(); rec.img=im; im.onload=function(){ rec.ok=true; }; im.src=src; }catch(e){}
  imgCache[src]=rec; return rec;
 }

 /* ---- unified input ---- */
 var held={left:false,right:false,up:false,down:false};
 var pressCb=null;                                  /* active level's discrete-press handler */
 var KEYMAP={ ArrowLeft:'left',a:'left',A:'left', ArrowRight:'right',d:'right',D:'right',
              ArrowUp:'up',w:'up',W:'up', ArrowDown:'down',s:'down',S:'down' };
 function keyName(e){
  if(KEYMAP[e.key]) return KEYMAP[e.key];
  if(e.key===' '||e.key==='Spacebar') return 'action';
  if(e.key==='Enter') return 'enter';
  if(e.key==='Escape') return 'esc';
  return null;
 }
 function onKeyDown(e){
  if(state==='gate'){
   if(e.key==='Enter'){ e.preventDefault(); gateKey('enter'); }
   else if(e.key==='Backspace'){ e.preventDefault(); gateKey('backspace'); }
   else if(/^[a-zA-Z]$/.test(e.key)){ gateKey(e.key.toLowerCase()); }
   else if(e.key==='Escape') finish();
   e.stopPropagation(); return;
  }
  if(state==='select'){
   if(e.key==='Escape'){ finish(); return; }
   if(e.key==='ArrowUp'||e.key==='w'||e.key==='W'){ e.preventDefault(); moveSel(-1); }
   else if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'){ e.preventDefault(); moveSel(1); }
   else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); playSel(); }
   e.stopPropagation(); return;
  }
  if(state==='tally'){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); tallyAgain(); } else if(e.key==='Escape'){ e.preventDefault(); showSelect(); } e.stopPropagation(); return; }
  if(state==='play'){
   ensureAudio();
   var n=keyName(e);
   if(n){ e.preventDefault();
    if(n==='left'||n==='right'||n==='up'||n==='down') held[n]=true;
    if(n==='esc'){ if(activeLevel) endRun(bestScore, 'left it all behind'); return; }
    if(pressCb) pressCb(n);
   }
   e.stopPropagation();
  }
 }
 function onKeyUp(e){ var n=KEYMAP[e.key]; if(n) held[n]=false; }
 window.addEventListener('keydown',onKeyDown,true);
 window.addEventListener('keyup',onKeyUp,true);
 function onCanvasTap(e){ e.preventDefault(); ensureAudio(); if(state==='tally') tallyAgain(); else if(pressCb) pressCb('tap'); }
 cv.addEventListener('pointerdown',onCanvasTap);

 /* ---- ONE on-screen controller for every game — the same game-boy deck as the arcade
    (snake / pillow-stack / dream-maze): a D-pad + a single A button. Every level maps its
    actions onto the shared press vocabulary (up/down/left/right/action), so the controls
    look and work identically across all three games — no bespoke per-game buttons.
    Pinned to the VIEWPORT (document.body, fixed) and laid out under the visible canvas:
    at full camera zoom the CRT overgrows the window, so an overlay-anchored bar fell
    off the bottom of the screen; reading the live canvas rect keeps the pad on-screen. */
 var ctrlWrap=null;
 function layoutControls(){
  if(!ctrlWrap) return;
  var r=cv.getBoundingClientRect();
  if(!(r.width>1)){ return; }
  var barH=ctrlWrap.offsetHeight||130;
  var top=Math.min(r.bottom+6, window.innerHeight-barH-8);   // just under the canvas, but never off-screen
  top=Math.max(8, top);
  ctrlWrap.style.top=Math.round(top)+'px';
 }
 function padDir(dir){ ensureAudio(); held[dir]=true; if(pressCb) pressCb(dir); }
 function buildGamepad(){
  clearControls();
  ctrlWrap=document.createElement('div');
  ctrlWrap.style.cssText='position:fixed;z-index:10000;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 clamp(16px,6vw,34px);box-sizing:border-box;pointer-events:none;';
  /* D-pad (left) */
  var dpad=document.createElement('div');
  dpad.style.cssText='position:relative;width:9.4em;height:9.4em;font-size:13px;flex:none;';
  function dbtn(dir,glyph,pos){
   var b=document.createElement('button'); b.textContent=glyph;
   b.style.cssText='pointer-events:auto;position:absolute;width:3.1em;height:3.1em;display:grid;place-items:center;color:#fff;font-size:1em;border:1px solid rgba(245,195,207,.35);border-radius:.7em;background:#3c2f35;box-shadow:0 2px 3px rgba(80,30,50,.4),inset 0 1px 0 rgba(255,255,255,.18);-webkit-tap-highlight-color:transparent;touch-action:none;user-select:none;transition:background .1s ease, transform .1s ease;'+pos;
   var down=function(e){ e.preventDefault(); b.style.background=PINK; b.style.transform='scale(.92)'; padDir(dir); };
   var up=function(e){ if(e) e.preventDefault(); b.style.background='#3c2f35'; b.style.transform=''; held[dir]=false; };
   b.addEventListener('pointerdown',down); b.addEventListener('pointerup',up);
   b.addEventListener('pointerleave',up); b.addEventListener('pointercancel',up);
   return b;
  }
  dpad.appendChild(dbtn('up','▲','left:3.15em;top:0;'));
  dpad.appendChild(dbtn('down','▼','left:3.15em;bottom:0;'));
  dpad.appendChild(dbtn('left','◀','left:0;top:3.15em;'));
  dpad.appendChild(dbtn('right','▶','right:0;top:3.15em;'));
  ctrlWrap.appendChild(dpad);
  /* A button (right) — the "action": jump (a) · nothing (b) · boost (c) */
  var a=document.createElement('button'); a.textContent='A';
  a.style.cssText='pointer-events:auto;width:4.4em;height:4.4em;font-size:16px;font-family:'+PIXEL+';color:#fff;border-radius:100px;background:linear-gradient(90deg,#eb648c,#ec642a);border:none;box-shadow:0 5px 14px rgba(235,100,140,.45),inset 0 1px 0 rgba(255,255,255,.3);-webkit-tap-highlight-color:transparent;touch-action:none;flex:none;transition:transform .1s ease;';
  a.addEventListener('pointerdown',function(e){ e.preventDefault(); a.style.transform='scale(.94)'; ensureAudio(); if(pressCb) pressCb('action'); });
  var aup=function(){ a.style.transform=''; }; a.addEventListener('pointerup',aup); a.addEventListener('pointerleave',aup); a.addEventListener('pointercancel',aup);
  ctrlWrap.appendChild(a);
  document.body.appendChild(ctrlWrap);
  ctrlWrap.style.display = useTouch ? 'flex' : 'none';   /* keyboard players don't need it */
  layoutControls();
 }
 /* levels still call env.touchControls(defs); we ignore the per-game labels and show the
    shared game-boy pad instead, so the controller is identical everywhere. */
 function touchControls(defs){
  buildGamepad();
  return { show:function(){ if(ctrlWrap) ctrlWrap.style.display='flex'; },
           hide:function(){ if(ctrlWrap) ctrlWrap.style.display='none'; },
           remove:clearControls };
 }
 function clearControls(){ if(ctrlWrap){ try{ ctrlWrap.parentNode.removeChild(ctrlWrap); }catch(e){} ctrlWrap=null; } }

 /* ---- shared state ---- */
 var state = isLocked() ? 'gate' : 'select';   /* gate | select | play | tally */
 var activeLevel=null, runToken=0;

 /* the env each level receives */
 function makeEnv(){
  var myToken=runToken;
  return {
   ctx:ctx, W:W, H:H, TOUCH:useTouch, colors:COLORS, PIXEL:PIXEL, MONO:MONO,
   rr:rr, tone:tone, snd:snd, loadImage:loadImage, held:held,
   onPress:function(fn){ pressCb=fn; },
   touchControls:touchControls,
   ensureAudio:ensureAudio,
   running:function(){ return state==='play' && runToken===myToken; },
   end:function(score,message){ endRun(score,message); }
  };
 }

 /* ============================================================
    the wordle gate  (unchanged behaviour)
    ============================================================ */
 var gRows=4, gCols=GATE_ANSWER.length, gRow=0, gCur='', gDone=false, tileEls=[], keyEls={}, gateInput=null;   /* 4 tries — fits the CRT, keeps it tense */
 function showGate(){
  state='gate'; cv.style.display='none'; panel.style.display='block'; clearControls(); pressCb=null; headPlaying(false);
  gRow=0; gCur=''; gDone=false; tileEls=[]; keyEls={}; gateInput=null;
  /* sized to fit inside the CRT screen without ever colliding with the header */
  var TS=host?34:44, KH=host?36:44, KWW=host?46:58, KW=host?24:30;
  var h='<p style="font-family:'+PIXEL+';font-size:'+(host?'11px':'13px')+';line-height:1.7;color:#fff;margin:0 0 8px;">🔒 password required</p>'+
   '<div id="vaHints" style="min-height:20px;font-size:'+(host?'15px':'18px')+';color:'+SOFT+';margin:0 0 10px;line-height:1.5;"></div>'+
   '<div id="vaGrid" style="display:inline-grid;grid-template-columns:repeat('+gCols+','+TS+'px);gap:5px;margin-bottom:10px;"></div>'+
   '<div id="vaMsg" style="min-height:20px;font-size:'+(host?'15px':'18px')+';color:'+SOFT+';margin-bottom:6px;"></div>'+
   '<div id="vaKb" style="display:flex;flex-direction:column;gap:5px;align-items:center;"></div>';
  panel.innerHTML=h;
  var grid=panel.querySelector('#vaGrid');
  for(var r=0;r<gRows;r++){ tileEls.push([]);
   for(var c=0;c<gCols;c++){
    var d=document.createElement('div');
    d.style.cssText='width:'+TS+'px;height:'+TS+'px;display:grid;place-items:center;font-family:'+PIXEL+';font-size:'+(host?'12px':'15px')+';color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.22);border-radius:6px;text-transform:uppercase;transition:transform .12s ease, background .2s ease;';
    grid.appendChild(d); tileEls[r].push(d);
   }
  }
  var kb=panel.querySelector('#vaKb');
  /* on touch we render our OWN keyboard (with a visible ENTER) rather than summoning the
     phone's soft keyboard — which used to cover the board and left submit unclear. */
  if(useTouch){ buildGateKeyboard(kb); }
  else { kb.innerHTML='<p style="font-size:'+(host?'15px':'17px')+';color:'+SOFT+';opacity:.7;margin:4px 0 0;">type your guess · enter to submit</p>'; }
  revealHint(1);   /* the question shows BEFORE the first try — simpler */
 }
 /* an on-screen keyboard for the gate — QWERTY + enter/⌫, with per-key colour feedback (keyEls) */
 function buildGateKeyboard(kb){
  var KH=host?34:40, KF=host?'15px':'18px', KLF=host?'9px':'11px';
  kb.innerHTML='<p style="font-size:'+(host?'13px':'16px')+';color:'+SOFT+';opacity:.65;margin:2px 0 8px;">tap to type</p>';
  var wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-direction:column;gap:5px;align-items:center;width:100%;max-width:340px;margin:0 auto;';
  function mkKey(label,onTap,wide,letter){
   var b=document.createElement('button'); b.textContent=label;
   b.style.cssText='all:unset;box-sizing:border-box;cursor:pointer;font-family:'+(wide?PIXEL:MONO)+';font-size:'+(wide?KLF:KF)+';color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(235,100,140,.4);border-radius:5px;height:'+KH+'px;display:grid;place-items:center;-webkit-tap-highlight-color:transparent;user-select:none;'+(wide?'flex:0 0 auto;padding:0 12px;':'flex:1 1 0;min-width:0;');
   b.addEventListener('pointerdown',function(e){ e.preventDefault(); ensureAudio(); onTap(); });
   if(letter) keyEls[letter]=b;
   return b;
  }
  ['qwertyuiop','asdfghjkl','zxcvbnm'].forEach(function(rowStr,ri){
   var row=document.createElement('div'); row.style.cssText='display:flex;gap:4px;justify-content:center;width:100%;';
   if(ri===2) row.appendChild(mkKey('enter',function(){ gateKey('enter'); },true));
   rowStr.split('').forEach(function(ch){ row.appendChild(mkKey(ch,(function(c){ return function(){ gateKey(c); }; })(ch),false,ch)); });
   if(ri===2) row.appendChild(mkKey('⌫',function(){ gateKey('backspace'); },true));
   wrap.appendChild(row);
  });
  kb.appendChild(wrap);
 }
 function gateMsg(t){ var m=panel.querySelector('#vaMsg'); if(m) m.textContent=t; }
 // hints unlock as they play: after guess 1 → hint 1 (the question), after guess 2 → hint 2 (indian sweet)
 function revealHint(n){
  var box=panel.querySelector('#vaHints'); if(!box) return;
  var rows='';
  if(n>=1) rows+='<div>hint 1: '+GATE_Q+'</div>';
  if(n>=2) rows+='<div style="color:'+YEL+';margin-top:5px;">hint 2: '+GATE_HINT+'</div>';
  box.innerHTML=rows; snd.tick();
 }
 function paintCur(){ for(var c=0;c<gCols;c++){ var d=tileEls[gRow][c]; d.textContent=gCur[c]||''; d.style.transform=gCur[c]?'scale(1.06)':'scale(1)'; } }
 function gateKey(k){
  if(gDone||state!=='gate') return;
  if(k==='⌫'||k==='backspace'){ gCur=gCur.slice(0,-1); paintCur(); return; }
  if(k==='enter'){ submitGuess(); return; }
  if(/^[a-z]$/.test(k) && gCur.length<gCols){ gCur+=k; snd.tick(); paintCur(); }
 }
 function evalGuess(guess,ans){
  var res=new Array(gCols).fill('absent'), cnt={}, i;
  for(i=0;i<gCols;i++){ var ch=ans[i]; if(guess[i]===ch) res[i]='correct'; else cnt[ch]=(cnt[ch]||0)+1; }
  for(i=0;i<gCols;i++){ if(res[i]==='correct') continue; var g2=guess[i]; if(cnt[g2]>0){ res[i]='present'; cnt[g2]--; } }
  return res;
 }
 function submitGuess(){
  if(gCur.length<gCols){ gateMsg('need '+gCols+' letters'); snd.bad(); return; }
  if(gateInput) gateInput.value='';
  var guess=gCur, res=evalGuess(guess,GATE_ANSWER), row=gRow;
  res.forEach(function(r,c){
   later(function(){
    var d=tileEls[row][c];
    d.style.background = r==='correct'?GREEN : r==='present'?YEL : DARK;
    d.style.borderColor='transparent';
    d.style.color = r==='present' ? INK : '#fff';
    snd.flip(c);
    var kb=keyEls[guess[c]];
    if(kb){ var cur=kb.dataset.state||'';
     if(r==='correct'||(r==='present'&&cur!=='correct')||(r==='absent'&&!cur)){
      kb.dataset.state=r; kb.style.background = r==='correct'?GREEN : r==='present'?YEL : 'rgba(255,255,255,.04)';
      kb.style.color = r==='present' ? INK : (r==='absent'?'rgba(255,255,255,.4)':'#fff');
     }}
   }, c*160);
  });
  later(function(){
   if(guess===GATE_ANSWER){
    gDone=true;
    try{ localStorage.setItem('ksp-vault','open'); }catch(e){}
    gateMsg("you're in ♡"); snd.win();
    later(showSelect,1200);
   } else {
    gRow++; gCur='';
    if(gRow>=gRows){ gDone=true; gateMsg('not tonight bestie… ask around 🤫');
     var kb=panel.querySelector('#vaKb');
     var again=document.createElement('button');
     again.textContent='try again';
     again.className='vaBtnP'; again.style.marginTop='12px';
     again.addEventListener('click',showGate); kb.appendChild(again); snd.bad();
    } else { gateMsg(''); revealHint(gRow+1); }   // hint 1 is up from the start; a miss unlocks hint 2
   }
  }, gCols*160+220);
 }

 /* ============================================================
    game select — three games, badged a · b · c (not "levels"),
    each card carrying its own local best.
    ============================================================ */
 var GLETTER={1:'a',2:'b',3:'c'};
 function bestFor(n){ try{ var v=parseInt(localStorage.getItem('ksp-hi-vault-'+GLETTER[n]),10); return isFinite(v)?v:0; }catch(e){ return 0; } }
 function setBestFor(n,v){ try{ var k='ksp-hi-vault-'+GLETTER[n]; if(v>bestFor(n)) localStorage.setItem(k,v); }catch(e){} }
 /* laid out like khushi's arcade menu: game list on the left (▸ selection),
    the selected game's HIGH SCORES board on the right. */
 var selIdx=0, BOARDS={};                        /* letter -> {at, board} (sheet fetch cache) */
 function selectable(){
  var byN={}; LEVELS.forEach(function(l){ if(l.n<=3) byN[l.n]=l; });
  var out=[]; for(var n=1;n<=3;n++){ if(byN[n]) out.push(byN[n]); }
  return out;
 }
 function moveSel(d){ var g=selectable(); if(!g.length) return; selIdx=(selIdx+d+g.length)%g.length; snd.tick(); renderSelect(); }
 function playSel(){ var g=selectable(); if(g[selIdx]){ ensureAudio(); startLevel(g[selIdx]); } }
 function showSelect(){
  state='select'; activeLevel=null; pressCb=null; runToken++; headPlaying(false);
  cv.style.display='none'; panel.style.display='block'; clearControls(); paintBest();
  onLevelsChanged=renderSelect; renderSelect();
 }
 function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
 function renderSelect(){
  if(state!=='select') return;
  var games=selectable(); if(selIdx>=games.length) selIdx=0;
  var cur=games[selIdx];
  var list=games.map(function(l,i){
   var on=(i===selIdx);
   return '<li data-lv="'+l.n+'" style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:9px;padding:'+(useTouch?'14px':'9px')+' 4px;'+
    'font-family:'+PIXEL+';font-size:11px;line-height:1.6;color:'+(on?YEL:'#fff')+';">'+
    '<span style="width:14px;color:'+PINK+';">'+(on?'▸':'')+'</span>'+GLETTER[l.n]+' · '+esc(l.title)+'</li>';
  }).join('');
  var html='<div style="display:flex;flex-wrap:wrap;gap:16px 20px;align-items:flex-start;text-align:left;justify-content:center;">'+
   '<ul id="vaList" style="margin:0;padding:0;flex:1 1 200px;min-width:0;border-right:1px solid rgba(255,255,255,.18);padding-right:14px;">'+list+'</ul>'+
   '<div id="vaBoard" style="flex:1 1 150px;min-width:0;">'+
    '<p style="font-family:'+PIXEL+';font-size:10px;letter-spacing:2px;color:'+SOFT+';margin:2px 0 10px;">high scores</p>'+
    '<div id="vaBoardRows" style="font-family:'+MONO+';font-size:16px;color:#fff;"></div>'+
   '</div></div>'+
   '<p style="font-family:'+MONO+';font-size:15px;color:'+SOFT+';opacity:.75;margin:16px 0 0;text-align:center;">'+
   (useTouch?'tap a game for its scores · tap again to play':'↑ ↓ browse · enter play · esc exit')+'</p>';
  panel.innerHTML=html;
  [].forEach.call(panel.querySelectorAll('#vaList li'),function(li,i){
   li.addEventListener('click',function(){
    if(i===selIdx){ playSel(); } else { selIdx=i; snd.tick(); renderSelect(); }
   });
  });
  paintBoard(cur);
 }
 function paintBoard(cur){
  var box=panel.querySelector('#vaBoardRows'); if(!box||!cur) return;
  var letter=GLETTER[cur.n], my=bestFor(cur.n);
  function rows(b){
   var h='';
   if(b && b.top && b.top.length){
    b.top.slice(0,5).forEach(function(e){
     h+='<div style="display:flex;gap:8px;align-items:baseline;margin:0 0 6px;"><span style="color:'+PINK+';font-family:'+PIXEL+';font-size:10px;width:16px;">'+e.rank+'</span>'+
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">@'+esc(e.handle)+'</span><span style="color:'+YEL+';">'+e.score+'</span></div>';
    });
    if(b.you) h+='<div style="border-top:1px dashed rgba(255,255,255,.25);margin-top:8px;padding-top:8px;display:flex;gap:8px;"><span style="color:'+PINK+';font-family:'+PIXEL+';font-size:10px;">#'+b.you.rank+'</span><span style="flex:1;">you</span><span style="color:'+YEL+';">'+b.you.score+(b.you.pending?'*':'')+'</span></div>';
   } else {
    h='<div style="opacity:.75;">no scores yet — be the first ✨</div>';
    if(my>0) h+='<div style="margin-top:8px;">your best <span style="color:'+YEL+';">'+my+'</span></div>';
   }
   return h;
  }
  var cached=BOARDS[letter];
  if(cached && (Date.now()-cached.at)<60000){ box.innerHTML=rows(cached.board); return; }
  box.innerHTML='<div style="opacity:.6;">loading the board…</div>';
  if(window.__slumberGame && window.__slumberGame.board){
   window.__slumberGame.board('vault_'+letter, my).then(function(b){
    BOARDS[letter]={at:Date.now(),board:b};
    if(state==='select' && selectable()[selIdx]===cur){ var bx=panel.querySelector('#vaBoardRows'); if(bx) bx.innerHTML=rows(b); }
   }).catch(function(){ var bx=panel.querySelector('#vaBoardRows'); if(bx) bx.innerHTML=rows(null); });
  } else { box.innerHTML=rows(null); }
 }

 /* ============================================================
    running a level
    ============================================================ */
 function startLevel(mod){
  state='play'; activeLevel=mod; runToken++; headPlaying(true);
  panel.style.display='none'; cv.style.display='block'; doResize(); pressCb=null;
  held.left=held.right=held.up=held.down=false;
  try{ mod.start(makeEnv()); }
  catch(e){ endRun(0,'the game glitched 😵'); }
 }
 var lastEnd=null;
 function endRun(score,message){
  score=Math.max(0,Math.round(+score||0));
  bestScore=Math.max(bestScore, score); paintBest();
  lastEnd={ mod:activeLevel, score:score, message:message||'' };
  if(activeLevel && activeLevel.n){
   var n=activeLevel.n, prev=bestFor(n);
   setBestFor(n, score);                                             /* per-game local best (a/b/c) */
   /* improved a personal best → file it on that game's own board */
   if(score>prev && score>0){
    try{ if(window.__slumberGame && window.__slumberGame.post) window.__slumberGame.post('vault_'+GLETTER[n], score); }catch(e){}
   }
  }
  state='tally'; pressCb=null; showTally();
 }
 function tallyAgain(){ if(lastEnd&&lastEnd.mod) startLevel(lastEnd.mod); else showSelect(); }
 function showTally(){
  headPlaying(false); clearControls(); cv.style.display='none'; panel.style.display='block';
  var e=lastEnd||{score:0,message:''};
  var n=e.mod&&e.mod.n, gb=n?bestFor(n):0, letter=n?GLETTER[n]:'';
  panel.innerHTML='<p style="font-family:'+PIXEL+';font-size:17px;color:'+PINK+';margin:0 0 14px;line-height:1.7;">'+(e.message||'run over')+'</p>'+
   '<p style="font-family:'+PIXEL+';font-size:14px;color:'+YEL+';margin:0 0 6px;">'+e.score+' clout</p>'+
   (n?'<p style="font-size:15px;color:'+SOFT+';opacity:.8;margin:0 0 4px;">game '+letter+' best '+gb+(e.score>=gb&&e.score>0?' — new record ✨':'')+'</p>':'')+
   '<p style="font-size:15px;color:'+SOFT+';opacity:.8;margin:0 0 20px;">overall best '+Math.max(bestStored(),bestScore)+' clout</p>'+
   '<button id="vaAgain" class="vaBtnP" style="margin:0 6px;">play again</button>'+
   '<button id="vaMenu" class="vaBtnS" style="margin:0 6px;">all games</button>';
  panel.querySelector('#vaAgain').addEventListener('click',function(){ ensureAudio(); tallyAgain(); });
  panel.querySelector('#vaMenu').addEventListener('click',function(){ ensureAudio(); showSelect(); });
 }

 /* ---- teardown / exit ---- */
 function finish(){
  if(finished) return; finished=true;
  state='done';
  timers.forEach(function(t){ clearTimeout(t); });
  window.removeEventListener('keydown',onKeyDown,true);
  window.removeEventListener('keyup',onKeyUp,true);
  window.removeEventListener('resize',doResize);
  try{ if(hostRO) hostRO.disconnect(); }catch(e){}
  try{ cv.removeEventListener('pointerdown',onCanvasTap); }catch(e){}
  try{ if(actx&&actx.close) actx.close(); }catch(e){}
  onLevelsChanged=null;
  clearControls();                 /* the touch bar lives on document.body now — remove it explicitly */
  try{ ov.remove(); }catch(e){}
  var total=Math.max(totalClout(),bestScore);   /* arcade board gets the a+b+c total */
  exitCb(total>0?total:0);
 }

 /* ---- boot ---- */
 if(state==='gate') showGate(); else showSelect();
}

})();
