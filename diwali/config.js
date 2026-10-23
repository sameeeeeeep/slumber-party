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

  // background music after the reveal: any embeddable YouTube video id (shown as a small player, bottom-right)
  music: { youtube: 'YCq7kYUJrHM', title: 'mohalla diwali mix', volume: 45 },

  rsvp: {
    // Opens + RSVPs post to a Google Form (sameep@nailin.it) → sheet "Untitled form (Responses)".
    wall: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSOz57GoCcYtf5P_uLFsGA47RaG94OYH8CUPdhqPPPT2hWbUeiUVKd8czXGoW0tLYCwJEMNcCddr6lD/pub?gid=1314439309&single=true&output=csv',
    form: 'https://docs.google.com/forms/d/e/1FAIpQLScVPd2rjBp13xfeLVU6ErMwKoqwCkv0xhqlg-vfh7Twq_0yWg/formResponse',
    fields: { event: 'entry.1726605616', name: 'entry.1618333562', phone: 'entry.1862265163', rsvp: 'entry.944684585',
              link: 'entry.1147065896', key: 'entry.736821260', device: 'entry.671865426' },
    whatsapp: '919999999999',                // PLACEHOLDER — country code, no +
    text: 'Haan ji! {name} pakka aa rahi/raha hai Mohalle ki Diwali pe 🪔',
  },
};
