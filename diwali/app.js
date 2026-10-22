(() => {
'use strict';
const C = window.MKD, L = window.MKDLib;
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eo = t => 1 - Math.pow(1 - t, 3);
const ei = t => t * t;
const rad = d => d * Math.PI / 180;
const rnd = (a, b) => a + Math.random() * (b - a);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};

/* ───────────── guest ───────────── */
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
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nailinit//Mohalle ki Diwali//EN', 'BEGIN:VEVENT',
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
const assetsReady = Promise.all([
  loadImg('env', 'assets/envelope.webp'), loadImg('nl', 'assets/nailinit.webp'), loadImg('diwali', 'assets/diwali_blue.webp'),
  loadImg('s1', 'assets/star_pink.webp'), loadImg('s2', 'assets/star_small.webp'), loadImg('s3', 'assets/star_pale.webp'),
  loadImg('f1', 'assets/flower_a.webp'), loadImg('f2', 'assets/flower_b.webp'), loadImg('f3', 'assets/flower_c.webp'),
]);
const fontsReady = Promise.all(['700 20px "Palanquin Dark"', '600 20px "Palanquin Dark"', '20px "Bakbak One"', '600 20px "Clash Display"']
  .map(f => document.fonts ? document.fonts.load(f, 'सेवा में Aa') : 0)).catch(() => {});

/* ───────────── elements & layout ───────────── */
const stage = $('#stage'), seq = $('#seq'), envC = $('#env'), card = $('#card');
const boxEl = $('#box'), drawer = boxEl.querySelector('.drawer'), tray = $('#tray');
const matchEl = $('#match'), fxC = $('#fx'), fx = fxC.getContext('2d');
const glowEl = $('#glow'), shadeEl = $('#shade'), capEl = $('#caption'), playEl = $('#play'), nameEl = $('#cardname');
const css = (el, k, v) => el.style.setProperty(k, v);

let vw = 0, vh = 0, dpr = 1, lastEnvW = 0;
const E = {}, B = {}, M = {};
const N_STICKS = 7;

const ENV_AR = 1600 / 788, POSTER_AR = 1000 / 1201, SLEEVE_AR = 1000 / 625, DRAWER = .253;
const C2 = {};
function layout() {
  vw = stage.clientWidth; vh = stage.clientHeight;
  if (vw < 50 || vh < 50) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ew = Math.min(vw * .92, 620, vh * .3 * ENV_AR);
  Object.assign(E, { w: ew, h: ew / ENV_AR, cx: vw / 2, cy: vh * .45 });
  E.x = E.cx - E.w / 2; E.y = E.cy - E.h / 2;
  css(envC, '--ex', E.x + 'px'); css(envC, '--ey', E.y + 'px'); css(envC, '--ew', E.w + 'px'); css(envC, '--eh', E.h + 'px');

  // the AAO poster starts tucked inside the envelope, then grows into the hero
  C2.h = E.h * .9; C2.w = C2.h * POSTER_AR;
  C2.fh = Math.min(vh * .58, (vw * .84) / POSTER_AR, 640); C2.fs = C2.fh / C2.h;
  C2.fy = Math.max(C2.fh / 2 + 70, vh * .43);
  css(card, '--cw', C2.w + 'px'); css(card, '--ch', C2.h + 'px');
  css(nameEl, '--ny', (C2.fy + C2.fh / 2 + 22) + 'px');

  const bw = Math.min(vw * .6, 320, E.w * .62), bh = bw / SLEEVE_AR;
  Object.assign(B, { w: bw, h: bh, cx: Math.max(bw * .5 + 14, vw / 2 - bw * DRAWER * .5), cy: Math.min(vh - bh * .5 - 74, E.y + E.h + (vh - E.y - E.h) * .42) });
  css(boxEl, '--bw', bw + 'px'); css(boxEl, '--bh', bh + 'px');

  M.L = bw * .78; M.st = Math.max(5, bh * .062); M.h = M.L / 2 + M.st * .6;
  css(matchEl, '--L', M.L + 'px'); css(matchEl, '--st', M.st + 'px');

  fxC.width = Math.round(vw * dpr); fxC.height = Math.round(vh * dpr);
  buildBulbs();
  if (Math.abs(lastEnvW - E.w) > 1) { lastEnvW = E.w; envDirty = true; }
}

function buildBulbs() {
  const svg = $('#bulbs'), W = vw, sag = Math.min(52, vh * .06), cols = ['#efbd0d', '#ec5a86', '#2f9790', '#f2bb05', '#1d8cc4'];
  const q = t => ({ x: lerp(-10, W + 10, t), y: 6 + 4 * sag * t * (1 - t) });
  let h = `<defs><filter id="bb" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
  h += `<path d="M-10 6 Q${W / 2} ${6 + sag * 2} ${W + 10} 6" stroke="#3a0a07" stroke-width="2" fill="none"/>`;
  const n = Math.max(8, Math.round(W / 40));
  for (let i = 1; i < n; i++) {
    const p = q(i / n), c = cols[i % cols.length];
    h += `<g class="bulb" style="animation-delay:${(-(i * 0.37) % 2.4).toFixed(2)}s"><circle cx="${p.x}" cy="${p.y + 9}" r="12" fill="${c}" opacity=".45" filter="url(#bb)"/>` +
      `<rect x="${p.x - 2.5}" y="${p.y}" width="5" height="5" fill="#3a2a1e"/><circle cx="${p.x}" cy="${p.y + 9}" r="4.6" fill="${c}"/><circle cx="${p.x - 1.4}" cy="${p.y + 7.6}" r="1.4" fill="#fff" opacity=".7"/></g>`;
  }
  svg.setAttribute('viewBox', `0 0 ${W} 90`);
  svg.innerHTML = h;
}

/* ───────────── envelope artwork (canvas 2D → texture) ───────────── */
const envArt = document.createElement('canvas'), ea = envArt.getContext('2d');
let envDirty = true;
function prng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function cover(c, img, x, y, w, h, fy = .5) {
  if (!img) return;
  const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
  c.drawImage(img, (img.width - sw) / 2, (img.height - sh) * fy, sw, sh, x, y, w, h);
}
function drawEnvelope() {
  const W = E.w, H = E.h, u = W / 100, x = ea;
  envArt.width = Math.round(W * dpr); envArt.height = Math.round(H * dpr);
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  if (IMG.env) x.drawImage(IMG.env, 0, 0, W, H);

  // the deck lockup: nailinit / DIWALI / P A R T Y
  const lx = u * 8.5;
  if (IMG.nl) { const h = u * 3.3; x.drawImage(IMG.nl, lx, u * 6.6, h * IMG.nl.width / IMG.nl.height, h); }
  let dh = 0;
  if (IMG.diwali) { const w = u * 25; dh = w * IMG.diwali.height / IMG.diwali.width; x.drawImage(IMG.diwali, lx - u * .3, u * 10.6, w, dh); }
  x.fillStyle = '#1c1410'; x.font = `600 ${u * 2.3}px "Clash Display", "Barlow Condensed"`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  'PARTY'.split('').forEach((ch, i) => x.fillText(ch, lx + u * 4.4 + i * u * 3.4, u * 10.6 + dh + u * 2.9));

  // address, set in the deck's type: Palanquin Dark + Bakbak One wood-type with red shadow
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

/* ───────────── burn: WebGL (2D fallback) ───────────── */
const ORIGIN = [.05, .9];
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
    float d=length((v-O)*A)/length(A);
    float nz=fb(v*A*4.+vec2(0.,Ti*.04));
    float f=d*.85+nz*.35*min(1.,d*8.);
    float e=P*1.25-f;
    if(P<=0.){gl_FragColor=c;return;}
    if(e>0.){gl_FragColor=vec4(0.);return;}
    vec3 col=c.rgb;
    col=mix(col,col*vec3(.55,.36,.22),smoothstep(-.16,-.04,e));
    col=mix(col,vec3(.07,.035,.02),smoothstep(-.035,-.008,e));
    float fl=.65+.35*n(v*A*40.+Ti*4.);
    vec3 em=mix(vec3(1.,.32,.04),vec3(1.,.86,.45),smoothstep(-.012,0.,e));
    col+=em*smoothstep(-.022,0.,e)*2.2*fl;
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

/* ───────────── timeline ───────────── */
const T = { enter: [0, .09], drawer: [.08, .17], pull: [.17, .22], lift: [.22, .28], strike: [.28, .36], flick: [.36, .40],
  travel: [.40, .50], burn: [.53, .84], away: [.55, .68], reveal: [.84, .95], exit: [.42, .52] };
const P_IGN = T.strike[0] + (T.strike[1] - T.strike[0]) * .72;
const CAPS = [[.015, 'Chitthi aayi hai!'], [.17, 'Maachis nikaalo…'], [.28, 'Ek teeli nikaalo'], [.40, 'Ek teeli, ek ragad!'],
  [.53, 'Ab chitthi ko aag lagao'], [.84, 'Jal rahi hai… nazar na lage!'], [2, 'Aapka amantran, neeche ↓']];

function boxPose(p) {
  const e = eo(seg(p, ...T.enter)), x = ease(seg(p, ...T.exit));
  return { cx: B.cx, cy: B.cy + (1 - e) * vh * .6 + x * vh * .5, rot: lerp(-16, -5, e), op: 1 - x, dx: ease(seg(p, ...T.drawer)) * DRAWER * B.w };
}
function bpt(bp, lx, ly) {
  const c = Math.cos(rad(bp.rot)), s = Math.sin(rad(bp.rot));
  return { x: bp.cx + lx * c - ly * s, y: bp.cy + lx * s + ly * c };
}
// head position + angle (deg) + lift scale for the loose match
function matchPose(p, bp, now) {
  const dxFull = DRAWER * B.w, hy = -B.h * .33;
  const headX0 = B.w / 2 + dxFull - B.w * .035;           // top stick's head, in the open drawer
  const pull = M.L * .72;
  const sy = -B.h / 2 + B.h * .035;                        // top striker strip
  const K = {
    tray: () => ({ ...bpt(bp, headX0, hy), a: bp.rot, s: 1 }),
    pulled: () => ({ ...bpt(bp, headX0 + pull, hy), a: bp.rot, s: 1 }),
    ready: () => ({ ...bpt(bp, -.3 * B.w, sy), a: bp.rot - 24, s: 1.08 }),
    struck: () => ({ ...bpt(bp, .44 * B.w, sy), a: bp.rot - 18, s: 1.08 }),
    up: () => ({ ...bpt(bp, .3 * B.w, -1.6 * B.h), a: -44, s: 1.1 }),
    corner: () => ({ x: E.x + E.w * ORIGIN[0] - 4, y: E.y + E.h * ORIGIN[1] + 7, a: -38, s: 1.1 }),
    gone: () => ({ x: -M.L * .2, y: E.y + E.h * 1.45, a: -72, s: 1 }),
  };
  const mix = (A, Bp, t) => ({ x: lerp(A.x, Bp.x, t), y: lerp(A.y, Bp.y, t), a: lerp(A.a, Bp.a, t), s: lerp(A.s, Bp.s, t) });
  let pose, clip = 0;
  if (p < T.pull[1]) {
    const t = ease(seg(p, ...T.pull)), hx = headX0 + pull * t;
    pose = { ...bpt(bp, hx, hy), a: bp.rot, s: 1 };
    clip = clamp(B.w / 2 - (hx - M.h - M.L / 2), 0, M.L);  // hide what's still under the sleeve
  }
  else if (p < T.lift[1]) pose = mix(K.pulled(), K.ready(), ease(seg(p, ...T.lift)));
  else if (p < T.strike[1]) pose = mix(K.ready(), K.struck(), ei(seg(p, ...T.strike)));
  else if (p < T.flick[1]) pose = mix(K.struck(), K.up(), eo(seg(p, ...T.flick)));
  else if (p < T.travel[1]) pose = mix(K.up(), K.corner(), ease(seg(p, ...T.travel)));
  else if (p < T.away[0]) { pose = K.corner(); pose.x += Math.sin(now * 9) * 1.2; pose.y += Math.cos(now * 7) * 1; }
  else pose = mix(K.corner(), K.gone(), ei(seg(p, ...T.away)));
  pose.clip = clip;
  return pose;
}
function flameLevel(p) {
  if (p < P_IGN) return 0;
  const k = seg(p, P_IGN, P_IGN + .012), settle = seg(p, P_IGN + .012, P_IGN + .045);
  let f = k < 1 ? eo(k) * 1.6 : lerp(1.6, 1, settle);
  if (p > T.travel[1] - .02) f *= 1 + .25 * seg(p, T.travel[1] - .02, T.travel[1] + .02);
  f *= 1 - seg(p, T.away[0] + .01, T.away[1] - .02);
  return f;
}

/* ───────────── particles & flame ───────────── */
const parts = [];
function spawn(o) { if (parts.length < 900) parts.push(o); }
function sparkBurst(x, y, dir, n) {
  for (let i = 0; i < n; i++) {
    const a = rad(dir + rnd(-55, 55)), sp = rnd(120, 620);
    spawn({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rnd(0, 200), life: 0, max: rnd(.2, .6), w: rnd(.8, 1.8), hue: rnd(32, 55) });
  }
}
function confetti() {
  const pics = [IMG.s1, IMG.s2, IMG.s3, IMG.f1, IMG.f2, IMG.f3].filter(Boolean);
  if (!pics.length) return;
  for (let i = 0; i < (reduced ? 18 : 64); i++) {
    const a = rnd(0, Math.PI * 2), sp = rnd(220, 900), img = pics[i % pics.length];
    spawn({ k: 'conf', img, x: vw / 2 + rnd(-C2.fh * .3, C2.fh * .3), y: C2.fy + rnd(-C2.fh * .3, C2.fh * .1), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 380,
      r: rnd(0, 6), vr: rnd(-6, 6), s: rnd(14, 34), life: 0, max: rnd(1.8, 3) });
  }
}
function burnFront(b) {
  // a point roughly on the shader's burn front (same field, averaged noise)
  const t = b * 1.25, nz = rnd(.25, .75), d = clamp((t - nz * .35) / .85, 0, 1.2);
  const diag = Math.hypot(E.w, E.h), a = rnd(-Math.PI / 2, 0);
  const x = E.x + E.w * ORIGIN[0] + Math.cos(a) * d * diag, y = E.y + E.h * ORIGIN[1] + Math.sin(a) * d * diag * (E.h / E.h);
  if (x < E.x || x > E.x + E.w || y < E.y || y > E.y + E.h) return null;
  return { x, y };
}
function drawFlame(c, x, y, s, k, t, lean) {
  if (k <= .01) return;
  const fl = .92 + .08 * Math.sin(t * 23) + .06 * Math.sin(t * 37 + 1.3) + .05 * Math.sin(t * 11.7);
  const h = s * 3.3 * k * fl, w = s * .95 * Math.sqrt(k);
  c.save(); c.globalCompositeOperation = 'lighter';
  let g = c.createRadialGradient(x, y - h * .35, 0, x, y - h * .35, h * 2.4);
  g.addColorStop(0, `rgba(255,170,60,${.34 * Math.min(1, k)})`); g.addColorStop(1, 'rgba(255,110,30,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - h * .35, h * 2.4, 0, 7); c.fill();
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

/* ───────────── audio (synth, starts on the unlock tap) ───────────── */
const A = { on: store.get('mkd:snd') !== '0' };
function initAudio() {
  if (A.ac) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(); master.gain.value = A.on ? .9 : 0; master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const fire = ac.createBufferSource(); fire.buffer = buf; fire.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const fg = ac.createGain(); fg.gain.value = 0;
    fire.connect(lp); lp.connect(fg); fg.connect(master); fire.start();
    Object.assign(A, { ac, master, buf, fg });
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
  strike() { noiseHit(.2, 'bandpass', 3200, 1100, .9); noiseHit(.75, 'lowpass', 300, 1800, .55, .7, .05); },
  crackle() { noiseHit(rnd(.012, .035), 'highpass', rnd(1200, 3500), 900, rnd(.08, .32)); },
  bell() {
    if (!A.ac) return;
    const ac = A.ac, t = ac.currentTime;
    [[1, .4], [2.76, .18], [5.4, .09], [8.93, .04]].forEach(([r, v]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 520 * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + 2.6 / Math.sqrt(r));
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

/* ───────────── gate ───────────── */
const gate = $('#gate'), gform = $('#gform'), gopen = $('#gopen'), gerr = $('#gerr');
let opened = false;
const ERRS = ['Arre, ye number nahi chalega.', 'Wahi number daalo jis pe invite aaya tha.', 'Nazar lag gayi kya? Ek baar aur try karo.'];
let errN = 0;
if (!KEY || store.get('mkd:' + KEY) === '1') { gform.hidden = true; gopen.hidden = false; }
function open() {
  if (opened) return;
  opened = true;
  initAudio(); if (A.ac && A.ac.state === 'suspended') A.ac.resume();
  sfx.bell();
  if (KEY) store.set('mkd:' + KEY, '1');
  document.body.classList.add('open'); document.body.classList.remove('locked');
  window.scrollTo(0, 0);
  sndBtn.hidden = false;
  document.activeElement && document.activeElement.blur();
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

/* ───────────── auto-play: tap once, we scroll for you ───────────── */
const AUTO_SECONDS = 12;
const auto = { on: false, y: 0, speed: 0 };
function autoStop() { auto.on = false; }
function autoStep(dt) {
  const end = seq.offsetTop + seq.offsetHeight - vh;
  auto.y = Math.min(end, auto.y + auto.speed * dt);
  window.scrollTo(0, auto.y);
  if (auto.y >= end - .5) autoStop();
}
$('#playbtn').addEventListener('click', () => {
  initAudio(); if (A.ac && A.ac.state === 'suspended') A.ac.resume();
  auto.y = window.scrollY; auto.speed = (seq.offsetHeight - vh) / AUTO_SECONDS; auto.on = true;
});
['wheel', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, autoStop, { passive: true }));

/* ───────────── loop ───────────── */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pS = 0, pPrev = 0, last = performance.now(), lastCap = -1, burnShown = true;
const head = { x: 0, y: 0, vx: 0, lean: 0 };
let ready = false;

function progress() {
  const r = seq.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, seq.offsetHeight - vh));
}

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (nowMs - last) / 1000); last = nowMs;
  const now = nowMs / 1000;
  if (!ready) return;
  if (!opened && window.scrollY > 0) window.scrollTo(0, 0);

  const target = opened ? progress() : 0;
  pS += (target - pS) * (1 - Math.exp(-dt * (reduced ? 30 : 9)));
  if (Math.abs(target - pS) < 1e-4) pS = target;
  const p = pS;
  const onScreen = seq.getBoundingClientRect().bottom > 0;

  // one-shot events, forward only
  if (pPrev < P_IGN && p >= P_IGN) {
    sfx.strike(); if (navigator.vibrate) try { navigator.vibrate(25); } catch (e) {}
    sparkBurst(head.x, head.y, -20, reduced ? 12 : 46);
  }
  if (pPrev < T.reveal[0] + .02 && p >= T.reveal[0] + .02) { confetti(); sfx.bell(); }
  if (auto.on) autoStep(dt);
  pPrev = p;
  if (!onScreen) { if (A.fg) A.fg.gain.setTargetAtTime(0, A.ac.currentTime, .1); return; }

  // matchbox
  const bp = boxPose(p);
  boxEl.style.transform = `translate(${bp.cx - B.w / 2}px,${bp.cy - B.h / 2}px) rotate(${bp.rot}deg)`;
  boxEl.style.opacity = bp.op;
  drawer.style.transform = `translateX(${bp.dx}px)`;
  const loose = p >= T.pull[0];

  // the match
  const mp = matchPose(p, bp, now);
  const cx = mp.x - Math.cos(rad(mp.a)) * M.h * mp.s, cy = mp.y - Math.sin(rad(mp.a)) * M.h * mp.s;
  matchEl.style.visibility = loose && p < T.away[1] ? 'visible' : 'hidden';
  matchEl.style.transform = `translate(${cx - M.L / 2}px,${cy - M.st / 2}px) rotate(${mp.a}deg) scale(${mp.s})`;
  matchEl.style.clipPath = mp.clip > 0 ? `inset(-30px -40px -30px ${mp.clip}px)` : 'none';
  css(matchEl, '--lift', (2 + 12 * seg(p, T.lift[0], T.lift[1]) * (1 - seg(p, T.away[0], T.away[1]))) + 'px');
  css(matchEl, '--char', (seg(p, P_IGN + .02, T.away[1]) * .92).toFixed(3));
  const hx = mp.x + Math.cos(rad(mp.a)) * M.st * .3, hy = mp.y + Math.sin(rad(mp.a)) * M.st * .3;
  head.vx = lerp(head.vx, (hx - head.x) / Math.max(dt, .001), .2);
  head.x = hx; head.y = hy;
  head.lean = lerp(head.lean, clamp(-head.vx * .025, -M.st * 2.4, M.st * 2.4), .15);

  // envelope burn
  const b = (() => { const t = seg(p, ...T.burn); return t * t * (3 - 2 * t); })();
  if (envDirty) uploadEnvelope();
  const showEnv = b < .999;
  if (showEnv !== burnShown) { envC.style.visibility = showEnv ? 'visible' : 'hidden'; burnShown = showEnv; }
  if (showEnv) renderBurn(b, now);
  card.style.visibility = p > T.travel[0] ? 'visible' : 'hidden';
  const rv = ease(seg(p, ...T.reveal));
  const ccy = lerp(E.cy, C2.fy, rv);
  css(card, '--cx', (vw / 2 - C2.w / 2) + 'px'); css(card, '--cy', (ccy - C2.h / 2) + 'px');
  css(card, '--cs', lerp(1, C2.fs, rv).toFixed(4));
  nameEl.classList.toggle('on', p > T.reveal[1] - .02);

  // light
  const fk = flameLevel(p);
  const burning = b > 0 && b < 1 ? Math.sin(Math.PI * b) : 0;
  const rev = seg(p, ...T.reveal);
  const lit = Math.min(1, fk * .8 + burning * .9 + rev);
  const gx = burning > .05 ? E.cx : hx, gy = burning > .05 ? E.cy : hy;
  css(glowEl, '--gx', gx + 'px'); css(glowEl, '--gy', gy + 'px');
  css(glowEl, '--gr', (14 + 20 * burning + 10 * fk) + 'vmax');
  glowEl.style.opacity = Math.min(1, fk * .55 + burning * .8 + rev * .25).toFixed(3);
  css(shadeEl, '--gx', gx + 'px'); css(shadeEl, '--gy', gy + 'px');
  css(shadeEl, '--sr', (26 + 30 * lit) + 'vmax');
  shadeEl.style.opacity = Math.max(0, .5 - .45 * lit).toFixed(3);

  // captions + hint
  let ci = CAPS.findIndex(([edge]) => p < edge);
  if (!opened) ci = 0;
  if (ci !== lastCap) {
    lastCap = ci; capEl.classList.add('swap');
    setTimeout(() => { capEl.firstChild.textContent = CAPS[ci][1]; capEl.classList.remove('swap'); }, 220);
  }
  playEl.classList.toggle('on', opened && !auto.on && p < .02);

  // particles
  const ctx = fx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  if (p > T.strike[0] + .03 && p < P_IGN && target > pS && !reduced) {
    if (Math.random() < .6) sparkBurst(head.x, head.y, -30, 1);
  }
  if (b > 0 && b < .98) {
    const rate = reduced ? .3 : 1;
    for (let i = 0; i < 3 * rate; i++) if (Math.random() < .7) { const q = burnFront(b); if (q) spawn({ k: 'ember', x: q.x, y: q.y, vx: rnd(-25, 25), vy: rnd(-130, -40), life: 0, max: rnd(.7, 1.8), r: rnd(.8, 2.4), ph: rnd(0, 9) }); }
    if (Math.random() < .35 * rate) { const q = burnFront(b); if (q) spawn({ k: 'smoke', x: q.x, y: q.y, vx: rnd(-10, 10), vy: rnd(-55, -25), life: 0, max: rnd(1.6, 2.8), r: rnd(8, 16) }); }
    if (Math.random() < .2 * rate) { const q = burnFront(b); if (q) spawn({ k: 'ash', x: q.x, y: q.y, vx: rnd(-20, 20), vy: rnd(-40, 10), life: 0, max: rnd(1.6, 3), r: rnd(1.5, 3.5), a: rnd(0, 6), va: rnd(-4, 4) }); }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const o = parts[i]; o.life += dt;
    if (o.life > o.max) { parts.splice(i, 1); continue; }
    const t = o.life / o.max;
    if (o.k === 'spark') { o.vy += 900 * dt; o.vx *= .985; }
    else if (o.k === 'ember') { o.vx += Math.sin(now * 3 + o.ph) * 30 * dt; o.vy -= 20 * dt; }
    else if (o.k === 'smoke') { o.r += 18 * dt; }
    else if (o.k === 'ash') { o.vy += 30 * dt; o.vx += Math.sin(now * 2 + o.a) * 12 * dt; o.a += o.va * dt; }
    else if (o.k === 'conf') { o.vy += 620 * dt; o.vx *= .985; o.r += o.vr * dt; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.k === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, `rgba(70,50,50,${.13 * (1 - t)})`); g.addColorStop(1, 'rgba(70,50,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    } else if (o.k === 'ash') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); ctx.fillStyle = `rgba(30,18,14,${.8 * (1 - t)})`;
      ctx.fillRect(-o.r, -o.r * .6, o.r * 2, o.r * 1.2); ctx.restore();
    } else if (o.k === 'conf') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = t > .75 ? (1 - t) / .25 : 1; ctx.translate(o.x, o.y); ctx.rotate(o.r);
      const ar = o.img.width / o.img.height; ctx.drawImage(o.img, -o.s * ar / 2, -o.s / 2, o.s * ar, o.s); ctx.restore();
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
  drawFlame(ctx, hx, hy, M.st * 1.55, fk, now, head.lean + Math.sin(now * 3.1) * M.st * .18);

  // fire sound
  if (A.ac) {
    const lvl = Math.max(fk * .35, burning);
    A.fg.gain.setTargetAtTime(lvl * .32, A.ac.currentTime, .12);
    if (Math.random() < lvl * dt * 28) sfx.crackle();
  }
}

/* ───────────── boot ───────────── */
let rz;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
layout();
Promise.all([assetsReady, fontsReady]).then(() => {
  uploadEnvelope(); renderBurn(0, 0);
  ready = true;
  document.body.classList.add('ready');
});
requestAnimationFrame(frame);
})();
