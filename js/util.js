/* Twodo · utilities, icons, feedback (haptics, sound, confetti) */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayStr = () => ymd(new Date());
const dayDiff = (a, b) => Math.round((fromYmd(a) - fromYmd(b)) / 864e5);
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const isTouch = matchMedia('(hover: none)').matches;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const firstWord = s => String(s || '').trim().split(/\s+/)[0] || '';
const initial = n => (Array.from(String(n || '?').trim())[0] || '?').toUpperCase();
const shortName = (n, max = 7) => { const f = firstWord(n); return f.length > max ? f.slice(0, max - 1) + '…' : f; };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PALETTE = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'brown', 'gray'];
const EMOJIS = ['📥', '🛒', '🏠', '✨', '🎁', '💼', '📚', '💪', '🍳', '✈️', '🎬', '💡', '🧹', '💊', '🐶', '🌱',
  '🎉', '💰', '🎮', '🎵', '📸', '🚗', '❤️', '⭐️', '🧺', '🍿', '🏖️', '🛠️', '📝', '🌙', '☕️', '🎨'];
const REPEATS = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly' };
const PRIO_COLOR = ['', 'blue', 'orange', 'red'];
const PRIO_NAME = ['None', 'Low', 'Medium', 'High'];

/* ---------- Icons (hand-drawn, SF Symbols-ish) ---------- */
const ICONS = {
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<path d="M19.10 9.90 L21.57 10.40 L21.57 13.60 L19.10 14.10 L18.50 15.53 L19.90 17.63 L17.63 19.90 L15.53 18.50 L14.10 19.10 L13.60 21.57 L10.40 21.57 L9.90 19.10 L8.47 18.50 L6.37 19.90 L4.10 17.63 L5.50 15.53 L4.90 14.10 L2.43 13.60 L2.43 10.40 L4.90 9.90 L5.50 8.47 L4.10 6.37 L6.37 4.10 L8.47 5.50 L9.90 4.90 L10.40 2.43 L13.60 2.43 L14.10 4.90 L15.53 5.50 L17.63 4.10 L19.90 6.37 L18.50 8.47Z"/><circle cx="12" cy="12" r="3.1"/>',
  todo: '<rect x="4" y="4" width="16" height="16" rx="5.5"/><path d="M8.6 12.3l2.3 2.3 4.6-4.9"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevD: '<path d="M5 9l7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrowUp: '<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  more: '<circle cx="12" cy="12" r="9.5"/><circle cx="7.6" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="16.4" cy="12" r=".9" fill="currentColor"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  calnext: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 15.5h5M12.5 13.5l2 2-2 2"/>',
  sunrise: '<path d="M12 3.5v3M5.6 8l1.4 1.4M18.4 8L17 9.4M3 18h18M7 18a5 5 0 0110 0M8 21h8"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  sofa: '<path d="M5 11V8.5A2.5 2.5 0 017.5 6h9A2.5 2.5 0 0119 8.5V11"/><path d="M3 12.5a1.8 1.8 0 013.5 0V15h11v-2.5a1.8 1.8 0 013.5 0V18H3z"/><path d="M5 18v2M19 18v2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  reply: '<path d="M9.5 5L4 10.5 9.5 16"/><path d="M4 10.5h9.5a6.5 6.5 0 016.5 6.5v1.5"/>',
  repeat: '<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 015-5h11"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 01-5 5H4"/>',
  flag: '<path d="M5 21V4.5M5 4.5h11.5l-2 4.25 2 4.25H5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0115 0"/>',
  heart: '<path d="M12 20.3s-7.8-4.6-7.8-10.3A4.4 4.4 0 0112 7.2a4.4 4.4 0 017.8 2.8c0 5.7-7.8 10.3-7.8 10.3z"/>',
  pin: '<path d="M9 3.5h6l-1 6 3.5 3.5V15h-11v-2l3.5-3.5z"/><path d="M12 15v6"/>',
  trash: '<path d="M4 7h16M10 3.5h4M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tray: '<path d="M3.5 13.5L6 5.5h12l2.5 8V19a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 19z"/><path d="M3.5 13.5h5l1 2.5h5l1-2.5h5"/>',
  tag: '<path d="M3.5 12.5v-8a1 1 0 011-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>',
  share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12v7.5a1 1 0 001 1h12a1 1 0 001-1V12"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  xcircle: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M9 9l6 6M15 9l-6 6" style="stroke:var(--cell)"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 018 0v3"/>',
  note: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M9 11h7M9 14.5h7M9 18h4"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.1" fill="currentColor"/><circle cx="4.8" cy="12" r="1.1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1.1" fill="currentColor"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V5.5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2h3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.5 4.5 0 01-.5 10z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  chat: '<path d="M12 3.8c-5.1 0-9.2 3.4-9.2 7.6 0 2.4 1.3 4.5 3.4 5.9-.2 1.4-.9 2.6-1.9 3.5 2 .1 3.9-.6 5.3-1.8.8.2 1.6.3 2.4.3 5.1 0 9.2-3.4 9.2-7.6S17.1 3.8 12 3.8z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M4 10.8L12 4l8 6.8V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z"/>',
  sliders: '<path d="M4 7h9M18 7h2M4 17h3M11 17h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.5" cy="17" r="2.3"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 015.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0120 8.5V18a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18z"/><circle cx="12" cy="13" r="3.5"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2v.5h5V16c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-1.5V4a1.5 1.5 0 013 0v6m0-4.5a1.5 1.5 0 013 0V12m0-3.5a1.5 1.5 0 013 0V15a6.5 6.5 0 01-6.5 6.5h-1A6 6 0 017.6 19L4.5 14a1.6 1.6 0 012.6-1.8L8 13.5"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Haptics ---------- */
// Android: Vibration API. iOS 18+: toggling a hidden <input switch> produces a system haptic.
function haptic(kind = 'light') {
  if (typeof L !== 'undefined' && !L.settings.haptics) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate({ light: 8, medium: 14, heavy: 22, success: [8, 50, 12], warn: [14, 40, 14] }[kind] || 8);
    } else {
      const h = document.getElementById('haptic');
      if (h) h.click();
    }
  } catch (e) { /* ignore */ }
}

/* ---------- Sounds (tiny WebAudio blips, no files) ---------- */
let audioCtx = null;
function blip(kind = 'done') {
  if (typeof L !== 'undefined' && !L.settings.sounds) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const notes = { done: [880, 1318.5], add: [660], chime: [659.3, 880, 1108.7], pop: [520] }[kind] || [660];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const s = t + i * 0.075;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(kind === 'add' ? 0.05 : 0.09, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (kind === 'chime' ? 0.5 : 0.2));
      o.connect(g).connect(audioCtx.destination);
      o.start(s); o.stop(s + 0.55);
    });
  } catch (e) { /* ignore */ }
}

/* ---------- Confetti ---------- */
function confetti() {
  if ((typeof L !== 'undefined' && !L.settings.confetti) || reducedMotion.matches) return;
  const c = document.createElement('canvas'); c.id = 'confetti'; document.body.append(c);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const cols = ['#F2A3C0', '#F5BE95', '#F3DA8F', '#9AD8B3', '#9DB7F0', '#C9A9EA', '#A6DAF2'];
  const P = Array.from({ length: 160 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.32,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4,
    r: Math.random() * 6 + 5, c: cols[(Math.random() * cols.length) | 0],
    a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, rect: Math.random() < 0.6,
  }));
  const t0 = performance.now(), dur = 2800;
  (function frame(now) {
    const t = now - t0;
    x.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.33; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.a += p.va;
      x.save(); x.globalAlpha = Math.max(0, 1 - t / dur); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c;
      if (p.rect) x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { x.beginPath(); x.arc(0, 0, p.r / 2.6, 0, 7); x.fill(); }
      x.restore();
    }
    if (t < dur) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ---------- Files & clipboard ---------- */
function downloadFile(name, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
    ta.remove(); return ok;
  }
}

/* A button that doesn't steal the keyboard: on iOS, tapping a button closes the keyboard (the field loses focus) before the click.
   While a field is focused we cancel the touch so focus stays, and run the action ourselves on release. */
function tapKeep(btn, fn, field) {
  let own = false, x0 = 0, y0 = 0;
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('touchstart', e => {
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
    own = !!field && document.activeElement === field;
    if (own && e.cancelable) e.preventDefault();
  }, { passive: false });
  btn.addEventListener('touchend', e => {
    if (!own) return; own = false;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - x0, t.clientY - y0) > 14) return;
    if (e.cancelable) e.preventDefault();
    fn(e);
  }, { passive: false });
  btn.addEventListener('touchcancel', () => { own = false; });
  btn.addEventListener('click', fn);
}
