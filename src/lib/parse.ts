/* Twodo · natural-language task parser
   "Dinner with @Sam fri 8pm !! #Dates every week" → title, date, time, person, priority, list, repeat */
import { D, L, fmtDate, fmtTime, lists, normName, partnerKey, person, upcomingWd } from './store';
import type { Assignee, List, Priority } from './types';
import { MONTHS, PRIO_COLOR, PRIO_NAME, REPEATS, WD, addDays, firstWord, nowHM, pad, todayStr, ymd, type Color, type Repeat } from './util';

const NUMW: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WD_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
export type ChipKind = 'due' | 'time' | 'repeat' | 'priority' | 'assignee' | 'list' | 'tag';
export const KIND_LABEL: Record<ChipKind, string> = { due: 'Date', time: 'Time', repeat: 'Repeat', priority: 'Priority', assignee: 'Person', list: 'List', tag: 'Tags' };
const monthIdx = (s: string) => (MONTHS as readonly string[]).indexOf(s.toLowerCase().slice(0, 3));
const wdIdx = (s: string) => (WD as readonly string[]).indexOf(s.toLowerCase().slice(0, 3));
const mkDate = (y: number, m: number, d: number) => { const dt = new Date(y, m, d); return dt.getMonth() === m && dt.getDate() === d ? dt : null; };

export interface Chip { kind: ChipKind; label: string; icon: string | null; color: Color | '' }
export interface Parsed {
  title: string; due: string | null; time: string | null; priority: Priority | null; tags: string[]; listId: string | null;
  assignee: Assignee; repeat: Repeat | null; chips: Chip[]; raw: Partial<Record<ChipKind, string>>;
}

function resolvePerson(tok: string): Assignee {
  const s = tok.toLowerCase();
  if (['me', 'myself', 'i', 'mine'].includes(s)) return L.me;
  if (['us', 'both', 'we', 'together', 'all', 'everyone'].includes(s)) return 'both';
  if (['her', 'him', 'them', 'partner', 'bae', 'babe', 'baby', 'love', 'gf', 'bf', 'wife', 'husband', 'hubby', 'wifey'].includes(s)) return partnerKey();
  for (const k of [L.me, partnerKey()]) {
    const n = (person(k).name || '').toLowerCase(), f = firstWord(n);
    if (s.length >= 2 && (n === s || f === s || f.startsWith(s))) return k;
  }
  return null;
}
function resolveList(tok: string): List | null {
  const s = normName(tok); if (!s) return null;
  const ls = lists();
  const words = (l: List) => String(l.name).toLowerCase().split(/\s+/).map(normName).filter(Boolean);
  return ls.find(l => normName(l.name) === s)
    || (s.length >= 3 ? ls.find(l => normName(l.name).startsWith(s)) : undefined)
    // "#dates" → "Date Ideas", "#grocery" → "Groceries" (small plural / suffix differences)
    || ls.find(l => words(l).some(w => w.length >= 4 && ((s.startsWith(w) && s.length - w.length <= 2) || (w.startsWith(s.slice(0, -1)) && s.length >= 5))))
    || null;
}

type Rep = (substring: string, ...args: string[]) => unknown;
export function parseTask(input: string, ignored: Set<string> = new Set()): Parsed {
  const r: Parsed = { title: '', due: null, time: null, priority: null, tags: [], listId: null, assignee: null, repeat: null, chips: [], raw: {} };
  let s = ' ' + String(input).replace(/\s+/g, ' ').trim() + ' ';
  const now = new Date(), t0 = todayStr();
  let pendWd: number | null = null;

  // Replace every match of `re` with a space when `fn` accepts it (returns anything but false).
  const take = (kind: ChipKind, re: RegExp, fn: Rep) => {
    if (ignored.has(kind)) return;
    s = s.replace(re, (...m: string[]) => (fn(...(m as [string, ...string[]])) === false ? m[0] : ' '));
  };
  const setDue = (d: string, raw: string) => { if (r.due) return false; r.due = d; r.raw.due = raw.trim(); };
  const setTime = (h: number, mi: number, raw: string) => {
    if (r.time || h > 23 || mi > 59) return false;
    r.time = `${pad(h)}:${pad(mi)}`; r.raw.time = raw.trim();
  };

  // Priority: ! !! !!!, !high, p1
  take('priority', /\s(!{1,3})(?=\s)/g, (m, b) => { if (r.priority) return false; r.priority = b.length as Priority; r.raw.priority = b; });
  take('priority', /\s!(high|hi|h|medium|med|m|low|lo|l)(?=\s)/gi, (m, w) => {
    if (r.priority) return false; r.priority = /^h/i.test(w) ? 3 : /^m/i.test(w) ? 2 : 1; r.raw.priority = m.trim();
  });
  take('priority', /\sp([1-3])(?=\s)/gi, (m, n) => { if (r.priority) return false; r.priority = (4 - Number(n)) as Priority; r.raw.priority = m.trim(); });

  // Person: @me @us @name
  take('assignee', /\s@([\p{L}\p{N}_.\-]+)(?=\s)/gu, (m, w) => {
    if (r.assignee) return false; const k = resolvePerson(w); if (!k) return false;
    r.assignee = k; r.raw.assignee = m.trim();
  });

  // #List (if it exists) otherwise #tag
  s = s.replace(/\s#([\p{L}\p{N}_\-]+)(?=\s)/gu, (m: string, w: string) => {
    if (!r.listId && !ignored.has('list')) {
      const l = resolveList(w);
      if (l) { r.listId = l.id; r.raw.list = m.trim(); return ' '; }
    }
    if (ignored.has('tag')) return m;
    const tg = w.toLowerCase(); if (!r.tags.includes(tg)) r.tags.push(tg);
    return ' ';
  });

  // Repeats
  const rep = (re: RegExp, val: Repeat, fn?: Rep) => take('repeat', re, (...m) => { if (r.repeat) return false; r.repeat = val; r.raw.repeat = m[0].trim(); if (fn) fn(...(m as [string, ...string[]])); });
  rep(/\s(?:every\s+week\s*days?|every\s+weekday|on\s+weekdays|weekdays)(?=\s)/gi, 'weekdays');
  rep(/\severy\s+(?:other|2(?:nd)?|second|two)\s+weeks?(?=\s)/gi, 'biweekly');
  rep(/\s(?:every\s*day|daily|each\s+day)(?=\s)/gi, 'daily');
  rep(new RegExp(`\\s(?:every|each)\\s+${WD_RE}(?=\\s)`, 'gi'), 'weekly', (m, w) => { pendWd = wdIdx(w); });
  rep(/\s(?:every\s+week|weekly|each\s+week)(?=\s)/gi, 'weekly');
  rep(/\s(?:every\s+month|monthly|each\s+month)(?=\s)/gi, 'monthly');
  rep(/\s(?:every\s+year|yearly|annually|each\s+year)(?=\s)/gi, 'yearly');

  // Dates (+ day parts)
  const PART: Record<string, string> = { morning: '09:00', afternoon: '14:00', evening: '18:00', night: '20:00' };
  take('due', /\s(today|tomorrow|tmrw|tmr|tomorow)\s+(morning|afternoon|evening|night)(?=\s)/gi, (m, d, p) => {
    if (r.due) return false;
    r.due = /^tod/i.test(d) ? t0 : ymd(addDays(now, 1)); r.raw.due = m.trim();
    if (!r.time && !ignored.has('time')) r.time = PART[p.toLowerCase()];
  });
  take('due', /\stonight(?=\s)/gi, m => {
    if (r.due) return false; r.due = t0; r.raw.due = m.trim();
    if (!r.time && !ignored.has('time')) r.time = '20:00';
  });
  take('due', /\s(?:due\s+|by\s+|on\s+)?(?:the\s+)?day\s+after\s+tomorrow(?=\s)/gi, m => setDue(ymd(addDays(now, 2)), m));
  take('due', /\s(?:due\s+|by\s+)?today(?=\s)/gi, m => setDue(t0, m));
  take('due', /\s(?:due\s+|by\s+)?(?:tomorrow|tmrw|tmr|tomorow|tmw)(?=\s)/gi, m => setDue(ymd(addDays(now, 1)), m));
  // "this weekend" / "next weekend" anywhere; a bare "weekend" only at the end ("Plan weekend trip" stays a title)
  const sat = () => { const d = now.getDay(); return addDays(now, d === 6 || d === 0 ? 0 : 6 - d); };
  take('due', /\snext\s+weekend(?=\s)/gi, m => setDue(ymd(addDays(sat(), 7)), m));
  take('due', /\s(?:this|on\s+the|by\s+the|over\s+the)\s+weekend(?=\s)/gi, m => setDue(ymd(sat()), m));
  take('due', /\s(?:on\s+)?weekend(?=\s$)/gi, m => setDue(ymd(sat()), m));
  take('due', /\snext\s+week(?=\s)/gi, m => setDue(ymd(addDays(now, ((1 - now.getDay() + 7) % 7) || 7)), m));
  take('due', /\snext\s+month(?=\s)/gi, m => setDue(ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1)), m));
  take('due', /\sin\s+(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?|months?)(?=\s)/gi, (m, n, u) => {
    const k = isNaN(Number(n)) ? NUMW[n.toLowerCase()] : Number(n);
    const d = /^d/i.test(u) ? addDays(now, k) : /^w/i.test(u) ? addDays(now, 7 * k) : new Date(now.getFullYear(), now.getMonth() + k, now.getDate());
    return setDue(ymd(d), m);
  });
  take('due', new RegExp(`\\s(?:(on|by|next|this|due|coming)\\s+)?${WD_RE}(?=\\s)`, 'gi'), (m, pre, w) => {
    if (!pre && /^(sat|sun|wed)$/i.test(w)) return false; // "sun cream", "get wed" — need a prefix
    return setDue(upcomingWd(wdIdx(w), !!pre && /next/i.test(pre)), m);
  });
  const yr = (mo: number, d: number, y?: string) => {
    const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : now.getFullYear();
    let dt = mkDate(year, mo, d); if (!dt) return null;
    if (!y && ymd(dt) < t0) dt = mkDate(year + 1, mo, d);
    return dt && ymd(dt);
  };
  take('due', new RegExp(`\\s(?:on\\s+|by\\s+|due\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?(?:,?\\s+(\\d{4}))?(?=\\s)`, 'gi'),
    (m, d, mo, y) => { const v = yr(monthIdx(mo), Number(d), y); return v ? setDue(v, m) : false; });
  take('due', new RegExp(`\\s(?:on\\s+|by\\s+|due\\s+)?${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=\\s)`, 'gi'),
    (m, mo, d, y) => { const v = yr(monthIdx(mo), Number(d), y); return v ? setDue(v, m) : false; });
  take('due', /\s(?:on\s+|by\s+|due\s+)?(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/g, (m, y, mo, d) => {
    const dt = mkDate(+y, +mo - 1, +d); return dt ? setDue(ymd(dt), m) : false;
  });
  take('due', /\s(?:on\s+|by\s+|due\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?=\s)/g, (m, a, b, y) => {
    const [d, mo] = L.settings.dmy ? [+a, +b] : [+b, +a];
    if (mo < 1 || mo > 12) return false;
    const v = yr(mo - 1, d, y); return v ? setDue(v, m) : false;
  });

  // Times
  take('time', /\s(?:at\s+|@\s?)?(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)(?=\s)/gi, (m, h, mi, ap) => {
    const hh = +h; if (hh < 1 || hh > 12) return false;
    return setTime((hh % 12) + (/^p/i.test(ap) ? 12 : 0), +(mi || 0), m);
  });
  take('time', /\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/g, (m, h, mi) => setTime(+h, +mi, m));
  take('time', /\s(?:at\s+)?noon(?=\s)/gi, m => setTime(12, 0, m));
  take('time', /\s(?:at\s+)?midnight(?=\s)/gi, m => setTime(23, 59, m));
  take('time', /\sat\s+(\d{1,2})(?=\s)/gi, (m, h) => { let hh = +h; if (hh > 23) return false; if (hh >= 1 && hh <= 7) hh += 12; return setTime(hh, 0, m); });

  // Fill in implied dates
  if (r.repeat && pendWd != null && !r.due) r.due = upcomingWd(pendWd, false);
  if (r.repeat && !r.due) r.due = t0;
  if (r.time && !r.due && !ignored.has('due')) r.due = r.time <= nowHM() ? ymd(addDays(now, 1)) : t0;

  r.title = s.replace(/\s+/g, ' ').trim().replace(/(?:^|\s)(?:on|at|by|due|in|every|for)$/i, '').trim() || String(input).trim();

  // Preview chips
  const C = (kind: ChipKind, label: string, icon: string | null, color: Color | '') => r.chips.push({ kind, label, icon, color });
  if (r.due) C('due', fmtDate(r.due), 'cal', r.due < t0 ? 'red' : 'blue');
  if (r.time) C('time', fmtTime(r.time), 'clock', 'indigo');
  if (r.repeat) C('repeat', REPEATS[r.repeat], 'repeat', 'teal');
  if (r.priority) C('priority', PRIO_NAME[r.priority], 'flag', PRIO_COLOR[r.priority]);
  if (r.assignee) C('assignee', r.assignee === 'both' ? 'Both of you' : r.assignee === L.me ? 'You' : person(r.assignee).name,
    'person', r.assignee === 'both' ? 'pink' : person(r.assignee).color);
  if (r.listId) { const l = D.lists[r.listId]; C('list', `${l.emoji} ${l.name}`, null, l.color); }
  r.tags.forEach(tg => C('tag', '#' + tg, 'tag', 'purple'));
  return r;
}
