/* Utilities, browser persistence and the content layer.
 * Content = seed data, overridden by anything editors saved in the admin console. */
window.PL = window.PL || {};

PL.util = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  // Today's date in Singapore, as YYYY-MM-DD, regardless of device time zone.
  sgToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
  },
  parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); },
  isoDate(dt) { return dt.toISOString().slice(0, 10); },
  addDays(s, n) { const d = PL.util.parseDate(s); d.setUTCDate(d.getUTCDate() + n); return PL.util.isoDate(d); },
  weekday(s) { return PL.util.parseDate(s).getUTCDay(); },
  daysBetween(a, b) { return Math.round((PL.util.parseDate(b) - PL.util.parseDate(a)) / 86400000); },
  thisWeekend() {
    const t = PL.util.sgToday(); const wd = PL.util.weekday(t);
    if (wd === 6 || wd === 0) return t;
    return PL.util.addDays(t, 6 - wd);
  },
  fmtDate(s, opts) {
    if (!s) return '';
    return PL.util.parseDate(s).toLocaleDateString('en-SG', Object.assign({ timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }, opts || {}));
  },
  fmtShort(s) { return PL.util.parseDate(s).toLocaleDateString('en-SG', { timeZone: 'UTC', day: 'numeric', month: 'short' }); },
  fmtTime(min) {
    const h = Math.floor(min / 60) % 24, m = min % 60;
    const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1;
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
  },
  fmtDuration(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return (h ? h + 'h' : '') + (m ? (h ? ' ' : '') + m + 'm' : '') || '0m';
  },
  toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; },
  km(a, b) {
    const R = 6371, toR = (x) => x * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },
  // Rough door-to-door minutes: walk under 1 km, otherwise MRT/bus.
  travelMin(km) { return km <= 1 ? Math.max(3, Math.round(km * 13)) : Math.round(10 + km * 3.5); },
  mapUrl(place) {
    const q = place.lat ? place.lat + ',' + place.lng : (place.name + ' ' + place.address + ' Singapore');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  },
  randomId(bytes) {
    const a = new Uint8Array(bytes || 12); crypto.getRandomValues(a);
    return PL.util.b64(a);
  },
  b64(bytes) {
    let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  unb64(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
  // Pack an object into a compact URL-safe token (deflate when the browser supports it).
  async pack(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
      return 'z' + PL.util.b64(new Uint8Array(buf));
    }
    return 'j' + PL.util.b64(raw);
  },
  async unpack(token) {
    const kind = token[0], bytes = PL.util.unb64(token.slice(1));
    let raw = bytes;
    if (kind === 'z') {
      raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
    return JSON.parse(new TextDecoder().decode(raw));
  },
  // Page through a list. Returns { items, page, pages, html } — html is the "‹ 1 2 3 ›" bar.
  // attr is the data attribute the page buttons carry, e.g. 'data-action="page"'.
  paginate(list, page, size, attr, label) {
    const pages = Math.max(1, Math.ceil(list.length / size));
    page = Math.min(Math.max(1, page || 1), pages);
    const from = (page - 1) * size, items = list.slice(from, from + size);
    if (pages === 1) return { items, page, pages, html: '' };
    const btn = (p, text, extra) => `<button type="button" class="pg-btn${p === page ? ' on' : ''}" ${attr} data-p="${p}" ${extra || ''}${p === page ? ' aria-current="page"' : ''}>${text}</button>`;
    // Compact page list: first, last, current ±1, with gaps.
    const nums = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(btn(p, p, `aria-label="Page ${p}"`));
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    const html = `<nav class="pager" aria-label="${PL.util.esc(label || 'Pages')}">
      ${btn(Math.max(1, page - 1), '‹ Prev', page === 1 ? 'disabled' : '')}
      ${nums.map((n) => (n === '…' ? '<span class="pg-gap">…</span>' : n)).join('')}
      ${btn(Math.min(pages, page + 1), 'Next ›', page === pages ? 'disabled' : '')}
      <span class="pg-info">${from + 1}–${from + items.length} of ${list.length}</span>
    </nav>`;
    return { items, page, pages, html };
  },
  download(filename, blobOrText, type) {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
};

/* Photos: freely licensed images from Wikipedia / Wikimedia Commons, fetched lazily and cached.
 * Markup: <figure class="ph" data-photo="Title" data-kind="venue|idea|dish" data-src="optional own URL" data-alt="…">. */
PL.photos = (function () {
  const KEY = 'pl_photos_v1', TTL = 7 * 86400000;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* storage blocked */ }
  const inflight = {};
  const sized = (url, w) => url ? url.replace(/\/(\d+)px-/, '/' + w + 'px-') : url;

  function get(title) {
    const hit = cache[title];
    if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit);
    if (inflight[title]) return inflight[title];
    inflight[title] = fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const v = { t: Date.now(), thumb: j && j.thumbnail ? j.thumbnail.source : '', full: j && j.originalimage ? j.originalimage.source : '',
          page: j && j.content_urls ? j.content_urls.desktop.page : '', label: j ? j.title : title.replace(/_/g, ' ') };
        cache[title] = v;
        try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* full or blocked */ }
        return v;
      })
      .catch(() => ({ thumb: '' }))
      .finally(() => { delete inflight[title]; });
    return inflight[title];
  }

  function fill(fig) {
    if (fig.dataset.done) return;
    fig.dataset.done = '1';
    const img = document.createElement('img');
    // hydrate() already defers off-screen photos, so load immediately once we get here.
    img.alt = fig.dataset.alt || ''; img.decoding = 'async'; img.loading = 'eager';
    img.referrerPolicy = 'no-referrer'; // some sites block images embedded from other domains
    const w = Number(fig.dataset.w || 640);
    const show = (src, fallback, onFail) => {
      img.onload = () => fig.classList.add('loaded');
      img.onerror = () => { if (fallback && img.src !== fallback) img.src = fallback; else if (onFail) onFail(); else fig.classList.add('failed'); };
      img.src = src; if (!img.parentNode) fig.prepend(img);
    };
    const fromWiki = () => get(fig.dataset.photo).then((p) => {
      if (!p.thumb) { fig.classList.add('failed'); return; }
      fig.dataset.full = sized(p.thumb, 1280); fig.dataset.fullAlt = p.full; fig.dataset.page = p.page; fig.dataset.label = p.label;
      show(sized(p.thumb, w), p.thumb);
    });
    if (fig.dataset.src) {
      // Official photo first; if the site blocks it, fall back to the licensed Wikipedia photo.
      show(fig.dataset.src, null, () => {
        delete fig.dataset.src; delete fig.dataset.credit; fig.dataset.kind = fig.dataset.kind || '';
        const tag = fig.querySelector('.ph-tag'); if (tag) tag.remove();
        if (fig.dataset.photo) fromWiki(); else fig.classList.add('failed');
      });
      return;
    }
    fromWiki();
  }

  let io = null;
  function hydrate(root) {
    const figs = (root || document).querySelectorAll('figure.ph[data-photo]:not([data-done]), figure.ph[data-src]:not([data-done])');
    if (!('IntersectionObserver' in window)) { figs.forEach(fill); return; }
    io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); } }), { rootMargin: '300px' });
    const vh = window.innerHeight || 800;
    figs.forEach((f) => {
      // Local/own photos and anything already near the screen load now; the rest lazily on scroll.
      const r = f.getBoundingClientRect();
      if (f.dataset.src || (r.bottom > -300 && r.top < vh + 300)) fill(f); else io.observe(f);
    });
  }

  // Full-screen viewer with credit, so people can look properly before choosing.
  function open(fig) {
    let dlg = document.getElementById('lightbox');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'lightbox'; dlg.className = 'lightbox';
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
      document.body.appendChild(dlg);
    }
    const esc = PL.util.esc, kind = fig.dataset.kind;
    const note = kind === 'dish' ? 'Illustrative photo of a typical dish, not taken at this restaurant.'
      : kind === 'idea' ? 'Illustrative photo of the activity, not taken at this venue.' : '';
    const src = fig.dataset.full || (fig.querySelector('img') || {}).src;
    const official = !!fig.dataset.src && fig.dataset.credit;
    const credit = official
      ? `<br><span>Photo: ${esc(fig.dataset.credit)}${fig.dataset.srcPage ? ` · <a href="${esc(fig.dataset.srcPage)}" target="_blank" rel="noopener">view on their website ↗</a>` : ''}</span>`
      : fig.dataset.page ? `<br><span>Photo: <a href="${esc(fig.dataset.page)}" target="_blank" rel="noopener">Wikipedia / Wikimedia Commons (${esc(fig.dataset.label)}) ↗</a>. See the file page for author &amp; licence.</span>` : '';
    dlg.innerHTML = `<figure>
        <img src="${esc(src)}" alt="${esc(fig.dataset.alt || '')}" referrerpolicy="no-referrer">
        <figcaption><strong>${esc(fig.dataset.title || fig.dataset.alt || '')}</strong>${!official && note ? '<br><span>' + note + '</span>' : ''}${credit}</figcaption>
      </figure>
      <button type="button" class="btn lb-close" data-close aria-label="Close photo">✕</button>`;
    const big = dlg.querySelector('img'), alt = fig.dataset.fullAlt;
    big.onerror = () => { if (alt && big.src !== alt) big.src = alt; };
    dlg.showModal();
  }

  return { get, hydrate, open };
})();

PL.applyOfficialPhoto = function (x) {
  const o = PL.OFFICIAL_PHOTOS && PL.OFFICIAL_PHOTOS[x.id];
  if (o && !x.image_url) { x.image_url = o.src; x.image_credit = o.credit; x.image_page = o.page; }
  return x;
};

PL.store = {
  _get(area, k, d) {
    try { const v = window[area].getItem('pl_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  _set(area, k, v) { try { window[area].setItem('pl_' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  get(k, d) { return this._get('localStorage', k, d); },
  set(k, v) { this._set('localStorage', k, v); },
  sget(k, d) { return this._get('sessionStorage', k, d); },
  sset(k, v) { this._set('sessionStorage', k, v); },

  // ---- content (seed + admin overrides) ----
  content() {
    const saved = this.get('content', null);
    // Content saved by editors before newer fields existed: fill those fields from the seed.
    const fill = (list, seed, keys) => list.map((x) => {
      const s = seed.find((y) => y.id === x.id);
      keys.forEach((k) => { if (x[k] === undefined) x[k] = s ? s[k] : (k === 'reservation_required' ? false : ''); });
      return x;
    });
    let activities = saved && saved.activities ? fill(saved.activities, PL.SEED_ACTIVITIES, ['photo', 'photo_kind', 'image_url', 'booking_url']) : PL.SEED_ACTIVITIES;
    // Official venue photos (js/photos-official.js), unless an editor set their own image.
    if (PL.OFFICIAL_PHOTOS) activities.forEach((a) => PL.applyOfficialPhoto(a));
    // Imported Eventbrite events (js/events-eventbrite.js) join the pool unless an editor already has them.
    if (PL.EVENTBRITE_EVENTS && PL.EVENTBRITE_EVENTS.length) {
      const have = new Set(activities.map((a) => a.id));
      activities = activities.concat(PL.EVENTBRITE_EVENTS.filter((e) => !have.has(e.id)));
    }
    return {
      activities,
      restaurants: saved && saved.restaurants ? fill(saved.restaurants, PL.SEED_RESTAURANTS, ['photo', 'photo_kind', 'image_url', 'reservation_required', 'beef_focused']) : PL.SEED_RESTAURANTS,
      tips: (saved && saved.tips) || PL.SEED_TIPS,
      updated_at: saved && saved.updated_at
    };
  },
  saveContent(c) { this.set('content', Object.assign({}, c, { updated_at: new Date().toISOString() })); },
  resetContent() { try { localStorage.removeItem('pl_content'); } catch (e) { /* ignore */ } },

  // ---- per-user lists (no account needed) ----
  list(name) { return this.get(name, []); },
  toggleIn(name, id, on) {
    const l = this.list(name).filter((x) => x !== id);
    if (on) l.unshift(id);
    this.set(name, l); return on;
  },
  bumpView(id) { const v = this.get('views', {}); v[id] = (v[id] || 0) + 1; this.set('views', v); },

  // ---- privacy-friendly local funnel analytics (no third parties) ----
  track(event, n) {
    const a = this.get('analytics', { counts: {}, sessions: {} });
    a.counts[event] = (a.counts[event] || 0) + (n || 1);
    const sid = this.sget('sid', null) || (() => { const s = PL.util.randomId(6); this.sset('sid', s); return s; })();
    a.sessions[sid] = a.sessions[sid] || {};
    a.sessions[sid][event] = true;
    a.sessions[sid].t = Date.now();
    this.set('analytics', a);
  }
};
