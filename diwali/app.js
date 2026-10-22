(() => {
'use strict';
const C = window.MKD, L = window.MKDLib;
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eo = t => 1 - Math.pow(1 - t, 3);
const eob = t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const rad = d => d * Math.PI / 180;
const rnd = (a, b) => a + Math.random() * (b - a);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

/* ───────────── guest + page content ───────────── */
const qs = new URLSearchParams(location.search);
const NAME = (qs.get('to') || '').trim().replace(/\s+/g, ' ').slice(0, 32) || C.defaultName;
const KEY = (qs.get('k') || '').trim().toLowerCase();
document.querySelectorAll('[data-name]').forEach(e => { e.textContent = NAME; });
document.querySelectorAll('[data-c]').forEach(e => { e.textContent = C.event[e.dataset.c] || ''; });
if (C.event.mapUrl) { const m = $('#map'); m.href = C.event.mapUrl; m.hidden = false; }
$('#wa').href = `https://wa.me/${C.rsvp.whatsapp}?text=${encodeURIComponent(C.rsvp.text.replace('{name}', NAME))}`;
$('#ics').addEventListener('click', () => {
  const f = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ev = C.event;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nailinit//Diwali Party//EN', 'BEGIN:VEVENT',
    'UID:nailinit-diwali-party-2026@nailinit', 'DTSTAMP:' + f(new Date().toISOString()),
    'DTSTART:' + f(ev.start), 'DTEND:' + f(ev.end),
    'SUMMARY:nailinit Diwali Party', `LOCATION:${ev.venue}, ${ev.area}`,
    `DESCRIPTION:Dress code: ${ev.dress}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'nailinit-diwali-party.ics';
  a.click();
});
const STALLS = [['Chai tapri', 'चाय'], ['Kulfi', 'कुल्फी'], ['Gola', 'गोला'], ['Chaat', 'चाट'], ['Pani puri', 'पानी पूरी'],
  ['Vada pav', 'वड़ा पाव'], ['Paan', 'पान'], ['Ganne ka ras', 'गन्ना'], ['Bunta', 'बंटा'], ['Kebab & chaap', 'कबाब'],
  ['Irani bakery', 'बेकरी'], ['Cotton candy', 'बुढ़िया के बाल'], ['Matka rabdi', 'रबड़ी'], ['Nail bar', 'नाखून'],
  ['Jyotish', 'ज्योतिष'], ['Now showing', 'सिनेमा'], ['Bus stop', 'बस स्टॉप'], ['Toffee shop', 'टॉफ़ी'],
  ['Post box', 'डाक'], ['Patang', 'पतंग'], ['Bangles & bindi', 'चूड़ी'], ['Stamp mehendi', 'मेहंदी']];
const chips = list => list.map(([en, hi]) => `<span class="chip">${en}<small>${hi}</small></span>`).join('');
const half = Math.ceil(STALLS.length / 2);
$('#row1').innerHTML = chips(STALLS.slice(0, half)).repeat(2);
$('#row2').innerHTML = chips(STALLS.slice(half)).repeat(2);
const CHATPATI = ['scratch the patriarchy', 'namaslayyyy', 'no nazar, thu thu', 'kabhi khushi, kabhi rum',
  "aao sis, let's chuglyyyy", 'love urself diva', 'coca-patola', 'khushi-khabri', "i'm just a naari", 'nakhre maxxing', 'spicy par pyaari'];
$('#row3').innerHTML = CHATPATI.map(t => `<span>${t}</span>`).join('').repeat(2);

/* ───────────── assets ───────────── */
const IMG = {};
const loadImg = (k, src) => new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = res; i.src = src; });
const CONF = Array.from({ length: 32 }, (_, i) => 'c' + String(i + 1).padStart(2, '0'));
const assetsReady = Promise.all([
  loadImg('env', 'assets/envelope.webp'), loadImg('nl', 'assets/nailinit.webp'), loadImg('diwali', 'assets/diwali_blue.webp'),
  ...CONF.map(k => loadImg(k, `assets/conf/${k}.webp`)),
]);
const fontsReady = Promise.all(['700 20px "Palanquin Dark"', '600 20px "Palanquin Dark"', '20px "Bakbak One"', '600 20px "Clash Display"']
  .map(f => document.fonts ? document.fonts.load(f, 'सेवा में Aa') : 0)).catch(() => {});

/* ───────────── elements & layout ───────────── */
const stage = $('#stage'), envC = $('#env'), card = $('#card');
const boxEl = $('#box'), drawer = boxEl.querySelector('.drawer');
const matchEl = $('#match'), fxC = $('#fx'), fx = fxC.getContext('2d');
const glowEl = $('#glow'), capEl = $('#caption'), nameEl = $('#cardname'), ghost = $('#ghost');
const autoBtn = $('#autobtn'), afterEl = $('#after'), stepsEl = [...document.querySelectorAll('#steps li')];
const css = (el, k, v) => el.style.setProperty(k, v);

let vw = 0, vh = 0, dpr = 1, lastEnvW = 0, wide = false;
const E = {}, B = {}, M = {}, C2 = {};
const ENV_AR = 1600 / 788, POSTER_AR = 1000 / 1201, SLEEVE_AR = 1000 / 625, DRAWER = .253;
const ORIGIN = [.05, .9];

function layout() {
  vw = stage.clientWidth; vh = stage.clientHeight;
  if (vw < 50 || vh < 50) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  wide = vw / vh > 1.15;

  // envelope
  const ew = wide ? Math.min(vw * .44, 640, vh * .42 * ENV_AR) : Math.min(vw * .9, 600, vh * .27 * ENV_AR);
  Object.assign(E, { w: ew, h: ew / ENV_AR, cx: wide ? vw * .4 : vw / 2, cy: wide ? vh * .52 : vh * .39 });
  E.x = E.cx - E.w / 2; E.y = E.cy - E.h / 2;
  css(envC, '--ex', E.x + 'px'); css(envC, '--ey', E.y + 'px'); css(envC, '--ew', E.w + 'px'); css(envC, '--eh', E.h + 'px');

  // the AAO poster: starts inside the envelope, grows into the hero
  C2.h = E.h * .9; C2.w = C2.h * POSTER_AR;
  C2.fh = Math.min(vh * .6, (vw * .82) / POSTER_AR, 660); C2.fs = C2.fh / C2.h;
  C2.fy = clamp(vh * .45, C2.fh / 2 + 84, vh - C2.fh / 2 - 120);
  css(card, '--cw', C2.w + 'px'); css(card, '--ch', C2.h + 'px');
  css(nameEl, '--ny', (C2.fy + C2.fh / 2 + 20) + 'px');

  // matchbox
  const bw = wide ? Math.min(vw * .24, 360) : Math.min(vw * .64, 330), bh = bw / SLEEVE_AR;
  Object.assign(B, wide
    ? { w: bw, h: bh, cx: Math.min(vw - bw * .75 - 24, E.x + E.w + bw * .7), cy: E.cy + E.h * .25 }
    : { w: bw, h: bh, cx: vw / 2 - bw * DRAWER * .5, cy: Math.min(vh - bh / 2 - 150, E.y + E.h + (vh - E.y - E.h) * .42) });
  css(boxEl, '--bw', bw + 'px'); css(boxEl, '--bh', bh + 'px');

  M.L = bw * .82; M.mh = M.L / 10.6; M.st = Math.max(6, M.mh); M.h = M.L * .455;   // head centre sits ~45% of the length from the middle
  css(matchEl, '--L', M.L + 'px'); css(matchEl, '--st', M.st + 'px');

  fxC.width = Math.round(vw * dpr); fxC.height = Math.round(vh * dpr);
  buildDecor();
  if (Math.abs(lastEnvW - E.w) > 1) { lastEnvW = E.w; envDirty = true; }
}

/* kandils + marigold strings hanging from the top edge */
function buildDecor() {
  const box = $('#decor');
  const n = wide ? Math.max(11, Math.round(vw / 120)) : 9;
  let h = '', k = 0;
  for (let i = 0; i < n; i++) {
    const x = 5 + (i + .5) / n * 90;
    const centre = Math.abs(x - 50) < (wide ? 8 : 14);              // keep the masthead clear
    if (centre) continue;
    const isK = i % 3 === 1;
    const sw = (3.4 + (i * .71) % 1.9).toFixed(2), d = (-i * .63).toFixed(2);
    if (isK) {
      const drop = (wide ? 40 : 26) + ((i * 29) % (wide ? 60 : 34));
      const w = wide ? 96 : 58;
      h += `<div class="hang kandil" style="left:${x}%;--drop:${drop}px;--w:${w}px;--sw:${sw}s;--d:${d}s">` +
        `<i class="cord"></i><span class="lamp"><img class="bloom" src="assets/k${1 + k % 4}.webp" alt=""><img src="assets/k${1 + k % 4}.webp" alt=""></span></div>`;
      k++;
    } else {
      const len = (wide ? 170 : 104) + ((i * 53) % (wide ? 140 : 70));
      h += `<div class="hang mari" style="left:${x}%;--len:${len}px;--sw:${sw}s;--d:${d}s"><img src="assets/m${1 + i % 5}.webp" alt=""></div>`;
    }
  }
  box.innerHTML = h;
}

/* ───────────── envelope artwork → texture ───────────── */
const envArt = document.createElement('canvas'), ea = envArt.getContext('2d');
let envDirty = true;
function drawEnvelope() {
  const W = E.w, H = E.h, u = W / 100, x = ea;
  envArt.width = Math.round(W * dpr); envArt.height = Math.round(H * dpr);
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  if (IMG.env) x.drawImage(IMG.env, 0, 0, W, H);
  // deck lockup: nailinit / DIWALI / P A R T Y
  const lx = u * 8.5;
  if (IMG.nl) { const h = u * 3.3; x.drawImage(IMG.nl, lx, u * 6.6, h * IMG.nl.width / IMG.nl.height, h); }
  let dh = 0;
  if (IMG.diwali) { const w = u * 25; dh = w * IMG.diwali.height / IMG.diwali.width; x.drawImage(IMG.diwali, lx - u * .3, u * 10.6, w, dh); }
  x.fillStyle = '#1c1410'; x.font = `600 ${u * 2.3}px "Clash Display", "Barlow Condensed"`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  'PARTY'.split('').forEach((ch, i) => x.fillText(ch, lx + u * 4.4 + i * u * 3.4, u * 10.6 + dh + u * 2.9));
  // address: Palanquin Dark + Bakbak One with the deck's red drop shadow
  const ax = u * 8.5, ay = u * 27.5;
  x.fillStyle = '#c4221a'; x.font = `700 ${u * 3.2}px "Palanquin Dark"`;
  x.fillText('सेवा में,', ax, ay);
  const label = NAME + ' ji';
  let fs = u * 7.2; x.font = `400 ${fs}px "Bakbak One"`;
  while (x.measureText(label).width > W * .52 && fs > u * 3.6) { fs -= .5; x.font = `400 ${fs}px "Bakbak One"`; }
  const ny = ay + fs * 1.05;
  x.fillStyle = '#c4221a'; x.fillText(label, ax + u * .45, ny + u * .5);
  x.fillStyle = '#1c1410'; x.fillText(label, ax, ny);
  const ry = ny + u * 2.4, rw = Math.max(W * .3, x.measureText(label).width);
  x.strokeStyle = '#c4221a'; x.lineWidth = Math.max(1, u * .26);
  x.beginPath(); x.moveTo(ax, ry); x.lineTo(ax + rw * .45, ry); x.moveTo(ax + rw * .55, ry); x.lineTo(ax + rw, ry); x.stroke();
  x.fillStyle = '#2f9790'; x.font = `700 ${u * 2.4}px "Palanquin Dark"`; x.textAlign = 'center';
  x.fillText('✦', ax + rw / 2, ry + u * .85);
  x.textAlign = 'left';
  x.fillStyle = '#75150f'; x.font = `600 ${u * 2.6}px "Palanquin Dark"`;
  x.fillText('Mohalla No. 26, Khushiyon Wali Gali', ax, ry + u * 4.8);
}

/* ───────────── burn shader (WebGL, 2D fallback) ───────────── */
let gl = null, glu = {}, tex = null, ctx2d = null;
try { gl = envC.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false }); } catch (e) {}
if (gl) {
  const vs = `attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}`;
  const fs = `precision highp float;varying vec2 v;uniform sampler2D T;uniform float P,Ti;uniform vec2 O,A;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
  float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
  void main(){
    vec4 c=texture2D(T,v);
    if(P<=0.){gl_FragColor=c;return;}
    float d=length((v-O)*A)/length(A);
    float nz=fb(v*A*4.+vec2(0.,Ti*.05));
    float f=d*.85+nz*.38*min(1.,d*8.);
    float e=P*1.28-f;
    if(e>0.){gl_FragColor=vec4(0.);return;}
    vec3 col=c.rgb;
    float heat=smoothstep(-.22,-.03,e);
    col=mix(col,col*vec3(.62,.42,.26),heat*.9);                       // scorch
    col=mix(col,vec3(.06,.03,.02),smoothstep(-.04,-.01,e));           // char rim
    float fl=.6+.4*n(v*A*36.+Ti*5.);
    vec3 em=mix(vec3(1.,.3,.03),vec3(1.,.9,.55),smoothstep(-.012,0.,e));
    col+=em*smoothstep(-.026,0.,e)*2.6*fl;                              // ember edge
    col+=vec3(1.,.55,.15)*heat*.08*fl;                                  // warm glow ahead of the front
    gl_FragColor=vec4(col,c.a);
  }`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
  try {
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['T', 'P', 'Ti', 'O', 'A'].forEach(k => { glu[k] = gl.getUniformLocation(pr, k); });
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  } catch (err) { console.warn('burn shader', err); gl = null; }
}
if (!gl) ctx2d = envC.getContext('2d');
function uploadEnvelope() {
  if (!(E.w > 20)) return;
  drawEnvelope();
  envC.width = envArt.width; envC.height = envArt.height;
  if (gl) {
    gl.viewport(0, 0, envC.width, envC.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, envArt);
  }
  envDirty = false;
}
function renderBurn(b, t) {
  if (gl) {
    gl.uniform1i(glu.T, 0); gl.uniform1f(glu.P, b); gl.uniform1f(glu.Ti, t);
    gl.uniform2f(glu.O, ORIGIN[0], ORIGIN[1]); gl.uniform2f(glu.A, E.w / E.h, 1);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else {
    const c = ctx2d, W = envC.width, H = envC.height;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.drawImage(envArt, 0, 0);
    if (b > 0) {
      const R = Math.hypot(W, H) * b * 1.15, ox = W * ORIGIN[0], oy = H * ORIGIN[1];
      const g = c.createRadialGradient(ox, oy, R * .7, ox, oy, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
  }
}

/* ───────────── audio (synthesised; unlocked by the first tap) ───────────── */
const A = { on: store.get('mkd:snd') !== '0' };
function initAudio() {
  if (A.ac) { if (A.ac.state === 'suspended') A.ac.resume(); return; }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(); master.gain.value = A.on ? .9 : 0; master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, freq, q) => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return g;
    };
    Object.assign(A, { ac, master, buf, fg: loop('lowpass', 650, .7), sg: loop('bandpass', 2600, 1.4) });
  } catch (e) {}
}
function noiseHit(dur, filt, f0, f1, peak, q = .9, delay = 0) {
  if (!A.ac) return;
  const ac = A.ac, t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = A.buf;
  const f = ac.createBiquadFilter(); f.type = filt; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .006); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}
const sfx = {
  slide() { noiseHit(.45, 'bandpass', 900, 500, .35, 2); },
  pick() { noiseHit(.06, 'highpass', 3000, 2000, .25); },
  sputter() { for (let i = 0; i < 4; i++) noiseHit(.05, 'bandpass', 3500, 2200, .4, 1, i * .05); },
  ignite() { noiseHit(.2, 'bandpass', 3200, 1100, .9); noiseHit(.8, 'lowpass', 300, 1900, .6, .7, .04); },
  catch() { noiseHit(1.2, 'lowpass', 200, 1400, .7, .7); },
  crackle() { noiseHit(rnd(.012, .035), 'highpass', rnd(1200, 3500), 900, rnd(.08, .3)); },
  pop() { noiseHit(.18, 'lowpass', 1200, 200, .8, 1); noiseHit(.5, 'highpass', 5000, 3000, .25, .7, .04); },
  bell(f0 = 520, v = 1) {
    if (!A.ac) return;
    const ac = A.ac, t = ac.currentTime;
    [[1, .4], [2.76, .18], [5.4, .09], [8.93, .04]].forEach(([r, g0]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f0 * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0 * v, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + 2.6 / Math.sqrt(r));
      o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 3);
    });
  },
};
const sndBtn = $('#snd');
sndBtn.addEventListener('click', () => {
  A.on = !A.on; store.set('mkd:snd', A.on ? '1' : '0');
  sndBtn.classList.toggle('off', !A.on); sndBtn.setAttribute('aria-label', A.on ? 'Sound on' : 'Sound off');
  if (A.master) A.master.gain.setTargetAtTime(A.on ? .9 : 0, A.ac.currentTime, .05);
});
sndBtn.classList.toggle('off', !A.on);
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ───────────── particles, flame, confetti ───────────── */
const parts = [];
const spawn = o => { if (parts.length < 1400) parts.push(o); };
function sparks(x, y, dir, n, spread = 55, sp0 = 120, sp1 = 620) {
  for (let i = 0; i < n; i++) {
    const a = rad(dir + rnd(-spread, spread)), sp = rnd(sp0, sp1);
    spawn({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rnd(0, 160), life: 0, max: rnd(.2, .6), w: rnd(.8, 2), hue: rnd(30, 55) });
  }
}
function burnFront(b) {
  const t = b * 1.28, nz = rnd(.25, .75), d = clamp((t - nz * .38) / .85, 0, 1.2);
  const diag = Math.hypot(E.w, E.h), a = rnd(-Math.PI / 2, 0);
  const x = E.x + E.w * ORIGIN[0] + Math.cos(a) * d * diag, y = E.y + E.h * ORIGIN[1] + Math.sin(a) * d * diag;
  if (x < E.x || x > E.x + E.w || y < E.y || y > E.y + E.h) return null;
  return { x, y };
}
function confettiCannons() {
  const pics = CONF.map(k => IMG[k]).filter(Boolean);
  if (!pics.length) return;
  const n = reduced ? 20 : 70;
  for (const side of [-1, 1]) {
    const ox = side < 0 ? -10 : vw + 10, oy = vh * .92;
    for (let i = 0; i < n; i++) {
      const a = rad(side < 0 ? rnd(-78, -48) : rnd(-132, -102)), sp = rnd(vh * .9, vh * 1.7);
      const img = pics[(Math.random() * pics.length) | 0];
      spawn({ k: 'conf', img, x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(0, 6), vr: rnd(-7, 7),
        flip: rnd(0, 6), vf: rnd(5, 11), s: rnd(18, 34) * (wide ? 1.25 : 1), life: 0, max: rnd(3.2, 4.6), drag: rnd(1.4, 2.2) });
    }
  }
  for (let i = 0; i < (reduced ? 10 : 60); i++) {
    spawn({ k: 'glit', x: vw / 2 + rnd(-C2.fh * .5, C2.fh * .5), y: C2.fy + rnd(-C2.fh * .5, C2.fh * .5), vx: rnd(-40, 40), vy: rnd(-60, 20), life: 0, max: rnd(.8, 2.2), r: rnd(.8, 2.2), ph: rnd(0, 9) });
  }
}
function petalRain(dt) {
  const pics = [IMG.c01, IMG.c02, IMG.c04, IMG.c12, IMG.c17, IMG.c18, IMG.c20, IMG.c28].filter(Boolean);
  if (!pics.length || reduced) return;
  if (Math.random() < dt * 9) {
    spawn({ k: 'conf', img: pics[(Math.random() * pics.length) | 0], x: rnd(0, vw), y: -30, vx: rnd(-20, 20), vy: rnd(40, 90), r: rnd(0, 6), vr: rnd(-2, 2),
      flip: rnd(0, 6), vf: rnd(2, 5), s: rnd(14, 24), life: 0, max: rnd(5, 8), drag: .2, sway: rnd(20, 50), float: true });
  }
}
function drawFlame(c, x, y, s, k, t, lean) {
  if (k <= .01) return;
  const fl = .92 + .08 * Math.sin(t * 23) + .06 * Math.sin(t * 37 + 1.3) + .05 * Math.sin(t * 11.7);
  const h = s * 3.3 * k * fl, w = s * .95 * Math.sqrt(k);
  c.save(); c.globalCompositeOperation = 'lighter';
  let g = c.createRadialGradient(x, y - h * .35, 0, x, y - h * .35, h * 2.6);
  g.addColorStop(0, `rgba(255,170,60,${.36 * Math.min(1, k)})`); g.addColorStop(1, 'rgba(255,110,30,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - h * .35, h * 2.6, 0, 7); c.fill();
  const layers = [[1, ['rgba(255,170,60,.95)', 'rgba(255,96,20,.75)', 'rgba(190,30,10,0)']],
    [.7, ['rgba(255,244,190,1)', 'rgba(255,190,70,.9)', 'rgba(255,140,40,0)']],
    [.42, ['rgba(150,180,255,.85)', 'rgba(255,255,245,1)', 'rgba(255,240,200,0)']]];
  for (const [m, st] of layers) {
    const hh = h * m, ww = w * m, lx = lean * m, by = y + ww * .35;
    g = c.createLinearGradient(x, by, x + lx, by - hh);
    g.addColorStop(0, st[0]); g.addColorStop(.45, st[1]); g.addColorStop(1, st[2]);
    c.fillStyle = g; c.beginPath();
    c.moveTo(x, by + ww * .5);
    c.bezierCurveTo(x - ww * 1.35, by, x - ww * .55 + lx * .5, by - hh * .62, x + lx, by - hh);
    c.bezierCurveTo(x + ww * .55 + lx * .5, by - hh * .62, x + ww * 1.35, by, x, by + ww * .5);
    c.fill();
  }
  c.restore();
}
function drawTarget(c, x, y, t, k) {
  if (k <= .01) return;
  const r = Math.max(22, E.w * .07), p = (t * 1.1) % 1;
  c.save(); c.globalAlpha = k;
  c.strokeStyle = 'rgba(239,189,13,.95)'; c.lineWidth = 2.5; c.setLineDash([6, 6]); c.lineDashOffset = -t * 24;
  c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  c.setLineDash([]); c.strokeStyle = `rgba(236,90,134,${1 - p})`; c.lineWidth = 3;
  c.beginPath(); c.arc(x, y, r + p * r * .9, 0, 7); c.stroke();
  c.restore();
}

/* ───────────── the story, as a state machine ───────────── */
// gate → enter → closed (tap box) → opening → lift → strike (swipe) → carry (drag) → touch → burn → reveal → done
const S = { ph: 'gate', t: 0, auto: false, fails: 0, idle: 0 };
const box = { x: 0, y: 0, rot: -6, dx: 0, op: 1, off: 1 };       // off: 1 = below the screen
const mt = { x: 0, y: 0, a: 0, s: 1, vis: false, clip: 0, lit: 0, char: 0, vx: 0, lean: 0 };
let burnP = 0, cardT = 0, light = 0;
const ptr = { down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, hist: [], type: 'mouse' };
const strike = { x0: 0, travel: 0, best: 0, hx: 0 };

const CAPS = {
  gate: 'Chitthi aayi hai!', enter: 'Maachis aa rahi hai…',
  closed: coarse ? 'Maachis ko tap karo' : 'Maachis pe click karo',
  opening: 'Ek teeli nikal rahi hai…', lift: 'Ek teeli nikal rahi hai…',
  strike: coarse ? 'Teeli ko patti pe ragdo →' : 'Teeli ko patti pe tez drag karo →',
  carry: coarse ? 'Aag ko chitthi ke kone tak lao' : 'Aag ko kone tak drag karo',
  touch: 'Lag gayi!', burn: 'Jal rahi hai… nazar na lage!', reveal: 'Aapka amantran!', done: 'Neeche scroll karo — details ↓',
};
let capOverride = '', capUntil = 0, lastCap = '';
function setPhase(ph) { S.ph = ph; S.t = 0; S.idle = 0; S.rest = null; document.body.dataset.ph = ph; }
function say(text, secs = 1.4) { capOverride = text; capUntil = performance.now() + secs * 1000; }

function bpt(lx, ly) {
  const c = Math.cos(rad(box.rot)), s = Math.sin(rad(box.rot));
  return { x: box.x + lx * c - ly * s, y: box.y + lx * s + ly * c };
}
const STRIP_Y = () => -B.h / 2 + B.h * .035;
const strikeL = () => -.38 * B.w, strikeR = () => .46 * B.w;
const STRIKE_A = () => box.rot - 22;
function target() { return { x: E.x + E.w * ORIGIN[0], y: E.y + E.h * ORIGIN[1] }; }
function holdPose() { return wide ? { x: B.x0 - B.w * .2, y: E.cy - E.h * .1 } : { x: vw * .62, y: E.y + E.h + (B.y0 - B.h / 2 - E.y - E.h) * .45 }; }

function ignite() {
  mt.lit = 1; S.fails = 0;
  sfx.ignite(); buzz(30);
  const d = rad(box.rot - 10);
  sparks(mt.x, mt.y, box.rot - 20, reduced ? 14 : 60, 50);
  setPhase('carry');
  S.carryFrom = { x: mt.x, y: mt.y }; S.settle = !ptr.down;
}

/* pointer handling — one surface, phone and desktop */
function pdown(e) {
  if (S.ph === 'gate' || e.target.closest('button, a, input')) return;
  initAudio();
  ptr.down = true; ptr.id = e.pointerId; ptr.type = e.pointerType;
  ptr.x = ptr.sx = e.clientX; ptr.y = ptr.sy = e.clientY; ptr.moved = 0; ptr.hist = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  S.idle = 0;
  try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  if (S.ph === 'closed') { openBox(); return; }
  if (S.ph === 'strike') armStrike();
  if (S.ph === 'carry') S.settle = false;
}
function armStrike() { strike.travel = 0; strike.best = 0; strike.hx = local(mt.x, mt.y).x; strike.pid = ptr.id; }
function pmove(e) {
  if (!ptr.down || e.pointerId !== ptr.id) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += Math.hypot(dx, dy);
  const now = performance.now();
  ptr.hist.push({ x: e.clientX, y: e.clientY, t: now }); while (ptr.hist.length > 2 && now - ptr.hist[0].t > 90) ptr.hist.shift();
  S.idle = 0;
  if (S.ph === 'strike' && strike.pid !== ptr.id) armStrike();          // swipe began while the match was still lifting
  if (S.ph === 'strike') {
    // project the finger's motion onto the striker strip
    const c = Math.cos(rad(box.rot)), s = Math.sin(rad(box.rot));
    const along = dx * c + dy * s;
    strike.hx = clamp(strike.hx + along * (coarse ? 1.15 : 1), strikeL(), strikeR() + B.w * .12);
    strike.travel += Math.max(0, along);
    const h0 = ptr.hist[0], h1 = ptr.hist[ptr.hist.length - 1];
    const v = h1.t > h0.t ? (((h1.x - h0.x) * c + (h1.y - h0.y) * s) / (h1.t - h0.t)) : 0;   // px per ms along the strip
    strike.best = Math.max(strike.best, v);
    if (v > .25) { if (Math.random() < .5) sparks(mt.x, mt.y, box.rot + 170, 1, 30, 60, 220); }
    if (A.sg) A.sg.gain.setTargetAtTime(clamp(v, 0, 2) * .22, A.ac.currentTime, .03);
    const need = S.fails >= 3 ? .35 : S.fails >= 2 ? .5 : .7;          // gets more forgiving after misses
    if (v > need && strike.travel > B.w * (S.fails >= 2 ? .25 : .38)) ignite();
  }
}
function pup(e) {
  if (!ptr.down || (e && e.pointerId !== ptr.id)) return;
  ptr.down = false; strike.pid = null;
  if (A.sg) A.sg.gain.setTargetAtTime(0, A.ac.currentTime, .05);
  if (S.ph === 'strike') {
    if (strike.travel > 6) { S.fails++; sfx.sputter(); sparks(mt.x, mt.y, box.rot + 180, 6, 40, 40, 160);
      say(S.fails >= 2 ? 'Aur tez! Ek jhatke mein ragdo 💥' : 'Zor se ragdo!', 1.8); }
    strike.hx = strikeL();
  }
  if (S.ph === 'carry') {
    const r = stage.getBoundingClientRect(), px = ptr.x - r.left, py = ptr.y - r.top, tg = target();
    const overEnvelope = px > E.x - 20 && px < E.x + E.w + 20 && py > E.y - 20 && py < E.y + E.h + 40;
    const nearHead = Math.hypot(mt.x - tg.x, mt.y - tg.y) < Math.max(80, E.w * .25);
    if (overEnvelope || nearHead) S.autoCarry = true;
  }
}
stage.addEventListener('pointerdown', pdown);
stage.addEventListener('pointermove', pmove);
stage.addEventListener('pointerup', pup);
stage.addEventListener('pointercancel', pup);
window.addEventListener('keydown', e => {
  if (S.ph === 'gate' || !(e.key === ' ' || e.key === 'Enter')) return;
  if (e.target.closest && e.target.closest('button, a, input')) return;
  e.preventDefault(); runAuto();
});
function local(x, y) {
  const c = Math.cos(rad(-box.rot)), s = Math.sin(rad(-box.rot)), dx = x - box.x, dy = y - box.y;
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}
function openBox() { if (S.ph !== 'closed') return; sfx.slide(); setPhase('opening'); }
function runAuto() {
  initAudio();
  S.auto = true; autoBtn.classList.add('on');
  if (S.ph === 'closed') openBox();
}
autoBtn.addEventListener('click', runAuto);

/* ───────────── gate ───────────── */
const gate = $('#gate'), gform = $('#gform'), gopen = $('#gopen'), gerr = $('#gerr');
const ERRS = ['Arre, ye number nahi chalega.', 'Wahi number daalo jis pe invite aaya tha.', 'Nazar lag gayi kya? Ek baar aur try karo.'];
let errN = 0;
if (!KEY || store.get('mkd:' + KEY) === '1') { gform.hidden = true; gopen.hidden = false; }
function open() {
  if (S.ph !== 'gate') return;
  initAudio(); sfx.bell(520, .7);
  if (KEY) store.set('mkd:' + KEY, '1');
  document.body.classList.add('open');
  sndBtn.hidden = false;
  document.activeElement && document.activeElement.blur();
  setPhase('enter');
}
gopen.addEventListener('click', open);
gform.addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#phone').value;
  if (L.digits(v).length < 10) { gerr.textContent = 'Poore 10 digit daalo ji.'; return; }
  if (L.keyFor(v, C.salt) === KEY) { gerr.textContent = ''; open(); return; }
  gerr.textContent = ERRS[errN++ % ERRS.length];
  gate.classList.remove('shake'); void gate.offsetWidth; gate.classList.add('shake');
});
$('#replay').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    document.body.classList.add('locked'); afterEl.classList.remove('on');
    burnP = 0; cardT = 0; mt.lit = 0; mt.char = 0; S.auto = false; autoBtn.classList.remove('on'); box.dx = 0; box.off = 1; parts.length = 0;
    envC.style.visibility = 'visible'; nameEl.classList.remove('on');
    setPhase('enter');
  }, 450);
});
$('#seeDetails').addEventListener('click', () => $('#details').scrollIntoView({ behavior: 'smooth' }));

/* ───────────── frame ───────────── */
let last = performance.now(), ready = false, envShown = true;
B.x0 = 0; B.y0 = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (nowMs - last) / 1000); last = nowMs;
  const now = nowMs / 1000;
  if (!ready) return;
  S.t += dt; S.idle += dt;
  if (envDirty) uploadEnvelope();
  B.x0 = B.cx; B.y0 = B.cy;

  /* ── advance the story ── */
  const ph = S.ph;
  if (ph === 'enter') { box.off = 1 - eo(clamp(S.t / .9)); if (S.t > .9) setPhase(S.auto ? 'opening' : 'closed'); }
  if (ph === 'closed' && S.auto && S.t > .35) openBox();
  if (ph === 'opening') { box.dx = ease(clamp(S.t / .55)) * DRAWER * B.w; if (S.t > .6) { sfx.pick(); setPhase('lift'); } }
  if (ph === 'strike' && S.auto) {
    // a confident demo swipe
    const k = clamp((S.t - .25) / .38);
    strike.hx = lerp(strikeL(), strikeR(), k * k);
    if (k > .1 && Math.random() < .7) sparks(mt.x, mt.y, box.rot + 170, 1, 30, 60, 220);
    if (k >= .72) ignite();
  }
  if (ph === 'carry') {
    const tg = target();
    if (Math.hypot(mt.x - tg.x, mt.y - tg.y) < Math.max(34, E.w * .1)) { sfx.catch(); buzz(20); setPhase('touch'); }
    else if ((S.auto || S.autoCarry) && !ptr.down && S.t > .45) S.autoCarry = true;
  }
  if (ph === 'touch' && S.t > .7) setPhase('burn');
  if (ph === 'burn') {
    const k = clamp(S.t / 3.4);
    burnP = .02 + .98 * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    if (k >= 1) { setPhase('reveal'); confettiCannons(); sfx.pop(); setTimeout(() => sfx.bell(660, .9), 120); buzz(40); }
  }
  if (ph === 'reveal') { cardT = clamp(S.t / 1.3); if (S.t > 1.6) { setPhase('done'); finish(); } }

  /* ── matchbox pose ── */
  const leaving = ['carry', 'touch', 'burn', 'reveal', 'done'].includes(S.ph);
  const exitK = leaving ? clamp((S.ph === 'carry' ? S.t - .3 : 2) / .7) : 0;
  box.x = B.cx + (wide ? exitK * vw * .4 : 0);
  box.y = B.cy + box.off * vh * .7 + (wide ? 0 : exitK * vh * .6);
  box.rot = lerp(-16, -5, 1 - box.off) + Math.sin(now * 1.3) * .4;
  if (S.ph === 'gate') box.off = 1;
  boxEl.style.transform = `translate(${box.x - B.w / 2}px,${box.y - B.h / 2}px) rotate(${box.rot}deg)`;
  boxEl.style.opacity = 1 - exitK;
  drawer.style.transform = `translateX(${box.dx}px)`;
  boxEl.classList.toggle('tap', S.ph === 'closed');

  /* ── the match ── */
  const dxFull = DRAWER * B.w, trayY = -B.h * .33, headX0 = B.w / 2 + dxFull - B.w * .035;
  let pose = null, clip = 0;
  if (S.ph === 'lift') {
    const k1 = ease(clamp(S.t / .45)), k2 = ease(clamp((S.t - .4) / .5));
    const pull = M.L * .78, hx = headX0 + pull * k1;
    const a = bpt(hx, trayY), b = bpt(strikeL(), STRIP_Y());
    pose = { x: lerp(a.x, b.x, k2), y: lerp(a.y, b.y, k2), a: lerp(box.rot, STRIKE_A(), k2), s: lerp(1, 1.08, k2) };
    clip = k2 > 0 ? 0 : clamp(B.w / 2 - (hx - M.h - M.L / 2), 0, M.L);
    if (S.t > .95) { setPhase('strike'); strike.hx = strikeL(); }
  } else if (S.ph === 'strike') {
    const p = bpt(strike.hx, STRIP_Y() + Math.sin(now * 40) * (ptr.down ? .6 : 0));
    const tilt = clamp((strike.hx - strikeL()) / B.w, 0, 1) * 6;
    pose = { x: p.x, y: p.y, a: STRIKE_A() + tilt, s: 1.08 };
    if (!ptr.down && !S.auto) strike.hx = lerp(strike.hx, strikeL(), .2);
  } else if (S.ph === 'carry') {
    let tx, ty;
    if (S.autoCarry) {
      const tg = target(); S.ac = (S.ac || 0) + dt / 1.1; const k = ease(clamp(S.ac));
      S.acFrom = S.acFrom || { x: mt.x, y: mt.y };
      tx = lerp(S.acFrom.x, tg.x, k); ty = lerp(S.acFrom.y, tg.y, k) - Math.sin(k * Math.PI) * 40;
    } else if (ptr.down) {
      const off = ptr.type === 'touch' ? { x: -14, y: -54 } : { x: 0, y: -8 };
      const r = stage.getBoundingClientRect();
      tx = ptr.x - r.left + off.x; ty = ptr.y - r.top + off.y;
    } else if (S.settle) {
      const hp = holdPose(); tx = hp.x + Math.sin(now * 1.7) * 3; ty = hp.y + Math.cos(now * 1.3) * 3;
    } else if (S.rest) { tx = S.rest.x; ty = S.rest.y; }
    else { tx = mt.x; ty = mt.y; }
    if (ptr.down && !S.autoCarry) S.rest = { x: tx, y: ty };
    const k = ptr.down ? .45 : .12;
    const nx = lerp(mt.x, tx, k), ny = lerp(mt.y, ty, k);
    pose = { x: nx, y: ny, a: -42 + clamp(mt.vx * -.02, -14, 14), s: 1.1 };
  } else if (S.ph === 'touch') {
    const tg = target(), k = ease(clamp(S.t / .35));
    pose = { x: lerp(mt.x, tg.x - 3, k), y: lerp(mt.y, tg.y + 5, k), a: -38, s: 1.1 };
  } else if (S.ph === 'burn') {
    const k = clamp((S.t - .5) / 1);
    const tg = target();
    pose = { x: lerp(tg.x - 3, -M.L * .3, k * k), y: lerp(tg.y + 5, E.y + E.h * 1.6, k * k), a: lerp(-38, -75, k), s: 1.1 };
  }
  if (S.ph !== 'carry') { S.autoCarry = false; S.ac = 0; S.acFrom = null; }
  if (pose) {
    mt.vx = lerp(mt.vx, (pose.x - mt.x) / Math.max(dt, .001), .25);
    Object.assign(mt, pose); mt.vis = true;
  } else mt.vis = false;
  if (S.ph === 'lift' || S.ph === 'opening') {
    // keep the loose match tucked while it's still in the tray
  }
  matchEl.style.visibility = mt.vis ? 'visible' : 'hidden';
  if (mt.vis) {
    const cx = mt.x - Math.cos(rad(mt.a)) * M.h * mt.s, cy = mt.y - Math.sin(rad(mt.a)) * M.h * mt.s;
    matchEl.style.transform = `translate(${cx - M.L / 2}px,${cy - M.mh / 2}px) rotate(${mt.a}deg) scale(${mt.s})`;
    matchEl.style.clipPath = clip > 0 ? `inset(-30px -40px -30px ${clip}px)` : 'none';
  }
  if (mt.lit) mt.char = clamp(mt.char + dt * .12, 0, .9);
  css(matchEl, '--char', mt.char.toFixed(3));
  css(matchEl, '--lift', (S.ph === 'lift' || S.ph === 'strike' ? 8 : S.ph === 'carry' ? 16 : 3) + 'px');
  mt.lean = lerp(mt.lean, clamp(-mt.vx * .025, -M.st * 2.4, M.st * 2.4), .15);

  // flame strength
  let fk = 0;
  if (mt.lit) {
    if (S.ph === 'carry') fk = S.t < .35 ? lerp(1.7, 1, S.t / .35) : 1;
    else if (S.ph === 'touch') fk = 1.3;
    else if (S.ph === 'burn') fk = 1.3 * (1 - clamp((S.t - .5) / .9));
  }

  /* ── envelope + poster ── */
  if (S.ph === 'touch') burnP = .012 * clamp(S.t / .5);
  const showEnv = burnP < .999;
  if (showEnv !== envShown) { envC.style.visibility = showEnv ? 'visible' : 'hidden'; envShown = showEnv; }
  if (showEnv) renderBurn(burnP, now);
  card.style.visibility = burnP > 0 ? 'visible' : 'hidden';
  const rv = eob(cardT);
  css(card, '--cx', (lerp(E.cx, vw / 2, eo(cardT)) - C2.w / 2) + 'px');
  css(card, '--cy', (lerp(E.cy, C2.fy, eo(cardT)) - C2.h / 2) + 'px');
  css(card, '--cs', lerp(1, C2.fs, rv).toFixed(4));
  css(card, '--crot', (lerp(-4, 0, eo(cardT))).toFixed(2) + 'deg');

  /* ── light ── */
  const burning = burnP > 0 && burnP < 1 ? Math.sin(Math.PI * burnP) : 0;
  light = lerp(light, Math.min(1, fk * .7 + burning + cardT * .6), .1);
  const gx = burning > .05 ? E.cx : mt.x, gy = burning > .05 ? E.cy : mt.y;
  css(glowEl, '--gx', gx + 'px'); css(glowEl, '--gy', gy + 'px');
  css(glowEl, '--gr', (14 + 22 * burning + 10 * fk) + 'vmax');
  glowEl.style.opacity = Math.min(1, fk * .5 + burning * .85).toFixed(3);
  css(document.documentElement, '--lit', light.toFixed(3));

  /* ── caption, ghost hint, auto button ── */
  let cap = performance.now() < capUntil ? capOverride : CAPS[S.ph] || '';
  if (S.auto && ['closed', 'strike', 'carry'].includes(S.ph)) cap = CAPS[S.ph].replace(/→$/, '');
  if (cap !== lastCap) {
    lastCap = cap; capEl.classList.add('swap');
    setTimeout(() => { capEl.firstChild.textContent = cap; capEl.classList.remove('swap'); }, 200);
  }
  const stepOf = { closed: 0, enter: 0, opening: 1, lift: 1, strike: 1, carry: 2, touch: 2, burn: 3, reveal: 3, done: 4 }[S.ph] ?? -1;
  if (stepOf !== S.lastStep) { S.lastStep = stepOf; stepsEl.forEach((li, i) => { li.classList.toggle('on', i === stepOf); li.classList.toggle('done', i < stepOf); }); }
  updateGhost(now);
  autoBtn.hidden = !['closed', 'opening', 'lift', 'strike', 'carry'].includes(S.ph) || S.auto;

  /* ── particles ── */
  const ctx = fx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  if (S.ph === 'carry' && !S.autoCarry) { const tg = target(); drawTarget(ctx, tg.x, tg.y, now, clamp(S.t / .4)); }
  if (burnP > 0 && burnP < .985) {
    const rate = reduced ? .3 : 1;
    for (let i = 0; i < 5 * rate; i++) if (Math.random() < .75) { const q = burnFront(burnP); if (q) spawn({ k: 'ember', x: q.x, y: q.y, vx: rnd(-30, 30), vy: rnd(-150, -40), life: 0, max: rnd(.7, 2), r: rnd(.8, 2.6), ph: rnd(0, 9) }); }
    if (Math.random() < .5 * rate) { const q = burnFront(burnP); if (q) spawn({ k: 'smoke', x: q.x, y: q.y, vx: rnd(-10, 10), vy: rnd(-60, -25), life: 0, max: rnd(1.6, 3), r: rnd(10, 18) }); }
    if (Math.random() < .3 * rate) { const q = burnFront(burnP); if (q) spawn({ k: 'ash', x: q.x, y: q.y, vx: rnd(-20, 20), vy: rnd(-50, 10), life: 0, max: rnd(1.8, 3.2), r: rnd(1.2, 3), a: rnd(0, 6), va: rnd(-5, 5) }); }
    if (A.ac && Math.random() < dt * 30) sfx.crackle();
  }
  if (S.ph === 'done' || S.ph === 'reveal') petalRain(dt);
  stepParticles(ctx, dt, now);
  drawFlame(ctx, mt.x, mt.y, M.st * 1.5, fk, now, mt.lean + Math.sin(now * 3.1) * M.st * .18);
  if (A.ac) A.fg.gain.setTargetAtTime(Math.max(fk * .3, burning) * .3, A.ac.currentTime, .12);
}

function stepParticles(ctx, dt, now) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const o = parts[i]; o.life += dt;
    if (o.life > o.max || o.y > vh + 60) { parts.splice(i, 1); continue; }
    const t = o.life / o.max;
    if (o.k === 'spark') { o.vy += 900 * dt; o.vx *= .985; }
    else if (o.k === 'ember') { o.vx += Math.sin(now * 3 + o.ph) * 30 * dt; o.vy -= 20 * dt; }
    else if (o.k === 'smoke') { o.r += 20 * dt; }
    else if (o.k === 'ash') { o.vy += 30 * dt; o.vx += Math.sin(now * 2 + o.a) * 12 * dt; o.a += o.va * dt; }
    else if (o.k === 'glit') { o.vy += 10 * dt; }
    else if (o.k === 'conf') {
      const dragK = Math.exp(-o.drag * dt);
      o.vx *= dragK; o.vy = o.vy * dragK + (o.float ? 0 : 520 * dt);
      if (!o.float && o.vy > 90) o.vy = lerp(o.vy, 90, .08);                // terminal flutter speed
      if (o.float) o.x += Math.sin(now * 1.4 + o.flip) * o.sway * dt;
      o.r += o.vr * dt; o.flip += o.vf * dt;
    }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.k === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, `rgba(60,40,38,${.14 * (1 - t)})`); g.addColorStop(1, 'rgba(60,40,38,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    } else if (o.k === 'ash') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); ctx.fillStyle = `rgba(28,16,12,${.85 * (1 - t)})`;
      ctx.beginPath(); ctx.moveTo(-o.r, -o.r * .3); ctx.lineTo(o.r * .2, -o.r * .7); ctx.lineTo(o.r, o.r * .1); ctx.lineTo(-o.r * .3, o.r * .6); ctx.closePath(); ctx.fill();
      if (t < .4) { ctx.strokeStyle = `rgba(255,120,40,${.6 * (1 - t / .4)})`; ctx.lineWidth = .8; ctx.stroke(); } ctx.restore();
    } else if (o.k === 'conf') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = t > .85 ? (1 - t) / .15 : 1; ctx.translate(o.x, o.y); ctx.rotate(o.r);
      ctx.scale(Math.cos(o.flip) * .85 + (Math.cos(o.flip) >= 0 ? .15 : -.15), 1);     // paper flutter
      const ar = o.img.width / o.img.height; ctx.drawImage(o.img, -o.s * ar / 2, -o.s / 2, o.s * ar, o.s); ctx.restore();
    } else if (o.k === 'glit') {
      ctx.globalCompositeOperation = 'lighter';
      const tw = Math.max(0, Math.sin(now * 14 + o.ph));
      ctx.fillStyle = `rgba(255,220,120,${(1 - t) * tw})`;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 + tw), 0, 7); ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      if (o.k === 'spark') {
        ctx.strokeStyle = `hsla(${o.hue},100%,${70 + 20 * (1 - t)}%,${1 - t})`; ctx.lineWidth = o.w;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx * .022, o.y - o.vy * .022); ctx.stroke();
      } else {
        const fl = .6 + .4 * Math.sin(now * 20 + o.ph);
        ctx.fillStyle = `rgba(255,${140 + 80 * (1 - t) | 0},60,${(1 - t) * fl})`;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 - t * .5), 0, 7); ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

function updateGhost(now) {
  let show = false, x = 0, y = 0, press = false;
  const wait = S.idle > (S.ph === 'closed' ? .6 : 1.4) && !S.auto && !ptr.down;
  if (S.ph === 'closed' && wait) {
    show = true; x = box.x; y = box.y + B.h * .1; press = (now % 1.2) < .3;
  } else if (S.ph === 'strike' && wait) {
    const k = (now % 1.6) / 1.6, kk = clamp(k / .55);
    const p = bpt(lerp(strikeL(), strikeR(), ease(kk)), STRIP_Y() + B.h * .3);
    show = k < .75; x = p.x; y = p.y; press = k < .58;
  } else if (S.ph === 'carry' && wait && !S.autoCarry) {
    const k = (now % 2) / 2, tg = target();
    show = k < .8; x = lerp(mt.x, tg.x, ease(clamp(k / .7))) + 10; y = lerp(mt.y, tg.y, ease(clamp(k / .7))) + 40; press = k < .7;
  }
  ghost.classList.toggle('on', show);
  ghost.classList.toggle('press', press);
  if (show) ghost.style.transform = `translate(${x}px,${y}px)`;
}

function finish() {
  document.body.classList.remove('locked');
  afterEl.classList.add('on');
  nameEl.classList.add('on');
  store.set('mkd:done', '1');
}

/* ───────────── boot ───────────── */
let rz;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
layout();
Promise.all([assetsReady, fontsReady]).then(() => {
  uploadEnvelope(); renderBurn(0, 0);
  ready = true;
  document.body.classList.add('ready');
  document.body.dataset.ph = 'gate';
});
requestAnimationFrame(frame);
})();
