#!/usr/bin/env node
/* ============================================================================
   import-applications — backfill public.applications from the Google Sheet.
   ============================================================================
   The Sheet has always been the real record; Supabase only started receiving
   applications on 7 Aug 2026, so everything before that exists in one place and
   the dashboard shows nothing. This reads a Forms responses export and writes the
   SQL to load it.

   USAGE
     File → Download → Comma-separated values in the responses sheet, then:

       node tools/import-applications.mjs ~/Downloads/responses.csv > /tmp/import.sql
       supabase db query --linked -f /tmp/import.sql

   IT PRINTS SQL RATHER THAN INSERTING, on purpose: a backfill is one-shot and
   irreversible, and you should get to read it before it runs.

   WHY NOT POST THROUGH THE EDGE FUNCTION
   The obvious route — replay each row through /functions/v1/submit — would send
   every past applicant the confirmation email a second time, weeks after they
   applied. It would also hit the per-IP rate limit at row six. So this inserts
   straight into the table.

   DUPLICATES are handled by the unique index on lower(email): re-running is safe
   and adds only rows that aren't there yet.
   ========================================================================== */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/import-applications.mjs <responses.csv> > import.sql');
  process.exit(1);
}

/* A real CSV parser, not a split(','): the "why" answers are free text and will
   contain commas, quotes and newlines. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const src = text.replace(/^﻿/, '');          // strip the BOM Excel adds
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

/* Google Forms names its columns after the QUESTION TEXT, which gets reworded.
   So match on keywords rather than exact headers, and report what matched so a
   silent mis-map is impossible to miss. */
const MATCHERS = [
  ['created_at', /timestamp|submitted/i],
  ['name',       /\bname\b/i],
  ['age',        /\bage\b|how old/i],   // the live form asks "how old are you?"
  ['city',       /city|where.*from|location/i],
  ['role',       /describe|who are you|role/i],
  ['handle',     /instagram|handle|@/i],
  ['phone',      /phone|number|mobile/i],
  ['email',      /e-?mail/i],
  ['why',        /why|perfect|slumber|about/i],
  ['visitor_id', /visitor/i],
  ['status',     /status/i],
];

const csv = parseCSV(await readFile(file, 'utf8'));
if (csv.length < 2) { console.error('that file has no data rows'); process.exit(1); }

const header = csv[0];
const map = {};
for (const [key, re] of MATCHERS) {
  const i = header.findIndex(h => re.test(h));
  if (i !== -1 && !Object.values(map).includes(i)) map[key] = i;
}

const q = (v) => v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const get = (row, key) => map[key] === undefined ? null : (row[map[key]] ?? '').trim();

const values = [];
let skipped = 0, incomplete = 0;

for (const row of csv.slice(1)) {
  const email = (get(row, 'email') || '').toLowerCase();
  const name = get(row, 'name');
  // email is the dedupe key and name is the only truly required field — a row
  // with neither is a blank line, not an application
  if (!email && !name) { skipped++; continue; }

  const status = get(row, 'status') || '';
  const isIncomplete = /incomplete/i.test(status);
  if (isIncomplete) incomplete++;

  const ageRaw = parseInt(get(row, 'age') ?? '', 10);
  const age = Number.isFinite(ageRaw) && ageRaw > 0 && ageRaw < 120 ? ageRaw : null;

  // the sheet's own status vocabulary doesn't fit the table's check constraint,
  // so it goes in notes and every imported row lands as 'new'
  const notes = ['imported from the google sheet',
                 status ? `sheet status: ${status}` : null,
                 get(row, 'visitor_id') ? `visitor_id: ${get(row, 'visitor_id')}` : null]
                .filter(Boolean).join(' · ');

  const ts = get(row, 'created_at');
  values.push('  (' + [
    q(name), q(get(row, 'city')), age === null ? 'null' : age, q(get(row, 'role')),
    q(get(row, 'handle')), q(get(row, 'phone')), q(email || null), q(get(row, 'why')),
    q(notes),
    ts ? `coalesce(nullif(${q(ts)},'')::timestamptz, now())` : 'now()',
  ].join(', ') + ')');
}

console.log(`-- ${values.length} rows from ${file}`);
console.log(`-- columns matched: ${Object.keys(map).join(', ')}`);
if (skipped) console.log(`-- ${skipped} blank row(s) skipped`);
if (incomplete) console.log(`-- ${incomplete} row(s) were marked incomplete in the sheet (kept, noted)`);
console.log(`-- unmatched headers: ${header.filter((h,i)=>!Object.values(map).includes(i)).join(' | ') || 'none'}`);
console.log();
if (!values.length) { console.log('-- nothing to import'); process.exit(0); }

console.log('insert into public.applications');
console.log('  (name, city, age, role, handle, phone, email, why, notes, created_at)');
console.log('values');
console.log(values.join(',\n'));
console.log('on conflict do nothing;');
console.log();
console.log('select count(*) as applications_now from public.applications;');
