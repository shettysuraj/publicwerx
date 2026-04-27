/*!
 * bug-report.v1.js — Centralized bug/feature report widget
 * Hosted at: https://publicwerx.org/lib/bug-report.v1.js
 * Source:    surajshetty/frontend/public/lib/bug-report.v1.js
 *
 * Drop-in usage in any consumer app:
 *   <script src="https://publicwerx.org/lib/bug-report.v1.js" data-project="wordhop" defer></script>
 *
 * The library reads `data-project` off its own <script> tag, fetches a dynamic
 * form config from /api/bugs/form?project=X, and submits to /api/bugs.
 * No build step, no React, no per-project drift.
 */
(function () {
  'use strict';

  // Re-entry guard — a double-include is a no-op. The public API is installed
  // at the bottom of this IIFE; we only use this boolean to detect the second
  // load and bail early.
  if (window.__sjsBugWidgetLoaded) return;
  window.__sjsBugWidgetLoaded = true;

  // ── Locate our own <script> tag ────────────────────────────────────────────
  // currentScript works during sync execution. If the library is loaded async
  // or injected programmatically (currentScript === null), fall back to a src
  // scan. We capture this immediately because by the time async callbacks run,
  // currentScript will be null.
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('bug-report.v1.js') !== -1) { script = scripts[i]; break; }
    }
  }
  if (!script) {
    console.warn('[bug-widget] could not locate own script tag; widget disabled');
    return;
  }

  var PROJECT = script.getAttribute('data-project');
  if (!PROJECT) {
    console.warn('[bug-widget] missing data-project attribute on script tag; widget disabled');
    return;
  }

  // data-api lets local dev consumers override the central API host. Optional.
  var BUG_API = script.getAttribute('data-api') || 'https://publicwerx.org/api/bugs';

  // data-version: consumer's own app/build version string (e.g. git SHA, semver).
  // Sent as top-level `appVersion` on the payload and stored server-side so
  // reports can be correlated with specific releases.
  var APP_VERSION = script.getAttribute('data-version') || null;

  // ── Runtime-populated state (set by consumer via window.sjsBugWidget) ─────
  // userInfo and context are sent in the debug log so the reporter can be
  // identified without requiring the human to type anything. userInfo is
  // ALSO used to pre-fill the visible reporter_email input if the server-side
  // form config includes one — the user can still edit it before submitting.
  var userInfo = null;     // { id, email, name, ... } — shape is consumer-defined
  var contextData = null;  // arbitrary object — route state, feature flags, etc.

  // Ring buffer of the last N uncaught errors on the page. Installed once at
  // boot, flushed into the debug log at submit time. Bounded so a runaway
  // error loop can't balloon memory.
  var ERROR_BUFFER_MAX = 10;
  var errorBuffer = [];
  function pushError(entry) {
    errorBuffer.push(entry);
    if (errorBuffer.length > ERROR_BUFFER_MAX) errorBuffer.shift();
  }
  window.addEventListener('error', function (e) {
    try {
      pushError({
        type: 'error',
        message: e && e.message ? String(e.message).slice(0, 500) : '',
        source: e && e.filename ? String(e.filename).slice(0, 200) : '',
        line: e && e.lineno,
        col: e && e.colno,
        stack: e && e.error && e.error.stack ? String(e.error.stack).slice(0, 2000) : '',
        timestamp: new Date().toISOString()
      });
    } catch (_) { /* never let the error handler throw */ }
  });
  window.addEventListener('unhandledrejection', function (e) {
    try {
      var reason = e && e.reason;
      var msg = reason && reason.message ? reason.message : String(reason);
      pushError({
        type: 'unhandledrejection',
        message: String(msg).slice(0, 500),
        stack: reason && reason.stack ? String(reason.stack).slice(0, 2000) : '',
        timestamp: new Date().toISOString()
      });
    } catch (_) { /* swallow */ }
  });

  // ── Constants ──────────────────────────────────────────────────────────────
  var BEETLE = '\uD83E\uDEB2'; // 🪲 — surrogate pair, works without Unicode escapes
  var STYLE_ID = 'sjs-bug-widget-styles';

  // All selectors prefixed `sjs-bug-` to avoid colliding with consumer styles.
  // Colors and dimensions match the canonical React widget exactly.
  var CSS = [
    '.sjs-bug-trigger {',
    '  position: fixed; top: 6px; left: 50%; transform: translateX(-50%);',
    '  z-index: 10000; background: none; border: none; cursor: pointer;',
    '  font-size: 20px; line-height: 1; opacity: 0.5; padding: 2px 10px;',
    '  transition: opacity 0.2s; font-family: inherit;',
    '}',
    '.sjs-bug-trigger:hover, .sjs-bug-trigger:focus-visible { opacity: 1; outline: none; }',
    '.sjs-bug-overlay {',
    '  position: fixed; inset: 0; z-index: 10100; display: flex;',
    '  align-items: center; justify-content: center;',
    '  background: rgba(0,0,0,0.6); padding: 16px;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  -webkit-font-smoothing: antialiased;',
    '}',
    '.sjs-bug-card {',
    '  width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto;',
    '  background: #18181b; border-radius: 16px; border: 1px solid #27272a;',
    '  padding: 24px; box-sizing: border-box; position: relative;',
    '}',
    '.sjs-bug-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }',
    '.sjs-bug-title { color: #fafafa; font-size: 18px; font-weight: 700; margin: 0; }',
    '.sjs-bug-close-x {',
    '  color: #71717a; background: none; border: none; cursor: pointer;',
    '  font-size: 20px; padding: 4px; line-height: 1; font-family: inherit;',
    '}',
    '.sjs-bug-close-x:hover { color: #fafafa; }',
    '.sjs-bug-toggle-row { display: flex; gap: 8px; margin-bottom: 16px; }',
    '.sjs-bug-toggle {',
    '  flex: 1; padding: 8px 0; border-radius: 8px; border: 1px solid #3f3f46;',
    '  background: transparent; color: #a1a1aa; cursor: pointer;',
    '  font-size: 14px; font-weight: 600; text-transform: capitalize;',
    '  font-family: inherit;',
    '}',
    '.sjs-bug-toggle.active {',
    '  border-color: #a78bfa; background: rgba(167,139,250,0.15); color: #c4b5fd;',
    '}',
    '.sjs-bug-field { margin-bottom: 16px; }',
    '.sjs-bug-label { display: block; margin-bottom: 6px; font-size: 13px; color: #a1a1aa; }',
    '.sjs-bug-input, .sjs-bug-textarea {',
    '  width: 100%; padding: 10px 12px; background: #09090b;',
    '  border: 1px solid #3f3f46; border-radius: 8px;',
    '  color: #fafafa; font-size: 14px; box-sizing: border-box;',
    '  font-family: inherit;',
    '}',
    '.sjs-bug-textarea { padding: 12px; resize: vertical; min-height: 100px; }',
    '.sjs-bug-input:focus, .sjs-bug-textarea:focus {',
    '  outline: none; border-color: #a78bfa;',
    '}',
    '.sjs-bug-counter { text-align: right; font-size: 11px; color: #52525b; margin-top: 4px; }',
    '.sjs-bug-checkbox-row { display: flex; align-items: center; gap: 8px; }',
    '.sjs-bug-checkbox-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #a78bfa; cursor: pointer; }',
    '.sjs-bug-checkbox-row label { color: #a1a1aa; font-size: 13px; cursor: pointer; margin: 0; }',
    '.sjs-bug-debug-toggle {',
    '  color: #52525b; background: none; border: none; cursor: pointer;',
    '  font-size: 12px; padding: 0; font-family: inherit;',
    '}',
    '.sjs-bug-debug-toggle:hover { color: #a1a1aa; }',
    '.sjs-bug-debug-pre {',
    '  margin-top: 8px; padding: 12px; background: #09090b;',
    '  border: 1px solid #27272a; border-radius: 8px;',
    '  color: #52525b; font-size: 11px; overflow: auto; max-height: 150px;',
    '  white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, "SF Mono", Consolas, monospace;',
    '}',
    '.sjs-bug-error { color: #f87171; font-size: 13px; margin: 0 0 12px; }',
    '.sjs-bug-hidden { display: none !important; }',
    '.sjs-bug-actions { display: flex; gap: 12px; }',
    '.sjs-bug-btn {',
    '  flex: 1; padding: 10px 0; border-radius: 8px; cursor: pointer;',
    '  font-size: 14px; font-family: inherit;',
    '}',
    '.sjs-bug-btn-cancel { border: 1px solid #3f3f46; background: transparent; color: #a1a1aa; }',
    '.sjs-bug-btn-cancel:hover { color: #fafafa; }',
    '.sjs-bug-btn-submit { border: none; background: #fafafa; color: #09090b; font-weight: 600; }',
    '.sjs-bug-btn-submit:disabled { background: #3f3f46; color: #a1a1aa; cursor: not-allowed; }',
    '.sjs-bug-status { text-align: center; padding: 40px 20px; color: #a1a1aa; margin: 0; }',
    '.sjs-bug-done-icon { font-size: 40px; margin-bottom: 12px; color: #a78bfa; }',
    '.sjs-bug-honeypot {',
    '  position: absolute; left: -9999px; width: 1px; height: 1px;',
    '  opacity: 0; pointer-events: none;',
    '}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Tiny DOM helper ────────────────────────────────────────────────────────
  // Always uses textContent and setAttribute — never innerHTML — so any future
  // form-config strings (which are server-controlled but worth defending in
  // depth) can never inject markup.
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    if (kids) {
      var arr = Array.isArray(kids) ? kids : [kids];
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (c == null || c === false) continue;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return n;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  var formConfig = null;
  var values = {};
  var overlayEl = null;
  var triggerEl = null;
  var lastFocusedEl = null;
  var submitting = false;
  var showDebug = false;

  var COOLDOWN_MS = 60000;
  var lastSubmitTime = 0;

  // ── Debug capture ──────────────────────────────────────────────────────────
  // Captured at submit time, NOT at boot — pixelRatio, online, etc. can change
  // and we want the values at the moment of report.
  function captureDebug() {
    var d = {
      url: window.location.href,
      screen: window.innerWidth + 'x' + window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      timestamp: new Date().toISOString()
    };
    if (APP_VERSION) d.appVersion = APP_VERSION;
    var effectiveUser = userInfo || window.__sjsBugWidgetPendingUser || null;
    if (effectiveUser) d.user = effectiveUser;
    if (contextData) d.context = contextData;
    // Snapshot the buffer — don't send the live array
    if (errorBuffer.length) d.errors = errorBuffer.slice();
    return d;
  }

  // ── Network ────────────────────────────────────────────────────────────────
  function fetchFormConfig() {
    return fetch(BUG_API + '/form?project=' + encodeURIComponent(PROJECT), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    }).then(function (r) {
      if (!r.ok) throw new Error('form config http ' + r.status);
      return r.json();
    });
  }

  function submitReport(payload) {
    return fetch(BUG_API, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.ok) return r.json().catch(function () { return {}; });
      return r.json().catch(function () { return {}; }).then(function (d) {
        throw new Error((d && d.error) || ('http ' + r.status));
      });
    });
  }

  // ── Field renderers ────────────────────────────────────────────────────────
  function renderToggle(field) {
    var row = el('div', { class: 'sjs-bug-toggle-row' });
    var opts = field.options || [];
    for (var i = 0; i < opts.length; i++) {
      (function (opt) {
        var btn = el('button', {
          type: 'button',
          class: 'sjs-bug-toggle' + (values[field.name] === opt ? ' active' : ''),
          text: opt
        });
        btn.addEventListener('click', function () {
          values[field.name] = opt;
          // Update active class on all siblings
          var sibs = row.querySelectorAll('.sjs-bug-toggle');
          for (var s = 0; s < sibs.length; s++) sibs[s].classList.remove('active');
          btn.classList.add('active');
        });
        row.appendChild(btn);
      }(opts[i]));
    }
    return row;
  }

  function renderTextarea(field) {
    var wrap = el('div', { class: 'sjs-bug-field' });
    if (field.label) wrap.appendChild(el('label', { class: 'sjs-bug-label', text: field.label }));
    var ta = el('textarea', {
      class: 'sjs-bug-textarea',
      placeholder: field.placeholder || '',
      maxlength: field.maxLength || 2000,
      rows: 4
    });
    ta.value = values[field.name] || '';
    var counter = field.maxLength ? el('div', { class: 'sjs-bug-counter', text: (ta.value.length) + '/' + field.maxLength }) : null;
    ta.addEventListener('input', function () {
      values[field.name] = ta.value;
      if (counter) counter.textContent = ta.value.length + '/' + field.maxLength;
    });
    wrap.appendChild(ta);
    if (counter) wrap.appendChild(counter);
    return wrap;
  }

  function renderText(field) {
    var wrap = el('div', { class: 'sjs-bug-field' });
    if (field.label) wrap.appendChild(el('label', { class: 'sjs-bug-label', text: field.label }));
    var inp = el('input', {
      type: 'text',
      class: 'sjs-bug-input',
      placeholder: field.placeholder || '',
      maxlength: field.maxLength || 200,
      autocomplete: field.name === 'reporter_email' ? 'email' : 'off'
    });
    inp.value = values[field.name] || '';
    inp.addEventListener('input', function () { values[field.name] = inp.value; });
    wrap.appendChild(inp);
    return wrap;
  }

  function renderCheckbox(field) {
    // The React reference had no checkbox renderer despite the server-side
    // form config supporting it — njordfellfutures' notify_on_update field
    // was effectively unreachable. This implementation closes that gap.
    var wrap = el('div', { class: 'sjs-bug-field' });
    var row = el('div', { class: 'sjs-bug-checkbox-row' });
    var id = 'sjs-bug-cb-' + field.name;
    var cb = el('input', { type: 'checkbox', id: id });
    cb.checked = !!values[field.name];
    cb.addEventListener('change', function () { values[field.name] = cb.checked; });
    row.appendChild(cb);
    if (field.label) row.appendChild(el('label', { for: id, text: field.label }));
    wrap.appendChild(row);
    return wrap;
  }

  function renderField(field) {
    if (field.type === 'toggle') return renderToggle(field);
    if (field.type === 'textarea') return renderTextarea(field);
    if (field.type === 'text') return renderText(field);
    if (field.type === 'checkbox') return renderCheckbox(field);
    return null;
  }

  // ── Modal lifecycle ────────────────────────────────────────────────────────
  function close() {
    if (!overlayEl) return;
    overlayEl.parentNode && overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    formConfig = null;
    values = {};
    showDebug = false;
    document.removeEventListener('keydown', onKeydown);
    if (lastFocusedEl && lastFocusedEl.focus) {
      try { lastFocusedEl.focus(); } catch (_) {}
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  function showState(content) {
    if (!overlayEl) return;
    var card = overlayEl.querySelector('.sjs-bug-card');
    if (!card) return;
    while (card.firstChild) card.removeChild(card.firstChild);
    var arr = Array.isArray(content) ? content : [content];
    for (var i = 0; i < arr.length; i++) if (arr[i]) card.appendChild(arr[i]);
  }

  function renderForm() {
    if (!formConfig) return;
    var hdr = el('div', { class: 'sjs-bug-header' }, [
      el('h2', { class: 'sjs-bug-title', text: formConfig.title || 'Report' }),
      el('button', { type: 'button', class: 'sjs-bug-close-x', 'aria-label': 'Close', text: '\u00D7', onclick: close })
    ]);

    var children = [hdr];
    var fields = (formConfig.fields || []);

    // Pre-populate the visible reporter_email input from userInfo.email if the
    // consumer registered one. We only do this when the form actually has the
    // field — otherwise we'd be silently dropping the value somewhere the user
    // can't see or edit it. The full userInfo still goes into the debug log
    // regardless of what the user types in the visible field.
    if (userInfo && userInfo.email) {
      for (var pf = 0; pf < fields.length; pf++) {
        if (fields[pf].name === 'reporter_email' && !values.reporter_email) {
          values.reporter_email = userInfo.email;
          break;
        }
      }
    }

    for (var i = 0; i < fields.length; i++) {
      var node = renderField(fields[i]);
      if (node) children.push(node);
    }

    // Honeypot — hidden from humans, filled by naive bots.
    var hp = el('input', { type: 'text', name: '_hp', class: 'sjs-bug-honeypot', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    children.push(hp);

    if (formConfig.showDebugInfo) {
      var debugWrap = el('div', { class: 'sjs-bug-field' });
      var debugBtn = el('button', { type: 'button', class: 'sjs-bug-debug-toggle' });
      debugBtn.textContent = (showDebug ? '\u25BC Hide' : '\u25B6 Show') + ' debug info';
      var debugPre = null;
      debugBtn.addEventListener('click', function () {
        showDebug = !showDebug;
        debugBtn.textContent = (showDebug ? '\u25BC Hide' : '\u25B6 Show') + ' debug info';
        if (showDebug) {
          debugPre = el('pre', { class: 'sjs-bug-debug-pre', text: JSON.stringify(captureDebug(), null, 2) });
          debugWrap.appendChild(debugPre);
        } else if (debugPre) {
          debugWrap.removeChild(debugPre);
          debugPre = null;
        }
      });
      debugWrap.appendChild(debugBtn);
      children.push(debugWrap);
    }

    var errorP = el('p', { class: 'sjs-bug-error sjs-bug-hidden' });
    children.push(errorP);

    var cancelBtn = el('button', { type: 'button', class: 'sjs-bug-btn sjs-bug-btn-cancel', text: 'Cancel', onclick: close });
    var submitBtn = el('button', { type: 'button', class: 'sjs-bug-btn sjs-bug-btn-submit', text: 'Submit' });
    submitBtn.addEventListener('click', function () {
      if (submitting) return;
      var elapsed = Date.now() - lastSubmitTime;
      if (lastSubmitTime && elapsed < COOLDOWN_MS) {
        var secsLeft = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        errorP.textContent = 'Please wait ' + secsLeft + 's before submitting again';
        errorP.classList.remove('sjs-bug-hidden');
        return;
      }
      // Validate required fields
      var descField = null;
      for (var f = 0; f < fields.length; f++) {
        if (fields[f].name === 'description') { descField = fields[f]; break; }
      }
      if (descField && descField.required) {
        var v = values.description;
        if (!v || !String(v).trim()) {
          errorP.textContent = 'Please enter a description';
          errorP.classList.remove('sjs-bug-hidden');
          return;
        }
      }
      errorP.classList.add('sjs-bug-hidden');
      errorP.textContent = '';
      submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending\u2026';

      var extraFields = {};
      var hasExtras = false;
      for (var k = 0; k < fields.length; k++) {
        var fn = fields[k].name;
        if (fn === 'type' || fn === 'description') continue;
        var val = values[fn];
        if (val === undefined || val === null || val === '' || val === false) continue;
        extraFields[fn] = val;
        hasExtras = true;
      }

      var payload = {
        project: PROJECT,
        type: values.type || 'bug',
        description: values.description || '',
        page: window.location.pathname,
        debugLog: captureDebug(),
        _hp: hp.value || ''
      };
      if (APP_VERSION) payload.appVersion = APP_VERSION;
      if (hasExtras) payload.extraFields = extraFields;

      submitReport(payload).then(function () {
        lastSubmitTime = Date.now();
        showState(el('div', null, [
          el('div', { class: 'sjs-bug-done-icon', text: '\u2713' }),
          el('p', { class: 'sjs-bug-status', text: "Thanks! We'll look into it." })
        ]));
        setTimeout(close, 2000);
      }).catch(function (err) {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
        errorP.textContent = (err && err.message) ? err.message : 'Submit failed';
        errorP.classList.remove('sjs-bug-hidden');
      });
    });
    children.push(el('div', { class: 'sjs-bug-actions' }, [cancelBtn, submitBtn]));

    showState(children);

    // Focus the description textarea for keyboard users
    var firstTa = overlayEl.querySelector('.sjs-bug-textarea');
    if (firstTa) try { firstTa.focus(); } catch (_) {}
  }

  function open() {
    if (overlayEl) return;
    lastFocusedEl = document.activeElement;
    formConfig = null;
    values = {};
    showDebug = false;
    submitting = false;

    var card = el('div', { class: 'sjs-bug-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Report a bug' }, [
      el('p', { class: 'sjs-bug-status', text: 'Loading\u2026' })
    ]);
    overlayEl = el('div', { class: 'sjs-bug-overlay' }, [card]);
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) close();
    });
    document.body.appendChild(overlayEl);
    document.addEventListener('keydown', onKeydown);

    fetchFormConfig().then(function (cfg) {
      if (!overlayEl) return; // closed before fetch resolved
      formConfig = cfg;
      // Seed defaults
      var fields = cfg.fields || [];
      for (var i = 0; i < fields.length; i++) {
        if (fields[i].default !== undefined) values[fields[i].name] = fields[i].default;
      }
      renderForm();
    }).catch(function () {
      if (!overlayEl) return;
      showState(el('div', null, [
        el('p', { class: 'sjs-bug-status', text: 'Unable to load form. Try again later.' }),
        el('div', { class: 'sjs-bug-actions' }, [
          el('button', { type: 'button', class: 'sjs-bug-btn sjs-bug-btn-cancel', text: 'Close', onclick: close })
        ])
      ]));
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    if (!userInfo && window.__sjsBugWidgetPendingUser) {
      userInfo = window.__sjsBugWidgetPendingUser;
    }
    triggerEl = el('button', {
      type: 'button',
      class: 'sjs-bug-trigger',
      'aria-label': 'Report a bug',
      title: 'Report a bug',
      text: BEETLE,
      onclick: open
    });
    document.body.appendChild(triggerEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  // Consumers call this AFTER the script tag loads, typically once per page:
  //   window.sjsBugWidget.setUser({ id, email, name })
  //   window.sjsBugWidget.setContext({ route, feature })
  // open()/close() are also exposed so apps can trigger the modal from their
  // own menus (e.g. a "Report issue" link in a settings page) without
  // requiring the floating beetle button.
  window.sjsBugWidget = {
    version: 1,
    setUser: function (info) {
      userInfo = info && typeof info === 'object' ? info : null;
    },
    setContext: function (ctx) {
      contextData = ctx && typeof ctx === 'object' ? ctx : null;
    },
    open: open,
    close: close
  };
}());
