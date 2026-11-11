/* Twodo · navigation stack and screen rendering */
'use strict';

const Nav = { stack: [], dragging: false };
const Pending = new Map(); // task id → timer while the check animation plays
const Fresh = new Set();   // task ids that should animate in
let stackEl, shade, lastRingP = 0;

const topView = () => Nav.stack[Nav.stack.length - 1];
const specKey = s => s.type === 'list' ? 'l:' + s.id : s.type === 'smart' ? 's:' + s.key : s.type;
const viewPrefs = key => (L.view[key] = L.view[key] || {});
function viewTitle(spec) {
  if (spec.type === 'home') return 'Twodo';
  if (spec.type === 'search') return 'Search';
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
}

/* ---------- Stack ---------- */
function makeView(spec) {
  const v = document.createElement('section');
  v.className = 'view'; v._spec = spec;
  v.innerHTML = `<header class="nav"><div class="nav-side l"></div><div class="nav-title"></div><div class="nav-side r"></div></header><div class="vbody"></div>`;
  v.addEventListener('scroll', () => {
    v.firstElementChild.classList.toggle('scrolled', v.scrollTop > (spec.type === 'home' ? 64 : 34));
  }, { passive: true });
  return v;
}
function pushView(spec) {
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
  history.pushState({ d: Nav.stack.length }, '');
  updateComposerCtx();
  haptic('light');
  return v;
}
function popView() {
  if (Nav.stack.length < 2) return;
  if (history.state && history.state.d === Nav.stack.length && !history.state.s) history.back();
  else doPop();
}
function doPop() {
  if (Nav.stack.length < 2) return;
  const v = Nav.stack.pop(), prev = topView();
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
  const spec = v._spec, nav = v.firstElementChild, body = v.lastElementChild;
  const idx = Nav.stack.indexOf(v);
  const [left, title, right] = nav.children;
  title.textContent = viewTitle(spec);
  if (spec.type === 'search') return renderSearch(v);
  const prevSpec = idx > 0 ? Nav.stack[idx - 1]._spec : null;
  left.innerHTML = prevSpec ? `<button class="nav-btn back" data-a="back" type="button">${ic('chevL')}<span>${esc(prevSpec.type === 'home' ? 'Lists' : viewTitle(prevSpec))}</span></button>` : '';
  if (spec.type === 'home') {
    right.innerHTML = `<button class="duo" data-a="settings" type="button" aria-label="Settings">${avatar(L.me)}${avatar(partnerKey())}<i class="sync-dot ${Sync.state}"></i></button>`;
    body.innerHTML = homeHTML();
    const bar = body.querySelector('.ring .bar');
    if (bar) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.strokeDashoffset = 113.1 * (1 - lastRingP); }));
    return;
  }
  right.innerHTML = `<button class="nav-btn" data-a="viewmenu" type="button" aria-label="More options">${ic('more')}</button>`;
  renderTaskView(v);
}

function homeHTML() {
  const t0 = todayStr(), all = liveTasks(), now = new Date(), h = now.getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  const cnt = k => all.filter(SMART[k].match).length;
  const rem = cnt('today'), doneT = all.filter(doneToday).length, total = rem + doneT;
  const p = total ? doneT / total : 0, prevP = lastRingP; lastRingP = p;
  const streak = calcStreak();
  const together = all.filter(x => x.done && x.doneAt > Date.now() - 7 * 864e5).length;
  const ptLeft = all.filter(x => SMART.today.match(x) && x.assignee === partnerKey()).length;
  const heroT = total === 0 ? 'Nothing due today ☀️' : rem === 0 ? 'All done for today 🎉' : `${rem} left today`;
  const bits = [];
  if (streak) bits.push(`🔥 ${streak}-day streak`);
  bits.push(`💞 ${together} done together this week`);
  if (ptLeft) bits.push(`${esc(firstWord(ptName()))} has ${ptLeft} today`);
  const card = (k, iconHTML, n) => `<button class="card" data-a="smart" data-k="${k}" type="button">
      <span class="ic" style="--c:var(--c-${SMART[k].color})">${iconHTML}</span><span class="n">${n}</span><span class="l">${SMART[k].title}</span></button>`;
  const reqs = typeof Inbox !== 'undefined' ? Inbox.incoming() : [];
  const unpaired = Auth.user() && L.auth.username && !(L.pair && L.pair.status) && !reqs.length && !L.tips.pair;
  const banner = (unpaired ? `<div class="banner"><span style="font-size:26px">💌</span><div><b>Add ${esc(firstWord(ptName()) === 'Partner' ? 'your partner' : firstWord(ptName()))}</b><span style="display:block;color:var(--label2);font-size:14px">You’re <b style="display:inline">@${esc(L.auth.username)}</b></span><button class="btn-s" data-a="invite" type="button">＋ Add partner</button></div><button class="x" data-a="dismissPair" aria-label="Dismiss" type="button">${ic('x', 'sm')}</button></div>` : '') + (reqs.length ? `<button class="banner" data-a="invite" type="button" style="border:0;width:calc(100% - 32px);text-align:left;color:inherit"><span style="font-size:26px">💌</span><div><b>${esc(reqs[0][1].name)} sent you a partner request</b><span>Tap to accept or decline</span></div></button>` : '') + installBannerHTML();
  const listRows = lists().map(l => {
    const n = all.filter(t => !t.done && listOf(t).id === l.id).length;
    return `<button class="cell tap" data-a="list" data-id="${esc(l.id)}" type="button"><span class="list-ic" style="--c:var(--c-${l.color})">${esc(l.emoji)}</span>
      <span class="grow">${esc(l.name)}</span>${l.private ? ic('lock', 'lock') : ''}<span class="val">${n || ''}</span>${ic('chevR', 'chev')}</button>`;
  }).join('');
  return `
    <div class="hello"><div class="date">${esc(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
      <h1>${greet}, ${esc(firstWord(myName()))}</h1></div>
    <div class="hero"><div class="ring"><svg viewBox="0 0 44 44"><circle class="trk" cx="22" cy="22" r="18"/><circle class="bar" cx="22" cy="22" r="18" style="stroke-dashoffset:${113.1 * (1 - prevP)}"/></svg><b>${total ? `${doneT}/${total}` : '✓'}</b></div>
      <div class="hero-t"><div class="h1">${heroT}</div><div class="h2">${bits.join(' · ')}</div></div></div>
    ${banner}
    <button class="searchbar" data-a="search" type="button">${ic('search')}<span>Search</span><kbd>⌘K</kbd></button>
    <div class="grid">
      ${card('today', `<span class="daynum">${now.getDate()}</span>`, cnt('today'))}
      ${card('upcoming', ic('cal'), cnt('upcoming'))}
      ${card('us', ic('heart'), cnt('us'))}
      ${card('pinned', ic('pin'), cnt('pinned'))}
      ${card('all', ic('tray'), cnt('all'))}
      ${card('done', ic('check'), cnt('done'))}
    </div>
    <div class="sec-title"><h2>My Lists</h2></div>
    <div class="group">${listRows}<button class="cell accent tap" data-a="addlist" type="button"><span class="list-ic" style="--c:var(--accent)">${ic('plus', 'sm')}</span><span class="grow">Add List</span></button></div>
    <div class="foot">Twodo · made for ${esc(firstWord(person('a').name))} & ${esc(firstWord(person('b').name))} 💞</div>`;
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
