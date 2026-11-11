/* Twodo · state, persistence and data helpers */
'use strict';

const KD = 'twodo:data', KL = 'twodo:local';

const defaultLocal = () => ({
  me: 'a', onboarded: false,
  settings: {
    theme: 'auto', accent: 'me', haptics: true, sounds: true, confetti: true, notify: false,
    dmy: !/^en-(US|PH|CA)/i.test(navigator.language || ''),
  },
  sync: { url: '', code: '' },
  view: {}, notified: {}, focus: null, tips: {},
});

// D = synced data, L = this device only
let D = { tasks: {}, lists: {}, people: null };
let L = defaultLocal();

/* ---------- Never trust stored or synced records: anything shown in the page is checked here first ----------
   Colours must come from the palette, numbers must be numbers, photos must be small inline images. */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/, PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const cStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const cColor = (c, d) => (PALETTE.includes(c) ? c : d);
const cNum = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const cEmoji = v => { // one emoji (a single character as the user sees it)
  const t = cStr(v, 32).trim(); if (!t) return '';
  try { return new Intl.Segmenter().segment(t)[Symbol.iterator]().next().value.segment; } catch (e) { return [...t].slice(0, 2).join(''); }
};
function cleanPerson(p, d) {
  if (!p || typeof p !== 'object') return { ...d };
  const o = { ...p, name: cStr(p.name, 40).trim() || d.name, color: cColor(p.color, d.color) };
  if (!(typeof p.photo === 'string' && p.photo.length < 150000 && PHOTO_RE.test(p.photo))) delete o.photo;
  if (o.uid !== undefined && typeof o.uid !== 'string') delete o.uid;
  return o;
}
function cleanRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (r.kind === 'people' || r.id === 'people') {
    return { ...r, kind: 'people', id: 'people', a: cleanPerson(r.a, { name: 'Me', color: 'blue' }), b: cleanPerson(r.b, { name: 'Partner', color: 'pink' }), updatedAt: cNum(r.updatedAt) };
  }
  if (r.kind === 'list') {
    return { ...r, id: cStr(r.id, 80), name: cStr(r.name, 60), emoji: cEmoji(r.emoji) || '📝', color: cColor(r.color, 'blue'),
      private: !!r.private, deleted: !!r.deleted, order: cNum(r.order), createdAt: cNum(r.createdAt), updatedAt: cNum(r.updatedAt) };
  }
  if (r.kind === 'task') {
    const o = { ...r, id: cStr(r.id, 80), listId: cStr(r.listId, 80) || 'inbox', notes: cStr(r.notes, 20000),
      priority: [1, 2, 3].includes(r.priority) ? r.priority : 0, pomos: Math.max(0, Math.min(9999, Math.floor(cNum(r.pomos)))),
      due: typeof r.due === 'string' && DAY_RE.test(r.due) ? r.due : null, time: typeof r.time === 'string' && TIME_RE.test(r.time) ? r.time : null,
      repeat: typeof r.repeat === 'string' && Object.prototype.hasOwnProperty.call(REPEATS, r.repeat) ? r.repeat : null,
      assignee: ['a', 'b', 'both'].includes(r.assignee) ? r.assignee : null,
      createdBy: ['a', 'b'].includes(r.createdBy) ? r.createdBy : undefined, doneBy: ['a', 'b'].includes(r.doneBy) ? r.doneBy : undefined,
      tags: Array.isArray(r.tags) ? r.tags.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 30) : [],
      subtasks: Array.isArray(r.subtasks) ? r.subtasks.filter(x => x && typeof x === 'object').slice(0, 200).map(x => ({ id: cStr(x.id, 80), title: cStr(x.title, 1000), done: !!x.done })) : [],
      done: !!r.done, pinned: !!r.pinned, deleted: !!r.deleted, doneAt: cNum(r.doneAt, null), createdAt: cNum(r.createdAt), updatedAt: cNum(r.updatedAt) };
    if (r.title !== undefined) o.title = cStr(r.title, 2000);
    return o;
  }
  return null;
}
const cleanMap = m => { const out = {}; for (const [k, v] of Object.entries(m && typeof m === 'object' ? m : {})) { const c = cleanRecord(v); if (c && c.id === k) out[k] = c; } return out; };

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KD) || 'null');
    if (d) D = { tasks: cleanMap(d.tasks), lists: cleanMap(d.lists), people: d.people ? cleanRecord(d.people) : null };
  } catch (e) { console.warn('load data', e); }
  try {
    const l = JSON.parse(localStorage.getItem(KL) || 'null');
    if (l) {
      const def = defaultLocal();
      L = { ...def, ...l, settings: { ...def.settings, ...(l.settings || {}) }, sync: { ...def.sync, ...(l.sync || {}) } };
    }
  } catch (e) { console.warn('load local', e); }
}
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 150); }
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KD, JSON.stringify(D)); localStorage.setItem(KL, JSON.stringify(L)); }
  catch (e) { console.warn('save', e); }
}
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

/* ---------- Records ---------- */
const recKey = r => r.kind === 'task' ? 't:' + r.id : r.kind === 'list' ? 'l:' + r.id : 'people';
function stamp(rec) { rec.updatedAt = Math.max(Date.now(), (rec.updatedAt || 0) + 1); }
function commit(rec, opts = {}) {
  stamp(rec); save();
  if (typeof Sync !== 'undefined') Sync.queue(recKey(rec));
  if (!opts.silent && typeof scheduleRender === 'function') scheduleRender();
  return rec;
}
const snapshot = o => JSON.parse(JSON.stringify(o));

/* ---------- People ---------- */
const partnerKey = () => (L.me === 'a' ? 'b' : 'a');
const person = k => (D.people && D.people[k]) || { name: k === 'a' ? 'Me' : 'Partner', color: k === 'a' ? 'blue' : 'pink' };
const myName = () => person(L.me).name;
const ptName = () => person(partnerKey()).name;
const avatar = (k, cls = '') => { const p = person(k); return `<span class="av ${cls}${p.photo ? ' ph' : ''}" style="--c:var(--c-${p.color})${p.photo ? `;background-image:var(--ph-${k})` : ''}" title="${esc(p.name)}">${p.photo ? '' : esc(initial(p.name))}</span>`; };
const assigneeBadge = a => !a ? '' : a === 'both' ? `<span class="av-pair" title="Both of you">${avatar('a')}${avatar('b')}</span>` : avatar(a);
const whoName = k => !k ? 'someone' : k === L.me ? 'you' : person(k).name;
function setPeople(a, b) {
  D.people = { kind: 'people', id: 'people', a, b, updatedAt: (D.people && D.people.updatedAt) || 0 };
  commit(D.people);
}

/* ---------- Lists ---------- */
function mkList(p) {
  return { kind: 'list', id: uid(), name: 'List', emoji: '📝', color: 'blue', private: false, order: Date.now(), createdAt: Date.now(), updatedAt: 0, deleted: false, ...p };
}
function ensureBasics() {
  if (!D.lists.inbox || D.lists.inbox.deleted) {
    D.lists.inbox = mkList({ id: 'inbox', name: 'Inbox', emoji: '📥', color: 'blue', order: 0, updatedAt: 1 });
  }
}
function seedLists() {
  const defs = [
    { id: 'inbox', name: 'Inbox', emoji: '📥', color: 'blue', order: 0 },
    { id: 'groceries', name: 'Groceries', emoji: '🛒', color: 'green', order: 1 },
    { id: 'home', name: 'Home', emoji: '🏠', color: 'orange', order: 2 },
    { id: 'dates', name: 'Date Ideas', emoji: '✨', color: 'pink', order: 3 },
  ];
  for (const d of defs) if (!D.lists[d.id]) { D.lists[d.id] = mkList(d); commit(D.lists[d.id], { silent: true }); }
  addSecretList();
}
function addSecretList() {
  if (lists().some(l => l.private)) return;
  const l = mkList({ id: 'secret-' + uid(), name: 'Secret', emoji: '🎁', color: 'purple', private: true, order: 99 });
  D.lists[l.id] = l; commit(l, { silent: true });
}
const lists = () => Object.values(D.lists).filter(l => !l.deleted && l.name).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
const listOf = t => { const l = D.lists[t.listId]; return l && !l.deleted && l.name ? l : D.lists.inbox; };
const normName = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/* ---------- Tasks ---------- */
const liveTasks = () => Object.values(D.tasks).filter(t => !t.deleted && t.title !== undefined);
function makeTask(p) {
  const t = {
    kind: 'task', id: uid(), title: '', notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [],
    assignee: null, subtasks: [], repeat: null, pinned: false, done: false, doneAt: null, doneBy: null,
    createdAt: Date.now(), createdBy: L.me, updatedAt: 0, deleted: false, pomos: 0, ...p,
  };
  D.tasks[t.id] = t; commit(t);
  return t;
}
function updateTask(id, patch, opts) {
  const t = D.tasks[id]; if (!t) return null;
  Object.assign(t, patch); return commit(t, opts);
}

/* ---------- Dates ---------- */
function fmtTime(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(s, opts = {}) {
  const diff = dayDiff(s, todayStr());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = fromYmd(s);
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: opts.long ? 'long' : 'short' });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
const fmtDue = (s, hm) => s ? fmtDate(s) + (hm ? ', ' + fmtTime(hm) : '') : (hm ? fmtTime(hm) : '');
function upcomingWd(idx, forceNext) {
  const now = new Date();
  let diff = (idx - now.getDay() + 7) % 7;
  if (diff === 0 && forceNext) diff = 7;
  return ymd(addDays(now, diff));
}

/* ---------- Recurrence ---------- */
function stepDate(d, rep) {
  switch (rep) {
    case 'daily': return addDays(d, 1);
    case 'weekdays': { let x = addDays(d, 1); while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1); return x; }
    case 'weekly': return addDays(d, 7);
    case 'biweekly': return addDays(d, 14);
    case 'monthly': {
      const day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x;
    }
    case 'yearly': return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
    default: return addDays(d, 1);
  }
}
function nextDue(due, rep) {
  const t0 = todayStr();
  let d = stepDate(fromYmd(due || t0), rep), guard = 0;
  while (ymd(d) <= t0 && guard++ < 2000) d = stepDate(d, rep);
  return ymd(d);
}

/* ---------- Smart lists ---------- */
const doneToday = t => t.done && t.doneAt && ymd(new Date(t.doneAt)) === todayStr();
const SMART = {
  today:    { title: 'Today',     color: 'blue',   icon: null,    match: t => !t.done && !!t.due && t.due <= todayStr(), doneMatch: doneToday },
  upcoming: { title: 'Upcoming',  color: 'red',    icon: 'cal',   match: t => !t.done && !!t.due && t.due > todayStr(), doneMatch: t => t.done && !!t.due && t.due > todayStr() },
  us:       { title: 'Together',  color: 'pink',   icon: 'heart', match: t => !t.done && t.assignee === 'both', doneMatch: t => t.done && t.assignee === 'both' },
  pinned:   { title: 'Pinned',    color: 'orange', icon: 'pin',   match: t => !t.done && t.pinned, doneMatch: t => t.done && t.pinned },
  reminders: { title: 'Reminders', color: 'purple', icon: 'bell', match: t => !t.done && !!t.due && !!t.time, doneMatch: t => t.done && !!t.due && !!t.time },
  all:      { title: 'All',       color: 'indigo', icon: 'tray',  match: t => !t.done, doneMatch: t => t.done },
  done:     { title: 'Completed', color: 'gray',   icon: 'check', match: t => t.done, doneMatch: () => false },
};

function whoMatch(t, w) {
  if (!w || w === 'all') return true;
  if (w === 'both') return t.assignee === 'both';
  const k = w === 'me' ? L.me : partnerKey();
  return t.assignee === k || t.assignee === 'both' || (!t.assignee && t.createdBy === k);
}

function sortTasks(arr, mode = 'smart') {
  const dueKey = t => (t.due || '9999-99-99') + (t.time || '99:99');
  const cmp = {
    smart: (a, b) => dueKey(a).localeCompare(dueKey(b)) || (b.priority || 0) - (a.priority || 0),
    due: (a, b) => dueKey(a).localeCompare(dueKey(b)),
    priority: (a, b) => (b.priority || 0) - (a.priority || 0) || dueKey(a).localeCompare(dueKey(b)),
    created: () => 0,
    alpha: (a, b) => a.title.localeCompare(b.title),
  }[mode] || (() => 0);
  return arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || cmp(a, b) || (a.createdAt || 0) - (b.createdAt || 0));
}

function calcStreak() {
  const days = new Set(liveTasks().filter(t => t.done && t.doneAt && t.doneBy === L.me).map(t => ymd(new Date(t.doneAt))));
  let d = new Date();
  if (!days.has(ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
