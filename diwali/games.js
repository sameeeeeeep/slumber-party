/* mohalla game center — tota jyotish, gubbara phod, chhalla, lucky draw. Play, find out, share. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rad = d => d * Math.PI / 180;
const FX = () => window.MKDFX || { sfx: {}, initAudio() {}, noiseHit() {}, buzz() {}, audio: null };
const noise = (...a) => { const f = FX(); if (f.audio) f.noiseHit(...a); };
const tick = () => noise(.025, 'highpass', 4200, 3000, .22);
const ding = (hz = 760, v = .6) => { const f = FX(); if (f.sfx.bell) f.sfx.bell(hz, v); };
const pop = () => { noise(.12, 'lowpass', 1600, 200, .9, 1); noise(.3, 'highpass', 5200, 3000, .3, .7, .02); };
const thup = () => noise(.06, 'bandpass', 900, 500, .5, 3);
const clink = () => { noise(.05, 'bandpass', 4800, 4200, .5, 8); noise(.4, 'bandpass', 3100, 3000, .2, 14, .03); };
const start = () => FX().initAudio();
const guide = (id, show) => { const g = document.getElementById(id); if (!g) return; g.classList.toggle('gone', !show); };
let ACTIVE = 'tota';                                   // only the open stall may make noise
const snd = (n, o) => { const f = FX(); if (f.play) f.play(n, o); };
const loopVol = (n, v) => { const f = FX(); if (f.loop) f.loop(n, v); };
const buzz = ms => FX().buzz(ms);
const local = (el, e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };

/* ═════════ share: every result becomes a story-sized card ═════════ */
const SH = {};
const who = () => (window.MKDGuest ? window.MKDGuest.first : 'dost');
const SHARE_URL = 'https://diwali.nailin.it/';
const showShare = k => { const b = document.querySelector(`.share-btn[data-share="${k}"]`); if (b) b.hidden = false; };
const hideShare = k => { const b = document.querySelector(`.share-btn[data-share="${k}"]`); if (b) b.hidden = true; };
const loadI = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function wrap(c, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) c.fillText(line, x, yy); return yy;
}
async function renderShare(k) {
  const d = k === 'invite'
    ? { img: 'assets/invite_card.webp', title: `${who()} is invited!`, text: 'nailinit diwali party · dress loud, gossip louder.', kick: 'chitthi aayi hai' }
    : k === 'gubbara'
      ? { img: 'assets/game/bal1.webp', title: `${who()} popped ${document.querySelectorAll('#glist .win-card').length} balloons and won`, text: [...document.querySelectorAll('#glist .win-card p')].map(p => p.textContent).join(' · '), kick: 'mela balloon shoot' }
      : SH[k];
  if (!d) return null;
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const [bg, swag, k1, k2, art, nl] = await Promise.all(['assets/pattern.webp', 'assets/swag.webp', 'assets/k1.webp', 'assets/k3.webp', d.img, 'assets/nailinit_light.webp'].map(loadI));
  c.fillStyle = '#75150f'; c.fillRect(0, 0, W, H);
  if (bg) { c.globalAlpha = .1; for (let y = 0; y < H; y += 300) for (let x = 0; x < W; x += 300) c.drawImage(bg, x, y, 300, 300); c.globalAlpha = 1; }
  const g = c.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .45, 1100); g.addColorStop(0, 'rgba(255,190,80,.22)'); g.addColorStop(1, 'rgba(20,2,1,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (swag) c.drawImage(swag, -40, -10, W + 80, (W + 80) * swag.height / swag.width);
  if (k1) c.drawImage(k1, 40, 200, 150, 150 * k1.height / k1.width);
  if (k2) c.drawImage(k2, W - 190, 230, 150, 150 * k2.height / k2.width);
  c.textAlign = 'center';
  c.font = '600 40px "Teko Text", sans-serif'; c.fillStyle = '#f7e6c8'; c.fillText(d.kick.toUpperCase().split('').join(' '), W / 2, 470);
  let y = 520;
  if (art && art.width > art.height * 1.4) y = 640;
  if (art) {
    const maxW = k === 'invite' ? 900 : k === 'draw' ? 900 : 620, maxH = 820;
    const s = Math.min(maxW / art.width, maxH / art.height), aw = art.width * s, ah = art.height * s;
    c.save(); c.shadowColor = 'rgba(20,2,1,.55)'; c.shadowBlur = 50; c.shadowOffsetY = 24;
    c.translate(W / 2, y + ah / 2); c.rotate(k === 'tota' ? -.03 : 0); c.drawImage(art, -aw / 2, -ah / 2, aw, ah); c.restore();
    y += ah + 90;
  }
  c.font = '600 104px "Teko Display", sans-serif'; c.fillStyle = '#c4221a'; let yy = wrap(c, d.title, W / 2 + 5, y + 6, 940, 92);
  c.fillStyle = '#efbd0d'; wrap(c, d.title, W / 2, y, 940, 92);
  c.font = '500 46px "Teko Text", sans-serif'; c.fillStyle = '#f7e6c8'; yy = wrap(c, d.text, W / 2, yy + 80, 900, 58);
  if (nl) c.drawImage(nl, W / 2 - 150, H - 230, 300, 300 * nl.height / nl.width);
  c.font = '600 34px "Teko Text", sans-serif'; c.fillStyle = '#efbd0d'; c.fillText('DIWALI PARTY · MOHALLA GAME CENTER', W / 2, H - 120);
  c.fillStyle = '#f7e6c8'; c.font = '500 32px "Teko Text", sans-serif'; c.fillText('diwali.nailin.it', W / 2, H - 76);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return { blob, d };
}
async function shareCard(k) {
  start();
  const out = await renderShare(k); if (!out) return;
  const { blob, d } = out;
  const file = new File([blob], `nailinit-diwali-${k}.png`, { type: 'image/png' });
  const text = k === 'invite' ? `chitthi aayi hai ✉️ nailinit diwali party` : `${d.kick}: ${d.title} 🪔 play at ${SHARE_URL}`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: 'nailinit diwali party' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  toast('image saved, caption copied. post it!');
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 2600);
}
window.MKDShare = { render: renderShare };
const GAME_ICON = { tota: 'assets/game/parrot_card.webp', gubbara: 'assets/game/bal1.webp', chhalla: 'assets/game/bottle0.webp', draw: 'assets/game/drum.webp' };
const GAME_NAME = { tota: 'tota jyotish', gubbara: 'gubbara phod', chhalla: 'ring toss', draw: 'lucky draw' };
const GAME_WHAT = { tota: 'kismat for 2027', gubbara: 'gubbara winnings', chhalla: 'ring toss winnings', draw: 'mood in the coming year' };
const showPin = k => { const b = document.querySelector(`.pin-btn[data-pin="${k}"]`); if (b) { b.hidden = false; b.disabled = false; b.textContent = 'pin to the wall'; } const n = document.querySelector(`.next-btn`) && document.querySelector(`[data-panel="${k}"] .next-btn`); if (n) n.hidden = false; };
const hidePin = k => { const b = document.querySelector(`.pin-btn[data-pin="${k}"]`); if (b) b.hidden = true; const n = document.querySelector(`[data-panel="${k}"] .next-btn`); if (n) n.hidden = true; };
function pinPayload(k) {
  if (k === 'gubbara' || k === 'chhalla') { const wins = [...document.querySelectorAll(k === 'gubbara' ? '#glist .win-card p' : '#clist .win-card p')].map(p => p.textContent);
    return wins.length ? { title: k === 'gubbara' ? `popped ${wins.length} balloon${wins.length > 1 ? 's' : ''}` : `ringed ${wins.length} bottle${wins.length > 1 ? 's' : ''}`, text: wins.join(' · ') } : null; }
  const d = SH[k]; return d ? { title: d.title, text: d.text } : null;
}
const PINNED = {};
function pinIt(k) {
  const p = pinPayload(k); if (!p || PINNED[k] === p.title + p.text) return;
  PINNED[k] = p.title + p.text;
  if (window.MKDTrack) window.MKDTrack('wall', { rsvp: k, link: p.title.slice(0, 80), device: p.text.slice(0, 140) });
  snd('pin', { vol: .9 }); buzz(15);
  addWallCard({ name: window.MKDGuest ? window.MKDGuest.full : 'dost', game: k, title: p.title, text: p.text });
  document.querySelectorAll(`[data-pin="${k}"]`).forEach(x => { x.disabled = true; x.textContent = 'pinned ✓'; });
  toast('pinned to mohalle ki deewar!');
}
document.addEventListener('click', e => {
  const pb = e.target.closest('[data-pin]'); if (pb) { pinIt(pb.dataset.pin); return; }
  const sb = e.target.closest('.mh-card [data-share]'); if (sb) shareCard(sb.dataset.share);
});
/* the haul: every result of the night, pin or share any of it later */
const HAUL = {};
function haul(k, title, text, img) {
  if (!HAUL[k] || HAUL[k].title !== title) { if (window.MKDTrack) window.MKDTrack('play', { rsvp: k, link: String(title).slice(0, 80), device: String(text).slice(0, 140) }); }
  HAUL[k] = { title, text, img };
  const row = $('#mhrow'); row.replaceChildren();
  ['tota', 'gubbara', 'chhalla', 'draw'].forEach(g => { const h = HAUL[g]; if (!h) return;
    const c = document.createElement('div'); c.className = 'mh-card w-' + g;
    const lab = document.createElement('p'); lab.className = 'res-label'; lab.textContent = 'your ' + GAME_WHAT[g];
    const i = document.createElement('img'); i.src = h.img; i.alt = '';
    const t = document.createElement('p'); t.className = 'mh-title'; t.textContent = h.title;
    const x = document.createElement('p'); x.className = 'mh-text'; x.textContent = h.text;
    const acts = document.createElement('div'); acts.className = 'mh-acts';
    const pb = document.createElement('button'); pb.type = 'button'; pb.className = 'sign red small'; pb.dataset.pin = g;
    const pp = pinPayload(g); const done = pp && PINNED[g] === pp.title + pp.text; pb.textContent = done ? 'pinned ✓' : 'pin'; pb.disabled = !!done;
    const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'sign blue small'; sb.dataset.share = g; sb.textContent = 'share';
    acts.append(pb, sb); c.append(lab, i, t, x, acts); row.appendChild(c); });
  $('#myhaul').hidden = false;
  const st = document.querySelector(`.stall[data-game="${k}"]`); if (st) st.classList.add('done');
}

/* wall: published CSV → two moving rows of cards */
function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (ch !== '\r') f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const shortName = n => { const p = String(n || 'dost').trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : ''); };
const hashN = (t, n) => { let h = 0; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % n; };
function wallArt(e) {                          // the illustration that goes with the result
  if (e.game === 'tota') { const f = FORTUNES.find(x => x.title === e.title), im = f ? f.img : LEGACY_K[e.title]; return { src: im ? `assets/cards/${im}.webp?v=2` : GAME_ICON.tota, kind: 'poster' }; }
  if (e.game === 'gubbara') return { src: `assets/game/bal${hashN(e.name + e.title, 8)}.webp`, kind: 'balloon', n: Math.min(4, +((e.title.match(/\d+/) || [1])[0])) };
  if (e.game === 'chhalla') return { src: `assets/game/bottle${hashN(e.name + e.title, 5)}.webp`, kind: 'bottle' };
  return { src: 'assets/game/ticket.webp', kind: 'ticket' };
}
function wallWords(e) {                         // every card says, in plain words, what this result is
  const nm = shortName(e.name), n = +((e.title.match(/\d+/) || [0])[0]);
  if (e.game === 'tota') return { tag: 'tota jyotish', head: `${nm}’s kismat for 2027`, title: e.title, text: e.text };
  if (e.game === 'draw') return { tag: 'lucky draw', head: `${nm}’s mood for 2027`, title: e.title, text: e.text };
  if (e.game === 'gubbara') return { tag: 'balloon shoot', head: n ? `${nm} popped ${n} balloon${n > 1 ? 's' : ''} and won` : `${nm} missed every balloon`, title: '', text: e.text };
  return { tag: 'ring toss', head: n ? `${nm} ringed ${n} bottle${n > 1 ? 's' : ''} and won` : `${nm} vs the banta: the banta won`, title: '', text: e.text };
}
function wallCard(e) {
  const c = document.createElement('div'); c.className = 'wcard w-' + (GAME_ICON[e.game] ? e.game : 'tota');
  const art = document.createElement('div'); const A = wallArt(e); art.className = 'wc-art a-' + A.kind;
  const reps = A.kind === 'balloon' ? Math.max(1, A.n) : 1;
  for (let k = 0; k < reps; k++) { const i = document.createElement('img'); i.src = A.kind === 'balloon' ? `assets/game/bal${(hashN(e.name, 8) + k * 3) % 8}.webp` : A.src; i.alt = ''; i.loading = 'lazy'; i.style.setProperty('--k', k); art.appendChild(i); }
  if (A.kind === 'bottle') { const h = document.createElement('i'); h.className = 'wc-hoop'; art.appendChild(h); }
  if (A.kind === 'ticket') { const t = document.createElement('b'); t.className = 'wc-tix'; const k = document.createElement('small'); k.textContent = 'my mood for 2027'; t.append(k, document.createTextNode(e.title.replace(/[“”]/g, ''))); art.appendChild(t); }
  const W = wallWords(e), body = document.createElement('div'); body.className = 'wc-body';
  const g = document.createElement('span'); g.className = 'wc-game'; g.textContent = W.tag;
  const n = document.createElement('b'); n.className = 'wc-name'; n.textContent = W.head;
  body.append(g, n);
  if (W.title) { const t = document.createElement('p'); t.className = 'wc-title'; t.textContent = W.title; body.appendChild(t); }
  const prizes = (e.game === 'gubbara' || e.game === 'chhalla') ? W.text.split(' · ').map(t => t.trim()).filter(Boolean) : [];
  if (prizes.length > 1) {                      // several prizes: show them one at a time instead of a cramped list
    const rot = document.createElement('div'); rot.className = 'wc-rot'; rot.dataset.n = prizes.length; rot.dataset.i = 0;
    prizes.forEach((t, k) => { const q = document.createElement('p'); q.className = 'wc-text wc-pr' + (k ? '' : ' on'); q.textContent = t; rot.appendChild(q); });
    const dots = document.createElement('span'); dots.className = 'wc-dots'; dots.innerHTML = prizes.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('');
    rot.appendChild(dots); body.appendChild(rot);
    art.querySelectorAll('img')[0]?.classList.add('hl');
  } else { const x = document.createElement('p'); x.className = 'wc-text'; x.textContent = W.text; body.appendChild(x); }
  c.append(art, body); return c;
}
let WALL = [], MINE = [];
// placeholder pins (generic names) so the wall never looks empty; real pins push them out
const SEED = [   // 5 sample cards so the wall never looks empty; real pins come first
  { name: 'Ananya K', game: 'tota', title: 'chai pe charcha', text: 'one long chai conversation in 2027 will change your mind about something big.' },
  { name: 'Kabir M', game: 'draw', title: '“i’m my own good luck charm”', text: 'good things keep finding you all year. you stop acting surprised.' },
  { name: 'Zoya S', game: 'gubbara', title: 'popped 3 balloons', text: 'the aux cord, for exactly one song · the last plate of pani puri · a free pass on one bad decision' },
  { name: 'Rohan P', game: 'chhalla', title: 'ringed 2 bottles', text: 'gossip VIP pass · the good lighting spot' },
  { name: 'Meher A', game: 'tota', title: 'nakhre unlimited', text: '2027 will put up with every one of your nakhre.' },
];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const WS = { x: 0, w: 0, t: 0, v: 38, drag: null, raf: 0 };
function renderWall() {          // one row, every game remixed, drifting forever (drag to scrub)
  const r = $('#wrow1'); if (!r) return;
  const seen = new Set(MINE.map(e => shortName(e.name) + '|' + e.title)), real = WALL.filter(e => !seen.has(shortName(e.name) + '|' + e.title));
  const rest = [...real, ...SEED];
  const all = [...MINE, ...rest];
  $('#wempty').hidden = all.length > 0;
  r.replaceChildren(); WS.w = 0; if (!all.length) return;
  let items = [...MINE, ...real, ...shuffle(SEED)];
  while (items.length < 10) items = items.concat(shuffle(all));
  [...items, ...items].forEach(e => r.appendChild(wallCard(e)));
  requestAnimationFrame(() => { WS.w = r.scrollWidth / 2; });
  if (!WS.raf) WS.raf = requestAnimationFrame(wallLoop);
}
function wallLoop(now) {
  const r = $('#wrow1'), dt = Math.min(.05, (now - (WS.t || now)) / 1000); WS.t = now;
  if (!WS.vis) { WS.raf = requestAnimationFrame(wallLoop); return; }
  if (!WS.drag) WS.x -= WS.v * dt;
  if (WS.w) { WS.x %= WS.w; if (WS.x > 0) WS.x -= WS.w; }
  r.style.transform = `translate3d(${WS.x.toFixed(1)}px,0,0)`;
  WS.raf = requestAnimationFrame(wallLoop);
}
(() => { const tr = $('#wall .w-track'); if (!tr) return;
  tr.addEventListener('pointerdown', e => { WS.drag = { x: e.clientX, x0: WS.x }; });
  tr.addEventListener('pointermove', e => { if (WS.drag) WS.x = WS.drag.x0 + (e.clientX - WS.drag.x); });
  const up = () => { WS.drag = null; }; tr.addEventListener('pointerup', up); tr.addEventListener('pointercancel', up); tr.addEventListener('pointerleave', up);
})();
setInterval(() => {
  if (!WS.vis) return;
  document.querySelectorAll('#wrow1 .wc-rot').forEach(r => {
    const n = +r.dataset.n, i = (+r.dataset.i + 1) % n; r.dataset.i = i;
    r.querySelectorAll('.wc-pr').forEach((q, k) => q.classList.toggle('on', k === i));
    r.querySelectorAll('.wc-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const imgs = r.closest('.wcard').querySelectorAll('.wc-art img'); imgs.forEach((im, k) => im.classList.toggle('hl', k === i % imgs.length));
  });
}, 2600);
function addWallCard(e) { MINE = [e, ...MINE]; WS.x = 0; renderWall(); }
async function loadWall() {
  try {
    const rows = await (await fetch((window.MKD_API || '') + '/api/wall?t=' + Date.now())).json();
    WALL = rows.map(r => ({ time: r.ts, name: r.name, game: r.game, title: r.title, text: r.text || '' }));
    renderWall();
  } catch (e) {}
}

document.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', () => shareCard(b.dataset.share)));

/* ── stall picker: one stall at a time; leaving a stall silences it ── */
const stalls = [...document.querySelectorAll('.stall')];
const DONE = {};
function openStall(g, scroll = true) {
  ACTIVE = g; T.run++; D.vel = 0; D.drag = null; const f = FX(); if (f.stopAllLoops) f.stopAllLoops();
  stalls.forEach(s => s.classList.toggle('on', s.dataset.game === g));
  document.querySelectorAll('.game[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== g; });
  if (g === 'gubbara') { if (DONE.gubbara) gubbaraResume(); else gubbaraReset(); }
  if (g === 'chhalla' && !DONE.chhalla) chhallaReset();
  if (g === 'tota' && (T.busy || !DONE.tota)) { T.busy = false; requestAnimationFrame(totaBuild); $('#tgo').hidden = false; $('#tsub').textContent = 'the deck is ready.'; }
  if (g === 'draw') { if (!D.done) drawReset(); kick(); }
  if (scroll) $('#booth').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
stalls.forEach(st => st.addEventListener('click', () => { start(); snd('tap', { vol: .6 }); openStall(st.dataset.game); }));
/* sticky mini switcher: shows while you're inside the booth and the big stall row is off-screen */
(() => {
  const bar = $('#gbar'), booth = $('#booth'), row = document.querySelector('.stalls-row'); if (!bar || !booth || !row) return;
  let inBooth = false, rowVis = true;
  const sync = () => { const on = inBooth && !rowVis; bar.hidden = false; bar.classList.toggle('on', on); };
  new IntersectionObserver(es => es.forEach(e => { inBooth = e.isIntersecting; sync(); }), { rootMargin: '-60px 0px -40% 0px' }).observe(booth);
  new IntersectionObserver(es => es.forEach(e => { rowVis = e.isIntersecting; sync(); }), { threshold: .15 }).observe(row);
  bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { start(); snd('tap', { vol: .6 }); openStall(b.dataset.game); }));
  const mark = () => bar.querySelectorAll('button').forEach(b => b.classList.toggle('cur', b.dataset.game === ACTIVE));
  setInterval(mark, 400); mark();
})();
document.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
  snd('tap', { vol: .6 });
  if (b.dataset.next === 'haul') { $('#myhaul').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  openStall(b.dataset.next);
}));

/* ═════════ tota jyotish ═════════ */
// the card carries its own words (the poster); the tota's reading for next year sits below
const FORTUNES = [   // generated from content/kismat.py: 10 per illustration, every one a warm 2027 prediction
  { img: 'nakhre', title: 'nakhre unlimited', text: ['2027 will put up with every one of your nakhre. ask for the window seat.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['next year the whole mohalla adjusts to your moods. enjoy it.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['in 2027 your “i’ll think about it” becomes everyone’s final answer.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['every waiter in 2027 gets your order right on the first try.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['next year your playlist wins every car ride.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['in 2027 people will wait for you, and say you were worth it.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['your one raised eyebrow will settle every argument next year.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['2027 says yes to your extra chutney, extra cheese, extra everything.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['next year you’ll be called “high maintenance”. you’ll take it as a compliment.'] },
  { img: 'nakhre', title: 'nakhre unlimited', text: ['in 2027 the best seat at every table quietly becomes yours.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['2027 goes so well for you that people will stare. keep the nimbu-mirchi close.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['someone will be watching your glow-up very closely next year. let them.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['in 2027 your good news will travel faster than your whatsapp status.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['next year your outfits get screenshotted. a lot.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['in 2027 you’ll be the topic of every “have you seen her lately?”'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['mausi will tie a kaala dhaaga on you in 2027. you’ll need it, you’re glowing.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['next year your luck is so good, people will ask for your secret.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['in 2027 the mohalla aunties will finally agree on one thing: you.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['next year your success gets its own fan page in the family group.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ['in 2027 you’ll be so radiant that the diyas get competition.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['a big, spicy plot twist is coming in 2027. you’ll handle it beautifully.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['next year brings a little masala into your life. you’ll love the taste.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['in 2027 you’ll say exactly what you think, and everyone will love it.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['next year your comebacks get sharper and your heart gets softer.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['in 2027 someone will call you “too much”. they’ll mean it as praise.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['next year you’ll add a tadka to every boring plan.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['in 2027 your energy turns a dull party into the night of the year.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['next year one bold decision changes the whole flavour of your life.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['in 2027 you’ll be the hari mirchi in every group: small, sharp, essential.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['next year the people who can handle your spice will stay forever.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['2027 will be full of baraats, sangeets and dance floors. your thumka goes viral (locally).'] },
  { img: 'naacho', title: 'naacho gaao', text: ['you’ll dance at more functions next year than in the last five combined.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['in 2027 the DJ will play your request first. every time.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['next year you’ll learn one choreography and perform it at three weddings.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['in 2027 your dance video gets more views than the couple’s.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['next year every sangeet will need you on the stage.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['in 2027 you’ll dance in the rain, on purpose, more than once.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['next year your naagin dance becomes a family tradition.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['in 2027 the music will find you wherever you go.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['next year your feet will hurt from happiness, not heels.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['some people will turn sour in 2027. the sweet ones stay, and you’ll finally know who’s who.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['next year sorts your people for you. the meethe ones are keepers.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['in 2027 a new sweet friend arrives just when you need one.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['next year your circle gets smaller and much, much sweeter.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['in 2027 someone surprises you with kindness you didn’t expect.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['next year an old friendship comes back, sweeter than before.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['in 2027 your mithai box will never be empty, and neither will your heart.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['next year you’ll be someone’s favourite person, and you’ll know it.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['in 2027 the sweet people multiply. it’s math.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['next year your own sweetness gets returned to you, with interest.'] },
  { img: 'girlies', title: 'the girls club', text: ['your gang grows in 2027. a new best friend is already on the way.'] },
  { img: 'girlies', title: 'the girls club', text: ['a girls’ trip finally leaves the group chat and actually happens next year.'] },
  { img: 'girlies', title: 'the girls club', text: ['in 2027 your girls will hype you up at exactly the right moment.'] },
  { img: 'girlies', title: 'the girls club', text: ['next year brings a sleepover that becomes legend.'] },
  { img: 'girlies', title: 'the girls club', text: ['in 2027 you’ll match outfits with your gang at least once. no regrets.'] },
  { img: 'girlies', title: 'the girls club', text: ['next year your group photo becomes everyone’s favourite dp.'] },
  { img: 'girlies', title: 'the girls club', text: ['in 2027 your friends will celebrate your win louder than you do.'] },
  { img: 'girlies', title: 'the girls club', text: ['next year your girls’ brunch becomes a weekly ritual.'] },
  { img: 'girlies', title: 'the girls club', text: ['in 2027 one late-night call with your best friend fixes everything.'] },
  { img: 'girlies', title: 'the girls club', text: ['next year the girls club gets a new member who fits right in.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['2027 will be filled with gossip to share. some of it might be about you.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['next year you’ll hear everything first. use it wisely. (you won’t.)'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['in 2027 you’ll know about the engagement before the couple does.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['next year the best stories will reach you over chai.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['in 2027 you’ll be the mohalla’s most trusted news source.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['next year one piece of gossip turns out to be very good news.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['in 2027 your “i shouldn’t say this, but…” will start the best conversations.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['next year you’ll be told a secret that makes you smile for a week.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['in 2027 the group chat waits for your reaction before reacting.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ['next year you’ll connect the dots before anyone else does.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['2027 clears out the drama: fake friends leave on their own.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['next year, nonsense stops reaching you. peace, finally.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['in 2027 you’ll stop explaining yourself, and feel lighter for it.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['next year your calendar fills with only the people you love.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['in 2027 your inbox gets quieter and your life gets louder.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['next year the real ones show up, and stay.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['in 2027 you’ll walk out of one boring thing early. it’ll feel amazing.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['next year you’ll spot drama from a mile away, and simply take another lane.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['in 2027 honesty becomes your superpower.'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['next year your energy goes only where it’s celebrated.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['a new door opens in 2027: new home, new job, maybe a new city.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['something you’ve been knocking on for ages finally opens next year.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['in 2027 an unexpected invitation changes your plans for the better.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['next year a “yes” arrives that you’d stopped waiting for.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['in 2027 you’ll walk into a room that changes everything.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['next year someone holds the door open for your big break.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['in 2027 a new chapter starts with one small step.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['next year the right opportunity knocks twice. you’ll answer.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['in 2027 a new neighbourhood will start to feel like home.'] },
  { img: 'door', title: 'darwaaza khulega', text: ['next year one door closes so a much better one can open.'] },
  { img: 'boss', title: 'boss nani era', text: ['2027 deals you a winning hand, and everybody notices. shades on.'] },
  { img: 'boss', title: 'boss nani era', text: ['next year people start taking orders from you. naturally.'] },
  { img: 'boss', title: 'boss nani era', text: ['in 2027 you’ll win the card game and the argument after it.'] },
  { img: 'boss', title: 'boss nani era', text: ['next year your confidence arrives before you do.'] },
  { img: 'boss', title: 'boss nani era', text: ['in 2027 you’ll be the one everyone calls for advice.'] },
  { img: 'boss', title: 'boss nani era', text: ['next year you’ll run the show with a cold drink in hand.'] },
  { img: 'boss', title: 'boss nani era', text: ['in 2027 your style becomes your signature.'] },
  { img: 'boss', title: 'boss nani era', text: ['next year your decisions turn out right, and you won’t even be surprised.'] },
  { img: 'boss', title: 'boss nani era', text: ['in 2027 you play it cool and still win big.'] },
  { img: 'boss', title: 'boss nani era', text: ['next year respect comes to you without asking.'] },
  { img: 'baegum', title: 'baegum', text: ['you’ll be treated like royalty all through 2027.'] },
  { img: 'baegum', title: 'baegum', text: ['next year rolls out the red carpet for you. act surprised.'] },
  { img: 'baegum', title: 'baegum', text: ['in 2027 your entry will make the room go quiet.'] },
  { img: 'baegum', title: 'baegum', text: ['next year the best things will be delivered to your door.'] },
  { img: 'baegum', title: 'baegum', text: ['in 2027 your word becomes law in the family group.'] },
  { img: 'baegum', title: 'baegum', text: ['next year your royal mood is everyone’s weather report.'] },
  { img: 'baegum', title: 'baegum', text: ['in 2027 you’ll get flowers for no reason, more than once.'] },
  { img: 'baegum', title: 'baegum', text: ['next year your court gathers every weekend: chai, gossip, laughter.'] },
  { img: 'baegum', title: 'baegum', text: ['in 2027 you’ll dress like a queen, and be treated like one.'] },
  { img: 'baegum', title: 'baegum', text: ['next year your crown gets a little shinier every month.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['2027 is a big work year, and it pays off before next diwali.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['the hard work finally shows up in your bank account next year.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['in 2027 your focus becomes your superpower.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['next year your boss finally says “great job” and means it.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['in 2027 you finish the thing you’ve been putting off. relief.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['next year your quiet effort gets loud results.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['in 2027 a project you lead becomes the one everyone talks about.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['next year your to-do list actually gets done.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['in 2027 you learn the art of doing less and achieving more.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['next year your work speaks so loudly you won’t have to.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['one long chai conversation in 2027 will change your mind about something big.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['next year’s best decision gets made over a cutting chai.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['in 2027 a chai with an old friend turns into a whole afternoon.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['next year a stranger at a tapri becomes a good friend.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['in 2027 your best ideas arrive with the second cup.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['next year someone will remember exactly how you take your chai.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['in 2027 a rainy-day chai becomes your favourite memory.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['next year your chai sessions solve problems therapy couldn’t.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['in 2027 you’ll find the perfect chai spot, and keep it a secret.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['next year a chai invitation leads somewhere wonderful.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['romance is written in your 2027. pick the good one this time.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['someone will make your heart do a little thumka next year.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['in 2027 a love song will suddenly make a lot of sense.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['next year someone will notice the little things about you.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['in 2027 you’ll get a text that makes you smile at your phone in public.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['next year your love life gets its own background music.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['in 2027 a slow dance at a wedding turns into something more.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['next year someone plans a date just for you, down to your favourite snack.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['in 2027 romance finds you when you’re busy being happy.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['next year love comes with good manners and great timing.'] },
  { img: 'safar', title: 'safar likha hai', text: ['a trip you’ve been postponing will finally happen in 2027.'] },
  { img: 'safar', title: 'passport pe mohar', text: ['your passport will get a new stamp next year. maybe two.'] },
  { img: 'safar', title: 'pahadon ki pukaar', text: ['the mountains will call in 2027, and you’ll pick up.'] },
  { img: 'safar', title: 'samundar milega', text: ['next year a beach will become your happy place.'] },
  { img: 'safar', title: 'solo safar', text: ['in 2027 you’ll take a trip alone and come back a new person.'] },
  { img: 'safar', title: 'window seat wali kismat', text: ['every journey in 2027 gets you the window seat.'] },
  { img: 'safar', title: 'plan pe plan', text: ['the group trip will be planned many times in 2027. the one that happens will be legendary.'] },
  { img: 'safar', title: 'suitcase ready', text: ['next year you’ll pack faster than ever, because you’ll travel more than ever.'] },
  { img: 'safar', title: 'naya sheher', text: ['in 2027 a new city will steal your heart.'] },
  { img: 'safar', title: 'yaadon ka safar', text: ['next year’s trip gives you a photo you’ll keep forever.'] },
  { img: 'ghar', title: 'naya ghar milega', text: ['2027 hands you new keys: a new home, a new room, a new start.'] },
  { img: 'ghar', title: 'apna corner', text: ['next year you’ll build a corner that feels completely yours.'] },
  { img: 'ghar', title: 'griha pravesh', text: ['in 2027 there’s a housewarming with your name on it.'] },
  { img: 'ghar', title: 'ghar sajega', text: ['next year your space gets a glow-up, one fairy light at a time.'] },
  { img: 'ghar', title: 'padosi pyaare', text: ['in 2027 you’ll get the friendliest neighbours on the floor.'] },
  { img: 'ghar', title: 'ghar ki shaan', text: ['next year your home becomes the place everyone wants to visit.'] },
  { img: 'ghar', title: 'chabi tumhari', text: ['2027 puts a new key on your keychain.'] },
  { img: 'ghar', title: 'balcony dreams', text: ['next year you’ll have a balcony, a plant, and a perfect chai spot.'] },
  { img: 'ghar', title: 'ghar ka sukoon', text: ['in 2027 home will feel calmer than it ever has.'] },
  { img: 'ghar', title: 'shift hone ka yog', text: ['next year a move is written, and it’s a good one.'] },
  { img: 'kursi', title: 'kursi milegi', text: ['a promotion, a title, a bigger chair: it’s coming in 2027.'] },
  { img: 'kursi', title: 'boss lady', text: ['next year someone will finally hand you the power.'] },
  { img: 'kursi', title: 'meeting ki maharani', text: ['2027 has a lot of meetings for you. you’ll be the one everyone listens to.'] },
  { img: 'kursi', title: 'corner office', text: ['next year you get a desk with a view, literally or not.'] },
  { img: 'kursi', title: 'naam ka sikka', text: ['in 2027 your name starts to carry weight.'] },
  { img: 'kursi', title: 'salary badhegi', text: ['next year your appraisal will be a pleasant surprise.'] },
  { img: 'kursi', title: 'team ki captain', text: ['in 2027 people will want to be on your team.'] },
  { img: 'kursi', title: 'throne ready', text: ['next year you take your seat at the head of the table.'] },
  { img: 'kursi', title: 'respect milega', text: ['in 2027 your ideas get credit, with your name on them.'] },
  { img: 'kursi', title: 'rani ka raaj', text: ['next year you’ll run things beautifully, sunglasses on.'] },
  { img: 'paisa', title: 'paisa aayega', text: ['money will flow in during 2027 from somewhere you didn’t expect.'] },
  { img: 'paisa', title: 'bank balance smile', text: ['next year your bank balance gives you a pleasant shock. for once.'] },
  { img: 'paisa', title: 'treat yourself year', text: ['money comes in during 2027, and you’ll finally spend some on yourself.'] },
  { img: 'paisa', title: 'lakshmi prasann', text: ['in 2027 every investment you make grows a little.'] },
  { img: 'paisa', title: 'bonus wala saal', text: ['next year an unexpected bonus lands right when you need it.'] },
  { img: 'paisa', title: 'gullak bharegi', text: ['in 2027 your savings jar fills up faster than ever.'] },
  { img: 'paisa', title: 'note hi note', text: ['next year someone finally pays you back. with interest.'] },
  { img: 'paisa', title: 'dhan ki varsha', text: ['2027 rains a little money on your plans.'] },
  { img: 'paisa', title: 'shopping budget', text: ['next year you’ll have money left over after the sale. a miracle.'] },
  { img: 'paisa', title: 'sona chandi', text: ['in 2027 you’ll buy yourself something gold, just because.'] },
  { img: 'shaadi', title: 'shehnai bajegi', text: ['wedding bells will ring in 2027. maybe yours, definitely someone close.'] },
  { img: 'shaadi', title: 'shaadi hi shaadi', text: ['next year’s calendar will be wall-to-wall weddings.'] },
  { img: 'shaadi', title: 'shaadi season pro', text: ['you’ll attend so many weddings in 2027 that you become everyone’s sangeet choreographer.'] },
  { img: 'shaadi', title: 'mehendi ka rang', text: ['in 2027 your mehendi will come out the darkest. you know what that means.'] },
  { img: 'shaadi', title: 'baraat mein naach', text: ['next year you’ll lead the baraat dance. no one can stop you.'] },
  { img: 'shaadi', title: 'rishta pakka', text: ['in 2027 someone close says yes to forever.'] },
  { img: 'shaadi', title: 'lehenga moment', text: ['next year you’ll wear your dream lehenga, at least once.'] },
  { img: 'shaadi', title: 'jootha chupai champion', text: ['in 2027 you’ll win the joota-chupai negotiation. big money.'] },
  { img: 'shaadi', title: 'varmala ready', text: ['next year a varmala ceremony will make you happy-cry.'] },
  { img: 'shaadi', title: 'shaadi ka laddoo', text: ['in 2027 you’ll eat the shaadi ka laddoo. and love it.'] },
  { img: 'excall', title: 'ex ka phone aayega', text: ['an old flame will call in 2027. you’ll let it ring. iconic.'] },
  { img: 'excall', title: 'purana phone, naya tum', text: ['someone from your past checks in next year. you’ll realise how far you’ve come.'] },
  { img: 'excall', title: 'naya number save', text: ['in 2027 you’ll save a new number with a heart emoji.'] },
  { img: 'excall', title: 'call ka intezaar', text: ['next year the call you’ve been waiting for finally comes.'] },
  { img: 'excall', title: 'lambi baatein', text: ['in 2027 one phone call will last three hours and fly by.'] },
  { img: 'excall', title: 'good news ka call', text: ['next year a phone call brings the best news of the year.'] },
  { img: 'excall', title: 'mummy ka call', text: ['in 2027 mummy calls with a blessing that comes true.'] },
  { img: 'excall', title: 'voice note queen', text: ['next year your voice notes become everyone’s favourite podcast.'] },
  { img: 'excall', title: 'missed call', text: ['in 2027 a missed call turns into a beautiful hello.'] },
  { img: 'excall', title: 'phone pe smile', text: ['next year you’ll grin at your phone so much people will ask why.'] },
  { img: 'dil', title: 'dil ka mamla suljhega', text: ['matters of the heart will sort themselves out in 2027.'] },
  { img: 'dil', title: 'dil ki baat', text: ['next year your heart gets exactly what it’s been asking for.'] },
  { img: 'dil', title: 'pyaar milega', text: ['in 2027 love shows up in a form you didn’t expect.'] },
  { img: 'dil', title: 'dil se dil', text: ['next year someone will understand you without words.'] },
  { img: 'dil', title: 'mehendi mein naam', text: ['in 2027 a name will find its way into your mehendi.'] },
  { img: 'dil', title: 'dil khush', text: ['next year your heart will feel full more often than not.'] },
  { img: 'dil', title: 'apne log', text: ['in 2027 the people who love you will show it, loudly.'] },
  { img: 'dil', title: 'dil ki dhadkan', text: ['next year someone will make your heart skip a beat.'] },
  { img: 'dil', title: 'it’s complicated (cute)', text: ['2027 brings a sweet little “what are we?” moment. enjoy the mystery.'] },
  { img: 'dil', title: 'pyaar ka saal', text: ['next year love is written in every chapter.'] },
  { img: 'single', title: 'khud se pyaar hoga', text: ['in 2027 you’ll fall for yourself, and it’ll be your best relationship yet.'] },
  { img: 'single', title: 'solo season', text: ['next year brings solo trips, solo dates and a very good glow.'] },
  { img: 'single', title: 'jhoola aur kulfi', text: ['in 2027 you’ll learn that a kulfi and some quiet are pure joy.'] },
  { img: 'single', title: 'me time', text: ['next year you’ll protect your me-time like it’s gold.'] },
  { img: 'single', title: 'apni marzi', text: ['in 2027 every choice will be completely your own.'] },
  { img: 'single', title: 'happy alone', text: ['next year you’ll enjoy your own company more than ever.'] },
  { img: 'single', title: 'sukoon ka jhoola', text: ['in 2027 you’ll find your calm and swing on it.'] },
  { img: 'single', title: 'single and shining', text: ['next year being single will look very good on you.'] },
  { img: 'single', title: 'self-care saal', text: ['in 2027 you’ll treat yourself the way you treat your favourite people.'] },
  { img: 'single', title: 'meri life, mere rules', text: ['next year you’ll write your own rules, and love them.'] },
  { img: 'party', title: 'invite hi invite', text: ['your 2027 calendar will overflow with invites. pace yourself.'] },
  { img: 'party', title: 'party ki jaan', text: ['next year you’ll be the one everyone wants at their party.'] },
  { img: 'party', title: '“bas aakhri party”', text: ['every party in 2027 you’ll call your last. thankfully, it won’t be.'] },
  { img: 'party', title: 'dance floor pe raaj', text: ['next year the dance floor clears for you.'] },
  { img: 'party', title: '4am club', text: ['in 2027 you’ll leave “early”, at 4am, very happy.'] },
  { img: 'party', title: 'host with the most', text: ['next year you’ll host a party people talk about till holi.'] },
  { img: 'party', title: 'rooftop raatein', text: ['in 2027 your best nights happen on rooftops.'] },
  { img: 'party', title: 'phuljhadi energy', text: ['next year you’ll light up every party you walk into.'] },
  { img: 'party', title: 'playlist queen', text: ['in 2027 the aux cord is officially yours.'] },
  { img: 'party', title: 'weekend plans', text: ['next year your weekends will never be boring.'] },
  { img: 'filmy', title: 'filmy saal aayega', text: ['2027 will play out like a full movie: drama, songs and a happy ending.'] },
  { img: 'filmy', title: 'slow-motion moment', text: ['next year has at least one slow-motion moment written in it.'] },
  { img: 'filmy', title: 'full filmy', text: ['in 2027 you’ll react to everything like a daily soap. dhan dhan dhan. iconic.'] },
  { img: 'filmy', title: 'heroine entry', text: ['next year your entry gets its own background music.'] },
  { img: 'filmy', title: 'happy ending', text: ['in 2027 one story in your life gets the perfect ending.'] },
  { img: 'filmy', title: 'interval ke baad', text: ['next year the second half of your story gets very exciting.'] },
  { img: 'filmy', title: 'baarish ka gaana', text: ['in 2027 you’ll get your own rain-song moment.'] },
  { img: 'filmy', title: 'dialogue baazi', text: ['next year you’ll deliver a line so good, people will quote it.'] },
  { img: 'filmy', title: 'blockbuster saal', text: ['in 2027 your life will be a superhit.'] },
  { img: 'filmy', title: 'climax tumhara', text: ['next year you’ll be the hero of your own story.'] },
  { img: 'neend', title: 'chain ki neend', text: ['2027 finally brings you eight hours of sleep. the dark circles retire.'] },
  { img: 'neend', title: 'halki neend, halka mann', text: ['next year your worries get lighter and your nights get longer.'] },
  { img: 'neend', title: 'raat ki rani', text: ['2027 has a lot of 2am heart-to-hearts written in it. worth every yawn.'] },
  { img: 'neend', title: 'sapne sach', text: ['in 2027 a dream you had will come true. literally.'] },
  { img: 'neend', title: 'sunday ki neend', text: ['next year your sundays will be lazy in the best way.'] },
  { img: 'neend', title: 'chaand se baatein', text: ['in 2027 you’ll make wishes on the moon. a few will listen.'] },
  { img: 'neend', title: 'nap queen', text: ['next year power naps will fuel your best ideas.'] },
  { img: 'neend', title: 'sukoon ki raat', text: ['in 2027 you’ll fall asleep smiling more often.'] },
  { img: 'neend', title: 'billi ka saath', text: ['next year a cat will choose your bed. accept it.'] },
  { img: 'neend', title: 'tare gin ke', text: ['in 2027 you’ll stay up counting stars with someone special.'] },
  { img: 'viral', title: 'mashhoor hoge', text: ['something you post in 2027 will blow up. keep the ring light charged.'] },
  { img: 'viral', title: 'fifteen minutes', text: ['your fifteen minutes of fame arrive next year. look cute.'] },
  { img: 'viral', title: 'group chat famous', text: ['in 2027 one of your photos becomes the gang’s favourite meme. you’ll love it.'] },
  { img: 'viral', title: 'selfie ki rani', text: ['next year every selfie will be your best angle.'] },
  { img: 'viral', title: 'likes ki baarish', text: ['in 2027 one post gets more likes than your birthday.'] },
  { img: 'viral', title: 'candid kamaal', text: ['next year a candid of you makes everyone smile. it’ll be framed.'] },
  { img: 'viral', title: 'followers badhenge', text: ['in 2027 strangers will follow you for your outfits.'] },
  { img: 'viral', title: 'story pe story', text: ['next year your stories will be everyone’s favourite watch.'] },
  { img: 'viral', title: 'dp material', text: ['in 2027 you’ll take a photo so good it becomes your dp for a year.'] },
  { img: 'viral', title: 'trend setter', text: ['next year someone will copy your post. take it as a compliment.'] },
  { img: 'glow', title: 'roop nikhrega', text: ['2027 brings the glow-up. people will ask what changed.'] },
  { img: 'glow', title: 'chamakti twacha', text: ['next year you’ll look better every month. it’s written.'] },
  { img: 'glow', title: 'skincare shelf bharega', text: ['2027 fills your shelf with serums. at least one becomes a holy grail.'] },
  { img: 'glow', title: 'face pack friday', text: ['next year your self-care ritual will become sacred.'] },
  { img: 'glow', title: 'no-makeup glow', text: ['in 2027 you’ll get complimented on a no-makeup day.'] },
  { img: 'glow', title: 'baal kamaal', text: ['next year your hair will behave on every important day.'] },
  { img: 'glow', title: 'selfie ready', text: ['in 2027 you’ll wake up camera-ready more often than not.'] },
  { img: 'glow', title: 'andar se glow', text: ['next year your happiness will show on your face.'] },
  { img: 'glow', title: 'spa day', text: ['in 2027 you’ll treat yourself to a full pamper day, more than once.'] },
  { img: 'glow', title: 'glow wali kismat', text: ['next year the mirror will be your biggest fan.'] },
  { img: 'fit', title: 'sehat banegi', text: ['2027 is the year your body finally thanks you.'] },
  { img: 'fit', title: 'taakat milegi', text: ['next year you’ll feel stronger than you have in years.'] },
  { img: 'fit', title: 'gym ka plan banega', text: ['in 2027 you’ll make a gym plan every monday. one of them will stick.'] },
  { img: 'fit', title: 'walk wali habit', text: ['next year evening walks become your favourite part of the day.'] },
  { img: 'fit', title: 'energy unlimited', text: ['in 2027 your energy will surprise everyone, especially you.'] },
  { img: 'fit', title: 'yoga se yaari', text: ['next year you’ll finally touch your toes. proudly.'] },
  { img: 'fit', title: 'dance workout', text: ['in 2027 dancing will be your favourite cardio.'] },
  { img: 'fit', title: 'healthy happy', text: ['next year your health turns a corner. you’ll mention it a lot.'] },
  { img: 'fit', title: 'sports star', text: ['in 2027 you’ll win a game you didn’t expect to.'] },
  { img: 'fit', title: 'fit and fab', text: ['next year your favourite outfit will fit perfectly.'] },
  { img: 'shanti', title: 'shanti milegi', text: ['2027 will be calm. no drama you didn’t sign up for.'] },
  { img: 'shanti', title: 'sukoon wala saal', text: ['next year peace finds you, and decides to stay.'] },
  { img: 'shanti', title: 'mann halka', text: ['in 2027 you’ll let go of something heavy. lighter already.'] },
  { img: 'shanti', title: 'kamal jaisa', text: ['next year you’ll stay calm in every storm.'] },
  { img: 'shanti', title: 'dhyan ki shakti', text: ['in 2027 a few quiet minutes a day will change everything.'] },
  { img: 'shanti', title: 'positive vibes', text: ['next year your calm will rub off on everyone around you.'] },
  { img: 'shanti', title: 'stress kam', text: ['in 2027 your worries get smaller and your laughs get louder.'] },
  { img: 'shanti', title: 'andar ki awaaz', text: ['next year your gut feeling will be right every time.'] },
  { img: 'shanti', title: 'shant aur sundar', text: ['in 2027 you’ll look as peaceful as you feel.'] },
  { img: 'shanti', title: 'sab theek hoga', text: ['next year everything you’re worried about will work out.'] },
  { img: 'swaad', title: 'tareef milegi', text: ['in 2027 a dish you make will become famous. everyone will want the recipe.'] },
  { img: 'swaad', title: 'haath ka jaadu', text: ['next year your cooking wins over someone important.'] },
  { img: 'swaad', title: 'maggi master', text: ['your 2027 signature dish might still be maggi, and it’ll be the best one around.'] },
  { img: 'swaad', title: 'masterchef moment', text: ['in 2027 you’ll cook something that gets a standing ovation.'] },
  { img: 'swaad', title: 'nani ki recipe', text: ['next year you’ll finally master nani’s secret recipe.'] },
  { img: 'swaad', title: 'dawat tumhari', text: ['in 2027 you’ll host a dinner people won’t stop talking about.'] },
  { img: 'swaad', title: 'tadka queen', text: ['next year your tadka will make the whole building hungry.'] },
  { img: 'swaad', title: 'mithai maker', text: ['in 2027 your homemade sweets will vanish first at every party.'] },
  { img: 'swaad', title: 'khaana khazana', text: ['next year you’ll discover a new favourite food that changes your life.'] },
  { img: 'swaad', title: 'pet bhar khushi', text: ['in 2027 your kitchen will always smell like celebration.'] },
  { img: 'mummy', title: 'ghar wale khush honge', text: ['in 2027 you’ll make your family very, very proud. expect forwarded photos.'] },
  { img: 'mummy', title: 'approval rating high', text: ['next year your approval rating at home hits an all-time high.'] },
  { img: 'mummy', title: 'mummy ki favourite', text: ['in 2027 mummy will forward you a lot of reels. reply to one, it makes her day.'] },
  { img: 'mummy', title: 'papa ki shaabashi', text: ['next year papa says “proud of you” out loud.'] },
  { img: 'mummy', title: 'family ka hero', text: ['in 2027 you’ll solve a family problem everyone else gave up on.'] },
  { img: 'mummy', title: 'mummy ka aashirwad', text: ['next year a blessing from mummy comes true.'] },
  { img: 'mummy', title: 'ghar ka khana', text: ['in 2027 you’ll get your favourite meal cooked for you, just because.'] },
  { img: 'mummy', title: 'family trip', text: ['next year the whole family goes on a trip, and it’s wonderful.'] },
  { img: 'mummy', title: 'mummy ki muskaan', text: ['in 2027 you’ll make mummy laugh till she cries.'] },
  { img: 'mummy', title: 'sharma ji ki tareef', text: ['next year even sharma ji will praise you.'] },
  { img: 'doggo', title: 'naya dost aayega', text: ['a furry new friend will enter your life in 2027.'] },
  { img: 'doggo', title: 'chaar pairon wala pyaar', text: ['next year someone with four legs will choose you.'] },
  { img: 'doggo', title: 'pet ka pyaar', text: ['every pet in 2027 will want your attention. you’re the favourite.'] },
  { img: 'doggo', title: 'gali ka sher', text: ['next year the street dogs will greet you like a celebrity.'] },
  { img: 'doggo', title: 'wagging tails', text: ['in 2027 you’ll be welcomed home with the happiest wiggles.'] },
  { img: 'doggo', title: 'adopt, don’t shop', text: ['next year you’ll give a little one a forever home.'] },
  { img: 'doggo', title: 'loyal saathi', text: ['in 2027 a loyal friend will stick by you through everything.'] },
  { img: 'doggo', title: 'walk buddy', text: ['next year your evening walks get a cute new companion.'] },
  { img: 'doggo', title: 'pet parent', text: ['in 2027 your camera roll will be 80% pet photos. perfect.'] },
  { img: 'doggo', title: 'bhau bhau blessing', text: ['next year a dog will run your heart by march.'] },
  { img: 'khushkhabri', title: 'khushkhabri aayegi', text: ['good news will land in your family in 2027. sweets on you.'] },
  { img: 'khushkhabri', title: 'laddoo ka dabba', text: ['next year someone close will give you news worth a whole box of laddoos.'] },
  { img: 'khushkhabri', title: 'khushiyan double', text: ['good news in the family in 2027, and more joy coming your way right after.'] },
  { img: 'khushkhabri', title: 'naya mehmaan', text: ['in 2027 a tiny new member joins the family.'] },
  { img: 'khushkhabri', title: 'result aayega', text: ['next year someone you love gets the result they prayed for.'] },
  { img: 'khushkhabri', title: 'mithai baato', text: ['in 2027 you’ll be handing out mithai for your own good news.'] },
  { img: 'khushkhabri', title: 'phone pe khushkhabri', text: ['next year a happy phone call will make you jump.'] },
  { img: 'khushkhabri', title: 'ghar mein jashn', text: ['in 2027 your home will host a celebration.'] },
  { img: 'khushkhabri', title: 'sapna poora', text: ['next year a family dream finally comes true.'] },
  { img: 'khushkhabri', title: 'badhaai ho', text: ['in 2027 you’ll hear “badhaai ho” more than once.'] },
  { img: 'dosti', title: 'dosti gehri hogi', text: ['your friendships get stronger in 2027. one trip, many inside jokes.'] },
  { img: 'dosti', title: 'gang hi family', text: ['next year your gang becomes family.'] },
  { img: 'dosti', title: 'group chat on fire', text: ['the gang’s group chat will hit 999+ in 2027. all of it laughter.'] },
  { img: 'dosti', title: 'scooter pe chaar', text: ['next year four friends, one scooter, one unforgettable night.'] },
  { img: 'dosti', title: 'purane dost', text: ['in 2027 an old friend comes back into your life.'] },
  { img: 'dosti', title: 'best friend forever', text: ['next year your best friend will have your back like never before.'] },
  { img: 'dosti', title: 'plan pakka', text: ['in 2027 the gang’s plan actually happens. on time. shocking.'] },
  { img: 'dosti', title: 'dosti ka yog', text: ['next year you’ll make a friend for life in the unlikeliest place.'] },
  { img: 'dosti', title: 'hasi ke dore', text: ['in 2027 you’ll laugh till your stomach hurts, often.'] },
  { img: 'dosti', title: 'yaari zindabad', text: ['next year your friends will celebrate you loudly.'] },
  { img: 'lucky', title: 'kismat chamkegi', text: ['luck will sit on your shoulder all through 2027. buy the ticket.'] },
  { img: 'lucky', title: 'lucky streak', text: ['next year the small lucky things keep stacking up.'] },
  { img: 'lucky', title: 'kismat thodi late', text: ['luck takes the scenic route in 2027, and arrives right on time.'] },
  { img: 'lucky', title: 'jackpot moment', text: ['in 2027 you’ll win something you entered just for fun.'] },
  { img: 'lucky', title: 'parking mil jayegi', text: ['next year you’ll find parking on the first round. every time.'] },
  { img: 'lucky', title: 'chhakke pe chhakka', text: ['in 2027 your lucky number will keep showing up.'] },
  { img: 'lucky', title: 'lucky charm', text: ['next year you’ll be someone else’s lucky charm too.'] },
  { img: 'lucky', title: 'upgrade milega', text: ['in 2027 you’ll get a free upgrade when you least expect it.'] },
  { img: 'lucky', title: 'dice tumhare haath', text: ['next year the dice will roll your way.'] },
  { img: 'lucky', title: 'lottery wali smile', text: ['in 2027 a lucky surprise makes your whole week.'] },
  { img: 'taare', title: 'taare saath denge', text: ['the stars line up for you in 2027. ask for what you want.'] },
  { img: 'taare', title: 'wish poori hogi', text: ['a wish you made quietly will come true next year.'] },
  { img: 'taare', title: 'sign mil jayega', text: ['you’ll wait for a sign in 2027. it will show up in the cutest way.'] },
  { img: 'taare', title: 'tootta tara', text: ['next year you’ll see a shooting star. make it count.'] },
  { img: 'taare', title: 'chaand ki roshni', text: ['in 2027 your nights will be full of good thoughts.'] },
  { img: 'taare', title: 'universe ka plan', text: ['next year the universe sends you a very clear hint. you’ll notice.'] },
  { img: 'taare', title: 'stars aligned', text: ['in 2027 timing will be on your side, again and again.'] },
  { img: 'taare', title: 'manifest karo', text: ['next year your vision board will start coming true.'] },
  { img: 'taare', title: 'roshan raatein', text: ['in 2027 something you hoped for in the dark finds its light.'] },
  { img: 'taare', title: 'aasmaan tumhara', text: ['next year the sky really is the limit.'] },
  { img: 'lakshmi', title: 'lakshmi ghar aayegi', text: ['prosperity will walk in through your front door in 2027.'] },
  { img: 'lakshmi', title: 'dhan dhanya', text: ['next year the money comes home, and stays.'] },
  { img: 'lakshmi', title: 'shubh kadam', text: ['in 2027 every step you take will be a lucky one.'] },
  { img: 'lakshmi', title: 'ghar mein barkat', text: ['next year your home will always have enough, and a little more.'] },
  { img: 'lakshmi', title: 'diwali wali kismat', text: ['in 2027 the diwali blessings last all year long.'] },
  { img: 'lakshmi', title: 'naya kaam, naya dhan', text: ['next year a new source of income opens up.'] },
  { img: 'lakshmi', title: 'rangoli ka rang', text: ['in 2027 your life gets more colourful, month by month.'] },
  { img: 'lakshmi', title: 'ujala hi ujala', text: ['next year your home will glow brighter than ever.'] },
  { img: 'lakshmi', title: 'aashirwad', text: ['in 2027 the blessings you’ve earned will start arriving.'] },
  { img: 'lakshmi', title: 'shubh labh', text: ['next year good fortune and good profit walk hand in hand.'] },
  { img: 'shopping', title: 'mann ki murad poori hogi', text: ['the thing you’ve been eyeing forever will finally be yours in 2027.'] },
  { img: 'shopping', title: 'wishlist tick', text: ['next year your wishlist starts getting ticked off, one by one.'] },
  { img: 'shopping', title: 'add to cart era', text: ['in 2027 your wishlist gets long, and a few favourites come home.'] },
  { img: 'shopping', title: 'sale ki rani', text: ['next year you’ll catch every sale at exactly the right time.'] },
  { img: 'shopping', title: 'naya wardrobe', text: ['in 2027 your wardrobe gets a full upgrade. the mohalla will copy.'] },
  { img: 'shopping', title: 'perfect fit', text: ['next year everything you order will fit on the first try.'] },
  { img: 'shopping', title: 'treat yourself', text: ['in 2027 you’ll buy yourself flowers. and earrings. and both.'] },
  { img: 'shopping', title: 'gift wali kismat', text: ['next year you’ll receive the exact gift you secretly wanted.'] },
  { img: 'shopping', title: 'bazaar ki shaan', text: ['in 2027 every shopkeeper will give you the best price.'] },
  { img: 'shopping', title: 'jhola full', text: ['next year you’ll come home from the market with your hands full and heart fuller.'] },
  { img: 'startup', title: 'apna naam banega', text: ['that side idea becomes real in 2027, with your name on it.'] },
  { img: 'startup', title: 'apna kaam', text: ['next year you’ll build something that’s fully yours.'] },
  { img: 'startup', title: 'idea factory', text: ['you’ll have twelve business ideas in 2027. one of them is really good.'] },
  { img: 'startup', title: 'launch day', text: ['next year you’ll hit “launch” on something you made.'] },
  { img: 'startup', title: 'pehla customer', text: ['in 2027 your first customer becomes your biggest fan.'] },
  { img: 'startup', title: 'side hustle shine', text: ['next year your side hustle pays for your holiday.'] },
  { img: 'startup', title: 'rocket wala saal', text: ['in 2027 something you start takes off fast.'] },
  { img: 'startup', title: 'boss khud ki', text: ['next year you’ll be your own boss, at least on weekends.'] },
  { img: 'startup', title: 'notes app genius', text: ['in 2027 the best idea in your notes app finally gets made.'] },
  { img: 'startup', title: 'investor milega', text: ['next year someone will believe in your idea as much as you do.'] },
  { img: 'seekho', title: 'kuch naya seekhoge', text: ['in 2027 you’ll learn a new skill and surprise everyone, mostly yourself.'] },
  { img: 'seekho', title: 'hobby wala saal', text: ['next year a class or a hobby finally sticks.'] },
  { img: 'seekho', title: 'kuch nahi seekhoge', text: ['in 2027 you’ll repeat a few old mistakes, and laugh about them this time.'] },
  { img: 'seekho', title: 'sitar ki taan', text: ['next year you’ll pick up an instrument and play your first song.'] },
  { img: 'seekho', title: 'kitaabon se dosti', text: ['in 2027 one book will change how you see things.'] },
  { img: 'seekho', title: 'rang aur brush', text: ['next year you’ll paint something you’ll actually hang on the wall.'] },
  { img: 'seekho', title: 'naya bhasha', text: ['in 2027 you’ll learn enough of a new language to order dinner.'] },
  { img: 'seekho', title: 'guru milega', text: ['next year you’ll meet someone who teaches you something big.'] },
  { img: 'seekho', title: 'pro level', text: ['in 2027 a hobby turns into a real talent.'] },
  { img: 'seekho', title: 'certificate wala saal', text: ['next year you’ll finish a course and frame the certificate.'] },
  { img: 'stage', title: 'spotlight milegi', text: ['2027 puts you on a stage, literally or not. the room will be yours.'] },
  { img: 'stage', title: 'pehchaan banegi', text: ['next year you’ll get noticed for exactly what you’re good at.'] },
  { img: 'stage', title: 'karaoke star', text: ['in 2027 you’ll grab the mic at every party, and the crowd will sing along.'] },
  { img: 'stage', title: 'taaliyan', text: ['next year you’ll get a standing ovation for something you did.'] },
  { img: 'stage', title: 'awaaz ka jaadu', text: ['in 2027 your voice will be heard where it matters.'] },
  { img: 'stage', title: 'mic drop', text: ['next year you’ll give a speech people quote for weeks.'] },
  { img: 'stage', title: 'star performer', text: ['in 2027 you’ll win a performance you nearly didn’t enter.'] },
  { img: 'stage', title: 'encore', text: ['next year they’ll ask you for one more song.'] },
  { img: 'stage', title: 'main character', text: ['in 2027 the spotlight will follow you around.'] },
  { img: 'stage', title: 'stage pe raaj', text: ['next year you’ll own every room you walk into.'] },
  { img: 'detox', title: 'sukoon milega', text: ['in 2027 you’ll scroll less and live more. weirdly, you’ll love it.'] },
  { img: 'detox', title: 'phone ko chhutti', text: ['next year your phone stops running your life.'] },
  { img: 'detox', title: 'reels ki rani', text: ['in 2027 you’ll find the funniest reels first and send them to everyone.'] },
  { img: 'detox', title: 'offline masti', text: ['next year your best memories won’t make it to instagram.'] },
  { img: 'detox', title: 'screen kam, sapne zyada', text: ['in 2027 you’ll swap screen time for dream time.'] },
  { img: 'detox', title: 'notification free', text: ['next year you’ll turn off notifications and feel brand new.'] },
  { img: 'detox', title: 'sunset dekhoge', text: ['in 2027 you’ll watch more sunsets than stories.'] },
  { img: 'detox', title: 'baatein face to face', text: ['next year your favourite conversations will happen in person.'] },
  { img: 'detox', title: 'digital diwali', text: ['in 2027 you’ll send handwritten wishes, and people will keep them.'] },
  { img: 'detox', title: 'present moment', text: ['next year you’ll be fully there for the moments that matter.'] },
  { img: 'drama', title: 'ghar mein drama hoga', text: ['2027 brings one epic family drama. you watch from the front row, popcorn ready.'] },
  { img: 'drama', title: 'filmy family moment', text: ['in 2027 your family will have one very filmy moment. it ends in hugs.'] },
  { img: 'drama', title: 'serial ka twist', text: ['next year’s family function gives you a story you’ll tell for years.'] },
  { img: 'drama', title: 'dramebaaz', text: ['in 2027 your expressions will deserve their own award.'] },
  { img: 'drama', title: 'saas bahu saga', text: ['next year the family whatsapp group becomes better than tv.'] },
  { img: 'drama', title: 'happy climax', text: ['in 2027 every family drama ends with everyone eating together.'] },
  { img: 'drama', title: 'nazrein milengi', text: ['next year one look from you will settle an argument.'] },
  { img: 'drama', title: 'dhan dhan dhan', text: ['in 2027 your reactions will need dramatic background music.'] },
  { img: 'drama', title: 'masala family', text: ['next year your family will give you the best stories.'] },
  { img: 'drama', title: 'sab milke', text: ['in 2027 the whole family will come together for something big.'] },
  { img: 'raaz', title: 'ek raaz khulega', text: ['a secret will come out in 2027. it explains a lot, in a good way.'] },
  { img: 'raaz', title: 'chitthi aayegi', text: ['next year someone will tell you something that changes how you see them.'] },
  { img: 'raaz', title: 'pet mein baat nahi tikegi', text: ['in 2027 you’ll be bursting to share good news. you’ll last about eleven minutes.'] },
  { img: 'raaz', title: 'surprise ka raaz', text: ['next year someone plans a surprise for you. you won’t guess.'] },
  { img: 'raaz', title: 'secret admirer', text: ['in 2027 you’ll find out someone has a crush on you.'] },
  { img: 'raaz', title: 'chupa talent', text: ['next year you’ll discover a talent you never knew you had.'] },
  { img: 'raaz', title: 'raazdaar', text: ['in 2027 you’ll be the person everyone trusts with their secrets.'] },
  { img: 'raaz', title: 'mohar wali chitthi', text: ['next year a letter arrives that you’ll keep forever.'] },
  { img: 'raaz', title: 'chupke chupke', text: ['in 2027 you’ll plan a surprise and pull it off perfectly.'] },
  { img: 'raaz', title: 'khula raaz', text: ['next year the truth comes out, and it’s better than the rumour.'] },
  { img: 'comeback', title: 'zabardast comeback', text: ['2027 is your comeback year. feathers out, head high.'] },
  { img: 'comeback', title: 'mor jaisa', text: ['whatever knocked you down, you’ll rise like a full peacock next year.'] },
  { img: 'comeback', title: 'comeback loading', text: ['you’ll announce your comeback a few times in 2027. the last one is the big one.'] },
  { img: 'comeback', title: 'phir se shuru', text: ['next year you’ll restart something you love, and do it better.'] },
  { img: 'comeback', title: 'naya avatar', text: ['in 2027 you’ll reinvent yourself and look amazing doing it.'] },
  { img: 'comeback', title: 'pankh phailao', text: ['next year you’ll spread your wings and fly.'] },
  { img: 'comeback', title: 'rang laayegi mehnat', text: ['in 2027 your effort will finally show its colours.'] },
  { img: 'comeback', title: 'glow-up sequel', text: ['next year your glow-up gets a sequel, and it’s better.'] },
  { img: 'comeback', title: 'jeet ki taraf', text: ['in 2027 every setback turns into a setup.'] },
  { img: 'comeback', title: 'wapas aa gaye', text: ['next year everyone will say “she’s back.”'] },
  { img: 'rani', title: 'mohalle mein naam hoga', text: ['by end of 2027 the whole neighbourhood will know your name.'] },
  { img: 'rani', title: 'gali ki shaan', text: ['queen of the gali in 2027. every chaiwala will know your order.'] },
  { img: 'rani', title: 'scooter queen', text: ['next year you’ll ride through the city with your dupatta flying.'] },
  { img: 'rani', title: 'mohalle ki favourite', text: ['in 2027 you become the mohalla’s favourite.'] },
  { img: 'rani', title: 'azaadi ki sawaari', text: ['next year you’ll go wherever you want, whenever you want.'] },
  { img: 'rani', title: 'shortcut queen', text: ['in 2027 you’ll discover the best shortcuts in town.'] },
  { img: 'rani', title: 'hawa mein dupatta', text: ['next year your style will turn heads on every street.'] },
  { img: 'rani', title: 'long drive', text: ['in 2027 you’ll take the long way home on purpose, and love every minute.'] },
  { img: 'rani', title: 'rasta saaf', text: ['next year every road you take will lead somewhere good.'] },
  { img: 'rani', title: 'rani ki sawaari', text: ['in 2027 you’ll arrive everywhere in style.'] },
  { img: 'baarish', title: 'baarish mein pyaar', text: ['one monsoon in 2027 will turn very romantic. carry an umbrella for two.'] },
  { img: 'baarish', title: 'chai aur baarish', text: ['next year’s best memory: rain, chai and the right person.'] },
  { img: 'baarish', title: 'chhatri bhool jaoge', text: ['every rainy day in 2027, no umbrella. every time, a great story.'] },
  { img: 'baarish', title: 'pehli baarish', text: ['next year the first rain will bring good news.'] },
  { img: 'baarish', title: 'bheegi yaadein', text: ['in 2027 you’ll dance in the rain at least once.'] },
  { img: 'baarish', title: 'pakode ka mausam', text: ['next year rainy evenings mean pakoras and laughter.'] },
  { img: 'baarish', title: 'ek chhatri, do log', text: ['in 2027 you’ll share an umbrella with someone special.'] },
  { img: 'baarish', title: 'monsoon magic', text: ['next year the monsoon will be your favourite season.'] },
  { img: 'baarish', title: 'baadal aur sapne', text: ['in 2027 grey skies will bring the brightest days.'] },
  { img: 'baarish', title: 'rimjhim', text: ['next year a rainy day plan turns into the perfect date.'] },
  { img: 'chakka', title: 'jeet pakki', text: ['in 2027 you’ll hit it out of the park: at work, in love, everywhere.'] },
  { img: 'chakka', title: 'chhakka maaroge', text: ['next year your big swings land.'] },
  { img: 'chakka', title: 'try karte raho', text: ['big swings in 2027. one misses, the next one sails over the boundary.'] },
  { img: 'chakka', title: 'gali cricket queen', text: ['next year you’ll win the gali match, and the bragging rights.'] },
  { img: 'chakka', title: 'man of the match', text: ['in 2027 you’ll be the player of the match in something important.'] },
  { img: 'chakka', title: 'century', text: ['next year you’ll reach a milestone you’ve been chasing.'] },
  { img: 'chakka', title: 'boundary paar', text: ['in 2027 you’ll go beyond what you thought was possible.'] },
  { img: 'chakka', title: 'team ki jeet', text: ['next year your team will win because of you.'] },
  { img: 'chakka', title: 'final over', text: ['in 2027 you’ll pull off a last-minute win.'] },
  { img: 'chakka', title: 'trophy tumhari', text: ['next year you’ll lift a trophy, real or metaphorical.'] },
  { img: 'roadtrip', title: 'lambi yatra likhi hai', text: ['a long road trip with your favourite people is written in your 2027.'] },
  { img: 'roadtrip', title: 'pahadon ki sair', text: ['mountains will call next year, and you’ll pick up.'] },
  { img: 'roadtrip', title: 'safar ki kahani', text: ['the 2027 road trip will have a few detours, and the best stories of the year.'] },
  { img: 'roadtrip', title: 'auto wali adventure', text: ['next year a spontaneous ride leads somewhere magical.'] },
  { img: 'roadtrip', title: 'dhaba stop', text: ['in 2027 you’ll find the best dhaba on the highway.'] },
  { img: 'roadtrip', title: 'gaane aur gaadi', text: ['next year: eight hours of driving, eight hours of singing.'] },
  { img: 'roadtrip', title: 'naya rasta', text: ['in 2027 you’ll take a road you’ve never taken, and love where it goes.'] },
  { img: 'roadtrip', title: 'weekend getaway', text: ['next year a quick weekend trip becomes your favourite memory.'] },
  { img: 'roadtrip', title: 'pahadi chai', text: ['in 2027 you’ll sip chai with a mountain view.'] },
  { img: 'roadtrip', title: 'manzil milegi', text: ['next year you’ll reach a destination you’ve dreamed about.'] },
  { img: 'birthday', title: 'yaadgaar birthday hoga', text: ['your 2027 birthday will be the best one yet.'] },
  { img: 'birthday', title: 'surprise wala birthday', text: ['next year someone plans a surprise you’ll never see coming.'] },
  { img: 'birthday', title: 'cake hi cake', text: ['in 2027 you’ll get more than one birthday cake.'] },
  { img: 'birthday', title: 'birthday wish poori', text: ['next year your birthday wish comes true.'] },
  { img: 'birthday', title: 'birthday week', text: ['in 2027 your birthday turns into a whole birthday week.'] },
  { img: 'birthday', title: 'pyaar ki baarish', text: ['next year your birthday messages will make you cry happy tears.'] },
  { img: 'birthday', title: 'perfect gift', text: ['in 2027 someone will give you the most thoughtful gift ever.'] },
  { img: 'birthday', title: 'candles aur dosti', text: ['next year all your favourite people will be in one room for you.'] },
  { img: 'birthday', title: 'party tumhari', text: ['in 2027 you’ll throw yourself a birthday party you’ll never forget.'] },
  { img: 'birthday', title: 'nayi umar, naya josh', text: ['next year your new age will be your best one yet.'] },
  { img: 'boundary', title: 'himmat aayegi', text: ['in 2027 you’ll finally say no without explaining. it’ll feel amazing.'] },
  { img: 'boundary', title: 'na matlab na', text: ['next year you find the courage you’ve been saving up.'] },
  { img: 'boundary', title: 'sabko haan', text: ['in 2027 you’ll say yes to everyone, and somehow make it all work.'] },
  { img: 'boundary', title: 'apni shartein', text: ['next year you’ll do things on your own terms.'] },
  { img: 'boundary', title: 'self-respect saal', text: ['in 2027 you’ll treat your time like gold.'] },
  { img: 'boundary', title: 'haath utha ke', text: ['next year you’ll stand up for yourself, and someone else too.'] },
  { img: 'boundary', title: 'peace first', text: ['in 2027 your peace will come before everyone’s plans.'] },
  { img: 'boundary', title: 'confidence ka saal', text: ['next year you’ll walk into rooms like you belong there. you do.'] },
  { img: 'boundary', title: 'mehendi wala stop', text: ['in 2027 one firm “no” will open the door to a big “yes”.'] },
  { img: 'boundary', title: 'apna khayal', text: ['next year you’ll finally put yourself first.'] },
  { img: 'ghanti', title: 'shubh aarambh hoga', text: ['a big new beginning starts in 2027. ring the bell.'] },
  { img: 'ghanti', title: 'achhi shuruaat', text: ['next year opens with good news and keeps going.'] },
  { img: 'ghanti', title: 'mandir ki ghanti', text: ['in 2027 a prayer you’ve been making will be answered.'] },
  { img: 'ghanti', title: 'naya kaam shuru', text: ['next year you’ll start something new on an auspicious day.'] },
  { img: 'ghanti', title: 'shubh muhurat', text: ['in 2027 your timing will be perfect, every time.'] },
  { img: 'ghanti', title: 'ghanti bajegi', text: ['next year the doorbell brings good news.'] },
  { img: 'ghanti', title: 'aarti ki roshni', text: ['in 2027 your home will be filled with light and blessings.'] },
  { img: 'ghanti', title: 'nayi subah', text: ['next year every morning will feel like a fresh start.'] },
  { img: 'ghanti', title: 'mann ki murad', text: ['in 2027 a long-held wish finally gets its moment.'] },
  { img: 'ghanti', title: 'shubh sanket', text: ['next year good signs will keep showing up.'] },
  { img: 'chess', title: 'har chaal sahi padegi', text: ['every move you make in 2027 will turn out right. checkmate.'] },
  { img: 'chess', title: 'teen kadam aage', text: ['next year you’ll be three steps ahead, always.'] },
  { img: 'chess', title: 'soch soch ke', text: ['in 2027 you’ll think every move through, and it’ll pay off.'] },
  { img: 'chess', title: 'rani ki chaal', text: ['next year your smartest move will be a quiet one.'] },
  { img: 'chess', title: 'plan ka jaadu', text: ['in 2027 your careful planning beats everyone’s shortcuts.'] },
  { img: 'chess', title: 'game changer', text: ['next year one decision changes the whole game.'] },
  { img: 'chess', title: 'dimaag ki batti', text: ['in 2027 a brilliant idea will hit you at the perfect moment.'] },
  { img: 'chess', title: 'patience pays', text: ['next year your patience wins you something big.'] },
  { img: 'chess', title: 'shatranj ki rani', text: ['in 2027 you’ll outsmart a tricky situation with grace.'] },
  { img: 'chess', title: 'jeet ki chaal', text: ['next year every plan you make will work out.'] },
  { img: 'sher', title: 'dar khatam hoga', text: ['2027 makes you fearless. you roar, they listen.'] },
  { img: 'sher', title: 'sherni saal', text: ['next year the thing that scared you most stops mattering.'] },
  { img: 'sher', title: 'sherni, softly', text: ['in 2027 you’ll be fierce in the group chat and sweet in person. the best combo.'] },
  { img: 'sher', title: 'jungle ki rani', text: ['next year you’ll lead the pack without even trying.'] },
  { img: 'sher', title: 'dahaad', text: ['in 2027 your voice will be heard, loud and clear.'] },
  { img: 'sher', title: 'himmatwali', text: ['next year you’ll do the brave thing, and it’ll pay off.'] },
  { img: 'sher', title: 'shaant sherni', text: ['in 2027 you’ll be calm, confident and unstoppable.'] },
  { img: 'sher', title: 'apni zameen', text: ['next year you’ll claim your space and own it.'] },
  { img: 'sher', title: 'nidar', text: ['in 2027 you’ll say yes to an adventure that once scared you.'] },
  { img: 'sher', title: 'sher ka dil', text: ['next year your courage will inspire someone close to you.'] },
];
const LEGACY_K = {"darwaaza khula hai": "door", "naya ghar, naya scene": "ghar", "kursi tumhari hai": "kursi", "paisa hi paisa": "paisa", "dil ka mamla": "dil", "single and thriving": "single", "party har weekend": "party", "filmy saal": "filmy", "neend poori hogi": "neend", "viral hone wale ho": "viral", "glow up guaranteed": "glow", "fit and fabulous": "fit", "shanti hi shanti": "shanti", "haath mein swaad": "swaad", "mummy proud hai": "mummy", "ek naya dost": "doggo", "khushkhabri aane wali hai": "khushkhabri", "dosti zindabad": "dosti", "kismat connection": "lucky", "taare tumhare saath": "taare", "shopping spree": "shopping", "apna kaam, apna naam": "startup", "spotlight tumhari": "stage", "phone kam, life zyada": "detox", "serial wala drama": "drama", "comeback saal": "comeback", "mohalle ki rani": "rani", "baarish wala pyaar": "baarish", "chakka maaroge": "chakka", "road trip pakka": "roadtrip", "yaadgaar birthday": "birthday", "na matlab na": "boundary", "shubh aarambh": "ghanti", "rani ki chaal": "chess", "sherni saal": "sher", "gym fees, zero visits": "fit", "neend kya hoti hai": "neend", "paisa aaya, paisa gaya": "paisa", "trip plan, trip cancel": "safar", "situationship season 2": "single", "screen time: 11 hours": "detox", "glow up postponed": "glow", "maggi master": "swaad", "sharma ji ki beti": "mummy", "idea hi idea": "startup", "viral, galat wajah se": "viral", "bas aakhri party": "party", "cart mein hi rahega": "shopping", "yeh email ho sakta tha": "kursi", "drama ki dukaan": "drama", "overthinking queen": "chess", "kutta bhi bhaav nahi dega": "doggo", "group chat on mute": "dosti", "gaadi kharab hogi": "roadtrip", "kismat late chal rahi hai": "lucky", "sign ka intezaar": "taare", "duck pe out": "chakka", "sherni on whatsapp only": "sher", "challan pakka": "rani", "overacting ka award": "filmy", "tumhari baari kab?": "khushkhabri"};   // titles from earlier versions, so old wall pins keep their art
const HAS_TEXT = new Set(['nakhre', 'nazar', 'spicy', 'naacho', 'meethe', 'girlies', 'chugli', 'bsfree', 'baegum', 'kaam']);   // posters that already carry their words
const T = { table: $('#ttable'), tota: $('#tota'), cards: [], busy: false, x: 0, y: 0, face: 1, run: 0 };
const tsnd = (n, o) => { if (ACTIVE === 'tota') snd(n, o); };
const cardT = (el, x, y, r, sc = 1, z) => { el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${sc})`; if (z != null) el.style.zIndex = z; };
function totaPlace(x, y, face = T.face) { T.x = x; T.y = y; T.face = face; T.tota.style.transform = `translate(${x}px,${y}px) scaleX(${face})`; }
function perchSpot() {          // waiting off to the side while the deck is shuffled
  const W = T.table.clientWidth, H = T.table.clientHeight;
  return { x: -W / 2 + 2, y: H / 2 - T.tota.offsetHeight - 4 };
}
async function hop(x, y, { face, h = 34, ms = 360 } = {}) {   // a real hop: arc up, land with a little squash
  const f = face ?? (x < T.x ? -1 : 1);
  const a = T.tota.animate([
    { transform: `translate(${T.x}px,${T.y}px) scaleX(${f}) scaleY(1)` },
    { transform: `translate(${(T.x + x) / 2}px,${Math.min(T.y, y) - h}px) scaleX(${f}) scaleY(1.04)`, offset: .5 },
    { transform: `translate(${x}px,${y}px) scaleX(${f * 1.06}) scaleY(.92)`, offset: .88 },
    { transform: `translate(${x}px,${y}px) scaleX(${f}) scaleY(1)` },
  ], { duration: ms, easing: 'cubic-bezier(.3,.1,.4,1)' });
  totaPlace(x, y, f);
  await a.finished.catch(() => {}); tsnd('hop', { vol: .35 });
}
async function bob(n = 2) {     // head-bob / curious look in place
  for (let i = 0; i < n; i++) {
    const a = T.tota.animate([
      { transform: `translate(${T.x}px,${T.y}px) scaleX(${T.face}) rotate(0deg)` },
      { transform: `translate(${T.x + 4 * T.face}px,${T.y + 5}px) scaleX(${T.face}) rotate(${8 * T.face}deg)` },
      { transform: `translate(${T.x}px,${T.y}px) scaleX(${T.face}) rotate(0deg)` },
    ], { duration: rnd(240, 340), easing: 'ease-in-out' });
    await a.finished.catch(() => {});
    await sleep(rnd(60, 220));
  }
}
function totaBuild() {
  T.cards.forEach(c => c.remove());
  T.cards = Array.from({ length: 9 }, () => {
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = '<div class="kc-in"><div class="kc-f kc-back"></div><div class="kc-f kc-front"></div></div>';
    T.table.appendChild(el); return el;
  });
  T.cards.forEach((el, i) => { el.style.opacity = 1; el.classList.remove('flip'); cardT(el, (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); });
  T.tota.src = 'assets/game/parrot.webp';
  const p = perchSpot(); totaPlace(p.x, p.y, 1);
  T.table.classList.add('can-shuffle');
}
async function riffle() {
  const w = T.cards[0].offsetWidth, half = Math.ceil(T.cards.length / 2);
  const L = T.cards.slice(0, half), R = T.cards.slice(half);
  L.forEach((el, i) => cardT(el, -w * .56, -i * 1.3, -9)); R.forEach((el, i) => cardT(el, w * .56, -i * 1.3, 9));
  tsnd('riffle', { vol: .85 }); await sleep(360);
  const out = [];
  while (L.length || R.length) out.push(((Math.random() < .5 && L.length) || !R.length ? L : R).shift());
  for (let i = 0; i < out.length; i++) { cardT(out[i], (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); await sleep(50); }
  T.cards = out; await sleep(260);
}
async function bridge() {
  T.cards.forEach((el, i) => cardT(el, (i - 4) * .5, -i * 1.3 - 24, rnd(-2, 2), 1.05)); await sleep(240);
  for (let i = 0; i < T.cards.length; i++) { cardT(T.cards[i], (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); await sleep(28); }
  await sleep(240);
}
function fanPos(i) {
  const W = T.table.clientWidth, cw = T.cards[0].offsetWidth, n = T.cards.length, spread = W < 500 ? 22 : 30;
  const R = Math.min(520, (W / 2 - cw * .6) / Math.sin(rad(spread)));
  const a = -spread + 2 * spread * i / (n - 1);
  return { x: Math.sin(rad(a)) * R, y: R - Math.cos(rad(a)) * R - 40, a };
}
const W_SCALE = () => {                     // the picked card opens big, but never bigger than the table can show
  const want = T.table.clientWidth < 420 ? 1.72 : 2, ch = T.cards[0] ? T.cards[0].offsetHeight : 1;
  return Math.min(want, (T.table.clientHeight - 40) / ch);
};
const SEEN_K = new Set();                  // don't hand the same kismat twice in one visit
async function totaPlay() {
  if (T.busy) return; T.busy = true; start(); guide('gTota', false); const my = ++T.run;
  const alive = () => T.run === my && ACTIVE === 'tota';
  const bail = () => { if (T.run === my) T.busy = false; };
  $('#tread').hidden = true; $('#tagain').hidden = true; $('#tgo').hidden = true; $('#tlabel').hidden = true; hideShare('tota'); hidePin('tota');
  T.table.classList.remove('can-shuffle');
  let pool = FORTUNES.filter(f => !SEEN_K.has(f.img)); if (!pool.length) { SEEN_K.clear(); pool = FORTUNES; }
  const f = pick(pool); SEEN_K.add(f.img); new Image().src = `assets/cards/${f.img}.webp?v=2`;   // load just this one while the deck shuffles
  totaBuild(); bob(2); tsnd('parrot', { vol: .5 });
  $('#tsub').textContent = 'shuffling…';
  await sleep(300); if (!alive()) return bail();
  await riffle(); if (!alive()) return bail();
  await riffle(); if (!alive()) return bail();
  tsnd('riffle', { vol: .6, rate: 1.1 }); await bridge(); if (!alive()) return bail();
  for (let i = 0; i < T.cards.length; i++) { const p = fanPos(i); cardT(T.cards[i], p.x, p.y, p.a, 1, i); if (i % 3 === 0) tsnd('flip', { vol: .25, rate: 1.3 }); await sleep(40); }
  $('#tsub').textContent = 'tota ji is choosing…';
  const ch = T.cards[0].offsetHeight, tw = T.tota.offsetWidth, th = T.tota.offsetHeight;
  const spot = i => { const p = fanPos(i); return { x: p.x - tw * .7, y: p.y + ch * .32 - th * .5 }; };
  const n = T.cards.length, choice = 1 + ((Math.random() * (n - 2)) | 0);
  const path = [1, 3, 5, Math.min(n - 2, 7), clamp(choice + (choice > 4 ? -2 : 2), 0, n - 1), choice];
  for (let k = 0; k < path.length; k++) {
    const s = spot(path[k]);
    await hop(s.x, s.y, { h: rnd(22, 46), ms: rnd(300, 440) }); if (!alive()) return bail();
    if (k === 2 || k === path.length - 2) { await bob((rnd(1, 3)) | 0); if (Math.random() < .5) tsnd('parrot', { vol: .45 }); } else await sleep(rnd(80, 260));
  }
  await bob(1); if (!alive()) return bail();
  const reading = Array.isArray(f.text) ? pick(f.text) : f.text;
  const p = fanPos(choice), el = T.cards[choice];
  const front = el.querySelector('.kc-front'); front.style.backgroundImage = `url(assets/cards/${f.img}.webp)`;
  front.replaceChildren();
  if (!HAS_TEXT.has(f.img)) { const lab = document.createElement('span'); lab.className = 'kc-label'; lab.textContent = f.title; front.appendChild(lab); }
  T.tota.src = 'assets/game/parrot_card.webp'; tsnd('parrot', { vol: .7 });
  cardT(el, p.x, p.y - 30, p.a, 1, 60); buzz(15);
  await sleep(340); if (!alive()) return bail();
  T.cards.forEach(c => { if (c !== el) c.style.opacity = .14; });
  T.tota.src = 'assets/game/parrot.webp';
  const home = perchSpot();
  hop(home.x, home.y, { face: -1, h: 50, ms: 520 }).then(() => totaPlace(home.x, home.y, 1));
  cardT(el, 0, -26, 0, W_SCALE(), 60); await sleep(440); if (!alive()) return bail();
  $('#tlabel').hidden = false;
  el.classList.add('flip'); tsnd('flip', { vol: .9 }); buzz(20);
  await sleep(520); if (!alive()) return bail();
  tsnd('win', { vol: .55 });
  $('#ttext').textContent = reading;
  $('#tread').hidden = false; $('#tagain').hidden = false;
  $('#tsub').textContent = 'tota ji has spoken.';
  setTimeout(() => $('#tlabel').scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);   // card + reading in one view
  SH.tota = { img: `assets/cards/${f.img}.webp?v=2`, title: f.title, text: reading, kick: `${who()}’s kismat for 2027` }; showShare('tota'); showPin('tota');
  haul('tota', f.title, reading, `assets/cards/${f.img}.webp?v=2`); DONE.tota = true;
  T.busy = false;
}
$('#tgo').addEventListener('click', totaPlay);
$('#tagain').addEventListener('click', () => guide('gTota', false));
$('#tagain').addEventListener('click', totaPlay);
T.table.addEventListener('click', () => { if (!T.busy && T.table.classList.contains('can-shuffle')) { snd('tap', { vol: .5 }); totaPlay(); } });   // tap the deck itself to shuffle
requestAnimationFrame(totaBuild);
window.addEventListener('resize', () => { if (!T.busy && !DONE.tota) totaBuild(); });

/* ═════════ gubbara phod — air rifle, drag to aim, release to fire ═════════ */
const INAAMS = [
  'the last kaju katli in the dabba', 'a soan papdi box you can regift (again)', 'immunity from “beta, shaadi kab?”',
  'first dibs on tonight’s chugli', 'a lifetime supply of nazar (with nimbu-mirchi)', 'one excuse to skip the family whatsapp call',
  'the aux cord, for exactly one song', 'a phuljhadi that actually lights', 'front-row seat at the family dance-off',
  'one guilt-free extra gulab jamun', 'a compliment from a total stranger', 'the window seat at the chai tapri',
  'one genuinely great tip from mausi', 'a diya that refuses to go out', 'a thumka lesson from the aunties',
  'one “i told you so”, valid all year', 'the good chair at the next family function', 'a free pass on one bad decision',
  'the last plate of pani puri', 'the first slice of every cake this year', 'one day of no replies, no guilt',
  'a perfectly timed entry at the next party', 'a photo where everyone looks good', 'a spot in the front row of the group pic',
  'an aunty who finally gets your name right', 'a playlist the whole room actually likes', 'one cancelled plan you secretly wanted cancelled',
  'a window seat on your next flight', 'a lehenga that fits on the first try', 'the right to choose the restaurant, once',
  'a cab that arrives in 2 minutes', 'zero awkward questions this diwali', 'one surprise refund',
  'the last laddoo, unclaimed', 'a mirror selfie with perfect lighting',
  'a free “beta, kitni pyaari lag rahi ho” from mausi', 'a 6am good-morning forward, every day', 'the seat next to the uncle who explains crypto',
  'one more soan papdi (fifth this week)', 'one extra paratha from mummy, any day you want', 'the best photo of the night (someone else clicks it)',
  'a front-row seat at the next sangeet', 'one compliment from the aunty who never compliments', 'a plus-one to any party you like',
];
function addWin(list, text, img) {
  const c = document.createElement('div'); c.className = 'win-card';
  const i = document.createElement('img'); i.src = img; i.alt = '';
  const p = document.createElement('p'); p.textContent = text;
  c.append(i, p); $(list).appendChild(c);
}
const MISS_LINES = ['chook gaye!', 'thoda left, beta', 'hawa mein!', 'almost!', 'arre!', 'uncle is laughing', 'so close!', 'try again, champ'];
const G = { balloons: [], shots: 10, aiming: false, ax: 0, ay: 0, cx: 0, cy: 0, raf: 0, t0: 0, pool: [], bi: 0 };
const range = $('#range'), wall = $('#gwall'), cross = $('#cross'), rifle = $('#rifle');
const MAX_POP = 4;                                   // you can win at most four balloons; 10 pellets to do it
const SLOTS = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) SLOTS.push([(c + .5) / 5, .15 + r * .22]);
const gsnd = (n, o) => { if (ACTIVE === 'gubbara') snd(n, o); };
function spawnBalloon(slot) {
  const el = document.createElement('div'); el.className = 'gub';
  const img = document.createElement('img'); img.src = `assets/game/bal${G.bi++ % 8}.webp`; img.alt = '';
  el.appendChild(img); wall.appendChild(el);
  const [bx, by] = SLOTS[slot];
  const b = { img: img.src, el, slot, bx, by, ph: rnd(0, 6.3), sp: rnd(.6, 1.1), amp: rnd(.025, .05), alive: true, prize: G.pool.shift() || pick(INAAMS) };
  el.animate([{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }], { duration: 700, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  G.balloons.push(b); return b;
}
function gubbaraReset() {
  guide('gGub', true); wall.replaceChildren(); G.balloons = []; G.shots = 10; G.aiming = false; G.bi = (Math.random() * 8) | 0; DONE.gubbara = false;
  G.pool = [...INAAMS].sort(() => Math.random() - .5);
  SLOTS.forEach((_, i) => spawnBalloon(i));
  $('#gshots').innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('');
  $('#ghaul').hidden = true; $('#glist').replaceChildren(); $('#gagain').hidden = true; hideShare('gubbara'); hidePin('gubbara');
  $('#gsub').textContent = `0/${MAX_POP} popped · 10 pellets left`;
  requestAnimationFrame(() => { const r0 = range.getBoundingClientRect(); G.ax = r0.width / 2; G.ay = r0.height * .35; });
  cancelAnimationFrame(G.raf); G.t0 = performance.now(); G.raf = requestAnimationFrame(gubbaraLoop);
}
function gubbaraResume() { cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(gubbaraLoop); }
function balloonPos(b, t) {
  const W = wall.clientWidth, H = wall.clientHeight;
  return { x: (b.bx + Math.sin(t * b.sp + b.ph) * b.amp) * W, y: (b.by + Math.cos(t * b.sp * 1.3 + b.ph) * b.amp * .8) * H };
}
function gubbaraLoop(now) {
  if ($('[data-panel=gubbara]').hidden) { G.raf = 0; return; }
  const t = (now - G.t0) / 1000;
  G.balloons.forEach(b => { if (!b.alive) return; const p = balloonPos(b, t); b.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${Math.sin(t * b.sp + b.ph) * 6}deg)`; });
  const sway = G.aiming ? 1 : .4;                       // a little hand sway — skill still wins
  G.cx = G.ax + Math.sin(t * 2.1) * 4 * sway; G.cy = G.ay + Math.cos(t * 1.7) * 3 * sway;
  cross.style.transform = `translate(${G.cx}px,${G.cy}px)`;
  const W = range.clientWidth, H = range.clientHeight, bx = W * .5, by = H * 1.02;   // the shooter stands back from the counter
  const ang = Math.atan2(G.cy - by, G.cx - bx) * 180 / Math.PI;
  rifle.style.left = bx + 'px'; rifle.style.top = by + 'px'; rifle.style.setProperty('--rw', Math.min(H * .34, W * .5) + 'px');
  rifle.style.transform = `translate(0, -50%) rotate(${ang.toFixed(2)}deg) scaleY(${Math.abs(ang) > 90 ? -1 : 1})`;
  G.raf = requestAnimationFrame(gubbaraLoop);
}
function aimAt(e) { const p = local(range, e); G.ax = clamp(p.x, 6, p.w - 6); G.ay = clamp(p.y - (e.pointerType === 'touch' && G.pad ? 70 : 0), 6, p.h * .78); }   // drag from the pad: crosshair sits above the finger; tap a balloon: fire right there
range.addEventListener('pointerdown', e => {
  if (G.shots <= 0) return; start(); e.preventDefault();
  G.pad = !!e.target.closest('.aimpad'); guide('gGub', false);
  G.aiming = true; if (G.pad) { try { range.setPointerCapture(e.pointerId); } catch (err) {} } aimAt(e); range.classList.add('aiming');
});
range.addEventListener('pointermove', e => { if (G.aiming || e.pointerType === 'mouse') aimAt(e); });
range.addEventListener('pointerup', () => { if (!G.aiming) return; G.aiming = false; range.classList.remove('aiming'); fire(); });
range.addEventListener('pointercancel', () => { G.aiming = false; range.classList.remove('aiming'); });
async function fire() {
  if (G.shots <= 0) return;
  G.shots--; $('#gshots').children[9 - G.shots].classList.add('used');
  gsnd('rifle', { vol: .8 }); buzz(12);
  rifle.animate([{ translate: '0 0' }, { translate: '14px 10px' }, { translate: '0 0' }], { duration: 180 });
  const x = G.cx, y = G.cy; await sleep(90);
  const t = (performance.now() - G.t0) / 1000;
  const wx = x - wall.offsetLeft, wy = y - wall.offsetTop;
  let hit = null, best = 1e9;
  G.balloons.forEach(b => {
    if (!b.alive) return;
    const p = balloonPos(b, t), r = b.el.offsetWidth * .48, d = Math.hypot(p.x - wx, (p.y - b.el.offsetHeight * .15) - wy);
    if (d < r && d < best) { best = d; hit = b; }
  });
  const fx = document.createElement('i'); fx.className = hit ? 'gfx pop' : 'gfx puff'; fx.style.left = x + 'px'; fx.style.top = y + 'px'; range.appendChild(fx); setTimeout(() => fx.remove(), 700);
  if (hit) {
    gsnd('bpop', { vol: .9 }); buzz(25); hit.alive = false; hit.el.classList.add('popped');
    hit.el.querySelector('img').src = 'assets/game/bal8.webp';
    const tag = document.createElement('span'); tag.className = 'gtag'; tag.textContent = hit.prize; hit.el.appendChild(tag);
    addWin('#glist', hit.prize, hit.img); $('#ghaul').hidden = false;
  } else {
    gsnd('tock', { vol: .6 }); const m = document.createElement('span'); m.className = 'gmiss'; m.textContent = pick(MISS_LINES); m.style.left = x + 'px'; m.style.top = y + 'px'; range.appendChild(m); setTimeout(() => m.remove(), 900);
  }
  const popped = G.balloons.filter(b => !b.alive).length;
  if (G.shots === 0 || popped >= MAX_POP) {
    G.shots = 0; [...$('#gshots').children].forEach(i => i.classList.add('used'));
    const n = $('#glist').children.length;
    if (!n) { addWin('#glist', 'one pat on the head from the stall uncle', 'assets/game/bal8.webp'); $('#ghaul').hidden = false; gsnd('fail', { vol: .6 }); }
    else setTimeout(() => gsnd('win', { vol: .6 }), 300);
    $('#gsub').textContent = n >= MAX_POP ? `all ${MAX_POP} popped! maximum loot. here’s what you won.` : n ? `${n} popped! here’s what you won.` : 'all misses! uncle feels bad for you.';
    showShare('gubbara'); showPin('gubbara'); $('#gagain').hidden = false; DONE.gubbara = true;
    const wins = [...document.querySelectorAll('#glist .win-card p')].map(p => p.textContent);
    haul('gubbara', n ? `popped ${n} balloon${n > 1 ? 's' : ''}` : 'all misses', wins.join(' · '), 'assets/game/bal1.webp');
  } else $('#gsub').textContent = `${popped}/${MAX_POP} popped · ${G.shots} pellet${G.shots > 1 ? 's' : ''} left.`;
}
$('#gagain').addEventListener('click', gubbaraReset);

/* ═════════ ring toss — flick a ring onto one of two banta bottles. 10 rings, coaching on every miss ═════════ */
const PRIZES = [
  ['aunty approval', 'she said “kitni sundar lag rahi hai”. frame it.'],
  ['gossip VIP pass', 'you hear the chugli first, before the group chat does.'],
  ['dance-floor immunity', 'nobody can drag you to dance. (you’ll go anyway.)'],
  ['the last samosa', 'it’s yours. nobody will fight you for it. probably.'],
  ['no-nazar shield', 'one nimbu-mirchi, personally assigned to you for the year.'],
  ['the aux cord', 'one full hour of your songs. no skips allowed.'],
  ['bouncer at the bar', 'you skip the queue tonight. walk like you know someone.'],
  ['the good lighting spot', 'the best selfie corner is officially yours tonight.'],
  ['a wingman/wingwoman', 'one friend is now contractually obliged to hype you up.'],
  ['taxi-fare blessing', 'your ride home shows up in two minutes. surge-free.'],
  ['extra mithai quota', 'double servings, zero questions asked.'],
  ['DJ request token', 'one song, played on demand. choose wisely.'],
  ['family-function escape card', 'leave any family function early, no explanations.'],
  ['the boss blessing', 'one free “sorry, i was in a meeting” this year.'],
  ['beta, kitni patli ho gayi', 'one aunty will say it. you will believe her.'],
  ['the comeback of the year', 'you’ll think of the perfect reply in time. for once.'],
  ['the group-chat crown', 'your memes land every single time this year.'],
  ['a full night’s sleep', 'after diwali week. you’ve earned it.'],
  ['VIP gossip seat', 'front-row seat for the best story of the night.'],
  ['main-character armour', 'nothing and nobody can dim your shine this year.'],
  ['dessert first', 'tonight you skip straight to the gulab jamun.'],
  ['bindi of confidence', 'stick it on and walk in like you own the place.'],
  ['the perfect diwali pic', 'one candid where you look unreal. trust.'],
  ['a pocket of good luck', 'one small, lucky thing happens before new year.'],
  ['no dishwashing duty', 'after every party this year. someone else has it.'],
  ['the perfect group photo', 'you’re in it, everyone’s eyes are open. a miracle.'],
  ['sharma ji’s praise', 'this year, sharma ji compares his kid to you.'],
  ['the window seat', 'every flight, every car ride, all year.'],
  ['chai on the house', 'tonight’s chai is on someone else. all of it.'],
  ['trip captain', 'you plan the group trip, and this time everyone shows up.'],
  ['aunty’s seal of approval', '“bilkul perfect bana hai.” about your cooking. finally.'],
];
const MAX_RING = 2;                                  // win at most two bottles; 10 rings to do it
const R = { left: 10, busy: false, drag: null, won: [], pool: [], bi: 0 };
const cstage = $('#cstage'), ring = $('#cring'), aimLine = $('#caimline');
const csnd = (n, o) => { if (ACTIVE === 'chhalla') snd(n, o); };
function ringHome() { ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 1; ring.style.transform = 'translate(-50%, 0)'; }
function chhallaStatus() {
  $('#csub').textContent = R.left > 0 ? `${R.won.length}/${MAX_RING} ringed · ${R.left} ring${R.left > 1 ? 's' : ''} left` : 'all rings thrown!';
  $('#crings').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < 10 - R.left ? 'used' : ''}"></i>`).join('');
}
function makeBottle(i) {
  const b = document.createElement('div'); b.className = 'bot';
  b.dataset.p = R.pool.length ? R.pool.shift() : (Math.random() * PRIZES.length) | 0;
  b.style.animationDelay = (-i * 1.1).toFixed(1) + 's';
  const back = document.createElement('i'); back.className = 'hoop back';
  const img = document.createElement('img'); img.src = `assets/game/bottle${R.bi++ % 5}.webp`; img.alt = '';
  const front = document.createElement('i'); front.className = 'hoop front';
  b.append(back, img, front); return b;
}
function chhallaReset() {
  const shelf = $('#cshelf'); shelf.replaceChildren();
  R.pool = [...PRIZES.keys()].sort(() => Math.random() - .5); R.bi = (Math.random() * 5) | 0;
  for (let i = 0; i < 5; i++) shelf.append(makeBottle(i));
  guide('gRing', true); R.left = 10; R.busy = false; R.won = []; DONE.chhalla = false; ringHome(); hideShare('chhalla'); hidePin('chhalla');
  $('#chaul').hidden = true; $('#clist').replaceChildren(); $('#cagain').hidden = true; $('#ccoach').hidden = true;
  chhallaStatus();
}
cstage.addEventListener('pointerdown', e => {
  if (R.busy || R.left <= 0) return;
  const rr = ring.getBoundingClientRect();
  const onPad = !!e.target.closest('.launchpad, .ring');
  if (!onPad && Math.hypot(e.clientX - (rr.left + rr.width / 2), e.clientY - (rr.top + rr.height / 2)) > rr.width * 1.6) return;   // anywhere in the throw zone works
  start(); guide('gRing', false); e.preventDefault(); try { cstage.setPointerCapture(e.pointerId); } catch (err) {}
  R.drag = { x0: e.clientX, y0: e.clientY, hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
  cstage.classList.add('aiming');
});
cstage.addEventListener('pointermove', e => {
  if (!R.drag) return;
  const now = performance.now(); R.drag.hist.push({ x: e.clientX, y: e.clientY, t: now }); while (R.drag.hist.length > 2 && now - R.drag.hist[0].t > 90) R.drag.hist.shift();
  const dx = e.clientX - R.drag.x0, dy = e.clientY - R.drag.y0;
  ring.style.transform = `translate(calc(-50% + ${dx * .35}px), ${dy * .35}px) scale(1.05)`;
  const s = cstage.getBoundingClientRect(), rr = ring.getBoundingClientRect(), cx = rr.left + rr.width / 2 - s.left, cy = rr.top + rr.height / 2 - s.top;
  aimLine.setAttribute('x1', cx); aimLine.setAttribute('y1', cy); aimLine.setAttribute('x2', cx + dx * 1.6); aimLine.setAttribute('y2', cy + dy * 1.6);
});
function endDrag() { R.drag = null; cstage.classList.remove('aiming'); aimLine.setAttribute('x2', aimLine.getAttribute('x1')); aimLine.setAttribute('y2', aimLine.getAttribute('y1')); }
cstage.addEventListener('pointerup', () => {
  if (!R.drag) return;
  const h = R.drag.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b.t - a.t);
  const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
  endDrag();
  if (vy > -.25) { ringHome(); coach('flick it upwards, a bit quicker.'); return; }
  csnd('whoosh', { vol: .6 }); chhallaThrow(vx, vy);
});
cstage.addEventListener('pointercancel', () => { endDrag(); ringHome(); });
function coach(msg, good) { const c = $('#ccoach'); c.hidden = false; c.textContent = msg; c.classList.toggle('good', !!good); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
async function chhallaThrow(vx, vy) {
  R.busy = true;
  const s = cstage.getBoundingClientRect(), rr = ring.getBoundingClientRect();
  const cx = rr.left + rr.width / 2 - s.left, cy = rr.top + rr.height / 2 - s.top;
  const power = clamp(-vy, .25, 3.2);
  const b0 = cstage.querySelector('.bot').getBoundingClientRect(), reach = cy - (b0.top + b0.height * .2 - s.top);   // distance up to the bottle necks
  const tx = cx + vx * 220 * .8, ty = cy - reach * clamp(.8 + (power - 1) * .22, .62, 1.3);   // an average flick lands at neck height
  let hitB = null, near = null, nd = 1e9;
  cstage.querySelectorAll('.bot').forEach(b => {
    const r = b.getBoundingClientRect(), nx = r.left + r.width / 2 - s.left, ny = r.top + r.height * .2 - s.top;
    const d = Math.hypot(tx - nx, ty - ny); if (d < nd) { nd = d; near = { el: b, x: nx, y: ny, w: r.width, h: r.height }; }
    // very forgiving: anything roughly in the bottle's area counts, and the closest open bottle wins
    const dd = Math.hypot((tx - nx) / (r.width * 1.25), (ty - ny) / (r.height * .7));
    if (!b.classList.contains('ringed') && dd < 1 && (!hitB || dd < hitB.dd)) hitB = { el: b, x: nx, y: ny, dd };
  });
  const endX = hitB ? hitB.x : tx, endY = hitB ? hitB.y : ty, arcH = 60 + power * 30;
  const anim = ring.animate([
    { transform: 'translate(-50%, 0) scale(1) rotateX(0deg)' },
    { transform: `translate(calc(-50% + ${(endX - cx) / 2}px), ${(endY - cy) / 2 - arcH}px) scale(.75) rotateX(40deg) rotate(360deg)`, offset: .5 },
    { transform: `translate(calc(-50% + ${endX - cx}px), ${endY - cy}px) scale(.5) rotateX(68deg) rotate(720deg)` },
  ], { duration: 650, easing: 'cubic-bezier(.3,.2,.4,1)', fill: 'forwards' });
  await anim.finished.catch(() => {});
  R.left--;
  if (hitB) {
    csnd('ringglass', { vol: .9 }); buzz(25);
    ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 0;
    hitB.el.classList.add('ringed');                     // the ring now lives on the bottle neck and sways with it
    const [name, text] = PRIZES[+hitB.el.dataset.p]; R.won.push(name);
    addWin('#clist', `${name}: ${text}`, hitB.el.querySelector('img').src); $('#chaul').hidden = false;
    coach(pick(['ringed it!', 'shabaash!', 'ekdum perfect!', 'what a throw!']), true);
    setTimeout(() => csnd('win', { vol: .45 }), 250);
  } else {
    csnd('ringfloor', { vol: .7 });
    ring.animate([
      { transform: `translate(calc(-50% + ${endX - cx}px), ${endY - cy}px) scale(.5) rotateX(68deg)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${endX - cx + rnd(-60, 60)}px), ${endY - cy + 140}px) scale(.45) rotateX(80deg) rotate(260deg)`, opacity: 0 },
    ], { duration: 520, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' });
    const dy = ty - near.y, dxn = tx - near.x, tips = [];
    if (dy < -near.h * .7) tips.push('too far — less force');
    else if (dy > near.h * .7) tips.push('too short — flick harder');
    if (Math.abs(dxn) > near.w * 1.25) tips.push(dxn > 0 ? 'aim a little left' : 'aim a little right');
    coach(tips.length ? tips.join(', ') + '.' : 'so close! same again.');
  }
  await sleep(750);
  chhallaStatus();
  if (R.won.length >= MAX_RING) R.left = 0;
  chhallaStatus();
  if (R.left > 0) ringHome();
  else {
    ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 0; $('#cagain').hidden = false; DONE.chhalla = true;
    const n = R.won.length;
    if (!n) { addWin('#clist', 'the banta stays undefeated: one free nimbu soda, on the house.', 'assets/game/bottle0.webp'); $('#chaul').hidden = false; csnd('fail', { vol: .6 }); }
    $('#csub').textContent = n >= MAX_RING ? `both bottles ringed! maximum loot.` : n ? `${n} ring landed! here’s what you won.` : 'no rings this time. one more go?';
    const wins = [...document.querySelectorAll('#clist .win-card p')].map(p => p.textContent);
    SH.chhalla = { img: 'assets/game/bottle0.webp', title: n ? `ringed ${n} bottle${n > 1 ? 's' : ''} and won` : 'the banta won', text: wins.join(' · '), kick: `${who()}’s ring toss prizes` };
    showShare('chhalla'); showPin('chhalla');
    haul('chhalla', SH.chhalla.title, wins.join(' · '), 'assets/game/bottle0.webp');
  }
  R.busy = false;
}
$('#cagain').addEventListener('click', chhallaReset);

/* ═════════ lucky draw — your mood for 2027. a real crank; mood × colour × snack × month = thousands of tickets ═════════ */
const MOODS = [   // each title must make sense on its own after "my mood for 2027:"; the line under it says what that year looks like
  // sweet
  ['i’m my own good luck charm', 'good things keep finding you all year. you stop acting surprised.'],
  ['main character, no notes', 'every room you walk into next year is your entrance scene.'],
  ['soft life, strict boundaries', 'more rest, fewer favours. “bas 5 minute ka kaam hai” gets a no.'],
  ['delulu, but it works', 'your wildest plan sounds crazy out loud, and it actually works.'],
  ['calm. nothing rattles me', 'not even the family group chat. full zen all year.'],
  ['unbothered and glowing', 'people talk, you glow. that’s the whole year.'],
  ['chaotic, but cute', 'last-minute plans that turn into the best memories of the year.'],
  ['tired, but iconic', 'running on chai and charisma, still the best dressed in the room.'],
  ['passport ready, always', 'at least one trip gets booked at 2am. zero regrets.'],
  ['glow-up in progress', 'new habits finally stick. people ask what changed.'],
  ['saying yes to every invite', 'your calendar needs its own calendar.'],
  ['happily staying in', 'cancelled plans, cosy nights, zero guilt. bliss.'],
  ['ask for it, get it', 'the raise, the upgrade, the extra gulab jamun. you just ask.'],
  ['side-hustle mode', 'one small idea turns into real money. tell nobody till it works.'],
  ['jugaad queen', 'no plan? a safety pin and a smile, and somehow it all works.'],
  ['first on the dance floor', 'last to leave too. every DJ will know your name.'],
  ['dressed to be copied', 'every outfit is a statement. the mohalla copies you by march.'],
  ['sweet as kaju katli', 'everyone wants a bit of your time next year. share wisely.'],
  ['spicy as hari mirchi', 'sharp tongue, warm heart, zero tolerance for nonsense.'],
  ['protecting my peace', 'you guard it like it’s the last samosa on the plate.'],
  ['saying it like it is', 'you say what everyone’s thinking. they love you for it.'],
  ['secretly a softie', 'you’ll cry at a wedding you didn’t even want to go to.'],
  ['new city, new me', 'a move, a new address, or at least a new favourite café.'],
  ['healing, but stylish', 'therapy on tuesday, brunch on sunday, outfit on point.'],
  ['peacemaker over chai', 'you settle every fight with two cutting chais.'],
  ['on a lucky streak', 'parking spots, upgrades, the last piece of cake. all yours.'],
  ['rich aunty in training', 'big sunglasses, bigger plans, a savings account that grows.'],
  ['unreachable (in a good way)', 'you’re out living life. leave a voice note.'],
  ['excited about everything', 'golden-retriever energy: friends with everyone, tail wagging.'],
  ['mysterious and selective', 'black-cat energy. annoyingly cool, hard to impress.'],
  ['a morning person now (shock)', 'sunrise walks. nobody recognises you anymore.'],
  ['night owl royalty', 'best ideas at 2am, best stories at 4am.'],
  ['going with the flow', 'no plans, all vibes, and it all lands anyway.'],
  ['brave enough to try', 'you say yes to the scary thing, and it pays off.'],
  ['my friends’ biggest cheerleader', 'they win more next year because you’re in the front row.'],
  ['quietly winning', 'no announcements, no posts. just results.'],
  ['shaadi-season ready', 'six weddings, four sangeets, one perfectly repeated lehenga.'],
  ['family favourite', 'your approval rating at home hits an all-time high.'],
  ['someone’s crushing on me', 'you’ll find out who by holi. act natural.'],
  ['manifesting, hard', 'the vision board goes up, and for once it listens.'],
  ['offline and loving it', 'less scrolling, more sunsets. weirdly, it’s great.'],
  ['ride or die for my people', 'they’ll need you next year, and you’ll show up every time.'],
  ['slow start, big finish', 'like an anaar: quiet at first, then you light up the whole sky.'],
  ['sparkling, like a phuljhadi', 'small sparks of fun wherever you go.'],
  ['still glowing, thanks', 'things try to dim you next year. you keep shining.'],
  ['fully on leave', 'you finally take the holiday, and actually switch off.'],
  ['gym era (for real)', 'three times a week. people notice. you mention it.'],
  ['famous for one dish', 'one recipe becomes legendary. everyone wants the secret.'],
  ['texting first, no ego', 'you make the call, and good things follow.'],
  ['a compliment magnet', 'strangers stop you to ask where it’s from.'],
  ['standards: sky high', 'only premium people get your time next year.'],
  ['finally letting go', 'you close the chapter that kept dragging. lighter already.'],
  ['worth every rupee', 'every plan, every trip, every splurge: full paisa vasool.'],
  ['i’m the vibe', 'parties start when you walk in. that’s just facts.'],
  ['calm, rich and slightly smug', 'things work out, and you knew they would.'],
  // roasts
  ['big plans, starting monday', 'diet, gym, journaling: planned every monday. one of them sticks.'],
  ['slow replies, big heart', 'you take your time to reply, but every reply is worth it.'],
  ['“just one more episode”', 'it’s 4am. it’s always 4am.'],
  ['treat-yourself mode', 'the sale said 70% off. you said yes, and you deserve it.'],
  ['thoughtful to a fault', 'every text gets three drafts. people love how much you care.'],
  ['cosy over crowded', 'you’ll pick quiet nights in, and they’ll be the best ones.'],
  ['dressed for my mood', 'whatever the day brings, the outfit is great.'],
  ['always on the go', 'your phone and you, both busy making memories.'],
  ['leaving by 10 (left at 4)', 'last one out of every party. again.'],
  ['slightly unhinged, it’s working', 'iced coffee in december energy. nobody gets it, everyone wants in.'],
  ['aunty-approved wisdom', 'you’ll give the best advice in the group, all year.'],
  ['still talking about my sangeet dance', 'one performance, a whole year of reminiscing.'],
  ['fashionably late, always welcome', 'you arrive a little late, and the party lights up.'],
  ['nap queen', 'power naps fuel your best ideas all year.'],
  ['ten minutes late, glowing', 'never on time, always worth the wait.'],
  ['i don’t gossip, i share updates', 'the mohalla’s most reliable news channel, that’s you.'],
  ['hobby explorer', 'pottery, piano, running: you’ll try them all and love at least one.'],
];
const LUCK = {
  colour: ['rani pink', 'haldi yellow', 'peacock blue', 'sindoor red', 'mehendi green', 'marigold orange', 'royal purple', 'gold, obviously', 'silver', 'emerald', 'midnight black', 'ivory', 'teal', 'mirchi red'],
  snack: ['samosa', 'jalebi', 'pani puri', 'vada pav', 'kaju katli', '2am maggi', 'gulab jamun', 'chai-biscuit', 'momos', 'bhel puri', 'soan papdi (regifted)', 'masala chips', 'rasmalai', 'chakli'],
  month: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
};
const D = { ang: 0, vel: 0, total: 0, need: 900, busy: false, done: false, drag: null, raf: 0, last: 0, slips: [], lastClick: 0 };
const body = $('#drBody'), crank = $('#drCrank'), slipBox = $('#drSlips'), dstage = $('#dstage');
const meter = [...document.querySelectorAll('#dmeter i')];
(() => { const cols = ['#efbd0d', '#ec5a86', '#2f9790', '#1d8cc4', '#c4221a', '#f7e6c8'];
  for (let i = 0; i < 14; i++) { const s = document.createElement('i'); s.style.background = cols[i % cols.length]; slipBox.appendChild(s); D.slips.push({ el: s, a: rnd(0, 6.3), r: rnd(.15, .42), spin: rnd(0, 360) }); } })();
function drawMeter() { const k = D.total / D.need; meter.forEach((m, i) => m.classList.toggle('on', k >= (i + 1) / 3)); }
function drawLoop(now) {
  const dt = Math.min(.05, (now - (D.last || now)) / 1000); D.last = now;
  const live = ACTIVE === 'draw';
  if (!live) { D.vel = 0; D.drag = null; }
  if (!D.drag) D.vel *= Math.pow(.25, dt);                 // the drum coasts and slows down
  const step = D.vel * dt; D.ang += step; if (!D.done) D.total += Math.abs(step);
  crank.style.transform = `rotateX(${D.ang.toFixed(1)}deg)`;
  const ph = rad(D.ang);
  body.style.transform = `scaleY(${(.94 + .06 * Math.abs(Math.cos(ph * 3))).toFixed(3)}) translateY(${(Math.sin(ph * 3) * 3).toFixed(1)}px)`;
  const W = slipBox.clientWidth, H = slipBox.clientHeight, sp = Math.min(1, Math.abs(D.vel) / 500), rest = 1 - sp;
  D.slips.forEach((s, i) => {
    s.a += D.vel * dt * (.012 + i * .0006); s.spin += D.vel * dt * .6;
    const x = W / 2 + Math.cos(s.a) * s.r * W * (1 - rest * .2), y = H / 2 + Math.sin(s.a) * s.r * H * sp + rest * H * (.12 + s.r * .45);
    s.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${s.spin.toFixed(0)}deg)`;
  });
  // ratchet clicks every quarter turn
  if (live && !D.done && Math.floor(D.ang / 90) !== D.lastClick) { D.lastClick = Math.floor(D.ang / 90); snd('ratchet', { vol: .5, rate: rnd(.9, 1.1) }); }
  const dv = live && !D.done ? Math.min(1, Math.abs(D.vel) / 600) * .9 : 0;
  loopVol('drum', dv < .03 ? 0 : dv);
  drawMeter();
  if (!D.done && D.total >= D.need) drawDrop();
  if (D.done && Math.abs(D.vel) < 5) { D.vel = 0; D.raf = 0; loopVol('drum', 0); return; }   // ticket out: drum rests, sound off
  if (live || Math.abs(D.vel) > 1) D.raf = requestAnimationFrame(drawLoop); else { D.raf = 0; loopVol('drum', 0); }
}
function kick() { if (!D.raf) { D.last = 0; D.raf = requestAnimationFrame(drawLoop); } }
// the whole drum is the handle: drag in any circle-ish way; a plain tap gives it a shove
dstage.addEventListener('pointerdown', e => {
  if (D.done) return; start(); guide('gDrum', false); e.preventDefault(); try { dstage.setPointerCapture(e.pointerId); } catch (err) {}
  D.drag = { lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), moved: 0 };
  $('#dsub').textContent = 'keep turning…'; dstage.classList.add('turning'); kick();
});
dstage.addEventListener('pointermove', e => {
  if (!D.drag) return;
  const now = performance.now(), dt = Math.max(8, now - D.drag.lastT);
  const dist = Math.hypot(e.clientX - D.drag.lastX, e.clientY - D.drag.lastY), w = dist * 2.4;
  D.drag.moved += dist; D.ang += w; D.total += w; D.vel = clamp(w / dt * 1000, 0, 1400);
  D.drag.lastX = e.clientX; D.drag.lastY = e.clientY; D.drag.lastT = now;
});
const endCrank = () => {
  if (!D.drag) return;
  if (D.drag.moved < 8 && !D.done) { D.vel = Math.min(1100, D.vel + 520); }     // tap = a shove
  D.drag = null; dstage.classList.remove('turning');
  if (!D.done) $('#dsub').textContent = D.total > D.need * .6 ? 'almost… one more turn!' : 'keep going, it’s heavy!';
};
dstage.addEventListener('pointerup', endCrank); dstage.addEventListener('pointercancel', endCrank);
$('#dspin').addEventListener('click', async () => {             // for anyone who'd rather tap
  if (D.done || D.busy) return; guide('gDrum', false); start(); D.busy = true; $('#dsub').textContent = 'ghuma ghuma ke…'; kick();
  while (!D.done && ACTIVE === 'draw') { D.vel = Math.min(900, D.vel + 140); await sleep(60); }
  D.busy = false;
});
async function drawDrop() {
  D.done = true; loopVol('drum', 0); D.vel = Math.min(D.vel, 200); $('#dspin').hidden = true;
  const [name, text] = pick(MOODS), extra = `lucky colour: ${pick(LUCK.colour)} · lucky snack: ${pick(LUCK.snack)} · best month: ${pick(LUCK.month)}`;
  $('#tno').textContent = String(1000 + ((Math.random() * 9000) | 0));
  $('#tname').textContent = `“${name}”`; $('#ttext2').textContent = text; $('#textra').textContent = extra;
  $('#dsub').textContent = 'a ticket drops…';
  const drop = $('#drDrop'); drop.classList.remove('go'); void drop.offsetWidth; drop.classList.add('go');
  snd('tdrop'); await sleep(750);
  if (ACTIVE !== 'draw') return;
  dstage.classList.add('gone'); $('#dmeter').classList.add('gone'); $('[data-panel=draw] .d-intro').classList.add('gone');   // the drum steps aside, the ticket takes the stage
  await sleep(380);
  const t = $('#ticket'); t.hidden = false; t.classList.remove('open'); void t.offsetWidth; t.classList.add('open');
  snd('unfold'); setTimeout(() => snd('win', { vol: .7 }), 380); buzz(25);
  $('#dsub').textContent = 'your 2027, sorted.';
  setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  SH.draw = { img: 'assets/game/ticket.webp', title: `“${name}”`, text: text + ' ' + extra, kick: `${who()}’s mood for 2027` }; showShare('draw'); showPin('draw');
  haul('draw', `“${name}”`, text + ' ' + extra, 'assets/game/ticket.webp'); DONE.draw = true;
  $('#dagain').hidden = false;
}
function drawReset() {
  guide('gDrum', true); D.done = false; DONE.draw = false; D.total = 0; D.vel = 0; hideShare('draw'); hidePin('draw'); $('#ticket').hidden = true; $('#ticket').classList.remove('open'); $('#dagain').hidden = true; $('#dspin').hidden = false;
  dstage.classList.remove('gone'); $('#dmeter').classList.remove('gone'); $('[data-panel=draw] .d-intro').classList.remove('gone');
  $('#drDrop').classList.remove('go'); $('#dsub').textContent = 'drag the drum round (or tap the button).'; drawMeter();
}
$('#dagain').addEventListener('click', () => { drawReset(); snd('tap'); $('#dstage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
// the wall only wakes up when it's near the screen (saves the first load), and sleeps when it's scrolled away
(() => { const el = $('#wall'); let started = false;
  new IntersectionObserver(es => es.forEach(e => {
    WS.vis = e.isIntersecting;
    if (e.isIntersecting && !started) { started = true; renderWall(); loadWall(); setInterval(loadWall, 60000); }
  }), { rootMargin: '600px 0px' }).observe(el); })();
})();
