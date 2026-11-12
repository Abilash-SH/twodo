'use client';
/* Twodo · long-press menu on a task, and the "…" menu on a list */
import { haptic } from '@/lib/feedback';
import { scheduleRender } from '@/lib/render';
import { D, L, commit, listOf, liveTasks, lists, partnerKey, save, updateTask } from '@/lib/store';
import type { Task } from '@/lib/types';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { setMenuContent, showMenu } from '@/ui/menu';
import { specKey, topSpec, viewPrefs, type Spec } from '@/ui/nav';
import { deleteTask, duplicateTask, leaveThen, quickDue, shareList, toggleDone, togglePin } from '@/ui/tasks';
import { openFocus } from '../overlays/FocusOverlay';
import { openListSheet } from '../sheets/ListSheet';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { TaskRowInner } from './TaskRow';

function TaskMenu({ t }: { t: Task }) {
  const as: [string, React.ReactNode][] = [['', '–'], [L.me, <Avatar key="m" k={L.me} />], [partnerKey(), <Avatar key="p" k={partnerKey()} />], ['both', 'Us']];
  return (<>
    <div className="mpal">
      <button data-m="due" data-v="0" type="button"><Icon name="cal" />Today</button>
      <button data-m="due" data-v="1" type="button"><Icon name="sunrise" />Tomorrow</button>
      <button data-m="due" data-v="we" type="button"><Icon name="sofa" />Weekend</button>
      <button data-m="due" data-v="nw" type="button"><Icon name="calnext" />Next Week</button></div>
    <div className="mgap" />
    <button className="mi" data-m="done" type="button">{t.done ? 'Mark as Not Done' : 'Complete'}<Icon name="check" /></button>
    <button className="mi" data-m="pin" type="button">{t.pinned ? 'Unpin' : 'Pin'}<Icon name="pin" /></button>
    <button className="mi" data-m="focus" type="button">Focus Timer<Icon name="timer" /></button>
    <button className="mi" data-m="move" type="button">Move to List…<Icon name="list" /></button>
    <button className="mi" data-m="dup" type="button">Duplicate<Icon name="copy" /></button>
    {t.due ? <button className="mi" data-m="due" data-v="none" type="button">Remove Date<Icon name="x" /></button> : null}
    <div className="mgap" />
    <div className="mrow"><span className="lbl">Priority</span><div className="opts">{[0, 1, 2, 3].map(p => <button key={p} data-m="prio" data-v={p} className={(t.priority || 0) === p ? 'on' : ''} type="button">{p ? '!'.repeat(p) : '–'}</button>)}</div></div>
    <div className="mrow"><span className="lbl">For</span><div className="opts">{as.map(([k, l]) => <button key={k || 'none'} data-m="assign" data-v={k} className={(t.assignee || '') === k ? 'on' : ''} type="button">{l}</button>)}</div></div>
    <div className="mgap" />
    <button className="mi red" data-m="del" type="button">Delete<Icon name="trash" /></button>
  </>);
}
const MoveMenu = ({ t }: { t: Task }) => (<>
  <button className="mi" data-m="back" type="button"><Icon name="chevL" /><span className="tw:flex-1">Back</span></button><div className="mgap" />
  {lists().map(l => <button key={l.id} className="mi" data-m="moveto" data-v={l.id} type="button"><span>{l.emoji} {l.name}</span>{listOf(t).id === l.id ? <Icon name="check" cls="ck" /> : null}</button>)}
</>);

export function openTaskMenu(row: HTMLElement): void {
  const id = row.dataset.id!, t = D.tasks[id]; if (!t) return;
  haptic('medium');
  showMenu({
    rect: row.getBoundingClientRect(), preview: <TaskRowInner t={t} />, taskId: id, content: <TaskMenu t={t} />,
    onPick: (m, v) => {
      switch (m) {
        case 'due': return quickDue(id, v);
        case 'done': return toggleDone(id);
        case 'pin': return togglePin(id);
        case 'focus': return openFocus(id);
        case 'dup': return duplicateTask(id);
        case 'del': return deleteTask(id);
        case 'prio': return updateTask(id, { priority: Number(v) as Task['priority'] });
        case 'assign': return updateTask(id, { assignee: (v || null) as Task['assignee'] });
        case 'move': setMenuContent(<MoveMenu t={D.tasks[id]} />); return 'keep';
        case 'back': setMenuContent(<TaskMenu t={D.tasks[id]} />); return 'keep';
        case 'moveto': {
          const l = D.lists[v!]; if (!l) return;
          // leaving this list: the row fades out and the others close the gap; in any other view it just updates
          const s = topSpec(), gone = s.type === 'list' && s.id !== l.id;
          if (gone) setTimeout(() => leaveThen(id, () => updateTask(id, { listId: l.id })), 260); // after the menu closes
          else updateTask(id, { listId: l.id });
          island({ e: l.emoji, text: `Moved to ${l.name}`, sub: l.private ? 'Secret · not synced' : '', ms: 1600 });
          return;
        }
      }
    },
  });
}

export function openViewMenu(btn: HTMLElement, spec: Spec): void {
  const vp = viewPrefs(specKey(spec)), sort = vp.sort || 'smart';
  const sorts: [string, string][] = [['smart', 'Smart'], ['due', 'Due Date'], ['priority', 'Priority'], ['created', 'Date Added'], ['alpha', 'Title']];
  const isList = spec.type === 'list', isDone = spec.key === 'done';
  showMenu({
    rect: btn.getBoundingClientRect(), align: 'right',
    content: (<>
      {isDone ? null : (<>
        <div className="mrow"><span className="lbl">Sort by</span></div>
        {sorts.map(([k, l]) => <button key={k} className="mi" data-m="sort" data-v={k} type="button"><span>{l}</span>{sort === k ? <Icon name="check" cls="ck" /> : null}</button>)}
        <div className="mgap" /><button className="mi" data-m="showdone" type="button">{vp.showDone ? 'Hide' : 'Show'} Completed<Icon name="check" /></button>
      </>)}
      {isList ? (<><button className="mi" data-m="editlist" type="button">Edit List…<Icon name="edit" /></button><button className="mi" data-m="sharelist" type="button">Share as Text<Icon name="share" /></button></>) : null}
      <button className="mi red" data-m="cleardone" type="button">Clear Completed<Icon name="trash" /></button>
    </>),
    onPick: async (m, val) => {
      if (m === 'sort') { vp.sort = val; save(); scheduleRender(); }
      else if (m === 'showdone') { vp.showDone = !vp.showDone; save(); scheduleRender(); }
      else if (m === 'editlist') openListSheet(spec.id!);
      else if (m === 'sharelist') void shareList(spec.id!);
      else if (m === 'cleardone') {
        const done = liveTasks({ secret: isList }).filter(t => t.done && (isList ? listOf(t).id === spec.id : true));
        if (!done.length) return island({ e: '🧹', text: 'Nothing to clear', ms: 1400 });
        if (await confirmDialog({ title: `Clear ${done.length} completed?`, message: isList ? 'They’ll be removed from this list.' : 'This clears completed tasks in every list.', ok: 'Clear', destructive: true })) {
          done.forEach(t => { t.deleted = true; commit(t, { silent: true }); });
          scheduleRender(); island({ e: '🧹', text: `Cleared ${done.length} tasks` });
        }
      }
    },
  });
}
