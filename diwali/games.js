/* mohalla game center — tota jyotish, gubbara phod, chhalla, lucky draw. Every game ends in an inaam. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rad = d => d * Math.PI / 180;
const FX = () => window.MKDFX || { sfx: {}, initAudio() {}, noiseHit() {}, buzz() {}, audio: null };
const tick = () => { const f = FX(); if (f.audio) f.noiseHit(.025, 'highpass', 4200, 3000, .22); };
const ding = (hz = 760, v = .6) => { const f = FX(); if (f.sfx.bell) f.sfx.bell(hz, v); };
const pop = () => { const f = FX(); if (f.audio) { f.noiseHit(.12, 'lowpass', 1600, 200, .9, 1); f.noiseHit(.3, 'highpass', 5200, 3000, .3, .7, .02); } };
const clink = () => { const f = FX(); if (f.audio) { f.noiseHit(.05, 'bandpass', 4800, 4200, .5, 8); f.noiseHit(.4, 'bandpass', 3100, 3000, .2, 14, .03); } };
const start = () => FX().initAudio();

/* ── stalls ── */
const stalls = [...document.querySelectorAll('.stall')];
stalls.forEach(st => st.addEventListener('click', () => {
  stalls.forEach(s => s.classList.toggle('on', s === st));
  document.querySelectorAll('.game[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== st.dataset.game; });
  if (st.dataset.game === 'gubbara' && !G.ready) gubbaraReset();
  if (st.dataset.game === 'chhalla' && !R.ready) chhallaReset();
  $('#booth').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

/* ═════════ tota jyotish ═════════ */
const FORTUNES = [
  { img: 'nakhre', title: 'nakhre unlimited', text: "this year you're allowed to be extra, and everyone will play along." },
  { img: 'nazar', title: 'buri nazar wale, tera bhi bhala ho', text: "the haters are watching. you're thriving anyway. keep the nimbu-mirchi handy." },
  { img: 'spicy', title: 'spicy par pyaari', text: 'a year of hot takes, delivered sweetly.' },
  { img: 'naacho', title: 'naacho, gaao, lagao nakhoon', text: 'a year of dance floors and fresh sets. warm up those thumkas.' },
  { img: 'spark', title: 'nails that spark joy', text: "fresh sets, fresh starts. it's your glow-up year." },
  { img: 'meethe', title: 'meethe nakhoon, khatte log', text: 'keep the sweet ones close and the sour ones at arm’s length.' },
  { img: 'girlies', title: 'desi nail girlies club', text: 'membership confirmed. your girl gang is about to get bigger.' },
  { img: 'chugli', title: 'aao behen, chugli karein', text: "seems like you're going to have a year filled with gossip to share." },
  { img: 'bsfree', title: 'bullsh*t free zone', text: "no fake friends, no drama you didn't ask for. bliss." },
  { img: 'door', title: 'darwaaza khula hai', text: 'new doors are opening this year. walk in like you own the mohalla.' },
];
FORTUNES.forEach(f => { const i = new Image(); i.src = `assets/cards/${f.img}.webp`; });
const T = { table: $('#ttable'), tota: $('#tota'), cards: [], busy: false, state: 'stack' };
function tT(el, x, y, r, sc = 1, z) { el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${sc})`; if (z != null) el.style.zIndex = z; }
function totaBuild() {
  T.cards.forEach(c => c.remove());
  T.cards = Array.from({ length: 9 }, () => {
    const el = document.createElement('div'); el.className = 'kc';
    el.innerHTML = '<div class="kc-in"><div class="kc-f kc-back"></div><div class="kc-f kc-front"></div></div>';
    T.table.appendChild(el); return el;
  });
  totaStack();
  totaParrot('home');
}
function totaStack() { T.cards.forEach((el, i) => { el.style.opacity = 1; el.classList.remove('flip'); tT(el, (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); }); T.state = 'stack'; }
function totaParrot(where, x = 0, y = 0, peck = false) {
  const W = T.table.clientWidth, el = T.tota;
  el.src = peck ? 'assets/game/parrot_card.webp' : 'assets/game/parrot.webp';
  if (where === 'home') { el.style.transition = 'transform .6s cubic-bezier(.3,.9,.3,1)'; el.style.transform = `translate(${-W * .5 - 40}px, 30px) scaleX(1)`; }
  else el.style.transform = `translate(${x}px, ${y}px) scaleX(${peck ? 1 : 1})`;
}
async function riffle() {
  const w = T.cards[0].offsetWidth, half = Math.ceil(T.cards.length / 2);
  const L = T.cards.slice(0, half), R = T.cards.slice(half);
  L.forEach((el, i) => tT(el, -w * .56, -i * 1.3, -9)); R.forEach((el, i) => tT(el, w * .56, -i * 1.3, 9));
  await sleep(360);
  const out = [];
  while (L.length || R.length) out.push(((Math.random() < .5 && L.length) || !R.length ? L : R).shift());
  for (let i = 0; i < out.length; i++) { tT(out[i], (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); tick(); await sleep(50); }
  T.cards = out; await sleep(280);
}
async function bridge() {
  T.cards.forEach((el, i) => tT(el, (i - 4) * .5, -i * 1.3 - 24, rnd(-2, 2), 1.05)); await sleep(240);
  for (let i = 0; i < T.cards.length; i++) { tT(T.cards[i], (i - 4) * .5, -i * 1.3, rnd(-3, 3), 1, i); tick(); await sleep(28); }
  await sleep(260);
}
function fanPos(i) {
  const W = T.table.clientWidth, cw = T.cards[0].offsetWidth, n = T.cards.length, spread = W < 500 ? 22 : 30;
  const R = Math.min(520, (W / 2 - cw * .6) / Math.sin(rad(spread)));
  const a = -spread + 2 * spread * i / (n - 1);
  return { x: Math.sin(rad(a)) * R, y: R - Math.cos(rad(a)) * R - 30, a };
}
async function fan() { for (let i = 0; i < T.cards.length; i++) { const p = fanPos(i); tT(T.cards[i], p.x, p.y, p.a, 1, i); tick(); await sleep(40); } }
async function totaPlay() {
  if (T.busy) return; T.busy = true; start();
  $('#tread').hidden = true; $('#tagain').hidden = true; $('#tgo').hidden = true;
  $('#tsub').textContent = 'shuffling…';
  totaBuild(); await sleep(300);
  await riffle(); await riffle(); await bridge(); await fan();
  $('#tsub').textContent = 'tota ji is choosing…';
  // the parrot hops along the fan, hesitates, then pecks one out
  const choice = 1 + ((Math.random() * (T.cards.length - 2)) | 0);
  const tw = T.tota.offsetWidth, th = T.tota.offsetHeight;
  const stops = [0, 2, 4, 6, 8].filter(i => i < T.cards.length);
  T.tota.style.transition = 'transform .55s cubic-bezier(.4,1.6,.5,1)';
  for (const i of [...stops, choice]) {
    const p = fanPos(i);
    totaParrot('at', p.x - tw * .78, p.y + T.cards[0].offsetHeight * .22 - th * .32);
    tick(); await sleep(560);
  }
  const p = fanPos(choice);
  totaParrot('at', p.x - tw * .74, p.y + T.cards[0].offsetHeight * .18 - th * .3, true);
  const el = T.cards[choice];
  const f = pick(FORTUNES);
  el.querySelector('.kc-front').style.backgroundImage = `url(assets/cards/${f.img}.webp)`;
  T.cards.forEach(c => { if (c !== el) c.style.opacity = .16; });
  tT(el, p.x, p.y - 26, p.a, 1, 60); await sleep(380);
  totaParrot('home'); await sleep(250);
  tT(el, 0, -10, 0, 1.45, 60); await sleep(420);
  el.classList.add('flip'); ding(820, .55); FX().buzz(20);
  await sleep(480);
  $('#ttitle').textContent = f.title; $('#ttext').textContent = f.text;
  $('#tread').hidden = false; $('#tagain').hidden = false;
  $('#tsub').textContent = 'tota ji has spoken.';
  T.busy = false;
}
$('#tgo').addEventListener('click', totaPlay);
$('#tagain').addEventListener('click', totaPlay);
totaBuild();

/* ═════════ gubbara phod ═════════ */
const INAAMS = [
  'the last kaju katli in the dabba', 'a soan papdi box you can regift (again)', 'immunity from “beta, shaadi kab?”',
  'first dibs on tonight’s chugli', 'a lifetime supply of nazar (with nimbu-mirchi)', 'one excuse to skip rangoli duty',
  'the aux cord, for exactly one song', 'a phuljhadi that actually lights', 'front-row seat at the family drama',
  'one guilt-free extra gulab jamun', 'a compliment on your nails from a stranger', 'the window seat at the chai tapri',
  'unlimited unsolicited advice from mausi', 'a diya that refuses to go out', 'a thumka lesson from the aunties',
];
const G = { ready: false, shots: 5, won: [] };
function gubbaraReset() {
  const board = $('#gboard'); board.replaceChildren();
  G.shots = 5; G.won = []; G.ready = true;
  const n = 15, pool = [...INAAMS].sort(() => Math.random() - .5);
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gub';
    b.style.setProperty('--d', (-Math.random() * 3).toFixed(2) + 's');
    b.innerHTML = `<img src="assets/game/bal${i % 8}.webp" alt="balloon">`;
    b.dataset.prize = pool[i % pool.length];
    b.addEventListener('click', () => gubbaraShoot(b));
    board.appendChild(b);
  }
  $('#gshots').innerHTML = Array.from({ length: 5 }, () => '<i></i>').join('');
  $('#ghaul').hidden = true; $('#glist').replaceChildren(); $('#gagain').hidden = true;
  $('#gsub').textContent = '5 shots. every pop wins you something.';
}
function gubbaraShoot(b) {
  if (G.shots <= 0 || b.classList.contains('popped')) return;
  start(); pop(); FX().buzz(15);
  G.shots--; $('#gshots').children[4 - G.shots].classList.add('used');
  b.classList.add('popped');
  b.querySelector('img').src = 'assets/game/bal8.webp';
  const tag = document.createElement('span'); tag.className = 'gtag'; tag.textContent = b.dataset.prize; b.appendChild(tag);
  G.won.push(b.dataset.prize);
  const li = document.createElement('li'); li.textContent = b.dataset.prize; $('#glist').appendChild(li);
  $('#ghaul').hidden = false;
  if (G.shots === 0) {
    $('#gsub').textContent = 'shots khatam! collect your inaam below.';
    $('#gagain').hidden = false; ding(700, .6);
  } else $('#gsub').textContent = `${G.shots} shot${G.shots > 1 ? 's' : ''} left.`;
}
$('#gagain').addEventListener('click', gubbaraReset);

/* ═════════ chhalla (ring toss on banta bottles) ═════════ */
const PRIZES = [
  ['aunty approval', 'she said “kitni sundar lag rahi hai”. frame it.'],
  ['gossip VIP pass', 'you hear the chugli first, before the group chat does.'],
  ['dance-floor immunity', 'nobody can drag you to dance. (you’ll go anyway.)'],
  ['the last samosa', 'it’s yours. nobody will fight you for it. probably.'],
  ['no-nazar shield', 'one nimbu-mirchi, personally assigned to you for the year.'],
];
const MISSES = ['try karo, beta. consolation prize: one pat on the head.', 'so close! the banta respects your effort.', 'missed! but your nails looked great doing it.'];
const R = { ready: false, left: 3, busy: false };
function chhallaReset() {
  const shelf = $('#cshelf'); shelf.replaceChildren();
  const order = [0, 1, 2, 3, 4].sort(() => Math.random() - .5);
  order.forEach((p, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bot';
    b.innerHTML = `<img src="assets/game/bottle${i}.webp" alt="banta bottle"><span class="btag">${PRIZES[p][0]}</span>`;
    b.dataset.p = p; b.addEventListener('click', () => chhallaThrow(b));
    shelf.appendChild(b);
  });
  R.left = 3; R.ready = true; R.busy = false;
  $('#cread').hidden = true; $('#cagain').hidden = true;
  $('#csub').textContent = '3 bangles. tap a bottle to throw.';
  const ring = $('#cring'); ring.style.transition = 'none'; ring.style.transform = 'translate(-50%, 0) scale(1)'; ring.style.opacity = 1;
}
async function chhallaThrow(b) {
  if (R.busy || R.left <= 0) return; R.busy = true; start();
  const ring = $('#cring'), stage = $('#cstage').getBoundingClientRect(), br = b.getBoundingClientRect(), rr = ring.getBoundingClientRect();
  const hit = Math.random() < .55;
  const tx = br.left + br.width / 2 - (rr.left + rr.width / 2) + (hit ? 0 : rnd(-1, 1) * br.width * .9);
  const ty = (br.top + br.height * (hit ? .16 : -.1)) - (rr.top + rr.height / 2);
  ring.style.transition = 'transform .7s cubic-bezier(.25,.6,.35,1)';
  ring.style.transform = `translate(calc(-50% + ${tx}px), ${ty}px) rotate(${rnd(360, 720)}deg) scale(.55) rotateX(62deg)`;
  await sleep(720);
  R.left--;
  if (hit) {
    clink(); FX().buzz(25); b.classList.add('ringed');
    const [name, text] = PRIZES[+b.dataset.p];
    $('#ctitle').textContent = name; $('#ctext').textContent = text; ding(880, .55);
    ring.style.opacity = 0;
  } else {
    clink();
    ring.style.transition = 'transform .5s ease-in, opacity .4s .2s';
    ring.style.transform = `translate(calc(-50% + ${tx + rnd(-40, 40)}px), ${ty + 160}px) rotate(900deg) scale(.5)`; ring.style.opacity = 0;
    $('#ctitle').textContent = 'missed!'; $('#ctext').textContent = pick(MISSES);
  }
  $('#cread').hidden = false;
  await sleep(500);
  if (R.left > 0) {
    ring.style.transition = 'none'; ring.style.opacity = 1; ring.style.transform = 'translate(-50%, 0) scale(1)';
    $('#csub').textContent = `${R.left} bangle${R.left > 1 ? 's' : ''} left.`;
  } else { $('#csub').textContent = 'all bangles thrown!'; $('#cagain').hidden = false; }
  R.busy = false;
}
$('#cagain').addEventListener('click', chhallaReset);

/* ═════════ lucky draw ═════════ */
const PERSONAS = [
  { name: 'the chugli champion', text: "you'll know everything before it happens. use your powers wisely (or don't)." },
  { name: 'main-character energy', text: 'every room you walk into this year is your entrance scene.' },
  { name: 'the dance-floor auntie', text: 'first on the floor, last to leave. the DJ already fears you.' },
  { name: 'the jugaad genius', text: "no plan? no problem. you'll fix everything with a safety pin and a smile." },
  { name: 'the phuljhadi', text: 'small, sparkly, impossible to ignore. you light up every room for exactly as long as you want.' },
  { name: 'the rangoli perfectionist', text: "everything has to be just right this year, and somehow it will be." },
  { name: 'the soan papdi re-gifter', text: 'resourceful, practical, slightly suspicious. a legend in the making.' },
  { name: 'the glow-up of the year', text: 'new set, new vibe, new you. people will ask what changed.' },
  { name: 'the soft-spoken savage', text: 'sweet voice, sharp comebacks. nobody sees it coming.' },
  { name: 'the matchmaker', text: 'at least one wedding next year will be your fault. take the credit.' },
  { name: 'the selfie director', text: "you'll get everyone's best angle. nobody will get yours." },
  { name: 'the mohalla’s lucky charm', text: 'good things follow you around this year. keep your people close.' },
];
const D = { busy: false };
async function draw() {
  if (D.busy) return; D.busy = true; start();
  $('#ticket').hidden = true; $('#dagain').hidden = true; $('#dspin').hidden = true;
  $('#dsub').textContent = 'ghuma ghuma ke…';
  const drum = $('#drum'); drum.classList.add('spin');
  const t0 = performance.now();
  while (performance.now() - t0 < 2300) { const f = FX(); if (f.audio) f.noiseHit(.03, 'bandpass', rnd(1800, 3200), 1400, .14, 2); await sleep(85); }
  drum.classList.remove('spin');
  await sleep(200);
  const p = pick(PERSONAS);
  $('#tno').textContent = String(1000 + ((Math.random() * 9000) | 0));
  $('#tname').textContent = p.name; $('#ttext2').textContent = p.text;
  const t = $('#ticket'); t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  ding(700, .6); FX().buzz(25);
  $('#dsub').textContent = 'here you are, next year.';
  $('#dagain').hidden = false; D.busy = false;
}
$('#dspin').addEventListener('click', draw);
$('#drum').addEventListener('click', draw);
$('#dagain').addEventListener('click', draw);
})();
