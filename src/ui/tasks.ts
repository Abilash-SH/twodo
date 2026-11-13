/* Twodo · task actions: complete (with a short "check" animation you can cancel), delete, pin, duplicate, move dates */
import { blip, confetti, haptic } from '@/lib/feedback';
import { renderNow, scheduleRender } from '@/lib/render';
import { D, L, SMART, commit, fmtDate, fmtDue, liveTasks, listOf, makeTask, nextDue, snapshot, sortTasks, updateTask } from '@/lib/store';
import type { Task } from '@/lib/types';
import { MS } from '@/lib/motion';
import { addDays, copyText, reducedMotion, todayStr, uid, ymd } from '@/lib/util';
import { island } from './island';
import { specKey, topSpec, viewPrefs } from './nav';

export const Pending = new Map<string, ReturnType<typeof setTimeout>>(); // task id → timer while the check animation plays
export const Fresh = new Set<string>();   // task ids that should animate in
export const Popping = new Set<string>(); // check circle "pop"
export const Leaving = new Set<string>(); // rows collapsing away

// every row showing this task: in a list, or on the board's Today note
const rowsFor = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`#stack :is(.task, .bn-task)[data-id="${CSS.escape(id)}"]`));
function pop(id: string) { Popping.add(id); setTimeout(() => { Popping.delete(id); scheduleRender(); }, 500); }
// the row fades out where it is; once it's gone the rows below slide up into its place (hooks/useFlip.ts)
export function leaveThen(id: string, cb: () => void) {
  const rows = rowsFor(id);
  if (!rows.length || reducedMotion.matches) return cb();
  Leaving.add(id); renderNow();
  setTimeout(() => { Leaving.delete(id); cb(); }, MS.quick + 60);
}
const collapseRows = leaveThen;
const viewShowsDone = () => { const s = topSpec(); return s.type !== 'home' && !!viewPrefs(specKey(s)).showDone; };

export function toggleDone(id: string, { instant = false } = {}): void {
  const t = D.tasks[id]; if (!t) return;
  if (Pending.has(id)) { // tapped again during the animation → cancel
    clearTimeout(Pending.get(id)); Pending.delete(id); renderNow(); haptic('light'); return;
  }
  if (t.done) { updateTask(id, { done: false, doneAt: null, doneBy: null }); haptic('light'); return; }
  haptic('success'); blip('done');
  const keep = viewShowsDone() || topSpec().key === 'done';
  Pending.set(id, setTimeout(() => {
    Pending.delete(id);
    if (keep || instant) completeNow(id); else collapseRows(id, () => completeNow(id));
  }, instant ? 0 : 700));
  pop(id); renderNow();
}
export function completeNow(id: string): void {
  const t = D.tasks[id]; if (!t || t.done) return;
  const wasToday = SMART.today.match(t);
  const before = snapshot(t);
  let spawned: Task | null = null;
  if (t.repeat) {
    spawned = makeTask({
      title: t.title, notes: t.notes, listId: t.listId, priority: t.priority, tags: [...(t.tags || [])], assignee: t.assignee,
      subtasks: (t.subtasks || []).map(s => ({ ...s, done: false })), repeat: t.repeat, pinned: t.pinned, time: t.time,
      due: nextDue(t.due, t.repeat), createdBy: t.createdBy,
    });
  }
  updateTask(id, { done: true, doneAt: Date.now(), doneBy: L.me });
  const cleared = wasToday && !liveTasks().some(SMART.today.match);
  if (cleared) { setTimeout(confetti, 150); blip('chime'); }
  island({
    e: cleared ? '🎉' : '✅',
    text: cleared ? 'Today is all done!' : `Completed “${t.title}”`,
    sub: spawned ? `Repeats · next ${fmtDue(spawned.due, spawned.time)}` : cleared ? 'Go enjoy yourselves 💞' : '',
    btn: 'Undo',
    onBtn: () => {
      Object.assign(D.tasks[id], before); commit(D.tasks[id]);
      if (spawned) { spawned.deleted = true; commit(spawned); }
    },
  });
}
export function deleteTask(id: string, { animate = true } = {}): void {
  const t = D.tasks[id]; if (!t) return;
  const before = snapshot(t);
  haptic('medium');
  const go = () => {
    updateTask(id, { deleted: true });
    island({ e: '🗑️', text: `Deleted “${t.title}”`, btn: 'Undo', onBtn: () => { Object.assign(D.tasks[id], before); Fresh.add(id); commit(D.tasks[id]); } });
  };
  if (animate) collapseRows(id, go); else go();
}
export function togglePin(id: string): void {
  const t = D.tasks[id]; if (!t) return;
  updateTask(id, { pinned: !t.pinned });
  haptic('light');
  island({ e: '📌', text: t.pinned ? 'Pinned to the top' : 'Unpinned', ms: 1500 });
}
export function duplicateTask(id: string): Task | undefined {
  const t = D.tasks[id]; if (!t) return;
  const c: Partial<Task> = snapshot(t);
  delete c.id; delete c.updatedAt; delete c._s;
  const n = makeTask({ ...c, title: t.title, done: false, doneAt: null, doneBy: null, createdAt: Date.now(), createdBy: L.me, subtasks: (t.subtasks || []).map(s => ({ ...s, id: uid(), done: false })) });
  Fresh.add(n.id);
  island({ e: '📄', text: 'Duplicated', ms: 1500 });
  return n;
}
export function quickDue(id: string, v: string | undefined): void {
  const now = new Date(), d = now.getDay();
  const due = v === '0' ? todayStr() : v === '1' ? ymd(addDays(now, 1))
    : v === 'we' ? ymd(addDays(now, d === 6 || d === 0 ? 0 : 6 - d))
    : v === 'nw' ? ymd(addDays(now, ((1 - d + 7) % 7) || 7)) : null;
  updateTask(id, { due });
  island({ e: '📅', text: due ? `Moved to ${fmtDate(due, { long: true })}` : 'Date removed', ms: 1500 });
}
export async function shareList(id: string): Promise<void> {
  const l = D.lists[id]; if (!l) return;
  const ts = sortTasks(liveTasks({ secret: true }).filter(t => listOf(t).id === id && !t.done));
  const text = `${l.emoji} ${l.name}\n` + ts.map(t => `☐ ${t.title}${t.due ? ` (${fmtDue(t.due, t.time)})` : ''}`).join('\n');
  if (navigator.share) { try { await navigator.share({ title: l.name, text }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
  if (await copyText(text)) island({ e: '📋', text: 'List copied', ms: 1600 });
}
