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
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('ksp-snd') === 'off'; } catch (e) {}
  function unlock() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume();
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
  }
  // iOS re-suspends the context whenever the page idles, so re-arm on every gesture
  ['pointerdown', 'touchend', 'keydown'].forEach(e => addEventListener(e, unlock, { passive: true }));
  const ok = () => ctx && ctx.state === 'running' && !muted;
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
  return {
    muted: () => muted,
    setMuted(m) { muted = !!m; try { localStorage.setItem('ksp-snd', m ? 'off' : 'on'); } catch (e) {} if (!m) unlock(); },
    unlock,
    recv()  { if (!ok()) return; const t = ctx.currentTime; tone(784, t, .1, 'sine', .045); tone(1046, t + .09, .16, 'sine', .05); },
    sent()  { if (!ok()) return; const t = ctx.currentTime; tone(1174, t, .07, 'triangle', .04); },
    tick()  { if (!ok()) return; tone(2200, ctx.currentTime, .012, 'square', .008); },
    shutter() { if (!ok()) return; noise(.05, .16, 1800); setTimeout(() => { if (ok()) noise(.09, .1, 700); }, 60); },
    lock()  { if (!ok()) return; const t = ctx.currentTime; tone(320, t, .06, 'square', .05); tone(880, t + .08, .22, 'sine', .05); },
    sealed(){ if (!ok()) return; const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .09, .32, 'sine', .05)); },
  };
})();
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

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
  if (!h || h.startsWith('p=')) return null;   // #p= is a carried password, not a guest
  return h;
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

  /* A link can carry the password: /besties/?p=PINKYPROMISE opens straight
     through, so one WhatsApp message is the whole invitation. It's stripped from
     the address bar the moment it's used, so it doesn't sit in history or in a
     screenshot of the URL. Nothing on this page reports URLs to a third party,
     and <meta name="referrer" content="no-referrer"> stops the font request from
     carrying it off-site. Obviously anyone forwarding that link forwards the
     password with it — which is already true of the message it's pasted into. */
  const carried = new URLSearchParams(location.search).get('p')
               || (location.hash.startsWith('#p=') ? decodeURIComponent(location.hash.slice(3)) : null);
  if (carried) {
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    try {
      state.content = await unsealBlob(window.BESTIES_SEALED, carried.trim().toUpperCase());
      state.key = carried.trim().toUpperCase();
      ev('password_success', { via: 'link' });
      return enter(false);
    } catch (e) { /* stale link — fall through and just ask for it */ }
  }

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

function greetGuest(g) {
  $('gateLocked').hidden = true;
  $('gateGreet').hidden = false;
  $('greetName').innerHTML = 'is that <em style="font-style:normal;color:var(--pink)">' +
    escapeHTML((g.first || '').toLowerCase()) + '</em>? 👀';
  $('greetOpen').addEventListener('click', async () => {
    FX.unlock();
    try {
      state.content = await unsealBlob(window.BESTIES_SEALED, g.pass);
      state.key = g.pass;
      ev('password_success', { via: 'personal_link' });
      enter(false);
    } catch (e) { toast('hmm, this link is out of date'); }
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
    ev('password_success', { via: 'password' });
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
  return (v && v[text]) || text;
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
  // the first photo is on screen within moments of unlocking; the rest can wait
  const loading = p.eager ? 'eager' : 'lazy';

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
    case 'pinky':  await pinkyPromise(); break;
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
  { at: .95, label: 'SEALED 💋' },
];

function pinkyPromise() {
  return new Promise(resolve => {
    ev('pinky_promise_started');
    const sheet = $('pinky'), btn = $('holdBtn'), fill = $('holdFill'),
          label = $('holdState'), hL = $('handL'), hR = $('handR'),
          glow = $('hookGlow'), stars = $('hookStars');
    sheet.classList.add('on');
    requestAnimationFrame(() => sheet.classList.add('vis'));

    let raf = null, t0 = 0, p = 0, done = false, stage = -1;

    function paint(v) {
      fill.style.width = (v * 100) + '%';
      // they start apart and close on each other; at v=1 the two fingers interlock
      hL.setAttribute('transform', 'translate(' + (-46 * (1 - v)).toFixed(1) + ' 0)');
      hR.setAttribute('transform', 'translate(' + (46 * (1 - v)).toFixed(1) + ' 0)');
      glow.setAttribute('opacity', v > .82 ? ((v - .82) / .18).toFixed(2) : '0');
      stars.setAttribute('opacity', v > .9 ? ((v - .9) / .1).toFixed(2) : '0');
      let s = 0; for (let i = 0; i < STAGES.length; i++) if (v >= STAGES[i].at) s = i;
      if (s !== stage) { stage = s; label.textContent = STAGES[s].label; buzz(12); FX.tick(); }
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
    '<p class="card-eyebrow">' + escapeHTML(iv.eyebrow) + '</p>' +
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
  $('calBtn').textContent = iv.cta_cal;
}

async function showInvite(alreadyRsvped) {
  const sheet = $('invite');
  sheet.classList.add('on');
  requestAnimationFrame(() => sheet.classList.add('vis'));
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
  d.textContent = "you're on the list ✓  ·  " + (state.content.event.location_exact || '');
}

$('rsvpBtn').addEventListener('click', () => {
  ev('rsvp_started');
  hideInvite();
  setTimeout(runRSVP, 520);
});

/* ---- add to calendar: a real .ics, generated in the browser ---- */
const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
$('calBtn').addEventListener('click', () => {
  const e = state.content.event;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//secret slumber party//EN', 'BEGIN:VEVENT',
    'UID:' + Date.now() + '@secretslumberparty.com',
    'DTSTAMP:' + icsTime(new Date().toISOString()),
    'DTSTART:' + icsTime(e.start),
    'DTEND:' + icsTime(e.end),
    'SUMMARY:' + e.calendar_title,
    'LOCATION:' + e.location_teaser,
    'DESCRIPTION:' + String(e.calendar_note).replace(/\n/g, '\\n'),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'secret-slumber-party.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  ev('calendar_added');
  toast('saved to your calendar ♡');
});

/* ============================================================================
   RSVP — one tap, still inside the conversation.

   Deliberately NOT a questionnaire: names, numbers and dietary requirements all
   arrive through the real group chat she adds them to afterwards. The invite's
   job is to end on a high, not to interrogate someone at 2am.
   ============================================================================ */
async function runRSVP() {
  const r = state.content.rsvp;
  for (const line of r.intro) await her(line, 800, 700);
  for (const line of r.outro) await her(line, 800, 700);

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
$('sound').classList.toggle('off', FX.muted());
$('sound').addEventListener('click', () => {
  FX.setMuted(!FX.muted());
  $('sound').classList.toggle('off', FX.muted());
  if (!FX.muted()) FX.recv();
});

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
