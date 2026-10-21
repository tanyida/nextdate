/* Invitation brochure: templates, copy helpers, image export, .ics and share links. */
window.PL = window.PL || {};

PL.invite = (function () {
  const U = PL.util;

  const TEMPLATES = [
    { id: 'romantic', name: 'Romantic', emoji: '🌹', bg: '#fbe9ec', bg2: '#f6d3da', fg: '#4a1424', accent: '#b8325a', muted: '#7d4a58', display: 'Fraunces', body: 'DM Sans', kicker: 'You\'re invited' },
    { id: 'playful', name: 'Playful', emoji: '🎈', bg: '#fff3b0', bg2: '#ffd6a5', fg: '#2b2118', accent: '#e8513a', muted: '#6b5440', display: 'DM Sans', body: 'DM Sans', kicker: 'Psst… date time!' },
    { id: 'minimal', name: 'Minimal', emoji: '◻️', bg: '#ffffff', bg2: '#f2f2f0', fg: '#141414', accent: '#141414', muted: '#666661', display: 'DM Sans', body: 'DM Sans', kicker: 'A plan for us' },
    { id: 'retro', name: 'Retro Singapore', emoji: '🏮', bg: '#f4e7cf', bg2: '#e7d3ad', fg: '#1f3b3a', accent: '#c4502c', muted: '#5a5446', display: 'Fraunces', body: 'DM Sans', kicker: 'Jio you go paktor' },
    { id: 'family', name: 'Family day out', emoji: '🧺', bg: '#e3f2fb', bg2: '#d3ecd9', fg: '#14324a', accent: '#1f7a5c', muted: '#4c6475', display: 'DM Sans', body: 'DM Sans', kicker: 'Family day out!' }
  ];
  const byId = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

  // Rule-based "suggested" opening lines. A server-side LLM could replace this later;
  // its output would still be reviewed against the expert's tone guide.
  const LINES = {
    romantic: ['{to}, I planned us a little escape. Say yes?', 'Clear your {day}, {to}. I have plans for us.', 'Same us, new adventure. Come with me, {to}?'],
    playful: ['{to}! Free on {day}? Don\'t say no, I already planned everything 😆', 'Paktor lah, {to}! Bring your appetite and your best walking shoes.', 'Breaking news: {to} has been selected for an excellent date.'],
    minimal: ['{to}, a plan for {day}. Just us.', 'Thought you\'d like this one, {to}.', '{day}. You and me. Details below.'],
    retro: ['Oi {to}, {day} we go makan and jalan-jalan, can?', '{to}, jio you go paktor this {day}. Confirm plus chop?', 'Like old times but better. {day} can or not, {to}?'],
    family: ['Family adventure alert! {day} is sorted.', 'Pack the snacks, {day} is a family day out!', 'Little explorers, big day out. See you {day}!']
  };
  function suggestLine(tpl, to, date, n) {
    const arr = LINES[tpl] || LINES.romantic;
    const day = date ? U.parseDate(date).toLocaleDateString('en-SG', { timeZone: 'UTC', weekday: 'long' }) : 'the weekend';
    return arr[(n || 0) % arr.length].replace(/\{to\}/g, to || 'you').replace(/\{day\}/g, day);
  }

  function dressCode(acts) {
    const cats = new Set(acts.flatMap((a) => a.categories));
    const outdoor = acts.some((a) => a.indoor_outdoor === 'outdoor');
    if (cats.has('sports')) return 'Sporty and comfy: breathable top, sneakers, a small towel.';
    if (cats.has('nature') && outdoor) return 'Casual and cool: walking shoes, a cap, sunblock and mozzie spray.';
    if (cats.has('nightlife')) return 'Smart casual: no slippers or shorts, in case of a dress code.';
    if (cats.has('wellness')) return 'Relaxed: easy-on clothes and minimal accessories.';
    if (cats.has('workshops')) return 'Casual: something you don\'t mind getting a little messy.';
    if (outdoor) return 'Casual: light clothes and a foldable umbrella, just in case.';
    return 'Smart casual: dress up a little, it\'s a date.';
  }

  // Compact, link-embeddable payload. No surname or phone number is collected.
  function build(plan, prefs, fields) {
    const it = PL.engine.itinerary(plan, prefs);
    return {
      v: 1, id: fields.id || U.randomId(9), tpl: fields.tpl, to: fields.to, from: fields.from,
      msg: fields.msg, line: fields.line, starter: fields.starter, showCost: fields.showCost,
      date: prefs.date, kids: prefs.withKids,
      dress: dressCode(plan.map((p) => p.activity)),
      cost: it.cost, costPartial: plan.some((p) => p.activity.price_min == null),
      steps: it.steps.map((s) => ({
        k: s.kind === 'meal' ? 'm' : 'a', n: s.place.name, ve: s.place.venue || '', ad: s.place.address,
        la: s.place.lat, lo: s.place.lng, s: s.start, d: s.dur,
        u: s.kind === 'meal' ? (s.place.reservation_required ? PL.engine.reserveUrl(s.place) : (s.place.booking_url || '')) : PL.engine.bookingUrl(s.place),
        mt: s.place.mealType || '', bk: !!s.place.booking_required, rv: !!s.place.reservation_required
      })),
      exp: U.addDays(prefs.date, 30)
    };
  }

  function stepTitle(s) { return s.k === 'm' ? (PL.engine.MEALS[s.mt] ? PL.engine.MEALS[s.mt].label : 'Meal') + ' · ' + s.n : s.n; }

  function cardHTML(inv) {
    const t = byId(inv.tpl), e = U.esc;
    const end = inv.steps.length ? inv.steps[inv.steps.length - 1].s + inv.steps[inv.steps.length - 1].d : 0;
    return `
    <article class="inv tpl-${t.id}" aria-label="Date invitation">
      <div class="inv-deco" aria-hidden="true"></div>
      <p class="inv-kicker">${e(t.kicker)}</p>
      <h2 class="inv-to">${inv.to ? 'Dear ' + e(inv.to) + ',' : 'Hey you,'}</h2>
      ${inv.line ? `<p class="inv-line">${e(inv.line)}</p>` : ''}
      <div class="inv-when">
        <span class="inv-date">${e(U.fmtDate(inv.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
        ${inv.steps.length ? `<span class="inv-time">${U.fmtTime(inv.steps[0].s)} – ${U.fmtTime(end)}</span>` : ''}
      </div>
      <ol class="inv-steps">
        ${inv.steps.map((s) => `
          <li class="inv-step ${s.k === 'm' ? 'is-meal' : ''}">
            <span class="inv-step-time">${U.fmtTime(s.s)}</span>
            <div>
              <strong>${s.k === 'm' ? '🍽️ ' : '✨ '}${e(stepTitle(s))}</strong>
              <a class="inv-map" href="${e(U.mapUrl({ lat: s.la, lng: s.lo, name: s.n, address: s.ad }))}" target="_blank" rel="noopener">📍 ${e(s.ve && s.ve !== s.n ? s.ve + ', ' : '')}${e(s.ad)}</a>
              ${s.bk ? `<a class="inv-note" href="${e(s.u)}" target="_blank" rel="noopener">🎟️ Tickets needed: book here ↗</a>` : ''}
              ${s.rv ? `<a class="inv-note" href="${e(s.u)}" target="_blank" rel="noopener">📞 Reservation recommended: reserve ↗</a>` : ''}
            </div>
          </li>`).join('')}
      </ol>
      ${inv.msg ? `<p class="inv-msg">${e(inv.msg).replace(/\n/g, '<br>')}</p>` : ''}
      <dl class="inv-meta">
        <div><dt>Dress code</dt><dd>${e(inv.dress)}</dd></div>
        ${inv.showCost ? `<div><dt>Est. cost</dt><dd>~$${inv.cost}${inv.costPartial ? ' + event tickets' : ''} total</dd></div>` : ''}
        ${inv.starter ? `<div><dt>Conversation starter</dt><dd>${e(inv.starter)}</dd></div>` : ''}
      </dl>
      <p class="inv-from">${inv.from ? '— ' + e(inv.from) : ''}</p>
      <p class="inv-brand">Planned with Paktor Lah</p>
    </article>`;
  }

  // ---- PNG export, drawn directly on canvas (no external libraries) ----
  async function toPNG(inv) {
    const t = byId(inv.tpl);
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
    const W = 1080, H = 1920, P = 96;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, t.bg); grad.addColorStop(1, t.bg2);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.strokeStyle = t.accent; g.lineWidth = 6; g.strokeRect(40, 40, W - 80, H - 80);
    if (t.id === 'retro') { // peranakan-tile corner motifs
      g.fillStyle = t.accent;
      [[40, 40], [W - 120, 40], [40, H - 120], [W - 120, H - 120]].forEach(([x, y]) => { g.save(); g.translate(x + 40, y + 40); g.rotate(Math.PI / 4); g.fillRect(-22, -22, 44, 44); g.restore(); });
    }
    const font = (w, s, fam) => `${w} ${s}px "${fam}", system-ui, sans-serif`;
    const wrap = (text, x, y, maxW, lh) => {
      const words = String(text).split(/\s+/); let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = test;
      }
      if (line) { g.fillText(line, x, y); y += lh; }
      return y;
    };
    let y = 190;
    g.fillStyle = t.accent; g.font = font(700, 34, t.body); g.fillText(t.kicker.toUpperCase(), P, y); y += 100;
    g.fillStyle = t.fg; g.font = font(700, 84, t.display); y = wrap(inv.to ? 'Dear ' + inv.to + ',' : 'Hey you,', P, y, W - 2 * P, 96);
    if (inv.line) { g.font = font(400, 42, t.body); g.fillStyle = t.muted; y = wrap(inv.line, P, y + 10, W - 2 * P, 58); }
    y += 40;
    g.fillStyle = t.accent; g.fillRect(P, y, W - 2 * P, 4); y += 80;
    g.fillStyle = t.fg; g.font = font(700, 54, t.display);
    g.fillText(U.fmtDate(inv.date, { weekday: 'long', day: 'numeric', month: 'long' }), P, y); y += 64;
    if (inv.steps.length) {
      const last = inv.steps[inv.steps.length - 1];
      g.font = font(500, 38, t.body); g.fillStyle = t.muted; g.fillText(U.fmtTime(inv.steps[0].s) + ' – ' + U.fmtTime(last.s + last.d), P, y); y += 90;
    }
    inv.steps.forEach((s) => {
      g.fillStyle = t.accent; g.font = font(700, 36, t.body); g.fillText(U.fmtTime(s.s), P, y);
      g.fillStyle = t.fg; g.font = font(700, 42, t.body); const yy = wrap(stepTitle(s), P + 190, y, W - 2 * P - 190, 52);
      g.fillStyle = t.muted; g.font = font(400, 32, t.body); y = wrap((s.ve && s.ve !== s.n ? s.ve + ', ' : '') + s.ad, P + 190, yy, W - 2 * P - 190, 42) + 40;
    });
    if (inv.msg) { g.fillStyle = t.fg; g.font = font(400, 40, t.body); y = wrap('“' + inv.msg.replace(/\n/g, ' ') + '”', P, y + 10, W - 2 * P, 54) + 30; }
    g.font = font(400, 32, t.body); g.fillStyle = t.muted;
    y = wrap('Dress code: ' + inv.dress, P, y, W - 2 * P, 44);
    if (inv.showCost) y = wrap('Est. cost: ~$' + inv.cost + (inv.costPartial ? ' + event tickets' : '') + ' total', P, y, W - 2 * P, 44);
    if (inv.from) { g.fillStyle = t.fg; g.font = font(700, 52, t.display); g.fillText('— ' + inv.from, P, Math.min(Math.max(y + 70, H - 260), H - 200)); }
    g.fillStyle = t.muted; g.font = font(500, 28, t.body); g.fillText('Planned with Paktor Lah', P, H - 110);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  // ---- Calendar (.ics), times converted from SGT (UTC+8, no DST) to UTC ----
  function ics(inv) {
    const stamp = (date, min) => {
      const d = U.parseDate(date); d.setUTCMinutes(min - 480);
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Paktor Lah//Date plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    inv.steps.forEach((s, i) => {
      lines.push('BEGIN:VEVENT', 'UID:' + inv.id + '-' + i + '@paktorlah', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
        'DTSTART:' + stamp(inv.date, s.s), 'DTEND:' + stamp(inv.date, s.s + s.d),
        'SUMMARY:' + esc((s.k === 'm' ? '🍽️ ' : '💞 ') + stepTitle(s)),
        'LOCATION:' + esc((s.ve ? s.ve + ', ' : '') + s.ad + ', Singapore'),
        'DESCRIPTION:' + esc((inv.from ? 'Planned by ' + inv.from + '. ' : '') + (s.u ? s.u : '')),
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function shareText(inv, url) {
    return `${inv.line || ('Hey ' + (inv.to || '') + ', date?')} 💌 ${U.fmtDate(inv.date)}: ${url}`;
  }
  const whatsapp = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);
  const telegram = (url, text) => 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);

  return { TEMPLATES, byId, suggestLine, dressCode, build, cardHTML, toPNG, ics, shareText, whatsapp, telegram };
})();
