/* ============================================================================
   /kk — THE PREBUZZ SCRIPT, on the slumber page's own chat engine.
   Same room, same CRT, same drafted replies and sounds. After the two opening
   turns she asks whether you applied for the secret slumber party:
     · yes → the screen becomes the secret slumber party group, locked; the
       number you applied with is the password. In: her lines, three view-once
       photos (30s each, inside the chat), the coupon, the hamper. Wrong number:
       back to her DM, and on as a "no".
     · no  → she'll tell you before it goes live: your number, your email.
   Nothing only an applicant may see is in this file — the group's lines, the
   photos and the coupon arrive from /functions/v1/prebuzz after the phone has
   matched a row in `applications`. Copy lives in public.prebuzz_settings.
   ========================================================================== */
const KK_API = ((window.SLUMBER_CONFIG||{}).prebuzzUrl) ||
  (((window.SLUMBER_CONFIG||{}).supabaseUrl||'').replace(/\/$/,'') + '/functions/v1/prebuzz');
const KK_PHOTO_SECONDS = 30;
let kkRun = 0, kkPending = null, kkDmHtml = null;
const kkSleep = ms => new Promise(r => setTimeout(r, ms));
const kkAlive = run => run === kkRun && inside;   // leaving the screen abandons the run
function kkToken(v){
  try{ if(v === undefined) return localStorage.getItem('ssp-pb'); if(v) localStorage.setItem('ssp-pb', v); else localStorage.removeItem('ssp-pb'); }
  catch(e){ return null; }
}
async function kkCall(body, attempt = 0){
  const cfg = window.SLUMBER_CONFIG || {};
  if(!cfg.supabaseAnonKey) return { ok:false };
  try{
    const r = await fetch(KK_API, { method:'POST',
      headers:{ 'Content-Type':'application/json', apikey:cfg.supabaseAnonKey, Authorization:'Bearer '+cfg.supabaseAnonKey },
      body: JSON.stringify(Object.assign({ visitor_id:visitorId() }, body)) });
    if(r.status === 429) return { ok:false, rate:true };
    if(r.status === 401) return { ok:false, session:true };
    if(r.status >= 500 && attempt === 0){ await kkSleep(900); return kkCall(body, 1); }
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : Object.assign({ ok:false }, j);
  }catch(e){
    if(attempt === 0){ await kkSleep(900); return kkCall(body, 1); }
    return { ok:false };
  }
}

/* the extra sounds this script needs — the chat's own (nokia, ding, swoosh, ticks)
   come from CHATFX. Muted whenever the chat is. */
const KKFX = (function(){
  let ctx = null, noise = null;
  ['pointerdown','touchend','keydown','click'].forEach(ev => addEventListener(ev, () => {
    try{ ctx = ctx || new (window.AudioContext||window.webkitAudioContext)(); if(ctx.state !== 'running') ctx.resume(); }catch(e){}
  }, { passive:true }));
  const ok = () => ctx && ctx.state === 'running' && !(CHATFX.muted && CHATFX.muted());
  function nb(){ if(!noise){ noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1; } return noise; }
  function tone(f, at, dur, type, peak){ const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, at); o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(peak, at+.008); g.gain.exponentialRampToValueAtTime(.0001, at+dur); o.start(at); o.stop(at+dur+.02); }
  function hiss(at, dur, type, from, to, peak, q){ const s = ctx.createBufferSource(); s.buffer = nb(); const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q||1;
    f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at+dur); const g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(peak, at+.01); g.gain.exponentialRampToValueAtTime(.0001, at+dur); s.start(at); s.stop(at+dur+.02); }
  const play = fn => { try{ if(ok()) fn(ctx.currentTime + .01); }catch(e){} };
  return {
    // a lock clunks open / shut
    unlock: () => play(t => { hiss(t, .06, 'bandpass', 900, 600, .12, 3); tone(330, t+.05, .12, 'square', .04); tone(660, t+.14, .18, 'triangle', .05); }),
    denied: () => play(t => { tone(220, t, .16, 'square', .05); tone(165, t+.18, .26, 'square', .05); }),
    // you're in / the coupon lands
    chime:  () => play(t => { [1046.5,1318.5,1568,2093].forEach((f,i) => tone(f, t+i*.08, .5, 'sine', .05)); }),
    shutter:() => play(t => { hiss(t, .05, 'highpass', 1800, 1800, .14); hiss(t+.09, .08, 'bandpass', 1200, 900, .1, 2); }),
    poof:   () => play(t => { hiss(t, .45, 'lowpass', 2400, 180, .06); tone(660, t, .3, 'sine', .03); }),
  };
})();

/* her lines, each with its own typing beat. Resolves when the last has landed —
   or never, if the run was abandoned (they left the screen). */
function kkHer(run, lines){
  lines = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  return new Promise(res => {
    (function next(n){
      if(!kkAlive(run)) return;
      if(n >= lines.length){ setTimeout(() => { if(kkAlive(run)) res(); }, 380); return; }
      addTyping();
      setTimeout(() => {
        if(!kkAlive(run)) return;
        clearTyping(); addBubble('her', lines[n]);
        next(n+1);
      }, n === 0 ? 1100 : Math.min(1500, 700 + String(lines[n]).length * 12));
    })(0);
  });
}
const kkLines = list => (list || []).map(l => typeof l === 'string' ? l : (l && l.text)).filter(Boolean);
function kkSys(text){ ctBody.insertAdjacentHTML('beforeend', '<div class="msg sys">'+esc(text)+'</div>'); pinChat(true); }
/* one question, asked through the page's own compose row (chips, +91, email…) */
function kkAsk(run, q){
  return new Promise(res => {
    if(!kkAlive(run)) return;
    APPLY_Q.length = 0; APPLY_Q.push(q);
    qAns = {}; qRaw = {}; qMarks = []; qIndex = 0;
    kkPending = () => { if(kkAlive(run)) res(qAns[q.name]); };
    readyAnswer(q);
  });
}
const kkDigits = v => String(v || '').replace(/\D/g, '').slice(-10);

/* ---- the group: same card, a different room ------------------------------- */
const kkCard = document.getElementById('chatThread');
const kkName = kkCard.querySelector('.ct-id b'), kkSub = kkCard.querySelector('.ct-id i');
function kkEnterGroup(members){
  if(!kkCard.classList.contains('kk-group')){
    kkDmHtml = ctBody.innerHTML;
    ctBody.innerHTML = '';
    kkCard.classList.add('kk-group');
    kkName.textContent = 'the secret slumber party 🔒';
    kkSub.insertAdjacentHTML('afterbegin', '<span class="kk-sub"></span>');
  }
  kkSub.querySelector('.kk-sub').textContent = members ? 'khushi + you + the ones from the start · ' : 'locked · ';
}
function kkLeaveGroup(){
  if(!kkCard.classList.contains('kk-group')) return;
  kkCard.classList.remove('kk-group');
  kkName.textContent = 'khushi';
  const s = kkSub.querySelector('.kk-sub'); if(s) s.remove();
  if(kkDmHtml != null){ ctBody.innerHTML = kkDmHtml; kkDmHtml = null; pinChat(true); }
}

async function kkFlow(run){
  // already let in on this phone → the group's waiting
  if(kkToken()){
    addTyping();
    const me = await kkCall({ action:'me', token:kkToken() });
    clearTyping();
    if(!kkAlive(run)) return;
    if(me.ok && me.chat){
      await kkHer(run, ['oh wait, it’s you 😌', 'the group’s waiting ♡']);
      await kkAsk(run, { name:'open', type:'choice', choices:['open the secret slumber party 🔒'] });
      KKFX.unlock();
      kkEnterGroup(true);
      return kkGroup(run, me.chat, true);
    }
    if(me.session) kkToken(null);
  }

  await kkHer(run, 'unless… you’d applied for the secret slumber party? 👀');
  const applied = await kkAsk(run, { name:'applied', type:'choice', choices:['yes 🎀', 'no'] });
  if(applied === 'no'){ ga('prebuzz_says_no'); return kkSignup(run); }

  ga('prebuzz_says_yes');
  await kkHer(run, 'ooh 👀 then come with me');
  await kkSleep(450); if(!kkAlive(run)) return;
  kkEnterGroup(false);
  kkSys('🔒 this group is locked');
  await kkHer(run, ['only for the ones who were there from the start 🎀', 'the password is the number you applied with 👇']);

  let res, phone;
  for(;;){
    phone = kkDigits(await kkAsk(run, { name:'phone', type:'tel', ph:'98765 43210' }));
    addTyping();
    res = await kkCall({ action:'check', phone });
    clearTyping();
    if(!kkAlive(run)) return;
    if(res.ok) break;
    await kkHer(run, res.rate ? 'too many tries — give it a little while 🙏' : "ugh, my phone's acting up. try that again?");
  }
  if(res.member){
    kkToken(res.token);
    ga('prebuzz_member_unlocked');
    KKFX.unlock();
    kkEnterGroup(true);
    return kkGroup(run, res.chat, false, phone);
  }

  ga('prebuzz_member_miss');
  KKFX.denied();
  kkSys('wrong password 🔒');
  await kkSleep(1400); if(!kkAlive(run)) return;
  kkLeaveGroup();
  await kkHer(run, "hmm, couldn't find you on the list 🥺");
  return kkSignup(run, phone);
}

/* ---- inside the group — everything in `chat` came from the server ---------- */
async function kkGroup(run, chat, returning, phone){
  if(returning){
    kkSys('welcome back to the secret slumber party 🔒');
    await kkHer(run, 'you again 😌 your stuff is right where you left it');
  }else{
    kkSys('you’re in 🔒 welcome to the secret slumber party');
    KKFX.chime();
    await kkSleep(600);
    await kkHer(run, kkLines(chat.lines));
  }
  // the photos, one at a time: the next only arrives once you've opened this one
  const photos = chat.photos || [];
  for(let i = 0; i < photos.length; i++){
    if(!returning && chat.photo_lines && chat.photo_lines[i]) await kkHer(run, chat.photo_lines[i]);
    await kkOnce(run, i, photos[i].viewed);
    if(!kkAlive(run)) return;
  }
  if(!returning) await kkHer(run, kkLines(chat.after_lines));
  if(chat.coupon){
    if(!returning && chat.coupon_line) await kkHer(run, chat.coupon_line);
    kkCoupon(chat, phone);
    await kkSleep(900);
  }
  if(chat.hamper_line) await kkHamper(run, chat, returning);
  if(!kkAlive(run)) return;
  await kkHer(run, 'till then…');
  showArcadeCta();
}

/* a view-once photo: a bubble you tap, not a picture. Resolves once it's been
   looked at (or already had been). */
function kkOnce(run, i, viewed){
  return new Promise(resolve => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kk-once';
    b.innerHTML = '<span class="ring">1</span><span>photo<small></small></span>';
    const sub = b.querySelector('small');
    const opened = () => { b.disabled = true; b.querySelector('.ring').textContent = '✓'; sub.textContent = 'opened'; };
    ctBody.appendChild(b); pinChat(true); CHATFX.recv();
    if(viewed){ opened(); return resolve(); }
    sub.textContent = 'view once · tap to open';
    b.onclick = async () => {
      b.disabled = true; sub.textContent = 'opening…';
      const r = await kkCall({ action:'photo', token:kkToken(), idx:i });
      if(r.ok && r.url){ ga('prebuzz_photo_opened', { idx:i }); await kkView(r.url); opened(); return resolve(); }
      if(r.ok && r.seen){ opened(); return resolve(); }
      if(r.session){ kkToken(null); sub.textContent = 'timed out — reload and type your number again'; return; }
      b.disabled = false; sub.textContent = "didn't load — tap to try again";
    };
  });
}
/* opens over the chat itself — never a new tab — and closes on its own after
   KK_PHOTO_SECONDS; the image leaves the page with it */
function kkView(url){
  return new Promise(resolve => {
    const v = document.createElement('div');
    v.className = 'kk-viewer';
    v.innerHTML = '<div class="kk-bar"><span>view once · <b>' + KK_PHOTO_SECONDS + '</b>s</span><button type="button">close</button></div>' +
      '<div class="kk-time"><i></i></div><div class="kk-pic"><p>loading…</p></div>';
    v.addEventListener('contextmenu', e => e.preventDefault());
    const img = new Image(); img.alt = ''; img.draggable = false;
    const bar = v.querySelector('.kk-time i'), left = v.querySelector('.kk-bar b');
    let timer = 0, done = false;
    const finish = () => { if(done) return; done = true; clearInterval(timer); img.src = ''; v.remove(); KKFX.poof(); resolve(); };
    img.onload = () => {
      v.querySelector('.kk-pic').replaceChildren(img);
      KKFX.shutter();
      const fl = document.createElement('div'); fl.className = 'kk-flash'; v.appendChild(fl); setTimeout(() => fl.remove(), 500);
      const t0 = Date.now();
      timer = setInterval(() => {
        const rem = Math.max(0, KK_PHOTO_SECONDS - (Date.now() - t0) / 1000);
        left.textContent = Math.ceil(rem); bar.style.transform = 'scaleX(' + (rem / KK_PHOTO_SECONDS) + ')';
        if(rem <= 0) finish();
      }, 200);
    };
    img.onerror = finish;
    img.src = url;
    v.querySelector('button').onclick = finish;
    kkCard.appendChild(v);
  });
}

function kkCoupon(chat, phone){
  const c = document.createElement('div');
  c.className = 'kk-card' + (chat.coupon_used ? ' used' : '');
  c.innerHTML = '<small>early access · slumber party only</small><div class="off"></div>' +
    '<div class="code"><b></b><button type="button">copy</button></div><div class="bind"></div>';
  c.querySelector('.off').textContent = chat.coupon_used ? 'already used ♡' : (chat.discount || 'just for you');
  c.querySelector('.code b').textContent = chat.coupon;
  c.querySelector('.bind').textContent = 'only works with ' + (phone ? 'your number ••' + phone.slice(-4) : 'the number you applied with') + ' · once';
  const btn = c.querySelector('button');
  btn.onclick = async () => {
    try{ await navigator.clipboard.writeText(chat.coupon); btn.textContent = 'copied ♡'; ga('prebuzz_coupon_copied'); }
    catch(e){ btn.textContent = 'hold to copy'; }
  };
  ctBody.appendChild(c); pinChat(true); KKFX.chime();
}

async function kkHamper(run, chat, returning){
  if(chat.hamper === 'won') return kkHer(run, "and you WON the hamper 🎀 i'll be in touch");
  if(chat.hamper === 'entered') return kkHer(run, "you're in the hamper draw 🎀 fingers crossed");
  if(chat.hamper === 'lost') return;
  await kkHer(run, returning ? 'still want in on the hamper? paste your post link 🎀' : chat.hamper_line);
  for(;;){
    const raw = await kkAsk(run, { name:'post', type:'text', ph:'instagram.com/p/…', optional:true });
    if(!raw) return kkHer(run, 'no stress — come back anytime ♡');
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    addTyping();
    const r = await kkCall({ action:'hamper', token:kkToken(), url });
    clearTyping();
    if(!kkAlive(run)) return;
    if(r.ok){ ga('prebuzz_hamper_entered'); return kkHer(run, "you're in the draw 🎀 i'll pick a few of you myself"); }
    if(r.session){ kkToken(null); return kkHer(run, 'this chat timed out — reload and type your number again 🙏'); }
    await kkHer(run, r.error === 'url' ? 'paste the link to your post (instagram, threads, x…) 🔗' : "ugh, didn't go through. try again?");
  }
}

/* ---- "no", or a number that isn't on the list ------------------------------ */
async function kkSignup(run, knownPhone){
  ga('prebuzz_lead_started');
  await kkHer(run, [knownPhone ? 'no worries ♡' : "you hadn't? no worries ♡", "i'll let you know before it goes live"]);
  let phone = knownPhone;
  if(phone){
    await kkHer(run, "i'll text you on +91 " + phone + ' ♡');
  }else{
    await kkHer(run, 'drop your number?');
    phone = kkDigits(await kkAsk(run, { name:'phone', type:'tel', ph:'98765 43210' }));
  }
  await kkHer(run, 'and your email ID?');
  const email = String(await kkAsk(run, { name:'email', type:'email', ph:'you@email.com' })).toLowerCase();

  const body = { action:'lead', phone, email, source:trafficSource(), tz:localTz(), user_agent:navigator.userAgent };
  addTyping();                                  // her typing is the loader while it saves
  let r = await kkCall(body);
  while(!r.ok && kkAlive(run)){ await kkSleep(r.rate ? 4000 : 1500); r = await kkCall(body); }
  clearTyping();
  if(!kkAlive(run)) return;
  ga('prebuzz_lead_submitted'); ga('generate_lead', { ssp_vid:visitorId() });
  await kkHer(run, ["done ♡ you'll hear it from me first", 'you heard nothing 🤫', 'till then…']);
  showArcadeCta();
}
