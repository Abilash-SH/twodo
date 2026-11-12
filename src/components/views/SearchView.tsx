'use client';
/* Twodo · search titles, notes, subtasks and #tags across every list */
import { liveTasks, sortTasks } from '@/lib/store';
import { Empty, TaskGroup, type RowCtx } from './TaskRow';

export function SearchView({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const query = q.trim().toLowerCase();
  if (!query) {
    const tags = [...new Set(liveTasks().flatMap(t => t.tags || []))].slice(0, 24);
    return (<>
      <Empty e="🔎" h="Search everything" p="Titles, notes, subtasks and tags across all lists." />
      {tags.length ? <div className="pills" style={{ maxHeight: 'none', opacity: 1, flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px' }}>
        {tags.map(tg => <button key={tg} className="pill" type="button" onClick={() => setQ('#' + tg)}>#{tg}</button>)}</div> : null}
    </>);
  }
  const hit = (t: ReturnType<typeof liveTasks>[number]) => query.startsWith('#') ? (t.tags || []).includes(query.slice(1))
    : (t.title + ' ' + t.notes + ' ' + (t.tags || []).join(' ') + ' ' + (t.subtasks || []).map(s => s.title).join(' ')).toLowerCase().includes(query);
  const res = liveTasks().filter(hit);
  const act = sortTasks(res.filter(t => !t.done)), dn = res.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 50);
  const ctx: RowCtx = { showList: true };
  if (!res.length) return <Empty e="🫥" h="No results" p={`Nothing matches “${query}”.`} />;
  return (<>
    {!act.length ? <div className="sec-h">No open tasks</div> : null}
    <TaskGroup g={{ title: `${act.length} result${act.length === 1 ? '' : 's'}`, items: act }} ctx={ctx} />
    <TaskGroup g={{ title: 'Completed', items: dn }} ctx={ctx} />
  </>);
}
