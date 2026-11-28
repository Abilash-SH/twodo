/* Twodo · daily routines and punch cards (docs/routines.md). A routine is one habit shared by the two of you; each of
   you has one punch card a week, which only you write. The week's summary is computed here, never stored. */
import { D, L, commit, partnerKey } from './store';
import type { PersonKey, Punch, Routine } from './types';
import { addDays, fromYmd, todayStr, uid, type Color } from './util';
import { thisWeek, weekDays, weekOf } from './week';

export const MAX_ROUTINES = 12;
/** the owner's five, offered when there are none yet */
export const STARTERS: { name: string; emoji: string; color: Color }[] = [
  { name: 'Gym', emoji: '🏋️', color: 'orange' },
  { name: 'Steps', emoji: '👟', color: 'teal' },
  { name: 'No sugar', emoji: '🍭', color: 'pink' },
  { name: 'Walk', emoji: '🚶', color: 'green' },
  { name: 'Home food', emoji: '🍲', color: 'yellow' },
];

export const dayIndex = (day: string): number => (fromYmd(day).getDay() + 6) % 7; // Monday 0 … Sunday 6
export const bits = (n: number): number => { let c = 0; for (let x = n & 127; x; x &= x - 1) c++; return c; };
export const has = (mask: number, i: number): boolean => ((mask >> i) & 1) === 1;
export const keeps = (r: Routine, who: PersonKey): boolean => r.who === 'both' || r.who === who;

export const routines = (): Routine[] => Object.values(D.routines).filter(r => !r.deleted && r.name)
  .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
export const cardId = (week: string, who: PersonKey): string => `${week}-${who}`;
export const card = (week: string, who: PersonKey): Punch | undefined => {
  const c = D.punches[cardId(week, who)]; return c && !c.deleted ? c : undefined;
};
export const maskOf = (week: string, who: PersonKey, rid: string): number => (card(week, who)?.days[rid] || 0) & 127;

/** a day you may still punch: today, or earlier this week */
export const canPunch = (day: string): boolean => weekOf(day) === thisWeek() && day <= todayStr();

/** punch or un-punch one of your routines on a day. Only ever your own card. */
export function togglePunch(rid: string, day: string): boolean | null {
  const r = D.routines[rid];
  if (!r || r.deleted || !keeps(r, L.me) || !canPunch(day)) return null;
  const week = thisWeek(), id = cardId(week, L.me), i = dayIndex(day);
  const c: Punch = D.punches[id] && !D.punches[id].deleted ? D.punches[id] : { kind: 'punch', id, week, who: L.me, days: {}, updatedAt: D.punches[id]?.updatedAt || 0, deleted: false };
  const m = ((c.days[rid] || 0) ^ (1 << i)) & 127;
  if (m) c.days[rid] = m; else delete c.days[rid];
  D.punches[id] = c;
  commit(c);
  return has(m, i);
}

export function addRoutine(p: { name: string; emoji: string; color: Color; who?: Routine['who'] }): Routine | null {
  const name = p.name.trim().slice(0, 40);
  if (!name || routines().length >= MAX_ROUTINES) return null;
  const r: Routine = { kind: 'routine', id: uid(), name, emoji: p.emoji, color: p.color, who: p.who || 'both', order: Date.now(), createdAt: Date.now(), updatedAt: 0, deleted: false };
  D.routines[r.id] = r;
  return commit(r);
}
export function addStarters(): void {
  const t = Date.now();
  STARTERS.forEach((s, i) => { const r = addRoutine(s); if (r) { r.order = t + i; commit(r, { silent: true }); } });
}
export function updateRoutine(id: string, patch: Partial<Pick<Routine, 'name' | 'emoji' | 'color' | 'who' | 'deleted'>>): void {
  const r = D.routines[id]; if (!r) return;
  Object.assign(r, patch);
  commit(r);
}

/* ---------- today ---------- */
/** how many of your routines are punched today, out of how many you keep */
export function todayCount(who: PersonKey = L.me): { done: number; of: number } {
  const day = todayStr(), week = weekOf(day), i = dayIndex(day), mine = routines().filter(r => keeps(r, who));
  return { done: mine.filter(r => has(maskOf(week, who, r.id), i)).length, of: mine.length };
}

/* ---------- the week's summary: the quilt and the receipt ---------- */
export interface Row { r: Routine; me: number; pt: number; keepsMe: boolean; keepsPt: boolean; both: number }
export interface Summary {
  week: string; days: string[]; rows: Row[]; upTo: number; // upTo: days of the week so far (7 once it is over)
  sewn: number; patches: number; together: number;
  me: { kept: number; of: number; allDays: number }; pt: { kept: number; of: number; allDays: number };
  most: Row | null; hardest: Row | null;
}
export function summary(week: string): Summary {
  const me = L.me, pt = partnerKey(), days = weekDays(week), end = addDays(fromYmd(week), 7).getTime();
  const today = todayStr(), upTo = week === thisWeek() ? dayIndex(today) + 1 : week > thisWeek() ? 0 : 7;
  const cm = card(week, me), cp = card(week, pt), punched = (rid: string) => !!(cm?.days[rid] || cp?.days[rid]);
  // the routines of that week: those that existed then, and any removed since that still have punches on it
  const rs = Object.values(D.routines).filter(r => r.name && (punched(r.id) || (!r.deleted && r.createdAt < end)))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const rows: Row[] = rs.map(r => {
    const a = (cm?.days[r.id] || 0) & 127, b = (cp?.days[r.id] || 0) & 127;
    return { r, me: a, pt: b, keepsMe: keeps(r, me), keepsPt: keeps(r, pt), both: bits(a & b) };
  });
  const side = (k: 'me' | 'pt') => {
    const mine = rows.filter(x => (k === 'me' ? x.keepsMe : x.keepsPt)), live = mine.filter(x => !x.r.deleted);
    let allDays = 0;
    for (let i = 0; i < upTo; i++) if (live.length && live.every(x => has(x[k], i))) allDays++;
    // a routine removed since counts only the days it was kept, so it never makes the week look emptier
    return { kept: mine.reduce((n, x) => n + bits(x[k]), 0), of: live.length * upTo + mine.filter(x => x.r.deleted).reduce((n, x) => n + bits(x[k]), 0), allDays };
  };
  const m = side('me'), p = side('pt'), rate = (x: Row) => (bits(x.me) + bits(x.pt)) / Math.max(1, (+x.keepsMe + +x.keepsPt) * upTo);
  const ranked = upTo ? rows.slice().sort((a, b) => rate(b) - rate(a)) : [];
  const most = ranked.find(x => rate(x) > 0) || null, last = ranked[ranked.length - 1];
  return {
    week, days, rows, upTo, sewn: m.kept + p.kept, patches: m.of + p.of, together: rows.reduce((n, x) => n + x.both, 0),
    me: m, pt: p, most, hardest: last && last !== most && rate(last) < 1 ? last : null,
  };
}
