/* Twodo · focus timer (Pomodoro) with a Live Activity in the island, plus reminders */
'use strict';

const RING_C = 339.29; // 2πr, r = 54
let focusTimer = null;
const focusRemaining = () => { const f = L.focus; if (!f) return 0; return f.running ? Math.max(0, Math.round((f.endsAt - Date.now()) / 1000)) : f.remaining; };
const mmss = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

function setFocusMode(mode) {
  const f = L.focus; if (!f) return;
  f.mode = mode; f.total = (mode === 'focus' ? 25 : 5) * 60; f.remaining = f.total; f.running = false; f.endsAt = null;
}
function openFocus(taskId) {
  if (!L.focus || L.focus.taskId !== taskId) {
    L.focus = { taskId, mode: 'focus', total: 1500, remaining: 1500, endsAt: null, running: false };
  }
  save();
  const el = $('#focus');
  el.innerHTML = `
    <div class="f-top"><button class="nav-btn" data-f="min" type="button">${ic('chevD')}<span>&nbsp;Minimise</span></button><button class="nav-btn" data-f="stop" type="button">End</button></div>
    ${segHTML('fmode', [['focus', 'Focus · 25'], ['break', 'Break · 5']], L.focus.mode, 'f-mode')}
    <div class="f-ring"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="54"/><circle class="bar" id="fBar" cx="60" cy="60" r="54" style="stroke-dasharray:${RING_C}"/></svg>
      <div class="f-time"><b id="fTime">25:00</b><span id="fLbl"></span></div></div>
    <div class="f-task" id="fTask"></div><div class="f-sub" id="fSub"></div>
    <div class="f-ctrl"><button class="side" data-f="plus5" type="button" aria-label="Add 5 minutes">+5</button>
      <button class="main" data-f="toggle" type="button" aria-label="Start or pause" id="fToggle"></button>
      <button class="side" data-f="done" type="button" aria-label="Complete task">${ic('check')}</button></div>`;
  el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
  if (Island.mode === 'live') { Island.mode = 'off'; Island.el.classList.remove('on', 'live'); }
  renderFocus(); ensureFocusTick();
}
function renderFocus() {
  const f = L.focus, el = $('#focus'); if (!f || !el.classList.contains('on')) return;
  const t = D.tasks[f.taskId];
  $('#fTask').textContent = t ? t.title : 'Focus';
  $('#fSub').textContent = t && t.pomos ? `🍅 × ${t.pomos} sessions so far` : f.mode === 'focus' ? 'One thing at a time ✨' : 'Breathe. Stretch. Hydrate.';
  $('#fLbl').textContent = f.running ? (f.mode === 'focus' ? 'Focusing' : 'On a break') : 'Paused';
  $('#fToggle').innerHTML = ic(f.running ? 'pause' : 'play');
  focusTick();
}
function focusTick() {
  const f = L.focus; if (!f) return;
  const r = focusRemaining(), p = f.total ? r / f.total : 0;
  const ft = $('#fTime'); if (ft) ft.textContent = mmss(r);
  const fb = $('#fBar'); if (fb) fb.style.strokeDashoffset = RING_C * (1 - p);
  const lt = $('#liveTime'); if (lt) lt.textContent = mmss(r);
  const lr = $('#liveRing'); if (lr) lr.style.strokeDashoffset = 56.55 * (1 - p);
  if (f.running && r <= 0) finishFocus();
}
function ensureFocusTick() {
  clearInterval(focusTimer);
  focusTimer = setInterval(() => { if (!L.focus) { clearInterval(focusTimer); return; } focusTick(); }, 250);
}
function finishFocus() {
  const f = L.focus; f.running = false; f.endsAt = null; f.remaining = 0;
  blip('chime'); haptic('success');
  if (f.mode === 'focus') {
    const t = D.tasks[f.taskId]; if (t) updateTask(t.id, { pomos: (t.pomos || 0) + 1 });
    sysNotify('Focus session done 🎉', 'Nice work. Time for a 5-minute break.');
    island({ e: '🎉', text: 'Focus session complete', sub: 'Take a 5-minute break' });
    setFocusMode('break');
  } else {
    sysNotify('Break’s over ☕️', 'Ready for another round?');
    island({ e: '☕️', text: 'Break’s over — ready?' });
    setFocusMode('focus');
  }
  save(); renderFocus();
}
function closeFocus() {
  const el = $('#focus'); el.classList.remove('on'); el.setAttribute('aria-hidden', 'true');
  if (L.focus && L.focus.running) showLive();
}
function initFocus() {
  $('#focus').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    const f = L.focus; if (!f) return;
    switch (b.dataset.f) {
      case 'toggle':
        if (f.running) { f.remaining = focusRemaining(); f.running = false; f.endsAt = null; }
        else { if (f.remaining <= 0) setFocusMode(f.mode); f.endsAt = Date.now() + f.remaining * 1000; f.running = true; ensureFocusTick(); }
        haptic('medium'); break;
      case 'plus5':
        if (f.running) f.endsAt += 300e3; else f.remaining += 300;
        f.total += 300; haptic('light'); break;
      case 'done': {
        const id = f.taskId; L.focus = null; save(); closeFocus();
        const t = D.tasks[id]; if (t && !t.done) setTimeout(() => toggleDone(id, { instant: true }), 300);
        return;
      }
      case 'stop': L.focus = null; save(); closeFocus(); hideIsland(); return;
      case 'min': closeFocus(); return;
    }
    save(); renderFocus();
  });
  Island.el.addEventListener('click', e => {
    if (e.target.closest('.ib')) { const fn = Island.onBtn; hideIsland(); if (fn) { fn(); haptic('light'); } return; }
    if (Island.mode === 'live' && L.focus) { openFocus(L.focus.taskId); return; }
    hideIsland();
  });
}
SegHandlers.fmode = v => { setFocusMode(v); save(); renderFocus(); };

/* ---------- Reminders ---------- */
async function sysNotify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) { await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title + body }); return true; }
    new Notification(title, { body, icon: 'icons/icon-192.png' }); return true;
  } catch (e) { return false; }
}
function checkReminders() {
  if (!L.settings.notify) return;
  const now = Date.now();
  for (const t of liveTasks()) {
    if (t.done || !t.due || !t.time || t.assignee === partnerKey()) continue;
    const at = new Date(`${t.due}T${t.time}`).getTime(), key = `${t.id}@${t.due}T${t.time}`;
    if (now >= at && now - at < 3 * 3600e3 && !L.notified[key]) {
      L.notified[key] = now;
      sysNotify(`⏰ ${t.title}`, `Due ${fmtDue(t.due, t.time)}${t.assignee === 'both' ? ' · for both of you' : ''}`);
      if (!document.hidden) island({ e: '⏰', text: t.title, sub: `Due ${fmtTime(t.time)}`, ms: 5000 });
    }
  }
  for (const k in L.notified) if (now - L.notified[k] > 7 * 864e5) delete L.notified[k];
  save();
}
