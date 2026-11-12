/* Twodo · a few starter tasks that teach the gestures */
import { makeTask, ptName } from '@/lib/store';
import { firstWord, todayStr } from '@/lib/util';
import type { Task } from '@/lib/types';

export function seedTasks(): void {
  const t0 = todayStr(), pt = firstWord(ptName()).toLowerCase();
  const add = (p: Partial<Task>) => makeTask({ createdBy: 'a', ...p });
  add({ title: 'Tap the circle to complete me', due: t0 });
  add({ title: 'Swipe me right to finish, or left to pin', due: t0 });
  add({ title: 'Long-press me for quick actions', due: t0, priority: 1 });
  add({ title: `Try typing “Movie night fri 8pm @${pt} !!”`, notes: 'Twodo understands dates, times, @people, #lists, !priority and repeats like “every monday”.' });
  add({ title: 'Sunset picnic 🧺', listId: 'dates', assignee: 'both' });
  add({ title: 'Cook something new together 🍝', listId: 'dates', assignee: 'both' });
  add({ title: 'Strawberries 🍓', listId: 'groceries' });
}
