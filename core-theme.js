/*
 * TDMH Core – shared display settings and icons.
 * Load in <head>, before the page's own CSS:  <script src="core-theme.js"></script>
 * It applies the saved theme before the first paint, so pages never flash white.
 *
 *   TDMHTheme.open(buttonEl)        show / hide the Display pop-up under a button
 *   TDMHTheme.set({mode, accent})   change settings ("light" | "dark" | "auto"; "indigo" | "green" | "teal" | "ink")
 *   TDMHTheme.get()                 { mode, accent, effective }
 *   TDMHTheme.useSupabase(SB)       save changes to the signed-in user's account (users.ui_prefs)
 *   TDMHTheme.adopt(prefs)          apply what the account has saved (call after sign-in)
 *   TDMHTheme.onChange(fn)          e.g. redraw Chart.js charts
 *   TDMHTheme.color('--accent')     a token's current value, for canvas drawing
 *   TDMHIcons.svg(name, size)       inline stroke icon;  TDMHIcons.hydrate(root) fills <span data-ic="name">
 */
(function () {
  var KEY = 'tdmh_ui';
  var MODES = ['light', 'dark', 'auto'];
  var ACCENTS = ['indigo', 'green', 'teal', 'ink'];
  var ACCENT_LABEL = { indigo: 'Indigo (TDMH)', green: 'Green (TDMH)', teal: 'Teal', ink: 'Ink' };
  var MODE_LABEL = { light: 'LIGHT', dark: 'DARK', auto: 'AUTO' };
  var html = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function clean(p) {
    p = p || {};
    return {
      mode: MODES.indexOf(p.mode) > -1 ? p.mode : 'light',
      accent: ACCENTS.indexOf(p.accent) > -1 ? p.accent : 'indigo'
    };
  }
  function readLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v) return clean(v);
      var legacy = localStorage.getItem('tdmh_theme');
      if (legacy) return clean({ mode: legacy });
    } catch (e) {}
    return clean({});
  }

  var prefs = readLocal();
  var saver = null;
  var listeners = [];

  function effective() { return prefs.mode === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : prefs.mode; }
  function apply() {
    var eff = effective();
    html.setAttribute('data-theme', eff);
    html.setAttribute('data-accent', prefs.accent);
    html.style.colorScheme = eff;
  }
  function store() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
      localStorage.setItem('tdmh_theme', effective());
    } catch (e) {}
  }
  function get() { return { mode: prefs.mode, accent: prefs.accent, effective: effective() }; }
  function emit() {
    syncPop();
    listeners.forEach(function (fn) { try { fn(get()); } catch (e) { console.error(e); } });
  }
  function reduceMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  apply();
  function onSystemChange() { if (prefs.mode === 'auto') { apply(); emit(); } }
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', onSystemChange); else if (mq.addListener) mq.addListener(onSystemChange); }

  function swap(next, evt) {
    var kind = next.mode !== prefs.mode ? 'reveal' : 'fade';
    if (evt && evt.clientX != null) {
      html.style.setProperty('--vx', evt.clientX + 'px');
      html.style.setProperty('--vy', evt.clientY + 'px');
    }
    html.setAttribute('data-vt', kind);
    var run = function () {
      html.classList.add('tx-switching');
      prefs = next; apply(); store(); emit();
    };
    var done = function () { requestAnimationFrame(function () { html.classList.remove('tx-switching'); }); };
    if (document.startViewTransition && !reduceMotion()) {
      var vt = document.startViewTransition(run);
      vt.finished.then(done, done);
    } else { run(); done(); }
  }
  function set(partial, evt) {
    var next = clean(Object.assign({}, prefs, partial || {}));
    if (next.mode === prefs.mode && next.accent === prefs.accent) return;
    swap(next, evt);
    if (saver) { try { Promise.resolve(saver({ mode: next.mode, accent: next.accent })).catch(function () {}); } catch (e) {} }
  }
  function adopt(server) {
    if (server && (server.mode || server.accent)) {
      var next = clean(server);
      if (next.mode !== prefs.mode || next.accent !== prefs.accent) {
        html.classList.add('tx-switching');
        prefs = next; apply(); store(); emit();
        requestAnimationFrame(function () { html.classList.remove('tx-switching'); });
      }
    } else if (saver) {
      // First sign-in with this feature: keep what this device already uses and save it to the account
      try { Promise.resolve(saver({ mode: prefs.mode, accent: prefs.accent })).catch(function () {}); } catch (e) {}
    }
  }
  function useSupabase(sb) {
    saver = function (p) { return sb.rpc('set_my_ui_prefs', { p_prefs: p }); };
    syncPop();
  }
  function color(name) { return getComputedStyle(html).getPropertyValue(name).trim(); }

  /* ── Display pop-up ─────────────────────────────────────────── */
  var pop = null, anchor = null;
  function build() {
    pop = document.createElement('div');
    pop.className = 'tx-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Display settings');
    pop.hidden = true;
    var modes = MODES.map(function (m) {
      return '<button type="button" class="tx-seg" data-mode="' + m + '">' + MODE_LABEL[m] + '</button>';
    }).join('');
    var accents = ACCENTS.map(function (a) {
      return '<button type="button" class="tx-acc" data-accent="' + a + '"><span class="tx-dot tx-dot-' + a + '"></span>' +
        '<span class="tx-acc-l">' + ACCENT_LABEL[a] + '</span><span class="tx-check">' + icon('check', 16) + '</span></button>';
    }).join('');
    pop.innerHTML =
      '<div class="tx-pop-hd"><span>DISPLAY</span><button type="button" class="tx-x" aria-label="Isara">' + icon('x', 16) + '</button></div>' +
      '<div class="tx-pop-sec"><span class="tx-pop-t">Tema</span><div class="tx-segs" role="group" aria-label="Tema">' + modes + '</div></div>' +
      '<div class="tx-pop-sec"><span class="tx-pop-t">Kulay</span><div class="tx-accs" role="group" aria-label="Kulay">' + accents + '</div></div>' +
      '<div class="tx-pop-ft" id="txPopFt"></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('tx-x')) { close(true); return; }
      if (b.dataset.mode) set({ mode: b.dataset.mode }, e);
      if (b.dataset.accent) set({ accent: b.dataset.accent }, e);
    });
    syncPop();
  }
  function syncPop() {
    document.querySelectorAll('[data-tx-mode-label]').forEach(function (el) { el.textContent = MODE_LABEL[prefs.mode]; });
    if (!pop) return;
    pop.querySelectorAll('.tx-seg').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === prefs.mode)); });
    pop.querySelectorAll('.tx-acc').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.accent === prefs.accent)); });
    var ft = pop.querySelector('#txPopFt');
    if (ft) ft.textContent = saver ? 'NASE-SAVE SA ACCOUNT MO' : 'NASE-SAVE SA DEVICE NA ITO';
  }
  function place() {
    if (!pop || !anchor) return;
    var r = anchor.getBoundingClientRect();
    var w = pop.offsetWidth || 288;
    var left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom + 8) + 'px';
  }
  function onDoc(e) { if (pop && !pop.contains(e.target) && anchor && !anchor.contains(e.target)) close(false); }
  function onKey(e) { if (e.key === 'Escape') close(true); }
  function open(btn) {
    if (!pop) build();
    if (!pop.hidden) { close(true); return; }
    anchor = btn || null;
    pop.hidden = false;
    place();
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('touchstart', onDoc, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    var first = pop.querySelector('[aria-pressed="true"]') || pop.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
  function close(returnFocus) {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('touchstart', onDoc, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
    if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (returnFocus) anchor.focus(); }
  }

  /* ── Icons (24px grid, 1.75 stroke) ─────────────────────────── */
  var P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    megaphone: '<path d="M3 10v4h4l6 4V6L7 10H3z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    memo: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-2.5z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    medkit: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
    car: '<path d="M4 15l1.5-6h13L20 15M3 15h18v4H3z"/><path d="M6.5 19v1.5M17.5 19v1.5"/>',
    stethoscope: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a4 4 0 0 0 8 0v-2"/><circle cx="19" cy="12" r="2"/>',
    bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
    pulse: '<path d="M2 12h4l2-6 4 12 3-9 2 3h5"/>',
    scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
    pin: '<path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    scroll: '<path d="M7 3h11a2 2 0 0 1 0 4H7zM7 3a2 2 0 0 0-2 2v12a3 3 0 0 0 3 3h10a2 2 0 0 0 2-2V7"/><path d="M9 11h7M9 15h5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l4.5 4.5L19 7"/>',
    arrow: '<path d="M7 17L17 7M9 7h8v8"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>'
  };
  function icon(name, size) {
    var s = size || 18;
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || P.list) + '</svg>';
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-ic]').forEach(function (el) {
      if (el.dataset.icDone === el.dataset.ic) return;
      el.innerHTML = icon(el.dataset.ic, Number(el.dataset.icSize) || undefined);
      el.dataset.icDone = el.dataset.ic;
    });
  }

  window.TDMHTheme = {
    get: get, set: set, adopt: adopt, useSupabase: useSupabase, color: color,
    open: open, close: close,
    onChange: function (fn) { listeners.push(fn); },
    accents: ACCENTS.slice(), modes: MODES.slice()
  };
  window.TDMHIcons = { svg: icon, hydrate: hydrate, names: Object.keys(P) };
})();

/*
 * Live ECG trace — turns every <svg class="cx-trace"> / <svg class="tx-login-trace"> (with a <polyline>)
 * into a patient-monitor sweep: the line is redrawn left→right with a bright head dot, older beats fade,
 * and a short gap erases just ahead of the head. One sweep = 6 beats in 5 s (≈72 bpm).
 * It is small and decorative, so it runs everywhere; computers set to "reduce motion" get a calmer 8-second sweep.
 * Stops by itself when the SVG leaves the page; the browser pauses it while the tab is hidden.
 *   TDMHEcg.scan(root)   wire any new traces (runs automatically on page changes)
 */
(function () {
  var NS = 'http://www.w3.org/2000/svg', W = 1200, H = 120, PERIOD = 5000, GAP = 36, seq = 0;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function calm() { return !!(mqReduce && mqReduce.matches); }
  var announced = false;

  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function parse(s) { return String(s || '').trim().split(/\s+/).map(function (p) { var a = p.split(','); return [+a[0], +a[1]]; }); }
  function yAt(P, x) {
    for (var i = 1; i < P.length; i++) if (P[i][0] >= x) {
      var a = P[i - 1], b = P[i], f = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * f;
    }
    return P[P.length - 1][1];
  }

  function wire(svg) {
    if (svg.__ecg) return;
    var line = svg.querySelector('polyline'); if (!line) return;
    var P = parse(line.getAttribute('points')); if (P.length < 2) return;
    svg.__ecg = true;
    var id = 'tdmhEcg' + (++seq);

    // Mask brightness repeats every W units relative to the head: bright at the head, an erased gap just ahead,
    // then the previous sweep fading from dim (oldest) back up to bright (newest, just behind the head).
    var g = GAP / (2 * W), r = 0.008;
    var grad = el('linearGradient', { id: id + 'g', x1: '0', x2: '1', y1: '0', y2: '0' });
    [[0, 1], [g, 0], [g + r, 0.14], [0.5, 1], [0.5 + g, 0], [0.5 + g + r, 0.14], [1, 1]].forEach(function (s) {
      grad.appendChild(el('stop', { offset: s[0], 'stop-color': '#fff', 'stop-opacity': s[1] }));
    });
    var sweep = el('rect', { x: -W, y: -20, width: 2 * W, height: H + 40, fill: 'url(#' + id + 'g)' });
    var mask = el('mask', { id: id, maskUnits: 'userSpaceOnUse', x: 0, y: -20, width: W, height: H + 40 });
    mask.appendChild(sweep);
    var defs = el('defs', {}); defs.appendChild(grad); defs.appendChild(mask);
    svg.insertBefore(defs, svg.firstChild);

    line.classList.remove('tx-trace');                       // replace the one-off draw-in with the live sweep
    line.style.strokeDasharray = 'none'; line.style.animation = 'none';
    line.setAttribute('mask', 'url(#' + id + ')');

    // Head: a dot plus a soft glow. preserveAspectRatio="none" stretches the SVG, so radii are corrected per frame.
    var glow = el('ellipse', { fill: 'currentColor', opacity: '0.22' });
    var dot = el('ellipse', { fill: 'currentColor' });
    svg.appendChild(glow); svg.appendChild(dot);

    var t0 = performance.now();
    if (!announced) { announced = true; try { console.info('[TDMH ECG] live' + (calm() ? ' (calm: reduce-motion is on)' : '')); } catch (e) {} }
    function frame(now) {
      if (!svg.isConnected) return;                          // page re-rendered: this loop ends
      var period = calm() ? PERIOD * 1.6 : PERIOD;           // 8 s instead of 5 s when the computer asks for less motion
      var x = ((now - t0) % period) / period * W, y = yAt(P, x);
      sweep.setAttribute('x', x - W);
      var b = svg.getBoundingClientRect(), sx = (b.width || W) / W, sy = (b.height || H) / H;
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('rx', 3.2 / sx); dot.setAttribute('ry', 3.2 / sy);
      glow.setAttribute('cx', x); glow.setAttribute('cy', y); glow.setAttribute('rx', 8 / sx); glow.setAttribute('ry', 8 / sy);
      requestAnimationFrame(frame);                          // the browser pauses this while the tab is hidden
    }
    requestAnimationFrame(frame);
  }

  function scan(root) {
    var list = (root || document).querySelectorAll('svg.cx-trace, svg.tx-login-trace');
    for (var i = 0; i < list.length; i++) wire(list[i]);
  }
  window.TDMHEcg = { scan: scan };

  function start() {
    scan(document);
    var pending = false;
    new MutationObserver(function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; scan(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
