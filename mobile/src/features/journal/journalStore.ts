/* Twodo · the journal by day (HANDOFF.md, "Data decisions"): one page per person per day. You can write only
   today's page; earlier days can be read, never changed; future days don't exist yet. A heart is yours to give to
   your partner's page, once per page.
   Preview build: pages live in memory with a few sample days and are gone when the app closes. Phase 2 stores them
   as encrypted `journal` records with ids `us-<date>-<who>`. */
import { useSyncExternalStore } from 'react';
import { addDays, isYmd, todayYmd } from '../dates';

export interface Page { text: string; at: number }
export interface Day { mine?: Page; theirs?: Page; iLoved?: boolean; theyLoved?: boolean }
export const PAGE_MAX = 5000;

let days = new Map<string, Day>();
let version = 0;
const listeners = new Set<() => void>();
const emit = (): void => { version++; listeners.forEach(l => l()); };

export function seed(today = todayYmd()): void {
  const at = Date.now();
  days = new Map<string, Day>([
    [addDays(today, -1), {
      mine: { text: 'Long day, but the walk home with you made it. Still thinking about that little bookshop.', at },
      theirs: { text: 'Coffee on the balcony, then the river walk. The leaves on our street are all orange now.', at },
      iLoved: true, theyLoved: true,
    }],
    [addDays(today, -3), { theirs: { text: 'Burned the toast again 😅 but the cake turned out perfect.', at } }],
    [addDays(today, -6), { mine: { text: 'Planned the weekend. Small things, done slowly.', at } }],
  ]);
  emit();
}
seed();

export const journal = {
  day(date: string): Day { return days.get(date) ?? {}; },
  /** Saves your page for `date`, only if `date` is today. Returns whether it was saved. */
  write(date: string, text: string, today = todayYmd()): boolean {
    if (!isYmd(date) || date !== today) return false;
    const clean = text.replace(/\s+$/g, '').slice(0, PAGE_MAX);
    const d = { ...journal.day(date) };
    if (clean) d.mine = { text: clean, at: Date.now() }; else delete d.mine;
    days.set(date, d);
    emit();
    return true;
  },
  /** Gives (or takes back) your heart on your partner's page for `date`. Only when they wrote. */
  heart(date: string, on: boolean): boolean {
    const d = days.get(date);
    if (!d || !d.theirs) return false;
    days.set(date, { ...d, iLoved: on });
    emit();
    return true;
  },
  /** Days with a page from either of you, for the day strip and the calendar. */
  written(): Map<string, { mine: boolean; theirs: boolean }> {
    const out = new Map<string, { mine: boolean; theirs: boolean }>();
    days.forEach((d, k) => { if (d.mine || d.theirs) out.set(k, { mine: !!d.mine, theirs: !!d.theirs }); });
    return out;
  },
};

export function useJournalVersion(): number {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => version,
    () => version,
  );
}
