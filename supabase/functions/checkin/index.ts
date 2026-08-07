// ============================================================================
//  POST /functions/v1/checkin — the ONLY way a check-in reaches the database.
//
//  Same reasoning as `submit`: the anon key is public, so any table-level insert
//  policy would let anyone write anything. Here the anon key only buys the right
//  to call this, and the function decides what gets stored.
//
//  This one carries a GOVERNMENT ID DOCUMENT, which changes two things:
//
//    · the file goes into the PRIVATE `checkin-ids` bucket using the service
//      role, so no upload credential ever reaches the browser. A signed upload
//      URL would have been fewer bytes over the wire, but it hands the client a
//      token that can write into the bucket, and this is not the payload to be
//      relaxed about.
//    · the document is never echoed back. The response says "stored" and gives
//      the row id; only an authenticated admin can mint a signed URL to look.
//
//  ONE CHECK-IN PER PHONE is enforced by a unique index in the database, not
//  here — a check in this function still races against a double-submit, and a
//  check in the browser is advisory. 23505 comes back as a friendly reply.
//
//  Deploy:  supabase functions deploy checkin
//  Secrets: supabase secrets set IP_SALT=...            (already set for submit)
//  Needs:   schema.sql and schema-checkin.sql run first.
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://secretslumberparty.com',
  'https://www.secretslumberparty.com',
  'http://localhost:4321',
];

/* A flood stop, not a duplicate guard — the unique index on phone is that, and it
   can't be worked around. 8 per IP was too tight for the obvious real case: a
   group of guests checking in from the same wifi, or several on the same carrier
   NAT, would have started being refused at the ninth person. */
const MAX_PER_IP_PER_HOUR = 60;
const MAX_DOC_BYTES = 6 * 1024 * 1024;      // the bucket caps at 8MB; stay under
const DOC_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MEALS = ['veg', 'non-veg', 'vegan', 'allergic', 'jain'];

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });

async function hashIp(ip: string) {
  const salt = Deno.env.get('IP_SALT') ?? 'change-me';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

/** Indian mobile numbers, normalised so the same phone can't check in twice
 *  wearing different formatting. Keeps the last 10 digits, requires a leading
 *  6-9 (the real range for Indian mobiles), stores as +91XXXXXXXXXX. */
function normalisePhone(raw: unknown): string | null {
  const s = str(raw, 30);
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10 || !/^[6-9]/.test(last10)) return null;
  // reject a country code that isn't India rather than silently truncating it
  const prefix = digits.slice(0, -10);
  if (prefix && prefix !== '91' && prefix !== '091' && prefix !== '0') return null;
  return `+91${last10}`;
}

function validate(b: Record<string, unknown>) {
  const name = str(b.name, 120);
  if (!name || name.length < 2) return { error: 'what should khushi call you?' };

  const phone = normalisePhone(b.phone);
  if (!phone) return { error: "that number doesn't look right — 10 digits, starting 6-9" };

  const email = str(b.email, 200)?.toLowerCase() ?? null;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'that email looks off' };

  const pyjama_size = str(b.pyjama_size, 4)?.toUpperCase() ?? null;
  if (!pyjama_size || !SIZES.includes(pyjama_size)) return { error: 'pick a pyjama size' };

  const meal = str(b.meal, 20)?.toLowerCase() ?? null;
  if (!meal || !MEALS.includes(meal)) return { error: 'pick a meal preference' };

  // only meaningful for 'allergic', but harmless to keep whenever it's given
  const meal_notes = str(b.meal_notes, 400);
  if (meal === 'allergic' && !meal_notes) return { error: 'tell khushi what you\'re allergic to' };

  const id_doc_type = str(b.id_doc_type, 20)?.toLowerCase() ?? 'other';

  return {
    row: {
      name, phone, email, pyjama_size, meal, meal_notes,
      id_doc_type: ['aadhaar', 'licence', 'other'].includes(id_doc_type) ? id_doc_type : 'other',
      tz: str(b.tz, 60),
      user_agent: str(b.user_agent, 300),
    },
  };
}

/** data: URL → bytes. Returns null on anything that isn't an allowed document. */
function decodeDoc(dataUrl: unknown) {
  const s = typeof dataUrl === 'string' ? dataUrl : '';
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(s);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = DOC_TYPES[mime];
  if (!ext) return null;
  let bytes: Uint8Array;
  try {
    const bin = atob(m[2].replace(/\s+/g, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return null; }
  if (!bytes.length || bytes.length > MAX_DOC_BYTES) return null;
  return { bytes, mime, ext };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'bad request' }, 400, origin); }

  const v = validate(body);
  if ('error' in v) return json({ error: v.error }, 400, origin);
  const row = v.row!;

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // ---- rate limit ---------------------------------------------------------
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const ipHash = await hashIp(ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('submit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).eq('kind', 'checkin').gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return json({ error: 'too many check-ins from here — try again in a bit' }, 429, origin);
  }

  // ---- has this phone already checked in? ---------------------------------
  // The unique index is the real guard; this is only so the reply can be
  // specific about WHICH field clashed instead of a generic "already done".
  const { data: existing } = await db.from('checkins')
    .select('id').eq('phone', row.phone).maybeSingle();
  if (existing) {
    return json({ ok: true, duplicate: 'phone',
      message: 'this number has already checked in 💌' }, 200, origin);
  }

  // ---- match them to the roster, if they're on it --------------------------
  // A name match is a convenience for the dashboard, never a gate: someone
  // whose spelling doesn't line up still checks in, they just land unmatched.
  let guest_id: string | null = null;
  const { data: guest } = await db.from('guests')
    .select('id').ilike('name', row.name).maybeSingle();
  if (guest) guest_id = guest.id;

  // ---- store the document -------------------------------------------------
  // Uploaded BEFORE the row so a check-in never exists claiming a document
  // that isn't there. If the upload fails, nothing is written at all.
  const doc = decodeDoc(body.id_doc);
  if (!doc) {
    return json({ error: 'that file didn\'t come through — jpg, png, webp or pdf, under 6MB' }, 400, origin);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${row.phone.replace('+', '')}/${stamp}.${doc.ext}`;
  const up = await db.storage.from('checkin-ids')
    .upload(path, doc.bytes, { contentType: doc.mime, upsert: false });
  if (up.error) {
    console.error('doc upload failed', up.error);
    return json({ error: "couldn't store that document — try again?" }, 500, origin);
  }

  // ---- store the row ------------------------------------------------------
  const { data, error } = await db.from('checkins')
    .insert({ ...row, guest_id, id_doc_path: path }).select('id').single();

  if (error) {
    // lost the race on the unique index (phone or email) — clean up the file we
    // just uploaded, so an orphan document doesn't sit in the bucket forever
    await db.storage.from('checkin-ids').remove([path]).catch(() => {});
    if ((error as { code?: string }).code === '23505') {
      return json({ ok: true, duplicate: 'phone',
        message: 'this number has already checked in 💌' }, 200, origin);
    }
    console.error('checkin insert failed', error);
    return json({ error: "couldn't save that — try again?" }, 500, origin);
  }

  await db.from('submit_log').insert({ ip_hash: ipHash, kind: 'checkin' });

  return json({ ok: true, id: data.id, matched: !!guest_id }, 200, origin);
});
