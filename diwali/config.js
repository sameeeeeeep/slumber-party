/* ─────────────────────────────────────────────────────────────
   Mohalle ki Diwali — everything you'd want to edit lives here.
   PLACEHOLDERS: swap in the real date / venue / RSVP number.
   ───────────────────────────────────────────────────────────── */
window.MKD = {
  // Changing the salt invalidates every link already sent — set it once.
  salt: 'mkd26',
  defaultName: 'dost',

  event: {
    dateLong: '2 nov, 2026',
    dateHi: 'रविवार, २ नवंबर',
    dateShort: '02·11·26',
    time: '7pm onwards',
    venue: 'bastian beach club, juhu',
    area: 'Mumbai',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Bastian+Beach+Club+Juhu+Mumbai',
    dress: 'desi maximalist',
    dressNote: '(be loud, basically)',
    rsvpBy: 'RSVP by 1 November',            // PLACEHOLDER
    // calendar file
    start: '2026-11-02T19:00:00+05:30',
    end: '2026-11-03T01:00:00+05:30',          // end time assumed
  },

  // background music after the reveal (small player, bottom-right).
  // songs: YouTube video ids, played in order then looped. playlist: a YouTube playlist id (PL…) — if set, it's used instead.
  music: {
    title: 'mohalla diwali mix',
    songs: ['4dsFQFCvVGU'],          // Kajra Re (YRF) — placeholder until the real playlist
    playlist: '',
    volume: 100,
    start: 34,                       // seconds into the first song
  },

  rsvp: {
    // Opens + RSVPs post to a Google Form (sameep@nailin.it) → sheet "Untitled form (Responses)".
    wall: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSOz57GoCcYtf5P_uLFsGA47RaG94OYH8CUPdhqPPPT2hWbUeiUVKd8czXGoW0tLYCwJEMNcCddr6lD/pub?gid=1314439309&single=true&output=csv',
    // opens + RSVPs → sheet "nailinit Diwali — RSVPs"
    form: 'https://docs.google.com/forms/d/e/1FAIpQLSd1XwogiofckkCIX1EAr-hTbB5fGqOPvPvFiOsnjeVyMI7CLA/formResponse',
    fields: { name: 'entry.1294724695', first: 'entry.1514502624', last: 'entry.1345009509', event: 'entry.1747407084', rsvp: 'entry.1817300681', device: 'entry.2086148125' },
    // game results + wall pins → sheet "nailinit Diwali — game results"
    gamesForm: 'https://docs.google.com/forms/d/e/1FAIpQLScxSQamGzDPGesxIbLmVgj80BjOHGq7VAHRzZFPsh89N0hUxQ/formResponse',
    gamesFields: { name: 'entry.919816937', first: 'entry.804019991', last: 'entry.2054692726', type: 'entry.254283166', game: 'entry.1513823772', result: 'entry.1437142101', details: 'entry.1572634584' },
    whatsapp: '919999999999',                // PLACEHOLDER — country code, no +
    text: 'Haan ji! {name} pakka aa rahi/raha hai Mohalle ki Diwali pe 🪔',
  },
};

// diwaliparty.live: a demo copy for showing people the experience. Not a real party: a made-up date, no venue,
// and "yes" puts them into the builders group (AI tools + prompts behind sites like this) instead of a guest list.
if (window.SITE === 'demo') {
  Object.assign(window.MKD.event, {
    dateLong: '8 nov, 2026', dateHi: 'रविवार, ८ नवंबर', dateShort: '08·11·26', postmark: '8 NOV 26',
    venue: '', mapUrl: '', rsvpBy: '',
    start: '2026-11-08T19:00:00+05:30', end: '2026-11-09T01:00:00+05:30',
  });
  window.MKD.demo = {
    group: '',   // invite link to the builders group (WhatsApp community / Discord): set before sharing
  };
}

