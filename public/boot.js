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
  // The two hearts of the launch screen in your two colours (yours on the left). Only palette names are used.
  try {
    var d = JSON.parse(localStorage.getItem('twodo:data') || '{}').people || {}, me = (JSON.parse(localStorage.getItem('twodo:local') || '{}').me === 'b') ? 'b' : 'a';
    var ok = /^(blue|indigo|purple|pink|red|orange|yellow|green|mint|teal|brown|gray)$/, root = document.documentElement.style;
    var c1 = d[me] && d[me].color, c2 = d[me === 'a' ? 'b' : 'a'] && d[me === 'a' ? 'b' : 'a'].color;
    if (ok.test(c1)) root.setProperty('--sp-a', 'var(--c-' + c1 + ')');
    if (ok.test(c2) && c2 !== c1) root.setProperty('--sp-b', 'var(--c-' + c2 + ')');
  } catch (e) { /* first launch: blue and pink */ }
  window.splashT = performance.now();
})();
