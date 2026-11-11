/* Twodo · navigation stack and screen rendering */
'use strict';

const Nav = { stack: [], dragging: false, ignorePops: 0, edgeCancelAt: -1e9 };
const Pending = new Map(); // task id → timer while the check animation plays
const Fresh = new Set();   // task ids that should animate in
let stackEl, shade;

const topView = () => Nav.stack[Nav.stack.length - 1];
const specKey = s => s.type === 'list' ? 'l:' + s.id : s.type === 'smart' ? 's:' + s.key : s.type;
const viewPrefs = key => (L.view[key] = L.view[key] || {});
function viewTitle(spec) {
  if (spec.type === 'home') return homeIsChat() ? 'Chat' : 'To-dos';
  if (spec.type === 'search') return 'Search';
  if (spec.type === 'tips') return 'Tips';
  if (spec.type === 'todos') return 'To-dos';
  if (spec.type === 'list') { const l = D.lists[spec.id]; return l ? l.name : 'List'; }
  if (spec.key === 'us') return `${firstWord(person('a').name)} & ${firstWord(person('b').name)}`;
  return SMART[spec.key].title;
}

/* ---------- Render scheduling ---------- */
let renderQueued = false, renderDeferred = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (Nav.dragging || (typeof G !== 'undefined' && G && G.mode === 'swipe')) { renderDeferred = true; return; }
    renderNow();
  });
}
function renderNow() {
  renderDeferred = false;
  if (typeof openRow !== 'undefined') openRow = null;
  Nav.stack.forEach(renderView);
  Fresh.clear();
  updateComposerCtx();
  if (typeof Drawer !== 'undefined') Drawer.render();
}

/* ---------- Stack ---------- */
const VIEW_SHELL = `<header class="nav"><div class="nav-side l"></div><div class="nav-title"></div><div class="nav-side r"></div></header><div class="vbody"></div>`;
// Home is your chat once you're signed in; without accounts it shows today's to-dos instead.
const homeIsChat = () => typeof ChatUI !== 'undefined' && cloudReady() && !!Auth.user();
const alertsOn = () => !!L.settings.notify || (typeof Push !== 'undefined' && Push.configured() && Push.on());
function makeView(spec) {
  const v = document.createElement('section');
  v.className = 'view'; v._spec = spec;
  v.innerHTML = VIEW_SHELL;
  v.addEventListener('scroll', () => {
    if (!v.classList.contains('chatview')) v.firstElementChild.classList.toggle('scrolled', v.scrollTop > 34);
  }, { passive: true });
  return v;
}
function pushView(spec, { replace = false } = {}) {
  closeMenu();
  const prev = topView();
  const v = makeView(spec);
  Nav.stack.push(v);
  renderView(v);
  v.classList.add('offright', 'pushed');
  stackEl.appendChild(v);
  stackEl.insertBefore(shade, v);
  shade.style.transition = 'none'; shade.style.opacity = '0';
  void v.offsetWidth;
  shade.style.transition = '';
  v.classList.remove('offright');
  if (prev) prev.classList.add('under');
  shade.style.opacity = '.12';
  if (replace) history.replaceState({ d: Nav.stack.length }, ''); else history.pushState({ d: Nav.stack.length }, '');
  updateComposerCtx();
  if (typeof Drawer !== 'undefined') Drawer.render();
  haptic('light');
  return v;
}
function popView() {
  if (Nav.stack.length < 2) return;
  const syncHistory = history.state && history.state.d === Nav.stack.length && !history.state.s;
  doPop();
  if (syncHistory) { Nav.ignorePops++; history.back(); } // keep history in step without animating twice
}
function doPop({ instant = false } = {}) {
  if (Nav.stack.length < 2) return;
  const v = Nav.stack.pop(), prev = topView();
  if (instant) { // the phone already showed its own back animation: just switch, don't animate again
    v.remove();
    prev.style.transition = 'none'; prev.classList.remove('under'); prev.style.transform = '';
    shade.style.transition = 'none';
    if (Nav.stack.length > 1) { stackEl.insertBefore(shade, topView()); shade.style.opacity = '.12'; } else shade.style.opacity = '0';
    void prev.offsetWidth; prev.style.transition = ''; shade.style.transition = '';
    renderView(prev); updateComposerCtx(); if (typeof Drawer !== 'undefined') Drawer.render();
    return;
  }
  v.classList.add('offright');
  prev.classList.remove('under');
  shade.style.opacity = '0';
  setTimeout(() => {
    v.remove();
    if (Nav.stack.length > 1) {
      shade.style.transition = 'none';
      stackEl.insertBefore(shade, topView());
      shade.style.opacity = '.12';
      void shade.offsetWidth; shade.style.transition = '';
    }
  }, 560);
  renderView(prev);
  updateComposerCtx();
  if (typeof Drawer !== 'undefined') Drawer.render();
}
/* ---------- Big screens (iPad landscape, computers): the ☰ menu stays open on the left ---------- */
const Split = { mq: matchMedia('(min-width: 960px)'), on: false };
function splitCheck() {
  const on = !!(typeof Drawer !== 'undefined' && Drawer.el) && Split.mq.matches;
  if (on === Split.on) return;
  Split.on = on;
  document.body.classList.toggle('split', on);
  if (typeof Drawer !== 'undefined') { if (on) Drawer.close(); Drawer.render(); }
  if (stackEl) renderNow();
}
Split.mq.addEventListener?.('change', splitCheck);

// Go somewhere from the menu: replace whatever is open (Back always leads Home)
function navTo(spec) {
  closeMenu();
  const N = Nav.stack.length;
  if (spec.type === 'home') {
    if (N < 2) { topView().scrollTo({ top: 0, behavior: 'smooth' }); return; }
    while (Nav.stack.length > 2) doPop({ instant: true });
    doPop(); Nav.ignorePops++; history.go(-(N - 1)); return;
  }
  if (N > 1 && specKey(topView()._spec) === specKey(spec)) return;
  if (N === 1) return pushView(spec);
  if (N === 2) { doPop({ instant: true }); return pushView(spec, { replace: true }); }
  while (Nav.stack.length > 1) doPop({ instant: true });
  Nav.ignorePops++; Nav.afterPop = () => pushView(spec, { replace: true });
  history.go(-(N - 2));
}

function openSmart(key) { pushView({ type: 'smart', key }); }
function openList(id) { Cmp.listPick = null; pushView({ type: 'list', id }); }
function openSearch() {
  if (topView()._spec.type === 'search') return;
  const v = pushView({ type: 'search' });
  const q = v.querySelector('#q'); if (q) q.focus({ preventScroll: true });
}

/* ---------- View rendering ---------- */
function renderView(v) {
  const spec = v._spec;
  if (spec.type === 'home' && homeIsChat()) {
    if (!v.classList.contains('chatview')) ChatUI.build(v);
    return ChatUI.render(v);
  }
  if (v.classList.contains('chatview')) { v.classList.remove('chatview', 'nopair'); v.innerHTML = VIEW_SHELL; }
  const nav = v.firstElementChild, body = v.lastElementChild;
  const idx = Nav.stack.indexOf(v);
  const [left, title, right] = nav.children;
  title.textContent = viewTitle(spec);
  if (spec.type === 'search') return renderSearch(v);
  const prevSpec = idx > 0 ? Nav.stack[idx - 1]._spec : null;
  const backTo = !prevSpec ? '' : prevSpec.type !== 'home' ? esc(viewTitle(prevSpec)) : homeIsChat() ? 'Chat<span class="chat-badge" hidden></span>' : 'To-dos';
  left.innerHTML = prevSpec ? `<button class="nav-btn back" data-a="back" type="button">${ic('chevL')}<span>${backTo}</span></button>` : '';
  if (spec.type === 'home' || spec.type === 'todos') {
    if (spec.type === 'home') left.innerHTML = `<button class="nav-btn" data-a="settings" type="button" aria-label="Settings">${ic('gear')}</button>`;
    right.innerHTML = '';
    body.innerHTML = hubHTML();
    if (typeof Chat !== 'undefined') Chat.updateBadge();
    return;
  }
  if (typeof Chat !== 'undefined') Chat.updateBadge();
  if (spec.type === 'tips') { right.innerHTML = ''; if (!v._tips) { v._tips = 1; renderTips(v); } return; }
  right.innerHTML = `<button class="nav-btn" data-a="viewmenu" type="button" aria-label="More options">${ic('more')}</button>`;
  renderTaskView(v);
}

// To-dos & reminders: every list in one place. Opened with the to-do button on the chat (or Home without accounts).
function hubHTML() {
  const all = liveTasks(), cnt = k => all.filter(SMART[k].match).length;
  const card = k => { const m = SMART[k], n = cnt(k);
    return `<button class="hub-card" data-a="smart" data-k="${k}" type="button" style="--c:var(--c-${m.color})"><span class="hub-ic">${k === 'today' ? `<b>${new Date().getDate()}</b>` : ic(m.icon)}</span>
      <span class="hub-n">${n || ''}</span><span class="hub-t">${esc(m.title)}</span></button>`; };
  const doneWeek = all.filter(t => t.done && t.doneAt > Date.now() - 7 * 864e5).length;
  const rows = lists().map(l => { const n = all.filter(t => !t.done && listOf(t).id === l.id).length;
    return `<button class="cell" data-a="list" data-id="${esc(l.id)}" type="button"><span class="list-ic" style="--c:var(--c-${l.color})">${esc(l.emoji)}</span><span class="grow">${esc(l.name)}</span>${l.private ? ic('lock', 'lock') : ''}<span class="val">${n || ''}</span>${ic('chevR', 'chev')}</button>`; }).join('');
  const streak = calcStreak();
  const stats = [streak ? `🔥 ${streak}-day streak` : '', doneWeek ? `💞 ${doneWeek} done together this week` : ''].filter(Boolean).join(' · ');
  return `<h1 class="large-title">To-dos</h1>${stats ? `<div class="subtitle">${esc(stats)}</div>` : ''}
    <button class="searchbar" data-a="search" type="button">${ic('search')}<span>Search tasks, notes, #tags</span></button>
    ${installBannerHTML()}
    <div class="hub-grid">${['today', 'upcoming', 'reminders', 'us', 'pinned', 'all'].map(card).join('')}</div>
    <button class="hub-done" data-a="smart" data-k="done" type="button">${ic('check', 'sm')}<span class="grow">Completed</span><span class="val">${doneWeek ? `${doneWeek} this week` : ''}</span>${ic('chevR', 'chev')}</button>
    <div class="sec-h sub">My Lists</div>
    <div class="group">${rows}<button class="cell accent" data-a="addlist" type="button"><span class="list-ic" style="--c:var(--accent)">${ic('plus', 'sm')}</span><span class="grow">New List</span></button></div>`;
}

let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; scheduleRender(); });
function installBannerHTML() {
  if (standalone() || L.tips.install || !(isTouch || installEvt)) return '';
  const how = installEvt ? `<button class="btn-s" data-a="install" type="button">Install</button>`
    : isIOS ? `<span>Tap ${ic('share', 'sm')} Share, then “Add to Home Screen”.</span>` : `<span>Use your browser menu → “Install app”.</span>`;
  return `<div class="banner"><span style="font-size:26px">📲</span><div><b>Get the full app feel</b>${how}</div>
    <button class="x" data-a="dismissInstall" aria-label="Dismiss" type="button">${ic('x', 'sm')}</button></div>`;
}

/* ---------- Task rows ---------- */
function rowHTML(t, ctx = {}) {
  const list = listOf(t), pend = Pending.has(t.id), checked = t.done || pend, t0 = todayStr();
  const meta = [];
  if (ctx.doneView && t.done) meta.push(`<span>${ic('check', 'xs')} ${esc(t.doneBy === L.me ? 'You' : person(t.doneBy).name)} · ${esc(new Date(t.doneAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</span>`);
  else if (t.due || t.time) {
    const od = !t.done && t.due && (t.due < t0 || (t.due === t0 && t.time && t.time < nowHM()));
    const label = ctx.hideToday && t.due === t0 ? fmtTime(t.time) : fmtDue(t.due, t.time);
    if (label) meta.push(`<span class="${od ? 'od' : ''}">${ic('cal', 'xs')} ${esc(label)}</span>`);
  }
  if (t.repeat) meta.push(`<span>${ic('repeat', 'xs')} ${esc(REPEATS[t.repeat] || '')}</span>`);
  if (ctx.showList) meta.push(`<span><i class="dot" style="--c:var(--c-${list.color})"></i>${esc(list.name)}</span>`);
  if (t.subtasks && t.subtasks.length) meta.push(`<span>${ic('list', 'xs')} ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>`);
  if (t.notes) meta.push(`<span>${ic('note', 'xs')}</span>`);
  if (t.pomos) meta.push(`<span>🍅 ${t.pomos}</span>`);
  (t.tags || []).forEach(tg => meta.push(`<span class="tag">#${esc(tg)}</span>`));
  const fresh = Fresh.has(t.id) ? ' enter' : '';
  return `<div class="task p${t.priority || 0}${checked ? ' checked' : ''}${fresh}" data-id="${esc(t.id)}">
    <div class="acts"><div class="act-l">${ic('check')}<span>${t.done ? 'Not done' : 'Done'}</span></div>
      <div class="act-r"><button class="pinb" data-act="pin" type="button">${ic('pin')}<span>${t.pinned ? 'Unpin' : 'Pin'}</span></button><button class="delb" data-act="del" type="button">${ic('trash')}<span>Delete</span></button></div></div>
    <div class="ti">
      <button class="chk" type="button" role="checkbox" aria-checked="${checked}" aria-label="Complete ${esc(t.title)}">${ic('check')}</button>
      <div class="tb"><div class="tt"><span>${t.priority ? `<b class="prio">${'!'.repeat(t.priority)}</b>` : ''}${esc(t.title)}</span></div>${meta.length ? `<div class="tm">${meta.join('')}</div>` : ''}</div>
      <div class="tr">${t.pinned ? ic('pin', 'pin-ic') : ''}${assigneeBadge(t.assignee)}</div>
    </div></div>`;
}
const groupHTML = (g, ctx) => g.items.length ? `${g.title ? `<div class="sec-h ${g.cls || ''}" ${g.color ? `style="color:var(--c-${g.color})"` : ''}>${esc(g.title)}${g.small ? `<small>${esc(g.small)}</small>` : ''}</div>` : ''}
  <div class="group tasks">${g.items.map(t => rowHTML(t, ctx)).join('')}</div>` : '';

function buildGroups(spec, tasks, sortMode) {
  const t0 = todayStr(), S = arr => sortTasks(arr, sortMode);
  if (spec.type === 'list' || spec.key === 'pinned') return [{ title: '', items: S(tasks) }];
  if (spec.key === 'today') {
    const od = tasks.filter(t => t.due < t0), td = tasks.filter(t => t.due === t0);
    const any = td.filter(t => !t.time), m = td.filter(t => t.time && t.time < '12:00');
    const a = td.filter(t => t.time && t.time >= '12:00' && t.time < '17:00'), n = td.filter(t => t.time && t.time >= '17:00');
    const other = od.length || m.length || a.length || n.length;
    return [{ title: 'Overdue', cls: 'red', items: S(od) }, { title: other ? 'Today' : '', items: S(any) },
      { title: 'Morning', items: S(m) }, { title: 'Afternoon', items: S(a) }, { title: 'Tonight', items: S(n) }];
  }
  if (spec.key === 'upcoming') {
    const by = new Map();
    for (const t of S(tasks)) {
      const diff = dayDiff(t.due, t0), d = fromYmd(t.due);
      const key = diff <= 7 ? t.due : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      if (!by.has(key)) {
        const sameYear = d.getFullYear() === new Date().getFullYear();
        by.set(key, diff <= 7
          ? { title: fmtDate(t.due, { long: true }), small: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), items: [] }
          : { title: d.toLocaleDateString([], { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }), items: [] });
      }
      by.get(key).items.push(t);
    }
    return [...by.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(e => e[1]);
  }
  if (spec.key === 'reminders') {
    const at = t => t.due + ' ' + t.time, hm = nowHM();
    const byTime = arr => arr.sort((x, y) => at(x).localeCompare(at(y)));
    const missed = tasks.filter(t => t.due < t0 || (t.due === t0 && t.time < hm)), next = byTime(tasks.filter(t => !missed.includes(t)));
    const by = new Map();
    for (const t of next) { if (!by.has(t.due)) by.set(t.due, { title: fmtDate(t.due, { long: true }), items: [] }); by.get(t.due).items.push(t); }
    return [{ title: 'Missed', cls: 'red', items: byTime(missed) }, ...by.values()];
  }
  if (spec.key === 'all') return lists().map(l => ({ title: `${l.emoji} ${l.name}`, color: l.color, items: S(tasks.filter(t => listOf(t).id === l.id)) }));
  if (spec.key === 'us') return [
    { title: 'Overdue', cls: 'red', items: S(tasks.filter(t => t.due && t.due < t0)) },
    { title: 'Today', items: S(tasks.filter(t => t.due === t0)) },
    { title: 'Coming up', items: S(tasks.filter(t => t.due && t.due > t0)) },
    { title: 'Someday', items: S(tasks.filter(t => !t.due)) }];
  if (spec.key === 'done') {
    const by = new Map();
    tasks.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 300).forEach(t => {
      const k = ymd(new Date(t.doneAt || 0));
      if (!by.has(k)) by.set(k, { title: fmtDate(k, { long: true }), items: [] });
      by.get(k).items.push(t);
    });
    return [...by.values()];
  }
  return [{ title: '', items: S(tasks) }];
}

const EMPTY = {
  today: ['☀️', 'Nothing due today', 'Enjoy the free time — or add something below.'],
  upcoming: ['🗓️', 'Nothing scheduled', 'Add a date as you type, like “fri 6pm”.'],
  us: ['💞', 'Nothing shared yet', 'Type “@us” to make a task for both of you.'],
  pinned: ['📌', 'Nothing pinned', 'Swipe left on a task to pin it here.'],
  all: ['🌿', 'All clear', 'Your to-do list is empty. Nice.'],
  done: ['✅', 'Nothing completed yet', 'Finished tasks show up here.'],
  reminders: ['🔔', 'No reminders yet', 'Give a to-do a time, like “call mom 6pm”, and it shows up here.'],
};
const emptyHTML = (e, h, p) => `<div class="empty"><span class="e">${e}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`;

function renderTaskView(v) {
  const spec = v._spec, body = v.lastElementChild, key = specKey(spec), vp = viewPrefs(key);
  const who = vp.who || 'all', showDone = !!vp.showDone, isDone = spec.key === 'done';
  let color, heading, sub = '', base, doneSet = [];
  const live = liveTasks().filter(t => isDone ? (who === 'all' || t.doneBy === (who === 'me' ? L.me : partnerKey()) || (who === 'both' && t.assignee === 'both')) : whoMatch(t, who));
  if (spec.type === 'list') {
    const l = D.lists[spec.id];
    if (!l || l.deleted) { body.innerHTML = emptyHTML('🤷', 'This list is gone', 'It was deleted.'); return; }
    color = l.color; heading = `${l.emoji} ${l.name}`;
    const mine = live.filter(t => listOf(t).id === l.id);
    base = mine.filter(t => !t.done); doneSet = mine.filter(t => t.done);
    sub = l.private ? `${ic('lock', 'xs')} Secret · only on this phone, never synced` : `${base.length} to do`;
  } else {
    const sm = SMART[spec.key];
    color = sm.color; heading = viewTitle(spec);
    base = live.filter(sm.match); doneSet = live.filter(sm.doneMatch);
    if (spec.key === 'today') sub = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    else if (spec.key === 'us') sub = 'Shared between you two 💞';
    else if (spec.key === 'reminders') sub = alertsOn() ? `${ic('bell', 'xs')} You’ll get an alert at each time` : `Alerts are off · <button class="link-btn" data-a="alerts" type="button">Turn on</button>`;
    else sub = `${base.length} ${isDone ? 'completed' : 'to do'}`;
  }
  const groups = buildGroups(spec, base, vp.sort || 'smart').filter(g => g.items.length);
  const ctx = { showList: spec.type !== 'list', doneView: isDone, hideToday: spec.key === 'today' };
  let listHTML = groups.map(g => groupHTML(g, ctx)).join('');
  if (!groups.length) {
    const e = spec.type === 'list' ? [D.lists[spec.id].emoji, 'No tasks yet', 'Type below to add your first one.'] : EMPTY[spec.key];
    listHTML = emptyHTML(...e);
  }
  if (!isDone && doneSet.length) {
    listHTML += `<button class="done-toggle" data-a="togdone" type="button"><span>${doneSet.length} completed</span><b>${showDone ? 'Hide' : 'Show'}</b></button>`;
    if (showDone) listHTML += groupHTML({ title: '', items: doneSet.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) }, ctx);
  }
  if (!body.querySelector('.vlist')) {
    body.innerHTML = `<h1 class="large-title"></h1><div class="subtitle"></div>${segHTML('who', [['all', 'All'], ['me', esc(shortName(myName()))], ['partner', esc(shortName(ptName()))], ['both', 'Us']], who, 'who')}<div class="vlist"></div>`;
  }
  const h1 = body.querySelector('.large-title');
  h1.textContent = heading; h1.style.color = `var(--c-${color})`;
  body.querySelector('.subtitle').innerHTML = sub;
  body.querySelector('.vlist').innerHTML = listHTML;
}
SegHandlers.who = (val, seg) => {
  const v = seg.closest('.view'); if (!v) return;
  viewPrefs(specKey(v._spec)).who = val; save();
  renderTaskView(v); updateComposerCtx();
};

/* ---------- Search ---------- */
function renderSearch(v) {
  const nav = v.firstElementChild, body = v.lastElementChild;
  if (!nav.querySelector('#q')) {
    nav.children[0].style.flex = '1';
    nav.children[0].innerHTML = `<div class="searchbar" style="margin:0 4px 0 8px;width:100%">${ic('search')}<input class="inp" id="q" type="search" placeholder="Tasks, notes, #tags" enterkeyhint="search" autocomplete="off"></div>`;
    nav.children[2].innerHTML = `<button class="nav-btn" data-a="back" type="button">Cancel</button>`;
    nav.classList.add('scrolled'); nav.children[1].style.display = 'none';
    nav.querySelector('#q').addEventListener('input', () => renderSearch(v));
  }
  const q = (nav.querySelector('#q').value || '').trim().toLowerCase();
  if (!q) {
    const tags = [...new Set(liveTasks().flatMap(t => t.tags || []))].slice(0, 24);
    body.innerHTML = `<div class="empty"><span class="e">🔎</span><h3>Search everything</h3><p>Titles, notes, subtasks and tags across all lists.</p></div>
      ${tags.length ? `<div class="pills" style="max-height:none;opacity:1;flex-wrap:wrap;justify-content:center;padding:0 20px">${tags.map(tg => `<button class="pill" data-a="searchtag" data-v="${esc(tg)}" type="button">#${esc(tg)}</button>`).join('')}</div>` : ''}`;
    return;
  }
  const hit = t => q.startsWith('#') ? (t.tags || []).includes(q.slice(1))
    : (t.title + ' ' + t.notes + ' ' + (t.tags || []).join(' ') + ' ' + (t.subtasks || []).map(s => s.title).join(' ')).toLowerCase().includes(q);
  const res = liveTasks().filter(hit);
  const act = sortTasks(res.filter(t => !t.done)), dn = res.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 50);
  const ctx = { showList: true };
  body.innerHTML = res.length
    ? groupHTML({ title: `${act.length} result${act.length === 1 ? '' : 's'}`, items: act }, ctx) + groupHTML({ title: 'Completed', items: dn }, ctx)
    : emptyHTML('🫥', 'No results', `Nothing matches “${q}”.`);
  if (res.length && !act.length) body.insertAdjacentHTML('afterbegin', `<div class="sec-h">No open tasks</div>`);
}
