/* PublicWerx theme toggle — external (CSP: script-src 'self'), same-origin, no trackers.
   Default follows the visitor's OS (prefers-color-scheme); an explicit choice is
   remembered in localStorage. Runs render-blocking from <head> to avoid a flash. */
(function () {
  var KEY = 'pw-theme';
  var root = document.documentElement;

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme'); // fall back to OS preference
    }
  }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function effective() {
    var s = stored();
    if (s === 'light' || s === 'dark') return s;
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  // Set the initial theme before first paint.
  apply(stored());

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
      btn.setAttribute('aria-pressed', String(next === 'light'));
    });
  });
})();
