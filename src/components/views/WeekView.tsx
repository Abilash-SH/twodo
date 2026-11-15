'use client';
/* Twodo · the week. A planner for two: up to three goals for the week, a ribbon of seven days that shows how full each
   day is and for whom (your colour, your partner's, both), the days themselves, what isn't planned yet, and from
   Friday a look back. Planning a to-do only changes its date; the goals are the one new thing it stores
   (docs/journal-and-planner.md). Nothing from a secret list appears here. */
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { renderNow } from '@/lib/render';
import { L, fmtDate, liveTasks, partnerKey, ptName, save, sortTasks, updateTask } from '@/lib/store';
import type { Task } from '@/lib/types';
import { addDays, firstWord, fromYmd, reducedMotion, todayStr, ymd } from '@/lib/util';
import { BUSY, MAX_GOALS, addGoal, shiftWeek, thisWeek, updateGoal, weekGoals, weekName, weekPlan, weekRange, type Day } from '@/lib/week';
import { useFlip } from '@/hooks/useFlip';
import { island } from '@/ui/island';
import { plannerDay, plannerWeek, viewPrefs } from '@/ui/nav';
import { cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { TaskRow, type RowCtx } from './TaskRow';

const ROW: RowCtx = { showList: true, timeOnly: true };
// one formatter of each kind, made once: building them (what toLocaleDateString does every call) was most of the
// cost of opening the week inside the tap
const FMT: Record<string, Intl.DateTimeFormat> = {};
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => (FMT[k] = FMT[k] || new Intl.DateTimeFormat([], o));
const weekday = (day: string, style: 'long' | 'narrow' = 'long') => fmt(style, { weekday: style }).format(fromYmd(day));
const dayMonth = (day: string) => fmt('dm', { day: 'numeric', month: 'short' }).format(fromYmd(day));

/** how a day's open to-dos split between the two of you: yours, your partner's, both, nobody's */
function split(ts: Task[]) {
  const me = L.me, pt = partnerKey();
  return { me: ts.filter(t => t.assignee === me).length, pt: ts.filter(t => t.assignee === pt).length,
    both: ts.filter(t => t.assignee === 'both').length, none: ts.filter(t => !t.assignee).length };
}

function Tile({ d, sel, onPick }: { d: Day; sel: boolean; onPick: () => void }) {
  const n = d.open.length, s = split(d.open), today = d.day === todayStr(), busy = n >= BUSY, scale = Math.max(BUSY, n);
  const label = `${weekday(d.day)} ${dayMonth(d.day)}: ${n ? `${n} to do` : 'nothing planned'}${busy ? ', a busy day' : ''}${today ? ', today' : ''}`;
  return (
    <button className={`wk-tile${sel ? ' on' : ''}${today ? ' today' : ''}${busy ? ' busy' : ''}${d.day < todayStr() ? ' past' : ''}`} type="button"
      aria-label={label} aria-pressed={sel} onClick={onPick}>
      <span className="wk-wd" aria-hidden="true">{weekday(d.day, 'narrow')}</span>
      <span className="wk-dn" aria-hidden="true">{fromYmd(d.day).getDate()}</span>
      <span className="wk-load" aria-hidden="true">
        {s.me ? <i className="me" style={{ flexGrow: s.me }} /> : null}
        {s.pt ? <i className="pt" style={{ flexGrow: s.pt }} /> : null}
        {s.both ? <i className="both" style={{ flexGrow: s.both }} /> : null}
        {s.none ? <i className="none" style={{ flexGrow: s.none }} /> : null}
        {scale > n ? <i className="gap" style={{ flexGrow: scale - n }} /> : null}
      </span>
    </button>
  );
}

function DaySection({ d, sel, onAdd }: { d: Day; sel: boolean; onAdd: (day: string) => void }) {
  const today = d.day === todayStr(), past = d.day < todayStr(), n = d.open.length;
  const rows = [...sortTasks(d.open.slice()), ...d.done.slice().sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))];
  return (
    <section className={`wk-day${today ? ' today' : ''}${past ? ' past' : ''}${sel ? ' picked' : ''}`} id={`wk-${d.day}`} aria-labelledby={`wkh-${d.day}`}>
      <header className="wk-dh">
        <h3 id={`wkh-${d.day}`}><span className="wk-dname">{weekday(d.day)}</span> <span className="wk-ddate">{dayMonth(d.day)}</span></h3>
        {today ? <span className="wk-chip today">Today</span> : null}
        {n >= BUSY ? <span className="wk-chip busy">Busy day</span> : null}
        <span className="wk-n">{n ? `${n} to do` : d.done.length ? 'All done' : ''}</span>
      </header>
      {rows.length ? <div className="group tasks">{rows.map(t => <TaskRow key={t.id} t={t} ctx={ROW} />)}</div> : null}
      {past ? (rows.length ? null : <p className="wk-none">Nothing planned</p>)
        : <button className="wk-add" type="button" onClick={() => onAdd(d.day)}><Icon name="plus" cls="sm" />{rows.length ? `Add to ${weekday(d.day)}` : `Plan something for ${weekday(d.day)}`}</button>}
    </section>
  );
}

/* ---------- goals: up to three, shared, ticked off together ---------- */
function Goals({ week }: { week: string }) {
  const goals = weekGoals(week), [draft, setDraft] = useState('');
  const commitDraft = (keep: boolean, el?: HTMLInputElement) => {
    if (!draft.trim()) return;
    if (addGoal(week, draft)) { setDraft(''); haptic('light'); if (keep && weekGoals(week).length < MAX_GOALS) el?.focus(); else el?.blur(); }
  };
  const done = goals.filter(g => g.done).length;
  return (
    <section className="wk-goals" aria-labelledby="wk-gh">
      <div className="wk-gh"><h2 id="wk-gh">Goals for the week</h2>{goals.length ? <span>{done} of {goals.length}</span> : null}</div>
      <ol className="wk-glist">
        {goals.map((g, i) => (
          <li key={g.id} className={`wk-goal${g.done ? ' done' : ''}`}>
            <button className="wk-gchk" type="button" role="checkbox" aria-checked={g.done} aria-label={`Goal ${i + 1} reached: ${g.text}`}
              onClick={() => { updateGoal(g.id, { done: !g.done }); haptic(g.done ? 'light' : 'success'); }}>
              <i>{g.done ? <Icon name="check" cls="xs" /> : i + 1}</i></button>
            <input key={g.text} className="wk-gtext" defaultValue={g.text} aria-label={`Goal ${i + 1}`} maxLength={200} enterKeyHint="done"
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              onBlur={e => { const v = e.currentTarget.value.trim(); if (!v) { updateGoal(g.id, { deleted: true }); island({ e: '🗑️', text: 'Goal removed', btn: 'Undo', onBtn: () => updateGoal(g.id, { deleted: false }), ms: 3000 }); } else if (v !== g.text) updateGoal(g.id, { text: v }); }} />
          </li>
        ))}
        {goals.length < MAX_GOALS ? (
          <li className="wk-goal add">
            <span className="wk-gchk" aria-hidden="true"><i>{goals.length + 1}</i></span>
            <input className="wk-gtext" value={draft} maxLength={200} enterKeyHint={goals.length + 1 < MAX_GOALS ? 'next' : 'done'}
              placeholder={goals.length ? 'Another goal' : 'What matters most this week?'} aria-label={`Goal ${goals.length + 1}`}
              onChange={e => setDraft(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(true, e.currentTarget); } }}
              onBlur={() => commitDraft(false)} />
          </li>
        ) : null}
      </ol>
    </section>
  );
}

/* ---------- from Friday (and for past weeks): what the two of you got done, and what's left ---------- */
function LookBack({ start, left }: { start: string; left: Task[] }) {
  const s = fromYmd(start).getTime(), e = addDays(fromYmd(start), 7).getTime();
  const done = liveTasks().filter(t => t.done && t.doneAt && t.doneAt >= s && t.doneAt < e);
  const mine = done.filter(t => t.doneBy === L.me).length, theirs = done.filter(t => t.doneBy === partnerKey()).length;
  const goals = weekGoals(start), reached = goals.filter(g => g.done).length, pt = firstWord(ptName());
  const move = () => {
    for (const t of left) updateTask(t.id, { due: ymd(addDays(fromYmd(t.due!), 7)) });
    haptic('success'); island({ e: '📅', text: `Moved ${left.length} to the week after`, ms: 2000 });
  };
  return (
    <section className="wk-back" aria-labelledby="wk-bh">
      <h2 id="wk-bh">Looking back</h2>
      <p className="wk-big">{done.length ? `You two finished ${done.length} thing${done.length === 1 ? '' : 's'}` : 'A quiet week'}</p>
      {done.length ? (
        <div className="wk-share" role="img" aria-label={`You finished ${mine}, ${pt} finished ${theirs}`}>
          {mine ? <i className="me" style={{ flexGrow: mine }} /> : null}{theirs ? <i className="pt" style={{ flexGrow: theirs }} /> : null}
        </div>) : null}
      {done.length ? <p className="wk-legend"><span className="me">You {mine}</span><span className="pt">{pt} {theirs}</span></p> : null}
      {goals.length ? <p className="wk-goalsum">{reached === goals.length ? `All ${goals.length} goals reached` : `${reached} of ${goals.length} goals reached`}</p> : null}
      {left.length ? <button className="btn-s" type="button" onClick={move}>Move {left.length} unfinished to the week after</button> : null}
    </section>
  );
}

export function WeekView() {
  const days = useRef<HTMLDivElement>(null);
  const start = plannerWeek(), sel = plannerDay(), now = thisWeek(), vp = viewPrefs('week');
  const plan = weekPlan(start);
  useFlip(days, 'week:' + start); // a to-do moved to another day glides there
  // Opening the week (or turning to another one) draws the top of it inside the tap and the rest straight after the
  // first frame, so the slide starts at once; the screen moves on the compositor while the rest is drawn.
  const [drawn, setDrawn] = useState<string | null>(null), whole = drawn === start;
  useEffect(() => {
    if (whole) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const f = requestAnimationFrame(() => { t = setTimeout(() => setDrawn(start), 0); });
    return () => { cancelAnimationFrame(f); clearTimeout(t); };
  }, [start, whole]);
  const open = plan.days.reduce((n, d) => n + d.open.length, 0);
  const go = (n: number) => { vp.week = n ? shiftWeek(start, n) : now; vp.day = undefined; save(); haptic('light'); renderNow(); };
  const pick = (day: string, scroll: boolean) => {
    vp.day = day; save(); renderNow();
    if (scroll) document.getElementById(`wk-${day}`)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  };
  // "Add" on a day: that day is where the task box adds, and the keyboard comes up inside this tap (iPhone)
  const add = (day: string) => { vp.day = day; save(); renderNow(); (document.getElementById('cta') as HTMLTextAreaElement | null)?.focus({ preventScroll: true }); };
  const showBack = start < now || (start === now && [5, 6, 0].includes(new Date().getDay()));
  const left = plan.days.flatMap(d => d.open);
  return (
    <div className="wk" style={cssVars({ '--wk-busy': BUSY })}>
      <h1 className="large-title">{weekName(start)}</h1>
      <div className="wk-sub">
        <span>{weekRange(start)} · {open ? `${open} to do` : 'nothing planned yet'}</span>
        <span className="wk-switch">
          <button className="nav-btn" type="button" aria-label="Previous week" onClick={() => go(-1)}><Icon name="chevL" /></button>
          {start !== now ? <button className="wk-now" type="button" onClick={() => go(0)}>This week</button> : null}
          <button className="nav-btn" type="button" aria-label="Next week" onClick={() => go(1)}><Icon name="chevR" /></button>
        </span>
      </div>
      <Goals week={start} />
      <div className="wk-ribbon" role="group" aria-label="Days of the week">
        {plan.days.map(d => <Tile key={d.day} d={d} sel={d.day === sel} onPick={() => pick(d.day, true)} />)}
      </div>
      {plan.overdue.length ? (
        <div className="wk-overdue">
          <Icon name="clock" cls="sm" /><span>{plan.overdue.length} still open from before</span>
          <button className="link-btn" type="button" onClick={() => {
            for (const t of plan.overdue) updateTask(t.id, { due: todayStr() });
            haptic('light'); island({ e: '📅', text: `Moved ${plan.overdue.length} to today`, ms: 1800 });
          }}>Move to today</button>
        </div>) : null}
      <div ref={days} className="wk-days">
        {(whole ? plan.days : plan.days.slice(0, 2)).map(d => <DaySection key={d.day} d={d} sel={d.day === sel} onAdd={add} />)}
      </div>
      {whole && plan.later.length ? (
        <section className="wk-later">
          <button className="wk-lh" type="button" aria-expanded={!!vp.later} onClick={() => { vp.later = !vp.later; save(); haptic('light'); renderNow(); }}>
            <span className="grow">Not planned yet</span><span className="val">{plan.later.length}</span><Icon name="chevD" cls={vp.later ? 'up' : ''} /></button>
          {vp.later ? (<>
            <div className="group tasks">{sortTasks(plan.later.slice()).slice(0, 40).map(t => <TaskRow key={t.id} t={t} ctx={{ showList: true }} />)}</div>
            <p className="wk-hint">Hold a to-do and pick a day to plan it.</p>
          </>) : null}
        </section>) : null}
      {whole && showBack ? <LookBack start={start} left={start <= now ? left : []} /> : null}
      <p className="wk-foot">{fmtDate(sel) === 'Today' ? 'New to-dos go to today' : `New to-dos go to ${weekday(sel)} ${dayMonth(sel)}`}</p>
    </div>
  );
}
