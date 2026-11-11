/* Twodo · UI primitives: theme, Dynamic Island, sheets, alerts, menus, segmented controls */
'use strict';

/* ---------- Theme ---------- */
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const s = L.settings;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && darkMQ.matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  const acc = s.accent === 'me' ? person(L.me).color : s.accent;
  root.style.setProperty('--accent', `var(--c-${acc || 'blue'})`);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = document.body.classList.contains('launching') ? '#F6528C' : dark ? '#000000' : '#F2F2F7';
}
darkMQ.addEventListener?.('change', applyTheme);

/* ---------- Dynamic Island ---------- */
const Island = { el: null, timer: null, onBtn: null, mode: 'off' };
function island({ e = '✨', text = '', sub = '', btn = '', onBtn = null, ms = 2800 } = {}) {
  const el = Island.el; if (!el) return;
  clearTimeout(Island.timer);
  Island.onBtn = onBtn; Island.mode = 'toast';
  el.innerHTML = `<span class="e">${e}</span><span class="txt">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><button class="ib" type="button">${esc(btn)}</button>`;
  el.classList.remove('live');
  el.classList.add('on', 'toast');
  el.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  Island.timer = setTimeout(hideIsland, ms + (btn ? 1800 : 0));
}
function hideIsland() {
  clearTimeout(Island.timer); Island.onBtn = null;
  if (L.focus && L.focus.running && !$('#focus').classList.contains('on')) return showLive();
  Island.mode = 'off';
  Island.el.classList.remove('on', 'toast', 'live');
}
function showLive() {
  const f = L.focus; if (!f) return;
  const t = D.tasks[f.taskId];
  Island.mode = 'live';
  Island.el.classList.remove('toast'); Island.el.classList.add('on', 'live');
  Island.el.innerHTML = `<span class="e">${f.mode === 'focus' ? '⏱️' : '☕️'}</span><span class="txt"><span class="ltm" id="liveTime">--:--</span> ${esc(t ? t.title : 'Focus')}</span>
    <svg class="lr" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" style="stroke:rgba(255,255,255,.2)"/><circle id="liveRing" cx="12" cy="12" r="9" style="stroke:var(--accent);stroke-dasharray:56.55;stroke-linecap:round"/></svg>`;
  focusTick();
}

/* ---------- Alerts ---------- */
function confirmDialog({ title, message = '', ok = 'OK', cancel = 'Cancel', destructive = false }) {
  return new Promise(res => {
    const w = document.createElement('div');
    w.className = 'alert-wrap';
    w.innerHTML = `<div class="alert" role="alertdialog" aria-label="${esc(title)}"><h4>${esc(title)}</h4><p>${esc(message)}</p>
      <div class="btns">${cancel === null ? '' : `<button data-r="0">${esc(cancel)}</button>`}<button data-r="1" class="${destructive ? 'red' : 'b'}">${esc(ok)}</button></div></div>`;
    document.body.append(w);
    requestAnimationFrame(() => w.classList.add('on'));
    haptic('warn');
    w.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      w.classList.remove('on'); setTimeout(() => w.remove(), 260);
      res(b.dataset.r === '1');
    });
  });
}

/* ---------- Segmented control ---------- */
const SegHandlers = {};
function segHTML(name, opts, val, cls = '') {
  const i = Math.max(0, opts.findIndex(o => String(o[0]) === String(val)));
  return `<div class="seg ${cls}" data-seg="${name}" role="tablist" style="--n:${opts.length};--i:${i}"><span class="thumb"></span>${
    opts.map(([v, l]) => `<button type="button" role="tab" data-v="${esc(v)}" class="${String(v) === String(val) ? 'on' : ''}" aria-selected="${String(v) === String(val)}">${l}</button>`).join('')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.seg button'); if (!b) return;
  const seg = b.parentElement, opts = $$(':scope > button', seg), i = opts.indexOf(b);
  seg.style.setProperty('--i', i);
  opts.forEach(o => { o.classList.toggle('on', o === b); o.setAttribute('aria-selected', o === b); });
  haptic('light');
  const h = SegHandlers[seg.dataset.seg]; if (h) h(b.dataset.v, seg);
});

/* ---------- Sheets (iOS card modals with drag-to-dismiss) ---------- */
const Sheet = { cur: null, ignorePop: false };
function openSheet({ title = '', body = '', left = '', right = 'Done', tall = false, onMount, onClose, onRight } = {}) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (Island.mode === 'toast') hideIsland();
  const replacing = !!Sheet.cur;
  if (replacing) closeSheet({ history: false, keepApp: true });
  const layer = $('#layer');
  const bd = document.createElement('div'); bd.className = 'backdrop';
  const sh = document.createElement('div');
  sh.className = 'sheet' + (tall ? ' tall' : '');
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title);
  sh.innerHTML = `<div class="sheet-head"><div class="grab"></div><div class="sheet-bar"><div>${left}</div><h3>${esc(title)}</h3><div>${
    right ? `<button class="nav-btn b" data-s="done" type="button">${esc(right)}</button>` : ''}</div></div></div><div class="sheet-body">${body}</div>`;
  layer.append(bd, sh);
  const S = { sh, bd, onClose };
  Sheet.cur = S;
  document.body.style.setProperty('--sp', '1');
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('on'); sh.classList.add('open'); }));
  bd.addEventListener('click', () => closeSheet());
  const doneBtn = sh.querySelector('[data-s="done"]');
  if (doneBtn) doneBtn.addEventListener('click', () => (onRight ? onRight() : closeSheet()));
  bindSheetDrag(S);
  if (!replacing) history.pushState({ d: Nav.stack.length, s: 1 }, '');
  if (onMount) onMount(sh);
  return sh;
}
function closeSheet({ history: h = true, keepApp = false } = {}) {
  const S = Sheet.cur; if (!S) return;
  Sheet.cur = null;
  if (S.sh.contains(document.activeElement)) document.activeElement.blur();
  S.sh.classList.remove('open'); S.bd.classList.remove('on');
  if (!keepApp) document.body.classList.remove('sheet-open');
  setTimeout(() => { S.sh.remove(); S.bd.remove(); }, 560);
  if (S.onClose) S.onClose();
  if (h && history.state && history.state.s) { Sheet.ignorePop = true; history.back(); }
}
function bindSheetDrag(S) {
  const { sh } = S, head = sh.querySelector('.sheet-head'), body = sh.querySelector('.sheet-body');
  let y0 = null, dy = 0, t0 = 0, active = false;
  const start = y => { y0 = y; dy = 0; t0 = performance.now(); active = false; };
  const move = (y, e) => {
    if (y0 === null) return;
    dy = Math.max(0, y - y0);
    if (!active && dy > 6) { active = true; document.body.classList.add('sheet-drag'); }
    if (!active) return;
    if (e && e.cancelable) e.preventDefault();
    sh.style.transform = `translateY(${dy}px)`;
    document.body.style.setProperty('--sp', String(clamp(1 - dy / sh.offsetHeight, 0, 1)));
  };
  const end = () => {
    if (y0 === null) return;
    const v = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    document.body.classList.remove('sheet-drag');
    sh.style.transform = '';
    if (active && (dy > 130 || v > 0.6)) closeSheet();
    else document.body.style.setProperty('--sp', '1');
    active = false;
  };
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    start(e.clientY);
  });
  head.addEventListener('pointermove', e => move(e.clientY, e));
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  body.addEventListener('touchstart', e => {
    if (body.scrollTop <= 0 && !e.target.closest('input, textarea, select, .seg, .picker, .colors')) start(e.touches[0].clientY);
    else y0 = null;
  }, { passive: true });
  body.addEventListener('touchmove', e => {
    if (y0 === null) return;
    const y = e.touches[0].clientY;
    if (!active && y - y0 < -2) { y0 = null; return; }
    move(y, e);
  }, { passive: false });
  body.addEventListener('touchend', end);
  body.addEventListener('touchcancel', end);
}

/* ---------- Context menus / popovers ---------- */
const Menu = { el: null, open: false, onPick: null, armAt: 0, taskId: null };
function showMenu({ rect, preview = '', html, onPick, taskId = null, align = 'left' }) {
  const m = Menu.el;
  Menu.open = true; Menu.onPick = onPick; Menu.taskId = taskId; Menu.armAt = performance.now() + 300;
  m.className = 'on' + (preview ? '' : ' plain');
  m.innerHTML = `<div class="mbg"></div>${preview ? `<div class="mprev" style="left:${rect.left}px;top:${rect.top}px;width:${rect.width}px">${preview}</div>` : ''}<div class="mlist" role="menu">${html}</div>`;
  placeMenu(rect, !!preview, align);
  requestAnimationFrame(() => {
    m.classList.add('show');
    const p = m.querySelector('.mprev');
    if (p) p.style.transform = `translateY(${Menu.shift || 0}px) scale(1.02)`;
  });
}
// Notch / home-indicator insets in px (env() values resolved by the browser)
function safeInsets() {
  let el = safeInsets.el;
  if (!el || !el.isConnected) {
    el = safeInsets.el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)';
    document.body.append(el);
  }
  const cs = getComputedStyle(el), n = v => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}
// Keep the lifted preview and its menu fully on screen together (like iOS): cap the menu, clip a very tall preview.
function placeMenu(rect, withPreview, align) {
  const m = Menu.el, list = m.querySelector('.mlist'), prev = m.querySelector('.mprev');
  const vh = window.visualViewport ? visualViewport.height : innerHeight, vw = innerWidth, ins = safeInsets();
  const gap = 10, margin = 10, topMin = ins.top + margin, botMax = vh - (document.body.classList.contains('kb') ? 0 : ins.bottom) - margin, room = botMax - topMin;
  list.style.maxHeight = 'none';
  let mh = list.offsetHeight; const mw = list.offsetWidth;
  let top; Menu.shift = 0;
  if (withPreview) {
    let ph = rect.height;
    if (ph + gap + mh > room) {
      // too much for the screen: clip a tall preview (not below ~40% of the room), then let the menu scroll
      ph = Math.min(ph, Math.max(Math.max(56, room * 0.4), room - gap - mh));
      mh = Math.min(mh, room - gap - ph);
      if (ph < rect.height) { prev.style.maxHeight = ph + 'px'; prev.classList.add('clip'); }
    }
    const pTop = Math.max(topMin, Math.min(rect.top, botMax - mh - gap - ph));
    Menu.shift = pTop - rect.top;
    top = pTop + ph + gap;
  } else {
    mh = Math.min(mh, room);
    top = rect.bottom + 6;
    if (top + mh > botMax) top = rect.top - 6 - mh;
    top = Math.max(topMin, Math.min(top, botMax - mh));
  }
  list.style.maxHeight = mh + 'px';
  let left = align === 'right' ? rect.right - mw : rect.left;
  left = clamp(left, ins.left + margin, vw - ins.right - mw - margin);
  list.style.top = top + 'px'; list.style.left = left + 'px';
  list.style.transformOrigin = `${align === 'right' ? 'right' : 'left'} ${top < rect.top ? 'bottom' : 'top'}`;
}
function closeMenu() {
  if (!Menu.open) return;
  Menu.open = false;
  const m = Menu.el;
  m.classList.remove('show');
  const p = m.querySelector('.mprev'); if (p) p.style.transform = '';
  setTimeout(() => { if (!Menu.open) { m.className = ''; m.innerHTML = ''; } }, 320);
}
function initMenu() {
  Menu.el = $('#menu');
  Menu.el.addEventListener('click', e => {
    if (performance.now() < Menu.armAt) return;
    const b = e.target.closest('[data-m]');
    if (b) {
      const res = Menu.onPick ? Menu.onPick(b.dataset.m, b.dataset.v, b) : null;
      if (res !== 'keep') closeMenu();
      haptic('light');
      return;
    }
    if (e.target.closest('.mprev') && Menu.taskId) { const id = Menu.taskId; closeMenu(); openTaskSheet(id); return; }
    if (!e.target.closest('.mlist')) closeMenu();
  });
}
