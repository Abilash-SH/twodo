/* Twodo · onboarding and boot */
'use strict';

/* ---------- Onboarding ---------- */
function startOnboarding() {
  const ob = document.createElement('div'); ob.id = 'ob'; document.body.append(ob);
  const st = { a: { name: '', color: 'blue' }, b: { name: '', color: 'pink' } };
  let cur = null;
  const colors = k => `<div class="colors sm" data-ck="${k}">${PALETTE.slice(0, 10).map(c => `<button type="button" data-c="${c}" style="--c:var(--c-${c})" class="${c === st[k].color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>`;
  const pages = {
    welcome: () => `<div class="ob-hero">
        <svg class="ob-logo" viewBox="0 0 150 110" aria-hidden="true"><circle class="c1" cx="56" cy="55" r="40" fill="var(--c-blue)" opacity=".92"/><circle class="c2" cx="94" cy="55" r="40" fill="var(--c-pink)" opacity=".85"/>
          <path class="ck" d="M58 56l12 12 24-26" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1>Twodo</h1><p class="lead">Your to-dos, together.<br>A little app made for the two of you.</p></div>
      <div class="ob-actions"><button class="btn" data-o="names" type="button">Get started</button></div>`,
    names: () => `<h1>Who’s this for?</h1><p class="lead">Twodo is made for two. Add you both — you can change this any time.</p>
      <div class="ob-field"><label for="obA">Your name</label><input id="obA" placeholder="e.g. Alex" autocomplete="given-name" maxlength="24" value="${esc(st.a.name)}">${colors('a')}</div>
      <div class="ob-field"><label for="obB">Your partner’s name</label><input id="obB" placeholder="e.g. Sam" maxlength="24" value="${esc(st.b.name)}">${colors('b')}</div>
      <div class="spacer"></div><button class="btn" data-o="ready" type="button" ${st.a.name && st.b.name ? '' : 'disabled'}>Continue</button>
      <button class="btn ghost" data-o="welcome" type="button">Back</button>`,
    ready: () => `<h1>You’re all set, ${esc(firstWord(st.a.name))} 💞</h1><p class="lead">A few things that make Twodo feel like magic:</p>
      <ul class="tips">
        <li><span class="e">⌨️</span><div>Just type naturally<small>“Dinner with @${esc(firstWord(st.b.name).toLowerCase())} fri 8pm !!” sets the person, date, time and priority.</small></div></li>
        <li><span class="e">👉</span><div>Swipe right to complete<small>Swipe left to pin or delete. Long-press for more.</small></div></li>
        <li><span class="e">💌</span><div>Pair with ${esc(firstWord(st.b.name))}<small>Settings → Together. Create accounts, then invite by username.</small></div></li>
        <li><span class="e">🎁</span><div>A Secret list<small>Never syncs — perfect for planning surprises.</small></div></li>
      </ul><div class="spacer"></div><button class="btn" data-o="finish" type="button">Start using Twodo</button>`,
  };
  const order = ['welcome', 'names', 'ready'];
  function show(name) {
    const back = cur && order.indexOf(name) < order.indexOf(cur.dataset.p);
    const p = document.createElement('div');
    p.className = 'ob-page ' + (cur ? (back ? 'left' : 'right') : ''); p.dataset.p = name; p.innerHTML = pages[name]();
    ob.append(p);
    if (cur) {
      const old = cur; old.classList.add(back ? 'right' : 'left'); setTimeout(() => old.remove(), 600);
      void p.offsetWidth; p.classList.remove('left', 'right');
    }
    cur = p;
    const first = p.querySelector('input'); if (first && !isTouch) setTimeout(() => first.focus(), 350);
  }
  ob.addEventListener('input', e => {
    if (e.target.id === 'obA') st.a.name = e.target.value.trim();
    if (e.target.id === 'obB') st.b.name = e.target.value.trim();
    const btn = cur.querySelector('[data-o="ready"]'); if (btn) btn.disabled = !(st.a.name && st.b.name);
  });
  ob.addEventListener('click', e => {
    const c = e.target.closest('[data-c]');
    if (c) {
      const k = c.closest('[data-ck]').dataset.ck; st[k].color = c.dataset.c;
      c.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === c));
      if (k === 'a') document.documentElement.style.setProperty('--accent', `var(--c-${st.a.color})`);
      haptic('light'); return;
    }
    const b = e.target.closest('[data-o]'); if (!b || b.disabled) return;
    const o = b.dataset.o;
    if (pages[o]) { show(o); haptic('light'); return; }
    if (o === 'finish') {
      L.me = 'a';
      setPeople({ name: st.a.name, color: st.a.color }, { name: st.b.name, color: st.b.color });
      seedLists(); seedTasks(); applyTheme(); haptic('success');
      ob.classList.add('out'); setTimeout(() => ob.remove(), 600);
      L.onboarded = true; save(); boot();
    }
  });
  show('welcome');
}
function seedTasks() {
  const t0 = todayStr(), pt = firstWord(ptName()).toLowerCase();
  const add = p => makeTask({ createdBy: 'a', ...p });
  add({ title: 'Tap the circle to complete me', due: t0 });
  add({ title: 'Swipe me right to finish, or left to pin', due: t0 });
  add({ title: 'Long-press me for quick actions', due: t0, priority: 1 });
  add({ title: `Try typing “Movie night fri 8pm @${pt} !!”`, notes: 'Twodo understands dates, times, @people, #lists, !priority and repeats like “every monday”.' });
  add({ title: 'Sunset picnic 🧺', listId: 'dates', assignee: 'both' });
  add({ title: 'Cook something new together 🍝', listId: 'dates', assignee: 'both' });
  add({ title: 'Strawberries 🍓', listId: 'groceries' });
}

/* ---------- Boot ---------- */
function boot() {
  ensureBasics();
  stackEl.innerHTML = '';
  Nav.stack = [];
  const home = makeView({ type: 'home' });
  Nav.stack.push(home); stackEl.append(home); renderView(home);
  history.replaceState({ d: 1 }, '');
  splitCheck();
  updateComposerCtx();
  if (!Sync.live) startCloud();
  if (L.focus && L.focus.running) { ensureFocusTick(); showLive(); }
  checkReminders();
  if (location.hash === '#chat') { history.replaceState({ d: 1 }, '', location.pathname + location.search); setTimeout(() => ChatUI.open(), 900); }
}

function onViewport() {
  const vv = window.visualViewport, root = document.documentElement.style;
  root.setProperty('--vvh', (vv ? vv.height : innerHeight) + 'px');
  root.setProperty('--vvt', (vv ? vv.offsetTop : 0) + 'px');
  const kb = !!vv && vv.height < innerHeight * 0.78;
  document.body.classList.toggle('kb', kb);
  // iOS sometimes leaves the page nudged up after the keyboard closes, which shifts the whole layout
  const typing = document.activeElement && document.activeElement.matches('input, textarea, select');
  if (!kb && !typing && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0);
}

function init() {
  load(); applyTheme();
  if (L.sync && (L.sync.code || L.sync.url)) L.sync = {}; // retire the old invite-link pairing
  stackEl = $('#stack');
  shade = document.createElement('div'); shade.className = 'shade';
  Island.el = $('#isl');
  initMenu(); initComposer(); initGestures(); initFocus(); initImport();
  onViewport();
  if (window.visualViewport) { visualViewport.addEventListener('resize', onViewport); visualViewport.addEventListener('scroll', onViewport); }
  addEventListener('resize', onViewport);
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.matches('input, textarea, select')) onViewport(); }, 60));
  if (location.hash.startsWith('#join=')) history.replaceState(null, '', location.pathname + location.search);

  if (cloudReady()) {
    // Accounts are on: sign-in comes first, before anything else
    if (!Auth.user() || L.auth.expired) { if (L.auth && L.auth.expired) L.auth = null; startGate(L.lastUid ? 'signin' : 'welcome'); }
    else if (!L.auth.username) { boot(); startGate('username'); }
    else boot();
  } else if (!L.onboarded) { Cmp.el.classList.add('hide'); startOnboarding(); }
  else boot();

  addEventListener('popstate', e => {
    if (Sheet.ignorePop) { Sheet.ignorePop = false; return; }
    if (Sheet.cur) { closeSheet({ history: false }); return; }
    closeMenu();
    const d = (e.state && e.state.d) || 1;
    if (Split.on) { if (d < 2) { history.pushState({ d: 2 }, ''); popView(); } return; }
    while (Nav.stack.length > Math.max(1, d)) doPop();
  });

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(), typing = ['input', 'textarea', 'select'].includes(tag);
    if (e.key === 'Escape') {
      if ($('.alert-wrap')) return;
      if (Menu.open) return closeMenu();
      if ($('#focus').classList.contains('on')) return closeFocus();
      if (Sheet.cur) return closeSheet();
      if (typing) return e.target.blur();
      return popView();
    }
    if (!L.onboarded) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!Sheet.cur) openSearch(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'n' || e.key === '/') && !Sheet.cur && topView()._spec.type !== 'search') { e.preventDefault(); Cmp.ta.focus(); }
  });

  // Keep "today" fresh across midnight and long sessions
  let lastKey = todayStr() + new Date().getHours();
  setInterval(() => {
    checkReminders();
    const k = todayStr() + new Date().getHours();
    if (k !== lastKey) { lastKey = k; scheduleRender(); }
  }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && L.onboarded) { scheduleRender(); checkReminders(); } });

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('sw', err));
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.open === 'chat' && Auth.user()) ChatUI.open(); });
  }
}

/* ---------- launch animation: let the intro finish, then zoom through into the app ---------- */
const Splash = {
  hide() {
    const el = $('#splash'); if (!el || el.classList.contains('out')) return;
    const min = reducedMotion.matches ? 300 : 1080, wait = Math.max(0, min - (performance.now() - (window.splashT || 0)));
    setTimeout(() => {
      el.classList.add('out');
      document.body.classList.add('landing'); document.body.classList.remove('launching'); applyTheme();
      setTimeout(() => { el.remove(); document.body.classList.remove('landing'); }, 800);
    }, wait);
  },
};

try { init(); } finally { Splash.hide(); }
