/* Twodo · the ☰ menu: your chat (Home), every to-do list, Search, Tips and Settings.
   Slides in from the left on phones (tap ☰ or swipe in from the left edge on Home); stays open on big screens. */
'use strict';

const Drawer = {
  el: null, bg: null, open: false, drag: null,

  init() {
    const app = $('#app');
    this.bg = document.createElement('div'); this.bg.id = 'drawerBg';
    this.el = document.createElement('nav'); this.el.id = 'drawer'; this.el.setAttribute('aria-label', 'Menu');
    app.append(this.bg, this.el);
    this.bg.addEventListener('click', () => this.close());
    this.el.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      haptic('light');
      this.go(b.dataset.m, b.dataset.v);
    });
    // drag the open menu back to the left to close it
    this.el.addEventListener('pointerdown', e => {
      if (Split.on || !this.open || e.pointerType === 'mouse') return;
      this.drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId, dx: 0, on: false, t: performance.now() };
    });
    addEventListener('pointermove', e => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      const dx = Math.min(0, e.clientX - d.x0);
      if (!d.on && Math.abs(e.clientY - d.y0) > 12 && Math.abs(dx) < 10) { this.drag = null; return; } // scrolling the menu
      if (!d.on && dx < -8) { d.on = true; this.el.classList.add('dragging'); this.bg.classList.add('dragging'); }
      if (d.on) { d.dx = dx; this.setP(1 + dx / this.el.offsetWidth); }
    }, { passive: true });
    const end = e => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      this.drag = null; if (!d.on) return;
      this.el.classList.remove('dragging'); this.bg.classList.remove('dragging');
      const v = d.dx / Math.max(1, performance.now() - d.t);
      if (d.dx < -this.el.offsetWidth * 0.3 || v < -0.5) this.close(); else this.setP(1);
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
  },

  // p = how far open (0..1) while following a finger
  setP(p) {
    p = clamp(p, 0, 1);
    this.el.style.transform = `translateX(${(p - 1) * 100}%)`;
    this.bg.style.opacity = String(p);
  },
  show() {
    if (Split.on || !this.el) return;
    closeMenu(); if (Cmp.ta) Cmp.ta.blur();
    this.el.innerHTML = this.html();
    this.open = true;
    document.body.classList.add('drawer-open');
    this.el.style.transform = ''; this.bg.style.opacity = '';
    this.el.classList.add('on'); this.bg.classList.add('on');
    haptic('light');
    if (typeof Chat !== 'undefined') Chat.updateBadge();
  },
  close() {
    if (!this.el) return;
    this.open = false;
    document.body.classList.remove('drawer-open');
    this.el.style.transform = ''; this.bg.style.opacity = '';
    this.el.classList.remove('on'); this.bg.classList.remove('on');
    if (typeof ChatUI !== 'undefined') setTimeout(() => ChatUI.onState(), 300); // the chat underneath is visible again
  },
  render() {
    if (!this.el || !(this.open || Split.on)) return;
    const sc = this.el.scrollTop;
    this.el.innerHTML = this.html(); this.el.scrollTop = sc;
    if (typeof Chat !== 'undefined') Chat.updateBadge();
  },

  go(kind, v) {
    const later = fn => { this.close(); if (Split.on) fn(); else setTimeout(fn, 230); };
    if (kind === 'settings') return later(openSettings);
    if (kind === 'chat') return later(() => ChatUI.open());
    if (kind === 'addlist') return later(() => openListSheet());
    const spec = kind === 'home' ? { type: 'home' } : kind === 'smart' ? { type: 'smart', key: v } : kind === 'list' ? { type: 'list', id: v }
      : kind === 'search' ? { type: 'search' } : kind === 'tips' ? { type: 'tips' } : null;
    if (!spec) return;
    if (kind === 'list') Cmp.listPick = null;
    this.close();
    navTo(spec);
    if (kind === 'search') setTimeout(() => { const q = $('#q'); if (q) q.focus({ preventScroll: true }); }, 80);
  },

  current() { return Nav.stack.length > 1 ? specKey(topView()._spec) : 'home'; },
  html() {
    const all = liveTasks(), cnt = k => all.filter(SMART[k].match).length, cur = this.current();
    const streak = calcStreak(), together = all.filter(x => x.done && x.doneAt > Date.now() - 7 * 864e5).length;
    const row = (key, m, v, icon, label, right = '') => `<button class="dr-row${cur === key ? ' on' : ''}" data-m="${m}" data-v="${esc(v || '')}" type="button">${icon}<span class="grow">${label}</span>${right}</button>`;
    const sic = (k, inner) => `<span class="dr-ic" style="--c:var(--c-${SMART[k].color})">${inner}</span>`;
    const n = x => x ? `<span class="val">${x}</span>` : '';
    const chat = homeIsChat();
    return `
      <div class="dr-head">
        <button class="dr-me" data-m="settings" type="button"><span class="dr-avs">${avatar(L.me)}${avatar(partnerKey())}</span>
          <span class="dr-names"><b>${esc(firstWord(person('a').name))} &amp; ${esc(firstWord(person('b').name))}</b><small>${esc(Sync.state === 'off' ? 'On this phone' : Sync.label())}</small></span>${ic('chevR', 'chev')}</button>
        <div class="dr-stats">${streak ? `🔥 ${streak}-day streak · ` : ''}💞 ${together} done together this week</div>
      </div>
      <button class="dr-search" data-m="search" type="button">${ic('search')}<span>Search</span></button>
      <div class="dr-sec">
        ${chat ? row('home', 'home', '', `<span class="dr-ic" style="--c:var(--c-pink)">${ic('chat')}</span>`, esc(L.pair && L.pair.status === 'paired' ? firstWord(ptName()) : 'Chat'), '<span class="chat-badge" hidden></span>')
          : row('home', 'home', '', `<span class="dr-ic" style="--c:var(--accent)">${ic('home')}</span>`, 'Home')}
      </div>
      <div class="dr-h">To-dos</div>
      <div class="dr-sec">
        ${row('s:today', 'smart', 'today', sic('today', `<span class="daynum">${new Date().getDate()}</span>`), 'Today', n(cnt('today')))}
        ${row('s:upcoming', 'smart', 'upcoming', sic('upcoming', ic('cal')), 'Upcoming', n(cnt('upcoming')))}
        ${row('s:us', 'smart', 'us', sic('us', ic('heart')), 'Together', n(cnt('us')))}
        ${row('s:pinned', 'smart', 'pinned', sic('pinned', ic('pin')), 'Pinned', n(cnt('pinned')))}
        ${row('s:all', 'smart', 'all', sic('all', ic('tray')), 'All', n(cnt('all')))}
        ${row('s:done', 'smart', 'done', sic('done', ic('check')), 'Completed', '')}
      </div>
      <div class="dr-h">My Lists</div>
      <div class="dr-sec">
        ${lists().map(l => row('l:' + l.id, 'list', l.id, `<span class="dr-ic emo" style="--c:var(--c-${l.color})">${esc(l.emoji)}</span>`, esc(l.name),
          (l.private ? ic('lock', 'lock') : '') + n(all.filter(t => !t.done && listOf(t).id === l.id).length))).join('')}
        <button class="dr-row add" data-m="addlist" type="button"><span class="dr-ic" style="--c:var(--accent)">${ic('plus', 'sm')}</span><span class="grow">Add List</span></button>
      </div>
      <div class="dr-sec">
        ${row('tips', 'tips', '', `<span class="dr-ic emo" style="--c:var(--c-yellow)">💡</span>`, 'Tips &amp; tricks')}
        ${row('settings', 'settings', '', `<span class="dr-ic" style="--c:var(--c-gray)">${ic('sliders')}</span>`, 'Settings')}
      </div>
      <div class="dr-foot">Twodo · made for two 💞</div>`;
  },
};
