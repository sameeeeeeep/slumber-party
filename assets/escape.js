(function(){
'use strict';
/* ============================================================
   slumber escape — 5th arcade game for secretslumberparty.com
   fullscreen point-and-click escape room. classic script:
   EVERYTHING lives inside this iife, nothing at top level.
   ============================================================ */

/* ---------------- tiny seeded rng ---------------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuf(arr,rnd){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function pickOne(arr,rnd){return arr[Math.floor(rnd()*arr.length)];}

/* ---------------- constants ---------------- */
var LW=480,LH=270;
var PINK='#eb648c',SOFT='#f5c3cf',YEL='#ebd81b',NIGHT='#0b0716',WHITE='#ffffff';
var PURP='#8a5ce0',TEAL='#58c1b2',RED='#e0453a',GRN='#4fae5c';
var WOOD='#6b4a2f',WOOD2='#523823',WOOD3='#3d2a1a';
var FSTACK='"Press Start 2P","VT323",monospace';
var WALLY=150,ROOMTOP=18,ROOMBOT=202;
var ORDW=['first','second','third'];

/* ---------------- object catalog (flavor / riddle / digit hint per kind) ---------------- */
var CAT={
 desk:{flavor:'drawers full of pens that don\'t work.',digit:function(d){return 'a sticky note on the desk: \'remember '+d+'!\'';}},
 bookshelf:{flavor:'so many books, zero time to read.',riddle:'i hold a thousand stories but never tell a single one.',digit:function(d){return 'a bookmark pokes out of page '+d+'0. the '+d+' is circled.';}},
 painting:{flavor:'moody brushwork. the moon looks judgy.',digit:function(d){return 'signed in the corner: \'19'+d+'...\' the last digit is '+d+'.';}},
 clock:{flavor:'tick. tock. it is definitely nighttime.',riddle:'i have hands but cannot clap, and a face that never smiles.',digit:function(d){return 'both hands point straight at the '+d+'.';}},
 globe:{flavor:'spin it. wheee.',riddle:'i carry the whole world but never travel anywhere.',digit:function(d){return 'someone circled a big number '+d+' over the ocean.';}},
 lamp:{flavor:'warm glow. very cozy.',riddle:'i only shine when someone flips my switch.'},
 plant:{flavor:'leafy. judging you silently.',riddle:'i have leaves but i am not a book, and i drink but never eat.'},
 rug:{flavor:'soft underfoot. hides nothing. probably.',riddle:'i lie on the floor all day and everyone walks all over me.'},
 radio:{flavor:'it crackles softly, like it wants attention.'},
 bed:{flavor:'so tempting. focus!',riddle:'the more tired you are, the better i look.',digit:function(d){return 'embroidered on the pillow: a tiny '+d+'.';}},
 wardrobe:{flavor:'creaky doors, fancy pajamas.',riddle:'i am full of outfits but i never get dressed.'},
 mirror:{flavor:'you look great, by the way.',riddle:'i copy everything you do but never make a sound.',digit:function(d){return 'a smudge on the glass traces the number '+d+'.';}},
 fairylights:{flavor:'twinkly. very slumber-party.'},
 dresser:{flavor:'socks. so many socks.',digit:function(d){return 'written in nail polish inside a drawer: '+d+'.';}},
 pillows:{flavor:'ammunition for later.',riddle:'i am soft, i am stacked, and i am essential for midnight fights.'},
 oven:{flavor:'still warm. someone baked cookies.',riddle:'i am hot-tempered but i make the best midnight snacks.',digit:function(d){return 'the timer blinks '+d+':00 over and over.';}},
 fridge:{flavor:'someone labeled their leftovers. respect.',riddle:'i keep my cool even in the middle of the night.',digit:function(d){return 'a magnet number '+d+' sits alone on the door.';}},
 sink:{flavor:'drip. drip. drip.'},
 shelf:{flavor:'little jars in chaotic order.'},
 jars:{flavor:'cookie jars. crumbs only.',digit:function(d){return 'exactly '+d+' cookies left. someone counted.';}},
 table:{flavor:'flour dust and a rolling pin.',digit:function(d){return 'carved under the tabletop: '+d+'.';}},
 cupboard:{flavor:'mugs. hundreds of mugs.'},
 sofa:{flavor:'cushions arranged for maximum lounging.',riddle:'i have two arms and a back, but i can only sit.',digit:function(d){return 'a coin under the cushion. the year ends in '+d+'.';}},
 jukebox:{flavor:'it hums like it knows a secret.'},
 tvcabinet:{flavor:'the tv only shows static this late.'},
 barrel:{flavor:'smells like grape juice. sure. juice.',riddle:'i wear hoops for a belt and keep secrets in my belly.',digit:function(d){return 'a chalk mark on the lid: '+d+'.';}},
 crates:{flavor:'heavy. full of mystery jars.',digit:function(d){return 'stenciled on the side: crate no. '+d+'.';}},
 chest:{flavor:'old and stubborn.',riddle:'i keep treasure safe and my lid shut tight.'},
 winerack:{flavor:'dusty bottles, fancy labels.'},
 lantern:{flavor:'a little flame doing its best.',riddle:'i hold a small fire so your hands don\'t have to.',digit:function(d){return 'scratched into the base: '+d+'.';}}
};

/* ---------------- scenes (5, pick 3 per run) ---------------- */
var SCENES={
 study:{name:'the study',pal:{wall:'#241733',wall2:'#2d1d40',floor:'#1a1026',plank:'#221536'},
  win:{x:56,y:34,w:46,h:42},simon:'radio',order:'bookshelf',symbols:'desk',
  props:[
   {id:'desk',kind:'desk',label:'writing desk',x:34,y:118,w:76,h:46},
   {id:'radio',kind:'radio',label:'old radio',x:52,y:102,w:28,h:16},
   {id:'bookshelf',kind:'bookshelf',label:'bookshelf',x:126,y:56,w:46,h:106},
   {id:'painting',kind:'painting',label:'painting',x:196,y:44,w:38,h:30},
   {id:'clock',kind:'clock',label:'wall clock',x:258,y:40,w:26,h:26},
   {id:'globe',kind:'globe',label:'globe',x:318,y:114,w:30,h:46},
   {id:'lamp',kind:'lamp',label:'floor lamp',x:366,y:90,w:22,h:72},
   {id:'plant',kind:'plant',label:'potted plant',x:398,y:116,w:26,h:46},
   {id:'rug',kind:'rug',label:'rug',x:178,y:172,w:122,h:24}]},
 bedroom:{name:'the bedroom',pal:{wall:'#2b1740',wall2:'#341d4d',floor:'#1c1030',plank:'#241540'},
  win:{x:60,y:32,w:46,h:44},simon:'fairylights',order:'dresser',symbols:'wardrobe',
  props:[
   {id:'bed',kind:'bed',label:'bed',x:26,y:118,w:94,h:50},
   {id:'wardrobe',kind:'wardrobe',label:'wardrobe',x:136,y:54,w:46,h:110},
   {id:'mirror',kind:'mirror',label:'mirror',x:196,y:50,w:24,h:46},
   {id:'fairylights',kind:'fairylights',label:'fairy lights',x:232,y:26,w:180,h:16},
   {id:'painting',kind:'painting',label:'painting',x:242,y:56,w:34,h:28},
   {id:'clock',kind:'clock',label:'wall clock',x:296,y:52,w:24,h:24},
   {id:'dresser',kind:'dresser',label:'dresser',x:330,y:112,w:58,h:50},
   {id:'pillows',kind:'pillows',label:'pillow pile',x:394,y:158,w:34,h:26},
   {id:'plant',kind:'plant',label:'potted plant',x:8,y:118,w:24,h:44}]},
 kitchen:{name:'the kitchen',pal:{wall:'#1f1636',wall2:'#281c44',floor:'#171027',plank:'#1f1533'},
  win:{x:150,y:34,w:44,h:40},simon:'radio',order:'shelf',symbols:'cupboard',
  props:[
   {id:'oven',kind:'oven',label:'oven',x:28,y:108,w:46,h:58},
   {id:'fridge',kind:'fridge',label:'fridge',x:86,y:66,w:42,h:100},
   {id:'sink',kind:'sink',label:'sink',x:200,y:112,w:46,h:54},
   {id:'shelf',kind:'shelf',label:'spice shelf',x:256,y:52,w:62,h:18},
   {id:'jars',kind:'jars',label:'cookie jars',x:330,y:54,w:34,h:22},
   {id:'clock',kind:'clock',label:'wall clock',x:380,y:44,w:24,h:24},
   {id:'table',kind:'table',label:'kitchen table',x:262,y:128,w:74,h:42},
   {id:'radio',kind:'radio',label:'counter radio',x:352,y:118,w:30,h:18},
   {id:'cupboard',kind:'cupboard',label:'cupboard',x:388,y:78,w:36,h:46}]},
 lounge:{name:'the lounge',pal:{wall:'#201a3d',wall2:'#292250',floor:'#161028',plank:'#1e1636'},
  win:{x:44,y:32,w:48,h:44},simon:'jukebox',order:'bookshelf',symbols:'tvcabinet',
  props:[
   {id:'sofa',kind:'sofa',label:'sofa',x:34,y:122,w:92,h:46},
   {id:'jukebox',kind:'jukebox',label:'jukebox',x:142,y:88,w:42,h:78},
   {id:'tvcabinet',kind:'tvcabinet',label:'tv cabinet',x:198,y:106,w:62,h:60},
   {id:'painting',kind:'painting',label:'painting',x:206,y:44,w:40,h:32},
   {id:'clock',kind:'clock',label:'wall clock',x:272,y:40,w:26,h:26},
   {id:'rug',kind:'rug',label:'shaggy rug',x:148,y:174,w:132,h:22},
   {id:'lamp',kind:'lamp',label:'floor lamp',x:8,y:92,w:22,h:72},
   {id:'bookshelf',kind:'bookshelf',label:'bookshelf',x:312,y:60,w:44,h:102},
   {id:'plant',kind:'plant',label:'potted plant',x:368,y:120,w:28,h:44}]},
 cellar:{name:'the cellar',pal:{wall:'#181025',wall2:'#201530',floor:'#120b1d',plank:'#181026'},
  win:{x:210,y:26,w:34,h:20},simon:'radio',order:'winerack',symbols:'chest',
  props:[
   {id:'barrel',kind:'barrel',label:'barrel',x:30,y:122,w:38,h:44},
   {id:'crates',kind:'crates',label:'crates',x:84,y:126,w:46,h:40},
   {id:'chest',kind:'chest',label:'old chest',x:146,y:132,w:48,h:34},
   {id:'winerack',kind:'winerack',label:'wine rack',x:210,y:66,w:52,h:98},
   {id:'lantern',kind:'lantern',label:'lantern',x:282,y:38,w:18,h:30},
   {id:'shelf',kind:'shelf',label:'dusty shelf',x:312,y:58,w:62,h:18},
   {id:'radio',kind:'radio',label:'ancient radio',x:322,y:130,w:32,h:20},
   {id:'painting',kind:'painting',label:'dusty portrait',x:376,y:50,w:32,h:28},
   {id:'rug',kind:'rug',label:'moth-eaten rug',x:246,y:176,w:104,h:20}]}
};

/* ---------------- friends ----------------
   three young indian women: dark hair (three styles), warm brown
   skin tones with slight variation, pastel pajamas per character.
   grid legend: h hair, s skin, e eyes, m mouth, p pajama top,
   q pajama pants, f slippers. each body is 12 cols x 16 rows. */
var BODY=[
'...hhhhhh...',
'..hhhhhhhh..',
'.hhhhhhhhhh.',
'.hhsssssshh.',
'.hhsesseshh.',
'.hhsssssshh.',
'..hssmmssh..',
'....ssss....',
'..pppppppp..',
'.pppppppppp.',
'.spppppppps.',
'.spppppppps.',
'..pppppppp..',
'..qqq..qqq..',
'..qqq..qqq..',
'..fff..fff..'];
var BODY_LONG=[/* long straight hair falling past the shoulders */
'...hhhhhh...',
'..hhhhhhhh..',
'.hhhhhhhhhh.',
'.hhsssssshh.',
'.hhsesseshh.',
'.hhsssssshh.',
'.hhssmmsshh.',
'.hh.ssss.hh.',
'.hhpppppphh.',
'.hhpppppphh.',
'.spppppppps.',
'.spppppppps.',
'..pppppppp..',
'..qqq..qqq..',
'..qqq..qqq..',
'..fff..fff..'];
var BODY_BUN=[/* high bun */
'....hhhh....',
'...hhhhhh...',
'..hhhhhhhh..',
'.hhsssssshh.',
'.hhsesseshh.',
'.hhsssssshh.',
'..hssmmssh..',
'....ssss....',
'..pppppppp..',
'.pppppppppp.',
'.spppppppps.',
'.spppppppps.',
'..pppppppp..',
'..qqq..qqq..',
'..qqq..qqq..',
'..fff..fff..'];
var BODY_WAVY=[/* wavy shoulder-length hair with flared ends */
'...hhhhhh...',
'..hhhhhhhh..',
'.hhhhhhhhhh.',
'.hhsssssshh.',
'.hhsesseshh.',
'.hhsssssshh.',
'.hhssmmsshh.',
'.hh.ssss.hh.',
'hhpppppppphh',
'h.pppppppp.h',
'.spppppppps.',
'.spppppppps.',
'..pppppppp..',
'..qqq..qqq..',
'..qqq..qqq..',
'..fff..fff..'];
/* one shared side-profile walk sprite, 2-frame cycle, facing RIGHT.
   same legend as the front grids (h/s/e/m/p/q/f). mirrored for
   facing left. reused by every friend, colored from her own palette;
   the two frames differ only in the leg stride. */
var BODY_SIDE=[[
'...hhhhh....',
'..hhhhhhh...',
'..hhhhssss..',
'..hhhseess..',
'..hhhsssss..',
'..hhhssmm...',
'..hhssss....',
'..hppppp....',
'..sppppps...',
'...ppppp....',
'...ppppp....',
'...qqqqq....',
'...qqqq.....',
'...qqqq.....',
'..qq..qq....',
'.ff....ff...'],[
'...hhhhh....',
'..hhhhhhh...',
'..hhhhssss..',
'..hhhseess..',
'..hhhsssss..',
'..hhhssmm...',
'..hhssss....',
'..hppppp....',
'..sppppps...',
'...ppppp....',
'...ppppp....',
'...qqqqq....',
'...qqqq.....',
'...qqqq.....',
'...qqqq.....',
'....ffff....']];
var CHARS={
 khushi:{h:'#3a2418',s:'#c68a53',p:'#f4f0ea',q:'#5a3a24',f:'#e8c9a8',body:BODY_LONG},
 bestie:{h:'#171310',s:'#b97a4e',p:'#b8a1e8',q:'#e4d9fa',f:WHITE,body:BODY_BUN},
 bff:{h:'#2b1a10',s:'#d9a066',p:'#8fd6c8',q:'#d9f4ee',f:SOFT,body:BODY_WAVY}};

var HERRINGS=[
 'just a pile of dust bunnies. cozy. useless.',
 'you find... a single fuzzy sock. no clue here.',
 'it wobbles menacingly. that\'s it. that\'s all it does.',
 'nothing. somewhere, khushi giggles.',
 'a spider waves back politely. moving on.',
 'crumbs. only crumbs. someone owes an explanation.'];
var BANTER=[
 'okay but after this we\'re doing face masks.',
 'is anyone else craving popcorn right now?',
 'this villa is 100% haunted and 100% cute.',
 'my slippers keep sliding on this floor.',
 'if we escape before 3am, ice cream is on me.',
 'i heard the front door has a squeaky hinge. spooky.',
 'whoever locked us in here is NOT invited to the party.',
 'shhh... did the walls just giggle?'];

/* ---------------- registration ---------------- */
var regTries=0;
function tryRegister(){
 try{
  if(window.__slumberGame && typeof window.__slumberGame.register==='function'){
   window.__slumberGame.register({key:'slumberescape',name:'slumber escape',unit:'stars',external:true,launch:launchGame});
   return;
  }
 }catch(e){}
 if(regTries++<25) setTimeout(tryRegister,120);
}
tryRegister();

/* ============================================================
   game instance — everything fresh per launch
   ============================================================ */
function launchGame(opts){
 var exitCb=(opts&&opts.exit)||function(){};
 var finished=false;

 /* ---- dom — mounted INSIDE the CRT screen (#tv) when it exists, so the
    room plays out on the monitor; falls back to fullscreen elsewhere ---- */
 var host=document.getElementById('tv');
 var overlay=document.createElement('div');
 overlay.style.cssText=(host?'position:absolute':'position:fixed')+';inset:0;z-index:9999;background:'+NIGHT+';display:flex;align-items:center;justify-content:center;touch-action:none;overflow:hidden;pointer-events:auto;';
 var cv=document.createElement('canvas');
 cv.width=LW;cv.height=LH;
 cv.style.cssText='image-rendering:pixelated;image-rendering:crisp-edges;display:block;touch-action:none;';
 overlay.appendChild(cv);
 (host||document.body).appendChild(overlay);
 var ctx=cv.getContext('2d');
 ctx.imageSmoothingEnabled=false;   /* room stays pixel-crisp; portrait flips this on locally */
 var cssScale=1;
 function doResize(){
  var vw=window.innerWidth,vh=window.innerHeight;
  if(host && host.clientWidth>40 && host.clientHeight>40){
   /* the page camera does the zooming; letterbox to the VISIBLE slice when
      the zoomed CRT outgrows the window (centres stay aligned) */
   vw=Math.min(host.clientWidth,window.innerWidth); vh=Math.min(host.clientHeight,window.innerHeight);
  }
  var s=Math.min(vw/LW,vh/LH);
  cssScale=s;
  cv.style.width=Math.floor(LW*s)+'px';
  cv.style.height=Math.floor(LH*s)+'px';
 }
 doResize();
 var hostRO=null;   /* the CRT rect eases with the page zoom — stay letterboxed to it */
 if(host && typeof ResizeObserver!=='undefined'){ try{ hostRO=new ResizeObserver(doResize); hostRO.observe(host); }catch(e){} }

 /* ---- audio ---- */
 var actx=null,muted=false;
 try{ muted=localStorage.getItem('ksp-snd')==='off'; }catch(e){}   /* shared with the header toggle + arcade */
 function ensureAudio(){
  if(actx) return;
  try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){actx=null;}
 }
 function tone(freq,dur,type,gain,when,slideTo){
  if(!actx||muted) return;
  try{
   var t0=actx.currentTime+(when||0);
   var o=actx.createOscillator(),g=actx.createGain();
   o.type=type||'square';o.frequency.setValueAtTime(freq,t0);
   if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30,slideTo),t0+dur);
   g.gain.setValueAtTime(gain||0.05,t0);
   g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
   o.connect(g);g.connect(actx.destination);
   o.start(t0);o.stop(t0+dur+0.02);
  }catch(e){}
 }
 var snd={
  click:function(){tone(520,0.06,'square',0.04);},
  chime:function(){tone(660,0.1,'triangle',0.05);tone(990,0.14,'triangle',0.05,0.09);},
  clunk:function(){tone(150,0.12,'square',0.06);tone(95,0.2,'square',0.06,0.1);},
  buzz:function(){tone(110,0.22,'sawtooth',0.05);},
  meow:function(){tone(760,0.28,'sawtooth',0.045,0,340);},
  giggle:function(){tone(900,0.07,'sine',0.05);tone(1200,0.07,'sine',0.05,0.09);tone(1000,0.07,'sine',0.05,0.18);},
  simon:function(i){tone([440,554,659,784][i]||440,0.22,'triangle',0.05);},
  jingle:function(){var n=[523,659,784,1047,784,1047];for(var i=0;i<n.length;i++)tone(n[i],0.16,'triangle',0.05,i*0.13);}
 };

 /* ---- run generation (seeded) ---- */
 var seed=Date.now()>>>0;
 var rnd=mulberry32(seed);
 var sceneKeys=shuf(Object.keys(SCENES),rnd).slice(0,3);
 var ptypes=shuf(['combo','simon','riddle','order','symbols'],rnd).slice(0,3);
 var friendNames=['khushi'].concat(shuf(['bestie','bff'],rnd));
 var rooms=sceneKeys.map(function(k,i){return buildRoom(k,ptypes[i]);});

 function buildRoom(key,ptype){
  var sc=SCENES[key];
  var props=sc.props.map(function(p){return {id:p.id,kind:p.kind,label:p.label,x:p.x,y:p.y,w:p.w,h:p.h,seen:false};});
  var byId={};props.forEach(function(p){byId[p.id]=p;});
  var room={key:key,name:sc.name,pal:sc.pal,win:sc.win,ptype:ptype,props:props,byId:byId,
   solved:false,haveKey:false,foundNote:false,found:[false,false,false],
   herringHits:0,nudgeHits:0,hintsUsed:0,puzzleProp:null,noteId:null,answerId:null,
   surpriseDone:false};
  var reserved={};
  if(ptype==='simon'){room.puzzleProp=sc.simon;reserved[sc.simon]=1;
   room.seq=[0,0,0,0].map(function(){return Math.floor(rnd()*4);});}
  if(ptype==='symbols'){room.puzzleProp=sc.symbols;reserved[sc.symbols]=1;
   room.tiles=shuf([0,0,1,1,2,2,3,3],rnd).map(function(s){return {s:s,st:0};});}
  if(ptype==='order'){
   room.puzzleProp=sc.order;reserved[sc.order]=1;
   var rule=pickOne(['rainbow','size','alpha'],rnd),items,clue;
   if(rule==='rainbow'){items=[{n:'red',c:RED},{n:'yellow',c:YEL},{n:'green',c:GRN},{n:'purple',c:PURP}];clue='rainbow order: red, yellow, green, purple.';}
   else if(rule==='size'){items=[{n:'tiny',sz:8},{n:'small',sz:12},{n:'big',sz:16},{n:'huge',sz:20}];clue='smallest to largest, left to right.';}
   else{items=shuf(['bear','duck','frog','kite','moon','star','yarn','bell'],rnd).slice(0,4).map(function(n){return {n:n};});clue='alphabetical order, left to right.';}
   room.rule=rule;
   room.target=(rule==='alpha')?items.map(function(i){return i.n;}).sort():items.map(function(i){return i.n;});
   var cur=shuf(items,rnd);
   var guard=0;
   while(cur.map(function(i){return i.n;}).join()===room.target.join()&&guard++<20) cur=shuf(items,rnd);
   room.items=cur;
   room.clue=clue;
   room.noteText='the note reads: \''+clue+'\'';
  }
  if(ptype==='combo'){
   room.code=[Math.floor(rnd()*10),Math.floor(rnd()*10),Math.floor(rnd()*10)];
   var digitables=props.filter(function(p){return CAT[p.kind].digit&&!reserved[p.id];});
   var chosen=shuf(digitables,rnd).slice(0,3);
   chosen.forEach(function(p,i){p.digitIdx=i;});
   room.digitProps=chosen.map(function(p){return p.id;});
  }
  if(ptype==='riddle'){
   var riddlable=props.filter(function(p){return CAT[p.kind].riddle&&!reserved[p.id];});
   var ans=pickOne(riddlable,rnd);
   room.answerId=ans.id;
   room.riddle=CAT[ans.kind].riddle;
   var holders=props.filter(function(p){return p.id!==ans.id&&!reserved[p.id];});
   room.noteId=pickOne(holders,rnd).id;
   room.noteText='a crumpled note: \''+room.riddle+'\' ...what could it mean?';
  }
  if(ptype==='order'){
   var holders2=props.filter(function(p){return !reserved[p.id];});
   room.noteId=pickOne(holders2,rnd).id;
  }
  /* red herrings from role-free props */
  var free=props.filter(function(p){
   return p.id!==room.puzzleProp&&p.id!==room.noteId&&p.id!==room.answerId&&p.digitIdx===undefined;});
  shuf(free,rnd).slice(0,2+Math.floor(rnd()*2)).forEach(function(p,i){
   p.herring=true;p.herringText=HERRINGS[(Math.floor(rnd()*HERRINGS.length)+i)%HERRINGS.length];});
  /* one surprise per room */
  room.surprise={type:pickOne(['cat','lights','trip','giggle','pizza'],rnd),propId:pickOne(props,rnd).id};
  return room;
 }

 /* ---- run state ---- */
 var roomIdx=0;
 var state='explore'; // explore|puzzle|transition|victory|confirm
 var prevState='explore';
 var modal=null;
 var startAt=performance.now();
 var pen=0,bonus=0;
 var inv=[]; // {icon:'note'|'key', text}
 var finalScore=0;
 /* best score: read-only — the arcade harness persists it after exit */
 var bestScore=0;
 try{
  var bs0=parseInt(localStorage.getItem('ksp-hi-slumberescape'),10);
  if(isFinite(bs0)&&bs0>0) bestScore=bs0;
 }catch(e){}
 var hover=null,tapFlash=null,tapFlashAt=0;
 var px2=-100,py2=-100; // pointer in logical coords
 var shakeUntil=0,lightsUntil=0;
 var catFrom=0,catUntil=0;
 var tripFriend=-1,tripUntil=0;
 var transAt=0,transPhase=0; // 0 door swing/out, 1 fade in
 var nextBanterAt=performance.now()+22000;
 var confetti=null;
 var victoryBtn={x:140,y:206,w:200,h:22};
 var rafId=0,dead=false;

 function now(){return performance.now();}
 function elapsed(){return now()-startAt;}
 function curScore(){return Math.max(25,300-Math.floor(elapsed()/3000)-pen+bonus);}
 function room(){return rooms[roomIdx];}

 /* ---- dialogue (typewriter, non-blocking) ---- */
 var DLG_W=LW-24,DLG_LINES=3; /* inner width + max lines of the bottom box */
 var dlg=null; // {who,text,shown,doneAt}
 var dlgQueue=[];
 function say(who,text){
  /* split anything longer than the box into continuation pages so
     nothing is ever cut off — tap advances page by page */
  var pages=dlgPages(String(text));
  for(var i=0;i<pages.length;i++) dlgQueue.push({who:who,text:pages[i]});
  if(!dlg||dlgDone()) nextDlg();
 }
 function dlgPages(text){
  var lines=wrap(text,DLG_W,10);
  if(lines.length<=DLG_LINES) return [text];
  var pages=[];
  for(var i=0;i<lines.length;i+=DLG_LINES) pages.push(lines.slice(i,i+DLG_LINES).join(' '));
  return pages;
 }
 function nextDlg(){
  var n=dlgQueue.shift();
  if(n){dlg={who:n.who,text:n.text,shown:0,started:now(),doneAt:0};}
 }
 function dlgDone(){return dlg&&dlg.shown>=dlg.text.length;}

 /* ---- inventory ---- */
 function addItem(icon,text){inv.push({icon:icon,text:text});snd.chime();}

 /* ---- penalties ---- */
 function wrongPenalty(){pen+=5;snd.buzz();}

 /* ---- hints ---- */
 function giveHint(){
  var r=room();
  var lvl=Math.min(r.hintsUsed,2);
  if(r.hintsUsed>=1) pen+=15;
  r.hintsUsed++;
  var who=pickOne(friendNames,rnd);
  var h=hintText(r,lvl);
  if(r.hintsUsed>1) h+=' (-15 stars, worth it)';
  say(who,h);
 }
 function hintText(r,lvl){
  var lb=function(id){return r.byId[id].label;};
  if(r.haveKey||(r.ptype==='combo'&&r.found[0]&&r.found[1]&&r.found[2])){
   if(r.ptype==='combo') return ['you\'ve got numbers... a lot of numbers.','you found all three digits. punch them into the door.','the door code is '+r.code.join('')+'. go go go!'][lvl];
   return ['that key looks useful.','maybe the key fits the door?','door. key. keyhole. go!'][lvl];
  }
  if(r.ptype==='combo'){
   var i=r.found[0]?(r.found[1]?2:1):0;
   var p=r.byId[r.digitProps[i]];
   return ['numbers, numbers... i keep seeing numbers around this room.',
    'maybe look closer at the '+p.label+'?',
    'the '+ORDW[i]+' digit is on the '+p.label+', silly.'][lvl];
  }
  if(r.ptype==='simon'){
   var s=lb(r.puzzleProp);
   return ['do you hear that? something in here wants to sing.',
    'the '+s+' plays colors. maybe copy it?',
    'tap the '+s+', watch the 4 colors, repeat them exactly. a key pops out.'][lvl];
  }
  if(r.ptype==='riddle'){
   if(!r.foundNote) return ['someone left a note lying around here, i swear.',
    'check the '+lb(r.noteId)+'. i saw paper sticking out.',
    'the note is in the '+lb(r.noteId)+'. read it!'][lvl];
   return ['think about the riddle... what could it mean?',
    'the riddle... \''+r.riddle.slice(0,28)+'...\' what in here fits?',
    'it\'s the '+lb(r.answerId)+', silly. tap it.'][lvl];
  }
  if(r.ptype==='order'){
   if(!r.foundNote) return ['something here is out of order. literally.',
    'there\'s a note hiding in the '+lb(r.noteId)+'.',
    'read the note in the '+lb(r.noteId)+', then fix the '+lb(r.puzzleProp)+'.'][lvl];
   return ['those things on the '+lb(r.puzzleProp)+' look scrambled.',
    'rearrange the '+lb(r.puzzleProp)+': '+r.noteText,
    'swap them until they read: '+r.target.join(', ')+'.'][lvl];
  }
  /* symbols */
  var c=lb(r.puzzleProp);
  return ['the '+c+' is sealed with weird little tiles.',
   'flip the tiles on the '+c+' two at a time. remember what you see.',
   'match all four pairs on the '+c+' and it pops open.'][lvl];
 }

 /* ---- interactions ---- */
 function inspectProp(p){
  var r=room();
  snd.click();
  p.flashAt=now();
  /* surprise on first click of its object */
  if(!r.surpriseDone&&r.surprise.propId===p.id){r.surpriseDone=true;fireSurprise(r.surprise.type);}
  /* puzzle props */
  if(p.id===r.puzzleProp&&!r.haveKey&&!r.solved){
   if(r.ptype==='simon'){openSimon();return;}
   if(r.ptype==='order'){openOrder();return;}
   if(r.ptype==='symbols'){openSymbols();return;}
  }
  if(p.id===r.puzzleProp&&(r.haveKey||r.solved)){say('you','the '+p.label+' already gave up its secret.');return;}
  /* combo digits */
  if(p.digitIdx!==undefined){
   var d=r.code[p.digitIdx];
   if(!r.found[p.digitIdx]){r.found[p.digitIdx]=true;snd.chime();
    addItem('note',CAT[p.kind].digit(d)+' ('+ORDW[p.digitIdx]+' digit)');}
   say('you',CAT[p.kind].digit(d)+' ...that\'s the '+ORDW[p.digitIdx]+' digit!');
   return;
  }
  /* note holders */
  if(p.id===r.noteId){
   if(!r.foundNote){r.foundNote=true;snd.chime();addItem('note',r.noteText);}
   say('you',r.noteText);
   return;
  }
  /* riddle answer */
  if(r.ptype==='riddle'&&p.id===r.answerId&&r.foundNote&&!r.haveKey){
   r.haveKey=true;r.solved=true;
   addItem('key','a shiny key, found behind the '+p.label+'.');
   say('you','something clicks... a key slides out from behind the '+p.label+'!');
   return;
  }
  /* riddle wrong guess nudges */
  if(r.ptype==='riddle'&&r.foundNote&&!r.haveKey&&p.id!==r.answerId){
   if(r.nudgeHits<3){r.nudgeHits++;wrongPenalty();}
   say(pickOne(friendNames,rnd),pickOne(['nope, the '+p.label+' is riddle-innocent.','hmm. the '+p.label+'? bold guess. wrong though.','not the '+p.label+'. think harder!'],rnd));
   return;
  }
  /* herrings */
  if(p.herring){
   if(!p.seen&&r.herringHits<3){r.herringHits++;pen+=5;}
   p.seen=true;
   say('you',p.herringText);
   return;
  }
  p.seen=true;
  say('you',CAT[p.kind].flavor);
 }

 function fireSurprise(type){
  if(type==='cat'){shakeUntil=now()+500;catFrom=now();catUntil=now()+1200;snd.meow();say(pickOne(friendNames,rnd),'A CAT?! where did a cat come from?!');}
  else if(type==='lights'){lightsUntil=now()+3000;say(pickOne(friendNames,rnd),'the lights!! okay okay, follow the flashlight...');}
  else if(type==='trip'){tripFriend=Math.floor(rnd()*3);tripUntil=now()+900;shakeUntil=now()+250;snd.clunk();say(friendNames[tripFriend]||'khushi','oof!! who built a pillow fort RIGHT there?!');}
  else if(type==='giggle'){snd.giggle();say(pickOne(friendNames,rnd),'...did anyone else hear that giggle? anyone? cool cool cool.');}
  else{bonus+=10;snd.chime();say('you','hidden pizza slice!! +10 stars. this villa has taste.');}
 }

 function tryDoor(){
  var r=room();
  snd.click();
  if(r.ptype==='combo'){modal={kind:'pad',entry:''};state='puzzle';return;}
  if(r.haveKey){unlockDoor();return;}
  var msgs={simon:'locked. there\'s a keyhole... something musical in here might help.',
   riddle:'locked tight. a keyhole winks at you. maybe read around?',
   order:'locked. keyhole-shaped problem. something needs tidying first.',
   symbols:'locked. you need a key. those sealed tiles look suspicious.'};
  say('you',msgs[r.ptype]||'locked.');
 }
 function unlockDoor(){
  snd.clunk();
  room().unlocked=true;
  state='transition';transAt=now();transPhase=0;
 }

 /* ---- puzzle modals ---- */
 function openSimon(){
  var r=room();
  modal={kind:'simon',phase:'watch',t:now()+700,pi:0,inputIdx:0,flash:-1,flashAt:0,solvedAt:0};
  state='puzzle';
  say('you','the '+r.byId[r.puzzleProp].label+' lights up... watch closely!');
 }
 function openOrder(){
  modal={kind:'order',sel:-1,solvedAt:0};
  state='puzzle';
  if(!room().foundNote) say('you','four things, one shelf, zero order. a clue note would help...');
 }
 function openSymbols(){
  modal={kind:'sym',open:[],revertAt:0,solvedAt:0};
  state='puzzle';
 }
 function closeModal(){modal=null;if(state==='puzzle')state='explore';}
 function solvePuzzleKey(msg){
  var r=room();
  r.solved=true;r.haveKey=true;
  addItem('key','the key to '+r.name+'\'s door.');
  say('you',msg);
 }

 /* ---- hit testing (expands hit rects so css size >= 44px) ---- */
 function hit(x,y,r){
  var padW=Math.max(0,(44/cssScale-r.w)/2),padH=Math.max(0,(44/cssScale-r.h)/2);
  return x>=r.x-padW&&x<=r.x+r.w+padW&&y>=r.y-padH&&y<=r.y+r.h+padH;
 }
 var DOOR={x:432,y:58,w:32,h:108};
 /* hit rects for mute/quit (>=18px square); the visible 14x14 buttons are centered inside */
 var MUTEB={x:430,y:0,w:24,h:18},QUITB={x:456,y:0,w:24,h:18};
 function invRect(i){return {x:4+i*27,y:248,w:24,h:22};}
 function friendRect(i){var f=friendPos(i);return {x:f.x,y:f.y,w:24,h:32};}
 function friendPos(i){
  var spots=[{x:210,y:158},{x:254,y:163},{x:298,y:156}];
  return spots[i%3];
 }

 /* ---- input ---- */
 function onDown(ev){
  ev.preventDefault();
  ensureAudio();
  if(actx&&actx.state==='suspended'){try{actx.resume();}catch(e){}}
  var pt=toLogical(ev);
  px2=pt.x;py2=pt.y;
  handleTap(pt.x,pt.y);
 }
 function onMove(ev){
  var pt=toLogical(ev);
  px2=pt.x;py2=pt.y;
  hover=null;
  if(state==='explore'){
   for(var i=room().props.length-1;i>=0;i--){if(hit(pt.x,pt.y,room().props[i])){hover=room().props[i];break;}}
   if(!hover&&hit(pt.x,pt.y,DOOR)) hover=DOOR;
  }
 }
 function toLogical(ev){
  var r=cv.getBoundingClientRect();
  var cx=(ev.touches&&ev.touches[0])?ev.touches[0].clientX:ev.clientX;
  var cy=(ev.touches&&ev.touches[0])?ev.touches[0].clientY:ev.clientY;
  return {x:(cx-r.left)/r.width*LW,y:(cy-r.top)/r.height*LH};
 }

 function handleTap(x,y){
  /* quit button always live, in EVERY state */
  if(hit(x,y,QUITB)){
   snd.click();
   if(state==='victory'){finish(finalScore);return;}
   if(state==='confirm'){state=prevState;}
   else{prevState=state;state='confirm';}
   return;
  }
  if(hit(x,y,MUTEB)){muted=!muted;try{localStorage.setItem('ksp-snd',muted?'off':'on');}catch(e){}snd.click();return;}
  /* typewriter: tap completes typing */
  if(dlg&&!dlgDone()){dlg.shown=dlg.text.length;dlg.doneAt=now();return;}
  if(dlg&&dlgDone()&&dlgQueue.length){nextDlg();return;}

  if(state==='confirm'){
   if(hit(x,y,{x:120,y:150,w:110,h:22})){state=prevState;snd.click();return;}   /* keep playing */
   if(hit(x,y,{x:250,y:150,w:110,h:22})){finish(0);return;}                     /* give up */
   return;
  }
  if(state==='victory'){
   if(hit(x,y,victoryBtn)) finish(finalScore);
   return;
  }
  if(state==='transition') return;
  if(state==='puzzle'){modalTap(x,y);return;}

  /* explore */
  for(var i=0;i<inv.length&&i<5;i++){
   if(hit(x,y,invRect(i))){snd.click();say('you',inv[i].text);return;}
  }
  for(var f=0;f<3;f++){
   if(hit(x,y,friendRect(f))){snd.click();giveHint();return;}
  }
  if(hit(x,y,DOOR)){tapFlash=DOOR;tapFlashAt=now();tryDoor();return;}
  var props=room().props;
  for(var j=props.length-1;j>=0;j--){
   if(hit(x,y,props[j])){tapFlash=props[j];tapFlashAt=now();inspectProp(props[j]);return;}
  }
 }

 /* ---- puzzle modal taps ---- */
 function padBtn(d){var row=Math.floor(d/5),col=d%5;return {x:152+col*36,y:126+row*26,w:30,h:20};}
 var PAD_CLR={x:152,y:182,w:66,h:18},PAD_OK={x:262,y:182,w:66,h:18};
 function modalClose(){return {x:modalBox().x+modalBox().w-18,y:modalBox().y+4,w:14,h:14};}
 function modalBox(){
  if(!modal) return {x:120,y:50,w:240,h:160};
  if(modal.kind==='pad') return {x:132,y:56,w:216,h:152};
  if(modal.kind==='simon') return {x:146,y:52,w:188,h:160};
  if(modal.kind==='order') return {x:114,y:52,w:252,h:160};
  return {x:126,y:46,w:228,h:172};
 }
 function simonBtn(i){var c=i%2,r2=Math.floor(i/2);return {x:166+c*76,y:94+r2*50,w:68,h:42};}
 function orderSlot(i){return {x:130+i*56,y:96,w:48,h:66};}
 function symTile(i){var c=i%4,r2=Math.floor(i/4);return {x:142+c*50,y:88+r2*50,w:44,h:44};}

 function modalTap(x,y){
  var r=room();
  if(hit(x,y,modalClose())){snd.click();closeModal();return;}
  if(modal.kind==='pad'){
   for(var d=0;d<10;d++){
    if(hit(x,y,padBtn(d))){snd.click();if(modal.entry.length<3)modal.entry+=String(d);return;}
   }
   if(hit(x,y,PAD_CLR)){snd.click();modal.entry='';return;}
   if(hit(x,y,PAD_OK)){
    if(modal.entry.length<3){snd.buzz();return;}
    if(modal.entry===r.code.join('')){snd.chime();closeModal();say('you','the keypad flashes green!');unlockDoor();}
    else{wrongPenalty();modal.entry='';say('you','bzzt. wrong code. (-5 stars)');}
    return;
   }
   return;
  }
  if(modal.kind==='simon'){
   if(modal.phase!=='input') return;
   for(var i=0;i<4;i++){
    if(hit(x,y,simonBtn(i))){
     modal.flash=i;modal.flashAt=now();snd.simon(i);
     if(i===r.seq[modal.inputIdx]){
      modal.inputIdx++;
      if(modal.inputIdx>=r.seq.length){
       modal.phase='done';modal.solvedAt=now();snd.chime();
       solvePuzzleKey('the '+r.byId[r.puzzleProp].label+' pops open — a key!');
      }
     }else{
      wrongPenalty();
      modal.phase='watch';modal.t=now()+900;modal.pi=0;modal.inputIdx=0;
     }
     return;
    }
   }
   return;
  }
  if(modal.kind==='order'){
   if(modal.solvedAt) return;
   for(var s=0;s<4;s++){
    if(hit(x,y,orderSlot(s))){
     snd.click();
     if(modal.sel<0){modal.sel=s;}
     else{
      if(modal.sel!==s){var t=r.items[modal.sel];r.items[modal.sel]=r.items[s];r.items[s]=t;}
      modal.sel=-1;
      if(r.items.map(function(i2){return i2.n;}).join()===r.target.join()){
       modal.solvedAt=now();snd.chime();
       solvePuzzleKey('a hidden compartment slides open — a key!');
      }
     }
     return;
    }
   }
   return;
  }
  if(modal.kind==='sym'){
   if(modal.solvedAt||modal.revertAt) return;
   for(var k=0;k<8;k++){
    if(hit(x,y,symTile(k))&&r.tiles[k].st===0){
     snd.click();
     r.tiles[k].st=1;modal.open.push(k);
     if(modal.open.length===2){
      var a=r.tiles[modal.open[0]],b=r.tiles[modal.open[1]];
      if(a.s===b.s){a.st=2;b.st=2;modal.open=[];snd.chime();
       if(r.tiles.every(function(t2){return t2.st===2;})){
        modal.solvedAt=now();
        solvePuzzleKey('all pairs matched! the '+r.byId[r.puzzleProp].label+' opens — a key!');
       }
      }else{modal.revertAt=now()+650;}
     }
     return;
    }
   }
   return;
  }
 }

 /* ---- transition / rooms advance ---- */
 function advanceRoom(){
  if(roomIdx>=rooms.length-1){
   finalScore=curScore();
   state='victory';
   snd.jingle();
   confetti=[];
   for(var i=0;i<90;i++)confetti.push({x:rnd()*LW,y:-rnd()*220,vy:20+rnd()*45,vx:(rnd()-0.5)*20,c:pickOne([PINK,SOFT,YEL,PURP,TEAL,WHITE],rnd),s:2+Math.floor(rnd()*2)});
  }else{
   roomIdx++;
   state='explore';
   hover=null;
   say('khushi',roomIdx===1?'room two: '+room().name+'. we\'ve got this.':'last room: '+room().name+'! the front door is RIGHT there.');
  }
 }

 /* ---------------- drawing ---------------- */
 function bx(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 function frameRect(x,y,w,h,c){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.strokeRect(Math.round(x)+0.5,Math.round(y)+0.5,Math.round(w)-1,Math.round(h)-1);}
 function txt(s,x,y,c,size,align){
  ctx.font=(size||10)+'px '+FSTACK;
  ctx.fillStyle=c||WHITE;
  ctx.textAlign=align||'left';
  ctx.textBaseline='top';
  ctx.fillText(s,Math.round(x),Math.round(y));
 }
 function wrap(s,maxW,size){
  ctx.font=(size||10)+'px '+FSTACK;
  var words=String(s).split(' '),lines=[],cur='';
  for(var i=0;i<words.length;i++){
   var w=words[i];
   var t=cur?cur+' '+w:w;
   if(!(ctx.measureText(t).width>maxW)){cur=t;continue;}
   if(cur){lines.push(cur);cur='';}
   /* hard-break a single word that is wider than the line */
   while(w.length>1&&ctx.measureText(w).width>maxW){
    var cut=w.length-1;
    while(cut>1&&ctx.measureText(w.slice(0,cut)).width>maxW)cut--;
    lines.push(w.slice(0,cut));w=w.slice(cut);
   }
   cur=w;
  }
  if(cur)lines.push(cur);
  return lines.length?lines:[''];
 }
 /* draw a single line clamped to maxW (truncates with … if needed) */
 function fitTxt(s,x,y,c,size,align,maxW){
  ctx.font=(size||10)+'px '+FSTACK;
  var t=String(s);
  if(ctx.measureText(t).width>maxW){
   while(t.length>1&&ctx.measureText(t+'…').width>maxW)t=t.slice(0,-1);
   t+='…';
  }
  txt(t,x,y,c,size,align);
 }
 /* wrap + draw up to maxLines lines; returns number of lines drawn */
 function txtWrap(s,x,y,c,size,align,maxW,maxLines,lh){
  var lines=wrap(s,maxW,size);
  var n=Math.min(lines.length,maxLines||lines.length);
  for(var i=0;i<n;i++)txt(lines[i],x,y+i*(lh||12),c,size,align);
  return n;
 }
 function star(x,y,c){
  bx(x+2,y,1,1,c);bx(x+1,y+1,3,1,c);bx(x,y+2,5,1,c);bx(x+1,y+3,3,1,c);bx(x,y+4,2,1,c);bx(x+3,y+4,2,1,c);
 }

 function drawSprite(name,x,y,bob,jolt){
  var pal=CHARS[name]||CHARS.khushi;
  var body=pal.body||BODY;
  var off=bob?1:0;
  if(jolt) off+=Math.sin(now()/40)*2;
  for(var r2=0;r2<body.length;r2++){
   var row=body[r2];
   for(var c=0;c<12;c++){
    var ch=row[c];if(ch==='.')continue;
    var col={h:pal.h,s:pal.s,e:'#1a1026',m:'#b06a56',p:pal.p,q:pal.q,f:pal.f}[ch];
    bx(x+c*2,y+r2*2+off,2,2,col);
   }
  }
 }

 function drawRoomBg(r,t){
  var pal=r.pal;
  bx(0,ROOMTOP,LW,WALLY-ROOMTOP,pal.wall);
  /* wall trim stripes */
  bx(0,ROOMTOP,LW,3,pal.wall2);
  bx(0,WALLY-4,LW,4,pal.wall2);
  /* floor */
  bx(0,WALLY,LW,ROOMBOT-WALLY,pal.floor);
  for(var i=0;i<6;i++) bx(0,WALLY+8+i*8,LW,1,pal.plank);
  /* window with moon + stars */
  var w=r.win;
  bx(w.x-3,w.y-3,w.w+6,w.h+6,'#3a2b57');
  bx(w.x,w.y,w.w,w.h,'#141031');
  bx(w.x+w.w*0.55,w.y+5,9,9,'#f3ead0');
  bx(w.x+w.w*0.55+5,w.y+6,4,4,'#141031');
  for(var s2=0;s2<4;s2++){
   var sx=w.x+3+((s2*13+7)%(w.w-6)),sy=w.y+4+((s2*17+3)%(w.h-8));
   if(Math.floor(t/400+s2)%3!==0) bx(sx,sy,1,1,WHITE);
  }
  bx(w.x+w.w/2-1,w.y,2,w.h,'#3a2b57');
  bx(w.x,w.y+w.h/2-1,w.w,2,'#3a2b57');
  /* decorative ceiling twinkle lights */
  for(var l=0;l<12;l++){
   var lx=12+l*40,on=Math.floor(t/350+l)%4!==0;
   bx(lx,ROOMTOP+4,2,2,on?(l%2?YEL:SOFT):'#463159');
  }
 }

 function drawProp(p,t){
  var x=p.x,y=p.y,w=p.w,h=p.h,k=p.kind;
  if(k==='desk'){bx(x,y,w,6,WOOD);bx(x+3,y+6,5,h-6,WOOD2);bx(x+w-8,y+6,5,h-6,WOOD2);bx(x+10,y+8,w-20,14,WOOD2);bx(x+w/2-3,y+13,6,3,YEL);}
  else if(k==='bookshelf'){bx(x,y,w,h,WOOD2);bx(x+2,y+2,w-4,h-4,WOOD3);
   for(var r2=0;r2<4;r2++){var sy=y+5+r2*(h-10)/4;bx(x+2,sy+(h-10)/4-2,w-4,2,WOOD2);
    for(var b=0;b<5;b++)bx(x+4+b*(w-10)/5,sy,(w-14)/5,(h-10)/4-4,[PINK,TEAL,YEL,PURP,SOFT][(b+r2)%5]);}}
  else if(k==='painting'){bx(x-2,y-2,w+4,h+4,'#c9a13c');bx(x,y,w,h,'#182042');bx(x+w*0.6,y+4,7,7,'#f3ead0');bx(x+4,y+h-8,w-8,4,'#26305c');}
  else if(k==='clock'){bx(x,y,w,h,'#c9a13c');bx(x+2,y+2,w-4,h-4,'#f6f2e4');bx(x+w/2-1,y+4,2,h/2-3,'#1a1026');bx(x+w/2,y+h/2-1,w/3,2,'#1a1026');}
  else if(k==='globe'){bx(x+w/2-2,y+h-8,4,8,WOOD2);bx(x+2,y+h-10,w-4,3,WOOD);bx(x+3,y,w-6,h-12,TEAL);bx(x+6,y+3,7,5,GRN);bx(x+w-13,y+9,8,6,GRN);bx(x+8,y+16,6,4,GRN);}
  else if(k==='lamp'){bx(x+w/2-1,y+14,3,h-18,'#8a86a8');bx(x+2,y+h-4,w-4,4,'#8a86a8');bx(x,y,w,14,YEL);bx(x+2,y+3,w-4,3,'#fff3a8');}
  else if(k==='plant'){bx(x+4,y+h-14,w-8,14,'#a3502e');bx(x+w/2-2,y+6,4,h-18,GRN);bx(x,y+4,8,7,GRN);bx(x+w-8,y+8,8,7,GRN);bx(x+w/2-4,y,8,7,'#63c46f');}
  else if(k==='rug'){bx(x,y,w,h,'#4a2d63');bx(x+4,y+3,w-8,h-6,PINK);bx(x+10,y+6,w-20,h-12,'#4a2d63');}
  else if(k==='radio'){bx(x,y,w,h,'#7a3b52');bx(x+2,y+3,w/2-3,h-6,'#3a2440');for(var g2=0;g2<3;g2++)bx(x+3,y+4+g2*3,w/2-5,1,'#8a86a8');bx(x+w-8,y+3,4,4,YEL);bx(x+w-8,y+h-7,4,3,SOFT);}
  else if(k==='bed'){bx(x,y+10,w,h-10,WOOD2);bx(x+2,y,6,h,WOOD);bx(x+2,y+8,w-4,14,'#f6f2e4');bx(x+4,y+10,18,9,SOFT);bx(x+2,y+20,w-4,h-24,PINK);bx(x+2,y+22,w-4,2,'#d14e77');}
  else if(k==='wardrobe'){bx(x,y,w,h,WOOD);bx(x+2,y+2,w/2-3,h-4,WOOD2);bx(x+w/2+1,y+2,w/2-3,h-4,WOOD2);bx(x+w/2-4,y+h/2-3,3,6,YEL);bx(x+w/2+1,y+h/2-3,3,6,YEL);}
  else if(k==='mirror'){bx(x-2,y-2,w+4,h+4,'#c9a13c');bx(x,y,w,h,'#a9c8dd');bx(x+2,y+3,3,h-8,'#e6f4fb');}
  else if(k==='fairylights'){for(var f2=0;f2<9;f2++){var fx=x+4+f2*(w-8)/8;bx(fx,y+4+(f2%2)*3,1,3,'#463159');var on2=Math.floor(t/300+f2)%3!==0;bx(fx-1,y+7+(f2%2)*3,3,3,on2?[PINK,YEL,TEAL,SOFT][f2%4]:'#463159');}bx(x,y+3,w,1,'#463159');}
  else if(k==='dresser'){bx(x,y,w,h,WOOD);bx(x+3,y+4,w-6,h/2-6,WOOD2);bx(x+3,y+h/2+2,w-6,h/2-6,WOOD2);bx(x+w/2-2,y+h/4-1,4,3,YEL);bx(x+w/2-2,y+h*3/4-3,4,3,YEL);}
  else if(k==='pillows'){bx(x+2,y+h-10,w-4,10,SOFT);bx(x,y+h-18,w-8,9,PINK);bx(x+8,y,w-12,9,WHITE);}
  else if(k==='oven'){bx(x,y,w,h,'#8a86a8');bx(x+4,y+12,w-8,h-18,'#3a2440');bx(x+6,y+15,w-12,h-26,'#f7b040');bx(x+4,y+4,4,4,PINK);bx(x+12,y+4,4,4,YEL);}
  else if(k==='fridge'){bx(x,y,w,h,'#e8e4f2');bx(x+2,y+2,w-4,h/3,'#d4cfe6');bx(x+w-7,y+6,3,10,'#8a86a8');bx(x+w-7,y+h/3+6,3,14,'#8a86a8');bx(x+5,y+8,6,7,PINK);}
  else if(k==='sink'){bx(x,y+10,w,h-10,'#5b4a7a');bx(x+3,y+6,w-6,8,'#8a86a8');bx(x+w/2-1,y-2,2,10,'#c8c4dd');bx(x+w/2-4,y-4,8,3,'#c8c4dd');}
  else if(k==='shelf'){bx(x,y+h-5,w,5,WOOD);bx(x+2,y+h,3,5,WOOD2);bx(x+w-5,y+h,3,5,WOOD2);for(var j2=0;j2<4;j2++)bx(x+4+j2*(w-8)/4,y,8,h-5,[PINK,YEL,TEAL,SOFT][j2]);}
  else if(k==='jars'){bx(x,y+h-4,w,4,WOOD);bx(x+2,y+2,10,h-6,'#cfe3ea');bx(x+2,y,10,3,WOOD2);bx(x+16,y+5,10,h-9,'#cfe3ea');bx(x+16,y+3,10,3,WOOD2);}
  else if(k==='table'){bx(x,y,w,6,WOOD);bx(x+4,y+6,4,h-6,WOOD2);bx(x+w-8,y+6,4,h-6,WOOD2);bx(x+w/2-8,y-4,16,4,'#f6f2e4');}
  else if(k==='cupboard'){bx(x,y,w,h,WOOD);bx(x+2,y+2,w/2-3,h-4,WOOD3);bx(x+w/2+1,y+2,w/2-3,h-4,WOOD3);bx(x+w/2-3,y+h/2-2,2,4,YEL);bx(x+w/2+2,y+h/2-2,2,4,YEL);}
  else if(k==='sofa'){bx(x,y+8,w,h-8,PURP);bx(x,y,10,h,'#6a44b0');bx(x+w-10,y,10,h,'#6a44b0');bx(x+10,y+4,w-20,10,'#6a44b0');bx(x+12,y+16,w/2-14,12,SOFT);bx(x+w/2+2,y+16,w/2-14,12,PINK);}
  else if(k==='jukebox'){bx(x+2,y+8,w-4,h-8,'#7a3b52');bx(x+4,y,w-8,12,PINK);bx(x+6,y+2,w-12,6,YEL);bx(x+7,y+14,w-14,16,'#3a2440');for(var m2=0;m2<3;m2++)bx(x+8,y+16+m2*4,w-16,1,[PINK,TEAL,YEL][m2]);bx(x+8,y+h-16,w-16,10,'#26102e');}
  else if(k==='tvcabinet'){bx(x,y+h-22,w,22,WOOD);bx(x+3,y+h-19,w/2-5,16,WOOD2);bx(x+w/2+2,y+h-19,w/2-5,16,WOOD2);bx(x+8,y+4,w-16,h-28,'#26305c');bx(x+10,y+6,w-20,h-34,'#5d70b8');bx(x+w/2-1,y-4,1,8,'#8a86a8');bx(x+w/2+4,y-6,1,10,'#8a86a8');}
  else if(k==='barrel'){bx(x+2,y,w-4,h,WOOD);bx(x,y+5,w,4,'#8a86a8');bx(x,y+h-9,w,4,'#8a86a8');bx(x+w/2-1,y,2,h,WOOD2);}
  else if(k==='crates'){bx(x,y+h/2,w-8,h/2,WOOD);frameRect(x,y+h/2,w-8,h/2,WOOD3);bx(x+6,y,w-14,h/2,WOOD2);frameRect(x+6,y,w-14,h/2,WOOD3);}
  else if(k==='chest'){bx(x,y+8,w,h-8,WOOD);bx(x+1,y,w-2,10,WOOD2);bx(x+w/2-3,y+8,6,7,'#c9a13c');bx(x,y+8,w,2,WOOD3);}
  else if(k==='winerack'){bx(x,y,w,h,WOOD3);for(var rr=0;rr<4;rr++)for(var cc=0;cc<3;cc++){var bxp=x+4+cc*(w-8)/3,byp=y+4+rr*(h-8)/4;bx(bxp,byp,(w-14)/3,(h-14)/4,'#241733');bx(bxp+2,byp+2,4,4,'#5a2c44');}}
  else if(k==='lantern'){bx(x+w/2-1,y-6,2,6,'#8a86a8');bx(x,y,w,h,'#8a86a8');bx(x+3,y+3,w-6,h-6,Math.floor(t/500)%2?'#ffd75e':'#f7b040');}
 }

 function drawGlow(r2,t){
  var pulse=0.45+0.35*Math.sin(t/160);
  ctx.globalAlpha=pulse;
  ctx.strokeStyle=YEL;ctx.lineWidth=1;
  ctx.strokeRect(r2.x-2.5,r2.y-2.5,r2.w+5,r2.h+5);
  ctx.globalAlpha=1;
 }

 function drawDoor(t){
  var r=room();
  var last=roomIdx===rooms.length-1;
  bx(DOOR.x-4,DOOR.y-4,DOOR.w+8,DOOR.h+4,'#3a2b57');
  bx(DOOR.x,DOOR.y,DOOR.w,DOOR.h,last?'#7a3b52':WOOD);
  bx(DOOR.x+3,DOOR.y+4,DOOR.w-6,DOOR.h/2-8,WOOD2);
  bx(DOOR.x+3,DOOR.y+DOOR.h/2+2,DOOR.w-6,DOOR.h/2-8,WOOD2);
  bx(DOOR.x+4,DOOR.y+DOOR.h/2-3,5,5,'#c9a13c');
  if(!r.unlocked){
   /* lock icon */
   var lx=DOOR.x+DOOR.w/2-4,ly=DOOR.y+DOOR.h/2+10;
   bx(lx,ly+3,9,8,YEL);bx(lx+2,ly,5,4,YEL);bx(lx+3,ly+1,3,2,r.pal.wall);bx(lx+4,ly+6,1,3,'#1a1026');
  }
  if(hover===DOOR||(tapFlash===DOOR&&now()-tapFlashAt<350)) drawGlow(DOOR,t);
  if(last) txt('exit',DOOR.x+DOOR.w/2,DOOR.y-14,YEL,10,'center');
 }

 function drawTopBar(t){
  bx(0,0,LW,ROOMTOP,'#160e2b');
  bx(0,ROOMTOP-1,LW,1,PINK);
  /* layout audit @480px, 10px font: name 4..154 | timer 164..214 | star+score 216..~258 | best ..424 | mute 430 | quit 456 */
  fitTxt(state==='victory'?'the villa':room().name,4,5,SOFT,10,'left',150);
  var sec=Math.floor(elapsed()/1000),mm=Math.floor(sec/60),ss=sec%60;
  txt((mm<10?'0':'')+mm+':'+(ss<10?'0':'')+ss,164,5,WHITE,10);
  star(216,6,YEL);
  txt(String(state==='victory'?finalScore:curScore()),226,5,YEL,10);
  if(bestScore>0) fitTxt('best '+bestScore,MUTEB.x-6,5,'#9b8bb8',10,'right',110);
  /* mute (visible button centered in the bigger hit rect) */
  bx(MUTEB.x+5,2,14,14,'#241733');
  txt(muted?'x':'♪',MUTEB.x+12,4,muted?'#6b5a8a':SOFT,10,'center');
  /* quit */
  bx(QUITB.x+5,2,14,14,'#241733');
  txt('✕',QUITB.x+12,4,PINK,10,'center');
 }

 function drawBottom(t){
  /* dialogue box */
  bx(4,196,LW-8,50,'#160e2b');
  frameRect(4,196,LW-8,50,PINK);
  if(dlg){
   var age=now()-(dlg.doneAt||now());
   var faded=dlgDone()&&!dlgQueue.length&&dlg.doneAt&&age>6000;
   if(!faded){
    txt(dlg.who+':',10,199,dlg.who==='you'?YEL:PINK,10);
    var vis=dlg.text.slice(0,Math.floor(dlg.shown));
    var lines=wrap(vis,DLG_W,10);
    for(var i=0;i<Math.min(lines.length,DLG_LINES);i++) txt(lines[i],10,211+i*11,WHITE,10);
    if(dlgDone()&&dlgQueue.length&&Math.floor(t/400)%2) txt('▾',LW-16,234,SOFT,10);
   }
  }else{
   txt('tap around. find clues. escape.',10,216,'#6b5a8a',10);
  }
  /* inventory */
  for(var s2=0;s2<5;s2++){
   var ir=invRect(s2);
   bx(ir.x,ir.y,ir.w,ir.h,'#160e2b');
   frameRect(ir.x,ir.y,ir.w,ir.h,'#463159');
   var it=inv[s2];
   if(it){
    if(it.icon==='key'){bx(ir.x+5,ir.y+9,10,3,YEL);bx(ir.x+4,ir.y+6,6,8,YEL);bx(ir.x+6,ir.y+8,2,3,'#160e2b');bx(ir.x+15,ir.y+12,2,3,YEL);}
    else{bx(ir.x+6,ir.y+4,12,14,'#f6f2e4');bx(ir.x+8,ir.y+7,8,1,'#8a86a8');bx(ir.x+8,ir.y+10,8,1,'#8a86a8');bx(ir.x+8,ir.y+13,8,1,'#8a86a8');}
   }
  }
  txt('items',140,254,'#6b5a8a',10);
  fitTxt('tap a friend for a hint',LW-4,254,'#6b5a8a',10,'right',300);
 }

 function drawModal(t){
  var r=room(),b=modalBox();
  ctx.globalAlpha=0.6;bx(0,ROOMTOP,LW,ROOMBOT-ROOMTOP,NIGHT);ctx.globalAlpha=1;
  bx(b.x,b.y,b.w,b.h,'#1c1233');
  frameRect(b.x,b.y,b.w,b.h,PINK);
  frameRect(b.x+2,b.y+2,b.w-4,b.h-4,'#463159');
  var cl=modalClose();
  bx(cl.x,cl.y,cl.w,cl.h,'#241733');
  txt('✕',cl.x+7,cl.y+3,PINK,10,'center');
  if(modal.kind==='pad'){
   fitTxt('door keypad',b.x+b.w/2,b.y+8,SOFT,10,'center',b.w-40);
   for(var s2=0;s2<3;s2++){
    bx(b.x+58+s2*36,b.y+26,30,20,'#0d0920');
    frameRect(b.x+58+s2*36,b.y+26,30,20,YEL);
    txt(modal.entry[s2]||'_',b.x+73+s2*36,b.y+32,YEL,10,'center');
   }
   for(var d=0;d<10;d++){var pb=padBtn(d);bx(pb.x,pb.y,pb.w,pb.h,'#2d1d40');frameRect(pb.x,pb.y,pb.w,pb.h,SOFT);txt(String(d),pb.x+pb.w/2,pb.y+5,WHITE,10,'center');}
   bx(PAD_CLR.x,PAD_CLR.y,PAD_CLR.w,PAD_CLR.h,'#2d1d40');frameRect(PAD_CLR.x,PAD_CLR.y,PAD_CLR.w,PAD_CLR.h,SOFT);txt('clear',PAD_CLR.x+PAD_CLR.w/2,PAD_CLR.y+5,SOFT,10,'center');
   bx(PAD_OK.x,PAD_OK.y,PAD_OK.w,PAD_OK.h,PINK);txt('enter',PAD_OK.x+PAD_OK.w/2,PAD_OK.y+5,WHITE,10,'center');
  }
  else if(modal.kind==='simon'){
   var lbl=r.byId[r.puzzleProp].label;
   fitTxt(lbl,b.x+b.w/2,b.y+8,SOFT,10,'center',b.w-40);
   var msg=modal.phase==='watch'?'watch...':(modal.phase==='input'?'your turn! ('+modal.inputIdx+'/4)':'nice!!');
   fitTxt(msg,b.x+b.w/2,b.y+22,YEL,10,'center',b.w-16);
   var cols=[PINK,YEL,PURP,TEAL];
   for(var i=0;i<4;i++){
    var sb=simonBtn(i);
    var lit=(modal.flash===i&&now()-modal.flashAt<300);
    ctx.globalAlpha=lit?1:0.45;
    bx(sb.x,sb.y,sb.w,sb.h,cols[i]);
    ctx.globalAlpha=1;
    frameRect(sb.x,sb.y,sb.w,sb.h,WHITE);
   }
  }
  else if(modal.kind==='order'){
   fitTxt('tap two to swap',b.x+b.w/2,b.y+7,SOFT,10,'center',b.w-40);
   txtWrap(r.foundNote?r.clue:'(you haven\'t found the clue note yet...)',b.x+b.w/2,b.y+20,'#9b8bb8',10,'center',b.w-16,2,11);
   for(var s3=0;s3<4;s3++){
    var os=orderSlot(s3),it=r.items[s3];
    bx(os.x,os.y,os.w,os.h,modal.sel===s3?'#3d2a5c':'#241733');
    frameRect(os.x,os.y,os.w,os.h,modal.sel===s3?YEL:SOFT);
    if(r.rule==='rainbow'){bx(os.x+14,os.y+10,20,34,it.c);bx(os.x+18,os.y+4,12,8,it.c);}
    else if(r.rule==='size'){var z=it.sz;bx(os.x+os.w/2-z/2,os.y+40-z*1.6,z,z*1.6,'#b07040');bx(os.x+os.w/2-z/4,os.y+38-z*1.6,z/2,4,'#8a5028');}
    else{bx(os.x+14,os.y+10,20,20,[PINK,TEAL,YEL,PURP][s3]);txt(it.n[0],os.x+24,os.y+16,'#1a1026',10,'center');}
    txt(it.n,os.x+os.w/2,os.y+52,WHITE,10,'center');
   }
   if(modal.solvedAt) txt('click! it opens!',b.x+b.w/2,b.y+b.h-14,YEL,10,'center');
  }
  else if(modal.kind==='sym'){
   txtWrap(r.byId[r.puzzleProp].label+' — match the pairs',b.x+b.w/2,b.y+8,SOFT,10,'center',b.w-40,2,11);
   for(var k2=0;k2<8;k2++){
    var st2=symTile(k2),tl=r.tiles[k2];
    if(tl.st===0){bx(st2.x,st2.y,st2.w,st2.h,'#2d1d40');frameRect(st2.x,st2.y,st2.w,st2.h,SOFT);txt('?',st2.x+st2.w/2,st2.y+17,'#6b5a8a',10,'center');}
    else{
     bx(st2.x,st2.y,st2.w,st2.h,tl.st===2?'#173a2e':'#3d2a5c');
     frameRect(st2.x,st2.y,st2.w,st2.h,tl.st===2?GRN:YEL);
     drawSym(tl.s,st2.x+st2.w/2,st2.y+st2.h/2);
    }
   }
   if(modal.solvedAt) txt('unlocked!',b.x+b.w/2,b.y+b.h-14,YEL,10,'center');
  }
 }
 function drawSym(s,cx2,cy2){
  if(s===0){/* moon */bx(cx2-8,cy2-8,16,16,'#f3ead0');bx(cx2-2,cy2-7,12,14,'#3d2a5c');}
  else if(s===1){/* star */bx(cx2-2,cy2-9,4,18,YEL);bx(cx2-9,cy2-2,18,4,YEL);bx(cx2-6,cy2-6,12,12,YEL);}
  else if(s===2){/* heart */bx(cx2-8,cy2-6,7,7,PINK);bx(cx2+1,cy2-6,7,7,PINK);bx(cx2-6,cy2-1,12,6,PINK);bx(cx2-3,cy2+5,6,4,PINK);}
  else{txt('zzz',cx2,cy2-6,TEAL,10,'center');}
 }

 function drawConfirm(){
  ctx.globalAlpha=0.72;bx(0,0,LW,LH,NIGHT);ctx.globalAlpha=1;
  bx(110,96,260,90,'#1c1233');frameRect(110,96,260,90,PINK);
  txt('give up?',240,110,WHITE,10,'center');
  fitTxt('khushi will judge you',240,126,SOFT,10,'center',248);
  bx(120,150,110,22,'#2d1d40');frameRect(120,150,110,22,TEAL);txt('keep going',175,156,TEAL,10,'center');
  bx(250,150,110,22,'#2d1d40');frameRect(250,150,110,22,PINK);txt('give up',305,156,PINK,10,'center');
 }

 function drawVictory(t,dt){
  bx(0,0,LW,LH,NIGHT);
  bx(0,190,LW,80,'#160e2b');
  /* moon + stars */
  bx(400,26,18,18,'#f3ead0');bx(408,28,12,14,NIGHT);
  for(var s2=0;s2<24;s2++){var sx=(s2*67+13)%LW,sy=(s2*41+7)%170;if(Math.floor(t/300+s2)%4!==0)bx(sx,sy,1,1,WHITE);}
  fitTxt('you escaped the villa!',240,64,YEL,10,'center',LW-16);
  fitTxt('slumber escape',240,44,PINK,10,'center',LW-16);
  star(186,88,YEL);
  txt(finalScore+' stars',240,86,WHITE,10,'center');
  if(finalScore>bestScore) txt('new best!',240,102,PINK,10,'center');
  /* the girls */
  for(var i=0;i<friendNames.length;i++){
   drawSprite(friendNames[i],168+i*62,124,Math.floor(t/280+i)%2===0);
   txt(friendNames[i],180+i*62,162,SOFT,10,'center');
  }
  /* confetti */
  if(confetti){
   for(var c=0;c<confetti.length;c++){
    var p=confetti[c];
    p.y+=p.vy*dt;p.x+=p.vx*dt;
    if(p.y>LH){p.y=-4;p.x=rnd()*LW;}
    bx(p.x,p.y,p.s,p.s,p.c);
   }
  }
  bx(victoryBtn.x,victoryBtn.y,victoryBtn.w,victoryBtn.h,PINK);
  fitTxt('back to the arcade',victoryBtn.x+victoryBtn.w/2,victoryBtn.y+6,WHITE,10,'center',victoryBtn.w-8);
 }

 /* ---------------- main loop ---------------- */
 var lastT=now();
 function frame(){
  if(dead) return;
  rafId=requestAnimationFrame(frame);
  var t=now(),dt=Math.min(0.05,(t-lastT)/1000);lastT=t;

  /* typewriter progress */
  if(dlg&&!dlgDone()){
   dlg.shown=Math.min(dlg.text.length,Math.max(dlg.shown,(t-dlg.started)/1000*42));   /* wall-clock so throttled rAF can't stall the text */
   if(dlgDone())dlg.doneAt=t;
  }
  /* ambient banter */
  if(state==='explore'&&t>nextBanterAt){
   nextBanterAt=t+22000+rnd()*9000;
   if(!dlg||dlgDone())say(pickOne(friendNames,rnd),pickOne(BANTER,rnd));
  }
  /* simon playback */
  if(modal&&modal.kind==='simon'&&modal.phase==='watch'&&t>=modal.t){
   var step=Math.floor((t-modal.t)/520);
   var r=room();
   if(step<r.seq.length){
    if(step>=modal.pi){
     modal.flash=r.seq[step];modal.flashAt=t;modal.pi=step+1;snd.simon(r.seq[step]);
    }
   }else if((t-modal.t)>r.seq.length*520+250){
    modal.phase='input';modal.inputIdx=0;
   }
  }
  /* symbol revert */
  if(modal&&modal.kind==='sym'&&modal.revertAt&&t>modal.revertAt){
   var rr=room();
   modal.open.forEach(function(i){rr.tiles[i].st=0;});
   modal.open=[];modal.revertAt=0;
  }
  /* solved modal auto-close */
  if(modal&&modal.solvedAt&&t-modal.solvedAt>1100) closeModal();
  if(modal&&modal.kind==='simon'&&modal.phase==='done'&&t-modal.solvedAt>1100) closeModal();
  /* transition */
  if(state==='transition'){
   var tt=t-transAt;
   if(transPhase===0&&tt>700){transPhase=1;advanceRoom();transAt=t;if(state==='transition')state='explore';}
  }

  /* ---------- draw ---------- */
  ctx.save();
  ctx.clearRect(0,0,LW,LH);
  bx(0,0,LW,LH,NIGHT);
  if(t<shakeUntil){ctx.translate(Math.round((rnd()-0.5)*4),Math.round((rnd()-0.5)*4));}

  if(state==='victory'){
   drawVictory(t,dt);
   drawTopBar(t);
   ctx.restore();
   return;
  }

  var r2=room();
  drawRoomBg(r2,t);
  /* props */
  for(var i=0;i<r2.props.length;i++){
   var p=r2.props[i];
   drawProp(p,t);
   if(hover===p||(tapFlash===p&&t-tapFlashAt<350)) drawGlow(p,t);
  }
  drawDoor(t);
  /* friends */
  for(var f=0;f<friendNames.length;f++){
   var fp=friendPos(f);
   drawSprite(friendNames[f],fp.x,fp.y,Math.floor(t/300+f)%2===0,tripFriend===f&&t<tripUntil);
  }
  /* cat dash */
  if(t<catUntil){
   var cp=(t-catFrom)/1200;
   var cx2=-24+cp*(LW+48),cy2=180;
   bx(cx2,cy2,16,7,'#2b2b33');bx(cx2+13,cy2-4,6,6,'#2b2b33');bx(cx2+14,cy2-6,2,2,'#2b2b33');bx(cx2+17,cy2-6,2,2,'#2b2b33');bx(cx2-4,cy2+1,5,2,'#2b2b33');bx(cx2+15,cy2-3,1,1,YEL);
  }
  /* door swing during transition */
  if(state==='transition'&&transPhase===0){
   var sw=Math.min(1,(t-transAt)/500);
   bx(DOOR.x,DOOR.y,DOOR.w,DOOR.h,'#050308');
   bx(DOOR.x,DOOR.y,Math.max(3,DOOR.w*(1-sw)),DOOR.h,WOOD);
   ctx.globalAlpha=Math.max(0,(t-transAt-300)/400);
   bx(0,0,LW,LH,NIGHT);
   ctx.globalAlpha=1;
  }
  /* lights out overlay */
  if(t<lightsUntil){
   var g=ctx.createRadialGradient(px2,py2,10,px2,py2,54);
   g.addColorStop(0,'rgba(5,3,10,0)');
   g.addColorStop(1,'rgba(5,3,10,0.96)');
   ctx.fillStyle=g;
   ctx.fillRect(0,ROOMTOP,LW,ROOMBOT-ROOMTOP);
  }
  if(state==='puzzle'&&modal) drawModal(t);
  drawTopBar(t);
  drawBottom(t);
  if(state==='confirm') drawConfirm();
  ctx.restore();
 }

 /* ---------------- teardown ---------------- */
 function finish(score){
  if(finished) return;
  finished=true;dead=true;
  cancelAnimationFrame(rafId);
  cv.removeEventListener('pointerdown',onDown);
  cv.removeEventListener('pointermove',onMove);
  window.removeEventListener('resize',doResize);
  try{ if(hostRO) hostRO.disconnect(); }catch(e){}
  window.removeEventListener('keydown',onKey);
  if(actx){try{actx.close();}catch(e){}}
  if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
  try{exitCb(Math.max(0,score|0));}catch(e){}
 }
 function onKey(ev){
  if(ev.key==='Escape'){
   if(state==='confirm'){state=prevState;}
   else if(state==='puzzle'){closeModal();}
   else if(state==='victory'){finish(finalScore);}
   else{prevState=state;state='confirm';}
  }
 }

 cv.addEventListener('pointerdown',onDown);
 cv.addEventListener('pointermove',onMove);
 window.addEventListener('resize',doResize);
 window.addEventListener('keydown',onKey);

 say('khushi','tap stuff, find clues, get us out of '+room().name+'!');
 rafId=requestAnimationFrame(frame);
}

})();
