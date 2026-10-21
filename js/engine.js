/* Rules-based recommendation engine (PRD "Recommendation logic").
 * Step 1 hard filters → Step 2 weighted score → Step 3 diversity → Step 4 meal pairing. */
window.PL = window.PL || {};

PL.engine = (function () {
  const U = PL.util;

  const BUDGETS = {
    'u50': { label: 'Under $50', max: 50 },
    '50-100': { label: '$50–$100', max: 100 },
    '100-200': { label: '$100–$200', max: 200 },
    '200+': { label: '$200+', max: Infinity }
  };
  const DURATIONS = {
    '2-3': { label: '2–3 hrs', max: 180 },
    'half': { label: 'Half day (4–5 hrs)', max: 300 },
    'full': { label: 'Full day', max: 600 }
  };
  const SLOTS = {
    morning: { label: 'Morning', start: 600 },   // 10:00
    afternoon: { label: 'Afternoon', start: 900 }, // 15:00
    evening: { label: 'Evening', start: 1110 }    // 18:30
  };
  // Meal windows from the PRD (lunch 11:30–14:30, dinner 18:00–21:30).
  const MEALS = {
    brunch: { label: 'Brunch', from: '09:30', to: '12:00', at: 600 },
    lunch: { label: 'Lunch', from: '11:30', to: '14:30', at: 750 },
    dinner: { label: 'Dinner', from: '18:00', to: '21:30', at: 1110 },
    drinks: { label: 'Drinks', from: '19:00', to: '23:00', at: 1230 }
  };
  const BAND_COST = { 1: 10, 2: 28, 3: 60, 4: 120 }; // est. per person
  const BAND_LABEL = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
  const ADJACENT = {
    'North': ['North-East', 'West', 'Central'],
    'North-East': ['North', 'East', 'Central'],
    'East': ['North-East', 'Central'],
    'West': ['North', 'Central'],
    'Central': ['North', 'North-East', 'East', 'West']
  };
  const RELATED = {
    workshops: ['arts', 'food'], tours: ['arts', 'nature'], sports: ['nature'], arts: ['tours', 'events'],
    nature: ['sports', 'chill'], food: ['nightlife', 'chill'], nightlife: ['food', 'events'],
    events: ['arts', 'nightlife'], wellness: ['chill'], chill: ['wellness', 'nature', 'food']
  };
  const KID_AGES = { '0-3': 0, '4-7': 4, '8-12': 8, '13+': 13 };

  function defaults() {
    return {
      categories: [], budget: '50-100', duration: '2-3', dateMode: 'weekend', date: U.thisWeekend(),
      slot: 'evening', region: 'Anywhere', meal: 'auto', cuisines: [], dietary: [],
      withKids: false, kidAges: '4-7', kidCount: 1, io: 'either', rainBackup: true, vibes: []
    };
  }

  function resolveMeal(p) {
    if (p.meal !== 'auto') return p.meal;
    return { morning: 'lunch', afternoon: 'dinner', evening: 'dinner' }[p.slot];
  }
  function people(p) { return { adults: 2, kids: p.withKids ? (p.kidCount || 1) : 0 }; }
  // Estimated activity cost for the party (kids estimated at half price).
  function activityCost(a, p) { const pp = people(p); return Math.round(a.price_min * (pp.adults + pp.kids * 0.5)); }
  function mealCost(r, p) { const pp = people(p); return Math.round(BAND_COST[r.price_band] * (pp.adults + pp.kids * 0.6)); }

  function isLive(a, today) {
    if (a.status !== 'live') return false;
    if (a.type === 'event' && (!a.end_date || a.end_date < today)) return false; // auto-expire
    return true;
  }

  // ---- Step 1: hard filters. Returns the reason a listing fails, or null. ----
  function failReason(a, p, today) {
    if (!isLive(a, today)) return 'not-live';
    if (a.type === 'event') {
      if (!(a.start_date <= p.date && p.date <= a.end_date)) return 'date';
      if (a.days && !a.days.includes(U.weekday(p.date))) return 'date';
    }
    if (!a.time_slots.includes(p.slot)) return 'slot';
    if (activityCost(a, p) > BUDGETS[p.budget].max) return 'budget';
    if (a.duration_min > DURATIONS[p.duration].max) return 'duration';
    if (p.withKids) {
      if (!a.kid_friendly) return 'kids';
      if ((a.kid_age_min || 0) > KID_AGES[p.kidAges]) return 'kids';
    }
    if (p.io !== 'either' && a.indoor_outdoor !== p.io) return 'io';
    if (p.region !== 'Anywhere' && a.region !== p.region && !(ADJACENT[p.region] || []).includes(a.region)) return 'region';
    return null;
  }

  // ---- Step 2: scoring 0–100 ----
  function score(a, p, ctx) {
    const cats = p.categories.length ? p.categories : PL.CATEGORIES.map((c) => c.id);
    let cat = 0;
    if (a.categories.some((c) => cats.includes(c))) cat = a.categories.some((c, i) => i === 0 && cats.includes(c)) ? 1 : 0.85;
    else if (a.categories.some((c) => cats.some((s) => (RELATED[s] || []).includes(c)))) cat = 0.45;

    const region = p.region === 'Anywhere' || a.region === p.region ? 1 : 0.4;

    let time = 0.35;
    if (a.type === 'event') {
      const left = U.daysBetween(p.date, a.end_date);
      time = left <= 3 ? 1 : left <= 10 ? 0.9 : 0.75;
    }

    let vibe = 0.5;
    if (p.vibes.length) vibe = p.vibes.filter((v) => a.vibes.includes(v)).length / p.vibes.length;
    if (p.withKids && !p.vibes.length) vibe = 0.6;

    let novelty = 1;
    if (ctx.saved.includes(a.id)) novelty -= 0.4;
    novelty -= Math.min(0.5, (ctx.views[a.id] || 0) * 0.08);

    const boost = a.pinned ? 1 : 0;
    const total = 30 * cat + 20 * region + 20 * time + 15 * vibe + 10 * Math.max(0, novelty) + 5 * boost;
    return { total: Math.round(total), parts: { cat, region, time, vibe, novelty, boost } };
  }

  // ---- Step 4: meal pairing ----
  function pairMeals(a, p, content, budgetLeft) {
    const meal = resolveMeal(p);
    if (meal === 'none') return { meal, options: [] };
    const win = MEALS[meal];
    const wFrom = U.toMin(win.from), wTo = U.toMin(win.to);
    let pool = content.restaurants.filter((r) => {
      if (!r.meal_types.includes(meal)) return false;
      const o = U.toMin(r.opening_hours.open), c = U.toMin(r.opening_hours.close);
      if (o > wFrom + 60 || c < Math.min(wTo, wFrom + 120)) return false; // open for the bulk of the window
      // "No beef" = avoid beef-focused places; halal & vegetarian must be explicitly offered.
      if (p.dietary.some((d) => (d === 'no-beef' ? r.beef_focused : !r.dietary.includes(d)))) return false;
      return true;
    }).map((r) => {
      const km = U.km(a, r);
      return { r, km, mins: U.travelMin(km) };
    });
    // Widen the radius step by step until there are at least 3 choices (PRD: ~1.5 km / 15 min first).
    const MIN = 3;
    let near = [];
    // Dietary needs are a hard match, so allow a slightly wider search to still offer 3 choices.
    for (const r of p.dietary.length ? [1.5, 2.5, 4, 6] : [1.5, 2.5, 4]) { near = pool.filter((x) => x.km <= r); if (near.length >= MIN) break; }
    const cuisineHit = (x) => !p.cuisines.length || x.r.cuisines.some((c) => p.cuisines.includes(c));
    const fits = (x) => mealCost(x.r, p) <= budgetLeft;
    // Preference order: cuisine match → within budget → closest. Weaker matches only fill up to 3.
    const list = near
      .sort((x, y) => (cuisineHit(y) - cuisineHit(x)) || (fits(y) - fits(x)) || x.km - y.km)
      .filter((x, i) => i < MIN || (cuisineHit(x) && fits(x)))
      .slice(0, 5)
      .map((x) => Object.assign({}, x, { widened: x.km > 1.5, cost: mealCost(x.r, p), overBudget: !fits(x), cuisineMatch: cuisineHit(x) }));
    return { meal, options: list };
  }

  function tipFor(a, p, tips) {
    const audience = p.withKids ? 'family' : (p.vibes.includes('first-date') ? 'new couple' : 'couple');
    const scored = tips.filter((t) => t.approved).map((t) => {
      let s = 0;
      if (t.categories.some((c) => a.categories.includes(c))) s += 3;
      if (t.categories[0] && a.categories[0] === t.categories[0]) s += 1;
      s += t.vibes.filter((v) => a.vibes.includes(v)).length;
      s += t.vibes.filter((v) => p.vibes.includes(v)).length;
      if (t.audience === audience) s += 2;
      else if (t.audience !== 'couple') s -= 4;
      // Stable variety: hash of ids so the same card keeps the same tip.
      s += ((a.id + t.id).split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) & 7) / 10;
      return { t, s };
    }).sort((x, y) => y.s - x.s);
    return scored[0] && scored[0].s > 0 ? scored[0].t : null;
  }

  function rainBackup(a, p, content, today) {
    if (a.indoor_outdoor !== 'outdoor' || !p.rainBackup) return null;
    const alt = content.activities
      .filter((x) => x.id !== a.id && x.indoor_outdoor === 'indoor' && !failReason(x, Object.assign({}, p, { io: 'either', region: 'Anywhere' }), today))
      .map((x) => ({ x, km: U.km(a, x) }))
      .filter((o) => o.km <= 4)
      .sort((m, n) => m.km - n.km)[0];
    return alt ? { activity: alt.x, km: alt.km } : null;
  }

  // ---- Step 3: diversity ----
  function diversify(ranked, limit) {
    const out = [], perCat = {}, rest = [];
    for (const it of ranked) {
      const c = it.activity.categories[0];
      if (out.length < 6 && (perCat[c] || 0) >= 2) { rest.push(it); continue; }
      out.push(it); perCat[c] = (perCat[c] || 0) + 1;
      if (out.length >= limit) break;
    }
    for (const it of rest) { if (out.length >= limit) break; out.push(it); }
    if (out.length && !out.some((it) => it.activity.type === 'evergreen')) {
      const ev = ranked.find((it) => it.activity.type === 'evergreen' && !out.includes(it));
      if (ev) out[out.length - 1] = ev;
    }
    return out;
  }

  function recommend(p, opts) {
    const t0 = performance.now();
    opts = opts || {};
    const content = opts.content || PL.store.content();
    const today = U.sgToday();
    const ctx = {
      done: PL.store.list('done'), saved: PL.store.list('saved'), views: PL.store.get('views', {})
    };
    const exclude = new Set([...(opts.exclude || []), ...ctx.done]);
    const budgetMax = BUDGETS[p.budget].max;

    const passing = content.activities.filter((a) => !exclude.has(a.id) && !failReason(a, p, today));
    const ranked = passing.map((a) => {
      const sc = score(a, p, ctx);
      return { activity: a, score: sc.total, parts: sc.parts };
    }).filter((it) => !p.categories.length || it.parts.cat > 0)
      .sort((x, y) => y.score - x.score);

    const limit = opts.limit || 8;
    // Stay in the chosen region when it has enough ideas; adjacent regions only top up thin results.
    let pool = ranked;
    if (p.region !== 'Anywhere') {
      const strict = ranked.filter((it) => it.activity.region === p.region);
      if (strict.length >= 6) pool = strict;
    }
    let picked = diversify(pool, limit);
    // "Happening now" (events on the chosen date) first, then evergreen, each by score.
    picked = picked.filter((i) => i.activity.type === 'event').concat(picked.filter((i) => i.activity.type !== 'event'));

    const items = picked.map((it) => {
      const aCost = activityCost(it.activity, p);
      const left = budgetMax === Infinity ? 400 : budgetMax - aCost;
      return Object.assign(it, {
        cost: aCost,
        meals: pairMeals(it.activity, p, content, left),
        tip: tipFor(it.activity, p, content.tips),
        backup: rainBackup(it.activity, p, content, today)
      });
    });

    return {
      items, totalMatches: pool.length,
      relax: pool.length < 3 ? suggestRelax(p, content, exclude, today) : [],
      ms: Math.round(performance.now() - t0)
    };
  }

  // Empty state: which single filter change yields the most results?
  function suggestRelax(p, content, exclude, today) {
    const tries = [];
    if (p.region !== 'Anywhere') tries.push({ label: 'Try Anywhere instead of ' + p.region, patch: { region: 'Anywhere' } });
    const bKeys = Object.keys(BUDGETS); const bi = bKeys.indexOf(p.budget);
    if (bi < bKeys.length - 1) tries.push({ label: 'Stretch budget to ' + BUDGETS[bKeys[bi + 1]].label, patch: { budget: bKeys[bi + 1] } });
    const dKeys = Object.keys(DURATIONS); const di = dKeys.indexOf(p.duration);
    if (di < dKeys.length - 1) tries.push({ label: 'Allow ' + DURATIONS[dKeys[di + 1]].label.toLowerCase(), patch: { duration: dKeys[di + 1] } });
    if (p.categories.length) tries.push({ label: 'Show all date types', patch: { categories: [] } });
    if (p.io !== 'either') tries.push({ label: 'Indoor or outdoor', patch: { io: 'either' } });
    ['morning', 'afternoon', 'evening'].filter((s) => s !== p.slot).forEach((s) => tries.push({ label: 'Try ' + s + ' instead', patch: { slot: s } }));
    return tries.map((t) => {
      const q = Object.assign({}, p, t.patch);
      const n = content.activities.filter((a) => !exclude.has(a.id) && !failReason(a, q, today) &&
        (!q.categories.length || a.categories.some((c) => q.categories.includes(c) || q.categories.some((s) => (RELATED[s] || []).includes(c))))).length;
      return Object.assign(t, { n });
    }).filter((t) => t.n >= 3).sort((x, y) => y.n - x.n).slice(0, 3);
  }

  // Build a timed itinerary from plan items [{activity, meal (restaurant option or null)}].
  // Meal opens the date (brunch; lunch before an afternoon; dinner before an evening) or closes it.
  function mealFirst(p) {
    const meal = resolveMeal(p);
    return meal === 'brunch' || (meal === 'lunch' && p.slot === 'afternoon') || (meal === 'dinner' && p.slot === 'evening');
  }

  function itinerary(plan, p) {
    const meal = resolveMeal(p), first = mealFirst(p);
    const m = (plan.find((it) => it.meal) || {}).meal;
    const steps = [];
    let t = SLOTS[p.slot].start;
    if (m && first) t = { brunch: 600, lunch: 720, dinner: 1080 }[meal];
    let cost = 0, last = null;
    const push = (kind, place, dur, c) => {
      if (last) t += U.travelMin(U.km(last, place));
      steps.push({ kind, place, start: t, dur, cost: c });
      t += dur; cost += c; last = place;
    };
    const pushMeal = () => push('meal', Object.assign({ mealType: meal }, m.r), meal === 'drinks' ? 90 : 75, m.cost);
    if (m && first) pushMeal();
    plan.forEach((it) => {
      // Ticketed events with a fixed start time: wait for it (arrive ~10 min early).
      if (it.activity.start_time) {
        const st = U.toMin(it.activity.start_time) - (last ? U.travelMin(U.km(last, it.activity)) : 0);
        if (!steps.length) t = U.toMin(it.activity.start_time); else if (t < st) t = st;
      }
      push('activity', it.activity, it.activity.duration_min, it.cost);
    });
    if (m && !first) {
      // Wait for the meal window to open (e.g. afternoon activity → dinner from 6pm).
      const opens = U.toMin(MEALS[meal].from);
      if (t < opens - 10) t = opens - (last ? U.travelMin(U.km(last, m.r)) : 0);
      pushMeal();
    }
    const start = steps.length ? steps[0].start : SLOTS[p.slot].start;
    return { steps, start, end: t, totalMin: t - start, cost };
  }

  // Where to book: the listing's booking page, else the official page.
  const bookingUrl = (a) => a.booking_url || a.official_url;
  // Where to reserve: the restaurant's booking page, else a Maps search (most listings offer "Reserve a table").
  const reserveUrl = (r) => r.booking_url || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.name + ' ' + r.address + ' Singapore'));

  return {
    BUDGETS, bookingUrl, reserveUrl, DURATIONS, SLOTS, MEALS, BAND_LABEL, ADJACENT, KID_AGES,
    defaults, recommend, itinerary, mealFirst, resolveMeal, activityCost, mealCost, failReason, isLive, pairMeals
  };
})();
