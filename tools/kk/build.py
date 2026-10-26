"""Build kk/index.html — the prebuzz page — as a fork of the slumber homepage.

/kk IS the homepage: same veil, gate, CRT room, drafted replies, sounds and
arcade. Only the conversation changes, and the slumber application's data
pipes (Google Sheet mirror, drafts, the visits funnel) are switched off so a
prebuzz answer can never land in them. Re-run after editing index.html or
tools/kk/prebuzz.{js,css}:

    python3 tools/kk/build.py
"""
import re, sys
SITE = '/Users/sameeprehlan/Documents/Projects/slumber/site'
s = open(f'{SITE}/index.html').read()

def sub(old, new, count=1):
    global s
    if old not in s:
        sys.exit('MISSING: ' + old[:80])
    s = s.replace(old, new, count)

# ---------------------------------------------------------------- head
a = s.index('<!-- PREBUZZ MODE.'); b = s.index('</script>', a) + len('</script>\n')
s = s[:a] + s[b:]
sub('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n<!-- /kk is a fork of the slumber homepage: every relative path (assets, the arcade\'s\n     own sprites) resolves from the site root, exactly as it does on / -->\n<base href="/" />')
s = re.sub(r'<title>.*?</title>', "<title>khushi has a secret 🤫</title>", s, count=1)
s = re.sub(r'<meta name="robots" content="[^"]*" />', '<meta name="robots" content="noindex, nofollow" />', s, count=1)
s = re.sub(r'<link rel="canonical"[^>]*>\n', '', s, count=1)
# the homepage's search-engine card describes the homepage, not this hidden page
s = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', '', s, flags=re.S)
sub("fbq('trackCustom','slumberview');", "fbq('trackCustom','prebuzzview');")

# ---------------------------------------------------------------- the teaser + gate
sub('<span class="ci-prev">i have a secret to share 🤫</span>', '<span class="ci-prev">something\'s cooking 🤫</span>')
# no application clock on this gate
s = re.sub(r'\s*<span class="countdown" id="countdown"[^>]*></span>', '', s, count=1)
sub('<p id="gateAsk">wanna join?</p>', '<p id="gateAsk">psst… something\'s cooking</p>')
# no application deadline here: an invalid date blanks the countdown and never redirects to /late
sub("const FORM_CLOSES = new Date((window.SLUMBER_CONFIG || {}).formCloses);",
    "const FORM_CLOSES = new Date(NaN);   // /kk: no deadline — the countdown stays blank, nobody is sent to /late")

# ---------------------------------------------------------------- the DM's opening turns
a = s.index('const CHAT=['); b = s.index('];', a) + 2
s = s[:a] + """const CHAT=[
  { her:"psst 🤫 something's cooking",         draft:'ooh what is it??' },
  { her:"i can't tell you what yettt 🤭",       draft:'pleaseee 🥺' }
];""" + s[b:]

# ---------------------------------------------------------------- keep slumber data clean
# funnel: GA only, prefixed — never the slumber `visits` table
a = s.index('function track(step){'); b = s.index("track('landed');", a)
s = s[:a] + """function track(step){
  // /kk reports to GA as prebuzz_<step>. It never posts to the slumber funnel (`visits`).
  ga('prebuzz_'+step, { funnel_step:step, ssp_vid:visitorId() });
}
""" + s[b:]
# answers never go to the slumber drafts table or the application Google Sheet
sub("function saveDraft(converted){", "function saveDraft(converted){\n  return;   // /kk: prebuzz answers are not slumber application drafts")
sub("function sendPartial(){", "function sendPartial(){\n  return;   // /kk: nothing here belongs in the application sheet")

# ---------------------------------------------------------------- hand the questions to the prebuzz script
sub("function askQuestion(i, replay){", """function askQuestion(i, replay){
  // /kk asks one question at a time and waits on the answer (see kkAsk)
  if(kkPending){ const r=kkPending; kkPending=null; qIndex=-1; r(); return; }""")
a = s.index('function startApply(){'); b = s.index('// `replay` re-asks a question', a)
s = s[:a] + """function startApply(){                       // called by renderChat once the opening turns are sent
  track('started');
  const run = ++kkRun; kkPending = null;
  kkLeaveGroup();
  kkFlow(run);
}
""" + s[b:]

# ---------------------------------------------------------------- the prebuzz script
KK_JS = open(f'{SITE}/tools/kk/prebuzz.js').read()
sub("// her sign-off, sent line by line like everything else, then the arcade unlocks", KK_JS + "\n// her sign-off, sent line by line like everything else, then the arcade unlocks")

KK_CSS = open(f'{SITE}/tools/kk/prebuzz.css').read()
sub("  /* ---- INSIDE the screen:", KK_CSS + "\n  /* ---- INSIDE the screen:")

open(f'{SITE}/kk/index.html', 'w').write(s)
print('wrote kk/index.html', len(s))
