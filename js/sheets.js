/* Twodo · task details and list editor sheets, calendar export, sharing */
'use strict';

/* ---------- Task details ---------- */
let sheetTaskId = null;
function subsHTML(t) {
  return (t.subtasks || []).map(s => `<div class="sub-row ${s.done ? 'checked' : ''}" data-sid="${esc(s.id)}">
      <button class="chk" data-d="subdone" type="button" aria-label="Toggle subtask">${ic('check')}</button>
      <input class="inp" data-d="subtitle" value="${esc(s.title)}" aria-label="Subtask">
      <button class="clear" data-d="subdel" type="button" aria-label="Remove subtask">${ic('x')}</button></div>`).join('') +
    `<div class="sub-row sub-add">${ic('plus')}<input class="inp" data-d="subadd" placeholder="Add subtask" enterkeyhint="done" aria-label="Add subtask"></div>`;
}
function openTaskSheet(id) {
  const t = D.tasks[id]; if (!t || t.deleted) return;
  sheetTaskId = id;
  const l = listOf(t);
  const listOpts = lists().map(x => `<option value="${esc(x.id)}" ${x.id === l.id ? 'selected' : ''}>${esc(x.emoji + ' ' + x.name)}</option>`).join('');
  const repOpts = `<option value="">Never</option>` + Object.entries(REPEATS).map(([k, v]) => `<option value="${k}" ${t.repeat === k ? 'selected' : ''}>${v}</option>`).join('');
  const sq = (c, i) => `<span class="sq" style="--c:var(--c-${c})">${ic(i)}</span>`;
  const created = new Date(t.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const body = `
    <div class="d-head ${t.done ? 'checked' : ''}"><button class="chk" data-d="done" type="button" aria-label="Complete">${ic('check')}</button>
      <textarea class="d-tt" data-d="title" rows="1" aria-label="Title">${esc(t.title)}</textarea></div>
    <div class="group"><textarea class="d-notes" data-d="notes" rows="2" placeholder="Notes" aria-label="Notes">${esc(t.notes)}</textarea></div>
    <div class="group">
      <div class="cell">${sq('red', 'cal')}<span class="grow">Date</span><input type="date" class="pill-inp" data-d="due" value="${t.due || ''}" aria-label="Date"><button class="clear" data-d="clearDue" type="button" ${t.due ? '' : 'hidden'} aria-label="Clear date">${ic('xcircle')}</button></div>
      <div class="cell">${sq('blue', 'clock')}<span class="grow">Time</span><input type="time" class="pill-inp" data-d="time" value="${t.time || ''}" aria-label="Time"><button class="clear" data-d="clearTime" type="button" ${t.time ? '' : 'hidden'} aria-label="Clear time">${ic('xcircle')}</button></div>
      <div class="cell">${sq('gray', 'repeat')}<span class="grow">Repeat</span><select class="sel" data-d="repeat" aria-label="Repeat">${repOpts}</select></div>
    </div>
    <div class="group">
      <div class="cell">${sq('orange', 'flag')}<span class="grow">Priority</span>${segHTML('dprio', [['0', 'None'], ['1', '!'], ['2', '!!'], ['3', '!!!']], String(t.priority || 0))}</div>
      <div class="cell">${sq('pink', 'person')}<span class="grow">For</span>${segHTML('dassign', [['', 'Any'], [L.me, esc(shortName(myName(), 6))], [partnerKey(), esc(shortName(ptName(), 6))], ['both', 'Us']], t.assignee || '')}</div>
    </div>
    <div class="group">
      <div class="cell"><span class="sq" data-d="listsq" style="--c:var(--c-${l.color})">${ic('list')}</span><span class="grow">List</span><select class="sel" data-d="list" aria-label="List">${listOpts}</select></div>
      <div class="cell">${sq('purple', 'tag')}<input class="inp" data-d="tags" placeholder="Tags, e.g. #work #fun" value="${esc((t.tags || []).map(x => '#' + x).join(' '))}" autocapitalize="off" aria-label="Tags"></div>
      <div class="cell">${sq('yellow', 'pin')}<span class="grow">Pinned</span><input type="checkbox" class="switch" data-d="pinned" ${t.pinned ? 'checked' : ''} aria-label="Pinned"></div>
    </div>
    <div class="sec-h sub">Subtasks</div>
    <div class="group subs">${subsHTML(t)}</div>
    <div class="group">
      <button class="cell" data-d="focus" type="button">${sq('indigo', 'timer')}<span class="grow">Start focus timer</span><span class="val">${t.pomos ? '🍅 ' + t.pomos : ''}</span>${ic('chevR', 'chev')}</button>
      <button class="cell" data-d="ics" type="button">${sq('red', 'bell')}<span class="grow">Add to Calendar (alert)</span>${ic('chevR', 'chev')}</button>
      <button class="cell" data-d="share" type="button">${sq('blue', 'share')}<span class="grow">Share</span>${ic('chevR', 'chev')}</button>
      <button class="cell" data-d="dup" type="button">${sq('gray', 'copy')}<span class="grow">Duplicate</span>${ic('chevR', 'chev')}</button>
    </div>
    <div class="group"><button class="cell red" data-d="delete" type="button">Delete Task</button></div>
    <div class="meta-foot">Added by ${esc(whoName(t.createdBy))} · ${esc(created)}${t.done && t.doneAt ? `<br>Completed by ${esc(whoName(t.doneBy))} · ${esc(new Date(t.doneAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}</div>`;

  openSheet({ title: 'Details', body, tall: true, onMount: sh => bindTaskSheet(sh, id), onClose: () => { sheetTaskId = null; } });
}
SegHandlers.dprio = v => sheetTaskId && updateTask(sheetTaskId, { priority: Number(v) });
SegHandlers.dassign = v => sheetTaskId && updateTask(sheetTaskId, { assignee: v || null });

function bindTaskSheet(sh, id) {
  const T = () => D.tasks[id];
  const q = k => sh.querySelector(`[data-d="${k}"]`);
  const autosize = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  const title = q('title'), notes = q('notes');
  requestAnimationFrame(() => { autosize(title); autosize(notes); });
  let tT;
  title.addEventListener('input', () => { autosize(title); clearTimeout(tT); tT = setTimeout(() => { const v = title.value.trim(); if (v) updateTask(id, { title: v.replace(/\n/g, ' ') }); }, 250); });
  title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  let nT;
  notes.addEventListener('input', () => { autosize(notes); clearTimeout(nT); nT = setTimeout(() => updateTask(id, { notes: notes.value }), 300); });
  const syncClears = () => { q('clearDue').hidden = !T().due; q('clearTime').hidden = !T().time; };
  q('due').addEventListener('change', e => { updateTask(id, { due: e.target.value || null, ...(e.target.value ? {} : { time: null }) }); if (!e.target.value) q('time').value = ''; syncClears(); });
  q('time').addEventListener('change', e => {
    const patch = { time: e.target.value || null };
    if (e.target.value && !T().due) { patch.due = todayStr(); q('due').value = patch.due; }
    updateTask(id, patch); syncClears();
  });
  q('clearDue').addEventListener('click', () => { updateTask(id, { due: null, time: null, repeat: null }); q('due').value = ''; q('time').value = ''; q('repeat').value = ''; syncClears(); haptic('light'); });
  q('clearTime').addEventListener('click', () => { updateTask(id, { time: null }); q('time').value = ''; syncClears(); haptic('light'); });
  q('repeat').addEventListener('change', e => {
    const patch = { repeat: e.target.value || null };
    if (e.target.value && !T().due) { patch.due = todayStr(); q('due').value = patch.due; }
    updateTask(id, patch); syncClears();
  });
  q('list').addEventListener('change', e => { updateTask(id, { listId: e.target.value }); q('listsq').style.setProperty('--c', `var(--c-${listOf(T()).color})`); });
  q('tags').addEventListener('change', e => {
    const tags = [...new Set(e.target.value.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean))];
    updateTask(id, { tags }); e.target.value = tags.map(x => '#' + x).join(' ');
  });
  q('pinned').addEventListener('change', e => { updateTask(id, { pinned: e.target.checked }); haptic('light'); });
  q('done').addEventListener('click', () => {
    const t = T(), done = !t.done;
    if (done && t.repeat) { closeSheet(); toggleDone(id, { instant: true }); return; }
    updateTask(id, done ? { done: true, doneAt: Date.now(), doneBy: L.me } : { done: false, doneAt: null, doneBy: null });
    sh.querySelector('.d-head').classList.toggle('checked', done);
    if (done) { haptic('success'); blip('done'); }
  });

  // Subtasks
  const subs = sh.querySelector('.subs');
  const rerenderSubs = focusAdd => { subs.innerHTML = subsHTML(T()); if (focusAdd) subs.querySelector('[data-d="subadd"]').focus(); };
  subs.addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const sid = b.closest('[data-sid]') && b.closest('[data-sid]').dataset.sid;
    const t = T();
    if (b.dataset.d === 'subdone') {
      const s = t.subtasks.find(x => x.id === sid); s.done = !s.done; commit(t);
      b.closest('.sub-row').classList.toggle('checked', s.done); haptic('light'); if (s.done) blip('pop');
    } else if (b.dataset.d === 'subdel') {
      t.subtasks = t.subtasks.filter(x => x.id !== sid); commit(t); rerenderSubs();
    }
  });
  subs.addEventListener('change', e => {
    if (e.target.dataset.d !== 'subtitle') return;
    const t = T(), s = t.subtasks.find(x => x.id === e.target.closest('[data-sid]').dataset.sid);
    if (s) { s.title = e.target.value.trim() || s.title; commit(t); }
  });
  subs.addEventListener('keydown', e => {
    if (e.target.dataset.d !== 'subadd' || e.key !== 'Enter') return;
    e.preventDefault();
    const v = e.target.value.trim(); if (!v) return;
    const t = T(); t.subtasks = [...(t.subtasks || []), { id: uid(), title: v, done: false }]; commit(t);
    rerenderSubs(true); haptic('light');
  });

  sh.querySelector('.sheet-body').addEventListener('click', e => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    switch (b.dataset.d) {
      case 'focus': closeSheet(); setTimeout(() => openFocus(id), 250); break;
      case 'ics': downloadICS(T()); break;
      case 'share': shareTask(T()); break;
      case 'dup': { const n = duplicateTask(id); closeSheet(); if (n) setTimeout(() => openTaskSheet(n.id), 450); break; }
      case 'delete': closeSheet(); setTimeout(() => deleteTask(id), 300); break;
    }
  });
}

/* ---------- Calendar (.ics) & sharing ---------- */
function icsFor(t) {
  const e = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  let start, end, trig;
  if (t.time) { const s = new Date(`${t.due}T${t.time}`); start = `DTSTART:${f(s)}`; end = `DTEND:${f(new Date(s.getTime() + 30 * 60e3))}`; trig = 'TRIGGER:PT0M'; }
  else { start = `DTSTART;VALUE=DATE:${t.due.replace(/-/g, '')}`; end = `DTEND;VALUE=DATE:${ymd(addDays(fromYmd(t.due), 1)).replace(/-/g, '')}`; trig = 'TRIGGER:PT9H'; }
  const rr = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[t.repeat];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Twodo//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${t.id}@twodo`, `DTSTAMP:${stamp}`,
    start, end, `SUMMARY:${e(t.title)}`, t.notes ? `DESCRIPTION:${e(t.notes)}` : '', rr ? `RRULE:${rr}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e(t.title)}`, trig, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
function downloadICS(t) {
  if (!t.due) { island({ e: '📅', text: 'Set a date first', sub: 'Then you can add it to your calendar', ms: 2200 }); return; }
  const name = (t.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task') + '.ics';
  downloadFile(name, 'text/calendar', icsFor(t));
  island({ e: '📅', text: 'Calendar event created', sub: 'Open it to add the alert', ms: 2200 });
}
async function shareTask(t) {
  const text = `${t.title}${t.due ? `\n📅 ${fmtDue(t.due, t.time)}` : ''}${t.notes ? `\n\n${t.notes}` : ''}`;
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  if (await copyText(text)) island({ e: '📋', text: 'Copied to clipboard', ms: 1600 });
}

/* ---------- List editor ---------- */
function openListSheet(id = null) {
  const ex = id ? D.lists[id] : null;
  const st = { name: ex ? ex.name : '', emoji: ex ? ex.emoji : '📝', color: ex ? ex.color : 'blue', priv: !!(ex && ex.private) };
  const body = `
    <div class="big-ic" style="--c:var(--c-${st.color})">${esc(st.emoji)}</div>
    <input class="name-inp" id="lname" placeholder="List name" value="${esc(st.name)}" maxlength="40" style="--c:var(--c-${st.color})" aria-label="List name">
    <div class="group"><div class="colors" id="lcolors">${PALETTE.map(c => `<button type="button" data-c="${c}" style="--c:var(--c-${c})" class="${c === st.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="group"><div class="picker" id="lemoji">${EMOJIS.map(e => `<button type="button" class="${e === st.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
    ${!ex || ex.id !== 'inbox' ? `<div class="group"><div class="cell"><span class="sq" style="--c:var(--c-purple)">${ic('lock')}</span><span class="grow">Secret list</span><input type="checkbox" class="switch" id="lpriv" ${st.priv ? 'checked' : ''} aria-label="Secret list"></div></div>
    <p class="note-s">Secret lists stay on this phone and never sync — perfect for planning surprises 🎁</p>` : ''}
    ${ex && ex.id !== 'inbox' ? `<div class="group"><button class="cell red" id="ldel" type="button">Delete List</button></div>` : ''}`;
  const saveList = () => {
    const name = $('#lname').value.trim();
    if (!name) { $('#lname').focus(); haptic('warn'); return; }
    if (ex) {
      const privChanged = ex.private !== st.priv;
      Object.assign(ex, { name, emoji: st.emoji, color: st.color, private: st.priv }); commit(ex);
      if (privChanged) liveTasks().filter(t => t.listId === ex.id).forEach(t => commit(t, { silent: true })); // retract from / re-share with partner
      closeSheet();
    } else {
      const l = mkList({ name, emoji: st.emoji, color: st.color, private: st.priv });
      D.lists[l.id] = l; commit(l);
      closeSheet(); setTimeout(() => openList(l.id), 350);
    }
    haptic('success');
  };
  openSheet({
    title: ex ? 'Edit List' : 'New List', body, right: ex ? 'Done' : 'Add', onRight: saveList,
    left: `<button class="nav-btn" data-s="cancel" type="button">Cancel</button>`,
    onMount: sh => {
      const big = sh.querySelector('.big-ic'), nameI = sh.querySelector('#lname');
      sh.querySelector('[data-s="cancel"]').addEventListener('click', () => closeSheet());
      nameI.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveList(); } });
      sh.querySelector('#lcolors').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        st.color = b.dataset.c; $$('#lcolors button', sh).forEach(x => x.classList.toggle('on', x === b));
        big.style.setProperty('--c', `var(--c-${st.color})`); nameI.style.setProperty('--c', `var(--c-${st.color})`); haptic('light');
      });
      sh.querySelector('#lemoji').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        st.emoji = b.textContent; $$('#lemoji button', sh).forEach(x => x.classList.toggle('on', x === b));
        big.textContent = st.emoji; big.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' }); haptic('light');
      });
      const pv = sh.querySelector('#lpriv'); if (pv) pv.addEventListener('change', () => { st.priv = pv.checked; haptic('light'); });
      const del = sh.querySelector('#ldel');
      if (del) del.addEventListener('click', async () => {
        const n = liveTasks().filter(t => t.listId === ex.id).length;
        if (!(await confirmDialog({ title: `Delete “${ex.name}”?`, message: n ? `This also deletes its ${n} task${n === 1 ? '' : 's'}.` : 'This can’t be undone.', ok: 'Delete', destructive: true }))) return;
        ex.deleted = true; commit(ex);
        liveTasks().filter(t => t.listId === ex.id).forEach(t => { t.deleted = true; commit(t, { silent: true }); });
        closeSheet();
        if (topView()._spec.type === 'list' && topView()._spec.id === ex.id) setTimeout(popView, 300);
        island({ e: '🗑️', text: `Deleted ${ex.name}` });
      });
      if (!ex) setTimeout(() => nameI.focus(), 380);
    },
  });
}
