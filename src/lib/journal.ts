/* Twodo · the journal: one page a day, one half each. "Us" is shared and synced; "Just me" lives only inside the vault
   (docs/journal-and-planner.md). Only the author ever writes a half, so the two of you never edit the same record. */
import { D, L, commit, journalId } from './store';
import type { JournalEntry, Mood, PersonKey } from './types';
import { addDays, fromYmd, todayStr, ymd } from './util';
import { Vault } from './vault';

/* Prompts: gentle, optional, and for two. One a day (the same on both phones), "Another" for a different one. */
export const PROMPTS = [
  'What made you smile today?', 'What did your partner do today that you noticed?', 'What are you looking forward to this week?',
  'Describe today in three words, then say why.', 'What would make tomorrow a little easier?', 'What would you like to do together soon?',
  'What did you learn today?', 'When did you feel most like yourself today?', 'Which memory of the two of you came to mind today?',
  'What are you grateful for right now?', 'What was hard today, and what helped?', 'What is on your mind that you haven’t said out loud?',
  'If you could go anywhere this weekend, where would it be?', 'Which song, smell or place reminds you of us?', 'What did you eat today that was worth remembering?',
  'What would you like your partner to know today?', 'What made today different from yesterday?', 'What would a perfect evening look like right now?',
  'What are you proud of this week?', 'Which moment from today would you keep?', 'What tiny habit would you like to start?',
  'What made you laugh recently?', 'What do you need more of this week?', 'What are you curious about lately?',
];
export const WEEK_PROMPT = 'How was our week? What was the best part?';
const dayNo = (day: string): number => Math.floor(fromYmd(day).getTime() / 864e5 + 0.5);
export function promptFor(day: string, shift = 0): string { const n = PROMPTS.length; return PROMPTS[(((dayNo(day) + shift) % n) + n) % n]; }

/* Weather instead of a mood scale: you check each other's weather. 0 = not said. */
export const WEATHER: [Mood, string, string][] = [[1, 'sun', 'Sunny'], [2, 'cloudsun', 'Bright spells'], [3, 'cloud', 'Cloudy'], [4, 'rain', 'Rainy'], [5, 'storm', 'Stormy']];

export const getPage = (priv: boolean, date: string, who: PersonKey): JournalEntry | undefined => {
  const e = D.journal[journalId(priv, date, who)];
  return e && !e.deleted ? e : undefined;
};
export const hasWords = (e: JournalEntry | undefined): boolean => !!e && !!e.text.trim();

/** Write your half of a page. A private half only while the vault is open (so it is never saved in plain text).
 *  An empty half (no words, no weather, no prompt) is not kept. */
export function writePage(priv: boolean, date: string, patch: Partial<Pick<JournalEntry, 'text' | 'mood' | 'prompt'>>): JournalEntry | null {
  if (priv && !Vault.unlocked()) return null;
  const id = journalId(priv, date, L.me);
  let e = D.journal[id];
  if (!e) {
    e = { kind: 'journal', id, date, who: L.me, private: priv, text: '', mood: 0, prompt: '', createdAt: Date.now(), updatedAt: 0, deleted: false };
    D.journal[id] = e;
  }
  Object.assign(e, patch);
  e.deleted = !e.text.trim() && !e.mood && !e.prompt;
  return commit(e);
}

/** Every day that has a page in this journal, newest first (today excluded), with both halves */
export interface Spread { date: string; mine?: JournalEntry; theirs?: JournalEntry }
export function spreads(priv: boolean): Spread[] {
  const by = new Map<string, Spread>(), today = todayStr();
  for (const e of Object.values(D.journal)) {
    if (e.deleted || e.private !== priv || e.date >= today || (!e.text.trim() && !e.mood)) continue;
    if (priv && e.who !== L.me) continue;
    const s = by.get(e.date) || { date: e.date };
    if (e.who === L.me) s.mine = e; else s.theirs = e;
    by.set(e.date, s);
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** A page from a week, a month or a year ago today, if there is one with words */
export function onThisDay(priv: boolean): { label: string; s: Spread } | null {
  const t = fromYmd(todayStr());
  const back: [string, string][] = [
    ['A year ago', ymd(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()))],
    ['A month ago', ymd(new Date(t.getFullYear(), t.getMonth() - 1, t.getDate()))],
    ['A week ago', ymd(addDays(t, -7))],
  ];
  const all = spreads(priv);
  for (const [label, d] of back) {
    const s = all.find(x => x.date === d);
    if (s && (hasWords(s.mine) || hasWords(s.theirs))) return { label, s };
  }
  return null;
}
