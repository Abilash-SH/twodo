'use client';
/* Twodo · routines (docs/routines.md). Every day: one punch card per routine, seven holes for the week; tap today's
   hole (or an earlier one this week) to punch it. Your partner's punches show as a dot in their colour under each hole.
   Every week: the quilt you sewed together and, behind it, the receipt. Both computed here, never stored. */
import { haptic } from '@/lib/feedback';
import { renderNow } from '@/lib/render';
import { L, partnerKey, person, save } from '@/lib/store';
import {
  addStarters, bits, canPunch, dayIndex, has, keeps, maskOf, routines, summary, todayCount, togglePunch, STARTERS, type Row,
} from '@/lib/routines';
import type { Routine } from '@/lib/types';
import { firstWord, fromYmd, todayStr } from '@/lib/util';
import { shiftWeek, thisWeek, weekDays, weekRange } from '@/lib/week';
import { island } from '@/ui/island';
import { openRoutineWeek, viewPrefs } from '@/ui/nav';
import { colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { openRoutineSheet } from '../sheets/RoutineSheet';

const FMT: Record<string, Intl.DateTimeFormat> = {};
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => (FMT[k] = FMT[k] || new Intl.DateTimeFormat([], o));
const weekday = (day: string, style: 'long' | 'narrow' | 'short' = 'long') => fmt(style, { weekday: style }).format(fromYmd(day));
const dayMonth = (day: string) => fmt('dm', { day: 'numeric', month: 'short' }).format(fromYmd(day));
const first = (k: 'a' | 'b') => firstWord(person(k).name);

/* ---------- every day: the punch cards ---------- */
function Card({ r, days, today }: { r: Routine; days: string[]; today: string }) {
  const me = L.me, pt = partnerKey(), week = thisWeek(), mine = keeps(r, me), theirs = keeps(r, pt);
  const a = maskOf(week, me, r.id), b = maskOf(week, pt, r.id), so = dayIndex(today) + 1;
  const owner = mine ? '' : ` · ${first(pt)}’s`;
  const punch = (day: string) => {
    const on = togglePunch(r.id, day);
    if (on === null) return;
    haptic('light');
    if (on && day === today) {
      const c = todayCount();
      if (c.of > 1 && c.done === c.of) { haptic('success'); island({ e: '🎟️', text: `All ${c.of} punched today`, sub: 'Your card is full for the day' }); }
    }
  };
  return (
    <article className={`rt-card${mine ? '' : ' theirs'}`} data-name={r.name} style={colorVar(r.color)} aria-labelledby={`rt-${r.id}`}>
      <header className="rt-stub">
        <span className="rt-emoji" aria-hidden="true">{r.emoji}</span>
        <h2 className="rt-name" id={`rt-${r.id}`}>{r.name}<span className="rt-own">{owner}</span></h2>
        <span className="rt-n">{mine ? `${bits(a)} of ${so}` : `${bits(b)} of ${so}`}</span>
        <button className="nav-btn rt-edit" type="button" aria-label={`Edit ${r.name}`} onClick={() => openRoutineSheet(r.id)}><Icon name="more" /></button>
      </header>
      <div className="rt-holes" role="group" aria-label={`${r.name}, this week`}>
        {days.map((day, i) => {
          const on = has(mine ? a : b, i), ptOn = mine && theirs && has(b, i), isToday = day === today, open = mine && canPunch(day);
          const label = `${weekday(day)} ${dayMonth(day)}${isToday ? ', today' : ''}: ${on ? 'punched' : day > today ? 'still to come' : 'not punched'}${ptOn ? `, ${first(pt)} kept it too` : ''}`;
          return (
            <button key={day} type="button" className={`rt-hole${on ? ' on' : ''}${isToday ? ' today' : ''}${day > today ? ' later' : ''}`}
              disabled={!open} aria-pressed={mine ? on : undefined} aria-label={label} onClick={() => punch(day)}>
              <span className="rt-wd" aria-hidden="true">{weekday(day, 'narrow')}</span>
              <span className="rt-hole-ring" aria-hidden="true"><i className="rt-punch" /></span>
              <i className="rt-pt" aria-hidden="true" hidden={!ptOn} />
            </button>
          );
        })}
      </div>
    </article>
  );
}

function Empty() {
  return (
    <div className="rt-empty">
      <span className="rt-empty-e" aria-hidden="true">🎟️</span>
      <p>Pick a few things you both want to keep every day, and punch them off as you go.</p>
      <button className="btn rt-start" type="button" onClick={() => { addStarters(); haptic('success'); renderNow(); }}>
        Start with {STARTERS.map(s => s.name).join(', ')}
      </button>
      <button className="link-btn rt-own-btn" type="button" onClick={() => openRoutineSheet(null)}>Make my own</button>
    </div>
  );
}

export function RoutinesView() {
  const today = todayStr(), days = weekDays(thisWeek()), rs = routines(), c = todayCount(), pc = todayCount(partnerKey());
  const sunday = dayIndex(today) === 6, mineFirst = rs.filter(r => keeps(r, L.me)).concat(rs.filter(r => !keeps(r, L.me)));
  return (
    <div className="rt">
      <h1 className="large-title">Routines</h1>
      <p className="rt-sub">{weekday(today)} {dayMonth(today)}{c.of ? ` · ${c.done} of ${c.of} punched today` : ''}</p>
      {rs.length ? (<>
        {pc.of ? <p className="rt-ptline"><i aria-hidden="true" />{first(partnerKey())} punched {pc.done} of {pc.of} today</p> : null}
        <div className="rt-cards">{mineFirst.map(r => <Card key={r.id} r={r} days={days} today={today} />)}</div>
        <div className="group rt-addg"><button className="cell accent" type="button" onClick={() => openRoutineSheet(null)}><Icon name="plus" cls="sm" /><span className="grow">Add a routine</span></button></div>
        <button className="rt-wrap" type="button" onClick={() => openRoutineWeek(thisWeek())}>
          <span className="rt-wrap-q" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="rt-wrap-t"><b>{sunday ? 'Your week is sewn' : 'Your week so far'}</b><span>The quilt and the receipt</span></span>
          <Icon name="chevR" cls="chev" />
        </button>
      </>) : <Empty />}
    </div>
  );
}

/* ---------- every week: the quilt, then the receipt ---------- */
function Quilt({ rows, days, upTo }: { rows: Row[]; days: string[]; upTo: number }) {
  const me = L.me, pt = partnerKey();
  return (
    <div className="ql" role="table" aria-label="The week as a quilt">
      <div className="ql-row ql-head" role="row">
        <span role="columnheader" className="ql-name"><span className="sr">Routine</span></span>
        {days.map(d => <span key={d} role="columnheader" className="ql-d" aria-label={weekday(d)}>{weekday(d, 'narrow')}</span>)}
      </div>
      {rows.map(x => (
        <div key={x.r.id} className="ql-row" role="row">
          <span role="rowheader" className="ql-name"><span aria-hidden="true">{x.r.emoji}</span> {x.r.name}</span>
          {days.map((d, i) => {
            const a = has(x.me, i), b = has(x.pt, i), later = i >= upTo;
            const who = a && b ? 'both of you' : a ? first(me) : b ? first(pt) : later ? 'still to come' : 'nobody';
            return <span key={d} role="cell" aria-label={`${weekday(d)}: ${who}`}
              className={`ql-p${a ? ' m' : ''}${b ? ' p' : ''}${a && b ? ' ab' : ''}${x.keepsMe ? '' : ' xm'}${x.keepsPt ? '' : ' xp'}${later ? ' later' : ''}`} />;
          })}
        </div>
      ))}
      <div className="ql-key" aria-hidden="true">
        <span><i className="ql-p m" />{first(me)}</span><span><i className="ql-p p" />{first(pt)}</span><span><i className="ql-p m p ab" />Both, stitched</span>
      </div>
    </div>
  );
}

/** a decorative barcode: 48 bar widths from the week and the count */
const barcode = (seed: string): number[] => Array.from({ length: 48 }, (_, i) => ((seed.charCodeAt(i % seed.length) * (i + 7)) % 3) + 1);

function Receipt({ s }: { s: ReturnType<typeof summary> }) {
  const me = first(L.me).toUpperCase(), pt = first(partnerKey()).toUpperCase(), done = s.upTo === 7;
  const best = s.rows.filter(x => x.both > 0).sort((a, b) => b.both - a.both)[0];
  const line = (k: string, v: string) => <div className="rr-l"><span>{k}</span><b>{v}</b></div>;
  return (
    <div className="rr" role="group" aria-label="The week as a receipt">
      <div className="rr-paper">
        <p className="rr-h">TWODO</p>
        <p className="rr-c">{weekRange(s.week).toUpperCase()}{done ? '' : ' · SO FAR'}</p>
        <p className="rr-c">{me} &amp; {pt}</p>
        <div className="rr-rule" />
        <div className="rr-l rr-th"><span>ROUTINE</span><b>{me.slice(0, 8)}</b><b>{pt.slice(0, 8)}</b></div>
        {s.rows.map(x => (
          <div key={x.r.id} className="rr-l rr-3"><span>{x.r.name.toUpperCase()}</span>
            <b>{x.keepsMe ? `${bits(x.me)}/${s.upTo}` : '—'}</b><b>{x.keepsPt ? `${bits(x.pt)}/${s.upTo}` : '—'}</b></div>
        ))}
        <div className="rr-rule" />
        {line('PATCHES SEWN', `${s.sewn}/${s.patches}`)}
        {line('ALL DONE IN A DAY', `${s.me.allDays} · ${s.pt.allDays}`)}
        {line('DONE TOGETHER', `${s.together}`)}
        {best ? line('MOST TOGETHER', `${best.r.name.toUpperCase()} ×${best.both}`) : null}
        {s.most ? line('KEPT BEST', s.most.r.name.toUpperCase()) : null}
        <div className="rr-rule" />
        <p className="rr-c">{s.hardest ? `${s.hardest.r.name.toUpperCase()} WAS THE HARDEST. TRY IT TOGETHER NEXT WEEK?` : 'THANK YOU FOR KEEPING EACH OTHER GOING'}</p>
        <div className="rr-code" aria-hidden="true">{barcode(s.week + s.sewn).map((w, i) => <i key={i} style={{ flexGrow: w }} />)}</div>
      </div>
    </div>
  );
}

export function RoutineWeekView() {
  const vp = viewPrefs('routineweek'), week = vp.week && /^\d{4}-\d{2}-\d{2}$/.test(vp.week) ? vp.week : thisWeek();
  const s = summary(week), tab = vp.tab === 'receipt' ? 'receipt' : 'quilt', now = thisWeek();
  const go = (n: number) => { vp.week = shiftWeek(week, n); save(); haptic('light'); renderNow(); };
  const setTab = (t: string) => { vp.tab = t; save(); renderNow(); };
  return (
    <div className="rt rw">
      <h1 className="large-title">{week === now ? 'This week' : weekRange(week)}</h1>
      <div className="rw-sub">
        <span>{week === now ? `${weekRange(week)} · so far` : 'The week you two sewed'}</span>
        <span className="rw-switch">
          <button className="nav-btn" type="button" aria-label="The week before" onClick={() => go(-1)}><Icon name="chevL" /></button>
          <button className="nav-btn" type="button" aria-label="The week after" disabled={week >= now} onClick={() => go(1)}><Icon name="chevR" /></button>
        </span>
      </div>
      {s.rows.length ? (<>
        <Segmented name="rw" cls="rw-seg" value={tab} onChange={setTab} opts={[['quilt', 'Quilt'], ['receipt', 'Receipt']]} />
        {tab === 'quilt' ? (<>
          <Quilt rows={s.rows} days={s.days} upTo={s.upTo} />
          <div className="rw-tiles">
            <div className="rw-tile dark"><b>{s.sewn}<span> / {s.patches}</span></b><span>patches sewn</span></div>
            <div className="rw-tile"><b>{s.together}</b><span>done together</span></div>
          </div>
          {s.most || s.hardest ? (
            <ul className="rw-notes">
              {s.most ? <li><b>{s.most.r.emoji} {s.most.r.name}</b><span>kept best this week</span></li> : null}
              {s.hardest ? <li><b>{s.hardest.r.emoji} {s.hardest.r.name}</b><span>the hardest one. Try it together?</span></li> : null}
            </ul>
          ) : null}
          <div className="group rw-moreg"><button className="cell" type="button" onClick={() => setTab('receipt')}><Icon name="note" cls="sm" /><span className="grow">See the receipt</span><Icon name="chevR" cls="chev" /></button></div>
        </>) : <Receipt s={s} />}
      </>) : <p className="rt-none">No routines that week.</p>}
    </div>
  );
}
