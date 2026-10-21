/* Latest events (#/events): a month calendar of upcoming events (Eventbrite imports + editor listings),
 * filtered by the preferences the couple stated on the "Plan a date" screen. Also embedded on the
 * results page as the "Latest events" tab. */
window.PL = window.PL || {};
PL.routes = PL.routes || {};

PL.calendar = (function () {
  const U = PL.util, E = PL.engine, S = PL.store, esc = U.esc;
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let target = null, opts = {};

  // Filters come straight from the stated preferences.
  function filters() {
    const p = PL.app.state.prefs;
    return { categories: p.categories, budget: p.budget, region: p.region, slot: p.slot, kids: p.withKids, all: S.sget('calAll', false) };
  }

  function covers(a, day) {
    return a.start_date <= day && day <= a.end_date && (!a.days || a.days.includes(U.weekday(day)));
  }
  function matches(a, day, f, today) {
    if (a.type !== 'event' || !E.isLive(a, today) || day < today || !covers(a, day)) return false;
    if (f.all) return true;
    if (f.categories.length && !a.categories.some((c) => f.categories.includes(c))) return false;
    if (a.price_min != null && E.activityCost(a, { withKids: f.kids, kidCount: 1 }) > E.BUDGETS[f.budget].max) return false;
    if (f.region !== 'Anywhere' && a.region !== f.region) return false;
    if (!a.time_slots.includes(f.slot)) return false;
    if (f.kids && !a.kid_friendly) return false;
    return true;
  }
  const byTime = (x, y) => ((x.start_time || '99') < (y.start_time || '99') ? -1 : 1);

  function summary(p) {
    const cats = p.categories.length ? p.categories.map((c) => PL.app.catById(c).label.split(' ')[0]).join(', ') : 'All types';
    return [cats, E.BUDGETS[p.budget].label, p.region, E.SLOTS[p.slot].label, p.withKids ? 'Kid-friendly' : 'Just us']
      .map((b) => `<span class="pill">${esc(b)}</span>`).join('');
  }

  function render(el, o) {
    target = el || target; opts = o || opts;
    const p = PL.app.state.prefs;
    const f = filters();
    const today = U.sgToday();
    const content = S.content();
    const startDay = p.date >= today ? p.date : today;
    const month = S.sget('calMonth', null) || startDay.slice(0, 7);
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
      sel = (startDay.slice(0, 7) === month && perDay[startDay]) ? startDay
        : Object.keys(perDay).find((d) => d >= today && perDay[d].length) || (today.slice(0, 7) === month ? today : first);
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
      cells.push(`<button type="button" class="cal-cell${day === sel ? ' sel' : ''}${day === today ? ' today' : ''}${day === p.date ? ' chosen' : ''}${past ? ' past' : ''}${n ? ' has' : ''}"
        data-day="${day}" ${past ? 'disabled' : ''} aria-label="${esc(label)}" aria-pressed="${day === sel}">
        <span class="cal-num">${d}</span>${n ? `<span class="cal-count">${n}</span>` : ''}</button>`);
    }

    target.innerHTML = `
      ${opts.embedded ? '' : `<header class="cal-head">
        <h1 class="screen-h">Latest events</h1>
        <p class="hint">Upcoming events that match your date preferences.</p>
        <div class="summary cal-summary"><div class="pills">${summary(p)}</div><a href="#/" class="edit" data-calact="edit">Edit</a></div>
      </header>`}
      <div class="seg seg-sm" role="radiogroup" aria-label="Which events">
        <button type="button" role="radio" aria-checked="${!f.all}" data-calact="mine">For my preferences</button>
        <button type="button" role="radio" aria-checked="${f.all}" data-calact="all">All events</button>
      </div>
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
        <p class="cal-foot">${total} event-day${total === 1 ? '' : 's'} this month · <span class="cal-key"><i class="k-chosen"></i> your date</span></p>
      </div>

      <h2 class="section-h">${esc(U.fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }))} <span class="hint">${list.length} event${list.length === 1 ? '' : 's'}</span></h2>
      ${list.length ? `<div class="cal-list">${list.map((a) => eventHTML(a, sel)).join('')}</div>`
        : `<div class="empty"><p>No events ${f.all ? '' : 'matching your preferences '}on this day.</p>${f.all ? '' : '<button type="button" class="btn tiny" data-calact="all">Show all events</button>'}</div>`}
      <p class="fineprint">Events from Eventbrite${fetched ? ' (updated ' + esc(fetched) + ')' : ''} and Next Date editors. Event details, photos and ticket prices are on each organiser's page.</p>`;
    PL.photos.hydrate(target);
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

  // The page itself: only after preferences have been stated.
  function page() {
    const { $app } = PL.app;
    if (!S.sget('prefsDone', false) || !PL.app.state.prefs.categories.length) {
      $app.innerHTML = `<section class="screen center cal-gate">
        <h1 class="screen-h">Latest events</h1>
        <p>Tell us what kind of date you're after first, and we'll show a calendar of upcoming events that fit.</p>
        <button type="button" class="btn primary" data-calact="set-prefs">Set my preferences →</button>
      </section>`;
      return;
    }
    $app.innerHTML = '<section class="screen calendar cal-root" id="events-cal"></section>';
    render(document.getElementById('events-cal'), { embedded: false });
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-calact]');
    const day = e.target.closest('.cal-cell[data-day]');
    if (!act && !day) return;
    if (day) { S.sset('calDay', day.dataset.day); render(); return; }
    const today = U.sgToday(), p = PL.app.state.prefs;
    const month = S.sget('calMonth', null) || (p.date >= today ? p.date : today).slice(0, 7);
    const shift = (n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); S.sset('calMonth', d.toISOString().slice(0, 7)); S.sset('calDay', null); render(); };
    switch (act.dataset.calact) {
      case 'prev': shift(-1); break;
      case 'next': shift(1); break;
      case 'mine': S.sset('calAll', false); render(); break;
      case 'all': S.sset('calAll', true); render(); break;
      case 'set-prefs': S.sset('afterPrefs', '#/events'); location.hash = '#/'; break;
      case 'edit': S.sset('afterPrefs', '#/events'); break; // the link itself navigates to #/
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

  PL.routes.events = page;
  return { render };
})();
