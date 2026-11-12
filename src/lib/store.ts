/* Twodo · state, persistence and data helpers.
   D = synced data (tasks, lists, the two of you), L = this device only (settings, account, view prefs). */
import { scheduleRender } from './render';
import type { Data, List, Local, PeopleRec, Person, PersonKey, Rec, Task } from './types';
import { addDays, dayDiff, firstWord, fromYmd, PALETTE, REPEATS, todayStr, uid, ymd, type Color, type Repeat } from './util';

const KD = 'twodo:data', KL = 'twodo:local';

export const defaultLocal = (): Local => ({
  me: 'a', onboarded: false,
  settings: {
    theme: 'auto', accent: 'me', haptics: true, sounds: true, confetti: true, notify: false,
    dmy: typeof navigator === 'undefined' ? true : !/^en-(US|PH|CA)/i.test(navigator.language || ''),
  },
  sync: { url: '', code: '' },
  view: {}, notified: {}, focus: null, tips: {},
});

export let D: Data = { tasks: {}, lists: {}, people: null };
export let L: Local = defaultLocal();
/** Replace all synced data (used when a different account signs in on this phone) */
export function resetData(): void { D = { tasks: {}, lists: {}, people: null }; }

/* ---------- Never trust stored or synced records: anything shown on screen is checked here first ----------
   Colours must come from the palette, numbers must be numbers, photos must be small inline images. */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;
export const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const cStr = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
export const cColor = (c: unknown, d: Color): Color => ((PALETTE as readonly unknown[]).includes(c) ? (c as Color) : d);
export const cNum = <T extends number | null = number>(v: unknown, d: T = 0 as T): number | T => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const cEmoji = (v: unknown): string => { // one emoji (a single character as the user sees it)
  const t = cStr(v, 32).trim(); if (!t) return '';
  try { return new Intl.Segmenter().segment(t)[Symbol.iterator]().next().value?.segment ?? ''; } catch { return [...t].slice(0, 2).join(''); }
};
type Loose = Record<string, unknown>;
export function cleanPerson(p: unknown, d: Person): Person {
  if (!p || typeof p !== 'object') return { ...d };
  const q = p as Loose;
  const o: Person & Loose = { ...q, name: cStr(q.name, 40).trim() || d.name, color: cColor(q.color, d.color) };
  if (!(typeof q.photo === 'string' && q.photo.length < 150000 && PHOTO_RE.test(q.photo))) delete o.photo;
  if (o.uid !== undefined && o.uid !== null && typeof o.uid !== 'string') delete o.uid;
  if (o.username !== undefined && typeof o.username !== 'string') delete o.username;
  return o;
}
export function cleanRecord(r: unknown): Rec | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const q = r as Loose;
  if (q.kind === 'people' || q.id === 'people') {
    return { ...q, kind: 'people', id: 'people', a: cleanPerson(q.a, { name: 'Me', color: 'blue' }), b: cleanPerson(q.b, { name: 'Partner', color: 'pink' }), updatedAt: cNum(q.updatedAt) } as PeopleRec;
  }
  if (q.kind === 'list') {
    return { ...q, kind: 'list', id: cStr(q.id, 80), name: cStr(q.name, 60), emoji: cEmoji(q.emoji) || '📝', color: cColor(q.color, 'blue'),
      private: !!q.private, deleted: !!q.deleted, order: cNum(q.order), createdAt: cNum(q.createdAt), updatedAt: cNum(q.updatedAt) } as List;
  }
  if (q.kind === 'task') {
    const o = { ...q, kind: 'task', id: cStr(q.id, 80), listId: cStr(q.listId, 80) || 'inbox', notes: cStr(q.notes, 20000),
      priority: [1, 2, 3].includes(q.priority as number) ? q.priority : 0, pomos: Math.max(0, Math.min(9999, Math.floor(cNum(q.pomos)))),
      due: typeof q.due === 'string' && DAY_RE.test(q.due) ? q.due : null, time: typeof q.time === 'string' && TIME_RE.test(q.time) ? q.time : null,
      repeat: typeof q.repeat === 'string' && Object.prototype.hasOwnProperty.call(REPEATS, q.repeat) ? q.repeat as Repeat : null,
      assignee: ['a', 'b', 'both'].includes(q.assignee as string) ? q.assignee : null,
      createdBy: ['a', 'b'].includes(q.createdBy as string) ? q.createdBy : undefined, doneBy: ['a', 'b'].includes(q.doneBy as string) ? q.doneBy : undefined,
      tags: Array.isArray(q.tags) ? q.tags.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 30) : [],
      subtasks: Array.isArray(q.subtasks) ? q.subtasks.filter((x): x is Loose => !!x && typeof x === 'object').slice(0, 200).map(x => ({ id: cStr(x.id, 80), title: cStr(x.title, 1000), done: !!x.done })) : [],
      done: !!q.done, pinned: !!q.pinned, deleted: !!q.deleted, doneAt: cNum(q.doneAt, null), createdAt: cNum(q.createdAt), updatedAt: cNum(q.updatedAt) } as Task & Loose;
    if (q.title !== undefined) o.title = cStr(q.title, 2000); else delete (o as Loose).title;
    return o as Task;
  }
  return null;
}
export function cleanMap<T extends Rec>(m: unknown): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(m && typeof m === 'object' ? m : {})) { const c = cleanRecord(v); if (c && c.id === k) out[k] = c as T; }
  return out;
}

export function load(): void {
  try {
    const d = JSON.parse(localStorage.getItem(KD) || 'null');
    if (d) D = { tasks: cleanMap<Task>(d.tasks), lists: cleanMap<List>(d.lists), people: d.people ? cleanRecord(d.people) as PeopleRec : null };
  } catch (e) { console.warn('load data', e); }
  try {
    const l = JSON.parse(localStorage.getItem(KL) || 'null');
    if (l) {
      const def = defaultLocal();
      L = { ...def, ...l, settings: { ...def.settings, ...(l.settings || {}) }, sync: { ...def.sync, ...(l.sync || {}) } };
    }
  } catch (e) { console.warn('load local', e); }
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function save(): void { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 150); }
export function saveNow(): void {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KD, JSON.stringify(D)); localStorage.setItem(KL, JSON.stringify(L)); }
  catch (e) { console.warn('save', e); }
}
if (typeof window !== 'undefined') {
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
}

/* ---------- Records ---------- */
export const recKey = (r: Rec): string => r.kind === 'task' ? 't:' + r.id : r.kind === 'list' ? 'l:' + r.id : 'people';
export function stamp(rec: Rec): void { rec.updatedAt = Math.max(Date.now(), (rec.updatedAt || 0) + 1); }
/** Sync registers itself here, so the data layer has no import cycle */
export const hooks = { queue: (_k: string): void => {} };
export function commit<T extends Rec>(rec: T, opts: { silent?: boolean } = {}): T {
  stamp(rec); save();
  hooks.queue(recKey(rec));
  if (!opts.silent) scheduleRender();
  return rec;
}
export const snapshot = <T>(o: T): T => JSON.parse(JSON.stringify(o));

/* ---------- People ---------- */
export const partnerKey = (): PersonKey => (L.me === 'a' ? 'b' : 'a');
export const person = (k: PersonKey): Person => (D.people && D.people[k]) || { name: k === 'a' ? 'Me' : 'Partner', color: k === 'a' ? 'blue' : 'pink' };
export const myName = (): string => person(L.me).name;
export const ptName = (): string => person(partnerKey()).name;
export const whoName = (k: PersonKey | null | undefined): string => !k ? 'someone' : k === L.me ? 'you' : person(k).name;
export function setPeople(a: Person, b: Person): void {
  D.people = { kind: 'people', id: 'people', a, b, updatedAt: (D.people && D.people.updatedAt) || 0 };
  commit(D.people);
}
export function setPeopleRec(p: PeopleRec | null): void { D.people = p; }

/* ---------- Lists ---------- */
export function mkList(p: Partial<List>): List {
  return { kind: 'list', id: uid(), name: 'List', emoji: '📝', color: 'blue', private: false, order: Date.now(), createdAt: Date.now(), updatedAt: 0, deleted: false, ...p };
}
export function ensureBasics(): void {
  if (!D.lists.inbox || D.lists.inbox.deleted) D.lists.inbox = mkList({ id: 'inbox', name: 'Inbox', emoji: '📥', color: 'blue', order: 0, updatedAt: 1 });
}
export function seedLists(): void {
  const defs: Partial<List>[] = [
    { id: 'inbox', name: 'Inbox', emoji: '📥', color: 'blue', order: 0 },
    { id: 'groceries', name: 'Groceries', emoji: '🛒', color: 'green', order: 1 },
    { id: 'home', name: 'Home', emoji: '🏠', color: 'orange', order: 2 },
    { id: 'dates', name: 'Date Ideas', emoji: '✨', color: 'pink', order: 3 },
  ];
  for (const d of defs) if (!D.lists[d.id!]) { D.lists[d.id!] = mkList(d); commit(D.lists[d.id!], { silent: true }); }
  addSecretList();
}
export function addSecretList(): void {
  if (lists().some(l => l.private)) return;
  const l = mkList({ id: 'secret-' + uid(), name: 'Secret', emoji: '🎁', color: 'purple', private: true, order: 99 });
  D.lists[l.id] = l; commit(l, { silent: true });
}
export const lists = (): List[] => Object.values(D.lists).filter(l => !l.deleted && l.name)
  .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
export const listOf = (t: Task): List => { const l = D.lists[t.listId]; return l && !l.deleted && l.name ? l : D.lists.inbox; };
export const normName = (s: unknown): string => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/* ---------- Tasks ---------- */
export const liveTasks = (): Task[] => Object.values(D.tasks).filter(t => !t.deleted && t.title !== undefined);
export function makeTask(p: Partial<Task>): Task {
  const t: Task = {
    kind: 'task', id: uid(), title: '', notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [],
    assignee: null, subtasks: [], repeat: null, pinned: false, done: false, doneAt: null, doneBy: null,
    createdAt: Date.now(), createdBy: L.me, updatedAt: 0, deleted: false, pomos: 0, ...p,
  };
  D.tasks[t.id] = t; commit(t);
  return t;
}
export function updateTask(id: string, patch: Partial<Task>, opts?: { silent?: boolean }): Task | null {
  const t = D.tasks[id]; if (!t) return null;
  Object.assign(t, patch); return commit(t, opts);
}

/* ---------- Dates ---------- */
export function fmtTime(hm: string | null | undefined): string {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function fmtDate(s: string, opts: { long?: boolean } = {}): string {
  const diff = dayDiff(s, todayStr());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = fromYmd(s);
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: opts.long ? 'long' : 'short' });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
export const fmtDue = (s: string | null | undefined, hm?: string | null): string => s ? fmtDate(s) + (hm ? ', ' + fmtTime(hm) : '') : (hm ? fmtTime(hm) : '');
export function upcomingWd(idx: number, forceNext?: boolean): string {
  const now = new Date();
  let diff = (idx - now.getDay() + 7) % 7;
  if (diff === 0 && forceNext) diff = 7;
  return ymd(addDays(now, diff));
}

/* ---------- Recurrence ---------- */
function stepDate(d: Date, rep: Repeat): Date {
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
export function nextDue(due: string | null, rep: Repeat): string {
  const t0 = todayStr();
  let d = stepDate(fromYmd(due || t0), rep), guard = 0;
  while (ymd(d) <= t0 && guard++ < 2000) d = stepDate(d, rep);
  return ymd(d);
}

/* ---------- Smart lists ---------- */
const doneToday = (t: Task): boolean => !!(t.done && t.doneAt && ymd(new Date(t.doneAt)) === todayStr());
export interface SmartDef { title: string; color: Color; icon: string | null; match: (t: Task) => boolean; doneMatch: (t: Task) => boolean }
export type SmartKey = 'today' | 'upcoming' | 'us' | 'pinned' | 'reminders' | 'all' | 'done';
export const SMART: Record<SmartKey, SmartDef> = {
  today:     { title: 'Today',     color: 'blue',   icon: null,    match: t => !t.done && !!t.due && t.due <= todayStr(), doneMatch: doneToday },
  upcoming:  { title: 'Upcoming',  color: 'red',    icon: 'cal',   match: t => !t.done && !!t.due && t.due > todayStr(), doneMatch: t => t.done && !!t.due && t.due > todayStr() },
  us:        { title: 'Together',  color: 'pink',   icon: 'heart', match: t => !t.done && t.assignee === 'both', doneMatch: t => t.done && t.assignee === 'both' },
  pinned:    { title: 'Pinned',    color: 'orange', icon: 'pin',   match: t => !t.done && t.pinned, doneMatch: t => t.done && t.pinned },
  reminders: { title: 'Reminders', color: 'purple', icon: 'bell',  match: t => !t.done && !!t.due && !!t.time, doneMatch: t => t.done && !!t.due && !!t.time },
  all:       { title: 'All',       color: 'indigo', icon: 'tray',  match: t => !t.done, doneMatch: t => t.done },
  done:      { title: 'Completed', color: 'gray',   icon: 'check', match: t => t.done, doneMatch: () => false },
};

export function whoMatch(t: Task, w?: string): boolean {
  if (!w || w === 'all') return true;
  if (w === 'both') return t.assignee === 'both';
  const k = w === 'me' ? L.me : partnerKey();
  return t.assignee === k || t.assignee === 'both' || (!t.assignee && t.createdBy === k);
}

export function sortTasks(arr: Task[], mode = 'smart'): Task[] {
  const dueKey = (t: Task) => (t.due || '9999-99-99') + (t.time || '99:99');
  const cmps: Record<string, (a: Task, b: Task) => number> = {
    smart: (a, b) => dueKey(a).localeCompare(dueKey(b)) || (b.priority || 0) - (a.priority || 0),
    due: (a, b) => dueKey(a).localeCompare(dueKey(b)),
    priority: (a, b) => (b.priority || 0) - (a.priority || 0) || dueKey(a).localeCompare(dueKey(b)),
    created: () => 0,
    alpha: (a, b) => a.title.localeCompare(b.title),
  };
  const cmp = cmps[mode] || (() => 0);
  return arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || cmp(a, b) || (a.createdAt || 0) - (b.createdAt || 0));
}

export function calcStreak(): number {
  const days = new Set(liveTasks().filter(t => t.done && t.doneAt && t.doneBy === L.me).map(t => ymd(new Date(t.doneAt!))));
  let d = new Date();
  if (!days.has(ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
export const firstName = (k: PersonKey): string => firstWord(person(k).name);
