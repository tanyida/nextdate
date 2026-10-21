/* Ingestion helpers (PRD "Ingestion pipeline", steps 2–5): extract → validate → enrich → dedupe.
 * Works on pasted listing text with "When / How much / Where" fields, the structure the monthly
 * round-up articles use. Only facts are kept. Source prose is shown to editors but never stored. */
window.PL = window.PL || {};

PL.ingest = (function () {
  const U = PL.util;
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const PREFIX_CATS = {
    'things to do': ['events', 'chill'], 'f&b': ['food'], 'party': ['nightlife', 'events'],
    'arts & culture': ['arts', 'events'], 'arts and culture': ['arts', 'events'], 'shop': ['events'], 'highlight': ['events']
  };
  const HEADING = /^\s*(?:\d+[.)]\s*)?(things to do|f&b|party|arts (?:&|and) culture|shop|highlight)\s*[:\-–|]\s*(.+)$/i;

  // ---- Postal sector (first 2 digits) → region. Colloquial regions, refine with OneMap planning areas.
  function regionFromPostal(pc) {
    const s = Number(String(pc).slice(0, 2));
    if (!pc || isNaN(s)) return null;
    if (s >= 11 && s <= 13) return 'West';
    if (s <= 41 || s === 58 || s === 59) return 'Central';
    if (s <= 52 || s === 81) return 'East';
    if (s <= 57 || s === 79 || s === 80 || s === 82) return 'North-East';
    if (s <= 71) return 'West';
    if (s <= 78) return 'North';
    return null;
  }

  // ---- Free-text price → min/max per person (++ = 10% service charge + 9% GST).
  function parsePrice(str) {
    const s = String(str || '').toLowerCase();
    const nums = [...s.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    const plusplus = /\+\+/.test(s);
    const adj = (n) => Math.round(plusplus ? n * 1.199 : n);
    if (!nums.length) return { price_min: /free/.test(s) ? 0 : null, price_max: null, price_note: str || '' };
    const min = adj(Math.min(...nums)), max = nums.length > 1 ? adj(Math.max(...nums)) : null;
    return { price_min: /free/.test(s) && /some|selected|ticketed/.test(s) ? 0 : min, price_max: /from/.test(s) ? null : max, price_note: str.trim() };
  }

  // ---- Free-text dates → start/end (YYYY-MM-DD) and days of week.
  function parseWhen(str, today) {
    const s = String(str || '');
    const ref = Number(today.slice(0, 4));
    const toks = [...s.matchAll(/(\d{1,2})(?:\s*(?:–|-|to)\s*(\d{1,2}))?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?(?:\s+(\d{4}))?/gi)]
      .map((m) => ({ d1: Number(m[1]), d2: m[2] ? Number(m[2]) : null, mo: MONTHS.indexOf(m[3].toLowerCase()) + 1, y: m[4] ? Number(m[4]) : null }));
    const out = { start_date: null, end_date: null, days: null };
    const iso = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (toks.length) {
      const startHadYear = !!toks[0].y;
      const lastY = [...toks].reverse().find((t) => t.y);
      toks.forEach((t) => { if (!t.y) t.y = lastY ? lastY.y : ref; });
      const a = toks[0], b = toks[toks.length - 1];
      out.start_date = iso(a.y, a.mo, a.d1);
      out.end_date = toks.length > 1 ? iso(b.y, b.mo, b.d2 || b.d1) : iso(a.y, a.mo, a.d2 || a.d1);
      if (/until|till|through/i.test(s) && toks.length === 1) out.start_date = today;
      // "28 Dec – 3 Jan 2027": the start year is the previous year.
      if (toks.length > 1 && out.start_date > out.end_date && !startHadYear) out.start_date = iso(b.y - 1, a.mo, a.d1);
    }
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    // Whole day words only, so "sunset", "month" or "wedding" don't match.
    const DAY = ['sun(?:day)?', 'mon(?:day)?', 'tue(?:s|sday)?', 'wed(?:nesday)?', 'thu(?:rs?|rsday)?', 'fri(?:day)?', 'sat(?:urday)?'];
    const dayRe = '(' + DAY.join('|') + ')s?\\b';
    const idx = (w) => dayNames.indexOf(w.slice(0, 3).toLowerCase());
    const range = s.match(new RegExp('\\b' + dayRe + '\\s*(?:to|–|-)\\s*' + dayRe, 'i'));
    if (/weekends?/i.test(s)) out.days = [0, 6];
    if (range) {
      const from = idx(range[1]), to = idx(range[2]);
      const ds = []; for (let i = from; ; i = (i + 1) % 7) { ds.push(i); if (i === to) break; }
      out.days = [...new Set([...(out.days || []), ...ds])].sort();
    } else {
      const named = DAY.map((d, i) => (new RegExp('\\b' + d + 's?\\b', 'i').test(s) ? i : -1)).filter((i) => i >= 0);
      if (named.length && named.length < 7) out.days = [...new Set([...(out.days || []), ...named])].sort();
    }
    return out;
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // ---- Step 2: extract entries from pasted text.
  function extract(text) {
    const lines = String(text).split(/\r?\n/);
    const entries = []; let cur = null;
    for (const raw of lines) {
      const line = raw.trim();
      const h = line.match(HEADING);
      if (h) { cur = { prefix: h[1].toLowerCase(), name: h[2].trim(), body: [], when: '', price: '', where: '', link: '' }; entries.push(cur); continue; }
      if (!cur || !line) continue;
      let m;
      if ((m = line.match(/^when\s*[:\-–]\s*(.+)$/i))) cur.when = m[1];
      else if ((m = line.match(/^(?:how much|price|cost)\s*[:\-–]\s*(.+)$/i))) cur.price = m[1];
      else if ((m = line.match(/^where\s*[:\-–]\s*(.+)$/i))) cur.where = m[1];
      else if ((m = line.match(/^(?:link|tickets?|more info|website)\s*[:\-–]\s*(\S+)/i))) cur.link = m[1];
      else { cur.body.push(line); const u = line.match(/https?:\/\/\S+/); if (u && !cur.link) cur.link = u[0].replace(/[).,]+$/, ''); }
    }
    return entries;
  }

  // ---- Steps 3–5: validate, enrich, dedupe → draft Activity + issues.
  function toDraft(e, src, existing) {
    const today = U.sgToday();
    const errors = [], warnings = [];
    const when = parseWhen(e.when, today);
    const price = parsePrice(e.price);
    const body = e.body.join(' ');
    const all = (e.name + ' ' + body + ' ' + e.where).toLowerCase();
    const pc = (e.where.match(/\b(\d{6})\b/) || [])[1] || '';
    const region = regionFromPostal(pc);

    if (!e.when) errors.push('No "When" field');
    else if (!when.end_date) errors.push('Could not read an end date from "' + e.when + '"');
    if (when.end_date && when.end_date < today) errors.push('End date ' + when.end_date + ' is in the past (check the source year)');
    if (when.start_date && when.start_date > U.addDays(today, 365)) errors.push('Starts more than 12 months out');
    if (price.price_min == null) warnings.push('Price not recognised; set it manually');
    if (!pc) warnings.push('No postal code; geocode the address to set region & location');
    else if (!region) errors.push('Postal code ' + pc + ' is not a Singapore postal sector');
    if (!e.link) errors.push('No official link; every live listing needs one');

    const sponsored = /sponsor|advertis|partner content|in partnership/.test(all);
    if (sponsored) warnings.push('Looks sponsored. Flagged so it\'s labelled');
    const adults = /\b(18\+|r21|party|horror|bar|club|beer|wine|cocktail|late[- ]night)\b/.test(all);
    if (adults) warnings.push('Possibly adults-only, so not marked kid-friendly. Check this');
    const booking = /ticket|book|reserv|register|rsvp|sign up/.test(all + ' ' + e.price.toLowerCase());
    const outdoor = /outdoor|park|beach|garden|open-air|lawn|street|walk|trail|bay\b/.test(all);

    const dup = existing.find((a) => norm(a.name) === norm(e.name) || (norm(a.name).length > 8 && norm(e.name).includes(norm(a.name))));
    if (dup) warnings.push('Possible duplicate of "' + dup.name + '" (' + dup.id + '). Merge it and keep the official link');

    const cats = PREFIX_CATS[e.prefix] || ['events'];
    const evening = /\b(pm|night|evening)\b/i.test(e.when) && !/\bam\b/i.test(e.when);
    const draft = {
      id: 'imp-' + slug(e.name) + '-' + U.randomId(3).toLowerCase(),
      name: e.name, short_description: '', type: 'event', categories: cats, vibes: [],
      start_date: when.start_date, end_date: when.end_date, days: when.days,
      time_slots: evening ? ['evening'] : ['morning', 'afternoon', 'evening'], duration_min: 120,
      price_min: price.price_min == null ? 0 : price.price_min, price_max: price.price_max, price_note: price.price_note,
      venue: e.where.split(',')[0].trim(), address: e.where.replace(/,?\s*Singapore\s*\d{6}/i, '').trim(), postal_code: pc,
      lat: null, lng: null, region: region || 'Central', indoor_outdoor: outdoor ? 'outdoor' : 'indoor',
      kid_friendly: !adults, kid_age_min: 0, booking_required: booking,
      official_url: e.link, source_name: src.name, source_url: src.url, sponsored,
      status: 'draft', pinned: false, last_verified_at: today
    };
    warnings.push('Write our own short description. Source text is never republished');
    return { draft, errors, warnings, sourceText: body };
  }

  // Validation used by the console before a listing may go live.
  function issues(a) {
    const today = U.sgToday(), out = [];
    if (!a.official_url) out.push('Missing official link');
    if (!a.short_description) out.push('Missing our own description');
    if (a.type === 'event') {
      if (!a.end_date) out.push('Event has no end date');
      else if (a.end_date < today) out.push('Ended ' + a.end_date);
      if (a.start_date && a.end_date && a.start_date > a.end_date) out.push('Start is after end');
      if (a.start_date && a.start_date > U.addDays(today, 365)) out.push('Starts > 12 months out');
    }
    if (a.lat == null || a.lng == null) out.push('No map location');
    else if (a.lat < 1.15 || a.lat > 1.48 || a.lng < 103.59 || a.lng > 104.1) out.push('Location is outside Singapore');
    if (!a.categories || !a.categories.length) out.push('No category');
    return out;
  }

  // Optional geocoding via OneMap (Singapore Land Authority). Fails gracefully if blocked.
  async function geocode(query) {
    const url = 'https://www.onemap.gov.sg/api/common/elastic/search?searchVal=' + encodeURIComponent(query) + '&returnGeom=Y&getAddrDetails=Y&pageNum=1';
    const res = await fetch(url);
    if (!res.ok) throw new Error('OneMap ' + res.status);
    const j = await res.json();
    const r = j.results && j.results[0];
    if (!r) throw new Error('No match');
    return { lat: Number(r.LATITUDE), lng: Number(r.LONGITUDE), postal_code: r.POSTAL, address: r.ADDRESS };
  }

  const SAMPLE = `Arts & culture: Open studios at the Distripark
A weekend of open studios and late gallery hours. (Source prose shown for reference only.)
When: 30 Oct – 1 Nov 2026, 12pm – 9pm
How much: Free admission with some ticketed events
Where: Tanjong Pagar Distripark, 39 Keppel Road, Singapore 089065
Link: https://www.visitsingapore.com/festivals-events-singapore/

Party: Warehouse rave all-nighter
An all-night dance party with international DJs.
When: 17 – 18 Oct 2025, 10pm onwards
How much: From $40
Where: Robertson Quay, Singapore 238256
Link: https://www.visitsingapore.com/festivals-events-singapore/

F&B: Peranakan supper club pop-up
A limited-run tasting menu by a guest chef, presented in partnership with a credit card.
When: Thursdays to Saturdays, until 28 Nov 2026, 7pm
How much: From $72++ per adult
Where: Joo Chiat Road, Singapore 427500
Link: https://www.visitsingapore.com/festivals-events-singapore/`;

  return { extract, toDraft, issues, parsePrice, parseWhen, regionFromPostal, geocode, SAMPLE };
})();
