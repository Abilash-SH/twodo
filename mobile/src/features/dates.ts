/* Twodo · days on this phone's calendar, as YYYY-MM-DD in local time (never UTC: a page belongs to the day you
   lived it). useToday() changes at midnight, so "today" can't go stale while the app stays open. */
import { useEffect, useState } from 'react';

const pad = (n: number): string => String(n).padStart(2, '0');
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayYmd = (now = new Date()): string => ymd(now);
export function addDays(s: string, n: number): string {
  const d = fromYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(fromYmd(s)) === s;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const weekday = (s: string): string => WEEKDAYS[fromYmd(s).getDay()];
export const weekdayShort = (s: string): string => weekday(s).slice(0, 3);
export const dayOfMonth = (s: string): number => fromYmd(s).getDate();
export const monthName = (m: number): string => MONTHS[m];
/** "Wednesday, 18 November" */
export const longDate = (s: string): string => { const d = fromYmd(s); return `${weekday(s)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
/** "18 November" */
export const dayMonth = (s: string): string => { const d = fromYmd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

/** "Monday, 16 November 2026", for VoiceOver. */
export const fullDate = (s: string): string => `${longDate(s)} ${fromYmd(s).getFullYear()}`;
/** "November 2026" */
export const monthYear = (s: string): string => { const d = fromYmd(s); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

/** The Monday of the week `s` is in (weeks start on Monday). */
export function weekStart(s: string): string {
  return addDays(s, -((fromYmd(s).getDay() + 6) % 7));
}
/** The seven days of the week that starts on `monday`. */
export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
/** The first day of the month `s` is in, moved by `months`. */
export function monthStart(s: string, months = 0): string {
  const d = fromYmd(s);
  return ymd(new Date(d.getFullYear(), d.getMonth() + months, 1));
}
/** A month as calendar rows, Monday first: each cell is a day, or null before the 1st and after the last day. */
export function monthGrid(first: string): (string | null)[] {
  const d = fromYmd(first), year = d.getFullYear(), month = d.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day++) cells.push(ymd(new Date(year, month, day)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function useToday(): string {
  const [today, setToday] = useState(todayYmd);
  useEffect(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = setTimeout(() => setToday(todayYmd()), next.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [today]);
  return today;
}
