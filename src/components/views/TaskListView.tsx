'use client';
/* Twodo · a list of tasks: one of your lists, or a smart list (Today, Upcoming, Reminders, Together, Pinned, All, Completed) */
import { useRef } from 'react';
import { haptic } from '@/lib/feedback';
import { useFlip } from '@/hooks/useFlip';
import { renderNow } from '@/lib/render';
import { D, L, SMART, fmtDate, liveTasks, listOf, lists, myName, partnerKey, ptName, save, sortTasks, whoMatch, type SmartKey } from '@/lib/store';
import type { Task } from '@/lib/types';
import { dayDiff, fromYmd, nowHM, pad, shortName, todayStr, ymd } from '@/lib/util';
import { alertsOn, specKey, viewPrefs, viewTitle, type Spec } from '@/ui/nav';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { openSettings } from '../settings/Settings';
import { VaultGate, vaultBlocks } from '../vault/VaultUI';
import { Empty, TaskGroup, type Group, type RowCtx } from './TaskRow';

function buildGroups(spec: Spec, tasks: Task[], sortMode: string): Group[] {
  const t0 = todayStr(), S = (arr: Task[]) => sortTasks(arr, sortMode);
  if (spec.type === 'list' || spec.key === 'pinned') return [{ title: '', items: S(tasks) }];
  if (spec.key === 'today') {
    const od = tasks.filter(t => t.due! < t0), td = tasks.filter(t => t.due === t0);
    const any = td.filter(t => !t.time), m = td.filter(t => t.time && t.time < '12:00');
    const a = td.filter(t => t.time && t.time >= '12:00' && t.time < '17:00'), n = td.filter(t => t.time && t.time >= '17:00');
    const other = od.length || m.length || a.length || n.length;
    return [{ title: 'Overdue', cls: 'red', items: S(od) }, { title: other ? 'Today' : '', items: S(any) },
      { title: 'Morning', items: S(m) }, { title: 'Afternoon', items: S(a) }, { title: 'Tonight', items: S(n) }];
  }
  if (spec.key === 'upcoming') {
    const by = new Map<string, Group>();
    for (const t of S(tasks)) {
      const diff = dayDiff(t.due!, t0), d = fromYmd(t.due!);
      const key = diff <= 7 ? t.due! : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      if (!by.has(key)) {
        const sameYear = d.getFullYear() === new Date().getFullYear();
        by.set(key, diff <= 7
          ? { title: fmtDate(t.due!, { long: true }), small: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), items: [] }
          : { title: d.toLocaleDateString([], { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }), items: [] });
      }
      by.get(key)!.items.push(t);
    }
    return [...by.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(e => e[1]);
  }
  if (spec.key === 'reminders') {
    const at = (t: Task) => t.due + ' ' + t.time, hm = nowHM();
    const byTime = (arr: Task[]) => arr.sort((x, y) => at(x).localeCompare(at(y)));
    const missed = tasks.filter(t => t.due! < t0 || (t.due === t0 && t.time! < hm)), next = byTime(tasks.filter(t => !missed.includes(t)));
    const by = new Map<string, Group>();
    for (const t of next) { if (!by.has(t.due!)) by.set(t.due!, { title: fmtDate(t.due!, { long: true }), items: [] }); by.get(t.due!)!.items.push(t); }
    return [{ title: 'Missed', cls: 'red', items: byTime(missed) }, ...by.values()];
  }
  if (spec.key === 'all') return lists().map(l => ({ title: `${l.emoji} ${l.name}`, color: l.color, items: S(tasks.filter(t => listOf(t).id === l.id)) }));
  if (spec.key === 'us') return [
    { title: 'Overdue', cls: 'red', items: S(tasks.filter(t => t.due && t.due < t0)) },
    { title: 'Today', items: S(tasks.filter(t => t.due === t0)) },
    { title: 'Coming up', items: S(tasks.filter(t => t.due && t.due > t0)) },
    { title: 'Someday', items: S(tasks.filter(t => !t.due)) }];
  if (spec.key === 'done') {
    const by = new Map<string, Group>();
    tasks.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 300).forEach(t => {
      const k = ymd(new Date(t.doneAt || 0));
      if (!by.has(k)) by.set(k, { title: fmtDate(k, { long: true }), items: [] });
      by.get(k)!.items.push(t);
    });
    return [...by.values()];
  }
  return [{ title: '', items: S(tasks) }];
}

const EMPTY: Record<SmartKey, [string, string, string]> = {
  today: ['☀️', 'Nothing due today', 'Enjoy the free time — or add something below.'],
  upcoming: ['🗓️', 'Nothing scheduled', 'Add a date as you type, like “fri 6pm”.'],
  us: ['💞', 'Nothing shared yet', 'Type “@us” to make a task for both of you.'],
  pinned: ['📌', 'Nothing pinned', 'Swipe left on a task to pin it here.'],
  all: ['🌿', 'All clear', 'Your to-do list is empty. Nice.'],
  done: ['✅', 'Nothing completed yet', 'Finished tasks show up here.'],
  reminders: ['🔔', 'No reminders yet', 'Give a to-do a time, like “call mom 6pm”, and it shows up here.'],
};

export function TaskListView({ spec }: { spec: Spec }) {
  const key = specKey(spec), vp = viewPrefs(key), listRef = useRef<HTMLDivElement>(null);
  useFlip(listRef, key); // rows slide into place when one is added, completed, deleted or moved
  const who = vp.who || 'all', showDone = !!vp.showDone, isDone = spec.key === 'done';
  let color: string, heading: string, sub: React.ReactNode = '', base: Task[], doneSet: Task[] = [];
  if (spec.type === 'list' && vaultBlocks(spec.id)) return <VaultGate />;
  const live = liveTasks({ secret: spec.type === 'list' }).filter(t => isDone ? (who === 'all' || t.doneBy === (who === 'me' ? L.me : partnerKey()) || (who === 'both' && t.assignee === 'both')) : whoMatch(t, who));
  if (spec.type === 'list') {
    const l = D.lists[spec.id!];
    if (!l || l.deleted) return <Empty e="🤷" h="This list is gone" p="It was deleted." />;
    color = l.color; heading = `${l.emoji} ${l.name}`;
    const mine = live.filter(t => listOf(t).id === l.id);
    base = mine.filter(t => !t.done); doneSet = mine.filter(t => t.done);
    sub = l.private ? <><Icon name="lock" cls="xs" /> Secret · only on this phone, never synced</> : `${base.length} to do`;
  } else {
    const sm = SMART[spec.key!];
    color = sm.color; heading = viewTitle(spec);
    base = live.filter(sm.match); doneSet = live.filter(sm.doneMatch);
    if (spec.key === 'today') sub = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    else if (spec.key === 'us') sub = 'Shared between you two 💞';
    else if (spec.key === 'reminders') sub = alertsOn() ? <><Icon name="bell" cls="xs" /> You’ll get an alert at each time</> : <>Alerts are off · <button className="link-btn" type="button" onClick={() => openSettings()}>Turn on</button></>;
    else sub = `${base.length} ${isDone ? 'completed' : 'to do'}`;
  }
  const groups = buildGroups(spec, base, vp.sort || 'smart').filter(g => g.items.length);
  const ctx: RowCtx = { showList: spec.type !== 'list', doneView: isDone, hideToday: spec.key === 'today' };
  let empty: [string, string, string] | null = null;
  if (!groups.length) empty = spec.type === 'list' ? [D.lists[spec.id!].emoji, 'No tasks yet', 'Type below to add your first one.'] : EMPTY[spec.key!];
  return (<>
    <h1 className="large-title" style={{ color: `var(--c-${color})` }}>{heading}</h1>
    <div className="subtitle">{sub}</div>
    <Segmented name="who" cls="who" opts={[['all', 'All'], ['me', shortName(myName())], ['partner', shortName(ptName())], ['both', 'Us']]} value={who}
      onChange={v => { viewPrefs(key).who = v; save(); renderNow(); }} />
    <div ref={listRef} className="vlist">
      {empty ? <Empty e={empty[0]} h={empty[1]} p={empty[2]} /> : groups.map((g, i) => <TaskGroup key={g.title + i} g={g} ctx={ctx} />)}
      {!isDone && doneSet.length ? (<>
        <button className="done-toggle" type="button" onClick={() => { vp.showDone = !vp.showDone; save(); renderNow(); haptic('light'); }}><span>{doneSet.length} completed</span><b>{showDone ? 'Hide' : 'Show'}</b></button>
        {showDone ? <TaskGroup g={{ title: '', items: doneSet.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) }} ctx={ctx} /> : null}
      </>) : null}
    </div>
  </>);
}
