/* ============================================================
   THE INNER CIRCLE · LEVEL 1 — "im soorry"
   Orry's endless RED-CARPET strut. Side view, the world scrolls
   RIGHT→LEFT while Orry struts near the left third. Keep his AURA
   🔥 lit (it drains — flame orbs float HIGH, you must JUMP them),
   JUMP the obstacles on the carpet, and hit POSE while the pixel
   paparazzi strobe their flashes. Streak poses for escalating
   clout; miss the shot and your aura takes the hit — im soorry 🙏.

   Self-registers into the shell (assets/vault.js) via
   window.__innerCircle.register. Draws everything on env.ctx.

   Art it uses IF present (vector fallback always drawn otherwise):
     assets/vault/carpet-bg.png  — wide scrolling red-carpet scene
     assets/vault/orry-walk.png  — 6-frame horizontal walk strip
     assets/vault/orry-sheet.png — 3-frame fallback sheet
   ============================================================ */
(function(){ 'use strict';

 function boot(){
  if(!(window.__innerCircle&&window.__innerCircle.register)){ return setTimeout(boot,120); }
  window.__innerCircle.register({
   n:1, key:'soorry', title:'im soorry', sub:'strut the red carpet. pose. dodge the paps.', playable:true,
   start:startLevel
  });
 }

 function startLevel(env){
  var ctx=env.ctx, C=env.colors, W=env.W, H=env.H;
  var PIXEL=env.PIXEL, MONO=env.MONO;

  /* ---- world geometry (square canvas) ---- */
  var GROUND=470;                  /* carpet line — Orry's feet ride here */
  var ORRY_X=170;                  /* he struts in the left third */

  /* ---- optional art (vector fallback until/if these load) ---- */
  var bgImg  =env.loadImage('assets/vault/carpet-bg.png');
  var walkImg=env.loadImage('assets/vault/orry-walk.png');
  var sheetImg=env.loadImage('assets/vault/orry-sheet.png');

  /* ---- tuning ---- */
  var BASE=150, CAP=330;           /* ground speed px/s (keeps ramping for skilled runs) */
  var AURA_MAX=10, AURA_START=7;
  var JUMPV=428, GRAV=980;         /* peak ≈ 93px, airtime ≈ 0.87s */
  var GRACE=1.0;                   /* no hazards before this */
  var ORB_LIFT=36;                 /* must be at least this airborne to catch an orb */
  /* pose window: opens when the pap is this far ahead, fails behind Orry
     (270px wide → ≥0.82s even at CAP speed) */
  var POSE_OPEN=ORRY_X+240, POSE_FAIL=ORRY_X-30;

  /* ---- run state ---- */
  var speed=BASE, scroll=0, elapsed=0, over=false, raf=0, last=0;
  var clout=0, poseCount=0, orbCount=0, streak=0, bestStreak=0;
  var aura=AURA_START;
  var lift=0, vy=0, airborne=false;
  var walkFrame=0, frameTimer=0, poseFlash=0, poseLock=0;
  var shake=0, whiteT=0;           /* screen shake + white flash burst */
  var warnT=0;                     /* soft low-aura warning tick timer */
  var flash=null;                  /* {text,color,t,life} centre feedback */

  var objs=[];                     /* approaching hazards / paps / orbs */
  var pending=null;                /* current major (obs|pap) locking the director */
  var activePap=null;              /* pap whose pose-window is open */
  var majorSeq=0, cooldown=0.5, orbTimer=1.3;

  /* ---- decorative fallback backdrop (fixed for the run) ---- */
  var skyline=[]; var bx=0;
  while(bx<W+40){ var bw=20+Math.random()*34, bh=40+Math.random()*90; skyline.push({x:bx,w:bw,h:bh,tone:Math.random()}); bx+=bw+3+Math.random()*10; }
  var crowd=[]; for(var q=0;q<46;q++){ crowd.push({x:Math.random()*(W+40), r:5+Math.random()*4, tw:Math.random()*6.28, sp:0.5+Math.random()}); }

  /* =====================================================================
     input — jump (action/up/tap) · pose (down)
     ===================================================================== */
  function jump(){
   if(over) return;
   if(!airborne){ airborne=true; vy=JUMPV; env.snd.jump(); }
  }
  function pose(){
   if(over) return;
   if(poseLock>0) return;            /* recovering from a wasted pose — no mash-to-win */
   poseFlash=0.42;
   if(activePap && !activePap.posed && !activePap.missed){
    var fr=(activePap.x-POSE_FAIL)/(POSE_OPEN-POSE_FAIL); if(fr<0)fr=0; if(fr>1)fr=1;
    var flawless = fr<0.34;                    /* held nerve till the pap was RIGHT there */
    activePap.posed=true; activePap.flashT=0;
    streak++; poseCount++; if(streak>bestStreak) bestStreak=streak;
    var pts=20+streak*10; if(flawless) pts*=2;
    clout+=pts;
    aura=Math.min(AURA_MAX, aura+(flawless?2:1));
    shake=1; whiteT=0.22;
    env.snd.iconic();
    if(flawless) setFlash('flawless! +'+pts+' ✨',C.YEL);
    else if(streak>1) setFlash('iconic x'+streak+'! +'+pts+' 📸',C.YEL);
    else setFlash('iconic! +'+pts+' 📸',C.YEL);
    pending=null; activePap=null; cooldown=0.95+Math.random()*0.6;
   } else if(pending && pending.type==='pap' && !pending.open && pending.x<W){
    /* jumped the gun — a pap is inbound but the flashes haven't started.
       kills the streak + brief recovery, so spamming pose is never free */
    poseLock=0.55;
    if(streak>0){ streak=0; env.snd.bad(); setFlash('jumped the gun! streak lost 😬',C.PINK); }
    else { env.snd.tick(); setFlash('not yet… wait for the flashes',C.SOFT); }
   } else {
    poseLock=0.4;                  /* stray flex — short recovery */
    env.snd.tick();
   }
  }
  env.onPress(function(name){
   if(name==='down') pose();
   else if(name==='up'||name==='action'||name==='tap') jump();
  });
  env.touchControls([
   { label:'jump', onPress:jump },
   { label:'pose', onPress:pose }
  ]);

  /* =====================================================================
     director — one major (obstacle OR pap) at a time so a jump and a
     pose never collide; flame orbs float HIGH in the gaps.
     ===================================================================== */
  function spawnMajor(){
   if(majorSeq%2===0){
    /* next major is an obstacle — never drop it tight behind a live orb,
       or chasing the orb becomes an unreadable landing-on-the-hazard trap */
    for(var i=0;i<objs.length;i++){ var o=objs[i];
     if(o.type==='orb' && !o.done && o.x>W-280){ cooldown=0.3; return; }
    }
   }
   majorSeq++;
   if(majorSeq%2===1) spawnObstacle(); else spawnPap();
  }
  function spawnObstacle(){
   /* kinds: 0 knocked-over stanchion+rope · 1 spilled champagne bucket · 2 rolled carpet bump
      — deliberately NOTHING camera-like; only the pose-gate paps read as photographers */
   var o={ type:'obs', x:W+70, hw:17, h:42, kind:Math.floor(Math.random()*3), done:false, overTop:false, minCl:null };
   objs.push(o); pending=o;
  }
  function spawnPap(){
   var o={ type:'pap', x:W+70, open:false, posed:false, missed:false, flashT:0, seed:Math.random()*6.28 };
   objs.push(o); pending=o;
  }
  function spawnOrb(){
   /* HIGH — above Orry's standing head (top ≈ GROUND-150). jump or starve. */
   var oy=GROUND-165-Math.random()*32;
   objs.push({ type:'orb', x:W+40, y:oy, bob:Math.random()*6.28, done:false });
   if(Math.random()<0.3) objs.push({ type:'orb', x:W+40+74, y:GROUND-165-Math.random()*32, bob:Math.random()*6.28, done:false });
  }

  /* =====================================================================
     update
     ===================================================================== */
  function setFlash(text,color){ flash={ text:text, color:color, t:0, life:1.05 }; }
  function endRun(msg){ if(over) return; over=true; env.end(Math.round(clout), msg); }

  function update(dt){
   elapsed+=dt;
   speed=Math.min(CAP, BASE+elapsed*5.5);
   scroll += speed*dt;
   /* distance clout — richer at higher speed, sweeter mid-streak */
   clout += speed*dt*0.05*(1+streak*0.08);

   /* aura drains harder the faster the strut — top it up with orbs & poses.
      tuned so PERFECT collection climbs (+~1.45/s in) and sloppy play starves:
      skill decides whether the run keeps going. */
   var drain=0.85+0.4*(speed-BASE)/(CAP-BASE);
   aura -= drain*dt;
   if(aura<=0){ aura=0; env.snd.sorry(); endRun('aura ran out 🔥 im soorry'); return; }
   /* soft warning tick while the flame is critically low */
   if(aura<3){ warnT-=dt; if(warnT<=0){ warnT=0.8; env.tone(320,0.1,'sine',0.03,0,240); } }
   else warnT=0;

   /* strut cadence — legs cycle faster the faster he moves */
   frameTimer += dt;
   var fd=Math.max(0.06, 0.13 - (speed-BASE)/2600);
   if(frameTimer>=fd){ frameTimer-=fd; walkFrame=(walkFrame+1)%6; }

   /* jump physics */
   if(airborne){ vy -= GRAV*dt; lift += vy*dt; if(lift<=0){ lift=0; vy=0; airborne=false; } }
   if(poseFlash>0) poseFlash-=dt;
   if(poseLock>0) poseLock-=dt;
   if(shake>0) shake=Math.max(0,shake-dt*3.2);
   if(whiteT>0) whiteT-=dt;

   /* director */
   if(elapsed>GRACE){
    if(pending===null){ cooldown-=dt; if(cooldown<=0) spawnMajor(); }
    orbTimer-=dt;
    if(orbTimer<=0){ orbTimer=1.2+Math.random()*0.8; if(!(pending&&pending.type==='pap'&&pending.open)) spawnOrb(); }   /* frequent enough that a good jumper can sustain */
   }

   /* advance & resolve entities */
   for(var i=objs.length-1;i>=0;i--){
    var o=objs[i];
    o.x -= speed*dt;
    if(o.flashT!=null) o.flashT+=dt;

    if(o.type==='obs' && !o.done){
     var ox0=o.x-o.hw, ox1=o.x+o.hw, px0=ORRY_X-17, px1=ORRY_X+17;
     if(ox1>px0 && ox0<px1){
      if(lift < o.h-6){ env.snd.sorry(); endRun('carpet moment 😳 so not iconic'); return; }
      o.overTop=true;
      var cl=lift-o.h; if(o.minCl===null||cl<o.minCl) o.minCl=cl;
     }
     if(o.x < ORRY_X-46){
      o.done=true; pending=null; cooldown=0.85+Math.random()*0.7;
      if(o.overTop && o.minCl!==null && o.minCl<30){ clout+=15; env.snd.swerve(); setFlash('close call! +15','#fff'); }
      else { clout+=6; env.snd.good(); }
     }
    }
    else if(o.type==='pap' && !o.posed && !o.missed){
     if(!o.open && o.x<=POSE_OPEN){ o.open=true; o.flashT=0; activePap=o; env.snd.coin(); }
     if(o.x < POSE_FAIL){
      /* missed the shot — that's the whole game. run ends, im soorry. */
      o.missed=true; o.open=false;
      if(activePap===o) activePap=null;
      env.snd.sorry(); shake=0.8;
      endRun('you missed the shot — im soorry 🙏'); return;
     }
    }
    else if(o.type==='orb' && !o.done){
     /* only catchable mid-jump — reach UP for it */
     if(airborne && lift>ORB_LIFT){
      var dx=o.x-ORRY_X, dy=o.y-(GROUND-lift-110);
      if(Math.abs(dx)<36 && Math.abs(dy)<46){
       o.done=true; aura=Math.min(AURA_MAX,aura+2); clout+=5; orbCount++;
       env.snd.coin(); setFlash('+aura 🔥',C.GREEN);
      }
     }
    }

    if(o.x < -110) objs.splice(i,1);
   }

   if(flash){ flash.t+=dt; if(flash.t>=flash.life) flash=null; }
  }

  /* =====================================================================
     drawing
     ===================================================================== */
  function drawBackground(){
   if(bgImg && bgImg.ok){
    try{
     /* integer tile width + rounded x so the loop never shows a seam
        (smoothing is OFF — fractional positions would leave 1px gaps) */
     var scl=H/bgImg.img.height, sw=Math.max(1,Math.round(bgImg.img.width*scl));
     var off=scroll % sw; if(off<0) off+=sw;
     var x0=-Math.round(off);
     for(var x=x0; x<W; x+=sw){ ctx.drawImage(bgImg.img, x, 0, sw, H); }
     return;
    }catch(e){}
   }
   drawVectorBackground();
  }

  function drawVectorBackground(){
   /* sunset sky */
   var g=ctx.createLinearGradient(0,0,0,GROUND-30);
   g.addColorStop(0,'#3a1d5e'); g.addColorStop(0.5,'#7a2f6a'); g.addColorStop(1,'#ec642a');
   ctx.fillStyle=g; ctx.fillRect(0,0,W,GROUND-30);

   /* skyline (scrolls) */
   var period=W+40, so=scroll*0.6 % period; if(so<0) so+=period;
   var baseY=380, i,k;
   for(k=-1;k<=1;k++){
    for(i=0;i<skyline.length;i++){ var b=skyline[i], sx=b.x-so+k*period;
     if(sx>W+40||sx<-60) continue;
     ctx.fillStyle=b.tone>0.5?'#2a1540':'#331a4a'; ctx.fillRect(sx,baseY-b.h,b.w,b.h);
     for(var wy=baseY-b.h+6; wy<baseY-4; wy+=9){ for(var wx=sx+3; wx<sx+b.w-3; wx+=7){
       if((wx+wy+i)%3===0){ ctx.fillStyle=((wx+i)%2)?'#eb648c':'#ebd81b'; ctx.globalAlpha=0.7; ctx.fillRect(wx,wy,2.4,3.2); ctx.globalAlpha=1; } } }
    }
   }

   /* paparazzi crowd behind the rope (flashing) */
   var cso=scroll*0.85 % (W+40); if(cso<0) cso+=(W+40);
   for(k=0;k<=1;k++){ for(i=0;i<crowd.length;i++){ var c=crowd[i], cx=c.x-cso+k*(W+40);
     if(cx<-10||cx>W+10) continue;
     ctx.fillStyle='#160a22'; ctx.beginPath(); ctx.arc(cx,404,c.r,0,6.283); ctx.fill();
     ctx.fillRect(cx-c.r,404,c.r*2,20);
     var fl=Math.sin(elapsed*c.sp*6+c.tw);
     if(fl>0.82){ ctx.globalAlpha=(fl-0.82)/0.18; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,398,3,0,6.283); ctx.fill(); ctx.globalAlpha=1; }
   } }

   /* gold stanchions + red velvet rope */
   var rso=scroll % 150; if(rso<0) rso+=150;
   ctx.strokeStyle='#a01530'; ctx.lineWidth=4;
   for(var px=-rso; px<W+150; px+=150){
    ctx.beginPath(); ctx.moveTo(px,428); ctx.quadraticCurveTo(px+75,448,px+150,428); ctx.stroke();
    ctx.fillStyle='#c9a13a'; ctx.fillRect(px-3,414,6,24);
    ctx.fillStyle='#ebd81b'; ctx.beginPath(); ctx.arc(px,412,4,0,6.283); ctx.fill();
   }

   /* red carpet strip + pavement */
   ctx.fillStyle='#8f1420'; ctx.fillRect(0,GROUND-30,W,90);
   ctx.fillStyle='#b31d2b'; ctx.fillRect(0,GROUND-24,W,80);
   ctx.fillStyle='#c9a13a'; ctx.fillRect(0,GROUND-26,W,2); ctx.fillRect(0,GROUND+50,W,2);
   ctx.fillStyle='#2a2038'; ctx.fillRect(0,GROUND+56,W,H-(GROUND+56));
   /* pavement seams scrolling */
   var pso=scroll % 60; if(pso<0) pso+=60;
   ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=2;
   for(var qx=-pso; qx<W; qx+=60){ ctx.beginPath(); ctx.moveTo(qx,GROUND+58); ctx.lineTo(qx,H); ctx.stroke(); }
  }

  /* ---- obstacles on the carpet ---- */
  function drawObstacle(o){
   if(o.done) return;
   var x=o.x, baseY=GROUND+6;
   ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x,baseY+2,o.hw+6,6,0,0,6.283); ctx.fill();
   if(o.kind===0){
    /* knocked-over stanchion — gold pole down flat, rope tangled over it */
    ctx.fillStyle='#8a6a1f'; ctx.fillRect(x-o.hw-2, baseY-10, o.hw*2+4, 8);          /* pole shadow side */
    ctx.fillStyle='#c9a13a'; ctx.fillRect(x-o.hw-2, baseY-13, o.hw*2+4, 6);          /* fallen gold pole */
    ctx.fillStyle='#ebd81b'; ctx.beginPath(); ctx.arc(x+o.hw+2, baseY-11, 6, 0, 6.283); ctx.fill(); /* ball top */
    ctx.fillStyle='#c9a13a'; ctx.fillRect(x-o.hw-6, baseY-16, 6, 12);                 /* base plate on end */
    /* red velvet rope flopped up in a loop — that's the bit you trip on */
    ctx.strokeStyle='#a01530'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(x-o.hw, baseY-10);
    ctx.quadraticCurveTo(x-6, baseY-o.h-4, x+4, baseY-o.h*0.55);
    ctx.quadraticCurveTo(x+12, baseY-14, x+o.hw, baseY-8);
    ctx.stroke();
    ctx.strokeStyle='#c92545'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x-o.hw, baseY-11);
    ctx.quadraticCurveTo(x-6, baseY-o.h-5, x+4, baseY-o.h*0.55-1);
    ctx.stroke();
   } else if(o.kind===1){
    /* spilled champagne bucket — tipped silver bucket, bottle out, fizzy puddle */
    ctx.fillStyle='rgba(245,238,224,0.28)';                                           /* puddle */
    ctx.beginPath(); ctx.ellipse(x-o.hw*0.4, baseY-1, o.hw+8, 4, 0, 0, 6.283); ctx.fill();
    ctx.save(); ctx.translate(x+4, baseY-17); ctx.rotate(-0.62);                      /* tipped bucket */
    ctx.fillStyle='#9aa4b5'; env.rr(-11, -19, 22, 34, 4); ctx.fill();
    ctx.fillStyle='#c7ceda'; ctx.fillRect(-11, -19, 22, 5);                           /* rim */
    ctx.fillStyle='#6d7688'; ctx.fillRect(-11, 7, 22, 4);                             /* band */
    ctx.restore();
    /* champagne bottle slid out, lying low */
    ctx.save(); ctx.translate(x-o.hw+2, baseY-6); ctx.rotate(-0.12);
    ctx.fillStyle='#1d4a2a'; env.rr(-8, -5, 20, 9, 4); ctx.fill();                    /* dark green body */
    ctx.fillStyle='#1d4a2a'; ctx.fillRect(-14, -3, 7, 5);                             /* neck */
    ctx.fillStyle='#ebd81b'; ctx.fillRect(-16, -4, 4, 7);                             /* gold foil cap */
    ctx.restore();
    /* fizz sparkles */
    ctx.fillStyle='#f5eee0';
    ctx.fillRect(x-o.hw-4, baseY-o.h*0.7, 2, 2);
    ctx.fillRect(x+2, baseY-o.h-2+Math.sin(elapsed*9+x)*2, 2, 2);
    ctx.fillRect(x-6, baseY-o.h*0.85, 2, 2);
   } else {
    /* rolled carpet bump — a fat red roll rucked up off the runway */
    ctx.fillStyle='#8f1420';                                                          /* roll body */
    ctx.beginPath(); ctx.ellipse(x, baseY-o.h*0.42, o.hw+3, o.h*0.42, 0, 3.1416, 6.283); ctx.fill();
    ctx.fillRect(x-o.hw-3, baseY-o.h*0.42, (o.hw+3)*2, o.h*0.42);
    ctx.fillStyle='#b31d2b';                                                          /* highlight */
    ctx.beginPath(); ctx.ellipse(x-2, baseY-o.h*0.46, o.hw-2, o.h*0.34, 0, 3.4, 5.9); ctx.fill();
    /* spiral end-cap so it reads as a ROLL */
    ctx.fillStyle='#6d0e18'; ctx.beginPath(); ctx.arc(x+o.hw-2, baseY-o.h*0.42, o.h*0.34, 0, 6.283); ctx.fill();
    ctx.strokeStyle='#b31d2b'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(x+o.hw-2, baseY-o.h*0.42, o.h*0.2, 0.6, 5.2); ctx.stroke();
    ctx.fillStyle='#c9a13a';                                                          /* gold trim edge */
    ctx.fillRect(x-o.hw-3, baseY-4, (o.hw+3)*2, 3);
   }
  }

  /* ---- pixel paparazzo — a little photographer at the rope line,
          dark fit, big camera to the face, popping white flashes ---- */
  function drawPapFigure(x,footY,s,lit,phase){
   /* shadow */
   ctx.fillStyle='rgba(0,0,0,0.3)';
   ctx.beginPath(); ctx.ellipse(x,footY+2,14*s,4*s,0,0,6.283); ctx.fill();
   /* legs (slight shooter stance) */
   ctx.fillStyle='#171018';
   ctx.fillRect(x-8*s, footY-18*s, 6*s, 18*s);
   ctx.fillRect(x+2*s, footY-18*s, 6*s, 18*s);
   ctx.fillStyle='#0c0812';                       /* shoes */
   ctx.fillRect(x-10*s, footY-3*s, 9*s, 3*s);
   ctx.fillRect(x+1*s,  footY-3*s, 9*s, 3*s);
   /* jacket (leaning into the shot) */
   ctx.fillStyle='#241830';
   env.rr(x-10*s, footY-42*s, 20*s, 26*s, 5*s); ctx.fill();
   ctx.strokeStyle='#0c0812'; ctx.lineWidth=Math.max(1.5,1.5*s);
   env.rr(x-10*s, footY-42*s, 20*s, 26*s, 5*s); ctx.stroke();
   /* head tucked behind the camera + beanie */
   ctx.fillStyle='#e8b088';
   ctx.beginPath(); ctx.arc(x+1*s, footY-47*s, 7*s, 0, 6.283); ctx.fill();
   ctx.fillStyle='#140a20';
   env.rr(x-7*s, footY-56*s, 16*s, 7*s, 3*s); ctx.fill();
   /* arms/hands gripping the camera */
   ctx.fillStyle='#241830';
   ctx.fillRect(x-14*s, footY-42*s, 10*s, 6*s);
   ctx.fillStyle='#e8b088';
   ctx.fillRect(x-16*s, footY-43*s, 5*s, 5*s);
   ctx.fillRect(x-8*s,  footY-38*s, 5*s, 4*s);
   /* BIG camera pressed to the face, lens aimed left at Orry */
   ctx.fillStyle='#0c0812';
   env.rr(x-22*s, footY-52*s, 20*s, 13*s, 2*s); ctx.fill();
   ctx.strokeStyle='#000'; ctx.lineWidth=Math.max(1,1*s);
   env.rr(x-22*s, footY-52*s, 20*s, 13*s, 2*s); ctx.stroke();
   ctx.fillStyle='#3a2b57';                       /* body detail stripe */
   ctx.fillRect(x-20*s, footY-45*s, 16*s, 2.5*s);
   /* lens barrel poking left */
   ctx.fillStyle='#171018';
   ctx.fillRect(x-28*s, footY-49*s, 7*s, 7*s);
   ctx.fillStyle='#0c0812';
   ctx.beginPath(); ctx.arc(x-28*s, footY-45.5*s, 4*s, 0, 6.283); ctx.fill();
   ctx.fillStyle=lit?'#fff':C.SOFT;               /* glass glint */
   ctx.beginPath(); ctx.arc(x-28*s, footY-45.5*s, 1.8*s, 0, 6.283); ctx.fill();
   /* flash unit on top */
   ctx.fillStyle='#3a2b57';
   ctx.fillRect(x-18*s, footY-57*s, 7*s, 5*s);
   ctx.fillStyle='#f5eee0';
   ctx.fillRect(x-17*s, footY-56*s, 5*s, 3*s);
   /* THE FLASH — rapid strobe while the pose window is live */
   if(lit){
    var on=Math.sin(elapsed*24+phase)>-0.05;
    if(on){
     var fx=x-24*s, fy=footY-54*s;
     var fg=ctx.createRadialGradient(fx,fy,2,fx,fy,52*s);
     fg.addColorStop(0,'rgba(255,255,255,0.85)');
     fg.addColorStop(0.35,'rgba(255,246,214,0.4)');
     fg.addColorStop(1,'rgba(255,255,255,0)');
     ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(fx,fy,52*s,0,6.283); ctx.fill();
     /* starburst rays */
     ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2*s;
     var rrot=elapsed*9+phase;
     for(var r=0;r<4;r++){ var an=r/4*3.1416+rrot%0.6;
      ctx.beginPath();
      ctx.moveTo(fx-Math.cos(an)*14*s, fy-Math.sin(an)*14*s);
      ctx.lineTo(fx+Math.cos(an)*14*s, fy+Math.sin(an)*14*s);
      ctx.stroke();
     }
     ctx.fillStyle='#fff';
     ctx.beginPath(); ctx.arc(fx,fy,4*s,0,6.283); ctx.fill();
    }
   }
  }

  function drawPap(o){
   var x=o.x, footY=456;
   var lit = o.open && !o.posed && !o.missed;
   /* BIG pap scrum at the rope line — main shooter ~105px tall so there is
      zero doubt who the photographer is; second shooter looms just behind */
   drawPapFigure(x+42, footY, 1.4, lit, o.seed+2.1);
   drawPapFigure(x, footY, 1.85, lit, o.seed);
   if(lit){
    /* pose cue floating above the scrum */
    ctx.globalAlpha=0.8+0.2*Math.sin(elapsed*16);
    ctx.fillStyle=C.PINK; ctx.font='11px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('pose! 📸', x-4, footY-128);
    ctx.globalAlpha=1;
   }
   if(o.posed && o.flashT<0.5){
    ctx.globalAlpha=Math.max(0,1-o.flashT/0.5); ctx.fillStyle=C.YEL;
    ctx.font='13px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★', x-4, footY-124); ctx.globalAlpha=1;
   }
   if(o.missed){
    ctx.globalAlpha=0.7; ctx.fillStyle=C.SOFT;
    ctx.font='10px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('…', x-4, footY-124); ctx.globalAlpha=1;
   }
  }

  /* ---- flame orb (floats HIGH — jump for it) ---- */
  function drawOrb(o){
   /* an unmissable beacon — big pulsing white-hot flame, gold ring, ember sparks.
      leans white/gold/pink so it can never sink into the carpet reds. */
   if(o.done) return;
   var x=o.x, y=o.y+Math.sin(o.bob+elapsed*6)*4;
   var pl=0.75+0.25*Math.sin(elapsed*9+o.bob);
   /* huge halo */
   var g=ctx.createRadialGradient(x,y,3,x,y,46);
   g.addColorStop(0,'rgba(255,255,255,'+(0.85*pl)+')');
   g.addColorStop(0.35,'rgba(255,214,90,'+(0.5*pl)+')');
   g.addColorStop(1,'rgba(235,100,140,0)');
   ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,46,0,6.283); ctx.fill();
   /* gold pulse ring */
   ctx.strokeStyle='rgba(255,224,102,'+(0.55+0.4*pl)+')'; ctx.lineWidth=2.5;
   ctx.beginPath(); ctx.arc(x,y,19+3*pl,0,6.283); ctx.stroke();
   /* flame body — bigger, hot pink-orange with a white core */
   ctx.fillStyle='#ff7a3c'; ctx.beginPath(); ctx.moveTo(x,y-18); ctx.quadraticCurveTo(x+12,y-3,x+8,y+8); ctx.quadraticCurveTo(x+6,y+14,x,y+14); ctx.quadraticCurveTo(x-6,y+14,x-8,y+8); ctx.quadraticCurveTo(x-12,y-3,x,y-18); ctx.fill();
   ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.moveTo(x,y-9); ctx.quadraticCurveTo(x+6,y+2,x+4,y+8); ctx.quadraticCurveTo(x,y+12,x-4,y+8); ctx.quadraticCurveTo(x-6,y+2,x,y-9); ctx.fill();
   ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(x,y-3); ctx.quadraticCurveTo(x+3,y+3,x,y+8); ctx.quadraticCurveTo(x-3,y+3,x,y-3); ctx.fill();
   /* ember sparks */
   for(var e2=0;e2<3;e2++){ var a=elapsed*4+o.bob+e2*2.1, sx2=x+Math.cos(a)*(24+e2*3), sy2=y+Math.sin(a*1.3)*10-e2*5;
    ctx.fillStyle='rgba(255,230,140,'+(0.5+0.3*Math.sin(a*2))+')'; ctx.fillRect(sx2,sy2,3,3); }
  }

  /* ---- Orry himself ---- */
  function drawOrry(){
   var cx=ORRY_X, feetY=GROUND, y=feetY-lift;
   var sh=Math.max(0.28,1-lift/150);
   ctx.fillStyle='rgba(0,0,0,'+(0.34*sh)+')';
   ctx.beginPath(); ctx.ellipse(cx,feetY+4,34*sh,9*sh,0,0,6.283); ctx.fill();

   var drawH=150, posing=poseFlash>0;
   /* the ICONIC pose — front-facing, pointing at himself — lives on the
      3-frame sheet (frame 2); the 6-frame strip only has walk steps */
   if(posing && sheetImg && sheetImg.ok){
    try{
     var pfw=sheetImg.img.width/3, pfh=sheetImg.img.height, pdw=drawH*pfw/pfh;
     ctx.drawImage(sheetImg.img, Math.round(2*pfw),0, Math.round(pfw),pfh,
                   Math.round(cx-pdw/2), Math.round(y-drawH), Math.round(pdw), drawH);
    }catch(e){ drawVectorOrry(cx,y,posing); }
   } else if(walkImg && walkImg.ok){
    try{
     var fw=walkImg.img.width/6, fh=walkImg.img.height, dw=drawH*fw/fh;
     var fr=airborne?1:(walkFrame%6);
     ctx.drawImage(walkImg.img, Math.round(fr*fw),0, Math.round(fw),fh,
                   Math.round(cx-dw/2), Math.round(y-drawH), Math.round(dw), drawH);
    }catch(e){ drawVectorOrry(cx,y,posing); }
   } else if(sheetImg && sheetImg.ok){
    try{
     var sfw=sheetImg.img.width/3, sfh=sheetImg.img.height, sdw=drawH*sfw/sfh;
     var sfr=posing?2:(airborne?1:0);
     ctx.drawImage(sheetImg.img, Math.round(sfr*sfw),0, Math.round(sfw),sfh,
                   Math.round(cx-sdw/2), Math.round(y-drawH), Math.round(sdw), drawH);
    }catch(e){ drawVectorOrry(cx,y,posing); }
   } else {
    drawVectorOrry(cx,y,posing);
   }

   /* pose sparkle burst */
   if(posing){
    var a=Math.min(1,poseFlash/0.42);
    ctx.globalAlpha=a;
    ctx.fillStyle=C.YEL;
    for(var s=0;s<6;s++){ var ang=s/6*6.283+elapsed*3, rr2=44+8*Math.sin(elapsed*20);
     var sx=cx+Math.cos(ang)*rr2, sy=y-88+Math.sin(ang)*rr2*0.7;
     ctx.beginPath(); ctx.arc(sx,sy,2.4,0,6.283); ctx.fill(); }
    ctx.globalAlpha=1;
   }
  }

  /* vector fallback figure — a chunky puffer-jacket icon in shades */
  function drawVectorOrry(cx,feetY,posing){
   var topY=feetY-150;
   /* legs (cycle) */
   var sw=posing?0:Math.sin(walkFrame/6*6.283)*10;
   ctx.fillStyle='#171018';
   ctx.fillRect(cx-14, feetY-52, 12, 52-Math.max(0,sw));
   ctx.fillRect(cx+2,  feetY-52, 12, 52-Math.max(0,-sw));
   ctx.fillStyle='#eb648c';   /* sneakers */
   ctx.fillRect(cx-16, feetY-8-Math.max(0,sw), 16, 8);
   ctx.fillRect(cx,    feetY-8-Math.max(0,-sw), 16, 8);
   /* puffer body */
   ctx.fillStyle='#241830';
   env.rr(cx-30, topY+36, 60, 74, 22); ctx.fill();
   ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=2;
   for(var ln=topY+50; ln<topY+104; ln+=14){ ctx.beginPath(); ctx.moveTo(cx-28,ln); ctx.lineTo(cx+28,ln); ctx.stroke(); }
   /* arm (up for pose) */
   ctx.fillStyle='#241830';
   if(posing){ env.rr(cx+18,topY+18,12,34,6); ctx.fill(); }
   else { env.rr(cx+20,topY+44,12,34,6); ctx.fill(); }
   /* head */
   ctx.fillStyle='#e8b088'; ctx.beginPath(); ctx.arc(cx, topY+22, 20, 0, 6.283); ctx.fill();
   ctx.fillStyle='#171018'; env.rr(cx-24,topY+2,48,16,7); ctx.fill();       /* hair/cap */
   ctx.fillStyle='#0c0812'; env.rr(cx-14,topY+18,28,9,3); ctx.fill();        /* shades */
   ctx.fillStyle='rgba(235,100,140,0.5)'; ctx.fillRect(cx-11,topY+20,10,3); ctx.fillRect(cx+2,topY+20,10,3);
  }

  /* =====================================================================
     HUD — signature FLAME GAUGE (the aura meter)
     ===================================================================== */
  function drawFlameGauge(){
   var px=12, py=10, pw=216, ph=66;
   var frac=aura/AURA_MAX;
   var low=frac<0.3, crit=aura<3;

   /* pulsing warning glow ringing the whole pill when aura is critical */
   if(crit){
    var pulse=0.35+0.3*(0.5+0.5*Math.sin(elapsed*8));
    ctx.globalAlpha=pulse;
    ctx.strokeStyle=C.PINK; ctx.lineWidth=6;
    env.rr(px-3,py-3,pw+6,ph+6,17); ctx.stroke();
    ctx.globalAlpha=1;
   }

   /* pill — solid dark so it NEVER blends into the backdrop, always outlined */
   ctx.fillStyle='rgba(11,7,22,0.85)'; env.rr(px,py,pw,ph,14); ctx.fill();
   ctx.strokeStyle= crit ? C.PINK : 'rgba(245,195,207,0.4)';
   ctx.lineWidth=2; env.rr(px,py,pw,ph,14); ctx.stroke();

   /* the flame itself — BIG. roars pink/gold when high, gutters grey-blue when low */
   var fx=px+36, fbase=py+ph-10;
   var flick=Math.sin(elapsed*13)*2.6 + Math.sin(elapsed*29+1.7)*1.6;
   var fh=13+38*frac+flick*Math.max(0.35,frac);           /* flame height */
   var fw2=8+11*frac;                                      /* half width */
   var sputter = low && Math.sin(elapsed*21)<-0.55;        /* low flame gutters out */
   var alpha = sputter?0.3 : (low?0.7+0.3*Math.sin(elapsed*17):1);
   /* colour states: rich orange/gold high · cold grey-blue guttering low */
   var outerCol = low ? '#5d6f92' : '#ec642a';
   var innerCol = low ? '#9fb4d6' : C.YEL;

   /* glow halo when the aura is roaring */
   if(frac>0.55){
    var gg=ctx.createRadialGradient(fx,fbase-fh*0.45,3,fx,fbase-fh*0.45,30+20*frac);
    gg.addColorStop(0,'rgba(235,216,27,'+(0.3*frac)+')');
    gg.addColorStop(0.55,'rgba(235,100,140,'+(0.16*frac)+')');
    gg.addColorStop(1,'rgba(235,100,42,0)');
    ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(fx,fbase-fh*0.45,30+20*frac,0,6.283); ctx.fill();
   }
   ctx.globalAlpha=alpha;
   /* outer flame — licking sideways with the flicker */
   var lean=Math.sin(elapsed*11)*3*frac;
   ctx.fillStyle=outerCol;
   ctx.beginPath();
   ctx.moveTo(fx+lean, fbase-fh);
   ctx.quadraticCurveTo(fx+fw2+lean*0.4, fbase-fh*0.45, fx+fw2*0.72, fbase);
   ctx.quadraticCurveTo(fx, fbase+3, fx-fw2*0.72, fbase);
   ctx.quadraticCurveTo(fx-fw2+lean*0.4, fbase-fh*0.45, fx+lean, fbase-fh);
   ctx.fill();
   /* inner flame */
   ctx.fillStyle=innerCol;
   ctx.beginPath();
   ctx.moveTo(fx+lean*0.6, fbase-fh*0.58);
   ctx.quadraticCurveTo(fx+fw2*0.5, fbase-fh*0.25, fx+fw2*0.36, fbase-1);
   ctx.quadraticCurveTo(fx, fbase+2, fx-fw2*0.36, fbase-1);
   ctx.quadraticCurveTo(fx-fw2*0.5, fbase-fh*0.25, fx+lean*0.6, fbase-fh*0.58);
   ctx.fill();
   /* white-hot core at high aura */
   if(frac>0.75){
    ctx.fillStyle='rgba(255,255,255,'+((frac-0.75)*2.4)+')';
    ctx.beginPath(); ctx.ellipse(fx,fbase-5,fw2*0.22,fh*0.16,0,0,6.283); ctx.fill();
   }
   /* pink embers drifting off a strong flame */
   if(frac>0.5){
    ctx.fillStyle=C.PINK;
    for(var e2=0;e2<3;e2++){
     var et=(elapsed*1.4+e2*0.37)%1;
     var ex=fx+Math.sin(elapsed*7+e2*2.6)*8, ey=fbase-fh-4-et*16;
     ctx.globalAlpha=alpha*(1-et)*0.8*frac;
     ctx.fillRect(ex,ey,2.6,2.6);
    }
   }
   ctx.globalAlpha=1;

   /* aura BAR — chunky, colour-coded, impossible to miss */
   var bx2=px+70, by2=py+ph-26, bw2=pw-84, bh2=15;
   ctx.fillStyle='rgba(255,255,255,0.12)'; env.rr(bx2,by2,bw2,bh2,7); ctx.fill();
   if(frac>0.001){
    var fillW=Math.max(3,bw2*frac);
    ctx.save(); env.rr(bx2,by2,bw2,bh2,7); ctx.clip();
    if(low){
     /* guttering grey-blue flicker */
     ctx.fillStyle= (Math.sin(elapsed*19)>-0.4) ? '#5d6f92' : '#42536f';
     ctx.fillRect(bx2,by2,fillW,bh2);
    } else {
     var bg2=ctx.createLinearGradient(bx2,0,bx2+bw2,0);
     bg2.addColorStop(0,C.PINK); bg2.addColorStop(1,C.YEL);
     ctx.fillStyle=bg2; ctx.fillRect(bx2,by2,fillW,bh2);
     ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(bx2,by2,fillW,3);
    }
    ctx.restore();
   }
   ctx.strokeStyle='rgba(11,7,22,0.9)'; ctx.lineWidth=2; env.rr(bx2,by2,bw2,bh2,7); ctx.stroke();

   /* readable 0..10 value + label */
   var val=Math.max(0,Math.ceil(aura-0.0001));
   ctx.fillStyle= low ? (Math.sin(elapsed*10)>0?C.PINK:'#9fb4d6') : C.YEL;
   ctx.font='15px '+PIXEL; ctx.textAlign='left'; ctx.textBaseline='middle';
   ctx.fillText(String(val), bx2, py+16);
   ctx.fillStyle=C.SOFT; ctx.font='9px '+PIXEL;
   ctx.fillText('/10', bx2+(val>9?32:17), py+18);
   ctx.globalAlpha=0.9;
   ctx.fillText('aura 🔥', bx2+64, py+17);
   ctx.globalAlpha=1;
  }

  function drawHUD(){
   drawFlameGauge();

   /* clout */
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(W-146,12,134,28,11); ctx.fill();
   ctx.fillStyle=C.SOFT; ctx.font='12px '+PIXEL; ctx.textAlign='right'; ctx.textBaseline='middle';
   ctx.fillText(Math.round(clout)+' clout', W-20, 27);

   /* streak chip */
   if(streak>1){
    ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(W-146,46,134,24,10); ctx.fill();
    ctx.fillStyle=C.YEL; ctx.font='10px '+PIXEL; ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.fillText('streak x'+streak+' 📸', W-20, 58);
   }

   /* pose window cue */
   if(activePap && activePap.open && !activePap.posed && !activePap.missed){
    var fr2=(activePap.x-POSE_FAIL)/(POSE_OPEN-POSE_FAIL); if(fr2<0)fr2=0; if(fr2>1)fr2=1;
    var bw=220, bxx=(W-bw)/2, byy=70;
    ctx.globalAlpha=0.9+0.1*Math.sin(elapsed*20);
    ctx.fillStyle=C.PINK; ctx.font='18px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('pose! 📸', W/2, byy);
    ctx.globalAlpha=1;
    /* shrinking window meter — later = riskier = FLAWLESS bonus */
    var my=byy+22;
    ctx.fillStyle='rgba(255,255,255,0.14)'; env.rr(bxx,my,bw,12,6); ctx.fill();
    ctx.fillStyle= fr2>0.34? C.YEL : C.PINK;
    if(fr2>0){ ctx.save(); env.rr(bxx,my,bw,12,6); ctx.clip(); ctx.fillRect(bxx+bw*(1-fr2),my,bw*fr2,12); ctx.restore(); }
    ctx.fillStyle=C.SOFT; ctx.font='9px '+PIXEL; ctx.fillText('press pose ▾ — late = flawless', W/2, my+24);
   }

   /* centre feedback flash */
   if(flash){
    var a=1-flash.t/flash.life;
    ctx.globalAlpha=a; ctx.fillStyle=flash.color; ctx.font='20px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(flash.text, W/2, 250-flash.t*30); ctx.globalAlpha=1;
   }
  }

  function drawIntro(){
   var a;
   if(elapsed<1) a=1; else a=Math.max(0,1-(elapsed-1)/1.6);
   if(a<=0) return;
   ctx.globalAlpha=a;
   ctx.fillStyle='rgba(11,7,22,0.82)'; ctx.fillRect(0,0,W,H);
   ctx.fillStyle=C.YEL; ctx.font='26px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('im soorry', W/2, 210);
   ctx.fillStyle='#fff'; ctx.font='22px '+MONO;
   ctx.fillText('↑ jump · grab the flames 🔥', W/2, 272);
   ctx.fillText('↓ pose when the paps flash 📸', W/2, 306);
   ctx.fillStyle=C.SOFT; ctx.font='18px '+MONO;
   ctx.fillText('keep the aura lit ✨', W/2, 352);
   ctx.globalAlpha=1;
  }

  /* =====================================================================
     main loop
     ===================================================================== */
  function frame(now){
   if(!env.running()){ cancelAnimationFrame(raf); return; }
   raf=requestAnimationFrame(frame);
   if(!last) last=now;
   var dt=Math.min(0.05,(now-last)/1000); last=now;
   if(!over) update(dt);

   ctx.clearRect(0,0,W,H);
   ctx.save();
   if(shake>0){ ctx.translate((Math.random()*2-1)*shake*5,(Math.random()*2-1)*shake*4); }
   drawBackground();
   /* entities (behind Orry) */
   for(var i=0;i<objs.length;i++){ var o=objs[i];
    if(o.type==='obs') drawObstacle(o);
    else if(o.type==='pap') drawPap(o);
    else if(o.type==='orb') drawOrb(o);
   }
   drawOrry();
   ctx.restore();
   /* full-screen flash burst on a landed pose */
   if(whiteT>0){
    ctx.globalAlpha=Math.min(1,whiteT/0.22)*0.5;
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=1;
   }
   drawHUD();
   drawIntro();
  }
  raf=requestAnimationFrame(frame);
 }

 boot();
})();
