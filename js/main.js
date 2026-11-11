/* Twodo · onboarding and boot */
'use strict';

/* ---------- Onboarding ---------- */
function startOnboarding(join) {
  const ob = document.createElement('div'); ob.id = 'ob'; document.body.append(ob);
  const st = { a: { name: '', color: 'blue' }, b: { name: '', color: 'pink' }, people: null, pick: null, url: join ? join.u : '', code: join ? join.c : '' };
  let cur = null;
  const colors = k => `<div class="colors sm" data-ck="${k}">${PALETTE.slice(0, 10).map(c => `<button type="button" data-c="${c}" style="--c:var(--c-${c})" class="${c === st[k].color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>`;
  const pages = {
    welcome: () => `<div class="ob-hero">
        <svg class="ob-logo" viewBox="0 0 150 110" aria-hidden="true"><circle class="c1" cx="56" cy="55" r="40" fill="var(--c-blue)" opacity=".92"/><circle class="c2" cx="94" cy="55" r="40" fill="var(--c-pink)" opacity=".85"/>
          <path class="ck" d="M58 56l12 12 24-26" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1>Twodo</h1><p class="lead">Your to-dos, together.<br>A little app made for the two of you.</p></div>
      <div class="ob-actions"><button class="btn" data-o="names" type="button">Get started</button>
        <button class="btn ghost" data-o="join" type="button">I have an invite from my partner</button></div>`,
    names: () => `<h1>Who’s this for?</h1><p class="lead">Twodo is made for two. Add you both — you can change this any time.</p>
      <div class="ob-field"><label for="obA">Your name</label><input id="obA" placeholder="e.g. Alex" autocomplete="given-name" maxlength="24" value="${esc(st.a.name)}">${colors('a')}</div>
      <div class="ob-field"><label for="obB">Your partner’s name</label><input id="obB" placeholder="e.g. Sam" maxlength="24" value="${esc(st.b.name)}">${colors('b')}</div>
      <div class="spacer"></div><button class="btn" data-o="ready" type="button" ${st.a.name && st.b.name ? '' : 'disabled'}>Continue</button>
      <button class="btn ghost" data-o="welcome" type="button">Back</button>`,
    ready: () => `<h1>You’re all set, ${esc(firstWord(st.a.name))} 💞</h1><p class="lead">A few things that make Twodo feel like magic:</p>
      <ul class="tips">
        <li><span class="e">⌨️</span><div>Just type naturally<small>“Dinner with @${esc(firstWord(st.b.name).toLowerCase())} fri 8pm !!” sets the person, date, time and priority.</small></div></li>
        <li><span class="e">👉</span><div>Swipe right to complete<small>Swipe left to pin or delete. Long-press for more.</small></div></li>
        <li><span class="e">🔄</span><div>Sync with ${esc(firstWord(st.b.name))}<small>Settings → Sync. End-to-end encrypted.</small></div></li>
        <li><span class="e">🎁</span><div>A Secret list<small>Never syncs — perfect for planning surprises.</small></div></li>
      </ul><div class="spacer"></div><button class="btn" data-o="finish" type="button">Start using Twodo</button>`,
    join: () => `<h1>Join your partner</h1><p class="lead">Open the invite link they sent you, or copy the details from their Settings → Sync.</p>
      <div class="ob-field"><label for="obUrl">Database URL</label><input id="obUrl" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://….firebaseio.com" value="${esc(st.url)}"></div>
      <div class="ob-field"><label for="obCode">Pair code</label><input id="obCode" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-…" value="${esc(st.code)}"></div>
      <div class="err" id="obErr"></div><div class="spacer"></div>
      <button class="btn" data-o="connect" type="button">Connect</button><button class="btn ghost" data-o="welcome" type="button">Back</button>`,
    who: () => `<h1>Which one are you?</h1><p class="lead">So Twodo knows whose phone this is.</p>
      <div class="ob-who">${['a', 'b'].map(k => `<button type="button" data-o="pick" data-k="${k}"><span class="av" style="--c:var(--c-${st.people[k].color})">${esc(initial(st.people[k].name))}</span>${esc(st.people[k].name)}</button>`).join('')}</div>
      <div class="spacer"></div><button class="btn" data-o="joined" type="button" disabled>Continue</button>`,
  };
  const order = ['welcome', 'names', 'ready', 'join', 'who'];
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
  function finish() {
    ob.classList.add('out'); setTimeout(() => ob.remove(), 600);
    L.onboarded = true; save(); boot();
  }
  ob.addEventListener('input', e => {
    if (e.target.id === 'obA') st.a.name = e.target.value.trim();
    if (e.target.id === 'obB') st.b.name = e.target.value.trim();
    if (e.target.id === 'obUrl') st.url = e.target.value.trim();
    if (e.target.id === 'obCode') st.code = e.target.value.trim();
    const btn = cur.querySelector('[data-o="ready"]'); if (btn) btn.disabled = !(st.a.name && st.b.name);
  });
  ob.addEventListener('click', async e => {
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
      seedLists(); seedTasks(); applyTheme(); haptic('success'); finish();
    } else if (o === 'connect') {
      const err = cur.querySelector('#obErr'); err.textContent = '';
      if (!/^https?:\/\/.+\..+/.test(normUrl(st.url))) { err.textContent = 'Paste the database URL from your partner.'; return; }
      b.disabled = true; b.textContent = 'Connecting…';
      try {
        const { people } = await probeSpace(st.url, st.code);
        if (!people) throw new Error('No shared space found for that code. Double-check it with your partner.');
        st.people = people; show('who');
      } catch (ex) { err.textContent = ex.message; b.disabled = false; b.textContent = 'Connect'; }
    } else if (o === 'pick') {
      st.pick = b.dataset.k;
      cur.querySelectorAll('.ob-who button').forEach(x => x.classList.toggle('on', x === b));
      cur.querySelector('[data-o="joined"]').disabled = false; haptic('light');
    } else if (o === 'joined') {
      L.me = st.pick; D.people = { ...st.people, _s: 1 };
      L.sync = { url: normUrl(st.url), code: formatCode(st.code) };
      ensureBasics(); addSecretList(); applyTheme(); haptic('success'); finish();
      island({ e: '💞', text: `Connected with ${firstWord(ptName())}`, sub: 'Your lists sync in real time' });
    }
  });
  show(join ? 'join' : 'welcome');
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
  updateComposerCtx();
  Sync.init();
  if (L.focus && L.focus.running) { ensureFocusTick(); showLive(); }
  checkReminders();
}

function onViewport() {
  const vv = window.visualViewport, root = document.documentElement.style;
  root.setProperty('--vvh', (vv ? vv.height : innerHeight) + 'px');
  root.setProperty('--vvt', (vv ? vv.offsetTop : 0) + 'px');
  document.body.classList.toggle('kb', !!vv && vv.height < innerHeight * 0.78);
}

function init() {
  load(); applyTheme();
  stackEl = $('#stack');
  shade = document.createElement('div'); shade.className = 'shade';
  Island.el = $('#isl');
  const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden';
  document.body.append(probe); document.documentElement.style.setProperty('--safe-top-px', probe.offsetHeight + 'px'); probe.remove();
  initMenu(); initComposer(); initGestures(); initFocus(); initImport();
  onViewport();
  if (window.visualViewport) { visualViewport.addEventListener('resize', onViewport); visualViewport.addEventListener('scroll', onViewport); }
  addEventListener('resize', onViewport);

  const join = readJoinHash();
  if (!L.onboarded) { Cmp.el.classList.add('hide'); startOnboarding(join); }
  else {
    boot();
    if (join && (join.c !== L.sync.code)) {
      confirmDialog({ title: 'Join shared space?', message: 'Your tasks on this phone will be merged into it.', ok: 'Join' })
        .then(ok => ok && joinSpace(join.u, join.c));
    }
  }

  addEventListener('popstate', e => {
    if (Sheet.ignorePop) { Sheet.ignorePop = false; return; }
    if (Sheet.cur) { closeSheet({ history: false }); return; }
    closeMenu();
    const d = (e.state && e.state.d) || 1;
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
  }
}

init();
