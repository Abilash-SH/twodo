/* Twodo · task actions and touch gestures (swipe actions, long-press menu, edge-swipe back) */
'use strict';

let G = null, openRow = null, openOffset = 0, suppressClickUntil = 0;
const rowsFor = id => $$(`.task[data-id="${CSS.escape(id)}"]`, stackEl);

/* ---------- Completing ---------- */
function setRowsChecked(id, on, pop) {
  rowsFor(id).forEach(r => {
    r.classList.toggle('checked', on);
    const c = r.querySelector('.chk'); if (c) c.setAttribute('aria-checked', on);
    if (pop) { r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); }
  });
}
function collapseRows(id, cb) {
  const rows = rowsFor(id);
  if (!rows.length || reducedMotion.matches) return cb();
  rows.forEach(r => { r.style.height = r.offsetHeight + 'px'; void r.offsetHeight; r.classList.add('leaving'); });
  setTimeout(cb, 360);
}
function viewShowsDone() { const v = topView(); return v && v._spec.type !== 'home' && !!viewPrefs(specKey(v._spec)).showDone; }

function toggleDone(id, { instant = false } = {}) {
  const t = D.tasks[id]; if (!t) return;
  if (Pending.has(id)) { // tapped again during the animation → cancel
    clearTimeout(Pending.get(id)); Pending.delete(id); setRowsChecked(id, false); haptic('light'); return;
  }
  if (t.done) {
    updateTask(id, { done: false, doneAt: null, doneBy: null });
    haptic('light'); return;
  }
  haptic('success'); blip('done');
  setRowsChecked(id, true, true);
  const keep = viewShowsDone() || topView()._spec.key === 'done';
  Pending.set(id, setTimeout(() => {
    Pending.delete(id);
    if (keep || instant) completeNow(id); else collapseRows(id, () => completeNow(id));
  }, instant ? 0 : 700));
}
function completeNow(id) {
  const t = D.tasks[id]; if (!t || t.done) return;
  const wasToday = SMART.today.match(t);
  const before = snapshot(t);
  let spawned = null;
  if (t.repeat) {
    spawned = makeTask({
      title: t.title, notes: t.notes, listId: t.listId, priority: t.priority, tags: [...(t.tags || [])], assignee: t.assignee,
      subtasks: (t.subtasks || []).map(s => ({ ...s, done: false })), repeat: t.repeat, pinned: t.pinned, time: t.time,
      due: nextDue(t.due, t.repeat), createdBy: t.createdBy,
    });
  }
  updateTask(id, { done: true, doneAt: Date.now(), doneBy: L.me });
  const cleared = wasToday && !liveTasks().some(SMART.today.match);
  if (cleared) { setTimeout(confetti, 150); blip('chime'); }
  island({
    e: cleared ? '🎉' : '✅',
    text: cleared ? 'Today is all done!' : `Completed “${t.title}”`,
    sub: spawned ? `Repeats · next ${fmtDue(spawned.due, spawned.time)}` : cleared ? 'Go enjoy yourselves 💞' : '',
    btn: 'Undo',
    onBtn: () => {
      Object.assign(D.tasks[id], before); commit(D.tasks[id]);
      if (spawned) { spawned.deleted = true; commit(spawned); }
    },
  });
}

/* ---------- Other task actions ---------- */
function deleteTask(id, { animate = true } = {}) {
  const t = D.tasks[id]; if (!t) return;
  const before = snapshot(t);
  haptic('medium');
  const go = () => {
    updateTask(id, { deleted: true });
    island({ e: '🗑️', text: `Deleted “${t.title}”`, btn: 'Undo', onBtn: () => { Object.assign(D.tasks[id], before); Fresh.add(id); commit(D.tasks[id]); } });
  };
  animate ? collapseRows(id, go) : go();
}
function togglePin(id) {
  const t = D.tasks[id]; if (!t) return;
  updateTask(id, { pinned: !t.pinned });
  haptic('light');
  island({ e: '📌', text: t.pinned ? 'Pinned to the top' : 'Unpinned', ms: 1500 });
}
function duplicateTask(id) {
  const t = D.tasks[id]; if (!t) return;
  const c = snapshot(t);
  delete c.id; delete c.updatedAt; delete c._s;
  const n = makeTask({ ...c, title: t.title, done: false, doneAt: null, doneBy: null, createdAt: Date.now(), createdBy: L.me, subtasks: (t.subtasks || []).map(s => ({ ...s, id: uid(), done: false })) });
  Fresh.add(n.id);
  island({ e: '📄', text: 'Duplicated', ms: 1500 });
  return n;
}
function quickDue(id, v) {
  const now = new Date(), d = now.getDay();
  const due = v === '0' ? todayStr() : v === '1' ? ymd(addDays(now, 1))
    : v === 'we' ? ymd(addDays(now, d === 6 || d === 0 ? 0 : 6 - d))
    : v === 'nw' ? ymd(addDays(now, ((1 - d + 7) % 7) || 7)) : null;
  updateTask(id, { due });
  island({ e: '📅', text: due ? `Moved to ${fmtDate(due, { long: true })}` : 'Date removed', ms: 1500 });
}

/* ---------- Long-press context menu ---------- */
function taskMenuHTML(t) {
  const pr = [0, 1, 2, 3].map(p => `<button data-m="prio" data-v="${p}" class="${(t.priority || 0) === p ? 'on' : ''}" type="button">${p ? '!'.repeat(p) : '–'}</button>`).join('');
  const as = [['', '–'], [L.me, avatar(L.me)], [partnerKey(), avatar(partnerKey())], ['both', 'Us']]
    .map(([k, l]) => `<button data-m="assign" data-v="${k}" class="${(t.assignee || '') === k ? 'on' : ''}" type="button">${l}</button>`).join('');
  return `<div class="mpal">
      <button data-m="due" data-v="0" type="button">${ic('cal')}Today</button>
      <button data-m="due" data-v="1" type="button">${ic('sunrise')}Tomorrow</button>
      <button data-m="due" data-v="we" type="button">${ic('sofa')}Weekend</button>
      <button data-m="due" data-v="nw" type="button">${ic('calnext')}Next Week</button></div>
    <div class="mgap"></div>
    <button class="mi" data-m="done" type="button">${t.done ? 'Mark as Not Done' : 'Complete'}${ic('check')}</button>
    <button class="mi" data-m="pin" type="button">${t.pinned ? 'Unpin' : 'Pin'}${ic('pin')}</button>
    <button class="mi" data-m="focus" type="button">Focus Timer${ic('timer')}</button>
    <button class="mi" data-m="move" type="button">Move to List…${ic('list')}</button>
    <button class="mi" data-m="dup" type="button">Duplicate${ic('copy')}</button>
    ${t.due ? `<button class="mi" data-m="due" data-v="none" type="button">Remove Date${ic('x')}</button>` : ''}
    <div class="mgap"></div>
    <div class="mrow"><span class="lbl">Priority</span><div class="opts">${pr}</div></div>
    <div class="mrow"><span class="lbl">For</span><div class="opts">${as}</div></div>
    <div class="mgap"></div>
    <button class="mi red" data-m="del" type="button">Delete${ic('trash')}</button>`;
}
function openTaskMenu(row) {
  const id = row.dataset.id, t = D.tasks[id]; if (!t) return;
  haptic('medium');
  showMenu({
    rect: row.getBoundingClientRect(), preview: row.querySelector('.ti').outerHTML, taskId: id, html: taskMenuHTML(t),
    onPick: (m, v) => {
      switch (m) {
        case 'due': return quickDue(id, v);
        case 'done': return toggleDone(id);
        case 'pin': return togglePin(id);
        case 'focus': return openFocus(id);
        case 'dup': return duplicateTask(id);
        case 'del': return deleteTask(id);
        case 'prio': return updateTask(id, { priority: Number(v) });
        case 'assign': return updateTask(id, { assignee: v || null });
        case 'move': {
          const list = Menu.el.querySelector('.mlist');
          list.innerHTML = `<button class="mi" data-m="back" type="button">${ic('chevL')}<span style="flex:1">Back</span></button><div class="mgap"></div>` +
            lists().map(l => `<button class="mi" data-m="moveto" data-v="${esc(l.id)}" type="button"><span>${esc(l.emoji)} ${esc(l.name)}</span>${listOf(t).id === l.id ? ic('check', 'ck') : ''}</button>`).join('');
          return 'keep';
        }
        case 'back': Menu.el.querySelector('.mlist').innerHTML = taskMenuHTML(D.tasks[id]); return 'keep';
        case 'moveto': {
          const l = D.lists[v]; updateTask(id, { listId: v });
          island({ e: l.emoji, text: `Moved to ${l.name}`, sub: l.private ? 'Secret · not synced' : '', ms: 1600 });
          return;
        }
      }
    },
  });
}

/* ---------- Swipe & long-press ---------- */
function setSwipe(g, x) {
  const w = g.row.offsetWidth; let v = x;
  if (v > 0) {
    if (v > 140) v = 140 + (v - 140) * 0.35;
    g.row.dataset.dir = 'r';
    const armed = v > 100;
    if (armed !== !!g.armed) { g.armed = armed; g.row.classList.toggle('armed', armed); if (armed) haptic('light'); }
  } else if (v < 0) {
    g.row.dataset.dir = 'l';
    const full = -v > w * 0.62;
    if (full !== !!g.full) { g.full = full; g.row.classList.toggle('full', full); haptic('light'); }
  } else delete g.row.dataset.dir;
  g.cur = v;
  g.ti.style.transform = `translateX(${v}px)`;
  g.row.style.setProperty('--sw', Math.max(0, -v) + 'px');
}
function settleRow(row, x, cb) {
  const ti = row.querySelector('.ti');
  ti.style.transition = 'transform .45s var(--spring)';
  ti.style.transform = `translateX(${x}px)`;
  row.style.setProperty('--sw', Math.max(0, -x) + 'px');
  setTimeout(() => {
    ti.style.transition = '';
    if (x === 0) { ti.style.transform = ''; delete row.dataset.dir; row.classList.remove('armed', 'full'); }
    if (cb) cb();
  }, 460);
}
function closeOpenRow() { if (openRow) { settleRow(openRow, 0); openRow = null; } }
function endSwipe(g, cancelled) {
  const { row, ti, id } = g, v = g.cur, w = row.offsetWidth;
  row.classList.remove('swiping');
  if (cancelled) { settleRow(row, 0); if (openRow === row) openRow = null; return; }
  if (v > 100 || (v > 45 && g.vx > 0.6)) { settleRow(row, 0); if (openRow === row) openRow = null; toggleDone(id); return; }
  if (g.full) {
    ti.style.transition = 'transform .3s var(--spring)'; ti.style.transform = `translateX(${-w}px)`;
    row.style.setProperty('--sw', w + 'px');
    openRow = null; setTimeout(() => deleteTask(id), 220); return;
  }
  if (v < -50 || (v < -20 && g.vx < -0.5)) { settleRow(row, -156); openRow = row; openOffset = -156; return; }
  settleRow(row, 0); if (openRow === row) openRow = null;
}

/* ---------- Swipe in from the left edge on Home → the ☰ menu follows your finger ---------- */
function moveDrawer(e) {
  const dx = Math.max(0, e.clientX - G.x0);
  if (!G.active && dx > 6) {
    G.active = true; Drawer.el.innerHTML = Drawer.html();
    Drawer.el.classList.add('dragging', 'peek'); Drawer.bg.classList.add('dragging', 'on');
  }
  if (!G.active) return;
  const now = performance.now();
  G.vx = (e.clientX - G.lastX) / Math.max(1, now - G.lastT); G.lastX = e.clientX; G.lastT = now; G.dx = dx;
  Drawer.setP(dx / Drawer.el.offsetWidth);
}
function endDrawer(g, cancelled) {
  if (!g.active) return;
  Drawer.el.classList.remove('dragging', 'peek'); Drawer.bg.classList.remove('dragging');
  if (!cancelled && (g.dx > Drawer.el.offsetWidth * 0.3 || g.vx > 0.4)) Drawer.show(); else Drawer.close();
}

/* ---------- Edge swipe back ---------- */
function moveEdge(e) {
  const dx = Math.max(0, e.clientX - G.x0);
  if (!G.active && dx > 6) { G.active = true; stackEl.classList.add('dragging'); Nav.dragging = true; }
  if (!G.active) return;
  const now = performance.now();
  G.vx = (e.clientX - G.lastX) / Math.max(1, now - G.lastT); G.lastX = e.clientX; G.lastT = now;
  G.dx = dx;
  const p = Math.min(1, dx / G.w);
  G.top.style.transform = `translateX(${dx}px)`;
  G.prev.style.transform = `translateX(${-28 * (1 - p)}%)`;
  shade.style.opacity = String(0.12 * (1 - p));
}
function endEdge(cancelled = false) {
  if (!G.active) return;
  stackEl.classList.remove('dragging'); Nav.dragging = false;
  const go = !cancelled && (G.dx > G.w * 0.33 || G.vx > 0.45);
  // clear the finger offsets and pop in the same frame, so the page keeps sliding from where it was let go
  G.top.style.transform = ''; G.prev.style.transform = '';
  if (go) { suppressClickUntil = performance.now() + 400; popView(); }
  else shade.style.opacity = '.12';
  if (renderDeferred) scheduleRender();
}

function initGestures() {
  stackEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const sx = e.clientX - stackEl.getBoundingClientRect().left;
    if (!Split.on && Nav.stack.length === 1 && sx < 22 && e.pointerType !== 'mouse' && !Drawer.open) {
      G = { kind: 'drawer', pid: e.pointerId, x0: e.clientX, dx: 0, active: false, vx: 0, lastX: e.clientX, lastT: performance.now() };
      return;
    }
    if (Nav.stack.length > 1 && sx < 24 && e.pointerType !== 'mouse') {
      G = { kind: 'edge', pid: e.pointerId, x0: e.clientX, top: topView(), prev: Nav.stack[Nav.stack.length - 2], w: stackEl.offsetWidth, dx: 0, active: false, vx: 0, lastX: e.clientX, lastT: performance.now() };
      return;
    }
    const ti = e.target.closest('.ti');
    if (!ti) { if (openRow && !e.target.closest('.act-r')) closeOpenRow(); return; }
    const row = ti.parentElement;
    if (openRow && openRow !== row) closeOpenRow();
    G = { kind: 'row', row, ti, id: row.dataset.id, x0: e.clientX, y0: e.clientY, base: row === openRow ? openOffset : 0, mode: null, pid: e.pointerId, lastX: e.clientX, lastT: performance.now(), vx: 0 };
    G.cur = G.base;
    G.lp = setTimeout(() => {
      if (G && G.kind === 'row' && !G.mode) { G.mode = 'lp'; suppressClickUntil = performance.now() + 700; openTaskMenu(row); }
    }, 480);
  });
  addEventListener('pointermove', e => {
    if (!G || e.pointerId !== G.pid) return;
    if (G.kind === 'edge') return moveEdge(e);
    if (G.kind === 'drawer') return moveDrawer(e);
    if (G.mode === 'lp' || G.mode === 'scroll') return;
    const dx = e.clientX - G.x0, dy = e.clientY - G.y0;
    if (!G.mode) {
      if (Math.hypot(dx, dy) > 8) clearTimeout(G.lp);
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        G.mode = 'swipe'; G.row.classList.add('swiping');
        try { G.ti.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      } else if (Math.abs(dy) > 10) { G.mode = 'scroll'; return; }
    }
    if (G.mode === 'swipe') {
      const now = performance.now();
      G.vx = (e.clientX - G.lastX) / Math.max(1, now - G.lastT); G.lastX = e.clientX; G.lastT = now;
      setSwipe(G, G.base + dx);
    }
  }, { passive: true });
  const up = e => {
    if (!G || e.pointerId !== G.pid) return;
    const g = G; G = null;
    if (g.kind === 'drawer') { endDrawer(g, e.type === 'pointercancel'); return; }
    if (g.kind === 'edge') {
      // cancelled = the system took the gesture over (e.g. the iPhone's own back swipe): never pop here as well
      if (e.type === 'pointercancel') Nav.edgeCancelAt = performance.now();
      G = g; endEdge(e.type === 'pointercancel'); G = null; return;
    }
    clearTimeout(g.lp);
    if (g.mode === 'swipe') { suppressClickUntil = performance.now() + 350; endSwipe(g, e.type === 'pointercancel'); }
    if (g.mode === 'lp') Menu.armAt = performance.now() + 150;
    if (renderDeferred) setTimeout(scheduleRender, 480);
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  stackEl.addEventListener('contextmenu', e => {
    const ti = e.target.closest('.ti'); if (!ti) return;
    e.preventDefault();
    if (isTouch || Menu.open) return; // touch devices use our long-press
    openTaskMenu(ti.parentElement); Menu.armAt = performance.now() + 50;
  });

  stackEl.addEventListener('click', e => {
    if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
    const act = e.target.closest('.act-r button');
    if (act) {
      const id = act.closest('.task').dataset.id;
      if (act.dataset.act === 'pin') { closeOpenRow(); togglePin(id); } else { openRow = null; deleteTask(id); }
      return;
    }
    const a = e.target.closest('[data-a]');
    if (a) return onAction(a.dataset.a, a);
    const row = e.target.closest('.task');
    if (row && openRow) { closeOpenRow(); return; }
    if (row && e.target.closest('.chk')) return toggleDone(row.dataset.id);
    if (row) openTaskSheet(row.dataset.id);
  });
}

function onAction(name, el) {
  switch (name) {
    case 'back': return popView();
    case 'settings': return openSettings();
    case 'smart': return openSmart(el.dataset.k);
    case 'list': return openList(el.dataset.id);
    case 'addlist': return openListSheet();
    case 'search': return openSearch();
    case 'searchtag': { const q = $('#q'); q.value = '#' + el.dataset.v; renderSearch(topView()); return; }
    case 'viewmenu': return openViewMenu(el);
    case 'togdone': {
      const v = el.closest('.view'), vp = viewPrefs(specKey(v._spec));
      vp.showDone = !vp.showDone; save(); renderTaskView(v); haptic('light'); return;
    }
    case 'dismissInstall': L.tips.install = 1; save(); scheduleRender(); return;
    case 'invite': return openInviteSheet();
    case 'chat': return ChatUI.open();
    case 'dismissPair': L.tips.pair = 1; save(); scheduleRender(); return;
    case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; scheduleRender(); } return;
    case 'tips': return openTips();
    case 'menu': return Drawer.show();
    case 'idea': Cmp.ta.value = el.dataset.v; updateComposer(); Cmp.ta.focus(); return;
    case 'tipcat': return pickTipCat(el.closest('.view'), el.dataset.v);
    case 'tipact': return el.dataset.v === 'invite' ? openInviteSheet() : el.dataset.v === 'chat' ? ChatUI.open() : openSettings();
  }
}

/* ---------- View "…" menu ---------- */
function openViewMenu(btn) {
  const v = btn.closest('.view'), spec = v._spec, vp = viewPrefs(specKey(spec)), sort = vp.sort || 'smart';
  const sorts = [['smart', 'Smart'], ['due', 'Due Date'], ['priority', 'Priority'], ['created', 'Date Added'], ['alpha', 'Title']];
  const isList = spec.type === 'list', isDone = spec.key === 'done';
  const html = (isDone ? '' : `<div class="mrow"><span class="lbl">Sort by</span></div>` +
    sorts.map(([k, l]) => `<button class="mi" data-m="sort" data-v="${k}" type="button"><span>${l}</span>${sort === k ? ic('check', 'ck') : ''}</button>`).join('') +
    `<div class="mgap"></div><button class="mi" data-m="showdone" type="button">${vp.showDone ? 'Hide' : 'Show'} Completed${ic('check')}</button>`) +
    (isList ? `<button class="mi" data-m="editlist" type="button">Edit List…${ic('edit')}</button><button class="mi" data-m="sharelist" type="button">Share as Text${ic('share')}</button>` : '') +
    `<button class="mi red" data-m="cleardone" type="button">Clear Completed${ic('trash')}</button>`;
  showMenu({
    rect: btn.getBoundingClientRect(), html, align: 'right',
    onPick: async (m, val) => {
      if (m === 'sort') { vp.sort = val; save(); renderTaskView(v); }
      else if (m === 'showdone') { vp.showDone = !vp.showDone; save(); renderTaskView(v); }
      else if (m === 'editlist') openListSheet(spec.id);
      else if (m === 'sharelist') shareList(spec.id);
      else if (m === 'cleardone') {
        const done = liveTasks().filter(t => t.done && (isList ? listOf(t).id === spec.id : true));
        if (!done.length) return island({ e: '🧹', text: 'Nothing to clear', ms: 1400 });
        if (await confirmDialog({ title: `Clear ${done.length} completed?`, message: isList ? 'They’ll be removed from this list.' : 'This clears completed tasks in every list.', ok: 'Clear', destructive: true })) {
          done.forEach(t => { t.deleted = true; commit(t, { silent: true }); });
          scheduleRender(); island({ e: '🧹', text: `Cleared ${done.length} tasks` });
        }
      }
    },
  });
}
async function shareList(id) {
  const l = D.lists[id]; if (!l) return;
  const ts = sortTasks(liveTasks().filter(t => listOf(t).id === id && !t.done));
  const text = `${l.emoji} ${l.name}\n` + ts.map(t => `☐ ${t.title}${t.due ? ` (${fmtDue(t.due, t.time)})` : ''}`).join('\n');
  if (navigator.share) { try { await navigator.share({ title: l.name, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  if (await copyText(text)) island({ e: '📋', text: 'List copied', ms: 1600 });
}
