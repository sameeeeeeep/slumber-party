/* ============================================================
   THE INNER CIRCLE · LEVEL 2 — "okay jahnu"
   Jahnvi's purple-Lamborghini SEASIDE SUNSET drive. SIDE VIEW:
   the boulevard scrolls RIGHT→LEFT, Jahnvi holds the left third in
   her open purple Lambo (facing right) and hops between 3 stacked
   lanes. Keep the power up ⚡ and dodge the EXIT / FLYOVER ramps.
   Palms, lamp posts, a stone
   balustrade and a pixel skyline across the water roll past behind.
   Self-registers into the shell (assets/vault.js) via
   window.__innerCircle.register. Draws everything on env.ctx.
   ============================================================ */
(function(){ 'use strict';

 function boot(){
  if(!(window.__innerCircle&&window.__innerCircle.register)){ return setTimeout(boot,120); }
  window.__innerCircle.register({
   n:2, key:'jahnu', title:'okay jahnu', sub:'cruise the coast. keep the power up.', playable:true,
   start:startLevel
  });
 }

 function startLevel(env){
  var ctx=env.ctx, C=env.colors, W=env.W, H=env.H;
  var PIXEL=env.PIXEL, MONO=env.MONO;

  /* ---- vertical layout ---- */
  var HORIZON=246;                 /* waterline: sky above, sea below */
  var ROAD_TOP=342;                /* asphalt fills the lower ~43% */
  var ROAD_BOT=598;
  var ROAD_H=ROAD_BOT-ROAD_TOP;    /* 256 */
  var LANES=3, LANE_H=ROAD_H/LANES;/* ~85 */
  var CAR_X=140;                   /* Jahnvi holds the left third, facing right */
  var SPAWN_X=W+80;                /* things approach from off the right edge */
  function laneCY(i){ return ROAD_TOP + LANE_H*(i+0.5); }

  /* ---- optional art (vector fallback until/if it loads) ---- */
  var carImg=env.loadImage('assets/vault/jahnu-car.png');

  /* ---- run state ---- */
  var carLane=1, carY=laneCY(1), prevY=carY;
  var worldX=0, speed=150, SPEED_CAP=290;
  var POWER_MAX=100, power=POWER_MAX;
  var clout=0, pickupCount=0;
  var elapsed=0, over=false, raf=0, last=0;
  var GRACE=2.2;                   /* no majors before this */

  var objs=[];                     /* approaching hazard / power entities */
  var pending=null;                /* the hazard currently in the approach */
  var cooldown=0.6;                /* until next major spawn */
  var majorSeq=0;
  var powerTimer=1.4;
  var flash=null;                  /* {text,color,t,life} centre feedback */
  var RAMP_W=170;                  /* ramp deck length trailing right of the fork point */


  /* =====================================================================
     procedural seaside backdrop — generated once, drawn with parallax
     ===================================================================== */
  var i;
  var stars=[];
  for(i=0;i<48;i++){ stars.push({ x:Math.random()*W, y:Math.random()*(HORIZON-70), r:Math.random()*1.4+0.3, tw:Math.random()*6.28 }); }

  /* skyline across the water — a tileable strip of buildings */
  var CITY_P=340, city=[]; var cx=0;
  while(cx<CITY_P){ var cw=14+Math.random()*26, ch=30+Math.random()*72;
   city.push({ x:cx, w:cw, h:ch, hue:Math.random()<0.5 }); cx+=cw+2+Math.random()*7; }

  /* roadside stations (palm OR lamp post) — tileable */
  var STN_P=196, stations=[];
  for(i=0;i<6;i++){ stations.push({ x:i*(STN_P/6)+Math.random()*8, kind:(i%2===0)?'palm':'lamp', s:0.86+Math.random()*0.3 }); }

  function wrap(v,p){ v=v%p; return v<0?v+p:v; }

  /* =====================================================================
     input — discrete one-lane-per-press (never teleport: carY tweens)
     ===================================================================== */
  function steer(dir){
   var nl = dir<0 ? Math.max(0,carLane-1) : Math.min(LANES-1,carLane+1);
   if(nl!==carLane){ carLane=nl; env.snd.swerve(); }
  }
  env.onPress(function(name){
   if(over) return;
   if(name==='up') steer(-1);
   else if(name==='down') steer(1);
   else if(name==='tap'){ carLane=(carLane+1)%LANES; env.snd.swerve(); }  /* tap cycles down (wraps) */
  });
  env.touchControls([
   { label:'▲', onPress:function(){ if(!over) steer(-1); } },
   { label:'▼', onPress:function(){ if(!over) steer(1); } }
  ]);

  /* =====================================================================
     director — one hazard in the approach at a time; ⚡ pickups
     sprinkle the gaps. pure dodge-and-collect, no quiz.
     ===================================================================== */
  function spawnMajor(){
   majorSeq++;
   spawnHazard();
  }
  function spawnHazard(){
   var two = elapsed>22 && Math.random()<0.35;
   /* don't flag a lane that already holds an approaching ⚡ pickup (never bait) */
   var busy={}; for(var b=0;b<objs.length;b++){ var e=objs[b]; if(e.type==='power'&&!e.done&&e.x>CAR_X) busy[e.lane]=1; }
   var pick=[]; for(var p=0;p<LANES;p++){ if(!busy[p]) pick.push(p); }
   if(pick.length<2) pick=[0,1,2];
   for(var s=pick.length-1;s>0;s--){ var j=Math.floor(Math.random()*(s+1)); var t=pick[s]; pick[s]=pick[j]; pick[j]=t; }
   /* always leave >=1 unflagged safe lane */
   var flagged=[pick[0]]; if(two && pick.length>=3) flagged.push(pick[1]);
   var o={ type:'hazard', x:SPAWN_X, lanes:flagged, done:false };
   objs.push(o); pending=o;
  }
  function spawnPower(){
   /* place in a lane that is currently SAFE (not flagged by a pending hazard) */
   var avoid={};
   if(pending&&pending.type==='hazard'){ for(var k=0;k<pending.lanes.length;k++) avoid[pending.lanes[k]]=1; }
   var choices=[]; for(var l=0;l<LANES;l++){ if(!avoid[l]) choices.push(l); }
   if(!choices.length) return;
   var lane=choices[Math.floor(Math.random()*choices.length)];
   objs.push({ type:'power', x:SPAWN_X-20, lane:lane, done:false, bob:Math.random()*6.28 });
  }

  /* =====================================================================
     update
     ===================================================================== */
  function setFlash(text,color){ flash={ text:text, color:color, t:0, life:1.1 }; }
  function endRun(msg){ if(over) return; over=true; env.end(clout, msg); }

  function update(dt){
   elapsed+=dt;

   /* smooth lane tween (never teleport) */
   prevY=carY;
   var ty=laneCY(carLane);
   carY += (ty-carY)*Math.min(1,dt*11);

   /* speed ramps up, capped; world + road scroll */
   speed=Math.min(SPEED_CAP, 150 + elapsed*5.0);
   worldX += speed*dt;
   clout += speed*dt*0.05;                 /* distance clout */

   /* power drains hard — you MUST keep collecting ⚡ to stay alive */
   var drain=5.4 + (speed-150)/60;
   power -= drain*dt;
   if(power<=0){ power=0; endRun('out of power ⚡'); return; }

   /* director */
   if(elapsed>GRACE){
    if(pending===null){ cooldown-=dt; if(cooldown<=0){ spawnMajor(); } }
    powerTimer-=dt;
    if(powerTimer<=0){ powerTimer=3.1+Math.random()*1.7; spawnPower(); }   /* ⚡ is scarce — chase it */
   }

   /* advance entities (right→left), resolve as they cross the car band */
   for(i=objs.length-1;i>=0;i--){
    var o=objs[i];
    o.x -= speed*dt;
    if(!o.done && o.x<=CAR_X){ o.done=true; resolve(o); if(over) return; }
    if(o.x < -(RAMP_W+160)) objs.splice(i,1);   /* ramps trail RAMP_W right of o.x — no pop-out */
   }

   if(flash){ flash.t+=dt; if(flash.t>=flash.life) flash=null; }
  }

  function resolve(o){
   var lane=carLane;
   if(o.type==='power'){
    if(lane===o.lane){ power=Math.min(POWER_MAX,power+15); clout+=5; pickupCount++; env.snd.coin(); setFlash('+power ⚡',C.YEL); }
    return;
   }
   if(o.type==='hazard'){
    var hit=false; for(var k=0;k<o.lanes.length;k++){ if(o.lanes[k]===lane){ hit=true; break; } }
    if(hit){ env.snd.sorry(); endRun('you exited the highway 🛣️'); return; }
    clout+=6; env.snd.tick();
    pending=null; cooldown=0.55+Math.random()*0.5; return;
   }
  }

  /* =====================================================================
     drawing — back-to-front seaside boulevard
     ===================================================================== */
  function drawSky(){
   var g=ctx.createLinearGradient(0,0,0,HORIZON);
   g.addColorStop(0,'#2a1a4a');    /* purple */
   g.addColorStop(0.45,'#7c2f74'); /* magenta */
   g.addColorStop(0.78,'#c8506a'); /* rose */
   g.addColorStop(1,'#ec8a3a');    /* orange band at the horizon */
   ctx.fillStyle=g; ctx.fillRect(0,0,W,HORIZON+2);
   /* warm haze just above the water */
   var hz=ctx.createLinearGradient(0,HORIZON-40,0,HORIZON);
   hz.addColorStop(0,'rgba(240,180,90,0)'); hz.addColorStop(1,'rgba(245,205,120,0.5)');
   ctx.fillStyle=hz; ctx.fillRect(0,HORIZON-40,W,40);
   /* stars up high */
   for(i=0;i<stars.length;i++){ var st=stars[i]; ctx.globalAlpha=0.25+0.4*Math.abs(Math.sin(st.tw+elapsed*1.4));
    ctx.fillStyle='#fff'; ctx.fillRect(st.x, st.y, st.r, st.r); }
   ctx.globalAlpha=1;
  }

  function drawSea(){
   var g=ctx.createLinearGradient(0,HORIZON,0,ROAD_TOP);
   g.addColorStop(0,'#b6553f'); g.addColorStop(0.4,'#6e3560'); g.addColorStop(1,'#331f52');
   ctx.fillStyle=g; ctx.fillRect(0,HORIZON,W,ROAD_TOP-HORIZON);
   /* shimmering reflection rows (scroll slowly) */
   var off=wrap(worldX*0.25, 40);
   for(var y=HORIZON+8; y<ROAD_TOP-4; y+=11){
    ctx.globalAlpha=0.12+0.06*Math.sin(elapsed*2+y);
    ctx.fillStyle='#f0c07a';
    for(var x=-off; x<W; x+=40){ ctx.fillRect(x+(y%22), y, 14+8*Math.sin(y+elapsed), 2); }
   }
   ctx.globalAlpha=1;
  }

  function drawSkyline(){
   /* soft headland behind everything (very slow) */
   var hoff=wrap(worldX*0.08, W);
   ctx.fillStyle='#3a2352';
   for(var hx=-hoff; hx<W+W; hx+=W){
    ctx.beginPath(); ctx.moveTo(hx,HORIZON);
    ctx.quadraticCurveTo(hx+120,HORIZON-58,hx+250,HORIZON-24);
    ctx.quadraticCurveTo(hx+380,HORIZON-70,hx+W,HORIZON);
    ctx.closePath(); ctx.fill();
   }
   /* pixel skyline across the water */
   var off=wrap(worldX*0.18, CITY_P);
   for(var base=-off; base<W+CITY_P; base+=CITY_P){
    for(i=0;i<city.length;i++){ var b=city[i], bx2=base+b.x, topY=HORIZON-b.h;
     ctx.fillStyle='#241238'; ctx.fillRect(bx2,topY,b.w,b.h);
     for(var wy=topY+5; wy<HORIZON-3; wy+=7){ for(var wx=bx2+3; wx<bx2+b.w-2; wx+=6){
       if((wx+wy+i)%3===0){ ctx.fillStyle=b.hue?'#eb648c':'#ebd81b'; ctx.globalAlpha=0.7; ctx.fillRect(wx,wy,2,2.4); ctx.globalAlpha=1; } } }
    }
   }
  }

  function drawPalm(x,base,s){
   ctx.save(); ctx.translate(x,base); ctx.scale(s,s);
   /* trunk */
   ctx.fillStyle='#3a2440';
   ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-6,-92); ctx.lineTo(2,-92); ctx.lineTo(4,0); ctx.closePath(); ctx.fill();
   ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
   for(var ty=-14; ty>-88; ty-=13){ ctx.beginPath(); ctx.moveTo(-6+(-ty*0.02),ty); ctx.lineTo(3,ty+2); ctx.stroke(); }
   /* fronds (silhouette against the sunset) */
   ctx.fillStyle='#241a3a';
   var fr=[[-1.5,-0.2],[-0.9,-1.0],[0.0,-1.4],[0.9,-1.0],[1.5,-0.2],[1.1,0.5],[-1.1,0.5]];
   for(var f=0;f<fr.length;f++){
    ctx.beginPath(); ctx.moveTo(-2,-90);
    ctx.quadraticCurveTo(-2+fr[f][0]*24,-92+fr[f][1]*22,-2+fr[f][0]*40,-90+fr[f][1]*30+8);
    ctx.quadraticCurveTo(-2+fr[f][0]*22,-92+fr[f][1]*12,-2,-86); ctx.closePath(); ctx.fill();
   }
   ctx.restore();
  }
  function drawLamp(x,base,s){
   ctx.save(); ctx.translate(x,base); ctx.scale(s,s);
   ctx.fillStyle='#2a1a3e'; ctx.fillRect(-2,-100,4,100);
   ctx.fillRect(-9,-4,18,4);
   /* lamp head + glow */
   ctx.fillStyle='#1c1030'; env.rr(-7,-110,14,12,3); ctx.fill();
   var gg=ctx.createRadialGradient(0,-104,1,0,-104,16); gg.addColorStop(0,'rgba(245,216,120,0.7)'); gg.addColorStop(1,'rgba(245,216,120,0)');
   ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(0,-104,16,0,6.28); ctx.fill();
   ctx.fillStyle='#f5d878'; env.rr(-4,-107,8,6,2); ctx.fill();
   /* little red star banner */
   ctx.fillStyle='#e0324e'; env.rr(6,-92,18,12,2); ctx.fill();
   ctx.fillStyle=C.YEL; drawStar(15,-86,4);
   ctx.restore();
  }
  function drawStar(x,y,r){
   ctx.beginPath();
   for(var k=0;k<10;k++){ var ang=Math.PI/5*k-Math.PI/2, rr2=(k%2===0)?r:r*0.45;
    var px=x+Math.cos(ang)*rr2, py=y+Math.sin(ang)*rr2; if(k===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
   ctx.closePath(); ctx.fill();
  }
  function drawStations(){
   var off=wrap(worldX*0.45, STN_P);
   for(var base=-off; base<W+STN_P; base+=STN_P){
    for(i=0;i<stations.length;i++){ var s=stations[i], sx=base+s.x;
     if(sx<-40||sx>W+40) continue;
     if(s.kind==='palm') drawPalm(sx, ROAD_TOP+6, s.s); else drawLamp(sx, ROAD_TOP+6, s.s);
    }
   }
  }

  function drawBalustrade(){
   var topY=ROAD_TOP-30, botY=ROAD_TOP+2;
   /* top rail + base rail */
   ctx.fillStyle='#5a4270'; ctx.fillRect(0,topY,W,6);
   ctx.fillStyle='#3e2d54'; ctx.fillRect(0,botY-6,W,8);
   /* balusters (scroll with the road-ish, medium) */
   var P=24, off=wrap(worldX*0.6, P);
   ctx.fillStyle='#4a3563';
   for(var x=-off; x<W+P; x+=P){ ctx.fillRect(x, topY+6, 8, botY-6-(topY+6));
    ctx.fillStyle='#5a4270'; ctx.fillRect(x-2, topY+6, 12, 4); ctx.fillStyle='#4a3563'; }
   /* warm rim light on the top rail */
   ctx.fillStyle='rgba(245,180,110,0.35)'; ctx.fillRect(0,topY,W,2);
  }

  function drawRoad(){
   /* asphalt */
   var g=ctx.createLinearGradient(0,ROAD_TOP,0,ROAD_BOT);
   g.addColorStop(0,'#2a2136'); g.addColorStop(0.5,'#241b30'); g.addColorStop(1,'#1c1528');
   ctx.fillStyle=g; ctx.fillRect(0,ROAD_TOP,W,ROAD_H);
   /* curb highlight at the top edge */
   ctx.fillStyle='#6a4d86'; ctx.fillRect(0,ROAD_TOP,W,3);
   ctx.fillStyle='rgba(235,216,27,0.5)'; ctx.fillRect(0,ROAD_TOP+3,W,1);
   /* dashed lane dividers (fastest scroll) */
   var period=54, dash=30, off=wrap(worldX,period);
   ctx.fillStyle='rgba(245,205,150,0.8)';
   for(var b=1;b<LANES;b++){
    var y=ROAD_TOP+LANE_H*b-2;
    for(var x=-off; x<W; x+=period){ ctx.fillRect(x, y, dash, 4); }
   }
   /* bottom edge line */
   ctx.fillStyle='rgba(235,216,27,0.45)'; ctx.fillRect(0,ROAD_BOT-3,W,3);
  }

  /* ---- entities ---- */
  function drawEntities(){
   for(i=0;i<objs.length;i++){ var o=objs[i];
    if(o.type==='power'){ if(!o.done) drawPower(o); }
    else if(o.type==='hazard'){ drawHazard(o); }
   }
  }

  function drawPower(o){
   var x=o.x, y=laneCY(o.lane), s=1+0.08*Math.sin(o.bob+elapsed*8);
   ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
   var g=ctx.createRadialGradient(0,0,2,0,0,24); g.addColorStop(0,'rgba(235,216,27,0.55)'); g.addColorStop(1,'rgba(235,216,27,0)');
   ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,24,0,6.28); ctx.fill();
   ctx.fillStyle='#1c1330'; env.rr(-12,-15,24,30,6); ctx.fill();
   ctx.fillStyle=C.YEL; env.rr(-4,-19,8,5,2); ctx.fill();
   ctx.fillStyle=C.YEL; ctx.beginPath(); ctx.moveTo(3,-10); ctx.lineTo(-6,2); ctx.lineTo(-1,2); ctx.lineTo(-4,12); ctx.lineTo(6,-3); ctx.lineTo(1,-3); ctx.closePath(); ctx.fill();
   ctx.restore();
  }

  function drawHazard(o){
   /* NO floating signboards — everything lives INSIDE the flagged lane:
      an asphalt ramp deck forking off, hazard stripes at the fork point,
      pulsing chevrons, and a small label painted flat ON the deck. */
   var k,lane;
   for(k=0;k<o.lanes.length;k++){
    lane=o.lanes[k];
    var cy=laneCY(lane), top=cy-LANE_H/2+3, bot=cy+LANE_H/2-3;
    var edge=(lane===0||lane===2);
    var pulse=0.28+0.22*Math.sin(elapsed*7);
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x-52,top,150,bot-top); ctx.clip();   /* stay in the lane band */
    /* ramp deck — its own piece of road angling away from the fork */
    ctx.fillStyle=edge?'#463049':'#3b3260';
    ctx.beginPath();
    ctx.moveTo(o.x-6,top+3); ctx.lineTo(o.x+92,top+3); ctx.lineTo(o.x+92,bot-3); ctx.lineTo(o.x-6,bot-3);
    ctx.closePath(); ctx.fill();
    /* the deck's own dashed centreline, angling off to sell the fork */
    ctx.strokeStyle='rgba(255,240,200,0.7)'; ctx.lineWidth=3; ctx.setLineDash([10,9]);
    ctx.beginPath();
    if(edge){ var dy=(lane===0?-1:1)*10; ctx.moveTo(o.x+2,cy); ctx.quadraticCurveTo(o.x+46,cy+dy,o.x+90,cy+dy*1.8); }
    else { ctx.moveTo(o.x+2,cy); ctx.lineTo(o.x+90,cy); }
    ctx.stroke(); ctx.setLineDash([]);
    /* middle lane = flyover: side rails rising over the road */
    if(!edge){
     ctx.strokeStyle='#8a80b8'; ctx.lineWidth=3;
     ctx.beginPath(); ctx.moveTo(o.x+2,top+5); ctx.lineTo(o.x+90,top+2); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(o.x+2,bot-5); ctx.lineTo(o.x+90,bot-2); ctx.stroke();
    }
    /* hazard stripes at the fork point */
    for(var st=0;st<5;st++){
     ctx.fillStyle=(st%2===0)?C.YEL:'#1c1330';
     ctx.fillRect(o.x-8, top+4+st*((bot-top-8)/5), 7, (bot-top-8)/5);
    }
    /* label painted flat on the deck */
    ctx.globalAlpha=0.85; ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.font='9px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(edge?'exit':'flyover', o.x+48, cy-(edge?12:0)*(lane===0?-1:1));
    ctx.globalAlpha=1;
    /* pulsing chevrons rushing toward the car */
    ctx.globalAlpha=0.4+pulse; ctx.strokeStyle=C.YEL; ctx.lineWidth=4; ctx.lineJoin='round';
    for(var chx=o.x-30; chx<o.x+44; chx+=22){ ctx.beginPath(); ctx.moveTo(chx,cy-13); ctx.lineTo(chx-12,cy); ctx.lineTo(chx,cy+13); ctx.stroke(); }
    ctx.restore();
   }
  }

  /* ---- the star: Jahnvi's purple Lambo convertible (SIDE VIEW, facing right) ---- */
  function drawCar(){
   var cx=CAR_X, cy=carY;
   var tilt=Math.max(-0.16,Math.min(0.16,(carY-prevY)*0.03));
   var bob=Math.sin(elapsed*9)*0.6;

   /* ground shadow (unrotated) */
   ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(cx,cy+30,72,12,0,0,6.28); ctx.fill();

   ctx.save(); ctx.translate(cx,cy+bob); ctx.rotate(tilt);

   if(carImg&&carImg.ok){
    try{
     /* keep the sprite's own aspect (no squish) — ~150px wide, wheels near y=36 */
     var iw=carImg.img.naturalWidth||carImg.img.width||150,
         ih=carImg.img.naturalHeight||carImg.img.height||92,
         dw=150, dh=dw*ih/iw;
     ctx.drawImage(carImg.img,-dw/2,36-dh,dw,dh); ctx.restore(); drawSpeedLines(cx,cy); return;
    }catch(e){}
   }

   /* ===== vector fallback: side-view purple wedge supercar, facing right ===== */
   /* wheels */
   ctx.fillStyle='#0d0a14';
   ctx.beginPath(); ctx.arc(-38,22,15,0,6.28); ctx.fill();
   ctx.beginPath(); ctx.arc(40,22,15,0,6.28); ctx.fill();
   ctx.fillStyle='#2a2036';
   ctx.beginPath(); ctx.arc(-38,22,7,0,6.28); ctx.fill();
   ctx.beginPath(); ctx.arc(40,22,7,0,6.28); ctx.fill();

   /* lower body / sill */
   ctx.fillStyle='#3a1f78';
   ctx.beginPath(); ctx.moveTo(-58,12); ctx.lineTo(60,12); ctx.lineTo(56,26); ctx.lineTo(-54,26); ctx.closePath(); ctx.fill();

   /* main wedge body (low nose right, rising cabin left-centre) */
   var body=ctx.createLinearGradient(0,-24,0,20);
   body.addColorStop(0,'#7b3ff2'); body.addColorStop(0.55,'#6a2fd0'); body.addColorStop(1,'#4a1f9e');
   ctx.fillStyle=body;
   ctx.beginPath();
   ctx.moveTo(-60,12);            /* rear-bottom */
   ctx.lineTo(-58,-6);            /* rear haunch */
   ctx.lineTo(-30,-14);           /* behind cockpit */
   ctx.lineTo(2,-16);             /* windshield base */
   ctx.lineTo(30,-4);             /* hood */
   ctx.lineTo(64,-1);             /* pointed nose (right) */
   ctx.lineTo(62,12);
   ctx.closePath(); ctx.fill();

   /* rear haunch shade + intake */
   ctx.fillStyle='rgba(20,8,40,0.4)';
   ctx.beginPath(); ctx.moveTo(-58,-6); ctx.lineTo(-40,-11); ctx.lineTo(-36,8); ctx.lineTo(-56,10); ctx.closePath(); ctx.fill();
   /* door crease */
   ctx.strokeStyle='rgba(20,8,40,0.5)'; ctx.lineWidth=1.5;
   ctx.beginPath(); ctx.moveTo(-30,-12); ctx.lineTo(-18,10); ctx.stroke();
   /* top sheen */
   ctx.fillStyle='rgba(255,255,255,0.12)';
   ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(28,-4); ctx.lineTo(24,-1); ctx.lineTo(-2,-11); ctx.closePath(); ctx.fill();

   /* open cockpit well + low wraparound windshield */
   ctx.fillStyle='#160b26'; env.rr(-30,-14,34,10,4); ctx.fill();
   ctx.strokeStyle='#8a5adf'; ctx.lineWidth=2;
   ctx.beginPath(); ctx.moveTo(2,-16); ctx.lineTo(10,-24); ctx.lineTo(14,-14); ctx.stroke();

   /* ---- Jahnvi driving (profile, facing right) ---- */
   /* torso in purple sequin top */
   ctx.fillStyle='#8a45d6'; env.rr(-20,-20,16,16,5); ctx.fill();
   ctx.fillStyle=C.YEL;
   var sp=[[-16,-16],[-12,-12],[-17,-11],[-9,-15]];
   for(i=0;i<sp.length;i++){ ctx.globalAlpha=0.55+0.45*Math.sin(elapsed*6+i); ctx.beginPath(); ctx.arc(sp[i][0],sp[i][1],1.3,0,6.28); ctx.fill(); }
   ctx.globalAlpha=1;
   /* head (facing right) */
   ctx.fillStyle='#e8b088'; ctx.beginPath(); ctx.arc(-8,-26,7,0,6.28); ctx.fill();
   /* long brown hair streaming back (left) in the wind */
   ctx.fillStyle='#5c3417';
   ctx.beginPath(); ctx.moveTo(-10,-32); ctx.quadraticCurveTo(-26,-30,-30,-18);
   ctx.quadraticCurveTo(-22,-22,-12,-22); ctx.quadraticCurveTo(-14,-28,-10,-32); ctx.closePath(); ctx.fill();
   ctx.fillStyle='#6b3e1c';
   ctx.beginPath(); ctx.moveTo(-11,-30); ctx.quadraticCurveTo(-24,-26,-28,-19); ctx.quadraticCurveTo(-20,-24,-11,-25); ctx.closePath(); ctx.fill();
   /* sunglasses */
   ctx.fillStyle='#100a18'; env.rr(-6,-28,8,4,2); ctx.fill();
   ctx.fillStyle='rgba(235,100,140,0.5)'; ctx.fillRect(-5,-27,3,1.4);
   /* arm to the wheel */
   ctx.strokeStyle='#e8b088'; ctx.lineWidth=3; ctx.lineCap='round';
   ctx.beginPath(); ctx.moveTo(-8,-16); ctx.lineTo(4,-10); ctx.stroke(); ctx.lineCap='butt';

   /* rear spoiler + taillight (left) */
   ctx.fillStyle='#2a1546'; ctx.fillRect(-64,-8,8,4);
   ctx.fillStyle='#ff5a8a'; ctx.globalAlpha=0.6+0.4*Math.sin(elapsed*10);
   ctx.fillRect(-60,-4,5,5); ctx.globalAlpha=1;
   /* headlight (right, pointing forward) */
   ctx.fillStyle='#f7efc0'; ctx.beginPath(); ctx.moveTo(60,-1); ctx.lineTo(64,1); ctx.lineTo(60,4); ctx.closePath(); ctx.fill();

   ctx.restore();
   drawSpeedLines(cx,cy);
  }
  function drawSpeedLines(cx,cy){
   /* little motion streaks trailing behind the car */
   ctx.strokeStyle='rgba(245,205,150,0.4)'; ctx.lineWidth=2;
   var t=elapsed*speed;
   for(var s=0;s<4;s++){ var yy=cy-16+s*10, len=18+ (Math.sin(t*0.05+s)*6+8);
    var xx=cx-58 - (wrap(t*0.4+s*40, 60));
    ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx-len,yy); ctx.stroke(); }
  }

  /* =====================================================================
     HUD
     ===================================================================== */
  function drawHUD(){
   /* power meter pill */
   var bx=16,by=14,bw=240,bh=22;
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(bx-6,by-6,bw+12,bh+12,11); ctx.fill();
   ctx.fillStyle=C.YEL; ctx.font='14px '+PIXEL; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('⚡',bx+2,by+bh/2);
   var tx=bx+26, tw=bw-26;
   ctx.fillStyle='rgba(255,255,255,0.14)'; env.rr(tx,by,tw,bh,7); ctx.fill();
   var frac=power/POWER_MAX; if(frac<0)frac=0;
   var pg=ctx.createLinearGradient(tx,0,tx+tw,0);
   if(frac>0.35){ pg.addColorStop(0,'#6fc36f'); pg.addColorStop(1,'#ebd81b'); }
   else { pg.addColorStop(0,'#eb648c'); pg.addColorStop(1,'#ec642a'); }
   ctx.fillStyle=pg;
   if(frac>0){ ctx.save(); env.rr(tx,by,tw,bh,7); ctx.clip(); ctx.fillRect(tx,by,tw*frac,bh); ctx.restore(); }
   if(frac<0.28 && Math.sin(elapsed*10)>0){ ctx.strokeStyle=C.PINK; ctx.lineWidth=2; env.rr(tx,by,tw,bh,7); ctx.stroke(); }

   /* clout pill */
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(W-146,10,136,30,11); ctx.fill();
   ctx.fillStyle=C.SOFT; ctx.font='13px '+PIXEL; ctx.textAlign='right'; ctx.textBaseline='middle';
   ctx.fillText('★ '+Math.round(clout), W-18, 26);

   /* incoming-ramp nudge */
   if(pending&&pending.type==='hazard'){
    ctx.fillStyle=C.YEL; ctx.font='11px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('dodge the ramping lane ▸ stay safe', W/2, 62);
   }

   /* centre feedback flash */
   if(flash){
    var a=1-flash.t/flash.life;
    ctx.globalAlpha=a; ctx.fillStyle=flash.color; ctx.font='20px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(flash.text, W/2, 230-flash.t*30); ctx.globalAlpha=1;
   }
  }

  function drawIntro(){
   var a;
   if(elapsed<1) a=1; else a=Math.max(0,1-(elapsed-1)/1.7);
   if(a<=0) return;
   ctx.globalAlpha=a;
   ctx.fillStyle='rgba(11,7,22,0.82)'; ctx.fillRect(0,0,W,H);
   ctx.fillStyle=C.YEL; ctx.font='26px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('okay jahnu', W/2, 210);
   ctx.fillStyle='#fff'; ctx.font='22px '+MONO;
   ctx.fillText('▲ ▼ change lane', W/2, 272);
   ctx.fillText('dodge exits · grab ⚡ · answer right', W/2, 306);
   ctx.fillStyle=C.SOFT; ctx.font='18px '+MONO;
   ctx.fillText('keep the power up ✨', W/2, 352);
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
   drawSky();
   drawSea();
   drawSkyline();
   drawStations();
   drawBalustrade();
   drawRoad();
   drawEntities();
   drawCar();
   drawHUD();
   drawIntro();
  }
  raf=requestAnimationFrame(frame);
 }

 boot();
})();
