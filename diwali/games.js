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
let ACTIVE = 'tota';                                   // only the open stall may make noise
const snd = (n, o) => { const f = FX(); if (f.play) f.play(n, o); };
const loopVol = (n, v) => { const f = FX(); if (f.loop) f.loop(n, v); };
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
  const [bg, swag, k1, k2, art, nl] = await Promise.all(['assets/pattern.webp', 'assets/swag.webp', 'assets/k1.webp', 'assets/k3.webp', d.img, 'assets/nailinit_light.webp'].map(loadI));
  c.fillStyle = '#75150f'; c.fillRect(0, 0, W, H);
  if (bg) { c.globalAlpha = .1; for (let y = 0; y < H; y += 300) for (let x = 0; x < W; x += 300) c.drawImage(bg, x, y, 300, 300); c.globalAlpha = 1; }
  const g = c.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .45, 1100); g.addColorStop(0, 'rgba(255,190,80,.22)'); g.addColorStop(1, 'rgba(20,2,1,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
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
function wallCard(e) {
  const c = document.createElement('div'); c.className = 'wcard w-' + (GAME_ICON[e.game] ? e.game : 'tota');
  const i = document.createElement('img'); i.src = GAME_ICON[e.game] || GAME_ICON.tota; i.alt = '';
  const g = document.createElement('span'); g.className = 'wc-game'; g.textContent = GAME_NAME[e.game] || e.game;
  const n = document.createElement('b'); n.className = 'wc-name'; n.textContent = shortName(e.name);
  const t = document.createElement('p'); t.className = 'wc-title'; t.textContent = e.title;
  const x = document.createElement('p'); x.className = 'wc-text'; x.textContent = e.text;
  c.append(i, g, n, t, x); return c;
}
let WALL = [], MINE = [];
const WALL_FROM = new Date('2026-10-23T03:16:01+05:30');            // test pins before launch stay off the wall
// placeholder pins (generic names) so the wall never looks empty; real pins push them out
const SEED = [
  { name: 'Ananya K', game: 'tota', title: 'chai pe charcha', text: 'one long chai conversation next year changes your mind about something big.' },
  { name: 'Kabir M', game: 'draw', title: '“i’m my own good luck charm”', text: 'good things keep finding you. lucky snack: jalebi.' },
  { name: 'Zoya S', game: 'gubbara', title: 'popped 3 balloons', text: 'the aux cord, for exactly one song · the last plate of pani puri · a free pass on one bad decision' },
  { name: 'Rohan P', game: 'chhalla', title: 'ringed 2 bottles', text: 'gossip VIP pass · the good lighting spot' },
  { name: 'Meher A', game: 'tota', title: 'nakhre unlimited', text: 'next year, your nakhre get accepted without question.' },
  { name: 'Ishaan T', game: 'draw', title: '“delulu, but i deliver”', text: 'the plan sounds crazy out loud. it works anyway.' },
  { name: 'Tara D', game: 'tota', title: 'naacho gaao', text: 'a year of baraats, sangeets and dance floors.' },
  { name: 'Vikram R', game: 'chhalla', title: 'ringed 1 bottle', text: 'dance-floor immunity' },
  { name: 'Naina B', game: 'draw', title: '“first on the dance floor”', text: 'last to leave. the DJ knows your name.' },
  { name: 'Aarav J', game: 'gubbara', title: 'popped 2 balloons', text: 'the last laddoo, unclaimed · a cab that arrives in 2 minutes' },
];
const parseWhen = t => { const m = String(t).match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/); return m ? new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5]) : new Date(0); };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const WS = { x: 0, w: 0, t: 0, v: 38, drag: null, raf: 0 };
function renderWall() {          // one row, every game remixed, drifting forever (drag to scrub)
  const r = $('#wrow1'); if (!r) return;
  const seen = new Set(MINE.map(e => e.name + '|' + e.title)), real = WALL.filter(e => !seen.has(e.name + '|' + e.title));
  const rest = real.length + MINE.length >= 8 ? real : [...real, ...SEED];
  const all = [...MINE, ...rest];
  $('#wempty').hidden = all.length > 0;
  r.replaceChildren(); WS.w = 0; if (!all.length) return;
  let items = [...MINE, ...shuffle(rest)];
  while (items.length < 10) items = items.concat(shuffle(all));
  [...items, ...items].forEach(e => r.appendChild(wallCard(e)));
  requestAnimationFrame(() => { WS.w = r.scrollWidth / 2; });
  if (!WS.raf) WS.raf = requestAnimationFrame(wallLoop);
}
function wallLoop(now) {
  const r = $('#wrow1'), dt = Math.min(.05, (now - (WS.t || now)) / 1000); WS.t = now;
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
function addWallCard(e) { MINE = [e, ...MINE]; WS.x = 0; renderWall(); }
async function loadWall() {
  const url = window.MKD && window.MKD.rsvp && window.MKD.rsvp.wall; if (!url) return;
  try {
    const t = await (await fetch(url + '&t=' + Date.now())).text();
    const rows = parseCSV(t).slice(1).filter(r => r.length >= 4 && r[1]);
    WALL = rows.map(r => ({ time: r[0], name: r[1], game: r[2], title: r[3], text: r[4] || '' })).filter(e => parseWhen(e.time) >= WALL_FROM);
    renderWall();
  } catch (e) {}
}
renderWall(); loadWall(); setInterval(loadWall, 60000);

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
  if (g === 'tota' && (T.busy || !DONE.tota)) { T.busy = false; requestAnimationFrame(totaBuild); $('#tgo').hidden = false; $('#tsub').textContent = 'tap the deck to shuffle. the tota picks what next year holds for you.'; }
  if (g === 'draw') { if (!D.done) drawReset(); kick(); }
  if (scroll) $('#booth').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
stalls.forEach(st => st.addEventListener('click', () => { start(); snd('tap', { vol: .6 }); openStall(st.dataset.game); }));
document.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
  snd('tap', { vol: .6 });
  if (b.dataset.next === 'haul') { $('#myhaul').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  openStall(b.dataset.next);
}));

/* ═════════ tota jyotish ═════════ */
// the card carries its own words (the poster); the tota's reading for next year sits below
const FORTUNES = [
  // the deck's own posters (they carry their own words)
  { img: 'nakhre', title: 'nakhre unlimited', text: ['next year, your nakhre get accepted without question. ask for the window seat.', 'every demand you make next year gets met. start small. or don’t.'] },
  { img: 'nazar', title: 'buri nazar wale', text: ["you'll be doing so well next year that people will stare. keep the nimbu-mirchi close.", 'someone’s watching your glow-up very closely. let them.'] },
  { img: 'spicy', title: 'spicy par pyaari', text: ['one big, spicy plot twist is coming next year. you’ll handle it beautifully.', 'next year has a little masala in it. you’ll love the taste.'] },
  { img: 'naacho', title: 'naacho gaao', text: ['a year of baraats, sangeets and dance floors. your thumka goes viral (locally).', 'you’ll dance at more parties next year than the last five combined.'] },
  { img: 'meethe', title: 'meethe log, khatte log', text: ['some people will turn sour next year. the sweet ones stay. you’ll finally know who’s who.', 'next year sorts your people for you. keep the meethe ones close.'] },
  { img: 'girlies', title: 'the girls club', text: ['your gang gets bigger next year. at least one new best friend is on the way.', 'a girls’ trip finally leaves the group chat and actually happens.'] },
  { img: 'chugli', title: 'aao behen, chugli karein', text: ["you're going to have a year filled with gossip to share. some of it might be about you.", 'next year you’re first to know everything. use it wisely. (you won’t.)'] },
  { img: 'bsfree', title: 'bullsh*t free zone', text: ['next year you cut the drama. no fake friends, no explaining yourself.', 'a cleaner, calmer year. you’ll block what drains you and not miss it.'] },
  { img: 'door', title: 'darwaaza khula hai', text: ['a new door opens next year: new home, new job, maybe a new city. walk in like you own it.', 'something you knocked on for ages finally opens next year.'] },
  { img: 'boss', title: 'boss nani era', text: ['next year you play your cards right, and everybody notices. shades on.', 'you call the shots next year. everyone else just shuffles.'] },
  { img: 'baegum', title: 'baegum', text: ['you walk into next year like royalty. expect to be treated like one.', 'next year, people roll out the red carpet. act surprised.'] },
  { img: 'kaam', title: 'keep kaam se kaam', text: ['big work year. head down, kaam se kaam, and it pays off before next diwali.', 'the hustle finally shows up in the bank account next year.'] },
  { img: 'chai', title: 'chai pe charcha', text: ['one long chai conversation next year changes your mind about something big.', 'next year’s best decision gets made over a cutting chai.'] },
  { img: 'romance', title: 'pyaar ka chakkar', text: ['romance is in the cards next year. pick the good one this time.', 'someone makes your heart do a little thumka next year.'] },
  // new illustrated cards
  { img: 'safar', title: 'safar likha hai', text: ['a trip you’ve been postponing finally happens next year. pack light.', 'your passport gets a new stamp next year. maybe two.'] },
  { img: 'ghar', title: 'naya ghar, naya scene', text: ['next year you get the keys to something: a new home, a new room, a new start.', 'your space gets a glow-up next year. housewarming on you.'] },
  { img: 'kursi', title: 'kursi tumhari hai', text: ['a promotion, a title, a bigger chair. next year you sit at the head of the table.', 'next year someone finally hands you the power. don’t give it back.'] },
  { img: 'paisa', title: 'paisa hi paisa', text: ['money flows in next year from somewhere you didn’t expect.', 'next year your bank balance gives you a pleasant shock. for once.'] },
  { img: 'shaadi', title: 'shehnai bajegi', text: ['wedding bells ring next year. maybe yours, definitely someone close.', 'clear your calendar: next year is wall-to-wall shaadis.'] },
  { img: 'excall', title: 'ex ka phone aayega', text: ['an old flame calls next year. you let it ring. iconic.', 'someone from your past tries to come back next year. you’ve upgraded.'] },
  { img: 'dil', title: 'dil ka mamla', text: ['matters of the heart get sweeter next year. let someone in.', 'next year your heart gets exactly what it’s been asking for.'] },
  { img: 'single', title: 'single and thriving', text: ['next year you choose yourself, and it’s the best relationship you’ve had.', 'solo dates, solo trips, solo glow. next year is all you.'] },
  { img: 'party', title: 'party har weekend', text: ['your social calendar explodes next year. pace yourself.', 'next year you host the party everyone talks about till holi.'] },
  { img: 'filmy', title: 'filmy saal', text: ['next year plays out like a full movie: drama, songs and a happy ending.', 'your life gets filmy next year. at least one slow-motion moment.'] },
  { img: 'neend', title: 'neend poori hogi', text: ['next year you finally sleep eight hours. the dark circles retire.', 'peace and proper rest next year. your bed is your best friend.'] },
  { img: 'viral', title: 'viral hone wale ho', text: ['next year something you post blows up. keep the ring light charged.', 'your fifteen minutes of fame arrive next year. look cute.'] },
  { img: 'glow', title: 'glow up guaranteed', text: ['next year you look better every month. people will ask what changed.', 'skin clear, mind clear, calendar clear. the next-year glow is real.'] },
  { img: 'fit', title: 'fit and fabulous', text: ['next year you actually stick to the gym. and you mention it a lot.', 'strongest year yet, body and mind. flex accordingly.'] },
  { img: 'shanti', title: 'shanti hi shanti', text: ['next year is calm. no drama you didn’t sign up for.', 'peace is the plan next year, and for once the plan works.'] },
  { img: 'swaad', title: 'haath mein swaad', text: ['next year your cooking becomes famous. everyone wants an invite.', 'one dish next year becomes your signature. guard the recipe.'] },
  { img: 'mummy', title: 'mummy proud hai', text: ['next year you make your family very, very proud. expect forwarded photos.', 'mummy’s approval rating hits an all-time high next year.'] },
  { img: 'doggo', title: 'ek naya dost', text: ['a furry new friend enters your life next year. adopt, don’t shop.', 'next year your camera roll fills up with one very good boy (or girl).'] },
  { img: 'khushkhabri', title: 'khushkhabri aane wali hai', text: ['good news lands in the family next year. sweets on you.', 'next year someone close gives you news worth a whole box of laddoos.'] },
  { img: 'dosti', title: 'dosti zindabad', text: ['next year your friendships get stronger. one trip, many inside jokes.', 'your gang levels up next year. ride or die, all of them.'] },
  { img: 'lucky', title: 'kismat connection', text: ['luck sits on your shoulder all next year. buy the ticket.', 'next year the small lucky things keep stacking up.'] },
  { img: 'taare', title: 'taare tumhare saath', text: ['the stars line up for you next year. ask for what you want.', 'next year a wish you made quietly comes true.'] },
  { img: 'lakshmi', title: 'lakshmi ghar aayegi', text: ['prosperity walks in through your front door next year.', 'next year the money comes home, and stays.'] },
  { img: 'shopping', title: 'shopping spree', text: ['next year you treat yourself. no guilt, all receipts.', 'your wardrobe gets a full upgrade next year. the mohalla will copy.'] },
  { img: 'startup', title: 'apna kaam, apna naam', text: ['that side idea becomes real next year. launch it.', 'next year you build something that’s fully yours.'] },
  { img: 'seekho', title: 'kuch naya seekhoge', text: ['next year you pick up a new skill and surprise everyone, mostly yourself.', 'a class, a hobby, an instrument: next year you finally start.'] },
  { img: 'stage', title: 'spotlight tumhari', text: ['next year you take the stage, literally or not. the room is yours.', 'you get noticed next year for exactly what you’re good at.'] },
  { img: 'detox', title: 'phone kam, life zyada', text: ['next year you scroll less and live more. weirdly, you love it.', 'one month off social media next year changes everything.'] },
  { img: 'drama', title: 'serial wala drama', text: ['next year has one epic family drama. you watch from the front row.', 'dramatic zoom, dramatic music: next year has a twist. you survive it in style.'] },
  { img: 'raaz', title: 'ek raaz khulega', text: ['a secret comes out next year. it explains a lot.', 'next year someone tells you something that changes how you see them.'] },
  { img: 'comeback', title: 'comeback saal', text: ['next year is your comeback. feathers out, head high.', 'whatever knocked you down, next year you rise like a full peacock.'] },
  { img: 'rani', title: 'mohalle ki rani', text: ['next year you run the neighbourhood. everyone knows your scooter.', 'queen of every gali you walk into next year.'] },
  { img: 'baarish', title: 'baarish wala pyaar', text: ['one monsoon next year turns very romantic. carry an umbrella for two.', 'next year’s best memory: rain, chai and the right person.'] },
  { img: 'chakka', title: 'chakka maaroge', text: ['next year you hit it out of the park. at work, in love, everywhere.', 'big swings next year. most of them land.'] },
  { img: 'roadtrip', title: 'road trip pakka', text: ['next year your friends finally do the road trip. you choose the music.', 'mountains are calling next year. you pick up.'] },
  { img: 'birthday', title: 'yaadgaar birthday', text: ['your next birthday is the best one yet. make a big wish.', 'next year someone throws you the surprise party you deserve.'] },
  { img: 'boundary', title: 'na matlab na', text: ['next year you say no without explaining. it feels amazing.', 'boundaries up next year. the right people stay.'] },
  { img: 'ghanti', title: 'shubh aarambh', text: ['a big new beginning starts next year. ring the bell.', 'next year opens with good news and keeps going.'] },
  { img: 'chess', title: 'rani ki chaal', text: ['next year you play it smart. three moves ahead, always.', 'next year every move you make is the right one. checkmate.'] },
  { img: 'sher', title: 'sherni saal', text: ['fearless year ahead. you roar, they listen.', 'next year you’re calm, confident and not to be messed with.'] },
];
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
const W_SCALE = () => (T.table.clientWidth < 420 ? 1.25 : 1.5);
const SEEN_K = new Set();                  // don't hand the same kismat twice in one visit
async function totaPlay() {
  if (T.busy) return; T.busy = true; start(); const my = ++T.run;
  const alive = () => T.run === my && ACTIVE === 'tota';
  const bail = () => { if (T.run === my) T.busy = false; };
  $('#tread').hidden = true; $('#tagain').hidden = true; $('#tgo').hidden = true; $('#tlabel').hidden = true; hideShare('tota'); hidePin('tota');
  T.table.classList.remove('can-shuffle');
  let pool = FORTUNES.filter(f => !SEEN_K.has(f.img)); if (!pool.length) { SEEN_K.clear(); pool = FORTUNES; }
  const f = pick(pool); SEEN_K.add(f.img); new Image().src = `assets/cards/${f.img}.webp`;   // load just this one while the deck shuffles
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
  SH.tota = { img: `assets/cards/${f.img}.webp`, title: f.title, text: reading, kick: `${who()}’s kismat for 2027` }; showShare('tota'); showPin('tota');
  haul('tota', f.title, reading, `assets/cards/${f.img}.webp`); DONE.tota = true;
  T.busy = false;
}
$('#tgo').addEventListener('click', totaPlay);
$('#tagain').addEventListener('click', totaPlay);
T.table.addEventListener('click', () => { if (!T.busy && T.table.classList.contains('can-shuffle')) { snd('tap', { vol: .5 }); totaPlay(); } });   // tap the deck itself to shuffle
requestAnimationFrame(totaBuild);
window.addEventListener('resize', () => { if (!T.busy && !DONE.tota) totaBuild(); });

/* ═════════ gubbara phod — air rifle, drag to aim, release to fire ═════════ */
const INAAMS = [
  'the last kaju katli in the dabba', 'a soan papdi box you can regift (again)', 'immunity from “beta, shaadi kab?”',
  'first dibs on tonight’s chugli', 'a lifetime supply of nazar (with nimbu-mirchi)', 'one excuse to skip the family whatsapp call',
  'the aux cord, for exactly one song', 'a phuljhadi that actually lights', 'front-row seat at the family drama',
  'one guilt-free extra gulab jamun', 'a compliment from a total stranger', 'the window seat at the chai tapri',
  'unlimited unsolicited advice from mausi', 'a diya that refuses to go out', 'a thumka lesson from the aunties',
  'one “i told you so”, valid all year', 'the good chair at the next family function', 'a free pass on one bad decision',
  'the last plate of pani puri', 'the first slice of every cake this year', 'one day of no replies, no guilt',
  'a perfectly timed entry at the next party', 'a photo where everyone looks good', 'a spot in the front row of the group pic',
  'an aunty who finally gets your name right', 'a playlist the whole room actually likes', 'one cancelled plan you secretly wanted cancelled',
  'a window seat on your next flight', 'a lehenga that fits on the first try', 'the right to choose the restaurant, once',
  'a cab that arrives in 2 minutes', 'zero “you’ve gained weight” comments this diwali', 'one surprise refund',
  'the last laddoo, unclaimed', 'a mirror selfie with perfect lighting',
];
function addWin(list, text, img) {
  const c = document.createElement('div'); c.className = 'win-card';
  const i = document.createElement('img'); i.src = img; i.alt = '';
  const p = document.createElement('p'); p.textContent = text;
  c.append(i, p); $(list).appendChild(c);
  c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
}
const MISS_LINES = ['chook gaye!', 'thoda left, beta', 'hawa mein!', 'almost!', 'arre!', 'uncle is laughing', 'so close!', 'try again, champ'];
const G = { balloons: [], shots: 10, aiming: false, ax: 0, ay: 0, cx: 0, cy: 0, raf: 0, t0: 0, pool: [], bi: 0 };
const range = $('#range'), wall = $('#gwall'), cross = $('#cross'), rifle = $('#rifle');
const SLOTS = [[.18, .3], [.47, .24], [.78, .3], [.3, .7], [.64, .66], [.86, .72]];
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
  wall.replaceChildren(); G.balloons = []; G.shots = 10; G.aiming = false; G.bi = (Math.random() * 8) | 0; DONE.gubbara = false;
  G.pool = [...INAAMS].sort(() => Math.random() - .5);
  [...SLOTS.keys()].sort(() => Math.random() - .5).slice(0, 4).forEach(spawnBalloon);
  $('#gshots').innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('');
  $('#ghaul').hidden = true; $('#glist').replaceChildren(); $('#gagain').hidden = true; hideShare('gubbara'); hidePin('gubbara');
  $('#gsub').textContent = 'drag to aim, let go to fire. 10 pellets.';
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
    setTimeout(() => {                                   // the popped one drifts off, a fresh balloon floats up in its place
      hit.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(() => hit.el.remove()).catch(() => {});
      G.balloons = G.balloons.filter(b => b !== hit);
      if (G.shots > 0) { const used = new Set(G.balloons.map(b => b.slot)); const free = [...SLOTS.keys()].filter(i => !used.has(i)); spawnBalloon(pick(free)); }
    }, 1100);
  } else {
    gsnd('tock', { vol: .6 }); const m = document.createElement('span'); m.className = 'gmiss'; m.textContent = pick(MISS_LINES); m.style.left = x + 'px'; m.style.top = y + 'px'; range.appendChild(m); setTimeout(() => m.remove(), 900);
  }
  if (G.shots === 0) {
    const n = $('#glist').children.length;
    if (!n) { addWin('#glist', 'one pat on the head from the stall uncle', 'assets/game/bal8.webp'); $('#ghaul').hidden = false; gsnd('fail', { vol: .6 }); }
    else setTimeout(() => gsnd('win', { vol: .6 }), 300);
    $('#gsub').textContent = n ? `${n} popped out of 10 pellets! here’s what you won.` : 'all misses! uncle feels bad for you.';
    showShare('gubbara'); showPin('gubbara'); $('#gagain').hidden = false; DONE.gubbara = true;
    const wins = [...document.querySelectorAll('#glist .win-card p')].map(p => p.textContent);
    haul('gubbara', n ? `popped ${n} balloon${n > 1 ? 's' : ''}` : 'all misses', wins.join(' · '), 'assets/game/bal1.webp');
  } else $('#gsub').textContent = `${G.shots} pellet${G.shots > 1 ? 's' : ''} left.`;
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
  ['ex-proof armour', 'they will text. you will not reply. iconic.'],
  ['dessert first', 'tonight you skip straight to the gulab jamun.'],
  ['bindi of confidence', 'stick it on and walk in like you own the place.'],
  ['the perfect diwali pic', 'one candid where you look unreal. trust.'],
  ['a pocket of good luck', 'one small, lucky thing happens before new year.'],
];
const R = { left: 10, busy: false, drag: null, won: [], pool: [], bi: 0 };
const cstage = $('#cstage'), ring = $('#cring'), aimLine = $('#caimline');
const csnd = (n, o) => { if (ACTIVE === 'chhalla') snd(n, o); };
function ringHome() { ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 1; ring.style.transform = 'translate(-50%, 0)'; }
function chhallaStatus() {
  $('#csub').textContent = R.left > 0 ? `${R.left} ring${R.left > 1 ? 's' : ''} left. flick one up onto a bottle.` : 'all rings thrown!';
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
  shelf.append(makeBottle(0), makeBottle(1));
  R.left = 10; R.busy = false; R.won = []; DONE.chhalla = false; ringHome(); hideShare('chhalla'); hidePin('chhalla');
  $('#chaul').hidden = true; $('#clist').replaceChildren(); $('#cagain').hidden = true; $('#ccoach').hidden = true;
  chhallaStatus();
}
cstage.addEventListener('pointerdown', e => {
  if (R.busy || R.left <= 0) return;
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
  csnd('whoosh', { vol: .6 }); chhallaThrow(vx, vy);
});
cstage.addEventListener('pointercancel', () => { endDrag(); ringHome(); });
function coach(msg, good) { const c = $('#ccoach'); c.hidden = false; c.textContent = msg; c.classList.toggle('good', !!good); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
async function chhallaThrow(vx, vy) {
  R.busy = true;
  const s = cstage.getBoundingClientRect(), rr = ring.getBoundingClientRect();
  const cx = rr.left + rr.width / 2 - s.left, cy = rr.top + rr.height / 2 - s.top;
  const power = clamp(-vy, .25, 3.2), tx = cx + vx * 220 + rnd(-8, 8), ty = cy - power * 240;
  let hitB = null, near = null, nd = 1e9;
  cstage.querySelectorAll('.bot').forEach(b => {
    const r = b.getBoundingClientRect(), nx = r.left + r.width / 2 - s.left, ny = r.top + r.height * .2 - s.top;
    const d = Math.hypot(tx - nx, ty - ny); if (d < nd) { nd = d; near = { el: b, x: nx, y: ny, w: r.width, h: r.height }; }
    if (!b.classList.contains('ringed') && Math.abs(tx - nx) < r.width * .4 && Math.abs(ty - ny) < r.height * .16) hitB = { el: b, x: nx, y: ny };
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
    const old = hitB.el;                                  // a fresh bottle (new prize) slides in
    setTimeout(() => { if (!old.isConnected) return; const nb = makeBottle(0); nb.classList.add('enter'); old.replaceWith(nb); }, 1500);
  } else {
    csnd('ringfloor', { vol: .7 });
    ring.animate([
      { transform: `translate(calc(-50% + ${endX - cx}px), ${endY - cy}px) scale(.5) rotateX(68deg)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${endX - cx + rnd(-60, 60)}px), ${endY - cy + 140}px) scale(.45) rotateX(80deg) rotate(260deg)`, opacity: 0 },
    ], { duration: 520, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' });
    const dy = ty - near.y, dxn = tx - near.x, tips = [];
    if (dy < -near.h * .16) tips.push('too far — less force');
    else if (dy > near.h * .16) tips.push('too short — flick harder');
    if (Math.abs(dxn) > near.w * .4) tips.push(dxn > 0 ? 'aim a little left' : 'aim a little right');
    coach(tips.length ? tips.join(', ') + '.' : 'so close! same again.');
  }
  await sleep(750);
  chhallaStatus();
  if (R.left > 0) ringHome();
  else {
    ring.getAnimations().forEach(a => a.cancel()); ring.style.opacity = 0; $('#cagain').hidden = false; DONE.chhalla = true;
    const n = R.won.length;
    if (!n) { addWin('#clist', 'the banta stays undefeated: one free nimbu soda, on the house.', 'assets/game/bottle0.webp'); $('#chaul').hidden = false; csnd('fail', { vol: .6 }); }
    $('#csub').textContent = n ? `${n} ring${n > 1 ? 's' : ''} landed! here’s what you won.` : 'no rings this time. one more go?';
    const wins = [...document.querySelectorAll('#clist .win-card p')].map(p => p.textContent);
    SH.chhalla = { img: 'assets/game/bottle0.webp', title: n ? `ringed ${n} bottle${n > 1 ? 's' : ''}` : 'the banta won', text: wins.join(' · '), kick: `${who()}’s ring toss` };
    showShare('chhalla'); showPin('chhalla');
    haul('chhalla', SH.chhalla.title, wins.join(' · '), 'assets/game/bottle0.webp');
  }
  R.busy = false;
}
$('#cagain').addEventListener('click', chhallaReset);

/* ═════════ lucky draw — your mood for 2027. a real crank; mood × colour × snack × month = thousands of tickets ═════════ */
const MOODS = [
  ['i’m my own good luck charm', 'good things keep finding you. you stop acting surprised.'],
  ['i’m the main character, no notes', 'every room you walk into is your entrance scene. walk slower.'],
  ['soft life, strict boundaries', 'yes to rest, no to “bas 5 minute ka kaam hai”.'],
  ['delulu, but i deliver', 'the plan sounds crazy out loud. it works anyway.'],
  ['nothing rattles me', 'not even the family group chat. zen master.'],
  ['i reply when i feel like it', 'nakhre on, notifications off. it suits you.'],
  ['my life is a full filmy montage', 'slow-motion entries, dramatic exits, at least one rain scene.'],
  ['unbothered, moisturised, thriving', 'let them talk. you’re busy glowing.'],
  ['chaos, but make it cute', 'last-minute plans turn into the best memories of the year.'],
  ['tired, but iconic', 'running on chai and charisma. still the best dressed in the room.'],
  ['i’m in my budget era (on paper)', 'you’ll make a gorgeous budget in january. framing it counts.'],
  ['i’m the plot twist', 'nobody saw your year coming. least of all you.'],
  ['i fix everything', 'the wifi, the plan, the family drama. ghar ka hero.'],
  ['passport out, always', 'at least one trip gets booked at 2am. zero regrets.'],
  ['glow-up loading', 'new habits actually stick this time. people ask what changed.'],
  ['i left the chat', 'you see the drama coming and simply… leave.'],
  ['yes to every invite', 'your calendar needs its own calendar.'],
  ['happily hermit', 'cancelled plans, cosy nights, zero guilt. bliss.'],
  ['i asked, i got', 'the raise, the upgrade, the extra gulab jamun. just ask.'],
  ['my side hustle is thriving', 'one small idea turns into real money. tell nobody till it works.'],
  ['jugaad is my love language', 'no plan? a safety pin, a smile, and it all works.'],
  ['first on the dance floor', 'last to leave. the DJ knows your name.'],
  ['every outfit is a statement', 'the mohalla starts copying you by march.'],
  ['sweet like kaju katli', 'everyone wants a piece of you next year. share wisely.'],
  ['spicy like hari mirchi', 'sharp tongue, warm heart, zero tolerance for nonsense.'],
  ['protecting my peace', 'you guard it like it’s the last samosa.'],
  ['i say it like it is', 'you say what everyone’s thinking. they love you for it.'],
  ['secretly a softie', 'you’ll cry at a wedding you didn’t even want to go to.'],
  ['new city, who dis', 'a move, a new address, or at least a new favourite café.'],
  ['healing, but make it fashion', 'therapy on tuesday, brunch on sunday, outfit on point.'],
  ['chai over drama', 'you settle every fight with two cutting chais. diplomat.'],
  ['on a lucky streak', 'parking spots, upgrades, the last piece of cake. all yours.'],
  ['rich aunty in training', 'big sunglasses, bigger plans, a portfolio in progress.'],
  ['unreachable (in a good way)', 'out living life. leave a voice note.'],
  ['golden retriever energy', 'excited about everything, friends with everyone.'],
  ['mysterious and selective', 'black-cat energy. annoyingly cool.'],
  ['a morning person now (shock)', 'sunrise walks. nobody recognises you anymore.'],
  ['night owl royalty', 'best ideas at 2am, best stories at 4am.'],
  ['i colour-code my feelings', 'trips, birthdays, emotions. all in one spreadsheet.'],
  ['going with the flow', 'no plans, all vibes, everything lands anyway.'],
  ['no regrets, only stories', 'you say yes to the scary thing. it pays off big.'],
  ['my friends’ loudest cheerleader', 'they win more because you’re in the front row.'],
  ['quietly winning', 'no announcements. just results.'],
  ['surviving shaadi season in style', 'six weddings, four sangeets, one perfectly repeated lehenga.'],
  ['nani’s favourite, officially', 'family approval rating at an all-time high. use it.'],
  ['someone has a crush on me', 'you’ll find out by holi. act natural.'],
  ['manifesting, aggressively', 'the vision board goes up, and for once it listens.'],
  ['touching grass, loving it', 'less scrolling, more sunsets. weirdly, it’s great.'],
  ['ride or die for my people', 'they’ll need you next year. you show up every time.'],
  ['slow start, big burst', 'anaar energy. you start quiet, then light up the whole sky.'],
  ['small sparks everywhere', 'phuljhadi mood. impossible to ignore.'],
  ['still glowing, thanks', 'things try to blow you out. you keep burning bright.'],
  ['out of office, mentally and physically', 'you finally take the leave, and actually switch off.'],
  ['gym era (for real this time)', 'three times a week. people notice. you mention it.'],
  ['my dish is famous now', 'one recipe becomes legendary. everyone wants the secret.'],
  ['i text first, no ego', 'you make the call. good things follow.'],
  ['a compliment magnet', 'strangers stop you to ask where it’s from.'],
  ['standards: sky high', 'only premium people get access next year.'],
  ['bas, ho gaya', 'you finally close the chapter that kept dragging. lighter already.'],
  ['full paisa vasool', 'every plan, every trip, every rupee: worth it.'],
  ['i’m the vibe', 'parties start when you arrive. that’s just facts.'],
  ['calm, rich and slightly smug', 'things work out. you knew they would.'],
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
  if (live && Math.floor(D.ang / 90) !== D.lastClick) { D.lastClick = Math.floor(D.ang / 90); snd('ratchet', { vol: .5, rate: rnd(.9, 1.1) }); }
  loopVol('drum', live ? Math.min(1, Math.abs(D.vel) / 600) * .9 : 0);
  drawMeter();
  if (!D.done && D.total >= D.need) drawDrop();
  if (live || Math.abs(D.vel) > 1) D.raf = requestAnimationFrame(drawLoop); else { D.raf = 0; loopVol('drum', 0); }
}
function kick() { if (!D.raf) { D.last = 0; D.raf = requestAnimationFrame(drawLoop); } }
// the whole drum is the handle: drag in any circle-ish way; a plain tap gives it a shove
dstage.addEventListener('pointerdown', e => {
  if (D.done) return; start(); e.preventDefault(); try { dstage.setPointerCapture(e.pointerId); } catch (err) {}
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
  if (D.done || D.busy) return; start(); D.busy = true; $('#dsub').textContent = 'ghuma ghuma ke…'; kick();
  while (!D.done && ACTIVE === 'draw') { D.vel = Math.min(900, D.vel + 140); await sleep(60); }
  D.busy = false;
});
async function drawDrop() {
  D.done = true; $('#dspin').hidden = true;
  const [name, text] = pick(MOODS), extra = `lucky colour: ${pick(LUCK.colour)} · lucky snack: ${pick(LUCK.snack)} · best month: ${pick(LUCK.month)}`;
  $('#tno').textContent = String(1000 + ((Math.random() * 9000) | 0));
  $('#tname').textContent = `“${name}”`; $('#ttext2').textContent = text; $('#textra').textContent = extra;
  $('#dsub').textContent = 'a ticket drops…';
  const drop = $('#drDrop'); drop.classList.remove('go'); void drop.offsetWidth; drop.classList.add('go');
  snd('tdrop'); await sleep(750);
  if (ACTIVE !== 'draw') return;
  dstage.classList.add('gone'); $('#dmeter').classList.add('gone'); $('.d-intro').classList.add('gone');   // the drum steps aside, the ticket takes the stage
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
  D.done = false; DONE.draw = false; D.total = 0; D.vel = 0; hideShare('draw'); hidePin('draw'); $('#ticket').hidden = true; $('#ticket').classList.remove('open'); $('#dagain').hidden = true; $('#dspin').hidden = false;
  dstage.classList.remove('gone'); $('#dmeter').classList.remove('gone'); $('.d-intro').classList.remove('gone');
  $('#drDrop').classList.remove('go'); $('#dsub').textContent = 'drag the drum round (or tap the button).'; drawMeter();
}
$('#dagain').addEventListener('click', () => { drawReset(); snd('tap'); $('#dstage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
})();
