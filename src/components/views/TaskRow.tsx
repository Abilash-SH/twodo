'use client';
/* Twodo · a task row: swipe right to complete, left for Pin / Delete, long-press for quick actions, tap for details */
import { L, fmtDue, fmtTime, listOf, person } from '@/lib/store';
import type { Task } from '@/lib/types';
import { REPEATS, nowHM, todayStr } from '@/lib/util';
import { Fresh, Leaving, Pending, Popping } from '@/ui/tasks';
import { AssigneeBadge, colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

export interface RowCtx { showList?: boolean; doneView?: boolean; hideToday?: boolean }

/** the visible part of the row (also used as the lifted preview in the long-press menu) */
export function TaskRowInner({ t, ctx = {} }: { t: Task; ctx?: RowCtx }) {
  const list = listOf(t), checked = t.done || Pending.has(t.id), t0 = todayStr();
  const meta: React.ReactNode[] = [];
  if (ctx.doneView && t.done) meta.push(<span key="d"><Icon name="check" cls="xs" /> {t.doneBy === L.me ? 'You' : person(t.doneBy || 'a').name} · {new Date(t.doneAt || 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>);
  else if (t.due || t.time) {
    const od = !t.done && !!t.due && (t.due < t0 || (t.due === t0 && !!t.time && t.time < nowHM()));
    const label = ctx.hideToday && t.due === t0 ? fmtTime(t.time) : fmtDue(t.due, t.time);
    if (label) meta.push(<span key="due" className={od ? 'od' : ''}><Icon name="cal" cls="xs" /> {label}</span>);
  }
  if (t.repeat) meta.push(<span key="r"><Icon name="repeat" cls="xs" /> {REPEATS[t.repeat] || ''}</span>);
  if (ctx.showList) meta.push(<span key="l"><i className="dot" style={colorVar(list.color)} />{list.name}</span>);
  if (t.subtasks && t.subtasks.length) meta.push(<span key="s"><Icon name="list" cls="xs" /> {t.subtasks.filter(s => s.done).length}/{t.subtasks.length}</span>);
  if (t.notes) meta.push(<span key="n"><Icon name="note" cls="xs" /></span>);
  if (t.pomos) meta.push(<span key="p">🍅 {t.pomos}</span>);
  (t.tags || []).forEach(tg => meta.push(<span key={'#' + tg} className="tag">#{tg}</span>));
  return (
    <div className="ti">
      <button className="chk" type="button" role="checkbox" aria-checked={checked} aria-label={`Complete ${t.title}`}><Icon name="check" /></button>
      <div className="tb"><div className="tt"><span>{t.priority ? <b className="prio">{'!'.repeat(t.priority)}</b> : null}{t.title}</span></div>{meta.length ? <div className="tm">{meta}</div> : null}</div>
      <div className="tr">{t.pinned ? <Icon name="pin" cls="pin-ic" /> : null}<AssigneeBadge a={t.assignee} /></div>
    </div>
  );
}

export function TaskRow({ t, ctx }: { t: Task; ctx: RowCtx }) {
  const checked = t.done || Pending.has(t.id);
  const cls = `task p${t.priority || 0}${checked ? ' checked' : ''}${Fresh.has(t.id) ? ' enter' : ''}${Popping.has(t.id) ? ' pop' : ''}${Leaving.has(t.id) ? ' leaving' : ''}`;
  return (
    <div className={cls} data-id={t.id}>
      <div className="acts"><div className="act-l"><Icon name="check" /><span>{t.done ? 'Not done' : 'Done'}</span></div>
        <div className="act-r"><button className="pinb" data-act="pin" type="button"><Icon name="pin" /><span>{t.pinned ? 'Unpin' : 'Pin'}</span></button>
          <button className="delb" data-act="del" type="button"><Icon name="trash" /><span>Delete</span></button></div></div>
      <TaskRowInner t={t} ctx={ctx} />
    </div>
  );
}

export interface Group { title: string; cls?: string; color?: string; small?: string; items: Task[] }
export function TaskGroup({ g, ctx }: { g: Group; ctx: RowCtx }) {
  if (!g.items.length) return null;
  return (<>
    {g.title ? <div className={`sec-h ${g.cls || ''}`.trim()} style={g.color ? { color: `var(--c-${g.color})` } : undefined}>{g.title}{g.small ? <small>{g.small}</small> : null}</div> : null}
    <div className="group tasks">{g.items.map(t => <TaskRow key={t.id} t={t} ctx={ctx} />)}</div>
  </>);
}
export const Empty = ({ e, h, p }: { e: string; h: string; p: string }) => <div className="empty"><span className="e">{e}</span><h3>{h}</h3><p>{p}</p></div>;
