/* Gift ideas (#/gifts): browse gifts from Singapore suppliers, filtered by occasion, budget,
 * type and love language. Experience gifts can be turned straight into a date plan. */
window.PL = window.PL || {};
PL.routes = PL.routes || {};

(function () {
  const U = PL.util, S = PL.store, esc = U.esc;

  function filters() { return S.sget('giftFilters', null) || { occasion: 'any', band: 'any', types: [], love: 'any' }; }

  function chips(group, opts, sel, multi) {
    return `<div class="chips">` + opts.map((o) => {
      const on = multi ? sel.includes(o.id) : sel === o.id;
      return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-gift-f="${group}" data-v="${esc(o.id)}" ${o.hint ? `title="${esc(o.hint)}"` : ''}>${o.emoji ? o.emoji + ' ' : ''}${esc(o.label)}</button>`;
    }).join('') + `</div>`;
  }

  function matches(g, f) {
    if (f.occasion !== 'any' && !g.occasions.includes(f.occasion)) return false;
    if (f.band !== 'any' && g.band > Number(f.band)) return false;
    if (f.types.length && !f.types.includes(g.type)) return false;
    if (f.love !== 'any' && !g.love.includes(f.love)) return false;
    return true;
  }

  function cardHTML(g) {
    const t = PL.GIFT_TYPES.find((x) => x.id === g.type);
    const saved = S.list('savedGifts').includes(g.id);
    const loves = g.love.map((l) => PL.LOVE_LANGUAGES.find((x) => x.id === l).label).join(' · ');
    let action;
    if (g.plan_activity && g.kind !== 'shop') action = `<button type="button" class="btn tiny primary" data-gift-act="plan" data-a="${g.plan_activity}">Plan this as a date →</button>`;
    else if (g.internal) action = `<a class="btn tiny primary" href="${g.internal}">${g.internal === '#/memories' ? 'Open Memories →' : 'Start planning →'}</a>`;
    else action = '';
    const shop = g.url ? `<a class="btn tiny ${action ? '' : 'primary'}" href="${esc(g.url)}" target="_blank" rel="noopener">Visit ${esc(g.supplier)} ↗</a>` : '';
    return `<article class="gift" id="gift-${g.id}">
      <div class="gift-media cat-${g.kind === 'experience' ? 'events' : g.kind === 'diy' ? 'chill' : 'food'}">
        <span aria-hidden="true">${t.emoji}</span>
        ${PL.app.photoHTML(PL.applyOfficialPhoto({ id: g.id, name: g.name, photo: g.photo, photo_kind: g.photo_kind, image_url: g.image_url || '', image_credit: g.image_credit, image_page: g.image_page }), { w: 500, cls: 'ph-card' })}
        ${g.sponsored ? '<span class="badge badge-sp">Sponsored</span>' : ''}
      </div>
      <div class="gift-body">
        <span class="tag">${esc(t.label)} · ${esc(PL.GIFT_BANDS[g.band])}</span>
        <h3>${esc(g.name)}</h3>
        <p class="gift-supplier">${g.kind === 'shop' || g.url ? 'by ' : ''}<strong>${esc(g.supplier)}</strong>${g.kind === 'shop' ? ' · Singapore' : ''}</p>
        <p class="desc clamp2" title="${esc(g.desc)}">${esc(g.desc)}</p>
        <p class="tip-mini clamp2" title="${esc(g.why)}"><strong>💬 Why it works:</strong> ${esc(g.why)}</p>
        <p class="gift-love">❤️ ${esc(loves)}</p>
        <div class="actions">
          ${action}${shop}
          <button type="button" class="btn tiny icon ${saved ? 'on' : ''}" data-gift-act="save" data-id="${g.id}" aria-pressed="${saved}" aria-label="Save gift idea">${saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const { $app } = PL.app;
    const f = filters();
    const list = PL.GIFTS.filter((g) => matches(g, f));
    const pg = U.paginate(list, S.sget('giftPage', 1), 12, 'data-gift-act="page"', 'Gift pages');
    const active = f.occasion !== 'any' || f.band !== 'any' || f.types.length || f.love !== 'any';
    $app.innerHTML = `
    <section class="screen gifts">
      <header class="cal-head">
        <h1 class="screen-h">Gift ideas</h1>
        <p class="hint">Thoughtful gifts from Singapore brands, plus experiences and DIY ideas, picked with a relationship expert's eye.</p>
      </header>

      <fieldset class="field"><legend>Occasion</legend>${chips('occasion', [{ id: 'any', label: 'Any' }, ...PL.GIFT_OCCASIONS], f.occasion)}</fieldset>
      <fieldset class="field"><legend>Budget</legend>${chips('band', [{ id: 'any', label: 'Any' }, { id: '1', label: 'Up to $30' }, { id: '2', label: 'Up to $80' }, { id: '3', label: 'Up to $200' }], f.band)}</fieldset>
      <details class="more" ${S.sget('giftMore', false) || f.types.length || f.love !== 'any' ? 'open' : ''} id="gift-more">
        <summary>Type & love language <span class="hint">optional</span></summary>
        <fieldset class="field"><legend>Type of gift</legend>${chips('types', PL.GIFT_TYPES, f.types, true)}</fieldset>
        <fieldset class="field"><legend>Their love language <span class="hint">how they feel most appreciated</span></legend>
          ${chips('love', [{ id: 'any', label: 'Not sure' }, ...PL.LOVE_LANGUAGES], f.love)}
          ${f.love !== 'any' ? `<p class="hint">${esc(PL.LOVE_LANGUAGES.find((l) => l.id === f.love).hint)}.</p>` : ''}
        </fieldset>
      </details>

      <h2 class="section-h">${list.length} gift idea${list.length === 1 ? '' : 's'} ${active ? '<button type="button" class="linkish" data-gift-act="clear">Clear filters</button>' : ''}</h2>
      ${list.length ? `<div class="gift-grid">${pg.items.map(cardHTML).join('')}</div>${pg.html}`
        : '<div class="empty"><p>No ideas match all those filters. Try a different budget or occasion.</p><button type="button" class="btn tiny" data-gift-act="clear">Clear filters</button></div>'}

      <blockquote class="tip gift-expert"><span class="tip-h">💬 Expert note</span> The best gifts show you've been paying attention. A small, specific gift tied to something they said ("you mentioned…") usually means more than an expensive generic one.</blockquote>
      <p class="fineprint">Brands listed are independent Singapore businesses. Next Date isn't paid by them, and any paid placement will be labelled "Sponsored". Check prices, stock and delivery on each brand's site. Photos marked 📷 come from the brand's own website and link back to it; others are illustrative (Wikipedia / Wikimedia Commons), not the brand's products.</p>
    </section>`;
    PL.photos.hydrate($app);
    document.getElementById('gift-more').addEventListener('toggle', (e) => S.sset('giftMore', e.target.open));
  }

  document.addEventListener('click', (e) => {
    if (document.body.dataset.route !== 'gifts') return;
    const chip = e.target.closest('[data-gift-f]');
    const act = e.target.closest('[data-gift-act]');
    if (!chip && !act) return;
    const f = filters();
    if (chip) {
      const g = chip.dataset.giftF, v = chip.dataset.v;
      if (g === 'types') { const i = f.types.indexOf(v); if (i >= 0) f.types.splice(i, 1); else f.types.push(v); }
      else f[g] = v;
      S.sset('giftFilters', f); S.sset('giftPage', 1); render(); return;
    }
    switch (act.dataset.giftAct) {
      case 'clear': S.sset('giftFilters', null); S.sset('giftPage', 1); render(); break;
      case 'page': S.sset('giftPage', Number(act.dataset.p)); render(); document.querySelector('.gifts .section-h').scrollIntoView(); break;
      case 'save': {
        const id = act.dataset.id, on = S.toggleIn('savedGifts', id, !S.list('savedGifts').includes(id));
        PL.app.toast(on ? 'Gift idea saved. Find it in My plans ♥' : 'Removed from saved gifts');
        S.track(on ? 'gift_saved' : 'gift_unsaved');
        const el = document.getElementById('gift-' + id);
        if (el) { el.outerHTML = cardHTML(PL.GIFTS.find((g) => g.id === id)); PL.photos.hydrate(document.getElementById('gift-' + id)); }
        break;
      }
      case 'plan': {
        // Experience gift → a ready plan on the user's chosen date, straight to the invitation.
        const st = PL.app.state;
        st.plan = [{ id: act.dataset.a }]; st.draft = null; st.result = null; PL.app.persist();
        S.track('gift_planned'); S.track('activity_selected');
        location.hash = '#/invite'; break;
      }
    }
  });

  PL.routes.gifts = render;
})();
