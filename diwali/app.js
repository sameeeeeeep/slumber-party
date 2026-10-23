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
// ?inv=<5-char phone check><name sealed with the phone>  → phone-locked, name appears on unlock
// ?name=riya                                             → open to anyone
// ?to=Riya&k=<check>                                     → older links, still honoured
const nice = v => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 32).replace(/(^|\s)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
const INV = (qs.get('inv') || '').trim();
const KEY = (INV ? INV.slice(0, 5) : (qs.get('k') || '')).trim().toLowerCase();
const SEALED = INV.length > 5 ? INV.slice(5) : '';
let NAME = nice(qs.get('name') || qs.get('to'));            // full name: used for tracking / sheet rows
const FIRST = () => (NAME || '').split(' ')[0];                 // first name: what the guest sees
if (!NAME && SEALED) NAME = nice(L.unseal(SEALED, C.salt));
window.MKDGuest = { get first() { return FIRST() || C.defaultName; }, get full() { return NAME || C.defaultName; } };
function applyName() {
  const n = FIRST() || C.defaultName;
  document.querySelectorAll('[data-name]').forEach(e => { e.textContent = n; });
  $('.g-title').textContent = `${n}, ye chitthi sirf aapke liye hai…`;
  if ($('#wa')) $('#wa').href = `https://wa.me/${C.rsvp.whatsapp}?text=${encodeURIComponent(C.rsvp.text.replace('{name}', n))}`;
}
applyName();
document.querySelectorAll('[data-c]').forEach(e => { e.textContent = C.event[e.dataset.c] || ''; });
if (C.event.mapUrl) { const m = $('#map'); m.href = C.event.mapUrl; m.hidden = false; }
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
const chips = list => list.map(([en]) => `<span class="chip">${en.toLowerCase()}</span>`).join('');
const half = Math.ceil(STALLS.length / 2);
const CHATPATI = ['scratch the patriarchy', 'namaslayyyy', 'no nazar, thu thu', 'kabhi khushi, kabhi rum',
  "aao sis, let's chuglyyyy", 'love urself diva', 'coca-patola', 'khushi-khabri', "i'm just a naari", 'nakhre maxxing', 'spicy par pyaari'];
$('#row3').innerHTML = CHATPATI.map(t => `<span>${t}</span>`).join('').repeat(2);

/* ───────────── assets ───────────── */
const IMG = {};
const loadImg = (k, src) => new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = res; i.src = src; });
const CONF = Array.from({ length: 32 }, (_, i) => 'c' + String(i + 1).padStart(2, '0'));
// loader: everything the opening needs is fetched AND decoded before the scene starts, so the first tap never waits on the network
let ldDone = 0, ldTotal = 0;
const ldTick = () => { ldDone++; if (window.__ldr) window.__ldr(ldDone / ldTotal); };
const counted = p => { ldTotal++; return Promise.resolve(p).catch(() => {}).then(ldTick); };
const warmImg = src => new Promise(res => { const i = new Image(); i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(res); i.onerror = res; i.src = src; });
const assetsReady = Promise.all([
  counted(loadImg('env', 'assets/envelope.webp')), counted(loadImg('nl', 'assets/nailinit.webp')), counted(loadImg('dot', 'assets/dot_dark.webp')), counted(loadImg('diwali', 'assets/diwali_blue.webp')),
  ...['mb_sleeve', 'mb_tray', 'match', 'invite_card', 'swag', 'k1', 'k2', 'k3', 'k4', 'foil_gold', 'foil_blue', 'foil_ink', 'paper_yellow'].map(n => counted(warmImg(`assets/${n}.webp`))),
  ...['slide1', 'strike1', 'strike2', 'flame1', 'catch1', 'burn1', 'reveal1', 'poppers1'].map(n => counted(fetch(`assets/sfx/${n}.mp3`))),   // into the HTTP cache; decoded on first tap
]);
CONF.forEach(k => loadImg(k, `assets/conf/${k}.webp`));                          // confetti isn't needed until the reveal: never block on it
const fontsReady = Promise.all(['600 20px "Teko Display"', '500 20px "Teko Text"', '600 20px "Teko Text"', '700 20px "Palanquin Dark"', '20px "Bakbak One"', '700 20px "Barlow Condensed"', '500 20px "Barlow"']
  .map(f => counted(document.fonts ? document.fonts.load(f, 'सेवा में Aa') : 0))).catch(() => {});

/* ───────────── elements & layout ───────────── */
const stage = $('#stage'), envC = $('#env'), card = $('#card');
const boxEl = $('#box'), drawer = boxEl.querySelector('.drawer');
const matchEl = $('#match'), fxC = $('#fx'), fx = fxC.getContext('2d');
const decorEl = $('#decor'), nightEl = $('#night'), nctx = nightEl.getContext('2d'), glowEl = $('#glow'), capEl = $('#caption'), nameEl = $('#cardname'), ghost = $('#ghost');
const autoBtn = $('#autobtn'), afterEl = $('#after'), stepsEl = [...document.querySelectorAll('#steps li')];
const css = (el, k, v) => el.style.setProperty(k, v);

let vw = 0, vh = 0, dpr = 1, lastEnvW = 0, wide = false;
const E = {}, EB = {}, EZ = {}, B = {}, M = {}, C2 = {};
let zoom = 0, RS = 2;                                         // envelope zoom (0 = resting, 1 = lit close-up)
const tilt = { x: 0, y: 0, px: 0, py: 0 };
const ENV_AR = 1600 / 866, POSTER_AR = 1400 / 692, SLEEVE_AR = 1000 / 625, DRAWER = .253;
const ORIGIN = [.05, .9];

function setE() {
  const z = ease(clamp(zoom));
  E.w = lerp(EB.w, EZ.w, z); E.h = E.w / ENV_AR;
  E.cx = lerp(EB.cx, EZ.cx, z); E.cy = lerp(EB.cy, EZ.cy, z);
  E.x = E.cx - E.w / 2; E.y = E.cy - E.h / 2; E.s = E.w / EB.w;
}
function layout() {
  vw = stage.clientWidth; vh = stage.clientHeight;
  if (vw < 50 || vh < 50) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  wide = vw / vh > 1.15;

  // envelope
  const ew = wide ? Math.min(vw * .44, 640, vh * .42 * ENV_AR) : Math.min(vw * .9, 600, vh * .27 * ENV_AR);
  Object.assign(EB, { w: ew, h: ew / ENV_AR, cx: wide ? vw * .58 : vw / 2, cy: wide ? vh * .52 : vh * .39 });
  // once the match is lit, the envelope comes forward and fills the frame
  const zw = wide ? Math.min(vw * .66, vh * .64 * ENV_AR, 1100) : Math.min(vw * .97, vh * .4 * ENV_AR);
  Object.assign(EZ, { w: zw, cx: vw / 2, cy: wide ? vh * .5 : vh * .42 });
  RS = Math.min(2.2, dpr * Math.max(1, EZ.w / EB.w));
  setE();
  css(envC, '--ew', EB.w + 'px'); css(envC, '--eh', EB.h + 'px');

  // the AAO poster: starts inside the envelope, grows into the hero
  C2.w = EB.w * .86; C2.h = C2.w / POSTER_AR;
  C2.fh = Math.min(vh * .5, (vw * .94) / POSTER_AR, 460); C2.fs = C2.fh / C2.h;
  C2.fy = clamp(vh * .45, C2.fh / 2 + 84, vh - C2.fh / 2 - 120);
  css(card, '--cw', C2.w + 'px'); css(card, '--ch', C2.h + 'px');
  css(nameEl, '--ny', (C2.fy + C2.fh / 2 + 20) + 'px');

  // matchbox
  const bw = wide ? Math.min(vw * .24, 360) : Math.min(vw * .56, 300), bh = bw / SLEEVE_AR;
  Object.assign(B, wide
    ? { w: bw, h: bh, cx: Math.max(bw * .6 + 24, EB.cx - EB.w / 2 - bw * .62), cy: EB.cy + EB.h * .42 }   // left of the envelope, by the corner that burns
    : { w: bw, h: bh, cx: vw * .5 - bw * .1, cy: Math.min(vh - bh / 2 - 150, EB.cy + EB.h / 2 + (vh - EB.cy - EB.h / 2) * .42) });
  css(boxEl, '--bw', bw + 'px'); css(boxEl, '--bh', bh + 'px');

  M.L = bw * .82; M.mh = M.L / 10.6; M.st = Math.max(6, M.mh); M.h = M.L * .455;   // head centre sits ~45% of the length from the middle
  css(matchEl, '--L', M.L + 'px'); css(matchEl, '--st', M.st + 'px');

  fxC.width = Math.round(vw * dpr); fxC.height = Math.round(vh * dpr);
  nightEl.width = Math.round(vw * dpr * .5); nightEl.height = Math.round(vh * dpr * .5);
  buildDecor();
  if (Math.abs(lastEnvW - EB.w) > 1) { lastEnvW = EB.w; envDirty = true; }
}

/* kandils + marigold strings hanging from the top edge */
function buildDecor() {
  const box = $('#decor');
  const n = wide ? Math.max(5, Math.round(vw / 260)) : 3;
  const top = Math.min(110, vw * .14) * .62;
  let h = '';
  for (let i = 0; i < n; i++) {
    const x = (i + .5) / n * 100;
    const drop = top + ((i * 37) % (wide ? 70 : 36));
    const w = wide ? 92 : 60;
    const sw = (3.4 + (i * .71) % 1.9).toFixed(2), d = (-i * .63).toFixed(2);
    h += `<div class="hang kandil" style="left:${x}%;--drop:${drop}px;--w:${w}px;--sw:${sw}s;--d:${d}s">` +
      `<i class="cord"></i><span class="lamp"><img class="bloom" src="assets/k${1 + i % 4}.webp" alt=""><img src="assets/k${1 + i % 4}.webp" alt=""></span></div>`;
  }
  box.innerHTML = h;
}

/* ───────────── envelope artwork → texture ───────────── */
const envArt = document.createElement('canvas'), ea = envArt.getContext('2d');
let envDirty = true;
function drawEnvelope() {
  const W = EB.w, H = EB.h, u = W / 100, x = ea;
  envArt.width = Math.round(W * RS); envArt.height = Math.round(H * RS);
  x.setTransform(RS, 0, 0, RS, 0, 0);
  x.clearRect(0, 0, W, H);
  if (IMG.env) x.drawImage(IMG.env, 0, 0, W, H);
  x.textBaseline = 'alphabetic';

  // the pasted label: सेवा में, + the guest's name in Bakbak with the deck's red drop shadow
  const L0 = { x: W * .263, y: H * .659, w: W * .473, h: H * .228 };
  x.textAlign = 'left'; x.fillStyle = '#c4221a'; x.font = `700 ${u * 2.4}px "Palanquin Dark"`;
  x.fillText('namastey,', L0.x + u * 2.8, L0.y + u * 3.5);
  const label = FIRST() || C.defaultName;
  let fs = u * 5.2; x.font = `400 ${fs}px "Bakbak One"`;
  while (x.measureText(label).width > L0.w - u * 6 && fs > u * 3) { fs -= .5; x.font = `400 ${fs}px "Bakbak One"`; }
  const nx = L0.x + L0.w / 2, ny = L0.y + u * 8.7;
  x.textAlign = 'center'; x.fillStyle = '#75150f'; x.font = `600 ${u * 1.9}px "Palanquin Dark"`;
  x.fillText('mohalla no 26. khushiyon wali gali', nx, L0.y + L0.h - u * 1.1);
  x.font = `400 ${fs}px "Bakbak One"`;
  x.textAlign = 'center';
  // gold foil, hot-stamped: debossed shadow, metallic fill, a bright top edge
  x.fillStyle = 'rgba(110,20,10,.85)'; x.fillText(label, nx + u * .3, ny + u * .38);
  const fg = x.createLinearGradient(0, ny - fs * .8, 0, ny + fs * .1);
  fg.addColorStop(0, '#f3d27a'); fg.addColorStop(.3, '#c48a1e'); fg.addColorStop(.5, '#6e3f08'); fg.addColorStop(.64, '#d9a234'); fg.addColorStop(1, '#5a3006');
  x.fillStyle = fg; x.fillText(label, nx, ny);
  x.strokeStyle = 'rgba(255,248,220,.55)'; x.lineWidth = Math.max(.6, u * .08); x.strokeText(label, nx, ny - u * .05);
  x.textAlign = 'left';
  // mask: R = foil (name), G = wax seal
  maskArt.width = envArt.width; maskArt.height = envArt.height;
  const m = maskArt.getContext('2d'); m.setTransform(RS, 0, 0, RS, 0, 0); m.clearRect(0, 0, W, H);
  m.fillStyle = 'rgb(0,0,0)'; m.fillRect(0, 0, W, H);
  m.font = x.font; m.textAlign = 'center'; m.textBaseline = 'alphabetic'; m.font = `400 ${fs}px "Bakbak One"`;
  m.fillStyle = 'rgb(255,0,0)'; m.fillText(label, nx, ny);
  m.globalCompositeOperation = 'lighter';
  const sg = m.createRadialGradient(W * .498, H * .495, 0, W * .498, H * .495, W * .05);
  sg.addColorStop(0, 'rgb(0,255,0)'); sg.addColorStop(.85, 'rgb(0,200,0)'); sg.addColorStop(1, 'rgb(0,0,0)');
  m.fillStyle = sg; m.beginPath(); m.arc(W * .498, H * .495, W * .05, 0, 7); m.fill();
}
const maskArt = document.createElement('canvas');

/* ───────────── burn shader (WebGL, 2D fallback) ───────────── */
let gl = null, glu = {}, tex = null, mtex = null, ctx2d = null;
try { gl = envC.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false }); } catch (e) {}
if (gl) {
  const vs = `attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}`;
  const fs = `precision highp float;varying vec2 v;uniform sampler2D T;uniform sampler2D M;uniform float P,Ti,Li;uniform vec2 O,A,Lp;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
  float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
  void main(){
    vec4 c=texture2D(T,v);
    vec4 mk=texture2D(M,v);
    // foil glint: a bright band sweeping across the hot-stamped name
    float band=smoothstep(.06,0.,abs(fract(v.x*.9+v.y*.35-Ti*.18)-.5)-.0);
    c.rgb+=mk.r*(band*vec3(1.,.95,.75)*.85 + vec3(.06,.04,0.));
    // wax seal: glossy specular that follows the light (the flame)
    vec2 sc=vec2(.498,.495); vec2 dir=normalize((Lp-sc)*A+vec2(1e-4)); vec2 sp=sc+dir/A*.022;
    float spec=exp(-dot((v-sp)*A,(v-sp)*A)/.00012);
    float rim=smoothstep(.0,.6,mk.g)*(1.-smoothstep(.6,1.,mk.g));
    c.rgb+=mk.g/1.*(spec*(.35+Li*.9)*vec3(1.,.92,.85)) + rim*.05;
    c.rgb*=1.-mk.g*.08*(1.-Li);
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
    ['T', 'M', 'P', 'Ti', 'O', 'A', 'Lp', 'Li'].forEach(k => { glu[k] = gl.getUniformLocation(pr, k); });
    mtex = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mtex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.activeTexture(gl.TEXTURE0);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  } catch (err) { console.warn('burn shader', err); gl = null; }
}
if (!gl) ctx2d = envC.getContext('2d');
function uploadEnvelope() {
  if (!(EB.w > 20)) return;
  drawEnvelope();
  envC.width = envArt.width; envC.height = envArt.height;
  if (gl) {
    gl.viewport(0, 0, envC.width, envC.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, envArt);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mtex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskArt);
    gl.activeTexture(gl.TEXTURE0);
  }
  envDirty = false;
}
function renderBurn(b, t) {
  if (gl) {
    gl.uniform1i(glu.T, 0); gl.uniform1i(glu.M, 1); gl.uniform1f(glu.P, b); gl.uniform1f(glu.Ti, t);
    // light position in envelope uv: the flame if lit, else a soft key from the top-left
    const lx = mt.lit ? (mt.x - E.x) / E.w : -.3, ly = mt.lit ? (mt.y - E.y) / E.h : -.4;
    gl.uniform2f(glu.Lp, lx, ly); gl.uniform1f(glu.Li, mt.lit ? 1 : .35);
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
    setTimeout(loadSamples, 0);
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
/* real foley samples (assets/sfx/<name><n>.mp3) layered over the synth; synth is the fallback until they load */
const SFX_N = { strike: 2, slide: 2, sputter: 2, flame: 1, catch: 2, burn: 1, reveal: 2, poppers: 1, riffle: 2, flip: 2, parrot: 4, hop: 2,
  rifle: 2, bpop: 3, tock: 2, ringglass: 2, ringfloor: 2, whoosh: 1, drum: 1, tdrop: 1, unfold: 2, win: 2, tap: 2, pin: 1, fail: 2 };
const BUF = {}, LOOPS = {};
const SFX_FIRST = ['slide', 'strike', 'sputter', 'flame', 'catch', 'burn', 'reveal', 'poppers'];   // the opening needs these; game sounds can wait
function loadGroup(keys) {
  keys.forEach(k => { const n = SFX_N[k]; BUF[k] = BUF[k] || [];
    for (let i = 1; i <= n; i++) fetch(`assets/sfx/${k}${i}.mp3`).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => A.ac.decodeAudioData(b, res, rej))).then(d => BUF[k].push(d)).catch(() => {}); });
}
function loadSamples() {
  if (A.loading || !A.ac) return; A.loading = true;
  loadGroup(SFX_FIRST);
  const rest = Object.keys(SFX_N).filter(k => !SFX_FIRST.includes(k));
  const later = () => loadGroup(rest);                                     // decoding 30+ files mid-animation was a visible hitch
  setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(later, { timeout: 6000 }) : later()), 9000);
}
const SYN = { slide: () => sfx.slide(), sputter: () => sfx.sputter(), strike: () => sfx.ignite(), catch: () => sfx.catch(), poppers: () => sfx.pop(), reveal: () => sfx.bell(660, .9),
  ratchet: () => noiseHit(.025, 'highpass', 4200, 3000, .22), tap: () => noiseHit(.03, 'bandpass', 1800, 1200, .3, 3), win: () => sfx.bell(760, .6) };
function play(name, o = {}) {
  if (!A.ac || !A.on) return;
  const list = BUF[name];
  if (!list || !list.length) { if (SYN[name]) SYN[name](); return; }
  const s = A.ac.createBufferSource(); s.buffer = list[(Math.random() * list.length) | 0];
  s.playbackRate.value = o.rate || (1 + (Math.random() - .5) * .08);
  const g = A.ac.createGain(); g.gain.value = o.vol ?? .8; s.connect(g); g.connect(A.master); s.start(A.ac.currentTime + (o.delay || 0));
}
function loop(name, v) {                 // continuous beds (flame, burn, drum): fade to v
  if (!A.ac) return;
  let L = LOOPS[name];
  if (!L) { if (!v || !BUF[name] || !BUF[name].length) return;
    const s = A.ac.createBufferSource(); s.buffer = BUF[name][0]; s.loop = true;
    const g = A.ac.createGain(); g.gain.value = 0; s.connect(g); g.connect(A.master); s.start(); L = LOOPS[name] = g; }
  L.gain.setTargetAtTime(Math.max(0, v), A.ac.currentTime, .12);
}
function stopAllLoops(except) { Object.keys(LOOPS).forEach(k => { if (k !== except) loop(k, 0); }); }
const sndBtn = $('#snd');
sndBtn.addEventListener('click', () => {
  A.on = !A.on; store.set('mkd:snd', A.on ? '1' : '0');
  sndBtn.classList.toggle('off', !A.on); sndBtn.setAttribute('aria-label', A.on ? 'Sound on' : 'Sound off');
  if (A.master) A.master.gain.setTargetAtTime(A.on ? .9 : 0, A.ac.currentTime, .05);
  MIX.sync();
});
sndBtn.classList.toggle('off', !A.on);
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ───────────── particles, flame, confetti ───────────── */
const parts = [];
const PMAX = matchMedia('(pointer: coarse)').matches ? 320 : 600;            // hard cap so bursts can't snowball on phones
const spawn = o => { if (parts.length < PMAX) parts.push(o); };
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
// value noise for flame turbulence
const _nz = (() => { const p = Array.from({ length: 256 }, () => Math.random()); return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return p[i & 255] * (1 - u) + p[(i + 1) & 255] * u; }; })();
function flameShape(c, x, by, w, h, lx, t, seed) {
  // teardrop with a turbulent, licking tip
  const n1 = _nz(t * 6 + seed) - .5, n2 = _nz(t * 9.3 + seed * 3) - .5, n3 = _nz(t * 14 + seed * 7) - .5;
  const tipX = x + lx + n1 * w * 1.4, tipY = by - h * (1 + n2 * .18);
  const midL = x - w * (1.05 + n3 * .25), midR = x + w * (1.05 - n3 * .25);
  c.beginPath();
  c.moveTo(x, by + w * .55);
  c.bezierCurveTo(x - w * 1.25, by + w * .35, midL + lx * .25, by - h * .38, x + lx * .55 + n2 * w * .6, by - h * .72);
  c.quadraticCurveTo(tipX - w * .12, by - h * .9, tipX, tipY);
  c.quadraticCurveTo(tipX + w * .18, by - h * .86, x + lx * .55 - n2 * w * .4 + w * .3, by - h * .7);
  c.bezierCurveTo(midR + lx * .25, by - h * .38, x + w * 1.25, by + w * .35, x, by + w * .55);
  c.closePath();
}
const FLAME_C = document.createElement('canvas'), FLAME_X = FLAME_C.getContext('2d');
function drawFlame(c, x, y, s, k, t, lean) {
  if (k <= .01) return;
  const fl = .9 + .1 * Math.sin(t * 23) + .07 * Math.sin(t * 37 + 1.3) + .06 * (_nz(t * 8) - .5);
  const h = s * 3.6 * k * fl, w = s * .9 * Math.sqrt(k);
  c.save(); c.globalCompositeOperation = 'lighter';
  // halo
  let g = c.createRadialGradient(x, y - h * .4, 0, x, y - h * .4, h * 3);
  g.addColorStop(0, `rgba(255,180,70,${.42 * Math.min(1, k)})`); g.addColorStop(.35, `rgba(255,120,30,${.16 * Math.min(1, k)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - h * .4, h * 3, 0, 7); c.fill();
  const by = y + w * .2;
  // body layers go to a low-res sprite; drawing it back up-scaled gives the soft edge a blur filter used to (filters are slow, and Safari ignores them)
  const bw = w * 3.2 + Math.abs(lean) * 2, bh = h * 1.35 + w * 1.6, x0 = x - bw / 2 + lean * .5, y0 = by - h * 1.2;
  const q = .5, fc = FLAME_C, sw = Math.max(8, Math.ceil(bw * q)), sh = Math.max(8, Math.ceil(bh * q));
  if (fc.width < sw || fc.height < sh) { fc.width = Math.max(fc.width, sw); fc.height = Math.max(fc.height, sh); }
  const r0 = c; c = FLAME_X; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sw + 2, sh + 2); c.globalCompositeOperation = 'lighter'; c.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
  // outer body: deep orange → red tips
  g = c.createLinearGradient(x, by + w, x + lean, by - h * 1.1);
  g.addColorStop(0, 'rgba(255,120,30,.0)'); g.addColorStop(.12, 'rgba(255,110,25,.85)'); g.addColorStop(.55, 'rgba(255,80,15,.7)'); g.addColorStop(1, 'rgba(200,30,10,0)');
  c.fillStyle = g; flameShape(c, x, by, w * 1.05, h * 1.05, lean, t, 1.7); c.fill();
  // body: amber/yellow
  g = c.createLinearGradient(x, by + w, x + lean, by - h * .9);
  g.addColorStop(0, 'rgba(255,200,90,.2)'); g.addColorStop(.2, 'rgba(255,215,110,.95)'); g.addColorStop(.7, 'rgba(255,160,50,.6)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  c.fillStyle = g; flameShape(c, x, by, w * .78, h * .8, lean * .8, t, 4.2); c.fill();
  // core: near-white
  g = c.createLinearGradient(x, by + w * .4, x, by - h * .45);
  g.addColorStop(0, 'rgba(255,255,240,.95)'); g.addColorStop(.6, 'rgba(255,245,200,.8)'); g.addColorStop(1, 'rgba(255,230,160,0)');
  c.fillStyle = g; flameShape(c, x, by, w * .45, h * .48, lean * .5, t, 9.1); c.fill();
  // blue root at the wick
  g = c.createRadialGradient(x, by + w * .25, 0, x, by + w * .25, w * 1.1);
  g.addColorStop(0, 'rgba(120,160,255,.75)'); g.addColorStop(1, 'rgba(80,110,255,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(x, by + w * .2, w * .9, w * .65, 0, 0, 7); c.fill();
  c = r0; c.imageSmoothingEnabled = true; c.drawImage(FLAME_C, 0, 0, sw, sh, x0, y0, sw / q, sh / q);
  c.restore();
  // a thin smoke wisp off the tip
  if (Math.random() < .35) spawn({ k: 'smoke', x: x + lean + rnd(-2, 2), y: y - h * 1.05, vx: rnd(-8, 8) + lean * .3, vy: rnd(-55, -35), life: 0, max: rnd(.8, 1.4), r: rnd(3, 6) });
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
  gate: '', enter: 'here comes the matchbox…',
  closed: coarse ? 'tap the matchbox' : 'click the matchbox',
  opening: 'taking out a match…', lift: 'taking out a match…',
  strike: coarse ? 'swipe or tap to strike the match' : 'drag or click to strike the match',
  carry: 'lighting your invite…',
  touch: 'it caught!', burn: 'ooh… it burns', reveal: '', done: 'scroll down ↓',
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
  mt.lit = 1; S.fails = 0; S.flash = 1;
  play('strike', { vol: .95 }); buzz(30);
  const d = rad(box.rot - 10);
  sparks(mt.x, mt.y, box.rot - 20, reduced ? 14 : 60, 50);
  setPhase('carry');
  S.carryFrom = { x: mt.x, y: mt.y }; S.settle = !ptr.down;
}

/* pointer handling — one surface, phone and desktop */
function pdown(e) {
  if (S.ph === 'gate' || e.target.closest('button, a, input')) return;
  initAudio(); MIX.prime();
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
    strike.hx = clamp(strike.hx + Math.abs(along) * (coarse ? 1.3 : 1.1), strikeL(), strikeR() + B.w * .12);   // any direction rubs the strip
    strike.travel += Math.abs(along) + Math.abs(dx * -s + dy * c) * .4;
    const h0 = ptr.hist[0], h1 = ptr.hist[ptr.hist.length - 1];
    const v = h1.t > h0.t ? Math.hypot(h1.x - h0.x, h1.y - h0.y) / (h1.t - h0.t) : 0;   // px per ms, any direction
    strike.best = Math.max(strike.best, v);
    if (v > .25) { if (Math.random() < .5) sparks(mt.x, mt.y, box.rot + 170, 1, 30, 60, 220); }
    if (A.sg) A.sg.gain.setTargetAtTime(clamp(v, 0, 2) * .22, A.ac.currentTime, .03);
    const need = S.fails >= 1 ? .18 : .3;                               // forgiving; even more so after a miss
    if (v > need && strike.travel > B.w * (S.fails >= 1 ? .14 : .22)) ignite();
  }
}
function pup(e) {
  if (!ptr.down || (e && e.pointerId !== ptr.id)) return;
  ptr.down = false; strike.pid = null;
  if (A.sg) A.sg.gain.setTargetAtTime(0, A.ac.currentTime, .05);
  if (S.ph === 'strike' && ptr.moved < 10) { S.tapStrike = true; S.tapT = 0; return; }
  if (S.ph === 'strike') {
    if (strike.travel > 6) { S.fails++; play('sputter'); sparks(mt.x, mt.y, box.rot + 180, 6, 40, 40, 160);
      say(S.fails >= 2 ? 'a little faster, or just tap' : 'strike it harder!', 1.8); }
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
stage.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const r = stage.getBoundingClientRect();
  tilt.px = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); tilt.py = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
});
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
function openBox() { if (S.ph !== 'closed') return; play('slide', { vol: .9 }); setPhase('opening'); }
function runAuto() {
  initAudio();
  S.auto = true; autoBtn.classList.add('on');
  if (S.ph === 'closed') openBox();
}
autoBtn.addEventListener('click', () => { MIX.prime(); runAuto(); });

/* ───────────── RSVP → Google Sheet (apps-script/rsvp.gs) ───────────── */
let PHONE = '';
function track(event, extra = {}) {
  const R = C.rsvp;
  if (!R.form) return;
  const data = { event, name: NAME || C.defaultName, phone: PHONE, rsvp: '', link: INV ? 'inv' : (qs.get('name') ? 'name' : 'typed'),
    key: INV ? 'inv:' + INV : 'name:' + (NAME || C.defaultName).toLowerCase(), device: navigator.userAgent.slice(0, 140), ...extra };
  const body = new URLSearchParams();
  Object.entries(R.fields).forEach(([k, entry]) => body.append(entry, data[k] || ''));
  try { fetch(R.form, { method: 'POST', mode: 'no-cors', keepalive: true, body }); } catch (e) {}
}
window.MKDTrack = (ev, extra) => track(ev, extra);
const rsvpAsk = $('#rsvpAsk'), rsvpDone = $('#rsvpDone');
function showRsvp(ans) {
  rsvpAsk.hidden = !!ans; rsvpDone.hidden = !ans;
  if (!ans) return;
  $('#doneHead').textContent = ans === 'yes' ? 'pakka!' : 'next time then.';
  $('#doneMsg').textContent = ans === 'yes' ? `see you ${C.event.dateLong}, ${C.event.time} · ${C.event.venue}` : "we'll miss you at the mohalla.";
  $('#ics').hidden = ans !== 'yes';
}
function answer(ans) {
  const k = 'mkd:rsvp:' + (INV || (NAME || '').toLowerCase());
  store.set(k, ans); showRsvp(ans); track('rsvp', { rsvp: ans });
  if (ans === 'yes') { play('win', { vol: .8 }); buzz(30); } else play('tap');
}
$('#yes').addEventListener('click', () => { initAudio(); answer('yes'); });
$('#no').addEventListener('click', () => answer('no'));
$('#change').addEventListener('click', () => showRsvp(''));
showRsvp(store.get('mkd:rsvp:' + (INV || (NAME || '').toLowerCase())) || '');

/* ───────────── gate ───────────── */
const gate = $('#gate'), gform = $('#gform'), gopen = $('#gopen'), gerr = $('#gerr');
const ERRS = ['hmm, that number doesn\'t match.', 'use the number this invite was sent to.', 'not quite. try once more?'];
let errN = 0;
const needPhone = !!KEY && store.get('mkd:' + KEY) !== '1';
const needName = !NAME;
$('#phoneField').hidden = !needPhone;
$('#nameField').hidden = !needName;
function open() {
  if (S.ph !== 'gate') return;
  if (KEY) store.set('mkd:' + KEY, '1');
  document.body.classList.add('open');
  sndBtn.hidden = false;
  document.activeElement && document.activeElement.blur();
  S.openedAt = performance.now();
  track('open');
  setPhase('enter');
}
gopen.addEventListener('click', open);
gform.addEventListener('submit', e => {
  e.preventDefault();
  if (needName) {
    const n = nice($('#gname').value);
    if (!n) { gerr.textContent = 'tell us your name first!'; return; }
    NAME = n; applyName(); envDirty = true;
  }
  if (!needPhone) { gerr.textContent = ''; open(); return; }
  const v = $('#phone').value;
  if (L.digits(v).length < 10) { gerr.textContent = 'enter all 10 digits.'; return; }
  if (L.keyFor(v, C.salt) === KEY) { gerr.textContent = ''; PHONE = L.digits(v); open(); return; }
  gerr.textContent = ERRS[errN++ % ERRS.length];
  gate.classList.remove('shake'); void gate.offsetWidth; gate.classList.add('shake');
});
$('#replay').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    document.body.classList.add('locked'); afterEl.classList.remove('on');
    burnP = 0; cardT = 0; mt.lit = 0; mt.char = 0; S.auto = false; autoBtn.classList.remove('on'); box.dx = 0; box.off = 1; parts.length = 0; zoom = 0;
    envC.style.visibility = 'visible'; nameEl.classList.remove('on');
    setPhase('enter');
  }, 450);
});
$('#seeDetails').addEventListener('click', () => $('#details').scrollIntoView({ behavior: 'smooth' }));

/* ───────────── frame ───────────── */
let last = performance.now(), ready = false, envShown = true;
B.x0 = 0; B.y0 = 0;
function frame(nowMs) {
  if (!EB.w || vw < 50) { layout(); if (!EB.w) { requestAnimationFrame(frame); return; } envDirty = true; }   // first layout happened at zero size: retry
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (nowMs - last) / 1000); last = nowMs;
  const now = nowMs / 1000;
  if (!ready) return;
  S.t += dt; S.idle += dt;
  if (envDirty) uploadEnvelope();
  B.x0 = B.cx; B.y0 = B.cy;
  const zTarget = ['carry', 'touch', 'burn'].includes(S.ph) ? 1 : (S.ph === 'reveal' || S.ph === 'done') ? zoom : 0;
  zoom = lerp(zoom, zTarget, 1 - Math.exp(-dt * 2.6));
  setE();
  // floating-object feel: slow breathing tilt + bob, leaning toward the cursor
  tilt.x = lerp(tilt.x, Math.sin(now * .7) * 3.2 + tilt.py * -6, .06);
  tilt.y = lerp(tilt.y, Math.cos(now * .55) * 4.2 + tilt.px * 7, .06);
  const bob = reduced ? 0 : Math.sin(now * 1.1) * 4;
  if (reduced) { tilt.x = 0; tilt.y = 0; }

  /* ── advance the story ── */
  const ph = S.ph;
  if (ph === 'enter') { box.off = 1 - eo(clamp((S.t - .45) / .9)); if (S.t > 1.35) setPhase(S.auto ? 'opening' : 'closed'); }
  if (ph === 'closed' && S.auto && S.t > .35) openBox();
  if (ph === 'opening') { box.dx = ease(clamp(S.t / .55)) * DRAWER * B.w; if (S.t > .6) { sfx.pick(); setPhase('lift'); } }
  if (ph === 'strike' && (S.auto || S.tapStrike)) {
    // a confident swipe, played for anyone who taps or asks
    if (S.tapStrike) S.tapT += dt;
    const k = S.auto ? clamp((S.t - .25) / .38) : clamp(S.tapT / .32);
    strike.hx = lerp(strikeL(), strikeR(), k * k);
    if (k > .1 && Math.random() < .7) sparks(mt.x, mt.y, box.rot + 170, 1, 30, 60, 220);
    if (k >= .72) { S.tapStrike = false; ignite(); }
  }
  if (ph === 'carry') {
    const tg = target();
    if (Math.hypot(mt.x - tg.x, mt.y - tg.y) < Math.max(34, E.w * .1)) { play('catch', { vol: .9 }); buzz(20); setPhase('touch'); }
    else if (!ptr.down && (S.auto || S.autoCarry || S.t > 1.1)) S.autoCarry = true;     // goes on its own; dragging is optional
  }
  if (ph === 'touch' && S.t > .7) setPhase('burn');
  if (ph === 'burn') {
    const k = clamp(S.t / 5.6);                // slow enough to watch the paper go
    burnP = .02 + .98 * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    if (k >= 1) { setPhase('reveal'); confettiCannons(); play('poppers', { vol: .8 }); play('reveal', { vol: .9, delay: .12 }); loop('burn', 0); buzz(40); }
  }
  if (ph === 'reveal') { cardT = clamp(S.t / 1.3); if (S.t > 1.6) { setPhase('done'); finish(); } }

  /* ── matchbox pose ── */
  const leaving = ['carry', 'touch', 'burn', 'reveal', 'done'].includes(S.ph);
  const exitK = leaving ? clamp((S.ph === 'carry' ? S.t - .3 : 2) / .7) : 0;
  box.x = B.cx - (wide ? exitK * vw * .4 : 0);
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
    if (!ptr.down && !S.auto && !S.tapStrike) strike.hx = lerp(strike.hx, strikeL(), .2);
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
  if (showEnv) {
    renderBurn(burnP, now);
    const inK = S.openedAt ? eob(clamp((nowMs - S.openedAt) / 900)) : 0, drop = (1 - inK) * -vh * .75;
    envC.style.opacity = S.openedAt ? 1 : 0;
    envC.style.transform = `translate(${E.cx - EB.w / 2}px,${E.cy - EB.h / 2 + bob + drop}px) perspective(1100px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) rotate(${((1 - inK) * -14).toFixed(2)}deg) scale(${E.s.toFixed(4)})`;
    // a fixed shadow: rewriting drop-shadow every frame re-blurs the whole envelope layer (was the main lag)
    if (!envC.dataset.sh) { envC.dataset.sh = 1; envC.style.filter = 'drop-shadow(0 20px 26px rgba(40,4,2,.5)) drop-shadow(0 2px 3px rgba(40,4,2,.4))'; }
  }
  card.style.visibility = burnP > 0 ? 'visible' : 'hidden';
  const rv = eob(cardT);
  const ccx = lerp(E.cx, vw / 2, eo(cardT)), ccy = lerp(E.cy, C2.fy, eo(cardT)) + bob * (.4 + cardT * .6);
  const ctx3 = cardT > 0 ? tilt.x * (.6 + cardT * .5) : 0, cty3 = cardT > 0 ? tilt.y * (.6 + cardT * .5) : 0;
  card.style.transform = `translate(${ccx - C2.w / 2}px,${ccy - C2.h / 2}px) perspective(1200px) rotateX(${ctx3.toFixed(2)}deg) rotateY(${cty3.toFixed(2)}deg) scale(${lerp(E.s, C2.fs, rv).toFixed(4)}) rotate(${lerp(-4, 0, eo(cardT)).toFixed(2)}deg)`;
  if (!card.dataset.sh) { card.dataset.sh = 1; card.style.filter = 'drop-shadow(0 22px 30px rgba(40,4,2,.55))'; }
  nameEl.style.transform = nameEl.classList.contains('on') ? `translateY(${(bob * .5).toFixed(1)}px)` : '';

  /* ── light ── */
  const burning = burnP > 0 && burnP < 1 ? Math.sin(Math.PI * burnP) : 0;
  light = lerp(light, Math.min(1, fk * .7 + burning + cardT * .6), .1);
  const gx = burning > .05 ? E.cx : mt.x, gy = burning > .05 ? E.cy : mt.y;
  glowEl.style.transform = `translate(${gx.toFixed(0)}px,${gy.toFixed(0)}px) translate(-50%,-50%) scale(${(.7 + .5 * burning + .25 * fk).toFixed(3)})`;   // compositor only
  const go = Math.min(1, fk * .5 + burning * .85).toFixed(2); if (go !== glowEl._o) { glowEl._o = go; glowEl.style.opacity = go; }
  const lq = (Math.round(light * 40) / 40).toFixed(3);                          // only the kandils read this; scoped + rounded so it rarely restyles
  if (lq !== S.litQ) { S.litQ = lq; css(decorEl || document.documentElement, '--lit', lq); }
  // night from the first frame; the match (then the burning paper) is the only real light
  // the room only ever gets brighter once the paper catches: darkness lifts with the burn, never dips before the reveal
  const lift = ['reveal', 'done'].includes(S.ph) ? 1 : burnP > 0 ? clamp((burnP - .45) / .5) : 0;
  const dark = 1 - lift;
  S.dark = dark < (S.dark ?? 1) ? lerp(S.dark ?? 1, dark, .06) : (lift > 0 ? S.dark : lerp(S.dark ?? 1, dark, .08));
  S.flash = Math.max(0, (S.flash || 0) - dt * 3.2);
  const flick = .86 + .1 * Math.sin(now * 23) + .07 * Math.sin(now * 37 + 1.3) + .05 * Math.sin(now * 11.7 + .4);
  const lights = [];
  if (['gate', 'enter', 'closed', 'opening', 'lift', 'strike'].includes(S.ph) && !mt.lit) lights.push({ x: box.x, y: box.y, r: Math.max(B.w * 1.3, 190), a: .62 }, { x: E.cx, y: E.cy, r: E.w * .75, a: .28 });
  if (fk > .01) lights.push({ x: mt.x, y: mt.y - M.st, r: (Math.min(vw, vh) * .34 + 60) * Math.min(1.25, fk) * flick, a: .97 });
  if (S.flash > 0) lights.push({ x: mt.x, y: mt.y, r: Math.min(vw, vh) * .8 * S.flash, a: S.flash });
  if (burning > .02) { const n = 4; for (let i = 0; i < n; i++) { const q = burnFront(burnP); if (q) lights.push({ x: q.x, y: q.y, r: E.w * (.45 + burning * .5) * flick, a: .7 }); } lights.push({ x: E.cx, y: E.cy, r: E.w * (.75 + burning * .6), a: .92 * Math.max(.55, burning) }); }
  const nw = nightEl.width, nh = nightEl.height, ns = nw / vw;
  nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.globalCompositeOperation = 'source-over'; nctx.clearRect(0, 0, nw, nh);
  if (S.dark > .005) {
    nctx.fillStyle = `rgba(9,2,3,${(.93 * S.dark).toFixed(3)})`; nctx.fillRect(0, 0, nw, nh);
    nctx.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      if (!(isFinite(L.x) && isFinite(L.y) && L.r > 0)) continue;   // never let one bad light kill the frame
      const g = nctx.createRadialGradient(L.x * ns, L.y * ns, 0, L.x * ns, L.y * ns, L.r * ns);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(.45, `rgba(0,0,0,${L.a * .7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = g; nctx.beginPath(); nctx.arc(L.x * ns, L.y * ns, L.r * ns, 0, 7); nctx.fill();
    }
  }
  nightEl.style.opacity = 1;
  // warm light colour on whatever the flame touches
  css(glowEl, '--gx', gx + 'px'); css(glowEl, '--gy', gy + 'px');
  glowEl.style.opacity = Math.min(1, fk * .75 * flick + burning * .9 + S.flash * .8).toFixed(3);
  document.body.classList.toggle('lit', S.dark < .5);

  /* ── caption, ghost hint, auto button ── */
  let cap = performance.now() < capUntil ? capOverride : CAPS[S.ph] || '';
  if (S.auto && ['closed', 'strike', 'carry'].includes(S.ph)) cap = CAPS[S.ph].replace(/→$/, '');
  if (cap !== lastCap) {
    lastCap = cap; capEl.classList.add('swap');
    setTimeout(() => { capEl.firstChild.textContent = cap; capEl.classList.remove('swap'); }, 200);
  }
  const stepOf = { closed: 0, enter: 0, opening: 1, lift: 1, strike: 1, carry: 2, touch: 2, burn: 2, reveal: 3, done: 3 }[S.ph] ?? -1;
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
    // per-second rates (not per-frame), so 120Hz phones don't double the particle load
    const nE = poisson(110 * rate * dt), nS = poisson(14 * rate * dt), nA = poisson(12 * rate * dt);
    for (let i = 0; i < nE; i++) { const q = burnFront(burnP); if (q) spawn({ k: 'ember', x: q.x, y: q.y, vx: rnd(-30, 30), vy: rnd(-150, -40), life: 0, max: rnd(.7, 1.8), r: rnd(.9, 2.6), ph: rnd(0, 9) }); }
    for (let i = 0; i < nS; i++) { const q = burnFront(burnP); if (q) spawn({ k: 'smoke', x: q.x, y: q.y, vx: rnd(-10, 10), vy: rnd(-60, -25), life: 0, max: rnd(1.4, 2.4), r: rnd(11, 19) }); }
    for (let i = 0; i < nA; i++) { const q = burnFront(burnP); if (q) spawn({ k: 'ash', x: q.x, y: q.y, vx: rnd(-20, 20), vy: rnd(-50, 10), life: 0, max: rnd(1.8, 3), r: rnd(1.2, 3), a: rnd(0, 6), va: rnd(-5, 5) }); }
    if (A.ac && Math.random() < dt * 30) sfx.crackle();
  }
  if (S.ph === 'done' || S.ph === 'reveal') petalRain(dt);
  stepParticles(ctx, dt, now);
  drawFlame(ctx, mt.x, mt.y, M.st * 1.5, fk, now, mt.lean + Math.sin(now * 3.1) * M.st * .18);
  if (A.ac) { const hasS = BUF.flame && BUF.flame.length; A.fg.gain.setTargetAtTime((hasS ? .25 : 1) * Math.max(fk * .3, burning) * .3, A.ac.currentTime, .12);
    loop('flame', fk * .7 * (1 - burning)); loop('burn', burning * 1.1); }
}

const poisson = m => { let n = Math.floor(m); if (Math.random() < m - n) n++; return n; };
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
  MIX.start();                              // the party starts when the invite is revealed
  document.body.classList.remove('locked');
  afterEl.classList.add('on');
  nameEl.classList.add('on');
  store.set('mkd:done', '1');
}

/* ───────────── mohalla diwali mix: a YouTube set, visible bottom-right (YouTube needs the player on screen) ───────────── */
const MIX = (() => {
  // audio-only: the YouTube player is mounted invisibly and driven through its API; the pill is the only UI.
  // phones only allow sound inside a tap, so: start MUTED on the first tap of the opening, unmute at the reveal,
  // and if a phone still refuses, the next tap anywhere turns the sound on.
  const cfg = (window.MKD && window.MKD.music) || {}, el = $('#mix');
  const songs = cfg.songs || (cfg.youtube ? [cfg.youtube] : []);
  if ((!songs.length && !cfg.playlist) || !el) return { start() {}, sync() {}, prime() {} };
  let player = null, ready = false, primed = false, revealed = false, userPaused = false, needTap = false;
  const pill = $('#mxPlay'), ic = $('#mxIc'), title = cfg.title || 'mohalla diwali mix', START = cfg.start || 0;
  $('#mxTitle').textContent = title;
  $('#mxLink').href = cfg.playlist ? `https://www.youtube.com/playlist?list=${cfg.playlist}` : `https://www.youtube.com/watch?v=${songs[0]}&t=${START}s`;
  const playing = () => ready && player.getPlayerState && player.getPlayerState() === 1;
  const audible = () => playing() && !player.isMuted();
  const ui = () => {
    const on = audible(); el.classList.toggle('on', on); el.classList.toggle('tap', needTap && !on);
    ic.textContent = on ? '❚❚' : '▶'; $('#mxTitle').textContent = needTap && !on ? 'tap for sound 🔊' : title;
    pill.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  };
  function load() {
    if (window.YT && window.YT.Player) return make();
    window.onYouTubeIframeAPIReady = make;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  }
  function make() {
    if (player) return;
    const pv = { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3, loop: 1, start: START };
    if (cfg.playlist) Object.assign(pv, { listType: 'playlist', list: cfg.playlist });
    else pv.playlist = songs.join(',');
    player = new YT.Player('mxPlayer', { ...(cfg.playlist ? {} : { videoId: songs[0] }), width: '200', height: '200', playerVars: pv,
      events: { onReady: () => { ready = true; player.setVolume(cfg.volume || 45); if (primed) warm(); if (revealed) loud(); ui(); },
        onStateChange: e => { if (e.data === 1 && hush && !revealed) player.mute(); ui(); } } });
  }
  // inside the opening tap: start UNMUTED (that tap is what unlocks sound on phones), silence it the moment it plays
  function warm() { if (!ready || userPaused) return; hush = true; player.setVolume(0); player.unMute(); player.seekTo(START, true); player.playVideo(); }
  let hush = false;
  function loud() {                         // at the reveal: same song, sound up
    if (!ready || userPaused || !A.on) { ui(); return; }
    hush = false; player.seekTo(START, true); player.unMute(); player.setVolume(cfg.volume || 45);   // the song starts at 0:30 on the reveal
    if (!playing()) player.playVideo();
    setTimeout(() => { needTap = !audible() && A.on && !userPaused; ui(); }, 1600);
  }
  // any tap after the reveal counts as permission on strict phones
  document.addEventListener('pointerdown', e => { if (needTap && !e.target.closest('#mix')) { needTap = false; loud(); } }, true);
  pill.addEventListener('click', () => {
    if (!ready) return;
    if (audible()) { userPaused = true; player.pauseVideo(); }
    else { userPaused = false; needTap = false; if (!A.on) sndBtn.click(); player.unMute(); player.playVideo(); setTimeout(() => { needTap = !audible(); ui(); }, 1500); }
    ui();
  });
  setTimeout(load, 600);
  return {
    prime() { if (primed) return; primed = true; warm(); },                       // first tap of the opening (a real gesture)
    start() { revealed = true; el.hidden = false; requestAnimationFrame(() => el.classList.add('in')); if (!primed) { primed = true; warm(); } loud(); },
    sync() { if (!ready || !revealed) return; if (A.on && !userPaused) { player.unMute(); player.playVideo(); } else player.pauseVideo(); },
  };
})();

window.MKDFX = { sfx, initAudio, noiseHit, buzz, play, loop, stopAllLoops, get audio() { return A.ac; } };

/* ───────────── section entrances ───────────── */
(() => {
  const mark = (sel, cls) => document.querySelectorAll(sel).forEach(el => el.classList.add(cls));
  mark('.aao h1, .aao .lede, .games > h2, .games .gc-sub, .wall2 h2, .wall2 .gc-sub, .rsvp h2', 'reveal-text');
  mark('.rsvp-card, .booth', 'reveal-pop');
  mark('.stall', 'reveal-up');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .2 });
  document.querySelectorAll('.reveal-up, .reveal-pop, .reveal-text').forEach(el => io.observe(el));
})();

/* ───────────── toran: spaced marigolds on a string, mango leaves hanging between, each swaying a little ───────────── */
(() => {
  const el = document.querySelector('.bunting'); if (!el) return;
  const build = () => {
    const n = Math.ceil(el.clientWidth / 66) + 1; let h = '<i class="tr-string"></i>';
    for (let i = 0; i < n; i++) {
      const fl = i % 2 ? 'c02' : 'c01', d = (-(i * 0.37) % 3).toFixed(2), sw = (2.6 + (i * 0.53) % 1.6).toFixed(2);
      h += `<span class="tr-g" style="left:${i * 66}px;--d:${d}s;--sw:${sw}s"><img src="assets/conf/${fl}.webp" alt=""></span>`;
      h += `<span class="tr-l" style="left:${i * 66 + 33}px;--d:${(d * 1.3).toFixed(2)}s;--sw:${(+sw + .7).toFixed(2)}s"><img src="assets/conf/c16.webp" alt=""></span>`;
    }
    el.innerHTML = h;
  };
  let w0 = -1; const rb = () => { const w = el.clientWidth; if (w && Math.abs(w - w0) > 20) { w0 = w; build(); } };
  rb(); if (window.ResizeObserver) new ResizeObserver(rb).observe(el); else window.addEventListener('resize', rb);
})();

/* ───────────── boot ───────────── */
let rz;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
layout();
const T0 = performance.now();
Promise.race([Promise.all([assetsReady, fontsReady]), new Promise(r => setTimeout(r, 9000))])   // slow network: never trap them on the loader
  .then(() => {
    uploadEnvelope(); renderBurn(0, 0);     // texture upload + shader compile happen behind the loader, not on the first strike
    if (window.__ldr) window.__ldr(1);
    return new Promise(r => setTimeout(r, Math.max(0, 700 - (performance.now() - T0))));   // no flash of loader on fast connections
  })
  .then(() => {
    ready = true;
    document.body.classList.add('ready');
    document.body.dataset.ph = 'gate';
    const L = document.getElementById('ldr');
    if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); }
    setTimeout(open, 250);                  // no popup: the envelope greets them straight away, as the loader fades
  });
requestAnimationFrame(frame);
})();
