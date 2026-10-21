/* Memory book (#/memories): after a date, add photos and reflections guided by expert prompts.
 * Everything stays on this device (IndexedDB), and can be shared or exported as a keepsake file. */
window.PL = window.PL || {};
PL.routes = PL.routes || {};

(function () {
  const U = PL.util, S = PL.store, esc = U.esc;
  const MOODS = [['😍', 'Swoon'], ['😊', 'Happy'], ['😂', 'So fun'], ['😌', 'Peaceful'], ['🥹', 'Touched'], ['🤪', 'Chaotic (good)']];
  // Reflection prompts reviewed for tone (gratitude, shared laughter, looking forward).
  const PROMPTS = [
    { k: 'moment', label: 'Our favourite moment', ph: 'The part we\'ll still talk about next year…' },
    { k: 'appreciate', label: 'Something I appreciated about you today', ph: 'Be specific: "the way you…"' },
    { k: 'laugh', label: 'What made us laugh', ph: 'The wobbly pot, the wrong turn, the cat…' },
    { k: 'next', label: 'Next time, let\'s…', ph: 'An idea for our next date' }
  ];
  const MAX_PHOTOS = 12;
  let urls = [];          // object URLs to revoke on re-render
  let draft = null;       // memory being edited { …fields, photos: [{id, blob}] }

  // ---------------- IndexedDB ----------------
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('paktorlah', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('memories', { keyPath: 'id' }); r.result.createObjectStore('photos', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode), s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  const all = (store) => tx(store, 'readonly', (s) => s.getAll());
  const put = (store, v) => tx(store, 'readwrite', (s) => s.put(v));
  const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));
  const getPhoto = (id) => tx('photos', 'readonly', (s) => s.get(id));

  // Shrink photos before storing (max 1600px, JPEG), so the book stays light on phones.
  async function shrink(file, max) {
    max = max || 1600;
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    }
    const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  }
  function url(blob) { const u = URL.createObjectURL(blob); urls.push(u); return u; }

  // ---------------- render ----------------
  async function render() {
    const { $app } = PL.app;
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    let mems = [];
    try { mems = (await all('memories')).sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at)); }
    catch (e) { $app.innerHTML = '<section class="screen center"><h1>Memory book unavailable</h1><p>This browser is blocking on-device storage (private mode?).</p></section>'; return; }

    const prefill = S.sget('memPrefill', null);
    if (prefill && !draft) { draft = newDraft(prefill); S.sset('memPrefill', null); }
    const today = U.sgToday();
    const plans = S.get('plans', []);
    const pending = plans.filter((p) => p.date <= today && !mems.some((m) => m.planId === p.id)).slice(0, 2);

    $app.innerHTML = `
    <section class="screen memories">
      <header class="cal-head">
        <h1 class="screen-h">Our memory book</h1>
        <p class="hint">Photos and little notes from your dates. They're stored privately on this device.</p>
      </header>
      ${draft ? formHTML() : `
        <button type="button" class="btn primary wide" data-mem="new">＋ Add a memory</button>
        ${pending.map((p) => `<div class="banner mem-nudge">💭 How was <strong>${esc(p.title)}</strong> with ${esc(p.to)} on ${esc(U.fmtDate(p.date))}?
          <button type="button" class="btn tiny" data-mem="from-plan" data-id="${esc(p.id)}">Add memory</button></div>`).join('')}`}
      <div class="mem-list" id="mem-list">
        ${mems.length ? mems.map(cardHTML).join('') : (draft ? '' : `<div class="empty mem-empty"><p><strong>Your first page is waiting.</strong> After your next date, add a photo and one line each. Couples who look back on good moments together tend to feel closer.</p></div>`)}
      </div>
      ${mems.length ? `<div class="row-actions" style="justify-content:center;margin-top:12px"><button type="button" class="btn" data-mem="export">⬇️ Download keepsake (HTML)</button></div>` : ''}
    </section>`;

    // Load photos into thumbnails.
    for (const m of mems) {
      const box = document.querySelector(`[data-mem-photos="${m.id}"]`);
      if (!box) continue;
      for (const pid of m.photoIds.slice(0, 4)) {
        const p = await getPhoto(pid);
        const fig = box.querySelector(`[data-pid="${pid}"]`);
        if (p && fig) { fig.dataset.src = url(p.blob); }
      }
    }
    if (draft) draft.photos.forEach((p) => { const fig = document.querySelector(`.mem-form [data-pid="${p.id}"]`); if (fig) fig.dataset.src = url(p.blob); });
    PL.photos.hydrate($app);
    if (draft) wireForm();
  }

  function newDraft(pre) {
    pre = pre || {};
    return { id: 'm-' + U.randomId(6), title: pre.title || '', date: pre.date || U.sgToday(), place: pre.place || '', planId: pre.planId || null,
      mood: '', moment: '', appreciate: '', laugh: '', next: '', photos: [], created_at: new Date().toISOString(), isNew: true };
  }

  function formHTML() {
    const d = draft;
    return `<form class="mem-form" id="mem-form" autocomplete="off">
      <h2 class="section-h" style="margin-top:8px">${d.isNew ? 'New memory' : 'Edit memory'}</h2>
      <label class="text-field">Title<input name="title" maxlength="80" value="${esc(d.title)}" placeholder="e.g. Night Safari & satay" required></label>
      <div class="two">
        <label class="text-field">Date<input type="date" name="date" value="${esc(d.date)}" max="${U.sgToday()}"></label>
        <label class="text-field">Where<input name="place" maxlength="80" value="${esc(d.place)}" placeholder="Mandai"></label>
      </div>
      <fieldset class="field"><legend>Photos <span class="hint">${d.photos.length}/${MAX_PHOTOS}</span></legend>
        <div class="mem-thumbs">
          ${d.photos.map((p) => `<div class="mem-thumb"><figure class="ph" data-pid="${p.id}" data-action="photo" data-title="${esc(d.title || 'Memory')}" data-alt="Memory photo" role="button" tabindex="0" aria-label="View photo"></figure>
            <button type="button" class="mem-x" data-mem="rm-photo" data-id="${p.id}" aria-label="Remove photo">✕</button></div>`).join('')}
          ${d.photos.length < MAX_PHOTOS ? `<label class="mem-add">＋<span>Add photos</span><input type="file" accept="image/*" multiple id="mem-files" class="sr-only"></label>` : ''}
        </div>
      </fieldset>
      <fieldset class="field"><legend>How did it feel?</legend>
        <div class="chips">${MOODS.map(([e, l]) => `<button type="button" class="chip${d.mood === e ? ' on' : ''}" aria-pressed="${d.mood === e}" data-mem="mood" data-v="${e}">${e} ${l}</button>`).join('')}</div>
      </fieldset>
      ${PROMPTS.map((p) => `<label class="text-field">${esc(p.label)} <span class="hint">optional</span><textarea name="${p.k}" rows="2" maxlength="500" placeholder="${esc(p.ph)}">${esc(d[p.k])}</textarea></label>`).join('')}
      <p class="hint">💬 Expert tip: write one line each and swap phones to read them. Hearing what your partner noticed is the best part.</p>
      <div class="row-actions" style="justify-content:flex-start;margin-top:12px">
        <button type="submit" class="btn primary">Save memory</button>
        <button type="button" class="btn ghost" data-mem="cancel">Cancel</button>
      </div>
      <p id="mem-status" class="hint" role="status"></p>
    </form>`;
  }

  function wireForm() {
    const form = document.getElementById('mem-form');
    const sync = () => { const fd = new FormData(form); ['title', 'date', 'place', ...PROMPTS.map((p) => p.k)].forEach((k) => { draft[k] = fd.get(k) || ''; }); };
    form.addEventListener('input', sync);
    form.addEventListener('submit', async (e) => { e.preventDefault(); sync(); await saveDraft(); });
    const files = document.getElementById('mem-files');
    if (files) files.addEventListener('change', async () => {
      sync();
      const status = document.getElementById('mem-status');
      const list = [...files.files].slice(0, MAX_PHOTOS - draft.photos.length);
      status.textContent = 'Adding ' + list.length + ' photo' + (list.length === 1 ? '' : 's') + '…';
      for (const f of list) {
        try { draft.photos.push({ id: 'p-' + U.randomId(6), blob: await shrink(f), isNew: true }); }
        catch (err) { PL.app.toast('Couldn\'t read one of the photos.'); }
      }
      render();
    });
  }

  async function saveDraft() {
    const d = draft;
    if (!d.title.trim()) { PL.app.toast('Give this memory a title.'); document.querySelector('[name=title]').focus(); return; }
    try {
      for (const p of d.photos.filter((x) => x.isNew)) await put('photos', { id: p.id, blob: p.blob });
      for (const pid of (d.removed || [])) await del('photos', pid);
      const rec = { id: d.id, title: d.title.trim(), date: d.date, place: d.place.trim(), planId: d.planId, mood: d.mood,
        moment: d.moment.trim(), appreciate: d.appreciate.trim(), laugh: d.laugh.trim(), next: d.next.trim(),
        photoIds: d.photos.map((p) => p.id), created_at: d.created_at, updated_at: new Date().toISOString() };
      await put('memories', rec);
      S.track(d.isNew ? 'memory_added' : 'memory_edited');
      draft = null; PL.app.toast('Saved to your memory book 💞'); render();
    } catch (e) { PL.app.toast('Couldn\'t save. Storage may be full.'); }
  }

  function cardHTML(m) {
    const extra = m.photoIds.length - 4;
    const sections = PROMPTS.filter((p) => m[p.k]).map((p) => `<div class="mem-q"><dt>${esc(p.label)}</dt><dd>${esc(m[p.k]).replace(/\n/g, '<br>')}</dd></div>`).join('');
    return `<article class="mem-card">
      ${m.photoIds.length ? `<div class="mem-grid n${Math.min(4, m.photoIds.length)}" data-mem-photos="${m.id}">
        ${m.photoIds.slice(0, 4).map((pid, i) => `<figure class="ph" data-pid="${pid}" data-action="photo" data-title="${esc(m.title)}" data-alt="${esc(m.title)} photo ${i + 1}" role="button" tabindex="0" aria-label="View photo ${i + 1}">${i === 3 && extra > 0 ? `<span class="mem-more">+${extra}</span>` : ''}</figure>`).join('')}
      </div>` : ''}
      <div class="mem-body">
        <p class="tag">${esc(U.fmtDate(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}${m.place ? ' · ' + esc(m.place) : ''}</p>
        <h3>${m.mood ? `<span aria-hidden="true">${m.mood}</span> ` : ''}${esc(m.title)}</h3>
        ${sections ? `<dl class="mem-qs">${sections}</dl>` : ''}
        <div class="row-actions" style="justify-content:flex-start">
          ${m.photoIds.length > 4 ? `<button type="button" class="btn tiny" data-mem="all-photos" data-id="${m.id}">All ${m.photoIds.length} photos</button>` : ''}
          <button type="button" class="btn tiny" data-mem="share" data-id="${m.id}">Share</button>
          <button type="button" class="btn tiny" data-mem="edit" data-id="${m.id}">Edit</button>
          <button type="button" class="btn tiny" data-mem="delete" data-id="${m.id}" aria-label="Delete memory">🗑</button>
        </div>
      </div>
    </article>`;
  }

  async function loadMemory(id) {
    return tx('memories', 'readonly', (s) => s.get(id));
  }

  function memoryText(m) {
    const lines = [`💞 ${m.title} (${U.fmtDate(m.date)}${m.place ? ', ' + m.place : ''}) ${m.mood || ''}`];
    PROMPTS.forEach((p) => { if (m[p.k]) lines.push(`${p.label}: ${m[p.k]}`); });
    return lines.join('\n');
  }

  async function share(id) {
    const m = await loadMemory(id);
    const files = [];
    for (const pid of m.photoIds.slice(0, 6)) { const p = await getPhoto(pid); if (p) files.push(new File([p.blob], `memory-${files.length + 1}.jpg`, { type: 'image/jpeg' })); }
    const data = { title: m.title, text: memoryText(m) };
    try {
      if (files.length && navigator.canShare && navigator.canShare({ files })) await navigator.share(Object.assign(data, { files }));
      else if (navigator.share) await navigator.share(data);
      else { await PL.app.copy(data.text); return; }
      S.track('memory_shared');
    } catch (e) { /* cancelled */ }
  }

  // A single self-contained HTML file with every memory and photo embedded, to keep or print.
  async function exportBook() {
    const mems = (await all('memories')).sort((a, b) => a.date.localeCompare(b.date));
    const toData = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    let body = '';
    for (const m of mems) {
      let imgs = '';
      for (const pid of m.photoIds) { const p = await getPhoto(pid); if (p) imgs += `<img src="${await toData(p.blob)}" alt="">`; }
      body += `<section><p class="d">${esc(U.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${m.place ? ' · ' + esc(m.place) : ''}</p>
        <h2>${m.mood || ''} ${esc(m.title)}</h2><div class="g">${imgs}</div>
        ${PROMPTS.filter((p) => m[p.k]).map((p) => `<p><b>${esc(p.label)}</b><br>${esc(m[p.k]).replace(/\n/g, '<br>')}</p>`).join('')}</section>`;
    }
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Our memory book</title>
      <style>body{font:16px/1.6 Georgia,serif;background:#fffaf4;color:#2a1a22;max-width:760px;margin:0 auto;padding:24px 16px}h1{font-size:2.2rem;color:#c7354a}
      section{background:#fff;border-radius:16px;padding:20px;margin:0 0 20px;box-shadow:0 4px 16px rgba(0,0,0,.06)}.d{color:#8a6a74;font-size:.9rem;margin:0}
      .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:12px 0}.g img{width:100%;border-radius:10px}</style></head>
      <body><h1>💞 Our memory book</h1><p>${mems.length} dates, made with Next Date.</p>${body}</body></html>`;
    U.download('our-memory-book.html', html, 'text/html');
    S.track('memory_exported');
  }

  document.addEventListener('click', async (e) => {
    if (document.body.dataset.route !== 'memories') return;
    const el = e.target.closest('[data-mem]'); if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.mem) {
      case 'new': draft = newDraft(); render(); break;
      case 'from-plan': {
        const p = S.get('plans', []).find((x) => x.id === id);
        const where = p && p.inv ? p.inv.steps.filter((s) => s.k === 'a').map((s) => s.ve || s.n).join(' & ') : '';
        draft = newDraft({ title: p ? p.title : '', date: p ? p.date : U.sgToday(), place: where, planId: id }); render(); break;
      }
      case 'cancel': draft = null; render(); break;
      case 'mood': draft.mood = draft.mood === el.dataset.v ? '' : el.dataset.v;
        document.querySelectorAll('[data-mem="mood"]').forEach((b) => { const on = b.dataset.v === draft.mood; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); break;
      case 'rm-photo': draft.removed = (draft.removed || []).concat(draft.photos.filter((p) => p.id === id && !p.isNew).map((p) => p.id));
        draft.photos = draft.photos.filter((p) => p.id !== id); render(); break;
      case 'edit': {
        const m = await loadMemory(id);
        const photos = [];
        for (const pid of m.photoIds) { const p = await getPhoto(pid); if (p) photos.push({ id: pid, blob: p.blob }); }
        draft = Object.assign({}, m, { photos, isNew: false }); render(); window.scrollTo(0, 0); break;
      }
      case 'delete': {
        if (!confirm('Delete this memory and its photos from this device?')) break;
        const m = await loadMemory(id);
        for (const pid of m.photoIds) await del('photos', pid);
        await del('memories', id); PL.app.toast('Memory deleted'); render(); break;
      }
      case 'all-photos': {
        const m = await loadMemory(id), box = document.querySelector(`[data-mem-photos="${id}"]`);
        box.className = 'mem-grid all'; box.innerHTML = '';
        for (const [i, pid] of m.photoIds.entries()) {
          const p = await getPhoto(pid); if (!p) continue;
          box.insertAdjacentHTML('beforeend', `<figure class="ph" data-src="${url(p.blob)}" data-action="photo" data-title="${esc(m.title)}" data-alt="${esc(m.title)} photo ${i + 1}" role="button" tabindex="0"></figure>`);
        }
        PL.photos.hydrate(box); el.remove(); break;
      }
      case 'share': await share(id); break;
      case 'export': await exportBook(); break;
    }
  });

  PL.routes.memories = render;
})();
