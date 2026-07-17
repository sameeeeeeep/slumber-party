/* ============================================================
   THE INNER CIRCLE · LEVEL 3 — "the key to happiness"
   Khushi's PINK speedboat ferry-race at SUNSET. Side view on open
   water, the world scrolls RIGHT→LEFT while khushi holds the left
   third and the water, boosters, obstacles and a big glam pace-
   YACHT ("the ferry") stream past. On base speed alone khushi
   FALLS BEHIND — collecting ⚡ fuel and firing boosts (stacks to
   3x) is how you keep pace and beat it to the golden KEY 🔑.
   Hitting an obstacle costs speed AND a banked boost. Lane speeds
   are shown as traffic-light beacons at each lane's right edge
   (green = fast, orange = mid, red = slow; blinks the upcoming
   colour ~1s before a change). It ENDS (win or lose); not infinite.

   Self-registers into the shell (assets/vault.js) via
   window.__innerCircle.register. Draws everything on env.ctx.

   Optional art it will use IF present (vector fallback always):
     assets/khushi-face.png       — her pixel headshot (on the boat)
     assets/vault/khushi-boat.png — full boat sprite (drawn instead)
     assets/vault/sea-bg.png      — seamless sunset seaside backdrop
   ============================================================ */
(function(){ 'use strict';

 function boot(){
  if(!(window.__innerCircle&&window.__innerCircle.register)){ return setTimeout(boot,120); }
  window.__innerCircle.register({
   n:3, key:'key', title:'the key to happiness', sub:'race the ferry. beat it to the key.', playable:true,
   start:startLevel
  });
 }

 function startLevel(env){
  var ctx=env.ctx, C=env.colors, W=env.W, H=env.H;
  var PIXEL=env.PIXEL, MONO=env.MONO;

  /* ---- world geometry (square canvas) ---- */
  var HORIZON=250;                 /* sky above, sea below */
  var SEA_TOP=HORIZON, SEA_BOT=H;
  var LANES=3;
  var LANE_TOP=310, LANE_BOT=560;  /* the drivable band of water */
  var LANE_H=(LANE_BOT-LANE_TOP)/LANES;
  function laneCY(i){ return LANE_TOP + LANE_H*(i+0.5); }
  function nearestLaneByY(y){ var i=Math.round((y-LANE_TOP)/LANE_H - 0.5); return i<0?0:(i>LANES-1?LANES-1:i); }
  var BOAT_X=170;                  /* khushi holds the left third */

  /* ---- optional art (guarded; vector fallback until/if loaded) ---- */
  var faceImg=env.loadImage('assets/khushi-face.png');
  var boatImg=env.loadImage('assets/vault/khushi-boat.png');
  var seaImg =env.loadImage('assets/vault/sea-bg.png');

  /* ---- pixels-per-knot mapping for on-screen scroll ---- */
  var WORLDPX=3.4;

  /* ---- race distances ---- */
  var COURSE=4200;                 /* finish line distance */
  var khDist=0, feDist=0;          /* khushi & ferry progress along course */

  /* ---- khushi speed model (bleeds down — boost is her real engine) ---- */
  var speed=72;                    /* current knots */
  var MINSPD=30, MAXSPD=150;
  var GLOBAL_DECAY=12;             /* bleed per second — lanes alone can't hold ferry pace */
  var LANE_PULL=2.0;               /* how hard the lane current tugs speed */

  /* ---- the shifting water lanes (every change telegraphs ~1s) ---- */
  var laneSpeed=[], laneTarget=[], laneTele=[], lanePend=[], lanePhase=[];
  (function(){ for(var i=0;i<LANES;i++){ var s=50+Math.random()*26; laneSpeed[i]=s; laneTarget[i]=s; laneTele[i]=0; lanePend[i]=0; lanePhase[i]=Math.random()*600; } })();
  var laneTimer=2.0;               /* until next lane shuffle */

  /* ---- boost: collect ⚡ → ammo; fire ANY time for a burst (stacks 2x→3x) ---- */
  var boostMult=1;
  var boosts=2, BOOST_MAX=5;       /* start with a couple in the tank */
  var boostActive=0;               /* seconds left on the current burst */
  var fireCd=0;                    /* tiny debounce: one tap = one boost */
  var noBoostFlash=0;              /* brief "no fuel" nudge when firing empty */

  /* ---- the ferry (pace rival — a glam yacht, and it's QUICK) ---- */
  var feSpeedBase=82;              /* > khushi's sustainable base pace on purpose */
  var feX=W*0.66, feBob=0;

  /* ---- entities streaming past ---- */
  var obs=[];                      /* {type:'buoy'|'wood'|'wake', lane, x, hit, spin} */
  var pick=[];                     /* {lane, x, got, bob} boosters */
  var obTimer=2.6, pkTimer=1.5;

  /* ---- run state ---- */
  var clout=0, pickups=0, combo=0, boostsFired=0;
  var elapsed=0, over=false, won=false, raf=0, last=0;
  var GRACE=1.6;                   /* no obstacles before this */
  var boatY=laneCY(1), curLane=1;
  var flash=null;                  /* {text,color,t,life,y} */
  var splash=null;                 /* {x,y,t} */
  var shake=0;

  /* ---- backdrop scroll (seamless loop, right→left) ---- */
  var bgX=0;

  /* ---- dusk clouds (fallback sky only; parallax, wrap around) ---- */
  var clouds=[]; (function(){ for(var i=0;i<5;i++){ clouds.push({ x:Math.random()*W, y:26+Math.random()*120, s:0.7+Math.random()*0.9, sp:6+Math.random()*10 }); } })();
  /* fallback skyline — PERIODIC strip so it tiles seamlessly via modulo */
  var skyline=[], SKY_P=0;
  (function(){ var x=0;
   while(x<720){ var bw=24+Math.random()*40, bh=34+Math.random()*84; skyline.push({ x:x, w:bw, h:bh }); x+=bw+4+Math.random()*12; }
   SKY_P=x;
  })();
  /* fixed sparkle points on the game sea (warm sunset glints) */
  var glints=[]; (function(){ for(var i=0;i<40;i++){ glints.push({ x:Math.random()*W, y:LANE_TOP-8+Math.random()*(SEA_BOT-LANE_TOP-6), ph:Math.random()*6.28 }); } })();

  /* ---- lane-light palette (traffic beacons) ---- */
  var LIGHT={ fast:{hex:'#6fc36f', glow:'rgba(111,195,111,'},
              mid :{hex:'#ff9a3d', glow:'rgba(255,154,61,'},
              slow:{hex:'#e23b57', glow:'rgba(226,59,87,'} };

  /* =====================================================================
     input — discrete lane change + fire-anytime boost
     ===================================================================== */
  function laneUp(){ if(curLane>0){ curLane--; env.snd.swerve(); } }
  function laneDown(){ if(curLane<LANES-1){ curLane++; env.snd.swerve(); } }
  env.onPress(function(name){
   if(over){ return; }
   if(name==='up') laneUp();
   else if(name==='down') laneDown();
   else if(name==='action'||name==='enter'||name==='tap') fireBoost();
  });
  env.touchControls([
   { label:'▲', onPress:function(){ if(!over) laneUp(); } },
   { label:'▼', onPress:function(){ if(!over) laneDown(); } },
   { label:'🚀 boost', onPress:function(){ if(!over) fireBoost(); } }
  ]);

  function fireBoost(){
   if(over) return;
   if(fireCd>0) return;                            /* debounce a single tap */
   if(boosts<=0){ noBoostFlash=0.8; env.snd.tick(); return; }   /* empty tank — harmless nudge */
   boosts--; fireCd=0.25; boostsFired++;
   /* each boost tops up speed and stacks the multiplier toward a 3x cap */
   boostMult=Math.min(3.0, Math.max(boostMult,1)+1.05);
   boostActive=Math.max(boostActive,1.5);
   speed=Math.min(MAXSPD, speed+20);
   clout+=10; shake=Math.max(shake,6); env.snd.iconic();
   var lvl=boostMult>=2.9?'3x':(boostMult>=1.9?'2x':'go');
   setFlash('🚀 '+lvl+'!', boostMult>=2.9?C.GREEN:C.YEL, 250);
  }

  function setFlash(text,color,y){ flash={ text:text, color:color, t:0, life:1.0, y:y||250 }; }

  /* =====================================================================
     the lane director — every few seconds a lane speeds up or slows;
     EVERY change telegraphs ~1s (its beacon blinks the upcoming colour).
     ===================================================================== */
  function shuffleLanes(){
   var l=Math.floor(Math.random()*LANES);
   var faster=Math.random()<0.6;
   lanePend[l]= faster ? Math.min(112, 84+Math.random()*18)   /* a hot current */
                       : (46+Math.random()*16);               /* goes sluggish */
   laneTele[l]=1.0;                                            /* blink first */
   laneTimer=1.9+Math.random()*1.3;
  }

  /* =====================================================================
     obstacle & booster spawners
     ===================================================================== */
  function spawnObstacle(){
   /* pick 1 (sometimes 2 once things heat up) lanes, always leave a safe one */
   var order=[0,1,2];
   for(var s=order.length-1;s>0;s--){ var j=Math.floor(Math.random()*(s+1)); var t=order[s]; order[s]=order[j]; order[j]=t; }
   var two=elapsed>24 && Math.random()<0.25;
   var n=two?2:1;
   for(var k=0;k<n;k++){
    var kinds=['buoy','wood','wake'];
    var kind=kinds[Math.floor(Math.random()*kinds.length)];
    obs.push({ type:kind, lane:order[k], x:W+50+k*46, hit:false, spin:Math.random()*6.28 });
   }
   obTimer=1.7+Math.random()*1.3;
  }
  function spawnBooster(){
   /* ⚡ fuel gives a boost charge — spawn often & lean toward the fast lane */
   var best=0; for(var i=1;i<LANES;i++){ if(laneSpeed[i]>laneSpeed[best]) best=i; }
   var lane = Math.random()<0.55 ? best : Math.floor(Math.random()*LANES);
   pick.push({ lane:lane, x:W+40, got:false, bob:Math.random()*6.28 });
   pkTimer=2.2+Math.random()*1.4;
  }

  /* =====================================================================
     endings — env.end called exactly once
     ===================================================================== */
  function endWin(){ if(over) return; over=true; won=true;
   clout+=300;
   clout+=Math.max(0, Math.round((58-elapsed)*8));   /* faster win = fatter bonus */
   env.snd.win(); setFlash('you got the key 🔑✨', C.YEL, 250); shake=10;
   env.end(clout, 'you got the key 🔑✨');
  }
  function endNoKey(){ if(over) return; over=true;
   env.snd.sorry(); env.end(clout, 'so close — the ferry got there first');
  }
  function endBehind(){ if(over) return; over=true;
   env.snd.sorry(); env.end(clout, 'the ferry left you behind 🛥️');
  }

  /* =====================================================================
     update
     ===================================================================== */
  function update(dt){
   elapsed+=dt;

   /* backdrop drifts right→left, slightly faster when khushi flies */
   bgX+=(14+speed*boostMult*0.05)*dt;

   /* dusk clouds drift left (fallback sky), wrapping around */
   for(var ci=0;ci<clouds.length;ci++){ var cl=clouds[ci]; cl.x-=cl.sp*dt;
    if(cl.x<-70){ cl.x=W+50+Math.random()*80; cl.y=26+Math.random()*120; } }

   if(fireCd>0) fireCd=Math.max(0,fireCd-dt);
   if(noBoostFlash>0) noBoostFlash=Math.max(0,noBoostFlash-dt);
   if(boostActive>0) boostActive=Math.max(0,boostActive-dt);
   if(shake>0) shake=Math.max(0,shake-dt*22);

   /* --- lanes shuffle + ease --- */
   laneTimer-=dt; if(laneTimer<=0) shuffleLanes();
   for(var i=0;i<LANES;i++){
    if(laneTele[i]>0){ laneTele[i]-=dt; if(laneTele[i]<=0){ laneTarget[i]=lanePend[i]; lanePend[i]=0; laneTele[i]=0; } }
    laneSpeed[i]+=(laneTarget[i]-laneSpeed[i])*Math.min(1,dt*1.6);
    /* lanes also gently drift down on their own so nothing stays hot forever */
    laneTarget[i]=Math.max(44, laneTarget[i]-dt*5);
    /* integrate each lane's streak scroll so the flow never jumps */
    lanePhase[i]+=laneSpeed[i]*WORLDPX*dt;
   }

   /* --- khushi speed: pulled by her lane's current, always bleeding --- */
   var vis=nearestLaneByY(boatY);
   var target=laneSpeed[vis];
   if(target>speed) speed += (target-speed)*Math.min(1,dt*LANE_PULL);
   speed -= GLOBAL_DECAY*dt;
   if(speed<MINSPD) speed=MINSPD; if(speed>MAXSPD) speed=MAXSPD;

   /* boost multiplier holds during the burst, then eases back to 1 */
   if(boostActive<=0) boostMult += (1-boostMult)*Math.min(1,dt*2.6);

   var eff=speed*boostMult;                 /* effective forward speed */
   var worldSpd=eff*WORLDPX;                /* px/s that the world streams left */

   /* --- progress along the course (the ferry outpaces base speed) --- */
   khDist += eff*dt;
   feDist += (feSpeedBase + elapsed*0.26)*dt;

   /* boat vertical tween toward its lane (never teleport) */
   var ty=laneCY(curLane);
   boatY += (ty-boatY)*Math.min(1,dt*10);

   /* --- ferry on-screen X reflects khushi-vs-ferry gap --- */
   feBob+=dt;
   var gap=feDist-khDist;                   /* +ve = ferry ahead */
   var feTargetX=W*0.58 + gap*0.34;         /* drifts right as you fall behind */
   feX += (feTargetX-feX)*Math.min(1,dt*2.2);
   if(feX>W+170){ endBehind(); return; }    /* ferry off the right edge → LOSE */

   /* --- directors --- */
   if(elapsed>GRACE){
    obTimer-=dt; if(obTimer<=0) spawnObstacle();
    pkTimer-=dt; if(pkTimer<=0) spawnBooster();
   }

   /* --- advance boosters (swept band so fast scroll can't tunnel past) --- */
   for(i=pick.length-1;i>=0;i--){ var p=pick[i]; var opx=p.x; p.x-=worldSpd*dt;
    if(!p.got && p.x<=BOAT_X+34 && opx>=BOAT_X-34 && nearestLaneByY(boatY)===p.lane){
     p.got=true; if(boosts<BOOST_MAX) boosts++; speed=Math.min(MAXSPD,speed+10);
     pickups++; combo++;
     var gain=5+3*Math.min(5,combo-1); clout+=gain;
     env.snd.coin();
     setFlash(combo>1?('+boost x'+combo+' ⚡'):'+boost 🚀', C.YEL, laneCY(p.lane)); }
    if(p.x<-50) pick.splice(i,1);
   }
   /* --- advance obstacles (swept band so fast scroll can't tunnel past) --- */
   for(i=obs.length-1;i>=0;i--){ var o=obs[i]; var oox=o.x; o.x-=worldSpd*dt;
    if(!o.hit && o.x<=BOAT_X+30 && oox>=BOAT_X-30 && nearestLaneByY(boatY)===o.lane){
     o.hit=true; speed=Math.max(MINSPD, speed*0.72 - 4); boostMult=1; boostActive=0;
     var lostBoost = boosts>0;
     boosts=Math.max(0,boosts-1);            /* a hit BURNS a banked boost */
     combo=0;
     feDist+=32;                              /* and shoves you behind */
     splash={ x:BOAT_X+26, y:boatY, t:0 }; env.snd.bad(); shake=Math.max(shake,lostBoost?11:8);
     setFlash(lostBoost?'lost a boost! 💥':'splash! 💦', C.PINK, boatY-40); }
    if(o.x<-60) obs.splice(i,1);
   }

   if(splash){ splash.t+=dt; if(splash.t>0.5) splash=null; }
   if(flash){ flash.t+=dt; if(flash.t>=flash.life) flash=null; }

   /* --- clout from ground covered --- */
   clout += eff*dt*0.05;

   /* --- finish checks --- */
   if(khDist>=COURSE){ endWin(); return; }
   if(feDist>=COURSE){ endNoKey(); return; }
  }

  /* =====================================================================
     drawing — sunset backdrop (looping) + game sea on top
     ===================================================================== */
  function drawBackdrop(){
   if(seaImg&&seaImg.ok){
    try{
     /* seamless-looping wide sunset backdrop; scale so its promenade
        lands just above the play lanes, scroll via modulo, TWO draws */
     var iw=seaImg.img.width||3028, ih=seaImg.img.height||1344;
     var dh=470, dw=Math.round(dh*iw/ih);           /* ≈1059 logical px wide */
     var off=Math.floor(bgX%dw);
     ctx.drawImage(seaImg.img, -off, 0, dw, dh);
     ctx.drawImage(seaImg.img, dw-off-1, 0, dw, dh); /* 1px overlap kills any seam */
     /* deep dusk sea below the image so there's no hard cut line */
     var ug=ctx.createLinearGradient(0,dh-6,0,SEA_BOT);
     ug.addColorStop(0,'rgba(21,12,40,0)'); ug.addColorStop(0.12,'#241543'); ug.addColorStop(1,'#150c28');
     ctx.fillStyle=ug; ctx.fillRect(0,dh-6,W,SEA_BOT-dh+6);
     return;
    }catch(e){}
   }
   /* ---- procedural fallback: SAME sunset palette (no daytime blue) ---- */
   var g=ctx.createLinearGradient(0,0,0,HORIZON+16);
   g.addColorStop(0,'#2a1a4a'); g.addColorStop(0.45,'#7c3a76'); g.addColorStop(0.78,'#c94f6d'); g.addColorStop(1,'#ff9a4d');
   ctx.fillStyle=g; ctx.fillRect(0,0,W,HORIZON+16);
   /* a few dusk stars up top */
   ctx.fillStyle='rgba(255,255,255,0.5)';
   ctx.fillRect(64,26,2,2); ctx.fillRect(236,44,2,2); ctx.fillRect(420,22,2,2); ctx.fillRect(540,58,2,2);
   /* pink dusk clouds */
   for(var i=0;i<clouds.length;i++){ drawCloud(clouds[i]); }
   /* looping city skyline silhouette (periodic strip, modulo scroll) */
   var off2=Math.floor((bgX*0.6)%SKY_P);
   ctx.fillStyle='#241238';
   for(var pass=0;pass<2;pass++){
    for(var b=0;b<skyline.length;b++){ var bd=skyline[b];
     var bx=bd.x-off2+pass*SKY_P;
     if(bx>W+10||bx+bd.w<-10) continue;
     ctx.fillRect(bx,HORIZON-bd.h,bd.w,bd.h);
     /* a few warm lit windows */
     ctx.fillStyle='rgba(255,207,110,0.85)';
     for(var wy=HORIZON-bd.h+8; wy<HORIZON-10; wy+=16){
      if(((b*7+wy)|0)%3===0) ctx.fillRect(bx+5,wy,3,4);
      if(((b*5+wy)|0)%4===0) ctx.fillRect(bx+bd.w-9,wy,3,4);
     }
     ctx.fillStyle='#241238';
    }
   }
   /* promenade strip */
   ctx.fillStyle='#3b2350'; ctx.fillRect(0,HORIZON,W,16);
   ctx.fillStyle='#5a3a78'; ctx.fillRect(0,HORIZON,W,3);
   /* sunset sea base under everything below */
   var sg=ctx.createLinearGradient(0,HORIZON+16,0,SEA_BOT);
   sg.addColorStop(0,'#8a3a5e'); sg.addColorStop(0.35,'#3a2456'); sg.addColorStop(1,'#150c28');
   ctx.fillStyle=sg; ctx.fillRect(0,HORIZON+16,W,SEA_BOT-HORIZON-16);
  }
  function drawCloud(c){
   ctx.save(); ctx.translate(c.x,c.y); ctx.scale(c.s,c.s);
   ctx.fillStyle='rgba(245,195,207,0.85)';
   ctx.beginPath(); ctx.arc(-22,4,15,0,6.283); ctx.arc(-2,-4,20,0,6.283); ctx.arc(20,4,16,0,6.283);
   ctx.rect(-22,4,44,14); ctx.fill();
   ctx.restore();
  }

  function drawSea(){
   /* --- dusk-navy play water laid OVER the backdrop so lanes stay readable
      (soft blend at the top lets the backdrop's reflections peek through) --- */
   var og=ctx.createLinearGradient(0,288,0,SEA_BOT);
   og.addColorStop(0,'rgba(26,52,86,0)');
   og.addColorStop(0.18,'rgba(24,48,80,0.78)');
   og.addColorStop(0.55,'rgba(16,34,60,0.94)');
   og.addColorStop(1,'rgba(10,22,42,0.97)');
   ctx.fillStyle=og; ctx.fillRect(0,288,W,SEA_BOT-288);
   /* warm sunset shimmer along the waterline */
   ctx.fillStyle='rgba(255,190,130,'+(0.22+0.1*Math.sin(elapsed*2.2))+')';
   ctx.fillRect(0,289,W,2);

   /* --- span of current lane speeds (drives streak brightness/length) --- */
   var i, l, maxS=1, minS=999;
   for(i=0;i<LANES;i++){ if(laneSpeed[i]>maxS) maxS=laneSpeed[i]; if(laneSpeed[i]<minS) minS=laneSpeed[i]; }
   var spanS=Math.max(1,maxS-minS);

   /* speed streaks — long & bright in fast water, sparse & faint in slow
      (periodic per lane so the flow loops seamlessly) */
   for(l=0;l<LANES;l++){
    var cyc=laneCY(l);
    var rel=(laneSpeed[l]-minS)/spanS;                 /* 0 slow … 1 fast */
    /* fixed streak count (seamless — no pattern pop when rank shifts);
       speed reads through length, brightness and the integrated scroll */
    var streaks=6, period=W/streaks, offx=lanePhase[l]%period, len=14+rel*70;
    ctx.strokeStyle='rgba(255,235,220,'+(0.06+0.32*rel)+')'; ctx.lineWidth=1.5+rel*2.5; ctx.lineCap='round';
    for(var k=-1;k<streaks+1;k++){ var x=W-((k*period+offx)%(W+period));
     ctx.beginPath(); ctx.moveTo(x,cyc); ctx.lineTo(x-len,cyc); ctx.stroke(); }
    ctx.lineCap='butt';
   }

   /* warm sparkle glints on the dusk water */
   for(i=0;i<glints.length;i++){ var gp=glints[i]; var a=0.2+0.3*Math.abs(Math.sin(gp.ph+elapsed*2.4));
    ctx.globalAlpha=a; ctx.fillStyle='#ffd9a0'; ctx.fillRect(gp.x,gp.y,2,2); }
   ctx.globalAlpha=1;

   /* crisp lane dividers */
   ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=1;
   for(l=1;l<LANES;l++){ var yy=LANE_TOP+LANE_H*l; ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(W,yy); ctx.stroke(); }
  }

  /* --- lane speed LIGHTS at the right edge (where things enter):
     green = fast, orange = mid, red = slow. During a telegraph the
     beacon blinks its UPCOMING colour so you can pre-move.
     Drawn as their OWN top pass so the yacht/obstacles never hide them. --- */
  function drawBeacons(){
   var l, fl=0, sl=0;
   for(l=1;l<LANES;l++){ if(laneSpeed[l]>laneSpeed[fl]) fl=l; if(laneSpeed[l]<laneSpeed[sl]) sl=l; }
   var up=[], ufl=0, usl=0;
   for(l=0;l<LANES;l++){ up[l]= laneTele[l]>0 ? lanePend[l] : laneTarget[l]; }
   for(l=1;l<LANES;l++){ if(up[l]>up[ufl]) ufl=l; if(up[l]<up[usl]) usl=l; }
   for(l=0;l<LANES;l++){
    var cur = (l===fl)?LIGHT.fast : (l===sl)?LIGHT.slow : LIGHT.mid;
    var col=cur;
    if(laneTele[l]>0){
     var nxt = (l===ufl)?LIGHT.fast : (l===usl)?LIGHT.slow : LIGHT.mid;
     col = (Math.sin(elapsed*20)>0) ? nxt : cur;      /* ~1s blink telegraph */
    }
    drawBeacon(l, col, l===fl && laneTele[l]<=0);
   }
  }

  function drawBeacon(l, col, hot){
   var cy=laneCY(l), bxc=W-17;
   var pulse=0.5+0.5*Math.sin(elapsed*(hot?9:5)+l*2);
   /* glow halo */
   var g=ctx.createRadialGradient(bxc,cy,2,bxc,cy,22);
   g.addColorStop(0, col.glow+(0.4+0.25*pulse)+')'); g.addColorStop(1, col.glow+'0)');
   ctx.fillStyle=g; ctx.beginPath(); ctx.arc(bxc,cy,22,0,6.283); ctx.fill();
   /* dark pixel housing pill */
   ctx.fillStyle='rgba(11,7,22,0.7)'; env.rr(W-30,cy-13,26,26,5); ctx.fill();
   ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=1; env.rr(W-30,cy-13,26,26,5); ctx.stroke();
   /* the light — an arrow pointing INTO the lane (flow direction) */
   ctx.fillStyle=col.hex;
   ctx.beginPath(); ctx.moveTo(W-9,cy-8); ctx.lineTo(W-9,cy+8); ctx.lineTo(W-25,cy); ctx.closePath(); ctx.fill();
   ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(W-13,cy-2,3,3);   /* pixel spec */
  }

  function drawBooster(p){
   if(p.got) return;
   var y=laneCY(p.lane)+Math.sin(p.bob+elapsed*6)*5;
   ctx.save(); ctx.translate(p.x,y);
   var g=ctx.createRadialGradient(0,0,2,0,0,24); g.addColorStop(0,'rgba(235,216,27,0.6)'); g.addColorStop(1,'rgba(235,216,27,0)');
   ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,24,0,6.283); ctx.fill();
   /* fuel can */
   ctx.fillStyle='#e23b57'; env.rr(-11,-13,22,26,5); ctx.fill();
   ctx.fillStyle='#b8283f'; env.rr(-11,-13,22,7,5); ctx.fill();
   ctx.fillStyle=C.YEL;
   ctx.beginPath(); ctx.moveTo(3,-8); ctx.lineTo(-6,3); ctx.lineTo(-1,3); ctx.lineTo(-4,11); ctx.lineTo(7,-2); ctx.lineTo(1,-2); ctx.closePath(); ctx.fill();
   ctx.restore();
  }

  function drawObstacle(o){
   if(o.hit) return;
   var y=laneCY(o.lane);
   ctx.save(); ctx.translate(o.x,y);
   if(o.type==='buoy'){
    var bob=Math.sin(elapsed*4+o.spin)*3;
    ctx.translate(0,bob);
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0,16,16,5,0,0,6.283); ctx.fill();
    ctx.fillStyle='#e23b57'; env.rr(-12,-6,24,24,7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.fillRect(-12,2,24,6);
    ctx.fillStyle='#c92a44'; ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(-7,-6); ctx.lineTo(7,-6); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffd84d'; ctx.beginPath(); ctx.arc(0,-22,3,0,6.283); ctx.fill();
   } else if(o.type==='wood'){
    ctx.rotate(Math.sin(elapsed*2+o.spin)*0.12);
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0,12,26,6,0,0,6.283); ctx.fill();
    ctx.fillStyle='#7a4a25'; env.rr(-28,-9,56,18,9); ctx.fill();
    ctx.fillStyle='#5c3417'; env.rr(-28,-9,14,18,7); ctx.fill();
    ctx.strokeStyle='#5c3417'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-6,-8); ctx.lineTo(-6,8); ctx.moveTo(8,-8); ctx.lineTo(8,8); ctx.stroke();
    ctx.fillStyle='#8a5a30'; ctx.beginPath(); ctx.arc(-21,0,5,0,6.283); ctx.fill();
   } else {
    var s=1+Math.sin(elapsed*8+o.spin)*0.08;
    ctx.scale(s,s);
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-14,4,12,0,6.283); ctx.arc(2,-2,16,0,6.283); ctx.arc(18,4,12,0,6.283); ctx.fill();
    ctx.fillStyle='rgba(180,220,245,0.7)';
    ctx.beginPath(); ctx.arc(2,2,9,0,6.283); ctx.fill();
   }
   ctx.restore();
  }

  /* ---- THE FERRY — a sleek glam WHITE YACHT, clearly bigger & fancier ---- */
  function drawFerry(){
   var y=HORIZON+56+Math.sin(feBob*1.4)*4;
   ctx.save(); ctx.translate(feX,y);

   /* BIG churning wake trailing left */
   ctx.fillStyle='rgba(255,255,255,0.45)';
   ctx.beginPath(); ctx.moveTo(-118,40); ctx.quadraticCurveTo(-190,46,-262,58);
   ctx.quadraticCurveTo(-190,66,-118,62); ctx.closePath(); ctx.fill();
   ctx.fillStyle='rgba(255,255,255,0.7)';
   for(var wk=0;wk<4;wk++){ var wxp=-126-wk*26, wyp=48+Math.sin(elapsed*9+wk)*4;
    ctx.beginPath(); ctx.arc(wxp,wyp,9-wk*1.6,0,6.283); ctx.fill(); }

   /* sharp white hull with raked bow (prow to the RIGHT) */
   ctx.fillStyle='#f4f7fb';
   ctx.beginPath();
   ctx.moveTo(-120,12); ctx.lineTo(112,12);
   ctx.quadraticCurveTo(152,18,130,50);     /* raked bow sweeping to a point */
   ctx.lineTo(-104,50);
   ctx.quadraticCurveTo(-126,32,-120,12);
   ctx.closePath(); ctx.fill();
   ctx.strokeStyle='#20364f'; ctx.lineWidth=2; ctx.stroke();
   /* navy waterline stripe + gold pinstripe */
   ctx.fillStyle='#20364f'; ctx.fillRect(-110,38,244,8);
   ctx.fillStyle=C.YEL; ctx.fillRect(-110,34,244,3);
   /* hull portholes */
   ctx.fillStyle='#2f4a68';
   for(var px2=-96; px2<96; px2+=26){ ctx.beginPath(); ctx.arc(px2,24,4,0,6.283); ctx.fill(); }

   /* deck 1 — long white superstructure */
   ctx.fillStyle='#ffffff'; env.rr(-102,-20,192,34,8); ctx.fill();
   ctx.strokeStyle='#c8d4e0'; ctx.lineWidth=1.5; env.rr(-102,-20,192,34,8); ctx.stroke();
   /* deck 2 */
   ctx.fillStyle='#eef2f7'; env.rr(-80,-46,142,28,7); ctx.fill();
   ctx.strokeStyle='#c8d4e0'; env.rr(-80,-46,142,28,7); ctx.stroke();
   /* deck 3 — bridge */
   ctx.fillStyle='#e2e9f1'; env.rr(-50,-68,88,24,6); ctx.fill();
   /* raked dark bridge glass */
   ctx.fillStyle='#26405e';
   ctx.beginPath(); ctx.moveTo(30,-66); ctx.lineTo(44,-66); ctx.lineTo(36,-48); ctx.lineTo(26,-48); ctx.closePath(); ctx.fill();

   /* rows of warm LIT windows (sunset cruise) */
   ctx.fillStyle='#ffd478';
   for(var wx=-92; wx<74; wx+=17){ ctx.fillRect(wx,-12,11,12); }
   for(wx=-70; wx<48; wx+=16){ ctx.fillRect(wx,-39,10,11); }
   for(wx=-42; wx<20; wx+=15){ ctx.fillRect(wx,-62,9,9); }
   /* rails along deck edges */
   ctx.strokeStyle='#aebccb'; ctx.lineWidth=1.5;
   ctx.beginPath(); ctx.moveTo(-102,-24); ctx.lineTo(96,-24); ctx.stroke();
   ctx.beginPath(); ctx.moveTo(-80,-50); ctx.lineTo(66,-50); ctx.stroke();
   for(var rx=-98; rx<92; rx+=14){ ctx.beginPath(); ctx.moveTo(rx,-24); ctx.lineTo(rx,-18); ctx.stroke(); }
   for(rx=-76; rx<62; rx+=14){ ctx.beginPath(); ctx.moveTo(rx,-50); ctx.lineTo(rx,-44); ctx.stroke(); }

   /* mast + radar bar + gold flag */
   ctx.strokeStyle='#20364f'; ctx.lineWidth=2.5;
   ctx.beginPath(); ctx.moveTo(-32,-68); ctx.lineTo(-40,-98); ctx.stroke();
   ctx.beginPath(); ctx.moveTo(-48,-88); ctx.lineTo(-30,-88); ctx.stroke();
   ctx.fillStyle=C.YEL; ctx.beginPath(); ctx.moveTo(-40,-98); ctx.lineTo(-22,-93); ctx.lineTo(-40,-88); ctx.closePath(); ctx.fill();

   /* bow spray */
   ctx.fillStyle='rgba(255,255,255,0.8)';
   ctx.beginPath(); ctx.arc(132,38,10,0,6.283); ctx.arc(142,30,7,0,6.283); ctx.fill();
   ctx.restore();

   /* rival label */
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(feX-42,y-126,84,20,6); ctx.fill();
   ctx.fillStyle=C.SOFT; ctx.font='9px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('the ferry', feX, y-116);
  }

  /* ---- KHUSHI on her PINK speedboat (procedural; always renders) ---- */
  function drawBoat(){
   var bx=BOAT_X, by=boatY;
   var useSprite = boatImg && boatImg.ok;
   /* subtle bob + bow lifts (nose up) when planing on a boost */
   var tilt=Math.sin(elapsed*7)*0.02 - (boostMult>1.4? 0.05:0);
   var effAmt=Math.min(1,(speed*boostMult)/120);

   /* churning WAKE / spray trailing to the LEFT — reads as speed.
      The sprite already bakes in its own bow-spray, so when it's in
      use we keep this lighter: just a moving hull wake underneath. */
   ctx.save();
   var wakeLen=70+effAmt*90;
   ctx.fillStyle='rgba(255,255,255,'+(useSprite?0.28:0.55)+')';
   ctx.beginPath();
   ctx.moveTo(bx-30,by+22);
   ctx.quadraticCurveTo(bx-wakeLen*0.6,by+32, bx-wakeLen,by+30+Math.sin(elapsed*10)*4);
   ctx.quadraticCurveTo(bx-wakeLen*0.6,by+42, bx-30,by+34);
   ctx.closePath(); ctx.fill();
   var puffs=useSprite?3:5;
   for(var sp=0;sp<puffs;sp++){ var pxx=bx-24-sp*(12+effAmt*10); var pyy=by+20+Math.sin(elapsed*12+sp)*6;
    ctx.fillStyle='rgba(255,255,255,'+((useSprite?0.4:0.7)-sp*0.12)+')';
    ctx.beginPath(); ctx.arc(pxx,pyy,(useSprite?7:9)-sp*1.2,0,6.283); ctx.fill(); }
   ctx.restore();

   if(useSprite){
    /* side-view pixel sprite (khushi + her own hull, aspect ~2.08:1).
       KEEP the aspect ratio (derive height from the actual sprite so it
       never stretches if re-exported), anchor the hull waterline just
       below the lane centre so she sits ON the water, tilt with speed. */
    var iw=boatImg.img.width||2076, ih=boatImg.img.height||1000;
    var DW=150, DH=DW*ih/iw, drew=false;
    ctx.save(); ctx.translate(bx,by); ctx.rotate(tilt);
    try{ ctx.drawImage(boatImg.img, -DW*0.52, -DH*0.72, DW, DH); drew=true; }catch(e){}
    ctx.restore();                 /* always balance the save, even on throw */
    if(drew) return;
   }

   ctx.save(); ctx.translate(bx,by); ctx.rotate(tilt);

   /* hull shadow on water */
   ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(4,30,64,12,0,0,6.283); ctx.fill();

   /* ---- HULL — pink speedboat, pointed prow to the RIGHT ---- */
   var hull=ctx.createLinearGradient(0,-6,0,30);
   hull.addColorStop(0,'#f78fb0'); hull.addColorStop(0.5,'#eb648c'); hull.addColorStop(1,'#c53f6a');
   ctx.fillStyle=hull;
   ctx.beginPath();
   ctx.moveTo(-58,4);          /* stern top-left */
   ctx.lineTo(46,2);           /* toward prow */
   ctx.quadraticCurveTo(74,8,60,24);   /* pointed prow tip (right) */
   ctx.lineTo(-52,26);         /* stern bottom */
   ctx.quadraticCurveTo(-64,16,-58,4);
   ctx.closePath(); ctx.fill();

   /* white flame decals along the hull side */
   ctx.fillStyle='rgba(255,255,255,0.92)';
   ctx.beginPath();
   ctx.moveTo(-40,18); ctx.quadraticCurveTo(-20,10,6,16);
   ctx.quadraticCurveTo(-4,18,14,18); ctx.quadraticCurveTo(-2,22,-40,22);
   ctx.closePath(); ctx.fill();
   ctx.beginPath();
   ctx.moveTo(14,17); ctx.quadraticCurveTo(30,12,44,17);
   ctx.quadraticCurveTo(34,19,44,20); ctx.quadraticCurveTo(30,21,14,20);
   ctx.closePath(); ctx.fill();

   /* deck / cockpit tub */
   ctx.fillStyle='#8a2f52'; env.rr(-44,-8,74,16,7); ctx.fill();
   ctx.fillStyle='#f5c3cf'; env.rr(-42,-6,70,7,4); ctx.fill();   /* deck rim highlight */

   /* windshield */
   ctx.fillStyle='rgba(150,220,255,0.85)';
   ctx.beginPath(); ctx.moveTo(20,-8); ctx.lineTo(34,-8); ctx.lineTo(30,-20); ctx.lineTo(20,-18); ctx.closePath(); ctx.fill();
   ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();

   /* ---- KHUSHI ---- life vest body + head ---- */
   ctx.fillStyle='#ff8a3d'; env.rr(-14,-20,26,20,7); ctx.fill();
   ctx.fillStyle='#ffb27a'; ctx.fillRect(-4,-20,4,20);
   ctx.strokeStyle='#e06a1e'; ctx.lineWidth=1.4; env.rr(-14,-20,26,20,7); ctx.stroke();
   /* shoulders/arms */
   ctx.fillStyle='#e8b088';
   ctx.beginPath(); ctx.arc(-16,-14,4,0,6.283); ctx.fill();
   ctx.beginPath(); ctx.arc(14,-14,4,0,6.283); ctx.fill();

   /* head — pixel headshot if loaded, else vector */
   var hx=-1, hy=-30, hr=13;
   if(faceImg&&faceImg.ok){
    var faceDrew=false;
    ctx.save();
    ctx.beginPath(); ctx.arc(hx,hy,hr,0,6.283); ctx.closePath(); ctx.clip();
    try{ ctx.drawImage(faceImg.img, hx-hr, hy-hr, hr*2, hr*2); faceDrew=true; }catch(e){}
    ctx.restore();                 /* always pop the clip, even on throw */
    if(faceDrew){ ctx.strokeStyle='#5c3417'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(hx,hy,hr,0,6.283); ctx.stroke(); }
    else drawVectorHead(hx,hy,hr);
   } else {
    drawVectorHead(hx,hy,hr);
   }

   /* windswept hair flick */
   ctx.strokeStyle='#6b3e1c'; ctx.lineWidth=3; ctx.lineCap='round';
   ctx.beginPath(); ctx.moveTo(hx-11,hy-2); ctx.quadraticCurveTo(hx-24,hy-2+Math.sin(elapsed*8)*3,hx-30,hy+4); ctx.stroke();
   ctx.lineCap='butt';

   /* motor at the stern */
   ctx.fillStyle='#3a2b57'; env.rr(-62,-2,10,18,3); ctx.fill();

   ctx.restore();
  }
  function drawVectorHead(hx,hy,hr){
   /* warm-skin face + brown wavy hair fallback */
   ctx.fillStyle='#6b3e1c'; ctx.beginPath(); ctx.arc(hx,hy-1,hr+2,0,6.283); ctx.fill();
   ctx.fillStyle='#e8b088'; ctx.beginPath(); ctx.arc(hx,hy,hr-1,0,6.283); ctx.fill();
   ctx.fillStyle='#6b3e1c';
   ctx.beginPath(); ctx.arc(hx-hr+2,hy+2,4,0,6.283); ctx.arc(hx+hr-2,hy+2,4,0,6.283); ctx.fill();
   ctx.fillStyle='#2a1a2e';
   ctx.beginPath(); ctx.arc(hx-4,hy,1.6,0,6.283); ctx.arc(hx+4,hy,1.6,0,6.283); ctx.fill();
   ctx.strokeStyle='#b06a4a'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(hx,hy+3,4,0.15,2.99); ctx.stroke();
  }

  function drawSplash(){
   if(!splash) return;
   var a=1-splash.t/0.5;
   ctx.globalAlpha=a;
   for(var i=0;i<8;i++){ var ang=i/8*6.283; var d=splash.t*90;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(splash.x+Math.cos(ang)*d, splash.y+Math.sin(ang)*d*0.6, 4*a+1,0,6.283); ctx.fill(); }
   ctx.globalAlpha=1;
  }

  /* =====================================================================
     HUD
     ===================================================================== */
  function drawHUD(){
   /* --- progress-vs-ferry bar (top) --- */
   var px=54, pw=W-108, py=16, ph=14;
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(px-8,py-8,pw+16,ph+16,9); ctx.fill();
   ctx.fillStyle='rgba(255,255,255,0.16)'; env.rr(px,py,pw,ph,7); ctx.fill();
   ctx.font='16px '+MONO; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('🔑', px+pw+16, py+ph/2);                     /* finish key */
   ctx.fillStyle=C.SOFT; ctx.font='10px '+PIXEL; ctx.textAlign='right';
   ctx.fillText('go', px-12, py+ph/2);
   /* khushi progress fill */
   var kf=Math.min(1,khDist/COURSE);
   var kg=ctx.createLinearGradient(px,0,px+pw,0); kg.addColorStop(0,'#f5c3cf'); kg.addColorStop(1,'#eb648c');
   ctx.fillStyle=kg; ctx.save(); env.rr(px,py,pw,ph,7); ctx.clip(); ctx.fillRect(px,py,pw*kf,ph); ctx.restore();
   /* ferry marker (above) + khushi marker (below) */
   var ff=Math.min(1,feDist/COURSE);
   ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.font='14px '+MONO; ctx.fillStyle='#20364f'; ctx.fillText('🛥️', px+pw*ff, py-3);
   ctx.font='13px '+MONO; ctx.fillStyle='#fff'; ctx.fillText('🚤', px+pw*kf, py+ph+9);

   /* --- speed bar (left) --- */
   var sx=16, sy=48, sw=190, sh=18;
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(sx-4,sy-4,sw+8+62,sh+8,8); ctx.fill();
   ctx.fillStyle='rgba(255,255,255,0.14)'; env.rr(sx,sy,sw,sh,6); ctx.fill();
   var sf=Math.min(1,speed/MAXSPD);
   var sg=ctx.createLinearGradient(sx,0,sx+sw,0);
   if(sf>0.5){ sg.addColorStop(0,'#6fc36f'); sg.addColorStop(1,'#ebd81b'); }
   else { sg.addColorStop(0,'#eb648c'); sg.addColorStop(1,'#ec642a'); }
   ctx.fillStyle=sg; ctx.save(); env.rr(sx,sy,sw,sh,6); ctx.clip(); ctx.fillRect(sx,sy,sw*sf,sh);
   if(boostMult>1.3){ ctx.fillStyle='rgba(255,255,255,'+(0.3*Math.abs(Math.sin(elapsed*18)))+')'; ctx.fillRect(sx,sy,sw*sf,sh); }
   ctx.restore();
   ctx.fillStyle='#fff'; ctx.font='13px '+PIXEL; ctx.textAlign='left'; ctx.textBaseline='middle';
   ctx.fillText(Math.round(speed)+'kn', sx+sw+8, sy+sh/2);
   if(boostMult>1.3){ ctx.fillStyle=C.YEL; ctx.font='11px '+PIXEL; ctx.fillText('x'+boostMult.toFixed(1), sx+2, sy-14); }

   /* --- clout (right) --- */
   ctx.fillStyle='rgba(11,7,22,0.55)'; env.rr(W-146,44,132,26,8); ctx.fill();
   ctx.fillStyle=C.YEL; ctx.font='12px '+PIXEL; ctx.textAlign='right'; ctx.textBaseline='middle';
   ctx.fillText('★ '+Math.round(clout), W-20, 57);

   /* --- boost ammo (bottom-centre) --- */
   drawBoostAmmo();

   /* --- feedback flash --- */
   if(flash){
    var fa=Math.min(1, (1-flash.t/flash.life)*1.4);
    ctx.globalAlpha=fa; ctx.fillStyle=flash.color; ctx.font='20px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(flash.text, W/2, flash.y-flash.t*24); ctx.globalAlpha=1;
   }
  }

  function drawBoostAmmo(){
   /* collected ⚡ = boost charges you can fire ANY time (no timing needed).
      Lives in the open sky — NEVER over a lane, so nothing hides behind it. */
   var by=104, r=22, pipW=34, gap=9, n=BOOST_MAX, tot=n*pipW+(n-1)*gap, bx=(W-tot)/2;
   ctx.fillStyle='rgba(11,7,22,0.62)'; env.rr(bx-14,by-26,tot+28,r+42,10); ctx.fill();
   ctx.font='9px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=C.SOFT;
   if(noBoostFlash<=0) ctx.fillText(boosts>0?((env.TOUCH?'tap 🚀':'space')+' — fire boost!'):'grab ⚡ — the ferry won\'t wait', W/2, by-13);
   for(var i=0;i<n;i++){ var px=bx+i*(pipW+gap), on=i<boosts;
    ctx.fillStyle=on?C.YEL:'rgba(255,255,255,0.12)'; env.rr(px,by,pipW,r,6); ctx.fill();
    if(on){ ctx.fillStyle='#3a2b0a'; ctx.font='15px '+MONO; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🚀',px+pipW/2,by+r/2+1); }
   }
   if(noBoostFlash>0){ ctx.globalAlpha=Math.min(1,noBoostFlash*2); ctx.fillStyle=C.PINK;
    ctx.font='11px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('no boost — grab ⚡', W/2, by-13); ctx.globalAlpha=1; }
  }

  /* --- intro "how to" card that fades --- */
  function drawIntro(){
   var a;
   if(elapsed<1.4) a=1; else a=Math.max(0,1-(elapsed-1.4)/1.6);
   if(a<=0) return;
   ctx.globalAlpha=a;
   ctx.fillStyle='rgba(11,7,22,0.8)'; ctx.fillRect(0,0,W,H);
   ctx.fillStyle=C.YEL; ctx.font='24px '+PIXEL; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('the key to happiness', W/2, 210);
   ctx.fillStyle='#fff'; ctx.font='22px '+MONO;
   ctx.fillText((env.TOUCH?'▲ ▼ lane · tap 🚀 boost':'↑ ↓ lane · space = boost'), W/2, 272);
   ctx.fillText('grab ⚡ · ride the green lane', W/2, 306);
   ctx.fillStyle=C.SOFT; ctx.font='18px '+MONO;
   ctx.fillText('beat the ferry to the key 🔑', W/2, 352);
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

   ctx.save();
   if(shake>0.3){ ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); }
   ctx.clearRect(-20,-20,W+40,H+40);
   drawBackdrop();
   drawSea();
   drawFerry();
   var i;
   for(i=0;i<pick.length;i++) drawBooster(pick[i]);
   for(i=0;i<obs.length;i++) drawObstacle(obs[i]);
   drawBoat();
   drawSplash();
   drawBeacons();                    /* lane lights sit ON TOP — never hidden */
   ctx.restore();

   drawHUD();
   drawIntro();
  }
  raf=requestAnimationFrame(frame);
 }

 boot();
})();
