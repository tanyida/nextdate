/* Next Date — main app: Preferences → Recommendations → Invitation, plus My plans and the partner RSVP page. */
(function () {
  const U = PL.util, E = PL.engine, S = PL.store, I = PL.invite;
  const esc = U.esc;
  const $app = document.getElementById('app');
  const catById = (id) => PL.CATEGORIES.find((c) => c.id === id) || { label: id, emoji: '✨' };

  // ---------------- state ----------------
  const state = {
    prefs: Object.assign(E.defaults(), S.sget('prefs', {})),
    plan: S.sget('plan', []),          // [{ id, mealIdx }]
    mealPick: S.sget('mealPick', {}),  // activityId → chosen restaurant id
    shown: S.sget('shown', []),        // ids shown so far (for shuffle)
    result: null,
    draft: S.sget('draft', null)       // invitation builder fields
  };
  // "Today" and "this weekend" are relative: refresh them on every visit.
  if (state.prefs.dateMode === 'today') state.prefs.date = U.sgToday();
  if (state.prefs.dateMode === 'weekend') state.prefs.date = U.thisWeekend();
  if (state.prefs.date < U.sgToday()) { state.prefs.dateMode = 'weekend'; state.prefs.date = U.thisWeekend(); }

  const persist = () => {
    S.sset('prefs', state.prefs); S.sset('plan', state.plan); S.sset('mealPick', state.mealPick);
    S.sset('shown', state.shown); S.sset('draft', state.draft);
  };

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------------- router ----------------
  function route() {
    let h = location.hash || '#/';
    if (h === '#/calendar') h = '#/events'; // old link
    document.body.dataset.route = h.split('/')[1] || 'home';
    // Highlight the current section in the top menu (plan flow = "Plan a date").
    const sec = { events: 'events', gifts: 'gifts', memories: 'memories', plans: 'plans' }[document.body.dataset.route] || 'plan';
    document.querySelectorAll('.mainnav a').forEach((a) => {
      if (a.dataset.nav === sec) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (h.startsWith('#/i/')) return viewPartner(h.slice(4));
    if (h.startsWith('#/r/')) return viewReceipt(h.slice(4));
    if (h === '#/results') return viewResults();
    if (h === '#/invite') return viewInvite();
    if (h === '#/plans') return viewPlans();
    const extra = PL.routes && PL.routes[h.slice(2)];
    if (extra) { removeTray(); return extra(); }
    return viewPrefs();
  }
  window.addEventListener('hashchange', route);

  // =====================================================================
  // Screen 1 — Preferences
  // =====================================================================
  function chips(group, options, selected, multi, extra) {
    const sel = multi ? selected : [selected];
    return `<div class="chips" role="group" aria-label="${esc(extra && extra.label || group)}">` + options.map((o) => {
      const v = typeof o === 'string' ? o : o.id, l = typeof o === 'string' ? o : o.label;
      const on = sel.includes(v);
      return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-group="${group}" data-value="${esc(v)}"${multi ? ' data-multi="1"' : ''}>${o.emoji ? '<span aria-hidden="true">' + o.emoji + '</span> ' : ''}${esc(l)}</button>`;
    }).join('') + '</div>';
  }

  function viewPrefs() {
    const p = state.prefs;
    const today = U.sgToday();
    const advancedOpen = S.sget('advOpen', false);
    $app.innerHTML = `
    <section class="screen prefs">
      <header class="hero">
        <h1>Where to next?</h1>
        <p>Tap a few chips and we'll plan the date: an activity, a meal nearby and an invite to send.</p>
      </header>

      <fieldset class="field"><legend>What kind of date? <span class="req">pick at least one</span></legend>
        ${chips('categories', PL.CATEGORIES, p.categories, true, { label: 'Date type' })}
      </fieldset>

      <fieldset class="field"><legend>Budget for two</legend>
        ${chips('budget', Object.entries(E.BUDGETS).map(([id, b]) => ({ id, label: b.label })), p.budget)}
      </fieldset>

      <fieldset class="field"><legend>How long?</legend>
        ${chips('duration', Object.entries(E.DURATIONS).map(([id, d]) => ({ id, label: d.label })), p.duration)}
      </fieldset>

      <fieldset class="field"><legend>When?</legend>
        ${chips('dateMode', [{ id: 'today', label: 'Today' }, { id: 'weekend', label: 'This weekend' }, { id: 'pick', label: 'Pick a date' }], p.dateMode)}
        <div class="date-row ${p.dateMode === 'pick' ? '' : 'hidden'}">
          <label for="date" class="sr-only">Date</label>
          <input type="date" id="date" min="${today}" max="${U.addDays(today, 365)}" value="${p.date}">
        </div>
        <p class="hint" id="date-label">${esc(U.fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        ${chips('slot', Object.entries(E.SLOTS).map(([id, s]) => ({ id, label: s.label })), p.slot)}
      </fieldset>

      <fieldset class="field"><legend>Which part of Singapore?</legend>
        ${chips('region', ['Anywhere', ...PL.REGIONS], p.region)}
      </fieldset>

      <fieldset class="field"><legend>Who's coming?</legend>
        ${chips('withKids', [{ id: 'no', label: '💑 Just us two' }, { id: 'yes', label: '👨‍👩‍👧 With kids' }], p.withKids ? 'yes' : 'no')}
        <div class="kids ${p.withKids ? '' : 'hidden'}">
          <p class="sublabel">Youngest kid's age</p>
          ${chips('kidAges', Object.keys(E.KID_AGES), p.kidAges)}
          <p class="sublabel">How many kids?</p>
          ${chips('kidCount', ['1', '2', '3'], String(p.kidCount))}
        </div>
        <p class="sublabel">Bringing a pet?</p>
        ${chips('withPet', [{ id: 'no', label: 'No pets' }, { id: 'yes', label: '🐾 Our pet is coming' }], p.withPet ? 'yes' : 'no')}
        <p class="hint pet-hint ${p.withPet ? '' : 'hidden'}">We'll only suggest places that welcome leashed pets. Nature reserves, attractions and food centres usually don't.</p>
      </fieldset>

      <details class="more" ${advancedOpen ? 'open' : ''} id="more">
        <summary>Meal, vibe & more <span class="hint">optional</span></summary>
        <fieldset class="field"><legend>Meal</legend>
          ${chips('meal', [{ id: 'auto', label: 'Auto (by time)' }, { id: 'brunch', label: 'Brunch' }, { id: 'lunch', label: 'Lunch' }, { id: 'dinner', label: 'Dinner' }, { id: 'drinks', label: 'Drinks only' }, { id: 'none', label: 'No meal' }], p.meal)}
        </fieldset>
        <fieldset class="field"><legend>Cuisine</legend>
          ${chips('cuisines', PL.CUISINES, p.cuisines, true, { label: 'Cuisine' })}
        </fieldset>
        <fieldset class="field"><legend>Dietary needs</legend>
          ${chips('dietary', PL.DIETARY, p.dietary, true, { label: 'Dietary' })}
        </fieldset>
        <fieldset class="field"><legend>Indoor or outdoor?</legend>
          ${chips('io', [{ id: 'either', label: 'Either' }, { id: 'indoor', label: 'Indoor' }, { id: 'outdoor', label: 'Outdoor' }], p.io)}
          <label class="switch"><input type="checkbox" id="rain" ${p.rainBackup ? 'checked' : ''}> <span>Rain backup for outdoor picks</span></label>
        </fieldset>
        <fieldset class="field"><legend>Vibe</legend>
          ${chips('vibes', PL.VIBES, p.vibes, true, { label: 'Vibe' })}
        </fieldset>
      </details>

      <div class="cta-bar">
        <button type="button" class="btn ghost" data-action="surprise" title="Builds a full plan from your current settings">🎲 Surprise me</button>
        <button type="button" class="btn primary" data-action="find" id="find">Find dates →</button>
      </div>
      <p class="cta-err hidden" id="cat-err" role="alert">Pick at least one kind of date first, or tap 🎲 Surprise me.</p>
    </section>`;

    const d = document.getElementById('date');
    d.addEventListener('change', () => {
      if (d.value && d.value >= today) { p.date = d.value; persist(); document.getElementById('date-label').textContent = U.fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' }); }
    });
    document.getElementById('rain').addEventListener('change', (e) => { p.rainBackup = e.target.checked; persist(); });
    document.getElementById('more').addEventListener('toggle', (e) => S.sset('advOpen', e.target.open));
  }

  function onChip(btn) {
    const p = state.prefs, g = btn.dataset.group, v = btn.dataset.value;
    if (btn.dataset.multi) {
      const arr = p[g]; const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      btn.classList.toggle('on', i < 0); btn.setAttribute('aria-pressed', String(i < 0));
      if (g === 'categories') document.getElementById('cat-err').classList.add('hidden');
    } else {
      btn.parentElement.querySelectorAll('.chip').forEach((c) => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true');
      if (g === 'withKids') { p.withKids = v === 'yes'; document.querySelector('.kids').classList.toggle('hidden', !p.withKids); }
      else if (g === 'withPet') { p.withPet = v === 'yes'; document.querySelector('.pet-hint').classList.toggle('hidden', !p.withPet); }
      else if (g === 'kidCount') p.kidCount = Number(v);
      else if (g === 'dateMode') {
        p.dateMode = v;
        if (v === 'today') p.date = U.sgToday();
        if (v === 'weekend') p.date = U.thisWeekend();
        document.querySelector('.date-row').classList.toggle('hidden', v !== 'pick');
        if (v === 'pick') document.getElementById('date').focus();
        document.getElementById('date-label').textContent = U.fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' });
      } else p[g] = v;
    }
    persist();
  }

  function submitPrefs(surprise) {
    const p = state.prefs;
    if (!p.categories.length && !surprise) {
      document.getElementById('cat-err').classList.remove('hidden');
      document.querySelector('.field').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    state.shown = []; state.result = null;
    S.sset('prefsDone', true);
    S.sset('seenPages', []); S.sset('resultsPage', 1); S.sset('resultsTab', 'ideas');
    S.sset('calDay', null); S.sset('calMonth', null); // the events calendar opens on the chosen date
    S.track('prefs_submitted');
    if (surprise) {
      S.track('surprise');
      const r = E.recommend(p, { limit: 10 });
      if (!r.items.length) { toast('No match for those settings. Try widening budget or region.'); return; }
      // Weighted pick among the top 3 so "surprise" stays surprising.
      const pick = r.items[Math.floor(Math.random() * Math.min(3, r.items.length))];
      state.plan = [{ id: pick.activity.id, mealIdx: 0 }];
      state.draft = null; persist();
      S.track('activity_selected');
      location.hash = '#/invite';
      return;
    }
    persist();
    // Came from "Latest events"? Go back there with the calendar filtered by these preferences.
    const next = S.sget('afterPrefs', null);
    S.sset('afterPrefs', null);
    location.hash = next || '#/results';
  }

  // =====================================================================
  // Screen 2 — Recommendations
  // =====================================================================
  function summaryChips(p) {
    const bits = [
      p.categories.length ? p.categories.map((c) => catById(c).label.split(' ')[0]).join(', ') : 'All types',
      E.BUDGETS[p.budget].label, E.DURATIONS[p.duration].label.replace(/ \(.*\)/, ''),
      U.fmtDate(p.date) + ' · ' + E.SLOTS[p.slot].label.toLowerCase(), p.region,
      p.withKids ? 'With kids (' + p.kidAges + ')' : 'Just us'
    ].concat(p.withPet ? ['🐾 With pet'] : []);
    return bits.map((b) => `<span class="pill">${esc(b)}</span>`).join('');
  }

  const PAGE_SIZE = 9;
  function runRecommend() {
    // Every matching idea, ranked (diversity rules apply to the top), shown 9 per page.
    const r = E.recommend(state.prefs, { limit: 200 });
    state.result = r; S.sset('resultsPage', 1); persist();
    return r;
  }

  function viewResults() {
    const p = state.prefs;
    if (!p.categories.length && !state.plan.length) { location.hash = '#/'; return; }
    const r = state.result || runRecommend();
    // Rank order across pages; on each page, "Happening now" events come first.
    const pg = U.paginate(r.items, S.sget('resultsPage', 1), PAGE_SIZE, 'data-action="results-page"', 'Result pages');
    const events = pg.items.filter((i) => i.activity.type === 'event');
    const ever = pg.items.filter((i) => i.activity.type !== 'event');
    const card = (it) => cardHTML(it);
    const seen = S.sget('seenPages', []);
    if (!seen.includes(pg.page)) { // count impressions & novelty once per page view
      pg.items.forEach((it) => S.bumpView(it.activity.id)); S.track('cards_shown', pg.items.length);
      S.sset('seenPages', seen.concat(pg.page));
    }
    const tab = S.sget('resultsTab', 'ideas');
    const tabs = `<div class="seg" role="tablist" aria-label="Results view">
        <button type="button" role="tab" aria-selected="${tab === 'ideas'}" data-action="results-tab" data-tab="ideas">💡 Date ideas</button>
        <button type="button" role="tab" aria-selected="${tab === 'events'}" data-action="results-tab" data-tab="events">📅 Latest events</button>
      </div>`;
    const summary = `<div class="summary">
        <a href="#/" class="back" aria-label="Back to preferences">←</a>
        <div class="pills">${summaryChips(p)}</div>
        <a href="#/" class="edit">Edit</a>
      </div>`;
    if (tab === 'events') {
      // Calendar of latest events, filtered by the preferences just stated.
      $app.innerHTML = `<section class="screen results">${summary}${tabs}<div class="cal-root" id="results-cal"></div></section>`;
      PL.calendar.render(document.getElementById('results-cal'), { embedded: true });
      removeTray(); // "Plan a date →" on an event goes straight to the invitation
      return;
    }
    $app.innerHTML = `
    <section class="screen results">
      ${summary}
      ${tabs}
      ${r.items.length < 3 ? emptyState(r) : ''}
      ${pg.pages > 1 ? `<p class="hint results-count">${r.items.length} date ideas · page ${pg.page} of ${pg.pages}</p>` : ''}
      ${events.length ? `<h2 class="section-h"><span class="live-dot" aria-hidden="true"></span> Happening on ${esc(U.fmtDate(p.date))}</h2><div class="card-grid">${events.map(card).join('')}</div>` : ''}
      ${ever.length ? `<h2 class="section-h">${events.length ? 'Evergreen ideas' : 'Date ideas for you'}</h2><div class="card-grid">${ever.map(card).join('')}</div>` : ''}
      ${pg.html}
      <p class="fineprint">Ranked by category, region, timeliness, vibe and novelty. ${r.totalMatches} ideas matched in ${r.ms} ms. Event dates are checked against your chosen day, and expired events never show.</p>
      <p class="fineprint">Photos marked 📷 come from the venue's or organiser's own website and link back to it. Other photos are freely licensed (Wikipedia / Wikimedia Commons); "Typical dish" and "Illustrative" photos show the food or activity, not that exact venue.</p>
    </section>`;
    PL.photos.hydrate($app);
    renderTray();
  }

  function emptyState(r) {
    return `<div class="empty">
      <p><strong>Only ${r.items.length} idea${r.items.length === 1 ? '' : 's'} match${r.items.length === 1 ? 'es' : ''} all your filters.</strong> Loosen one of these to see more:</p>
      <div class="chips">${r.relax.map((x, i) => `<button type="button" class="chip" data-action="relax" data-i="${i}">${esc(x.label)} <span class="count">${x.n}</span></button>`).join('') || '<span class="hint">Try different date types or another day.</span>'}</div>
    </div>`;
  }

  function priceText(a) {
    if (a.price_min == null && a.price_max == null) return 'Price on ' + String(a.source_name || 'the listing').replace(/^Idea via /, '');
    if (!a.price_min && !a.price_max) return 'Free';
    return (a.price_min ? '$' + a.price_min : 'Free') + (a.price_max && a.price_max !== a.price_min ? '–$' + a.price_max : '') + ' pp';
  }
  function dateText(a) {
    if (a.type !== 'event') return 'Evergreen';
    const left = U.daysBetween(state.prefs.date, a.end_date);
    const range = a.start_date === a.end_date ? U.fmtShort(a.start_date) : U.fmtShort(a.start_date) + ' – ' + U.fmtShort(a.end_date);
    const days = a.days ? ' · ' + a.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join('/') : '';
    const time = a.start_time ? ' · ' + U.fmtTime(U.toMin(a.start_time)) + (a.end_time ? '–' + U.fmtTime(U.toMin(a.end_time)) : '') : '';
    return range + days + time + (left <= 5 ? ` <span class="ending">${left === 0 ? 'last day!' : 'ends in ' + left + 'd'}</span>` : '');
  }

  // Photo block: own image_url if set, else a licensed Wikipedia photo; gradient + emoji underneath as fallback.
  function photoHTML(x, opts) {
    if (!x.image_url && !x.photo) return '';
    const title = x.name;
    const tag = x.image_url ? (x.image_credit ? '📷 ' + x.image_credit : '') : x.photo_kind === 'dish' ? 'Typical dish' : x.photo_kind === 'idea' ? 'Illustrative' : '';
    return `<figure class="ph ${opts.cls || ''}" data-photo="${esc(x.photo || '')}" data-kind="${esc(x.photo_kind || '')}" ${x.image_url ? `data-src="${esc(x.image_url)}" data-credit="${esc(x.image_credit || '')}" data-src-page="${esc(x.image_page || '')}"` : ''}
      data-w="${opts.w || 640}" data-alt="${esc((tag ? tag + ': ' : '') + title)}" data-title="${esc(title)}" data-action="photo" role="button" tabindex="0" aria-label="View photo: ${esc(title)}">
      ${tag ? `<span class="ph-tag">${tag}</span>` : ''}<span class="ph-zoom" aria-hidden="true">⤢</span></figure>`;
  }

  function pickedMeal(activityId, options) {
    const id = state.mealPick[activityId];
    return options.find((o) => o.r.id === id) || options[0];
  }

  function mealHTML(it) {
    const m = it.meals;
    if (m.meal === 'none') return '';
    const label = E.MEALS[m.meal].label;
    if (!m.options.length) return `<div class="meal none">🍽️ No ${esc(label.toLowerCase())} spot nearby matches your dietary filters. Try removing one.</div>`;
    const chosen = pickedMeal(it.activity.id, m.options);
    const dietLabel = (d) => d === 'halal' ? 'Halal' : d === 'vegetarian' ? 'Veg options' : 'No beef';
    // Collapsed to one line by default; expands to a swipeable row of options with photos.
    return `<details class="meals" data-mealfor="${it.activity.id}" ${openMeals.has(it.activity.id) ? 'open' : ''}>
      <summary><span class="meal-label">🍽️ ${esc(label)} nearby</span> <strong>${esc(chosen.r.name)}</strong>${chosen.r.reservation_required ? ' 📞' : ''} <span class="muted">· ${m.options.length} option${m.options.length === 1 ? '' : 's'}</span></summary>
      ${m.options.length < 3 ? `<p class="meal-note">Only ${m.options.length} nearby spot${m.options.length === 1 ? ' matches' : 's match'} your dietary needs.</p>` : ''}
      <div class="meal-scroll" role="radiogroup" aria-label="${esc(label)} options near ${esc(it.activity.name)}">
        ${m.options.map((o) => {
          const on = o === chosen, r = o.r;
          const dist = o.km < 1 ? Math.round(o.km * 1000) + ' m' : o.km.toFixed(1) + ' km';
          return `<div class="meal-opt ${on ? 'on' : ''}">
            ${photoHTML(r, { w: 400, cls: 'ph-meal' }) || '<div class="ph ph-meal failed"></div>'}
            <div class="meal-body">
              <strong>${esc(r.name)}</strong>
              <span class="meal-meta">${E.BAND_LABEL[r.price_band]} · ${esc(r.cuisines.slice(0, 2).join(', '))} · ~$${o.cost} for ${state.prefs.withKids ? 'all' : 'two'}</span>
              <span class="meal-meta">📍 ${dist} · ${o.mins} min${o.km <= 1 ? ' walk' : ''}${r.dietary.length ? ' · ' + esc(r.dietary.map(dietLabel).join(', ')) : ''}</span>
              ${o.overBudget ? '<span class="meal-meta warn">Over remaining budget</span>' : ''}
              ${r.pet_friendly ? '<span class="meal-meta pet">🐾 Pet-friendly seating</span>' : state.prefs.withPet ? '<span class="meal-meta">Pets: check with venue</span>' : ''}
              ${r.reservation_required
                ? `<a class="reserve" href="${esc(E.reserveUrl(r))}" target="_blank" rel="noopener">📞 Reservation recommended: ${r.booking_url ? 'Reserve a table' : 'Find &amp; reserve'} ↗</a>`
                : '<span class="meal-meta">Walk-in friendly</span>'}
              <button type="button" class="btn tiny ${on ? 'added' : ''}" role="radio" aria-checked="${on}" data-action="pick-meal" data-id="${it.activity.id}" data-r="${r.id}">${on ? '✓ Chosen' : 'Choose'}</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </details>`;
  }
  const openMeals = new Set(); // meal pickers the user has expanded (kept open across re-renders)
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement)) return;
    if (d.dataset.mealfor) { if (d.open) openMeals.add(d.dataset.mealfor); else openMeals.delete(d.dataset.mealfor); }
    if (d.open) PL.photos.hydrate(d); // load photos inside only when opened
  }, true);

  function cardHTML(it) {
    const a = it.activity, cat = catById(a.categories[0]);
    const inPlan = state.plan.some((x) => x.id === a.id);
    const saved = S.list('saved').includes(a.id);
    return `
    <article class="card" id="card-${a.id}">
      <div class="card-media cat-${a.categories[0]}">
        <span class="card-emoji" aria-hidden="true">${cat.emoji}</span>
        ${photoHTML(a, { w: 800, cls: 'ph-card' })}
        <span class="badge ${a.type === 'event' ? 'badge-live' : ''}">${a.type === 'event' ? 'Happening now' : 'Evergreen'}</span>
        ${a.sponsored ? '<span class="badge badge-sp">Sponsored</span>' : ''}
      </div>
      <div class="card-body">
        <div class="tags">${a.categories.slice(0, 2).map((c) => `<span class="tag">${esc(catById(c).label)}</span>`).join('')}</div>
        <h3>${esc(a.name)}</h3>
        <p class="desc clamp2" title="${esc(a.short_description)}">${esc(a.short_description)}</p>
        <p class="meta-line">📍 ${a.approx_location ? 'Location shared on booking <span class="muted">(meal ideas near the city centre)</span>' : `<a href="${esc(U.mapUrl(a))}" target="_blank" rel="noopener">${esc(a.venue)}</a> · ${esc(a.region)}`}${state.prefs.region !== 'Anywhere' && a.region !== state.prefs.region ? ' <span class="muted">(next to ' + esc(state.prefs.region) + ')</span>' : ''}</p>
        <ul class="facts-mini">
          <li>📅 ${dateText(a)}</li>
          <li title="${esc(a.price_note || '')}">💵 ${priceText(a)}</li>
          <li>⏱️ ${U.fmtDuration(a.duration_min)}</li>
          <li>${a.indoor_outdoor === 'indoor' ? '🏠 Indoor' : '🌤️ Outdoor'}</li>
          ${a.kid_friendly ? `<li>👶 Kids${a.kid_age_min ? ' ' + a.kid_age_min + '+' : ''}</li>` : a.source_name === 'Eventbrite' ? '' : '<li>🔞 Adults</li>'}
          ${a.pet_friendly ? '<li class="pet">🐾 Pet-friendly</li>' : ''}
        </ul>
        ${a.booking_required ? `<a class="book-link" href="${esc(E.bookingUrl(a))}" target="_blank" rel="noopener">🎟️ Booking needed · <span>Book tickets ↗</span></a>` : ''}
        ${mealHTML(it)}
        ${it.backup ? `<p class="backup">☔ Rain plan: <strong>${esc(it.backup.activity.name)}</strong> (${it.backup.km.toFixed(1)} km)</p>` : ''}
        ${it.tip ? `<p class="tip-mini clamp2" title="${esc(it.tip.text)}"><strong>💬 Expert tip:</strong> ${esc(it.tip.text)}</p>` : ''}
        <div class="actions">
          <button type="button" class="btn ${inPlan ? 'added' : 'primary'}" data-action="toggle-plan" data-id="${a.id}" aria-pressed="${inPlan}">${inPlan ? '✓ In plan' : '+ Add to plan'}</button>
          <button type="button" class="btn icon ${saved ? 'on' : ''}" data-action="save" data-id="${a.id}" aria-pressed="${saved}" aria-label="Save for later" title="Save for later">${saved ? '♥' : '♡'}</button>
          <button type="button" class="btn icon" data-action="done" data-id="${a.id}" aria-label="We've done this: hide it from future results" title="We've done this">✓ Done</button>
        </div>
        <p class="source">${esc(a.source_name)} · <a href="${esc(a.official_url)}" target="_blank" rel="noopener">Official page ↗</a> · Verified ${esc(U.fmtShort(a.last_verified_at))} · <a href="mailto:hello@nextdate.sg?subject=${encodeURIComponent('Issue with listing: ' + a.name)}">Report</a></p>
      </div>
    </article>`;
  }

  // Plan items resolved against the current preferences.
  function planItems() {
    const content = S.content(), p = state.prefs;
    const budgetMax = E.BUDGETS[p.budget].max;
    let spent = 0;
    return state.plan.map((x) => {
      const a = content.activities.find((y) => y.id === x.id);
      if (!a) return null;
      const cost = E.activityCost(a, p);
      spent += cost;
      const left = budgetMax === Infinity ? 400 : budgetMax - spent;
      const meals = E.pairMeals(a, p, content, left);
      const meal = meals.options.length ? pickedMeal(a.id, meals.options) : null;
      return { activity: a, cost, meals, meal };
    }).filter(Boolean)
      // One meal per plan, paired with the activity it sits next to (first if the meal opens the date).
      .map((it, i, arr) => Object.assign(it, { meal: i === (E.mealFirst(p) ? 0 : arr.length - 1) ? it.meal : null }));
  }

  function renderTray() {
    let tray = document.getElementById('tray');
    if (!tray) { tray = document.createElement('div'); tray.id = 'tray'; tray.className = 'tray'; document.body.appendChild(tray); }
    const items = planItems();
    if (!items.length) { tray.innerHTML = `<div class="tray-inner empty-tray">Add up to 3 ideas to build your plan</div>`; return; }
    const it = E.itinerary(items, state.prefs);
    tray.innerHTML = `
      <div class="tray-inner">
        <details class="tray-list">
          <summary><strong>Your plan (${items.length}/3)</strong> <span class="muted">~${U.fmtDuration(it.totalMin)} · ~$${it.cost}${items.some((x) => x.activity.price_min == null) ? ' + tickets' : ''} est.</span></summary>
          <ol>${items.map((x) => `<li>${esc(x.activity.name)}${x.meal ? ' → ' + esc(x.meal.r.name) : ''} <button type="button" class="btn tiny" data-action="toggle-plan" data-id="${x.activity.id}" aria-label="Remove ${esc(x.activity.name)}">✕</button></li>`).join('')}</ol>
        </details>
        <a href="#/invite" class="btn primary">Create invitation →</a>
      </div>`;
  }

  function togglePlan(id) {
    const i = state.plan.findIndex((x) => x.id === id);
    if (i >= 0) state.plan.splice(i, 1);
    else {
      if (state.plan.length >= 3) { toast('A plan can have up to 3 items.'); return; }
      state.plan.push({ id, mealIdx: 0 }); S.track('activity_selected');
    }
    persist();
    refreshCard(id); renderTray();
  }
  function refreshCard(id) {
    const el = document.getElementById('card-' + id);
    const it = state.result && state.result.items.find((x) => x.activity.id === id);
    if (el && it) { el.outerHTML = cardHTML(it); PL.photos.hydrate(document.getElementById('card-' + id)); }
  }

  // =====================================================================
  // Screen 3 — Invitation builder
  // =====================================================================
  function viewInvite() {
    removeTray();
    const items = planItems();
    if (!items.length) { location.hash = state.result ? '#/results' : '#/'; return; }
    S.track('invite_page');
    const content = S.content();
    // Conversation starter: an approved expert tip matching the first activity.
    const tipObj = content.tips.find((x) => x.approved && x.categories.some((c) => items[0].activity.categories.includes(c)));
    const tip = tipObj ? tipObj.text : '';
    if (!state.draft) {
      state.draft = { tpl: state.prefs.withKids ? 'family' : (state.prefs.vibes.includes('romantic') ? 'romantic' : 'playful'), to: '', from: '', msg: '', line: '', lineN: 0, showCost: true, useStarter: true };
    }
    const d = state.draft;
    $app.innerHTML = `
    <section class="screen invite">
      <div class="summary">
        <a href="#/results" class="back" aria-label="Back to recommendations">←</a>
        <h1 class="screen-h">Make it an invitation</h1>
      </div>
      <div class="invite-grid">
        <form class="inv-form" id="inv-form" autocomplete="off">
          <fieldset class="field"><legend>Design</legend>
            <div class="tpl-picker" role="radiogroup" aria-label="Template">
              ${I.TEMPLATES.map((t) => `<button type="button" role="radio" aria-checked="${d.tpl === t.id}" class="tpl-opt ${d.tpl === t.id ? 'on' : ''}" data-action="tpl" data-tpl="${t.id}" style="--a:${t.accent};--b:${t.bg}"><span class="sw" aria-hidden="true">${t.emoji}</span>${esc(t.name)}</button>`).join('')}
            </div>
          </fieldset>
          <fieldset class="field"><legend>Your plan <span class="hint">swap anything for something new</span></legend>
            <ul class="plan-items">
              ${items.map((it, i) => `<li>
                <span class="pi-name">${catById(it.activity.categories[0]).emoji} ${esc(it.activity.name)}${it.meal ? `<br><small class="muted">🍽️ ${esc(it.meal.r.name)}</small>` : ''}</span>
                <button type="button" class="btn tiny" data-action="swap-item" data-i="${i}" aria-label="Swap ${esc(it.activity.name)} for another idea">🔄 Swap</button>
              </li>`).join('')}
            </ul>
            <button type="button" class="btn tiny" data-action="new-plan">🎲 Try a different plan</button>
          </fieldset>
          <fieldset class="field"><legend>How much should they know?</legend>
            <div class="seg seg-sm" role="radiogroup" aria-label="How much to reveal">
              ${[['full', '📋 Full plan'], ['teaser', '🔍 Teaser'], ['mystery', '🎁 Mystery']].map(([m, l]) => `<button type="button" role="radio" aria-checked="${(d.mode || 'full') === m}" data-action="reveal" data-mode="${m}">${l}</button>`).join('')}
            </div>
            <p class="hint">${{ full: 'Shows every place, address and booking link.', teaser: 'Shows quirky clues, the area and the type of activity, but not the actual places.', mystery: 'Just playful clues, times and a dress code. The real places stay a secret.' }[d.mode || 'full']}</p>
            ${(d.mode || 'full') !== 'full' ? '<button type="button" class="btn tiny" data-action="new-hints">🔀 New hints</button> <span class="hint">You\'ll still see the full plan in My plans.</span>' : ''}
          </fieldset>
          <div class="two">
            <label class="text-field">Partner's name<input name="to" maxlength="40" value="${esc(d.to)}" placeholder="e.g. Wei Ling"></label>
            <label class="text-field">Your name<input name="from" maxlength="40" value="${esc(d.from)}" placeholder="e.g. Marcus"></label>
          </div>
          <label class="text-field">Opening line
            <span class="with-btn"><input name="line" maxlength="120" value="${esc(d.line)}" placeholder="Tap ✨ for a suggestion"><button type="button" class="btn tiny" data-action="suggest">✨ Suggest</button></span>
          </label>
          <label class="text-field">Personal message <span class="hint">optional</span><textarea name="msg" rows="3" maxlength="300" placeholder="Something only you'd say…">${esc(d.msg)}</textarea></label>
          <label class="switch"><input type="checkbox" name="showCost" ${d.showCost ? 'checked' : ''}> <span>Show estimated cost</span></label>
          <label class="switch"><input type="checkbox" name="useStarter" ${d.useStarter && tip ? 'checked' : ''} ${tip ? '' : 'disabled'}> <span>Add an expert conversation starter</span></label>
          ${bookingChecklist(items)}
          <p class="hint">We only store first names. Anyone with the link can open the invite, and it expires 30 days after the date.</p>
          <button type="button" class="btn primary wide" data-action="create-link">💌 Create invitation link</button>
          <div id="share-panel"></div>
        </form>
        <div class="preview" id="preview" aria-live="polite"></div>
      </div>
    </section>`;
    const form = document.getElementById('inv-form');
    form.addEventListener('input', () => {
      const fd = new FormData(form);
      d.to = fd.get('to').trim(); d.from = fd.get('from').trim(); d.line = fd.get('line'); d.msg = fd.get('msg');
      d.showCost = !!fd.get('showCost'); d.useStarter = !!fd.get('useStarter');
      d.link = null; persist(); renderPreview(tip);
      document.getElementById('share-panel').innerHTML = '';
    });
    renderPreview(tip);
    viewInvite._tip = tip;
  }

  function bookingChecklist(items) {
    const rows = [];
    items.forEach((it) => {
      if (it.activity.booking_required) rows.push(`<li><a href="${esc(E.bookingUrl(it.activity))}" target="_blank" rel="noopener">🎟️ Book tickets: ${esc(it.activity.name)} ↗</a></li>`);
      if (it.meal && it.meal.r.reservation_required) rows.push(`<li><a href="${esc(E.reserveUrl(it.meal.r))}" target="_blank" rel="noopener">📞 Reserve a table: ${esc(it.meal.r.name)} ↗</a></li>`);
    });
    return rows.length ? `<div class="checklist"><p><strong>Before you send, lock these in:</strong></p><ul>${rows.join('')}</ul></div>` : '';
  }

  function currentInvite(tip) {
    const d = state.draft;
    return I.build(planItems(), state.prefs, {
      id: d.id, tpl: d.tpl, to: d.to, from: d.from, msg: d.msg.trim(), line: d.line.trim(),
      starter: d.useStarter ? tip : '', showCost: d.showCost, mode: d.mode || 'full', hintSeed: d.hintSeed || 0
    });
  }

  // Variety: other good ideas for the same preferences, used to swap one item or the whole plan.
  function altCandidates() {
    const r = E.recommend(state.prefs, { limit: 60 });
    const inPlan = new Set(state.plan.map((x) => x.id));
    return r.items.map((i) => i.activity.id).filter((id) => !inPlan.has(id));
  }
  function swapPlan(index) {
    const alts = altCandidates();
    if (!alts.length) { toast('No other ideas match these preferences. Try widening them.'); return; }
    state.swapPtr = ((state.swapPtr || 0) + 1) % alts.length;
    if (index == null) {
      // Whole new plan with the same number of items.
      const n = state.plan.length || 1, start = (state.swapPtr * n) % alts.length;
      const fresh = [];
      for (let k = 0; k < n && k < alts.length; k++) fresh.push({ id: alts[(start + k) % alts.length] });
      state.plan = fresh;
    } else {
      state.plan[index] = { id: alts[state.swapPtr % alts.length] };
    }
    state.draft.link = null; state.draft.hintSeed = (state.draft.hintSeed || 0) + 1;
    persist(); S.track('plan_swapped');
    viewInvite();
  }
  function renderPreview(tip) {
    document.getElementById('preview').innerHTML = I.cardHTML(currentInvite(tip));
  }

  function baseUrl() { return location.href.split('#')[0]; }

  async function createLink() {
    const d = state.draft;
    if (!d.to || !d.from) { toast('Add both names first.'); document.querySelector(d.to ? '[name=from]' : '[name=to]').focus(); return; }
    d.id = d.id || U.randomId(9);
    const inv = currentInvite(viewInvite._tip);
    const packed = await U.pack(inv);
    const url = baseUrl() + '#/i/' + packed;
    d.link = url; persist();
    // Save to "My plans" (local only).
    const plans = S.get('plans', []).filter((x) => x.id !== inv.id);
    // Keep the full plan for yourself, even when the shared link only carries hints.
    const full = inv.mode === 'full' ? inv : I.build(planItems(), state.prefs, Object.assign({}, inv, { mode: 'full' }));
    plans.unshift({ id: inv.id, url, to: inv.to, date: inv.date, mode: inv.mode, title: (inv.mode !== 'full' ? '🎁 ' : '') + full.steps.filter((s) => s.k === 'a').map((s) => s.n).join(' + '), cost: inv.cost, created_at: new Date().toISOString(), rsvp: null, inv: full });
    S.set('plans', plans.slice(0, 50));
    S.track('invite_created');
    const text = I.shareText(inv, url);
    const tgText = text.replace(': ' + url, '');
    const isFile = location.protocol === 'file:';
    document.getElementById('share-panel').innerHTML = `
      <div class="share">
        <h3>Send it 💌</h3>
        ${isFile ? '<p class="warn">You\'re running from a local file, so this link only works on this device. Host the app (see README) to share it.</p>' : ''}
        <div class="share-grid">
          <a class="btn share-wa" href="${esc(I.whatsapp(text))}" target="_blank" rel="noopener" data-share="whatsapp">WhatsApp</a>
          <a class="btn share-tg" href="${esc(I.telegram(url, tgText))}" target="_blank" rel="noopener" data-share="telegram">Telegram</a>
          <button type="button" class="btn" data-action="copy-link">Copy link</button>
          ${navigator.share ? '<button type="button" class="btn" data-action="native-share">More…</button>' : ''}
          <button type="button" class="btn" data-action="dl-png">Save image</button>
          <button type="button" class="btn" data-action="dl-pdf">Save PDF</button>
          <button type="button" class="btn" data-action="dl-ics">Add to calendar</button>
          <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Preview link ↗</a>
        </div>
        <p class="hint">When your partner replies, they'll send you a response link. Open it to update <a href="#/plans">My plans</a>.</p>
      </div>`;
    document.getElementById('share-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // =====================================================================
  // My plans (saved locally; works offline via the service worker)
  // =====================================================================
  function viewPlans() {
    removeTray();
    const plans = S.get('plans', []);
    const content = S.content();
    const find = (id) => content.activities.find((a) => a.id === id);
    const saved = S.list('saved').map(find).filter(Boolean);
    const done = S.list('done').map(find).filter(Boolean);
    const rs = { yes: '✅ I\'m in!', time: '🕑 Another time', else: '🔄 Something else' };
    $app.innerHTML = `
    <section class="screen plans">
      <h1 class="screen-h">My plans</h1>
      <p class="hint">Stored on this device only, no account needed. Available offline once loaded.</p>
      <h2 class="section-h">Invitations sent</h2>
      ${plans.length ? plans.map((x) => `
        <div class="row-card">
          <div><strong>${esc(x.title)}</strong><br><span class="muted">For ${esc(x.to)} · ${esc(U.fmtDate(x.date))} · ~$${x.cost}</span>
          <br><span class="rsvp ${x.rsvp ? 'rsvp-' + x.rsvp.s : ''}">${x.rsvp ? rs[x.rsvp.s] + (x.rsvp.note ? ': “' + esc(x.rsvp.note) + '”' : '') : 'Waiting for reply…'}</span></div>
          <div class="row-actions">
            ${x.date <= U.sgToday() ? `<button type="button" class="btn tiny primary" data-action="add-memory" data-id="${esc(x.id)}">📸 Add memory</button>` : ''}
            <a class="btn tiny" href="${esc(x.url)}" target="_blank" rel="noopener">Open</a>
            <button type="button" class="btn tiny" data-action="copy" data-text="${esc(x.url)}">Copy</button>
            <button type="button" class="btn tiny" data-action="del-plan" data-id="${esc(x.id)}" aria-label="Delete plan">✕</button>
          </div>
        </div>`).join('') : '<p class="muted">No invitations yet. <a href="#/">Plan a date →</a></p>'}
      <h2 class="section-h">Saved for later</h2>
      ${saved.length ? saved.map((a) => `<div class="row-card"><div><strong>${esc(a.name)}</strong><br><span class="muted">${esc(a.venue)} · ${esc(a.region)}${E.isLive(a, U.sgToday()) ? '' : ' · <span class="warn">no longer available</span>'}</span></div><div class="row-actions"><button type="button" class="btn tiny" data-action="plan-from-saved" data-id="${a.id}">Plan this</button><button type="button" class="btn tiny" data-action="unsave" data-id="${a.id}" aria-label="Remove">✕</button></div></div>`).join('') : '<p class="muted">Tap ♡ on any idea to save it here.</p>'}
      <h2 class="section-h">Saved gift ideas</h2>
      ${(() => {
        const gifts = S.list('savedGifts').map((id) => (PL.GIFTS || []).find((g) => g.id === id)).filter(Boolean);
        return gifts.length ? gifts.map((g) => `<div class="row-card"><div><strong>${esc(g.name)}</strong><br><span class="muted">${esc(g.supplier)} · ${esc(PL.GIFT_BANDS[g.band])}</span></div><div class="row-actions">${g.url ? `<a class="btn tiny" href="${esc(g.url)}" target="_blank" rel="noopener">Visit ↗</a>` : ''}<button type="button" class="btn tiny" data-action="unsave-gift" data-id="${g.id}" aria-label="Remove">✕</button></div></div>`).join('')
          : '<p class="muted">Tap ♡ on any <a href="#/gifts">gift idea</a> to keep it here.</p>';
      })()}
      <h2 class="section-h">We've done this <span class="hint">(hidden from results)</span></h2>
      ${done.length ? done.map((a) => `<div class="row-card"><div><strong>${esc(a.name)}</strong></div><div class="row-actions"><button type="button" class="btn tiny" data-action="undone" data-id="${a.id}">Show again</button></div></div>`).join('') : '<p class="muted">Nothing hidden yet.</p>'}
    </section>`;
  }

  // =====================================================================
  // Partner page (RSVP) — opened from the shared link
  // =====================================================================
  async function viewPartner(token) {
    removeTray();
    let inv;
    try { inv = await U.unpack(token); } catch (e) { inv = null; }
    if (!inv || !inv.steps) { $app.innerHTML = `<section class="screen center"><h1>Hmm, this link looks broken</h1><p>Ask the sender to share it again.</p><a class="btn primary" href="#/">Plan your own date</a></section>`; return; }
    if (inv.exp && inv.exp < U.sgToday()) { $app.innerHTML = `<section class="screen center"><h1>This invitation has expired</h1><p>Links expire 30 days after the date to keep plans private.</p><a class="btn primary" href="#/">Plan a new date</a></section>`; return; }
    const mine = S.get('plans', []).find((x) => x.id === inv.id);
    $app.innerHTML = `
    <section class="screen partner">
      ${mine ? '<p class="banner">This is the invitation you sent. Here\'s how it looks to them.</p>' : ''}
      <div class="preview solo">${I.cardHTML(inv)}</div>
      <div class="rsvp-box" id="rsvp">
        <h2>Your reply to ${esc(inv.from || 'them')}</h2>
        <div class="rsvp-btns">
          <button type="button" class="btn primary" data-action="rsvp" data-s="yes">I'm in! 💖</button>
          <button type="button" class="btn" data-action="rsvp" data-s="time">Suggest another time</button>
          <button type="button" class="btn" data-action="rsvp" data-s="else">Let's pick something else</button>
        </div>
        <label class="text-field">Add a note <span class="hint">optional</span><input id="rsvp-note" maxlength="140" placeholder="e.g. Can we do Sunday instead?"></label>
        <div id="rsvp-send"></div>
      </div>
      <div class="partner-actions">
        <button type="button" class="btn" data-action="dl-ics-partner">📅 Add to calendar</button>
        <a class="btn ghost" href="#/">Plan your own date →</a>
      </div>
    </section>`;
    viewPartner._inv = inv;
  }

  async function sendRsvp(s) {
    const inv = viewPartner._inv;
    const note = document.getElementById('rsvp-note').value.trim();
    const packed = await U.pack({ id: inv.id, s, note, to: inv.to });
    const url = baseUrl() + '#/r/' + packed;
    const msg = { yes: `I'm in! 💖 ${U.fmtDate(inv.date)} it is.`, time: 'Love it, but can we do another time?', else: 'Let\'s pick something else together?' }[s];
    const text = msg + (note ? ' ' + note : '') + ' (tap to update your plan: ' + url + ')';
    S.track('rsvp_' + s);
    document.querySelectorAll('[data-action=rsvp]').forEach((b) => b.classList.toggle('on', b.dataset.s === s));
    document.getElementById('rsvp-send').innerHTML = `
      <p><strong>Nice. Now let ${esc(inv.from || 'them')} know:</strong></p>
      <div class="share-grid">
        <a class="btn share-wa" href="${esc(I.whatsapp(text))}" target="_blank" rel="noopener">Reply on WhatsApp</a>
        <a class="btn share-tg" href="${esc(I.telegram(url, msg + (note ? ' ' + note : '')))}" target="_blank" rel="noopener">Reply on Telegram</a>
        <button type="button" class="btn" data-action="copy" data-text="${esc(text)}">Copy reply</button>
      </div>`;
  }

  async function viewReceipt(token) {
    removeTray();
    let r;
    try { r = await U.unpack(token); } catch (e) { r = null; }
    const plans = S.get('plans', []);
    const p = r && plans.find((x) => x.id === r.id);
    if (p) { p.rsvp = { s: r.s, note: r.note, at: new Date().toISOString() }; S.set('plans', plans); }
    const label = r ? { yes: 'said yes! 🎉', time: 'would like another time', else: 'wants to pick something else' }[r.s] : '';
    $app.innerHTML = `<section class="screen center">
      ${r ? `<h1>${esc(r.to || 'Your partner')} ${label}</h1>${r.note ? `<p class="quote">“${esc(r.note)}”</p>` : ''}
      <p>${p ? 'Saved to My plans.' : 'Open this link on the device you sent the invitation from to save it to My plans.'}</p>` : '<h1>We couldn\'t read that reply link.</h1>'}
      <div class="row-actions center"><a class="btn primary" href="#/plans">My plans</a>${r && r.s !== 'yes' ? '<a class="btn" href="#/">Plan another</a>' : ''}</div>
    </section>`;
  }

  function removeTray() { const t = document.getElementById('tray'); if (t) t.remove(); }

  // =====================================================================
  // Event delegation
  // =====================================================================
  document.addEventListener('click', async (e) => {
    const chip = e.target.closest('.chip[data-group]');
    if (chip) { onChip(chip); return; }
    const shareA = e.target.closest('[data-share]');
    if (shareA) { S.track('shared'); S.track('shared_' + shareA.dataset.share); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action, id = el.dataset.id;
    switch (act) {
      case 'find': submitPrefs(false); break;
      case 'surprise': submitPrefs(true); break;
      case 'relax': {
        const x = state.result.relax[Number(el.dataset.i)];
        Object.assign(state.prefs, x.patch); state.result = null; state.shown = []; persist(); viewResults(); break;
      }
      case 'results-page': S.sset('resultsPage', Number(el.dataset.p)); viewResults(); window.scrollTo(0, 0); break;
      case 'results-tab': S.sset('resultsTab', el.dataset.tab); viewResults(); window.scrollTo(0, 0); break;
      case 'toggle-plan': togglePlan(id); break;
      case 'pick-meal': {
        state.mealPick[id] = el.dataset.r; persist();
        const scroll = el.closest('.meal-scroll'), x = scroll ? scroll.scrollLeft : 0;
        refreshCard(id); renderTray();
        const ns = document.querySelector('#card-' + id + ' .meal-scroll'); if (ns) ns.scrollLeft = x;
        if (!state.plan.some((p) => p.id === id)) toast('Meal chosen. Tap "+ Add to plan" to include it.');
        break;
      }
      case 'photo': PL.photos.open(el); break;
      case 'add-memory': {
        const p = S.get('plans', []).find((x) => x.id === id);
        if (p) S.sset('memPrefill', { title: p.title, date: p.date, planId: p.id, place: p.inv ? p.inv.steps.filter((s) => s.k === 'a').map((s) => s.ve || s.n).join(' & ') : '' });
        location.hash = '#/memories'; break;
      }
      case 'save': { const on = S.toggleIn('saved', id, !S.list('saved').includes(id)); toast(on ? 'Saved for later ♥' : 'Removed from saved'); refreshCard(id); break; }
      case 'done': {
        S.toggleIn('done', id, true);
        state.plan = state.plan.filter((x) => x.id !== id); persist();
        const card = document.getElementById('card-' + id);
        if (card) { card.classList.add('gone'); setTimeout(() => card.remove(), 250); }
        state.result.items = state.result.items.filter((x) => x.activity.id !== id);
        renderTray(); toast('Hidden from future results. Undo in My plans.'); break;
      }
      case 'tpl':
        state.draft.tpl = el.dataset.tpl; state.draft.link = null; persist();
        document.querySelectorAll('.tpl-opt').forEach((b) => { const on = b.dataset.tpl === state.draft.tpl; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
        renderPreview(viewInvite._tip); document.getElementById('share-panel').innerHTML = ''; break;
      case 'reveal': state.draft.mode = el.dataset.mode; state.draft.link = null; persist(); viewInvite(); break;
      case 'new-hints': state.draft.hintSeed = (state.draft.hintSeed || 0) + 1; state.draft.link = null; persist(); renderPreview(viewInvite._tip); document.getElementById('share-panel').innerHTML = ''; break;
      case 'swap-item': swapPlan(Number(el.dataset.i)); break;
      case 'new-plan': swapPlan(null); break;
      case 'suggest': {
        const d = state.draft; d.lineN = (d.lineN || 0) + 1;
        d.line = I.suggestLine(d.tpl, d.to, state.prefs.date, d.lineN);
        document.querySelector('[name=line]').value = d.line; persist(); renderPreview(viewInvite._tip); break;
      }
      case 'create-link': await createLink(); break;
      case 'copy-link': copy(state.draft.link); S.track('shared'); S.track('shared_copy'); break;
      case 'copy': copy(el.dataset.text); break;
      case 'native-share': {
        try { await navigator.share({ title: 'A date invitation 💌', text: state.draft.line || 'Date?', url: state.draft.link }); S.track('shared'); S.track('shared_native'); } catch (err) { /* cancelled */ }
        break;
      }
      case 'dl-png': {
        const inv = currentInvite(viewInvite._tip);
        U.download('next-date-invite.png', await I.toPNG(inv)); S.track('shared'); S.track('shared_image'); break;
      }
      case 'dl-pdf': S.track('shared'); S.track('shared_pdf'); window.print(); break;
      case 'dl-ics': U.download('next-date-date.ics', I.ics(currentInvite(viewInvite._tip)), 'text/calendar'); break;
      case 'dl-ics-partner': U.download('next-date-date.ics', I.ics(viewPartner._inv), 'text/calendar'); break;
      case 'rsvp': await sendRsvp(el.dataset.s); break;
      case 'del-plan': S.set('plans', S.get('plans', []).filter((x) => x.id !== id)); viewPlans(); break;
      case 'unsave': S.toggleIn('saved', id, false); viewPlans(); break;
      case 'unsave-gift': S.toggleIn('savedGifts', id, false); viewPlans(); break;
      case 'undone': S.toggleIn('done', id, false); viewPlans(); break;
      case 'plan-from-saved': state.plan = [{ id, mealIdx: 0 }]; state.draft = null; persist(); location.hash = '#/invite'; break;
    }
  });

  // Keyboard access for photo tiles (role="button").
  document.addEventListener('keydown', (e) => {
    const f = e.target.closest && e.target.closest('figure.ph[data-action="photo"]');
    if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); PL.photos.open(f); }
  });

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied!'); }
    catch (e) { window.prompt('Copy this:', text); }
  }

  // PWA: register service worker when served over http(s).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // Shared with the Calendar and Memory book pages (js/calendar.js, js/memories.js).
  PL.app = { state, persist, toast, photoHTML, priceText, catById, $app, copy };

  route();
})();
