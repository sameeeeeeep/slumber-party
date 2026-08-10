#!/usr/bin/env python3
"""
Regenerates the "live pages" PDF — every URL that exists, who it is for, and the
word that opens it.

    python3 tools/live-pages-pdf.py

The roster comes from the `guests` table over the linked Supabase project, not
from besties/guests.json, because the tier only exists in the database and a PDF
that disagrees with the dashboard is worse than no PDF. The invite password comes
from besties/.password, which is gitignored.

Output lands on the Desktop, outside the repo, because the file contains every
invite code and every password on the project. It is never committed.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

from fpdf import FPDF

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.expanduser('~/Desktop/slumber-party-live-pages.pdf')
SITE = 'secretslumberparty.com'
IST = timezone(timedelta(hours=5, minutes=30))


def roster():
    """Every guest with an invite code, newest truth first: the database."""
    q = ("select json_agg(json_build_object('name', name, 'code', code, 'tier', tier) "
         "order by tier, name) as j from guests where code is not null")
    r = subprocess.run(['supabase', 'db', 'query', '--linked', q],
                       cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('could not read the guest list:\n' + r.stderr)
    # the CLI prefixes a status line and appends an untrusted-data warning
    body = json.loads(r.stdout[r.stdout.index('{'):])
    return body['rows'][0]['j'] or []


def password():
    p = os.path.join(REPO, 'besties', '.password')
    if not os.path.exists(p):
        sys.exit('besties/.password is missing — it is gitignored, so restore it first.')
    return open(p).read().strip()


PW = password()
PEOPLE = roster()
TIERS = [
    ('bestie', 'Besties'),
    ('creator', 'Creators'),
    ('super', 'Super guests'),
]

# ---------------------------------------------------------------- the document
pdf = FPDF(format='A4')
pdf.set_auto_page_break(True, margin=18)
pdf.add_page()
pdf.set_margins(18, 16, 18)

PINK = (194, 69, 107)
INK = (43, 26, 34)
GREY = (122, 106, 113)


def h1(t, sub):
    pdf.set_text_color(*INK); pdf.set_font('Helvetica', '', 20)
    pdf.cell(0, 12, t, new_x='LMARGIN', new_y='NEXT')
    pdf.set_text_color(*PINK); pdf.set_font('Helvetica', '', 9)
    pdf.cell(0, 5, sub, new_x='LMARGIN', new_y='NEXT')
    pdf.ln(5)


def h2(t):
    if pdf.get_y() > 240:
        pdf.add_page()
    pdf.ln(3)
    pdf.set_text_color(*INK); pdf.set_font('Helvetica', '', 13)
    pdf.cell(0, 8, t, new_x='LMARGIN', new_y='NEXT')
    pdf.set_draw_color(*PINK); pdf.set_line_width(.5)
    y = pdf.get_y()
    pdf.line(18, y, 195, y)
    pdf.ln(2)


def note(lines, fill=(253, 240, 244)):
    """A block that has to be read, not skimmed — the passwords live in these."""
    pdf.set_fill_color(*fill)
    pdf.set_text_color(*INK); pdf.set_font('Helvetica', '', 9)
    pdf.multi_cell(0, 5.4, '\n'.join(lines), fill=True,
                   new_x='LMARGIN', new_y='NEXT')
    pdf.ln(2)


def url_row(url, what):
    """Left column is the address in mono; right column is who it is for."""
    if pdf.get_y() > 262:
        pdf.add_page()
    y0 = pdf.get_y()
    pdf.set_font('Courier', '', 8.5); pdf.set_text_color(*INK)
    pdf.set_xy(18, y0)
    pdf.multi_cell(78, 4.7, url, new_x='RIGHT', new_y='TOP')
    y_left = pdf.get_y()
    pdf.set_font('Helvetica', '', 8.5); pdf.set_text_color(*GREY)
    pdf.set_xy(98, y0)
    pdf.multi_cell(97, 4.7, what, align='J', new_x='LMARGIN', new_y='NEXT')
    pdf.set_y(max(y_left, pdf.get_y()) + 1)
    pdf.set_draw_color(232, 224, 228); pdf.set_line_width(.2)
    pdf.line(18, pdf.get_y() - .5, 195, pdf.get_y() - .5)


def person_row(name, url):
    if pdf.get_y() > 268:
        pdf.add_page()
    y0 = pdf.get_y()
    pdf.set_font('Helvetica', '', 9); pdf.set_text_color(*INK)
    pdf.set_xy(18, y0); pdf.cell(70, 6.2, name)
    pdf.set_font('Courier', '', 8.5); pdf.set_text_color(*PINK)
    pdf.cell(0, 6.2, f'https://{SITE}/{url}', new_x='LMARGIN', new_y='NEXT')
    pdf.set_draw_color(232, 224, 228); pdf.set_line_width(.2)
    pdf.line(18, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(.5)


today = datetime.now(IST).strftime('%d %b %Y')
h1("Khushi's Secret Slumber Party - live pages",
   f'every page that is live | generated {today} | {len(PEOPLE)} guests on the list')

h2('For everyone (public)')
url_row(SITE, 'the main site: gate, DM from khushi, application form, arcade. The only '
              'page meant to be found on Google. Applications closed 15 Aug 11:59pm IST '
              '- it now shows the closed state and sends people to /late.')
url_row(f'{SITE}/late', 'where a late arrival lands: a DM that explains what they missed, takes '
                        'their email, and promises a surprise. No password.')
url_row(f'{SITE}/terms.html', 'T&C + privacy policy (linked from the gate; hidden from search)')
url_row(f'{SITE}/privacy.html', 'privacy policy (hidden from search)')

h2('How the personalised links work')
note([
    f'Every link opens a gate that greets the guest by name, then asks for the password:  {PW}',
    'The password is required on every link - there is no universal link. Send each person their own link plus the password.',
    f'Both shapes work:  {SITE}/<code>  and  {SITE}/besties/<code>',
])

for key, label in TIERS:
    mine = [p for p in PEOPLE if p['tier'] == key]
    if not mine:
        continue
    h2(f'{label} ({len(mine)})')
    for p in mine:
        person_row(p['name'], p['code'])

h2('Guest pages, once they are in')
note(['These four are for confirmed guests only. Send the link and the word together, '
      'and never put either in a public caption.'])
url_row(f'{SITE}/itinerary', 'the programming: what happens hour by hour, both days. Read-only for '
                             'guests, fully editable in the dashboard. Password: nailinit')
url_row(f'{SITE}/house', 'the live house: pick your character and walk around with everyone '
                         'else in real time - fort, nail bar, terrace, lounge, arcade. '
                         'Password: nailinit')
url_row(f'{SITE}/housemates', 'the introduction round: 40 people at a round table, one card at a '
                              'time, for introducing everyone in person. Password: housemates')
url_row(f'{SITE}/games', 'the Slumber Games scoreboard - five houses, points, and how each one '
                         'was earned. Built to be projected on a wall; refreshes itself. '
                         'Password: nailinit')

h2('Operations (not for guests)')
url_row(f'{SITE}/checkin', 'guest check-in chat - send to confirmed guests only (phone, ID '
                           'upload, pyjama size, t-shirt size, waist, meal preference)')
url_row(f'{SITE}/admin', 'the dashboard: overview, applications, guests, slumber games, boxes & '
                         'sponsors, rooms & crew, programming, reach. Every guest page above is '
                         'one click from the overview. Login: your admin email + password.')

pdf.ln(4)
pdf.set_font('Helvetica', '', 8); pdf.set_text_color(*GREY)
pdf.multi_cell(0, 4.6,
               'This file contains every invite code and every password on the project. It lives '
               'on your Desktop, outside the repo - share it with no one outside the team. '
               'Regenerate it with: python3 tools/live-pages-pdf.py',
               align='J')

pdf.output(OUT)
print(f'{OUT}  ({len(PEOPLE)} guests, {pdf.pages_count} pages)')
