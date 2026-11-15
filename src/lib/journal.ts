/* Twodo · the journal: one shared thread for the two of you. Write, post, read. Nothing else: no prompts, no weather,
   no scores. Each post is one `journal` record with its own id (`us-p…`); only its writer edits or deletes it, so the
   two of you never edit the same record. Pages written before the thread (one per person per day) show as posts.
   Data: docs/journal-and-planner.md */
import { D, L, commit } from './store';
import type { JournalEntry } from './types';
import { todayStr } from './util';

export const POST_MAX = 20000;
/** the journal screen is open: a new post from your partner needs no note on the island */
export const journalOpen = { now: false };
const newId = (): string => 'us-p' + Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 7).padEnd(5, '0');

/** Everything posted in the shared thread, newest first */
export function posts(): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const e of Object.values(D.journal)) if (!e.deleted && !e.private && e.text.trim()) out.push(e);
  return out.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
}
/** The newest post from today, for the board */
export function latestToday(): JournalEntry | undefined {
  const t = todayStr();
  return posts().find(e => e.date === t);
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
  if (!e || e.deleted || e.private || e.who !== L.me) return null;
  const t = text.trim().slice(0, POST_MAX);
  if (!t) return deletePost(id);
  if (t === e.text) return e;
  e.text = t;
  return commit(e);
}
export function deletePost(id: string): JournalEntry | null {
  const e = D.journal[id];
  if (!e || e.deleted || e.private || e.who !== L.me) return null;
  e.deleted = true; e.text = ''; e.prompt = ''; e.mood = 0;
  return commit(e);
}
