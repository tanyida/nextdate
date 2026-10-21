/* Calendar page (#/calendar): a month widget of upcoming events (Eventbrite imports + editor listings),
 * filtered by the couple's preferences. Tap a day to see what's on and plan a date around it. */
window.PL = window.PL || {};
PL.routes = PL.routes || {};

(function () {
  const U = PL.util, E = PL.engine, S = PL.store, esc = U.esc;
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function filters() {
    const p = PL.app.state.prefs;
    return S.sget('calFilters', null) || {
      categories: p.categories.slice(), budget: p.budget, region: p.region, slot: 'any', kids: p.withKids, source: 'all'
    };
  }
  function saveFilters(f) { S.sset('calFilters', f); }

  function covers(a, day) {
    return a.start_date <= day && day <= a.end_date && (!a.days || a.days.includes(U.weekday(day)));
  }
  function matches(a, day, f, today) {
    if (a.type !== 'event' || !E.isLive(a, today) || day < today || !covers(a, day)) return false;
    if (f.source === 'eventbrite' && a.source_name !== 'Eventbrite') return false;
    if (f.source === 'editors' && a.source_name === 'Eventbrite') return false;
    if (f.categories.length && !a.categories.some((c) => f.categories.includes(c))) return false;
    if (a.price_min != null && E.activityCost(a, { withKids: f.kids, kidCount: 1 }) > E.BUDGETS[f.budget].max) return false;
    if (f.region !== 'Anywhere' && a.region !== f.region) return false;
    if (f.slot !== 'any' && !a.time_slots.includes(f.slot)) return false;
    if (f.kids && !a.kid_friendly) return false;
    return true;
  }
  const byTime = (x, y) => (x.start_time || '99') < (y.start_time || '99') ? -1 : 1;

  function chips(group, opts, sel, multi) {
    return `<div class="chips">` + opts.map((o) => {
      const v = o.id, on = multi ? sel.includes(v) : sel === v;
      return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-cal="${group}" data-v="${esc(v)}">${o.emoji ? o.emoji + ' ' : ''}${esc(o.label)}</button>`;
    }).join('') + `</div>`;
  }

  function render() {
    const { $app } = PL.app;
    const f = filters();
    const today = U.sgToday();
    const content = S.content();
    const month = S.sget('calMonth', today.slice(0, 7)); // YYYY-MM
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`;
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = (U.weekday(first) + 6) % 7; // Monday-first grid

    const perDay = {};
    for (let d = 1; d <= daysIn; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`;
      perDay[day] = content.activities.filter((a) => matches(a, day, f, today)).sort(byTime);
    }
    let sel = S.sget('calDay', null);
    if (!sel || sel.slice(0, 7) !== month || sel < today) {
      sel = Object.keys(perDay).find((d) => d >= today && perDay[d].length) || (today.slice(0, 7) === month ? today : first);
    }
    const list = perDay[sel] || [];
    const total = Object.values(perDay).reduce((n, l) => n + l.length, 0);
    const monthName = U.parseDate(first).toLocaleDateString('en-SG', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    const canPrev = month > today.slice(0, 7);
    const fetched = PL.EVENTBRITE_FETCHED_AT ? new Date(PL.EVENTBRITE_FETCHED_AT).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank" aria-hidden="true"></span>');
    for (let d = 1; d <= daysIn; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`, n = perDay[day].length, past = day < today;
      const label = `${U.fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${past ? 'past' : n + ' event' + (n === 1 ? '' : 's')}`;
      cells.push(`<button type="button" class="cal-cell${day === sel ? ' sel' : ''}${day === today ? ' today' : ''}${past ? ' past' : ''}${n ? ' has' : ''}"
        data-day="${day}" ${past ? 'disabled' : ''} aria-label="${esc(label)}" aria-pressed="${day === sel}">
        <span class="cal-num">${d}</span>${n ? `<span class="cal-count">${n}</span>` : ''}</button>`);
    }

    $app.innerHTML = `
    <section class="screen calendar">
      <header class="cal-head">
        <h1 class="screen-h">What's on</h1>
        <p class="hint">Upcoming events that match your preferences. Tap a day to see them.</p>
      </header>

      <details class="more cal-filters" ${S.sget('calOpen', false) ? 'open' : ''} id="cal-filters">
        <summary>Filters <span class="hint">${esc(summary(f))}</span></summary>
        <fieldset class="field"><legend>Date type</legend>${chips('categories', PL.CATEGORIES, f.categories, true)}</fieldset>
        <fieldset class="field"><legend>Budget for two</legend>${chips('budget', Object.entries(E.BUDGETS).map(([id, b]) => ({ id, label: b.label })), f.budget)}</fieldset>
        <fieldset class="field"><legend>Region</legend>${chips('region', ['Anywhere', ...PL.REGIONS].map((r) => ({ id: r, label: r })), f.region)}</fieldset>
        <fieldset class="field"><legend>Time of day</legend>${chips('slot', [{ id: 'any', label: 'Any time' }, ...Object.entries(E.SLOTS).map(([id, s]) => ({ id, label: s.label }))], f.slot)}</fieldset>
        <fieldset class="field"><legend>Who's coming</legend>${chips('kids', [{ id: 'no', label: '💑 Just us' }, { id: 'yes', label: '👨‍👩‍👧 Kid-friendly only' }], f.kids ? 'yes' : 'no')}</fieldset>
        <fieldset class="field"><legend>Source</legend>${chips('source', [{ id: 'all', label: 'All' }, { id: 'eventbrite', label: 'Eventbrite' }, { id: 'editors', label: 'Editors\' picks' }], f.source)}</fieldset>
        <div class="row-actions" style="justify-content:flex-start;margin-top:14px">
          <button type="button" class="btn tiny" data-calact="mine">Use my preferences</button>
          <button type="button" class="btn tiny" data-calact="clear">Show everything</button>
        </div>
      </details>

      <div class="cal" role="group" aria-label="Event calendar">
        <div class="cal-nav">
          <button type="button" class="btn icon" data-calact="prev" ${canPrev ? '' : 'disabled'} aria-label="Previous month">‹</button>
          <h2>${esc(monthName)}</h2>
          <button type="button" class="btn icon" data-calact="next" aria-label="Next month">›</button>
        </div>
        <div class="cal-grid">
          ${WEEK.map((w) => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join('')}
          ${cells.join('')}
        </div>
        <p class="cal-foot">${total} matching event-day${total === 1 ? '' : 's'} this month${today.slice(0, 7) !== month ? '' : ' · <button type="button" class="linkish" data-calact="today">Jump to today</button>'}</p>
      </div>

      <h2 class="section-h">${esc(U.fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }))} <span class="hint">${list.length} event${list.length === 1 ? '' : 's'}</span></h2>
      ${list.length ? `<div class="cal-list">${list.map((a) => eventHTML(a, sel)).join('')}</div>`
        : `<div class="empty"><p>No events match your filters on this day.</p>${f.categories.length || f.region !== 'Anywhere' || f.slot !== 'any' ? '<button type="button" class="btn tiny" data-calact="clear">Show everything</button>' : ''}</div>`}
      <p class="fineprint">Events from Eventbrite${fetched ? ' (updated ' + esc(fetched) + ')' : ''} and Paktor Lah editors. Event details, photos and ticket prices are on each organiser's page.</p>
    </section>`;
    PL.photos.hydrate($app);
    document.getElementById('cal-filters').addEventListener('toggle', (e) => S.sset('calOpen', e.target.open));
  }

  function summary(f) {
    const bits = [f.categories.length ? f.categories.length + ' type' + (f.categories.length > 1 ? 's' : '') : 'All types', E.BUDGETS[f.budget].label, f.region];
    if (f.slot !== 'any') bits.push(f.slot);
    if (f.kids) bits.push('kid-friendly');
    return bits.join(' · ');
  }

  function eventHTML(a, day) {
    const cat = PL.app.catById(a.categories[0]);
    const time = a.start_time ? U.fmtTime(U.toMin(a.start_time)) + (a.end_time ? ' – ' + U.fmtTime(U.toMin(a.end_time)) : '') : (a.time_slots.length === 1 ? a.time_slots[0] : 'Various times');
    const saved = S.list('saved').includes(a.id);
    return `<article class="cal-ev">
      <div class="cal-ev-media cat-${a.categories[0]}"><span aria-hidden="true">${cat.emoji}</span>${PL.app.photoHTML(a, { w: 400, cls: 'ph-card' })}</div>
      <div class="cal-ev-body">
        <span class="tag">${esc(cat.label)}${a.source_name === 'Eventbrite' ? ' · via Eventbrite' : ''}</span>
        <h3>${esc(a.name)}</h3>
        <p class="meal-meta">🕑 ${esc(time)}${a.start_date !== a.end_date ? ' · runs ' + esc(U.fmtShort(a.start_date)) + '–' + esc(U.fmtShort(a.end_date)) : ''}</p>
        <p class="meal-meta">📍 <a href="${esc(U.mapUrl(a))}" target="_blank" rel="noopener">${esc(a.venue)}</a> · ${esc(a.region)}</p>
        <p class="meal-meta">💵 ${esc(PL.app.priceText(a))} · ${a.kid_friendly ? '👶 Kid-friendly' : a.source_name === 'Eventbrite' ? 'Not listed as kid-friendly' : '🔞 Adults'} · ${a.indoor_outdoor === 'indoor' ? '🏠 Indoor' : '🌤️ Outdoor'}</p>
        <div class="actions">
          <button type="button" class="btn tiny primary" data-calact="plan" data-id="${a.id}" data-day="${day}">Plan a date →</button>
          <a class="btn tiny" href="${esc(E.bookingUrl(a))}" target="_blank" rel="noopener">${a.source_name === 'Eventbrite' ? 'Details & tickets' : 'Official page'} ↗</a>
          <button type="button" class="btn tiny icon ${saved ? 'on' : ''}" data-calact="save" data-id="${a.id}" aria-pressed="${saved}" aria-label="Save for later">${saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>`;
  }

  document.addEventListener('click', (e) => {
    if (document.body.dataset.route !== 'calendar') return;
    const chip = e.target.closest('[data-cal]');
    const day = e.target.closest('.cal-cell[data-day]');
    const act = e.target.closest('[data-calact]');
    if (!chip && !day && !act) return;
    const f = filters();
    if (chip) {
      const g = chip.dataset.cal, v = chip.dataset.v;
      if (g === 'categories') { const i = f.categories.indexOf(v); if (i >= 0) f.categories.splice(i, 1); else f.categories.push(v); }
      else if (g === 'kids') f.kids = v === 'yes';
      else f[g] = v;
      saveFilters(f); render(); return;
    }
    if (day) { S.sset('calDay', day.dataset.day); render(); return; }
    const today = U.sgToday(), month = S.sget('calMonth', today.slice(0, 7));
    const shift = (n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); S.sset('calMonth', d.toISOString().slice(0, 7)); S.sset('calDay', null); render(); };
    switch (act.dataset.calact) {
      case 'prev': shift(-1); break;
      case 'next': shift(1); break;
      case 'today': S.sset('calMonth', today.slice(0, 7)); S.sset('calDay', today); render(); break;
      case 'mine': S.sset('calFilters', null); render(); break;
      case 'clear': saveFilters({ categories: [], budget: '200+', region: 'Anywhere', slot: 'any', kids: false, source: f.source }); render(); break;
      case 'save': { const id = act.dataset.id; const on = S.toggleIn('saved', id, !S.list('saved').includes(id)); PL.app.toast(on ? 'Saved for later ♥' : 'Removed from saved'); render(); break; }
      case 'plan': {
        // Build a plan around this event: its date and time slot, then straight to the invitation.
        const st = PL.app.state, a = S.content().activities.find((x) => x.id === act.dataset.id);
        st.prefs.date = act.dataset.day; st.prefs.dateMode = 'pick';
        if (a && a.time_slots.length === 1) st.prefs.slot = a.time_slots[0];
        st.plan = [{ id: act.dataset.id }]; st.draft = null; st.result = null; PL.app.persist();
        S.track('activity_selected'); S.track('calendar_plan');
        location.hash = '#/invite'; break;
      }
    }
  });

  PL.routes.calendar = render;
})();
