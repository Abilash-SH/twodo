/* Twodo · runs first, before anything is drawn */
(function () {
  // Never run inside someone else's page (clickjacking)
  if (window.top !== window.self) {
    try { window.top.location.replace(window.self.location.href); } catch (e) { document.documentElement.style.display = 'none'; }
  }
  // Apply the theme before the first paint so there's no flash
  try {
    var s = JSON.parse(localStorage.getItem('twodo:local') || '{}').settings || {};
    var dark = s.theme === 'dark' || (s.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { /* first launch */ }
  window.splashT = performance.now();
})();
