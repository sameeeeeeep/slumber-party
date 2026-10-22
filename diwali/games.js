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
const buzz = ms => FX().buzz(ms);
const local = (el, e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };

/* ═════════ share: every result becomes a story-sized card ═════════ */
const SH = {};
const who = () => (window.MKDGuest ? window.MKDGuest.first : 'dost');
const SHARE_URL = 'https://secretslumberparty.com/diwali/';
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
      ? { img: 'assets/game/bal1.webp', title: `${who()} popped ${document.querySelectorAll('#glist .win-card').length} balloons`, text: [...document.querySelectorAll('#glist .win-card p')].map(p => p.textContent).join(' · '), kick: 'gubbara phod' }
      : SH[k];
  if (!d) return null;
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const [bg, swag, k1, k2, art, nl, rg, dy1, dy2, fl] = await Promise.all(['assets/pattern.webp', 'assets/swag.webp', 'assets/k1.webp', 'assets/k3.webp', d.img, 'assets/nailinit_light.webp', 'assets/deco/rangoli2.webp', 'assets/deco/diya1.webp', 'assets/deco/diya4.webp', 'assets/deco/flowers3.webp'].map(loadI));
  c.fillStyle = '#75150f'; c.fillRect(0, 0, W, H);
  if (bg) { c.globalAlpha = .1; for (let y = 0; y < H; y += 300) for (let x = 0; x < W; x += 300) c.drawImage(bg, x, y, 300, 300); c.globalAlpha = 1; }
  const g = c.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .45, 1100); g.addColorStop(0, 'rgba(255,190,80,.22)'); g.addColorStop(1, 'rgba(20,2,1,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (rg) { c.globalAlpha = .16; c.drawImage(rg, W / 2 - 520, H * .52 - 520, 1040, 1040); c.globalAlpha = 1; }
  if (swag) c.drawImage(swag, -40, -10, W + 80, (W + 80) * swag.height / swag.width);
  if (k1) c.drawImage(k1, 40, 200, 150, 150 * k1.height / k1.width);
  if (k2) c.drawImage(k2, W - 190, 230, 150, 150 * k2.height / k2.width);
  c.textAlign = 'center';
  c.font = '600 34px "Clash Display", sans-serif'; c.fillStyle = '#f7e6c8'; c.fillText(d.kick.toUpperCase().split('').join(' '), W / 2, 470);
  let y = 520;
  if (art && art.width > art.height * 1.4) y = 640;
  if (art) {
    const maxW = k === 'invite' ? 900 : k === 'draw' ? 900 : 620, maxH = 820;
    const s = Math.min(maxW / art.width, maxH / art.height), aw = art.width * s, ah = art.height * s;
    c.save(); c.shadowColor = 'rgba(20,2,1,.55)'; c.shadowBlur = 50; c.shadowOffsetY = 24;
    c.translate(W / 2, y + ah / 2); c.rotate(k === 'tota' ? -.03 : 0); c.drawImage(art, -aw / 2, -ah / 2, aw, ah); c.restore();
    y += ah + 90;
  }
  c.font = '84px "Bakbak One", sans-serif'; c.fillStyle = '#c4221a'; let yy = wrap(c, d.title, W / 2 + 5, y + 6, 940, 92);
  c.fillStyle = '#efbd0d'; wrap(c, d.title, W / 2, y, 940, 92);
  c.font = '500 42px "Clash Display", sans-serif'; c.fillStyle = '#f7e6c8'; yy = wrap(c, d.text, W / 2, yy + 80, 900, 58);
  if (dy1) c.drawImage(dy1, 60, H - 470, 190, 190 * dy1.height / dy1.width);
  if (dy2) c.drawImage(dy2, W - 250, H - 470, 190, 190 * dy2.height / dy2.width);
  if (fl) c.drawImage(fl, W / 2 - 110, H - 520, 220, 220 * fl.height / fl.width);
  if (nl) c.drawImage(nl, W / 2 - 150, H - 230, 300, 300 * nl.height / nl.width);
  c.font = '600 30px "Clash Display", sans-serif'; c.fillStyle = '#efbd0d'; c.fillText('DIWALI PARTY · MOHALLA GAME CENTER', W / 2, H - 120);
  c.fillStyle = '#f7e6c8'; c.font = '500 28px "Clash Display", sans-serif'; c.fillText('secretslumberparty.com/diwali', W / 2, H - 76);
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
const GAME_NAME = { tota: 'tota jyotish', gubbara: 'gubbara phod', chhalla: 'chhalla', draw: 'lucky draw' };
const showPin = k => { const b = document.querySelector(`.pin-btn[data-pin="${k}"]`); if (b) { b.hidden = false; b.disabled = false; b.textContent = 'pin to the wall'; } };
const hidePin = k => { const b = document.querySelector(`.pin-btn[data-pin="${k}"]`); if (b) b.hidden = true; };
function pinPayload(k) {
  if (k === 'gubbara') { const wins = [...document.querySelectorAll('#glist .win-card p')].map(p => p.textContent); return { title: `popped ${wins.length}/5`, text: wins.join(' · ') }; }
  const d = SH[k]; return d ? { title: d.title, text: d.text } : null;
}
document.querySelectorAll('.pin-btn').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.pin, p = pinPayload(k); if (!p) return;
  if (window.MKDTrack) window.MKDTrack('wall', { rsvp: k, link: p.title.slice(0, 80), device: p.text.slice(0, 140) });
  b.disabled = true; b.textContent = 'pinned ✓'; ding(990, .45); buzz(15);
  addWallCard({ name: window.MKDGuest ? window.MKDGuest.full : 'dost', game: k, title: p.title, text: p.text }, true);
  toast('pinned to mohalle ki deewar!');
}));
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
function wallCard(e) {
  const c = document.createElement('div'); c.className = 'wcard w-' + (GAME_ICON[e.game] ? e.game : 'tota');
  const i = document.createElement('img'); i.src = GAME_ICON[e.game] || GAME_ICON.tota; i.alt = '';
  const g = document.createElement('span'); g.className = 'wc-game'; g.textContent = GAME_NAME[e.game] || e.game;
  const n = document.createElement('b'); n.className = 'wc-name'; n.textContent = shortName(e.name);
  const t = document.createElement('p'); t.className = 'wc-title'; t.textContent = e.title;
  const x = document.createElement('p'); x.className = 'wc-text'; x.textContent = e.text;
  c.append(i, g, n, t, x); return c;
}
let WALL = [];
function renderWall() {
  const r1 = $('#wrow1'), r2 = $('#wrow2'); if (!r1) return;
  $('#wempty').hidden = WALL.length > 0;
  const half = Math.ceil(WALL.length / 2), a = WALL.slice(0, Math.max(half, 1)), b = WALL.slice(half);
  const fill = (row, list) => { row.replaceChildren(); if (!list.length) return; let items = list; while (items.length < 8) items = items.concat(list); [...items, ...items].forEach(e => row.appendChild(wallCard(e))); row.style.animationDuration = (items.length * 6) + 's'; };
  fill(r1, a); fill(r2, b.length ? b : a);
}
function addWallCard(e, mine) { WALL = [e, ...WALL]; renderWall(); }
async function loadWall() {
  const url = window.MKD && window.MKD.rsvp && window.MKD.rsvp.wall; if (!url) return;
  try {
    const t = await (await fetch(url + '&t=' + Date.now())).text();
    const rows = parseCSV(t).slice(1).filter(r => r.length >= 4 && r[1]);
    WALL = rows.map(r => ({ time: r[0], name: r[1], game: r[2], title: r[3], text: r[4] || '' }));
    renderWall();
  } catch (e) {}
}
loadWall(); setInterval(loadWall, 60000);

document.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', () => shareCard(b.dataset.share)));

/* ── stall picker ── */
const stalls = [...document.querySelectorAll('.stall')];
stalls.forEach(st => st.addEventListener('click', () => {
  stalls.forEach(s => s.classList.toggle('on', s === st));
  document.querySelectorAll('.game[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== st.dataset.game; });
  if (st.dataset.game === 'gubbara') gubbaraReset();
  if (st.dataset.game === 'chhalla') chhallaReset();
  if (st.dataset.game === 'tota') requestAnimationFrame(() => { if (!T.busy) totaBuild(); });
  if (st.dataset.game === 'draw') kick();
  $('#booth').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

/* ═════════ tota jyotish ═════════ */
// the card carries its own words (the poster); the tota's reading for next year sits below
const FORTUNES = [
  { img: 'nakhre', title: 'nakhre unlimited', text: 'next year, your nakhre get accepted without question. ask for the window seat.' },
  { img: 'nazar', title: 'buri nazar wale', text: "you'll be doing so well next year that people will stare. keep the nimbu-mirchi close." },
  { img: 'spicy', title: 'spicy par pyaari', text: 'one big, spicy plot twist is coming next year. you’ll handle it beautifully.' },
  { img: 'naacho', title: 'naacho gaao', text: 'a year of baraats, sangeets and dance floors. your thumka goes viral (locally).' },
  { img: 'meethe', title: 'meethe log, khatte log', text: 'some people will turn sour next year. the sweet ones stay. you’ll finally know who’s who.' },
  { img: 'girlies', title: 'the girls club', text: 'your gang gets bigger next year. at least one new best friend is on the way.' },
  { img: 'chugli', title: 'aao behen, chugli karein', text: "you're going to have a year filled with gossip to share. some of it might be about you." },
  { img: 'bsfree', title: 'bullsh*t free zone', text: 'next year you cut the drama. no fake friends, no explaining yourself.' },
  { img: 'door', title: 'darwaaza khula hai', text: 'a new door opens next year: new home, new job, maybe a new city. walk in like you own it.' },
  { img: 'boss', title: 'boss nani era', text: 'next year you play your cards right, and everybody notices. shades on.' },
  { img: 'patriarchy', title: 'scratch the patriarchy', text: 'next year you break something that’s been holding you back. no apologies.' },
  { img: 'baegum', title: 'baegum', text: 'you walk into next year like royalty. expect to be treated like one.' },
  { img: 'kaam', title: 'keep kaam se kaam', text: 'big work year. head down, kaam se kaam, and it pays off before next diwali.' },
  { img: 'chai', title: 'chai pe charcha', text: 'one long chai conversation next year changes your mind about something big.' },
  { img: 'romance', title: 'pyaar ka chakkar', text: 'romance is in the cards next year. pick the good one this time.' },
];
const HAS_TEXT = new Set(['nakhre', 'nazar', 'spicy', 'naacho', 'meethe', 'girlies', 'chugli', 'bsfree', 'door', 'patriarchy', 'baegum', 'kaam']);   // posters that already carry their words
FORTUNES.forEach(f => { const i = new Image(); i.src = `assets/cards/${f.img}.webp`; });
const T = { table: $('#ttable'), tota: $('#tota'), cards: [], busy: false, x: 0, y: 0, face: 1 };
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
  await a.finished.catch(() => {}); tick();
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
}
async function riffle() {
  const w = T.cards[0].offsetWidth, half = Math.ceil(T.cards.length / 2);
  const L = T.cards.slice(0, half), R = T.cards.slice(half);
  L.forEach((el, i) => cardT(el, -w * .56, -i * 1.3, -9)); R.forEach((el, i) => cardT(el, w * .56, -i * 1.3, 9));
  await sleep(360);
  const out = [];
  while (L.length || R.length) out.push(((Math.random() < .5 && L.length) || !R.length ? L : R).shift());
  for (let i = 0; i < out.length; i++) { cardT(out[i], (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); tick(); await sleep(50); }
  T.cards = out; await sleep(260);
}
async function bridge() {
  T.cards.forEach((el, i) => cardT(el, (i - 4) * .5, -i * 1.3 - 24, rnd(-2, 2), 1.05)); await sleep(240);
  for (let i = 0; i < T.cards.length; i++) { cardT(T.cards[i], (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); tick(); await sleep(28); }
  await sleep(240);
}
function fanPos(i) {
  const W = T.table.clientWidth, cw = T.cards[0].offsetWidth, n = T.cards.length, spread = W < 500 ? 22 : 30;
  const R = Math.min(520, (W / 2 - cw * .6) / Math.sin(rad(spread)));
  const a = -spread + 2 * spread * i / (n - 1);
  return { x: Math.sin(rad(a)) * R, y: R - Math.cos(rad(a)) * R - 40, a };
}
const W_SCALE = () => (T.table.clientWidth < 420 ? 1.25 : 1.5);
async function totaPlay() {
  if (T.busy) return; T.busy = true; start();
  $('#tread').hidden = true; $('#tagain').hidden = true; $('#tgo').hidden = true; hideShare('tota'); hidePin('tota');
  totaBuild(); bob(2);
  $('#tsub').textContent = 'shuffling…';
  await sleep(300); await riffle(); await riffle(); await bridge();
  for (let i = 0; i < T.cards.length; i++) { const p = fanPos(i); cardT(T.cards[i], p.x, p.y, p.a, 1, i); tick(); await sleep(40); }
  $('#tsub').textContent = 'tota ji is choosing…';
  const ch = T.cards[0].offsetHeight, tw = T.tota.offsetWidth, th = T.tota.offsetHeight;
  const spot = i => { const p = fanPos(i); return { x: p.x - tw * .7, y: p.y + ch * .32 - th * .5 }; };
  // wander: hop on, look around, double back, consider, then commit
  const n = T.cards.length, choice = 1 + ((Math.random() * (n - 2)) | 0);
  const path = [1, 3, 5, Math.min(n - 2, 7), clamp(choice + (choice > 4 ? -2 : 2), 0, n - 1), choice];
  for (let k = 0; k < path.length; k++) {
    const s = spot(path[k]);
    await hop(s.x, s.y, { h: rnd(22, 46), ms: rnd(300, 440) });
    if (k === 2 || k === path.length - 2) await bob((rnd(1, 3)) | 0); else await sleep(rnd(80, 260));
  }
  await bob(1);
  const p = fanPos(choice), el = T.cards[choice], f = pick(FORTUNES);
  const front = el.querySelector('.kc-front'); front.style.backgroundImage = `url(assets/cards/${f.img}.webp)`;
  front.replaceChildren();
  if (!HAS_TEXT.has(f.img)) { const lab = document.createElement('span'); lab.className = 'kc-label'; lab.textContent = f.title; front.appendChild(lab); }
  T.tota.src = 'assets/game/parrot_card.webp';
  cardT(el, p.x, p.y - 30, p.a, 1, 60); buzz(15);
  await sleep(340);
  T.cards.forEach(c => { if (c !== el) c.style.opacity = .14; });
  T.tota.src = 'assets/game/parrot.webp';
  const home = perchSpot();
  hop(home.x, home.y, { face: -1, h: 50, ms: 520 }).then(() => totaPlace(home.x, home.y, 1));
  cardT(el, 0, -26, 0, W_SCALE(), 60); await sleep(440);
  el.classList.add('flip'); ding(820, .55); buzz(20);
  await sleep(520);
  $('#ttext').textContent = f.text;
  $('#tread').hidden = false; $('#tagain').hidden = false;
  $('#tsub').textContent = 'tota ji has spoken.';
  SH.tota = { img: `assets/cards/${f.img}.webp`, title: f.title, text: f.text, kick: `${who()}’s kismat for next year` }; showShare('tota'); showPin('tota');
  T.busy = false;
}
$('#tgo').addEventListener('click', totaPlay);
$('#tagain').addEventListener('click', totaPlay);
requestAnimationFrame(totaBuild);
window.addEventListener('resize', () => { if (!T.busy) totaBuild(); });

/* ═════════ gubbara phod — air rifle, drag to aim, release to fire ═════════ */
const INAAMS = [
  'the last kaju katli in the dabba', 'a soan papdi box you can regift (again)', 'immunity from “beta, shaadi kab?”',
  'first dibs on tonight’s chugli', 'a lifetime supply of nazar (with nimbu-mirchi)', 'one excuse to skip rangoli duty',
  'the aux cord, for exactly one song', 'a phuljhadi that actually lights', 'front-row seat at the family drama',
  'one guilt-free extra gulab jamun', 'a compliment on your nails from a stranger', 'the window seat at the chai tapri',
  'unlimited unsolicited advice from mausi', 'a diya that refuses to go out', 'a thumka lesson from the aunties',
];
function addWin(text, img) {
  const c = document.createElement('div'); c.className = 'win-card';
  const i = document.createElement('img'); i.src = img; i.alt = '';
  const p = document.createElement('p'); p.textContent = text;
  c.append(i, p); $('#glist').appendChild(c);
}
const MISS_LINES = ['chook gaye!', 'thoda left, beta', 'hawa mein!', 'almost!'];
const G = { balloons: [], shots: 5, aiming: false, ax: 0, ay: 0, cx: 0, cy: 0, raf: 0, t0: 0 };
const range = $('#range'), wall = $('#gwall'), cross = $('#cross'), rifle = $('#rifle');
function gubbaraReset() {
  wall.replaceChildren(); G.balloons = []; G.shots = 5; G.aiming = false;
  const pool = [...INAAMS].sort(() => Math.random() - .5);
  const cols = 5, rows = 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const el = document.createElement('div'); el.className = 'gub';
    const img = document.createElement('img'); img.src = `assets/game/bal${(r * cols + c) % 8}.webp`; img.alt = '';
    el.appendChild(img); wall.appendChild(el);
    G.balloons.push({ img: img.src, el, bx: (c + .5) / cols, by: .2 + r * .27, ph: rnd(0, 6.3), sp: rnd(.6, 1.1), amp: rnd(.022, .045), alive: true, prize: pool[(r * cols + c) % pool.length] });
  }
  $('#gshots').innerHTML = Array.from({ length: 5 }, () => '<i></i>').join('');
  $('#ghaul').hidden = true; $('#glist').replaceChildren(); $('#gagain').hidden = true; hideShare('gubbara'); hidePin('gubbara');
  $('#gsub').textContent = 'drag to aim, let go to fire. 5 pellets.';
  requestAnimationFrame(() => { const r0 = range.getBoundingClientRect(); G.ax = r0.width / 2; G.ay = r0.height * .35; });
  cancelAnimationFrame(G.raf); G.t0 = performance.now(); G.raf = requestAnimationFrame(gubbaraLoop);
}
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
  const W = range.clientWidth, H = range.clientHeight, bx = W * .5, by = H * 1.04;   // the shooter stands back from the counter
  const ang = Math.atan2(G.cy - by, G.cx - bx) * 180 / Math.PI;
  rifle.style.left = bx + 'px'; rifle.style.top = by + 'px'; rifle.style.width = (H * .36) + 'px';
  rifle.style.transform = `translate(0, -50%) rotate(${ang.toFixed(2)}deg) scaleY(${Math.abs(ang) > 90 ? -1 : 1})`;
  G.raf = requestAnimationFrame(gubbaraLoop);
}
function aimAt(e) { const p = local(range, e); G.ax = clamp(p.x, 6, p.w - 6); G.ay = clamp(p.y - (e.pointerType === 'touch' ? 60 : 0), 6, p.h * .78); }
range.addEventListener('pointerdown', e => {
  if (G.shots <= 0) return; start(); e.preventDefault();
  G.aiming = true; try { range.setPointerCapture(e.pointerId); } catch (err) {} aimAt(e); range.classList.add('aiming');
});
range.addEventListener('pointermove', e => { if (G.aiming || e.pointerType === 'mouse') aimAt(e); });
range.addEventListener('pointerup', () => { if (!G.aiming) return; G.aiming = false; range.classList.remove('aiming'); fire(); });
range.addEventListener('pointercancel', () => { G.aiming = false; range.classList.remove('aiming'); });
async function fire() {
  if (G.shots <= 0) return;
  G.shots--; $('#gshots').children[4 - G.shots].classList.add('used');
  noise(.08, 'bandpass', 2400, 900, .9, 2); buzz(12);
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
    pop(); buzz(25); hit.alive = false; hit.el.classList.add('popped');
    hit.el.querySelector('img').src = 'assets/game/bal8.webp';
    const tag = document.createElement('span'); tag.className = 'gtag'; tag.textContent = hit.prize; hit.el.appendChild(tag);
    addWin(hit.prize, hit.img); $('#ghaul').hidden = false;
  } else {
    thup(); const m = document.createElement('span'); m.className = 'gmiss'; m.textContent = pick(MISS_LINES); m.style.left = x + 'px'; m.style.top = y + 'px'; range.appendChild(m); setTimeout(() => m.remove(), 900);
  }
  if (G.shots === 0) {
    const n = $('#glist').children.length;
    if (!n) { addWin('one pat on the head from the stall uncle', 'assets/game/bal8.webp'); $('#ghaul').hidden = false; }
    $('#gsub').textContent = n ? `${n} of 5 popped! here’s what you got.` : 'all misses! uncle feels bad for you.';
    showShare('gubbara'); showPin('gubbara');
    $('#gagain').hidden = false; ding(700, .6);
  } else $('#gsub').textContent = `${G.shots} pellet${G.shots > 1 ? 's' : ''} left.`;
}
$('#gagain').addEventListener('click', gubbaraReset);

/* ═════════ chhalla — flick the bangle at a banta bottle (2 practice throws, then 3 for real) ═════════ */
const PRIZES = [
  ['aunty approval', 'she said “kitni sundar lag rahi hai”. frame it.'],
  ['gossip VIP pass', 'you hear the chugli first, before the group chat does.'],
  ['dance-floor immunity', 'nobody can drag you to dance. (you’ll go anyway.)'],
  ['the last samosa', 'it’s yours. nobody will fight you for it. probably.'],
  ['no-nazar shield', 'one nimbu-mirchi, personally assigned to you for the year.'],
];
const R = { practice: 2, left: 3, busy: false, drag: null, won: [] };
const cstage = $('#cstage'), ring = $('#cring'), aimLine = $('#caimline');
function ringHome() { ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 1; ring.style.transform = 'translate(-50%, 0)'; }
function chhallaStatus() {
  $('#csub').textContent = R.practice > 0
    ? `practice throw ${3 - R.practice} of 2. flick the bangle up at a bottle.`
    : R.left > 0 ? `for real now: ${R.left} bangle${R.left > 1 ? 's' : ''} left.` : 'all bangles thrown!';
  cstage.classList.toggle('practice', R.practice > 0);
}
function chhallaReset() {
  const shelf = $('#cshelf'); shelf.replaceChildren();
  const order = [0, 1, 2, 3, 4].sort(() => Math.random() - .5);
  order.forEach((p, i) => {
    const b = document.createElement('div'); b.className = 'bot'; b.dataset.p = p; b.style.animationDelay = (-i * .7).toFixed(1) + 's';
    const back = document.createElement('i'); back.className = 'hoop back';
    const img = document.createElement('img'); img.src = `assets/game/bottle${i}.webp`; img.alt = '';
    const front = document.createElement('i'); front.className = 'hoop front';
    const tag = document.createElement('span'); tag.className = 'btag'; tag.textContent = PRIZES[p][0];
    b.append(back, img, front, tag); shelf.appendChild(b);
  });
  R.practice = 2; R.left = 3; R.busy = false; R.won = []; ringHome(); hideShare('chhalla'); hidePin('chhalla');
  $('#cread').hidden = true; $('#cagain').hidden = true; $('#ccoach').hidden = true;
  chhallaStatus();
}
cstage.addEventListener('pointerdown', e => {
  if (R.busy || (R.left <= 0 && R.practice <= 0)) return;
  const rr = ring.getBoundingClientRect();
  if (Math.hypot(e.clientX - (rr.left + rr.width / 2), e.clientY - (rr.top + rr.height / 2)) > rr.width * 1.6) return;
  start(); e.preventDefault(); try { cstage.setPointerCapture(e.pointerId); } catch (err) {}
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
  chhallaThrow(vx, vy);
});
cstage.addEventListener('pointercancel', () => { endDrag(); ringHome(); });
function coach(msg, good) { const c = $('#ccoach'); c.hidden = false; c.textContent = msg; c.classList.toggle('good', !!good); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
async function chhallaThrow(vx, vy) {
  R.busy = true;
  const practice = R.practice > 0;
  const s = cstage.getBoundingClientRect(), rr = ring.getBoundingClientRect();
  const cx = rr.left + rr.width / 2 - s.left, cy = rr.top + rr.height / 2 - s.top;
  const power = clamp(-vy, .25, 3.2), tx = cx + vx * 220 + rnd(-8, 8), ty = cy - power * 240;
  let hitB = null, near = null, nd = 1e9;
  document.querySelectorAll('.bot').forEach(b => {
    const r = b.getBoundingClientRect(), nx = r.left + r.width / 2 - s.left, ny = r.top + r.height * .2 - s.top;
    const d = Math.hypot(tx - nx, ty - ny); if (d < nd) { nd = d; near = { el: b, x: nx, y: ny, w: r.width, h: r.height }; }
    if (!b.classList.contains('ringed') && Math.abs(tx - nx) < r.width * .42 && Math.abs(ty - ny) < r.height * .2) hitB = { el: b, x: nx, y: ny };
  });
  const endX = hitB ? hitB.x : tx, endY = hitB ? hitB.y : ty, arcH = 60 + power * 30;
  const anim = ring.animate([
    { transform: 'translate(-50%, 0) scale(1) rotateX(0deg)' },
    { transform: `translate(calc(-50% + ${(endX - cx) / 2}px), ${(endY - cy) / 2 - arcH}px) scale(.75) rotateX(40deg) rotate(360deg)`, offset: .5 },
    { transform: `translate(calc(-50% + ${endX - cx}px), ${endY - cy}px) scale(.5) rotateX(68deg) rotate(720deg)` },
  ], { duration: 650, easing: 'cubic-bezier(.3,.2,.4,1)', fill: 'forwards' });
  await anim.finished.catch(() => {});
  if (practice) R.practice--; else R.left--;
  if (hitB) {
    clink(); buzz(25);
    ring.style.opacity = 0; ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 0;
    hitB.el.classList.add('ringed');                     // the bangle now lives on the bottle neck and sways with it
    if (practice) { coach('perfect! that’s exactly it. now for real.', true); hitB.el.classList.add('practice-hit'); setTimeout(() => hitB.el.classList.remove('ringed', 'practice-hit'), 1400); }
    else {
      const [name, text] = PRIZES[+hitB.el.dataset.p]; R.won.push(name);
      $('#ctitle').textContent = name; $('#ctext').textContent = text; $('#cread').hidden = false; ding(880, .55);
      SH.chhalla = { img: hitB.el.querySelector('img').src, title: name, text, kick: `${who()} ringed the banta` }; showShare('chhalla'); showPin('chhalla');
      coach('ringed it!', true);
    }
  } else {
    clink();
    ring.animate([
      { transform: `translate(calc(-50% + ${endX - cx}px), ${endY - cy}px) scale(.5) rotateX(68deg)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${endX - cx + rnd(-60, 60)}px), ${endY - cy + 140}px) scale(.45) rotateX(80deg) rotate(260deg)`, opacity: 0 },
    ], { duration: 520, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' });
    // tell them what to change
    const dy = ty - near.y, dxn = tx - near.x, tips = [];
    if (dy < -near.h * .2) tips.push('too far — less force');
    else if (dy > near.h * .2) tips.push('too short — flick harder');
    if (Math.abs(dxn) > near.w * .42) tips.push(dxn > 0 ? 'aim a little left' : 'aim a little right');
    coach(tips.length ? tips.join(', ') + '.' : 'so close! same again.');
  }
  await sleep(750);
  if (R.practice > 0 || R.left > 0) ringHome(); else { ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 0; $('#cagain').hidden = false;
    if (!R.won.length) { $('#ctitle').textContent = 'no rings this time'; $('#ctext').textContent = 'the banta stays undefeated. one more go?'; $('#cread').hidden = false; } }
  chhallaStatus(); R.busy = false;
}
$('#cagain').addEventListener('click', chhallaReset);

/* ═════════ lucky draw — a real crank ═════════ */
const PERSONAS = [
  { name: 'the chugli champion', text: "you'll know everything before it happens. use your powers wisely (or don't)." },
  { name: 'main-character energy', text: 'every room you walk into this year is your entrance scene.' },
  { name: 'the dance-floor auntie', text: 'first on the floor, last to leave. the DJ already fears you.' },
  { name: 'the jugaad genius', text: "no plan? no problem. you'll fix everything with a safety pin and a smile." },
  { name: 'the phuljhadi', text: 'small, sparkly, impossible to ignore. you light up every room.' },
  { name: 'the rangoli perfectionist', text: 'everything has to be just right this year, and somehow it will be.' },
  { name: 'the soan papdi re-gifter', text: 'resourceful, practical, slightly suspicious. a legend in the making.' },
  { name: 'the glow-up of the year', text: 'new set, new vibe, new you. people will ask what changed.' },
  { name: 'the soft-spoken savage', text: 'sweet voice, sharp comebacks. nobody sees it coming.' },
  { name: 'the matchmaker', text: 'at least one wedding next year will be your fault. take the credit.' },
  { name: 'the selfie director', text: "you'll get everyone's best angle. nobody will get yours." },
  { name: 'the mohalla’s lucky charm', text: 'good things follow you around this year. keep your people close.' },
];
const D = { ang: 0, vel: 0, total: 0, need: 1080, busy: false, done: false, drag: null, raf: 0, last: 0, slips: [] };
const body = $('#drBody'), crank = $('#drCrank'), slipBox = $('#drSlips');
(() => { const cols = ['#efbd0d', '#ec5a86', '#2f9790', '#1d8cc4', '#c4221a', '#f7e6c8'];
  for (let i = 0; i < 14; i++) { const s = document.createElement('i'); s.style.background = cols[i % cols.length]; slipBox.appendChild(s); D.slips.push({ el: s, a: rnd(0, 6.3), r: rnd(.15, .42), spin: rnd(0, 360) }); } })();
function drawLoop(now) {
  const dt = Math.min(.05, (now - (D.last || now)) / 1000); D.last = now;
  if (!D.drag) D.vel *= Math.pow(.3, dt);                 // the drum coasts and slows down
  D.ang += D.vel * dt; D.total += Math.abs(D.vel * dt);
  crank.style.transform = `rotateX(${D.ang.toFixed(1)}deg)`;
  // the cage rolls about its axle: a squash/bob in step with the crank, slips tumbling inside
  const ph = rad(D.ang);
  body.style.transform = `scaleY(${(.94 + .06 * Math.abs(Math.cos(ph * 3))).toFixed(3)}) translateY(${(Math.sin(ph * 3) * 3).toFixed(1)}px)`;
  const W = slipBox.clientWidth, H = slipBox.clientHeight, sp = Math.min(1, Math.abs(D.vel) / 500), rest = 1 - sp;
  D.slips.forEach((s, i) => {
    s.a += D.vel * dt * (.012 + i * .0006); s.spin += D.vel * dt * .6;
    const x = W / 2 + Math.cos(s.a) * s.r * W * (1 - rest * .2), y = H / 2 + Math.sin(s.a) * s.r * H * sp + rest * H * (.12 + s.r * .45);
    s.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${s.spin.toFixed(0)}deg)`;
  });
  if (Math.abs(D.vel) > 60 && Math.random() < dt * Math.abs(D.vel) / 40) noise(.03, 'bandpass', rnd(1800, 3200), 1400, .12, 2);
  if (!D.done && D.total >= D.need && !D.drag && Math.abs(D.vel) < 220) drawDrop();
  if (!$('[data-panel=draw]').hidden || Math.abs(D.vel) > 1) D.raf = requestAnimationFrame(drawLoop); else D.raf = 0;
}
function kick() { if (!D.raf) { D.last = 0; D.raf = requestAnimationFrame(drawLoop); } }
crank.addEventListener('pointerdown', e => {
  if (D.done) return; start(); e.preventDefault(); try { crank.setPointerCapture(e.pointerId); } catch (err) {}
  D.drag = { lastX: e.clientX, lastY: e.clientY, lastT: performance.now() };
  $('#dsub').textContent = 'keep turning…'; kick();
});
crank.addEventListener('pointermove', e => {
  if (!D.drag) return;
  const now = performance.now(), dt = Math.max(8, now - D.drag.lastT);
  const w = (Math.abs(e.clientY - D.drag.lastY) + Math.abs(e.clientX - D.drag.lastX) * .5) * 2.2;   // any circular-ish motion turns it
  D.ang += w; D.total += w; D.vel = clamp(w / dt * 1000, 0, 1400);
  D.drag.lastX = e.clientX; D.drag.lastY = e.clientY; D.drag.lastT = now;
});
const endCrank = () => { D.drag = null; };
crank.addEventListener('pointerup', endCrank); crank.addEventListener('pointercancel', endCrank);
$('#dspin').addEventListener('click', async () => {             // for anyone who'd rather tap
  if (D.done || D.busy) return; start(); D.busy = true; $('#dsub').textContent = 'ghuma ghuma ke…'; kick();
  const t0 = performance.now();
  while (performance.now() - t0 < 1700) { D.vel = Math.min(900, D.vel + 120); await sleep(60); }
  D.busy = false;
});
async function drawDrop() {
  D.done = true; $('#dspin').hidden = true;
  const p = pick(PERSONAS);
  $('#tno').textContent = String(1000 + ((Math.random() * 9000) | 0));
  $('#tname').textContent = p.name; $('#ttext2').textContent = p.text;
  const drop = $('#drDrop'); drop.classList.remove('go'); void drop.offsetWidth; drop.classList.add('go');   // folded ticket tumbles out
  thup(); await sleep(700);
  const t = $('#ticket'); t.hidden = false; t.classList.remove('open'); void t.offsetWidth; t.classList.add('open');  // …and unfolds
  ding(700, .6); buzz(25);
  $('#dsub').textContent = 'here you are, next year.';
  setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  SH.draw = { img: 'assets/game/ticket.webp', title: p.name, text: p.text, kick: `${who()}’s new-year personality` }; showShare('draw'); showPin('draw');
  $('#dagain').hidden = false;
}
$('#dagain').addEventListener('click', () => {
  D.done = false; D.total = 0; hideShare('draw'); hidePin('draw'); $('#ticket').hidden = true; $('#ticket').classList.remove('open'); $('#dagain').hidden = true; $('#dspin').hidden = false;
  $('#drDrop').classList.remove('go'); $('#dsub').textContent = 'turn the crank. drag it round, or tap the button.';
  $('#dstage').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
})();
