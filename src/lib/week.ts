/* Twodo · weeks for the planner: Monday to Sunday, and the week's goals (docs/journal-and-planner.md) */
import { D, commit, liveTasks } from './store';
import type { Goal, Task } from './types';
import { addDays, fromYmd, todayStr, uid, ymd } from './util';

export const MAX_GOALS = 3;
/** a day with this many open to-dos gets a gentle "busy day" mark */
export const BUSY = 6;

/** the Monday of the week a day is in */
export function weekOf(day: string): string { const d = fromYmd(day); return ymd(addDays(d, -((d.getDay() + 6) % 7))); }
export const thisWeek = (): string => weekOf(todayStr());
export const weekDays = (start: string): string[] => Array.from({ length: 7 }, (_, i) => ymd(addDays(fromYmd(start), i)));
export const shiftWeek = (start: string, n: number): string => ymd(addDays(fromYmd(start), 7 * n));

/** "This week", "Next week", "Last week", or the dates */
export function weekName(start: string): string {
  const diff = Math.round((fromYmd(start).getTime() - fromYmd(thisWeek()).getTime()) / (7 * 864e5));
  if (diff === 0) return 'This week';
  if (diff === 1) return 'Next week';
  if (diff === -1) return 'Last week';
  return weekRange(start);
}
let rangeFmt: Intl.DateTimeFormat | null = null;
export function weekRange(start: string): string {
  const a = fromYmd(start), b = addDays(a, 6), f = (rangeFmt = rangeFmt || new Intl.DateTimeFormat([], { day: 'numeric', month: 'short' }));
  try { return f.formatRange(a, b); } catch { return `${f.format(a)} – ${f.format(b)}`; } // "Nov 16 – 22" or "16–22 Nov", as the phone writes dates
}

/* ---------- goals: up to three for a week, shared by the two of you ---------- */
export const weekGoals = (week: string): Goal[] =>
  Object.values(D.goals).filter(g => !g.deleted && g.week === week && g.text).sort((a, b) => a.order - b.order);
export function addGoal(week: string, text: string): Goal | null {
  const t = text.trim().slice(0, 200);
  if (!t || weekGoals(week).length >= MAX_GOALS) return null;
  const g: Goal = { kind: 'goal', id: uid(), week, text: t, done: false, order: Date.now(), createdAt: Date.now(), updatedAt: 0, deleted: false };
  D.goals[g.id] = g;
  return commit(g);
}
export function updateGoal(id: string, patch: Partial<Pick<Goal, 'text' | 'done' | 'deleted'>>): void {
  const g = D.goals[id]; if (!g) return;
  Object.assign(g, patch);
  commit(g);
}

/* ---------- the to-dos of a week (never a secret list's: liveTasks() leaves them out) ---------- */
export interface Day { day: string; open: Task[]; done: Task[] }
export function weekPlan(start: string): { days: Day[]; later: Task[]; overdue: Task[] } {
  const days = weekDays(start), by = new Map<string, Day>(days.map(d => [d, { day: d, open: [], done: [] }]));
  const later: Task[] = [], overdue: Task[] = [], today = todayStr(), isNow = start === thisWeek();
  for (const t of liveTasks()) {
    if (!t.title) continue;
    if (!t.due) { if (!t.done) later.push(t); continue; }
    const d = by.get(t.due);
    if (d) (t.done ? d.done : d.open).push(t);
    else if (isNow && !t.done && t.due < start && t.due < today) overdue.push(t); // from before this week, still open
  }
  return { days: [...by.values()], later, overdue };
}
