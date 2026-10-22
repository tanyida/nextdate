/* Editor console (FR-11, FR-12): review, edit, tag, approve or hide listings; manage tips & restaurants. */
(function () {
  const U = PL.util, S = PL.store, G = PL.ingest, esc = U.esc;
  const panel = document.getElementById('panel');
  const dlg = document.getElementById('dlg'), dlgForm = document.getElementById('dlg-form');
  let content = clone(S.content());
  let tab = 'listings', filter = 'all', query = '', importResults = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function save(msg) { S.saveContent(content); content = clone(S.content()); if (msg) toast(msg); }
  function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
  const today = () => U.sgToday();
  const shownStatus = (a) => (a.type === 'event' && a.end_date && a.end_date < today() && a.status === 'live') ? 'expired' : a.status;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---------------- schema-driven edit form ----------------
  function PHOTO_FIELDS(altKind, altLabel) {
    return [
      { k: 'photo', label: 'Wikipedia article for photo (e.g. Gardens_by_the_Bay)' },
      { k: 'photo_kind', t: 'select', o: [['venue', 'Photo of this venue'], [altKind, altLabel], ['', 'No photo']] },
      { k: 'image_url', t: 'url', full: 1, label: 'Own licensed photo URL (overrides Wikipedia; you must hold rights)' }
    ];
  }
  const ACT_FIELDS = [
    { k: 'name', full: 1 }, { k: 'short_description', t: 'textarea', full: 1, label: 'Short description (our own words, ≤ 30 words)' },
    { k: 'type', t: 'select', o: ['evergreen', 'event'] }, { k: 'status', t: 'select', o: ['draft', 'live', 'hidden', 'expired'] },
    { k: 'categories', t: 'checks', o: PL.CATEGORIES.map((c) => [c.id, c.label]), full: 1 },
    { k: 'vibes', t: 'checks', o: PL.VIBES.map((v) => [v.id, v.label]), full: 1 },
    { k: 'start_date', t: 'date' }, { k: 'end_date', t: 'date' },
    { k: 'days', t: 'checks', o: DAYS.map((d, i) => [i, d]), nullable: 1, label: 'Runs on (leave empty = every day)' },
    { k: 'time_slots', t: 'checks', o: [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']] },
    { k: 'duration_min', t: 'number', label: 'Duration (min)' }, { k: 'price_min', t: 'number', label: 'Price min (pp)' },
    { k: 'price_max', t: 'number', nullable: 1, label: 'Price max (pp)' }, { k: 'price_note' },
    { k: 'venue' }, { k: 'address' }, { k: 'postal_code' },
    { k: 'lat', t: 'number', nullable: 1 }, { k: 'lng', t: 'number', nullable: 1 },
    { k: 'region', t: 'select', o: PL.REGIONS }, { k: 'indoor_outdoor', t: 'select', o: ['indoor', 'outdoor'] },
    { k: 'kid_friendly', t: 'bool' }, { k: 'kid_age_min', t: 'number', label: 'Min kid age' },
    { k: 'booking_required', t: 'bool' }, { k: 'pet_friendly', t: 'bool', label: 'Pet-friendly (leashed pets welcome)' }, { k: 'sponsored', t: 'bool' }, { k: 'pinned', t: 'bool', label: 'Editorial pin (seasonal boost)' },
    { k: 'official_url', t: 'url', full: 1 }, { k: 'booking_url', t: 'url', full: 1, label: 'Booking / ticketing link (blank = official page)' },
    { k: 'source_name' }, { k: 'source_url', t: 'url' }, { k: 'last_verified_at', t: 'date' },
    ...PHOTO_FIELDS('idea', 'Illustrative (activity, not this venue)')
  ];
  const REST_FIELDS = [
    { k: 'name', full: 1 }, { k: 'cuisines', t: 'checks', o: PL.CUISINES.map((c) => [c, c]), full: 1 },
    { k: 'dietary', t: 'checks', o: PL.DIETARY.map((d) => [d.id, d.label]) },
    { k: 'meal_types', t: 'checks', o: ['brunch', 'lunch', 'dinner', 'drinks'].map((m) => [m, m]) },
    { k: 'price_band', t: 'select', o: [[1, '$ (under $15pp)'], [2, '$$ ($15–40)'], [3, '$$$ ($40–80)'], [4, '$$$$ ($80+)']] },
    { k: 'open', t: 'time', label: 'Opens' }, { k: 'close', t: 'time', label: 'Closes' },
    { k: 'address', full: 1 }, { k: 'lat', t: 'number' }, { k: 'lng', t: 'number' },
    { k: 'region', t: 'select', o: PL.REGIONS },
    { k: 'reservation_required', t: 'bool', label: 'Reservation recommended' },
    { k: 'beef_focused', t: 'bool', label: 'Beef-focused menu (hidden for "No beef")' },
    { k: 'pet_friendly', t: 'bool', label: 'Pet-friendly seating' },
    { k: 'booking_url', t: 'url', label: 'Reservation link (blank = Google Maps search)' },
    ...PHOTO_FIELDS('dish', 'Typical dish (not this restaurant)')
  ];
  const TIP_FIELDS = [
    { k: 'text', t: 'textarea', full: 1, label: 'Tip (≤ 30 words, general advice, not counselling)' },
    { k: 'categories', t: 'checks', o: PL.CATEGORIES.map((c) => [c.id, c.label]), full: 1 },
    { k: 'vibes', t: 'checks', o: PL.VIBES.map((v) => [v.id, v.label]), full: 1 },
    { k: 'audience', t: 'select', o: ['couple', 'family', 'new couple'] }, { k: 'author' }, { k: 'approved', t: 'bool' }
  ];

  function fieldHTML(f, v) {
    const label = f.label || f.k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const name = 'f_' + f.k, cls = f.full ? ' class="full"' : '';
    if (f.t === 'checks') {
      const arr = v || [];
      return `<fieldset${cls} style="border:0;padding:0;margin:0"><label>${esc(label)}</label><div class="checks">${f.o.map(([val, l]) =>
        `<label><input type="checkbox" name="${name}" value="${esc(val)}" ${arr.map(String).includes(String(val)) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></fieldset>`;
    }
    if (f.t === 'bool') return `<label${cls}><span class="checks"><label><input type="checkbox" name="${name}" ${v ? 'checked' : ''}> ${esc(label)}</label></span></label>`;
    if (f.t === 'select') {
      const opts = f.o.map((o) => Array.isArray(o) ? o : [o, o]);
      return `<label${cls}>${esc(label)}<select name="${name}">${opts.map(([val, l]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    }
    if (f.t === 'textarea') return `<label${cls}>${esc(label)} <span class="wc" data-wc="${name}"></span><textarea name="${name}" rows="3">${esc(v || '')}</textarea></label>`;
    const type = { number: 'number', date: 'date', url: 'url', time: 'time' }[f.t] || 'text';
    return `<label${cls}>${esc(label)}<input type="${type}" name="${name}" value="${esc(v == null ? '' : v)}" ${type === 'number' ? 'step="any"' : ''}></label>`;
  }

  function readForm(fields, form) {
    const out = {};
    fields.forEach((f) => {
      const name = 'f_' + f.k;
      if (f.t === 'checks') {
        let vals = [...form.querySelectorAll(`[name="${name}"]:checked`)].map((i) => i.value);
        if (f.k === 'days') vals = vals.map(Number);
        out[f.k] = f.nullable && !vals.length ? null : vals;
      } else if (f.t === 'bool') out[f.k] = form.querySelector(`[name="${name}"]`).checked;
      else {
        const raw = form.querySelector(`[name="${name}"]`).value.trim();
        if (f.t === 'number' || f.k === 'price_band') out[f.k] = raw === '' ? (f.nullable ? null : 0) : Number(raw);
        else out[f.k] = raw === '' && (f.t === 'date') ? null : raw;
      }
    });
    return out;
  }

  function openEditor(title, fields, obj, onSave, extraHTML) {
    dlgForm.innerHTML = `<h2 style="font-family:var(--display)">${esc(title)}</h2>${extraHTML || ''}
      <div class="grid-form">${fields.map((f) => fieldHTML(f, obj[f.k])).join('')}</div>
      <p id="dlg-err" class="warn" role="alert"></p>
      <div class="dlg-actions"><button type="button" class="btn" value="cancel" id="dlg-cancel">Cancel</button><button type="submit" class="btn primary">Save</button></div>`;
    const wc = () => dlgForm.querySelectorAll('[data-wc]').forEach((s) => {
      const n = (dlgForm.querySelector(`[name="${s.dataset.wc}"]`).value.trim().match(/\S+/g) || []).length;
      s.textContent = n + '/30 words'; s.classList.toggle('over', n > 30);
    });
    dlgForm.oninput = wc; wc();
    dlgForm.querySelector('#dlg-cancel').onclick = () => dlg.close();
    dlgForm.onsubmit = (e) => {
      e.preventDefault();
      const err = onSave(readForm(fields, dlgForm));
      if (err) { dlgForm.querySelector('#dlg-err').textContent = err; return; }
      dlg.close(); render();
    };
    dlg.showModal();
  }

  // ---------------- Listings ----------------
  function listings() {
    const acts = content.activities;
    const counts = { all: acts.length, live: 0, draft: 0, hidden: 0, expired: 0, issues: 0 };
    acts.forEach((a) => { counts[shownStatus(a)] = (counts[shownStatus(a)] || 0) + 1; if (G.issues(a).length) counts.issues++; });
    const q = query.toLowerCase();
    const shown = acts.filter((a) => (filter === 'all' || (filter === 'issues' ? G.issues(a).length : shownStatus(a) === filter)) &&
      (!q || (a.name + ' ' + a.venue + ' ' + a.region + ' ' + a.categories.join(' ')).toLowerCase().includes(q)))
      .sort((a, b) => (a.status === 'draft' ? -1 : 0) - (b.status === 'draft' ? -1 : 0) || (a.type === 'event' ? -1 : 1) - (b.type === 'event' ? -1 : 1));
    panel.innerHTML = `
      <div class="toolbar">
        <input type="search" id="q" placeholder="Search listings…" value="${esc(query)}" aria-label="Search listings">
        <button class="btn primary" data-a="new">+ New evergreen idea</button>
      </div>
      <div class="chips" style="margin-bottom:12px">${Object.entries(counts).map(([k, n]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${k[0].toUpperCase() + k.slice(1)} <span class="count">${n}</span></button>`).join('')}</div>
      <div class="list">${shown.map(itemHTML).join('') || '<p class="muted">Nothing here.</p>'}</div>`;
    const qi = document.getElementById('q');
    qi.oninput = () => { query = qi.value; const pos = qi.selectionStart; listings(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  function itemHTML(a) {
    const st = shownStatus(a), iss = G.issues(a);
    return `<div class="item">
      <div>
        <h3>${a.pinned ? '📌 ' : ''}${esc(a.name)}</h3>
        <div class="meta"><span class="st st-${st}">${st}</span>${a.type === 'event' ? '📅 ' + esc(a.start_date || '?') + ' → ' + esc(a.end_date || '?') : 'Evergreen'} · ${esc(a.venue)} · ${esc(a.region)} · ${a.categories.map((c) => esc(c)).join(', ')} · $${a.price_min}${a.price_max ? '–' + a.price_max : ''} · ${a.kid_friendly ? 'kids ' + (a.kid_age_min || 0) + '+' : 'adults'}${a.sponsored ? ' · <strong>sponsored</strong>' : ''}</div>
        <div class="meta">Source: ${esc(a.source_name)} · <a href="${esc(a.official_url)}" target="_blank" rel="noopener">official link ↗</a> · verified ${esc(a.last_verified_at || 'never')}</div>
        ${iss.length ? `<ul class="issues">${iss.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<span class="ok">✓ Ready to publish</span>'}
      </div>
      <div class="item-actions">
        <button class="btn tiny" data-a="edit" data-id="${a.id}">Edit</button>
        ${a.status !== 'live' ? `<button class="btn tiny" data-a="approve" data-id="${a.id}">Approve</button>` : `<button class="btn tiny" data-a="hide" data-id="${a.id}">Hide</button>`}
        <button class="btn tiny" data-a="pin" data-id="${a.id}">${a.pinned ? 'Unpin' : 'Pin'}</button>
        <button class="btn tiny" data-a="verify" data-id="${a.id}">Mark verified</button>
      </div>
    </div>`;
  }
  function liveBlockers(a) {
    if (a.status !== 'live') return null;
    const iss = G.issues(a);
    return iss.length ? 'Can\'t publish yet: ' + iss.join('; ') : null;
  }
  function editActivity(a, isNew) {
    openEditor(isNew ? 'New listing' : 'Edit listing', ACT_FIELDS, a, (vals) => {
      const next = Object.assign({}, a, vals);
      if ((next.short_description.match(/\S+/g) || []).length > 30) return 'Description is over 30 words.';
      const block = liveBlockers(next); if (block) return block;
      if (isNew) content.activities.unshift(next);
      else content.activities[content.activities.findIndex((x) => x.id === a.id)] = next;
      save('Saved'); return null;
    }, `<p class="hint">ID: ${esc(a.id)}${a.lat ? ` · <a href="${esc(U.mapUrl(a))}" target="_blank" rel="noopener">check on map ↗</a>` : ''} · <button type="button" class="btn tiny" id="geo">Geocode via OneMap</button></p>`);
    const geo = document.getElementById('geo');
    if (geo) geo.onclick = async () => {
      const f = dlgForm;
      const qv = f.querySelector('[name=f_postal_code]').value || f.querySelector('[name=f_address]').value;
      geo.textContent = 'Looking up…';
      try {
        const r = await G.geocode(qv);
        f.querySelector('[name=f_lat]').value = r.lat; f.querySelector('[name=f_lng]').value = r.lng;
        if (r.postal_code && r.postal_code !== 'NIL') { f.querySelector('[name=f_postal_code]').value = r.postal_code; const reg = G.regionFromPostal(r.postal_code); if (reg) f.querySelector('[name=f_region]').value = reg; }
        geo.textContent = '✓ ' + r.address.slice(0, 40);
      } catch (e) { geo.textContent = 'OneMap unavailable here. Enter lat/lng manually'; }
    };
  }

  // ---------------- Import ----------------
  function importTab() {
    panel.innerHTML = `
      <p>Paste entries from a monthly round-up or event page. Each entry needs a heading like <code>Arts &amp; culture: Event name</code> plus <code>When:</code>, <code>How much:</code>, <code>Where:</code> and a link. We extract only facts and validate them. Nothing goes live until you approve it.</p>
      <div class="grid-form" style="margin-bottom:10px">
        <label>Source name<input id="src-name" value="Honeycombers Singapore"></label>
        <label>Source URL<input id="src-url" type="url" value="https://thehoneycombers.com/singapore/"></label>
      </div>
      <textarea class="big" id="paste" placeholder="Paste listing text here…"></textarea>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn" data-a="sample">Load sample (incl. a bad 2025 date)</button>
        <button class="btn primary" data-a="extract">Extract & validate</button>
      </div>
      <div id="imp-out" class="list"></div>`;
    renderImport();
  }
  function renderImport() {
    const out = document.getElementById('imp-out'); if (!out) return;
    if (!importResults.length) { out.innerHTML = ''; return; }
    const ok = importResults.filter((r) => !r.errors.length).length;
    out.innerHTML = `<h3>${importResults.length} entries extracted · ${ok} pass validation</h3>` + importResults.map((r, i) => `
      <div class="item">
        <div>
          <h3>${esc(r.draft.name)}</h3>
          <div class="meta">${esc(r.draft.start_date || '?')} → ${esc(r.draft.end_date || '?')}${r.draft.days ? ' (' + r.draft.days.map((d) => DAYS[d]).join('/') + ')' : ''} · $${r.draft.price_min}${r.draft.price_max ? '–' + r.draft.price_max : ''}${r.draft.price_max == null && /from/i.test(r.draft.price_note) ? '+' : ''} pp · ${esc(r.draft.venue)} · ${esc(r.draft.postal_code || 'no postcode')} → ${esc(r.draft.region)} · ${r.draft.categories.join(', ')} · ${r.draft.kid_friendly ? 'kid-friendly?' : 'adults'} · ${r.draft.booking_required ? 'booking' : 'walk-in'}${r.draft.sponsored ? ' · sponsored' : ''}</div>
          ${r.errors.length ? `<ul class="issues">${r.errors.map((x) => `<li><strong>Rejected:</strong> ${esc(x)}</li>`).join('')}</ul>` : ''}
          <ul class="issues" style="color:var(--muted)">${r.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          ${r.sourceText ? `<div class="src"><strong>Source text (reference only, not stored):</strong> ${esc(r.sourceText)}</div>` : ''}
        </div>
        <div class="item-actions">
          ${r.added ? '<span class="ok">✓ Added as draft</span>' : `<button class="btn tiny ${r.errors.length ? '' : 'primary'}" data-a="add-draft" data-i="${i}">${r.errors.length ? 'Add anyway (draft)' : 'Add as draft'}</button>`}
        </div>
      </div>`).join('');
  }

  // ---------------- Tips ----------------
  function tipsTab() {
    const tips = content.tips;
    panel.innerHTML = `
      <div class="toolbar"><span class="muted">${tips.length} tips · ${tips.filter((t) => t.approved).length} approved · target library 100–150</span><button class="btn primary" data-a="new-tip">+ New tip</button></div>
      <div class="list">${tips.map((t) => {
        const wc = (t.text.match(/\S+/g) || []).length;
        return `<div class="item"><div><p style="margin:0 0 4px">${esc(t.text)}</p>
          <div class="meta"><span class="st ${t.approved ? 'st-live' : 'st-draft'}">${t.approved ? 'approved' : 'pending'}</span>${esc(t.audience)} · ${t.categories.join(', ') || 'any'} · ${t.vibes.join(', ') || 'any vibe'} · <span class="wc ${wc > 30 ? 'over' : ''}">${wc} words</span> · ${esc(t.author)}</div></div>
          <div class="item-actions"><button class="btn tiny" data-a="edit-tip" data-id="${t.id}">Edit</button><button class="btn tiny" data-a="toggle-tip" data-id="${t.id}">${t.approved ? 'Unapprove' : 'Approve'}</button><button class="btn tiny" data-a="del-tip" data-id="${t.id}" aria-label="Delete tip">✕</button></div></div>`;
      }).join('')}</div>`;
  }
  function editTip(t, isNew) {
    openEditor(isNew ? 'New tip' : 'Edit tip', TIP_FIELDS, t, (v) => {
      if ((v.text.match(/\S+/g) || []).length > 30) return 'Tips must be 30 words or fewer.';
      if (!v.text.trim()) return 'Write the tip first.';
      const next = Object.assign({}, t, v);
      if (isNew) content.tips.unshift(next); else content.tips[content.tips.findIndex((x) => x.id === t.id)] = next;
      save('Tip saved'); return null;
    });
  }

  // ---------------- Restaurants ----------------
  function restTab() {
    const q = query.toLowerCase();
    const rs = content.restaurants.filter((r) => !q || (r.name + r.region + r.cuisines.join()).toLowerCase().includes(q));
    panel.innerHTML = `
      <div class="toolbar"><input type="search" id="q" placeholder="Search restaurants…" value="${esc(query)}" aria-label="Search restaurants"><button class="btn primary" data-a="new-rest">+ New restaurant</button></div>
      <div class="list">${rs.map((r) => `<div class="item"><div><h3>${esc(r.name)}</h3><div class="meta">${esc(r.region)} · ${'$'.repeat(r.price_band)} · ${esc(r.cuisines.join(', '))} · ${esc(r.meal_types.join('/'))} · ${esc(r.opening_hours.open)}–${esc(r.opening_hours.close)}${r.dietary.length ? ' · ' + esc(r.dietary.join(', ')) : ''}</div></div>
        <div class="item-actions"><button class="btn tiny" data-a="edit-rest" data-id="${r.id}">Edit</button><button class="btn tiny" data-a="del-rest" data-id="${r.id}" aria-label="Delete">✕</button></div></div>`).join('')}</div>`;
    const qi = document.getElementById('q');
    qi.oninput = () => { query = qi.value; const pos = qi.selectionStart; restTab(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  function editRest(r, isNew) {
    const flat = Object.assign({}, r, { open: r.opening_hours.open, close: r.opening_hours.close });
    openEditor(isNew ? 'New restaurant' : 'Edit restaurant', REST_FIELDS, flat, (v) => {
      const next = Object.assign({}, r, v, { opening_hours: { open: v.open || '11:00', close: v.close || '22:00' } });
      delete next.open; delete next.close;
      if (!next.meal_types.length) return 'Pick at least one meal type.';
      if (isNew) content.restaurants.unshift(next); else content.restaurants[content.restaurants.findIndex((x) => x.id === r.id)] = next;
      save('Restaurant saved'); return null;
    });
  }

  // ---------------- Funnel analytics ----------------
  function analyticsTab() {
    const a = S.get('analytics', { counts: {}, sessions: {} });
    const c = a.counts, sess = Object.values(a.sessions);
    const submitted = sess.filter((s) => s.prefs_submitted).length;
    const reached = sess.filter((s) => s.prefs_submitted && s.invite_page).length;
    const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
    const liveEvents = content.activities.filter((x) => x.type === 'event' && x.status === 'live');
    const fresh = liveEvents.filter((x) => x.end_date >= today()).length;
    const m = (title, value, target, sub, p) => `<div class="metric"><div class="t">${title}</div><div class="v">${value}</div><div class="t">Target ${target}${sub ? ' · ' + sub : ''}</div>${p != null ? `<div class="bar"><span style="width:${Math.min(100, p)}%"></span></div>` : ''}</div>`;
    panel.innerHTML = `
      <p class="hint">Counts from this browser only, using privacy-friendly local tracking with no third parties. In production, send the same events to a self-hosted, cookieless tool.</p>
      <div class="metrics">
        ${m('Plan completion', pct(reached, submitted) + '%', '≥ 35%', reached + ' / ' + submitted + ' sessions', pct(reached, submitted) / 0.35)}
        ${m('Invitations shared', c.shared || 0, '≥ 1,000 / month', 'WA ' + (c.shared_whatsapp || 0) + ' · TG ' + (c.shared_telegram || 0) + ' · link ' + (c.shared_copy || 0) + ' · image ' + (c.shared_image || 0))}
        ${m('Recommendation CTR', pct(c.activity_selected || 0, c.cards_shown || 0) + '%', '≥ 15%', (c.activity_selected || 0) + ' selected / ' + (c.cards_shown || 0) + ' shown', pct(c.activity_selected || 0, c.cards_shown || 0) / 0.15)}
        ${m('Plans created (device)', (S.get('plans', [])).length, '2nd plan in 30 days ≥ 25%', 'Return usage needs sign-in (P1)')}
        ${m('Content freshness', (liveEvents.length ? pct(fresh, liveEvents.length) : 100) + '%', '100%', 'Expired events are filtered at query time', liveEvents.length ? pct(fresh, liveEvents.length) : 100)}
        ${m('RSVPs', (c.rsvp_yes || 0) + ' yes', '—', (c.rsvp_time || 0) + ' another time · ' + (c.rsvp_else || 0) + ' something else')}
      </div>
      <div class="toolbar" style="margin-top:16px"><button class="btn" data-a="reset-analytics">Reset counts</button></div>`;
  }

  // ---------------- Data ----------------
  function dataTab() {
    const expired = content.activities.filter((a) => a.type === 'event' && a.status === 'live' && a.end_date < today()).length;
    panel.innerHTML = `
      <div class="list">
        <div class="item"><div><h3>Run expiry job</h3><div class="meta">Marks live events as expired the day after their end date. The app also filters these out at query time, so expired events never show. ${expired} due now.</div></div><div class="item-actions"><button class="btn tiny primary" data-a="expire">Run now</button></div></div>
        <div class="item"><div><h3>Export content (JSON)</h3><div class="meta">Activities, restaurants and tips, ready to load into the production database.</div></div><div class="item-actions"><button class="btn tiny" data-a="export">Export</button></div></div>
        <div class="item"><div><h3>Import content (JSON)</h3><div class="meta">Replace content with a previously exported file.</div></div><div class="item-actions"><input type="file" id="imp-file" accept="application/json" class="sr-only"><label for="imp-file" class="btn tiny">Choose file</label></div></div>
        <div class="item"><div><h3>Reset to seed data</h3><div class="meta">Discard all editor changes on this device.</div></div><div class="item-actions"><button class="btn tiny" data-a="reset">Reset</button></div></div>
      </div>
      <p class="hint">Last saved: ${content.updated_at ? new Date(content.updated_at).toLocaleString('en-SG') : 'never (using seed data)'}</p>`;
    document.getElementById('imp-file').onchange = async (e) => {
      try {
        const j = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(j.activities) || !Array.isArray(j.restaurants) || !Array.isArray(j.tips)) throw new Error('bad');
        content = j; save('Content imported'); render();
      } catch (err) { toast('That file isn\'t a Next Date export.'); }
    };
  }

  // ---------------- wiring ----------------
  function render() {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    ({ listings, import: importTab, tips: tipsTab, restaurants: restTab, analytics: analyticsTab, data: dataTab })[tab]();
  }
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; query = ''; render();
  });
  panel.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; listings(); return; }
    const el = e.target.closest('[data-a]'); if (!el) return;
    const id = el.dataset.id, A = (x) => content.activities.find((a) => a.id === x);
    switch (el.dataset.a) {
      case 'new': editActivity({ id: 'a-' + U.randomId(4).toLowerCase(), name: '', short_description: '', type: 'evergreen', categories: [], vibes: [], start_date: null, end_date: null, days: null, time_slots: ['morning', 'afternoon', 'evening'], duration_min: 120, price_min: 0, price_max: null, price_note: '', venue: '', address: '', postal_code: '', lat: null, lng: null, region: 'Central', indoor_outdoor: 'indoor', kid_friendly: true, kid_age_min: 0, booking_required: false, official_url: '', source_name: 'Next Date editors', source_url: '', sponsored: false, status: 'draft', pinned: false, last_verified_at: today() }, true); break;
      case 'edit': editActivity(A(id)); break;
      case 'approve': {
        const a = A(id), next = Object.assign({}, a, { status: 'live' }), block = liveBlockers(next);
        if (block) { toast(block); editActivity(a); break; }
        Object.assign(a, next); save('Published'); listings(); break;
      }
      case 'hide': A(id).status = 'hidden'; save('Hidden'); listings(); break;
      case 'pin': A(id).pinned = !A(id).pinned; save(A(id).pinned ? 'Pinned' : 'Unpinned'); listings(); break;
      case 'verify': A(id).last_verified_at = today(); save('Marked verified'); listings(); break;
      case 'sample': document.getElementById('paste').value = G.SAMPLE; break;
      case 'extract': {
        const src = { name: document.getElementById('src-name').value.trim(), url: document.getElementById('src-url').value.trim() };
        const entries = G.extract(document.getElementById('paste').value);
        importResults = entries.map((x) => G.toDraft(x, src, content.activities));
        if (!entries.length) toast('No entries found. Check the heading format.');
        renderImport(); break;
      }
      case 'add-draft': {
        const r = importResults[Number(el.dataset.i)];
        content.activities.unshift(r.draft); r.added = true; save('Added to Listings as draft'); renderImport(); break;
      }
      case 'new-tip': editTip({ id: 't-' + U.randomId(4).toLowerCase(), text: '', categories: [], vibes: [], audience: 'couple', author: 'Relationship expert (TBC)', approved: false }, true); break;
      case 'edit-tip': editTip(content.tips.find((t) => t.id === id)); break;
      case 'toggle-tip': { const t = content.tips.find((x) => x.id === id); t.approved = !t.approved; save(); tipsTab(); break; }
      case 'del-tip': if (confirm('Delete this tip?')) { content.tips = content.tips.filter((t) => t.id !== id); save('Deleted'); tipsTab(); } break;
      case 'new-rest': editRest({ id: 'r-' + U.randomId(4).toLowerCase(), name: '', cuisines: [], dietary: [], price_band: 2, meal_types: ['lunch', 'dinner'], opening_hours: { open: '11:00', close: '22:00' }, address: '', lat: 1.29, lng: 103.85, region: 'Central', booking_url: '' }, true); break;
      case 'edit-rest': editRest(content.restaurants.find((r) => r.id === id)); break;
      case 'del-rest': if (confirm('Delete this restaurant?')) { content.restaurants = content.restaurants.filter((r) => r.id !== id); save('Deleted'); restTab(); } break;
      case 'reset-analytics': S.set('analytics', { counts: {}, sessions: {} }); analyticsTab(); break;
      case 'expire': {
        let n = 0; content.activities.forEach((a) => { if (a.type === 'event' && a.status === 'live' && a.end_date < today()) { a.status = 'expired'; n++; } });
        save(n + ' event(s) expired'); dataTab(); break;
      }
      case 'export': U.download('nextdate-content-' + today() + '.json', JSON.stringify(content, null, 2), 'application/json'); break;
      case 'reset': if (confirm('Discard all editor changes on this device?')) { S.resetContent(); content = clone(S.content()); toast('Reset to seed data'); dataTab(); } break;
    }
  });

  render();
})();
