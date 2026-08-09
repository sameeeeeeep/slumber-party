/* ============================================================================
   /besties — the private invitation.

   The shape of it: a sealed payload lands in the browser as noise. The password
   is the key that decrypts it, so nothing about the party exists on this page
   until someone types the right words. After that the whole thing plays out as
   a conversation — she talks, you answer, the details leak out between messages.

   No framework, no dependencies, no build step: same as the rest of the site.
   ============================================================================ */
(function () {
'use strict';

const $  = (id) => document.getElementById(id);
const thread = $('thread');

/* Keep the newest message in view — but only when they're already at the bottom.
   Yanking the view out from under someone reading back is worse than a message
   they have to scroll one line for. */
function pin(force) {
  const near = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 140;
  if (force || near) thread.scrollTop = thread.scrollHeight;
}

/* the slice of screen the on-screen keyboard leaves us. iOS shrinks
   visualViewport rather than the layout viewport, so this is the only honest
   measure of "how much room is actually visible". */
const vv = window.visualViewport;
function sizeViewport() {
  const h = (vv ? vv.height : window.innerHeight);
  document.documentElement.style.setProperty('--vh', h + 'px');
  pin(true);
}
if (vv) { vv.addEventListener('resize', sizeViewport); vv.addEventListener('scroll', sizeViewport); }
addEventListener('orientationchange', () => setTimeout(sizeViewport, 250));
sizeViewport();

/* ---------------------------------------------------------------- state ---- */
const state = {
  content: null,      // decrypted payload
  guest: null,        // { first, name, plus_one, notes } for a personalised link
  guestRef: null,     // an opaque, non-identifying handle for analytics
  step: 0,
  answers: {},
  promised: false,
  rsvped: false,
  fast: false,        // replaying a returning visitor's progress with no pauses
};

const SAVE = 'ssp-besties';
function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify({
      k: state.key, step: state.step, promised: state.promised,
      rsvped: state.rsvped, answers: state.answers,
    }));
  } catch (e) {}
}
function load() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } }

/* ------------------------------------------------------------ analytics ----
   Named exactly as specified, sent to the two pixels the site already runs plus
   the (currently parked) Supabase funnel. A personalised link contributes only
   `guest_ref` — 8 characters of a slow hash — so nothing here can be read back
   into a name. */
function ev(name, extra) {
  const props = Object.assign({}, extra || {});
  if (state.guestRef) props.guest_ref = state.guestRef;
  try { if (window.fbq) fbq('trackCustom', name, props); } catch (e) {}
  try { if (window.clarity) clarity('event', name); } catch (e) {}
  const cfg = window.SLUMBER_CONFIG || {};
  if (!(cfg.useSupabase && cfg.supabaseUrl && cfg.supabaseAnonKey)) return;
  try {
    fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/functions/v1/visit', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey,
                 Authorization: 'Bearer ' + cfg.supabaseAnonKey },
      body: JSON.stringify({ session_id: sid(), reached: name, guest_ref: state.guestRef || null,
                             device: innerWidth <= 640 ? 'mobile' : 'desktop' }),
    }).catch(() => {});
  } catch (e) {}
}
function sid() {
  let s = null; try { s = sessionStorage.getItem('ksp-sid'); } catch (e) {}
  if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36);
            try { sessionStorage.setItem('ksp-sid', s); } catch (e) {} }
  return s;
}

/* ----------------------------------------------------------------- sound ---
   Synthesised, like the main site's CHATFX — no audio files to load over a
   phone connection. Shares the 'ksp-snd' preference so a mute carries across. */
const FX = (function () {
  let ctx = null, muted = false, pending = false;
  try { muted = localStorage.getItem('ksp-snd') === 'off'; } catch (e) {}
  function unlock() {
    try {
      /* iOS routes WebAudio into the "ambient" audio session, and the ambient
         session is silenced by the physical ring/silent switch. That is why a
         page can be unmuted, unlocked and still play nothing on an iPhone with
         the switch flipped. 'playback' is the session that ignores the switch.
         Safari 16.4+; harmless everywhere else. */
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume();
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      /* A ping that fired before audio was allowed isn't lost — it lands on the
         first tap instead. Without this, everything up to the first touch is
         silently dropped and the thread feels dead. */
      if (pending && !muted) { pending = false; setTimeout(() => { if (running()) recv(); }, 140); }
      paintSound();
    } catch (e) {}
  }
  // iOS re-suspends the context whenever the page idles, so re-arm on every gesture
  ['pointerdown', 'touchend', 'keydown'].forEach(e => addEventListener(e, unlock, { passive: true }));
  const running = () => !!(ctx && ctx.state === 'running');
  function ok() {
    if (muted) return false;
    if (!running()) { pending = true; paintSound(); return false; }   // remember it for the first tap
    return true;
  }
  function tone(freq, at, dur, type, peak) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, at);
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak || 0.05, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.start(at); o.stop(at + dur + 0.02);
  }
  function noise(dur, peak, filterHz) {
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = filterHz || 900;
    const g = ctx.createGain(); g.gain.value = peak || 0.12;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
  }
  function recv() { if (!ok()) return; const t = ctx.currentTime; tone(784, t, .1, 'sine', .045); tone(1046, t + .09, .16, 'sine', .05); }

  return {
    muted: () => muted,
    running,
    setMuted(m) { muted = !!m; try { localStorage.setItem('ksp-snd', m ? 'off' : 'on'); } catch (e) {} if (!m) unlock(); paintSound(); },
    unlock,
    recv,
    sent()  { if (!ok()) return; const t = ctx.currentTime; tone(1174, t, .07, 'triangle', .04); },
    tick()  { if (!ok()) return; tone(2200, ctx.currentTime, .012, 'square', .008); },
    shutter() { if (!ok()) return; noise(.05, .16, 1800); setTimeout(() => { if (ok()) noise(.09, .1, 700); }, 60); },
    lock()  { if (!ok()) return; const t = ctx.currentTime; tone(320, t, .06, 'square', .05); tone(880, t + .08, .22, 'sine', .05); },
    sealed(){ if (!ok()) return; const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .09, .32, 'sine', .05)); },
  };
})();
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* Declared here because FX reaches back for it on every unlock, and FX is built
   before the button exists in some load orders. */
function paintSound() {
  const el = document.getElementById('sound');
  if (!el) return;
  const off = FX.muted();
  el.classList.toggle('off', off);
  el.classList.toggle('waiting', !off && !FX.running());
  el.setAttribute('aria-label',
    off ? 'sound off' : FX.running() ? 'sound on' : 'tap to turn sound on');
}

/* ------------------------------------------------------------- unsealing ---
   PBKDF2-SHA256 → AES-GCM. The wrong password doesn't get "rejected"; it simply
   produces no plaintext, which is the point — there is no comparison to bypass. */
const te = new TextEncoder(), td = new TextDecoder();
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function unsealBlob(blob, secret) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(blob.s), iterations: blob.r || 250000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.i) }, key, unb64(blob.c));
  return JSON.parse(td.decode(out));
}
/* the index a personalised link is looked up by — derived as slowly as the blob
   itself, so holding guests.js doesn't make the codes cheap to guess */
async function guestIndex(code) {
  const base = await crypto.subtle.importKey('raw', te.encode(code.toLowerCase()), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: te.encode('ssp-besties-index'), iterations: 100000, hash: 'SHA-256' }, base, 128);
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ misc --- */
const sleepRaw = (ms) => new Promise(r => setTimeout(r, ms));

/* Bring a full-screen sheet in.
   `on` flips display:none → grid; `vis` runs the opacity transition. Something
   has to separate the two or the browser coalesces them into one style pass and
   the transition never plays.

   The obvious separator is requestAnimationFrame — and it is wrong here. rAF is
   paused in a backgrounded tab, so switching away at the instant a sheet opens
   left `vis` unapplied: an invisible sheet sitting over the whole page, blocking
   it, until you came back and the queued frame finally ran. Reading offsetWidth
   forces the style flush synchronously, which does not care whether anyone is
   looking at the tab. */
function reveal(sheet) {
  sheet.classList.add('on');
  void sheet.offsetWidth;
  sheet.classList.add('vis');
}
let skip = null;                       // resolver for "tap to hurry her along"
function sleep(ms) {
  if (state.fast) return Promise.resolve();
  return new Promise(resolve => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); skip = null; resolve(); }
    skip = done;
  });
}
function hurry() { if (skip) skip(); }

function flash(withSound) {
  const f = $('flash');
  f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop');
  if (withSound !== false) FX.shutter();
}
let toastT;
function toast(text) {
  const t = $('toast'); t.textContent = text; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ============================================================================
   THE GATE
   ============================================================================ */
const WRONG = [
  'ummm… do we know you? 👀',
  'nice try babe.',
  'khushi definitely didn\'t tell you that.',
  'besties only 💋',
];
let wrongAt = -1;

function inviteCode() {
  const q = new URLSearchParams(location.search).get('g');
  if (q) return q;
  const seg = location.pathname.replace(/\/+$/, '').split('/').pop();
  if (seg && seg !== 'besties' && !/\.html?$/.test(seg)) return seg;
  const h = location.hash.replace('#', '');
  if (!h || h.startsWith('p=')) return null;   // p= is a retired password shortcut, never a guest
  return h;
}

/* Links used to be able to carry the password (/besties/?p=…). They can't any
   more — the password is typed, always, by everyone. Old links still open, they
   just land on the gate like everyone else; this only wipes the dead parameter
   out of the address bar so it isn't sitting in history or a screenshot. */
function stripCarriedPassword() {
  const hasQuery = new URLSearchParams(location.search).has('p');
  const hasHash = location.hash.startsWith('#p=');
  if (!hasQuery && !hasHash) return;
  try {
    const url = new URL(location.href);
    url.searchParams.delete('p');
    if (hasHash) url.hash = '';
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (e) {}
}

async function boot() {
  ev('invite_opened');
  const code = inviteCode();

  if (code && window.BESTIES_GUESTS) {
    try {
      const idx = await guestIndex(code);
      const blob = window.BESTIES_GUESTS[idx];
      if (blob) {
        const g = await unsealBlob(blob, code.toLowerCase());
        state.guest = g;
        state.guestRef = idx.slice(0, 8);
        // keep the pretty URL even when we arrived via the 404 shim's ?g=
        try { history.replaceState(null, '', '/besties/' + code); } catch (e) {}
        return greetGuest(g);
      }
    } catch (e) { /* unknown or mistyped code — fall through to the password */ }
  }

  stripCarriedPassword();

  // already been let in on this device? walk straight back in.
  const saved = load();
  if (saved && saved.k) {
    try {
      state.content = await unsealBlob(window.BESTIES_SEALED, saved.k);
      state.key = saved.k;
      state.promised = !!saved.promised; state.rsvped = !!saved.rsvped;
      state.answers = saved.answers || {};
      state.step = saved.step || 0;
      return enter(true);
    } catch (e) { try { localStorage.removeItem(SAVE); } catch (e2) {} }
  }
  $('pw').focus({ preventScroll: true });
}

/* A personalised link knows who you are — it does NOT let you in. It greets you
   by name and then hands you to the same password field as everybody else, so
   the invitation can't be opened by a forwarded URL alone. The guest blob no
   longer carries the password at all; all it holds is the name and the voice. */
function greetGuest(g) {
  const first = (g.first || '').toLowerCase();
  $('gateLocked').hidden = true;
  $('gateGreet').hidden = false;
  $('greetName').innerHTML = 'is that <em style="font-style:normal;color:var(--pink)">' +
    escapeHTML(first) + '</em>? 👀';
  $('greetOpen').addEventListener('click', () => {
    ev('guest_recognised');
    $('gateGreet').hidden = true;
    $('gateLocked').hidden = false;
    if (first) $('gateFoot').innerHTML = 'you know the words,<br>' + escapeHTML(first) + '.';
    $('pw').focus({ preventScroll: true });
  });
}

$('gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('pw').value.trim().toUpperCase();
  if (!pass) return;
  FX.unlock();
  ev('password_attempted');
  $('gateGo').disabled = true;
  try {
    state.content = await unsealBlob(window.BESTIES_SEALED, pass);
    state.key = pass;
    ev('password_success', { via: state.guest ? 'personal_link' : 'password' });
    enter(false);
  } catch (err) {
    $('gateGo').disabled = false;
    const f = $('pwField'); f.classList.remove('wrong'); void f.offsetWidth; f.classList.add('wrong');
    wrongAt = (wrongAt + 1) % WRONG.length;
    const el = $('gateErr'); el.textContent = WRONG[wrongAt];
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    buzz(60);
    $('pw').select();
  }
});
$('pw').addEventListener('input', () => { $('gateGo').disabled = !$('pw').value.trim(); });

/* ============================================================================
   THE WAY IN — lock opens → black → flash → she's already typing
   ============================================================================ */
async function enter(returning) {
  $('lockIcon').textContent = '🔓';
  $('lockIcon').classList.add('open');
  FX.lock();
  buzz(20);
  await sleepRaw(returning ? 200 : 650);

  $('gate').classList.add('leaving');
  await sleepRaw(480);
  $('gate').hidden = true;

  $('app').classList.add('on');
  await sleepRaw(returning ? 60 : 320);   // a beat of pure black before the flash
  flash();
  await sleepRaw(90);
  $('app').classList.add('vis');
  sizeViewport();

  buildInviteCard();
  sparkles();
  ev('chat_started');

  if (returning && (state.step > 0 || state.promised)) {
    // replay what they've already seen, instantly, then pick up where they left off
    state.fast = true;
    stamp();
    await runFrom(0, state.step);
    state.fast = false;
    if (state.promised && state.rsvped) return showInvite(true);
    if (state.promised) return showInvite(false);
    return runFrom(state.step);
  }
  stamp();
  runFrom(0);
}

function stamp() {
  const el = document.createElement('p');
  el.className = 'stamp';
  el.textContent = 'today · 2:03 am';
  thread.appendChild(el);
}

/* ============================================================================
   THE CONVERSATION
   ============================================================================ */
/* Per-guest copy swap. Her script is written for the girls she's inviting; a
   guest whose record asks for a different voice hears the alternate line, and
   everything not listed falls through untouched. */
function line(text) {
  const v = state.guest && state.guest.voice
    && state.content.variants && state.content.variants[state.guest.voice];
  let out = (v && v[text]) || text;
  /* {first} → their first name, for a line that greets someone directly. Only a
     personalised link knows a name, so it falls back to "there" rather than
     printing the token at somebody who typed the password on the bare /besties. */
  if (out.indexOf('{first}') !== -1) {
    const f = (state.guest && state.guest.first) ? String(state.guest.first).toLowerCase() : 'there';
    out = out.replace(/\{first\}/g, f);
  }
  return out;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bubble(who, text, cls) {
  const el = document.createElement('div');
  el.className = 'msg ' + who + (cls ? ' ' + cls : '');
  el.textContent = text;
  thread.appendChild(el); pin();
  return el;
}
function system(text) {
  const el = document.createElement('div');
  el.className = 'sys'; el.textContent = text;
  thread.appendChild(el); pin();
}
function typing(on) {
  const sub = $('headSub');
  if (!on) {
    const t = thread.querySelector('.msg.typing'); if (t) t.remove();
    sub.classList.remove('typing'); $('headState').textContent = 'khushi + you';
    return;
  }
  if (thread.querySelector('.msg.typing')) return;
  const el = document.createElement('div');
  el.className = 'msg her typing';
  el.innerHTML = '<i></i><i></i><i></i>';
  thread.appendChild(el); pin();
  sub.classList.add('typing'); $('headState').textContent = 'typing…';
}

/* her message: the typing indicator IS the pause — the dots run for as long as
   the line would plausibly take to write */
async function her(text, typeMs, waitMs, react) {
  if (!state.fast) { typing(true); await sleep(typeMs || 900); typing(false); }
  const el = bubble('her', text);
  FX.recv();
  if (react) {
    await sleep(700);
    const r = document.createElement('span'); r.className = 'react'; r.textContent = react;
    el.appendChild(r); pin();
  }
  await sleep(waitMs != null ? waitMs : 700);
}

/* your message, with the delivered → read beat that makes a chat feel live */
async function you(text) {
  const el = bubble('you', text);
  FX.sent();
  const tick = document.createElement('span');
  tick.className = 'tick'; tick.textContent = 'delivered';
  el.appendChild(tick); pin(true);
  await sleep(800);
  tick.textContent = 'read ✓✓';
  await sleep(300);
}

const STICKER = { bow: 'sticker-bow', heart: 'sticker-heart', sparkle: 'sticker-sparkle',
                  star: 'sticker-star', flower: 'sticker-flower', peach: 'sticker-peach',
                  pillow: 'sticker-pillow' };

/* A photo step renders one of two ways:
     { "src": "photos/whatever.jpg" }  → the real photograph, filling the frame
     { "tint": […], "sticker": "…" }   → the drawn placeholder
   Both keep the flash bloom and grain on top, so swapping one for the other
   doesn't change how the frame sits in the conversation. */
function polaroid(p, forLightbox) {
  const el = document.createElement('figure');
  el.className = 'polaroid';
  el.style.setProperty('--tilt', (forLightbox ? -1.5 : (Math.random() * 5 - 3.2).toFixed(1)) + 'deg');

  const tint = p.tint || ['#2a0713', '#71183a'];
  const src = p.src ? p.src : '../assets/' + (STICKER[p.sticker] || 'sticker-heart') + '.png';
  /* Default to eager. Two reasons: a lazy image inserted below the fold of a
     nested scroll container doesn't reliably trigger, and a photo she "sends"
     should already be decoded when it lands — a frame that pops in a beat later
     breaks the illusion that she just sent it. There are only ever a handful. */
  const loading = p.eager === false ? 'lazy' : 'eager';

  el.innerHTML =
    '<div class="pola-img' + (p.src ? ' shot' : '') + '" style="--c1:' + escapeHTML(tint[0]) +
      ';--c2:' + escapeHTML(tint[1]) + '">' +
      '<img src="' + escapeHTML(src) + '" alt="' + escapeHTML(p.alt || '') +
        '" loading="' + loading + '" decoding="async" />' +
    '</div>' +
    '<figcaption class="pola-cap">' + escapeHTML(p.cap || '') + '</figcaption>';
  return el;
}

async function photo(p) {
  if (!state.fast) { typing(true); await sleep(900); typing(false); }
  const el = polaroid(p);
  thread.appendChild(el); pin();
  if (!state.fast) flash();
  el.addEventListener('click', () => {
    const lb = $('lightbox');
    lb.innerHTML = ''; lb.appendChild(polaroid(p, true)); lb.classList.add('on');
    FX.shutter();
  });
  await sleep(p.wait != null ? p.wait : 800);
}
$('lightbox').addEventListener('click', () => $('lightbox').classList.remove('on'));

/* the packing list, arriving the way someone actually spams a group chat */
async function pack() {
  const wrap = document.createElement('div');
  wrap.className = 'pack';
  thread.appendChild(wrap);
  const held = state.content.eggs.sticker_hold || [];
  let heldAt = 0;
  for (const item of state.content.packing) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pack-item';
    b.innerHTML = '<span class="e">' + escapeHTML(item.e) + '</span><b>' + escapeHTML(item.text) + '</b>';
    // long-press an item and she lets something slip
    let holdT;
    const start = () => { holdT = setTimeout(() => {
      toast(held[heldAt % held.length] || '🤫'); heldAt++; buzz(15); FX.tick();
    }, 550); };
    const stop = () => clearTimeout(holdT);
    b.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => b.addEventListener(e, stop));
    b.addEventListener('contextmenu', e => e.preventDefault());
    wrap.appendChild(b); pin();
    FX.tick();
    await sleep(230);
  }
  ev('details_revealed');
}

function choices(options) {
  return new Promise(resolve => {
    const box = $('choices');
    box.innerHTML = ''; box.hidden = false;
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'choice'; b.textContent = o.say;
      b.addEventListener('click', () => {
        box.hidden = true; box.innerHTML = '';
        resolve(o.say);
      });
      box.appendChild(b);
    });
    pin(true);
  });
}

async function doStep(s) {
  /* A replay must never stop and ask for something they've already given —
     re-render their old answer and move on. */
  if (state.fast) {
    if (s.t === 'choice') { bubble('you', state.answers._reply || s.options[0].say); return; }
    if (s.t === 'pinky' || s.t === 'invite') return;
  }
  switch (s.t) {
    case 'system': system(line(s.text)); await sleep(s.wait || 700); break;
    case 'her':    await her(line(s.text), s.typing, s.wait, s.react); break;
    case 'big':    bubble('her', line(s.text), 'big'); FX.recv(); await sleep(s.wait || 800); break;
    case 'photo':  await photo(s); break;
    case 'pack':   await pack(); await sleep(s.wait || 800); break;
    case 'choice': {
      const said = await choices(s.options);
      state.answers._reply = said; save();
      await you(said); break;
    }
    case 'pinky':
      await pinkyPromise();
      // you answer her before she carries on — the promise was a question
      await you(state.content.pinky_reply || 'i promise!!!');
      break;
    case 'invite': await showInvite(false); break;
  }
}

async function runFrom(i, stopAt) {
  const steps = state.content.chat;
  for (; i < steps.length; i++) {
    if (stopAt != null && i >= stopAt) return;
    state.step = i;
    await doStep(steps[i]);
    if (steps[i].t === 'invite') return;     // the invitation takes over from here
    state.step = i + 1; save();
  }
}

/* ============================================================================
   THE PINKY PROMISE
   ============================================================================ */
const HOLD_MS = 3000;
const STAGES = [
  { at: 0,   label: 'promising…' },
  { at: .30, label: 'no screenshots…' },
  { at: .70, label: 'no spoilers…' },
  // blank, not 'SEALED 💋' — the button itself says that on completion, and
  // showing it twice, one line under the other, read as a glitch
  { at: .95, label: '' },
];

function pinkyPromise() {
  return new Promise(resolve => {
    ev('pinky_promise_started');
    const sheet = $('pinky'), btn = $('holdBtn'), fill = $('holdFill'),
          label = $('holdState'), vid = $('pinkyArt');
    reveal(sheet);

    let raf = null, t0 = 0, p = 0, done = false, stage = -1;

    function paint(v) {
      fill.style.width = (v * 100) + '%';
      /* Scrub the clip to the hold: 0 = hands apart, end = pinkies entangled with the
         heart glowing (the heart is baked into the video). Seek a hair short of the
         very end so the final frame renders rather than looping to the start. */
      if (vid && isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.min(vid.duration - 0.05, v * vid.duration);
      }
      let s = 0; for (let i = 0; i < STAGES.length; i++) if (v >= STAGES[i].at) s = i;
      if (s !== stage) {
        stage = s;
        // a blank stage keeps the line's height, so nothing jumps when it clears
        label.innerHTML = STAGES[s].label || '&nbsp;';
        buzz(12); FX.tick();
      }
    }
    function frame(now) {
      if (done) return;
      p = Math.min(1, (now - t0) / HOLD_MS);
      paint(p);
      if (p >= 1) return complete();
      raf = requestAnimationFrame(frame);
    }
    function start(e) {
      e.preventDefault();
      if (done) return;
      FX.unlock(); buzz(20);
      // iOS renders seeks on a paused <video> only after it has played once; prime it
      // within this pointer gesture so the scrub shows frames from the first hold.
      if (vid && !vid._primed) { vid._primed = true; try { vid.play().then(() => vid.pause()).catch(() => {}); } catch (_) {} }
      t0 = performance.now() - p * HOLD_MS;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (done) return;
      cancelAnimationFrame(raf);
      // it eases back rather than snapping — letting go should feel like a loss
      const from = p, t = performance.now();
      (function back(now) {
        if (done) return;
        const k = Math.min(1, ((now || t) - t) / 420);
        p = from * (1 - k); paint(p);
        if (k < 1) requestAnimationFrame(back); else { stage = -1; label.innerHTML = '&nbsp;'; }
      })(t);
    }
    function complete() {
      done = true;
      paint(1);
      btn.classList.add('done');
      $('holdLabel').textContent = 'SEALED 💋';
      flash(); FX.sealed(); buzz([20, 40, 20]);
      const k = $('kiss'); k.classList.add('on');
      confetti();
      state.promised = true; save();
      ev('pinky_promise_completed');
      setTimeout(() => {
        sheet.classList.remove('vis');
        setTimeout(() => { sheet.classList.remove('on'); resolve(); }, 480);
      }, 1500);
    }

    btn.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => btn.addEventListener(e, stop));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    // keyboard: hold space or enter
    btn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') start(e); });
    btn.addEventListener('keyup', stop);
  });
}

function confetti() {
  const bits = ['🎀', '💋', '✨', '♡', '★', '💅'];
  for (let i = 0; i < 22; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.textContent = bits[i % bits.length];
    c.style.left = (Math.random() * 92 + 4) + '%';
    c.style.top = (Math.random() * 24 + 8) + '%';
    c.style.animationDelay = (Math.random() * .5).toFixed(2) + 's';
    c.style.fontSize = (Math.random() * .8 + .8).toFixed(2) + 'rem';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }
}

/* ============================================================================
   THE INVITATION
   ============================================================================ */
function buildInviteCard() {
  const c = state.content, iv = c.invite, e = c.event;
  const to = state.guest ? '<p class="card-to">for ' + escapeHTML((state.guest.first || '').toLowerCase()) + ' ♡</p>' : '';
  $('inviteCard').innerHTML =
    to +
    // through line() as well, so a creator's card doesn't say BESTIES ONLY
    '<p class="card-eyebrow">' + escapeHTML(line(iv.eyebrow)) + '</p>' +
    // the real logo, not a typographic stand-in for it
    '<h1 class="card-name"><img class="card-logo" src="../assets/logo.png" alt="' +
      escapeHTML([iv.line1, iv.line2, iv.line3].join(' ')) + '" /></h1>' +
    '<div class="card-rule"></div>' +
    '<p class="card-dates">' + escapeHTML(e.dates_line) + '</p>' +
    '<p class="card-year">' + escapeHTML(e.dates_year) + '</p>' +
    '<p class="card-loc">' + escapeHTML(e.location_teaser) + '</p>' +
    '<p class="card-quote">' + escapeHTML(iv.quote) + '</p>' +
    '<span class="card-seal">💋</span>';
  $('rsvpBtn').textContent = iv.cta_rsvp;
}

async function showInvite(alreadyRsvped) {
  reveal($('invite'));
  if (!state.fast) flash();
  if (alreadyRsvped || state.rsvped) markRsvped();
}

function hideInvite() {
  const sheet = $('invite');
  sheet.classList.remove('vis');
  setTimeout(() => sheet.classList.remove('on'), 480);
}

function markRsvped() {
  state.rsvped = true; save();
  $('rsvpBtn').hidden = true;
  const d = $('rsvpDone');
  d.hidden = false;
  // one editable line, not a sentence stitched together out of two fields
  /* through line() too, so a tier can have its own "what happens next" —
     "more details in 48 hours" is not what someone picked out of the
     applications needs to read. */
  d.textContent = line(state.content.rsvp.confirmed || "you're on the list");
  /* Check-in and the arcade only exist once they've said they're coming: an ID
     upload before an RSVP is the wrong order to ask in. This runs for a
     returning guest too, since restoring a saved RSVP comes through here. */
  const after = $('afterRsvp');
  if (after) after.hidden = false;
}

$('rsvpBtn').addEventListener('click', () => {
  ev('rsvp_started');
  hideInvite();
  setTimeout(runRSVP, 520);
});

/* ============================================================================
   RSVP — one tap, still inside the conversation.

   Deliberately NOT a questionnaire: names, numbers and dietary requirements all
   arrive through the real group chat she adds them to afterwards. The invite's
   job is to end on a high, not to interrogate someone at 2am.
   ============================================================================ */
async function runRSVP() {
  const r = state.content.rsvp;
  // tapping the button is you saying it — so it lands as your message first
  if (r.reply) await you(r.reply);
  for (const l of r.intro) await her(line(l), 800, 700);
  for (const l of r.outro) await her(line(l), 800, 700);

  state.rsvped = true; save();
  try {
    localStorage.setItem('ssp-besties-rsvp', JSON.stringify({
      guest_code: state.guest ? (inviteCode() || '') : '',
      at: new Date().toISOString(),
    }));
  } catch (e) {}
  ev('rsvp_completed');

  await sleep(700);
  markRsvped();
  showInvite(true);
}

/* ============================================================================
   THE SMALL PRINT — sound, sparkles, easter eggs
   ============================================================================ */
/* The ♪ has three states, not two. "Waiting" is the one that matters: a browser
   won't start audio without a gesture, and a device that has already been let in
   returns with no gesture at all — the conversation just begins. So the opening
   messages were always silent with nothing on screen admitting it. It pulses
   until audio is genuinely running. */
/* Read the state on pointerdown, not on click. The window-level unlock listener
   also fires on pointerdown, so by the time click runs audio is already running
   and the tap that was meant to TURN SOUND ON would mute it instead. An element
   handler runs before the window one, which is what makes this correct. */
let soundWasWaiting = false;
$('sound').addEventListener('pointerdown', () => {
  soundWasWaiting = !FX.muted() && !FX.running();
});
$('sound').addEventListener('click', () => {
  // the tap that started audio shouldn't also toggle it off
  if (soundWasWaiting) { soundWasWaiting = false; FX.unlock(); FX.recv(); return; }
  FX.setMuted(!FX.muted());
  if (!FX.muted()) FX.recv();
});
paintSound();

function sparkles() {
  const spots = [[8, 18], [88, 12], [16, 76], [92, 68], [50, 6], [72, 88]];
  spots.forEach(([x, y], i) => {
    const s = document.createElement('span');
    s.className = 'spark'; s.textContent = i % 2 ? '✦' : '✧';
    s.style.left = x + '%'; s.style.top = y + '%';
    s.style.animationDelay = (i * 1.15).toFixed(2) + 's';
    document.body.appendChild(s);
  });
}

let tapCount = 0, tapT;
$('avatar').addEventListener('click', () => {
  tapCount++; clearTimeout(tapT); tapT = setTimeout(() => { tapCount = 0; }, 1200);
  if (tapCount >= 5) { tapCount = 0; toast(state.content?.eggs.avatar_taps || 'stop stalking me 😭'); buzz(20); }
});
$('bestiesTag').addEventListener('click', () => {
  toast(state.content?.eggs.besties_tap || 'seriously. besties only.');
});

/* Screenshots can't be blocked, and pretending otherwise would be a lie. What
   CAN be detected is the desktop shortcut — so on desktop only, she notices. */
addEventListener('keydown', (e) => {
  const mac = (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key));
  if (e.key === 'PrintScreen' || mac) {
    flash(false);
    toast(state.content?.eggs.screenshot || '👀 we saw that');
  }
});

// tap the thread to hurry her along — nobody should feel stuck waiting on a pause
thread.addEventListener('click', hurry);

boot();
})();
