/* Twodo · the journal, by day: each of you has a page for each day, and only today's can be written.
   Records are the thread's posts, unchanged: one `journal` record each (`us-p…`), with the day it was written. Your
   newest post from today is today's page (saving edits it, or makes it); older ones of a day are read-only, and so is
   every earlier day. Only its writer edits or deletes a post. A heart is a record of its own (`us-h-<post>-<who>`),
   written only by whoever gave it, so a heart never collides with an edit. Pages written before the thread (one per
   person per day) show under their day. Data: docs/journal-and-planner.md */
import { D, L, commit } from './store';
import type { JournalEntry, PersonKey } from './types';
import { todayStr } from './util';

export const POST_MAX = 20000;
/** the journal screen is open: a new post from your partner needs no note on the island */
export const journalOpen = { now: false };
const newId = (): string => 'us-p' + Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 7).padEnd(5, '0');
export const isHeart = (e: JournalEntry): boolean => e.id.startsWith('us-h-');
/** the post a heart belongs to */
export const heartOf = (e: JournalEntry): string => e.id.slice(5, -2);
const heartId = (post: string, who: PersonKey) => `us-h-${post}-${who}`;

/** Everything posted in the shared thread, newest first */
export function posts(): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const e of Object.values(D.journal)) if (!e.deleted && !e.private && !isHeart(e) && e.text.trim()) out.push(e);
  return out.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
}
/** who gave each post a heart */
export function hearts(): Map<string, Set<PersonKey>> {
  const m = new Map<string, Set<PersonKey>>();
  for (const e of Object.values(D.journal)) {
    if (e.deleted || e.private || !isHeart(e)) continue;
    const p = heartOf(e), s = m.get(p) || new Set<PersonKey>();
    s.add(e.who); m.set(p, s);
  }
  return m;
}
/** The newest post from today, for Home */
export function latestToday(): JournalEntry | undefined {
  const t = todayStr();
  return posts().find(e => e.date === t);
}
/** What one of you wrote on a day, in the order it was written */
export function entriesOn(date: string, who: PersonKey): JournalEntry[] {
  return posts().filter(e => e.date === date && e.who === who).reverse();
}
export const wroteOn = (date: string, who: PersonKey): boolean => posts().some(e => e.date === date && e.who === who);
/** Each day someone wrote on: did you, did your partner (for the week strip and the calendar) */
export function writtenDays(): Map<string, { mine: boolean; theirs: boolean }> {
  const m = new Map<string, { mine: boolean; theirs: boolean }>();
  for (const e of posts()) {
    const w = m.get(e.date) || { mine: false, theirs: false };
    if (e.who === L.me) w.mine = true; else w.theirs = true;
    m.set(e.date, w);
  }
  return m;
}
/** Today's page: your newest post from today */
export const todayPage = (): JournalEntry | undefined => posts().find(e => e.date === todayStr() && e.who === L.me);
/** Save today's page (emptied, it is deleted). Only ever today: a page from before midnight is not touched. */
export function writeToday(text: string): JournalEntry | null {
  const cur = todayPage();
  return cur ? editPost(cur.id, text) : addPost(text);
}

export function addPost(text: string): JournalEntry | null {
  const t = text.trim().slice(0, POST_MAX);
  if (!t) return null;
  const now = Date.now(), e: JournalEntry = { kind: 'journal', id: newId(), date: todayStr(), who: L.me, private: false, text: t, mood: 0, prompt: '',
    createdAt: now, updatedAt: 0, deleted: false };
  D.journal[e.id] = e;
  return commit(e);
}
/** Change your own post; emptied, it is deleted */
export function editPost(id: string, text: string): JournalEntry | null {
  const e = D.journal[id];
  if (!e || e.deleted || e.private || isHeart(e) || e.who !== L.me || e.date !== todayStr()) return null;
  const t = text.trim().slice(0, POST_MAX);
  if (!t) return deletePost(id);
  if (t === e.text) return e;
  e.text = t;
  return commit(e);
}
export function deletePost(id: string): JournalEntry | null {
  const e = D.journal[id];
  if (!e || e.deleted || e.private || isHeart(e) || e.who !== L.me) return null;
  e.deleted = true; e.text = ''; e.prompt = ''; e.mood = 0;
  return commit(e);
}
/** Give a post your heart, or take it back (your partner's posts only). `on` forces it (a double tap only adds). */
export function heart(post: string, on?: boolean): boolean {
  const p = D.journal[post];
  if (!p || p.deleted || p.private || isHeart(p) || p.who === L.me) return false;
  const id = heartId(post, L.me), cur = D.journal[id], now = !(cur && !cur.deleted);
  const want = on === undefined ? now : on;
  if (cur ? cur.deleted === !want : !want) return want; // already so
  const e: JournalEntry = cur || { kind: 'journal', id, date: todayStr(), who: L.me, private: false, text: '', mood: 0, prompt: '', createdAt: Date.now(), updatedAt: 0, deleted: false };
  e.deleted = !want; e.date = todayStr();
  D.journal[id] = e;
  commit(e);
  return want;
}
