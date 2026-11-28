'use client';
/* Twodo · the journal, one page each per day (asked for on 2026-11-18, like the iPhone app): "only for the same day i
   need it to enter and for seeing previous days i need to select days". A week strip (and a calendar for any earlier
   day) picks the day; both characters stand on a stage washed in your two colours; a sheet over it holds the day and
   both pages. Only today's page can be written (a plain box and Post); earlier days are read-only; days to come
   can't be picked. No prompts, no hearts, nothing private, no counts (asked for 2026-11-18: "clumsy").
   Records are the thread's posts, by the day they were written (lib/journal.ts). Data: docs/journal-and-planner.md */
import { useEffect, useRef, useState } from 'react';
import { avatarOf } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { POST_MAX, entriesOn, journalOpen, todayPage, writeToday, writtenDays } from '@/lib/journal';
import { calm } from '@/lib/motion';
import { L, partnerKey, person } from '@/lib/store';
import type { JournalEntry } from '@/lib/types';
import { addDays, firstWord, fromYmd, todayStr, ymd } from '@/lib/util';
import { weekDays, weekOf } from '@/lib/week';
import { confirmDialog } from '@/ui/alert';
import { closeSheet, openSheet } from '@/ui/sheet';
import { createStore, useStore } from '@/ui/store';
import { Character, Portrait } from '../home/Character';
import { colorVar, cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

/** The day on screen: null is today (and follows midnight); otherwise an earlier day. Back to today on leaving. */
export const journalDay = createStore<string | null>(null);

const FMT: Record<string, Intl.DateTimeFormat> = {};
const fmt = (d: string, k: string, o: Intl.DateTimeFormatOptions) => (FMT[k] ||= new Intl.DateTimeFormat([], o)).format(fromYmd(d));
const shift = (d: string, n: number) => ymd(addDays(fromYmd(d), n));
const monthStart = (d: string, n = 0) => { const x = fromYmd(d); return ymd(new Date(x.getFullYear(), x.getMonth() + n, 1)); };
type Wrote = { mine: boolean; theirs: boolean } | undefined;
/** "Monday, 16 November 2026, today. You and Deiva wrote." */
function dayLabel(d: string, today: string, w: Wrote, pt: string): string {
  const who = w?.mine && w.theirs ? `You and ${pt} wrote.` : w?.mine ? 'You wrote.' : w?.theirs ? `${pt} wrote.` : 'Nothing written.';
  return `${fmt(d, 'full', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${d === today ? ', today' : ''}. ${who}`;
}

/** today's date, changing at midnight while the screen is open */
function useToday(): string {
  const [t, setT] = useState(todayStr);
  useEffect(() => {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const id = setTimeout(() => setT(todayStr()), next.getTime() - now.getTime());
    return () => clearTimeout(id);
  }, [t]);
  return t;
}

const Dots = ({ w }: { w: Wrote }) => (
  <span className="jd-dots" aria-hidden="true">
    {w?.mine ? <i style={colorVar(person(L.me).color)} /> : null}{w?.theirs ? <i style={colorVar(person(partnerKey()).color)} /> : null}
  </span>
);

function WeekStrip({ monday, date, today, onWeek }: { monday: string; date: string; today: string; onWeek: (m: string) => void }) {
  const days = writtenDays(), pt = firstWord(person(partnerKey()).name);
  return (
    <div className="jd-week">
      <div className="jd-month">
        <h2>{fmt(shift(monday, 3), 'my', { month: 'long', year: 'numeric' })}</h2>
        <span className="jd-arrows">
          <button type="button" className="jd-arrow" aria-label="Previous week" onClick={() => { haptic('light'); onWeek(shift(monday, -7)); }}><Icon name="chevL" cls="sm" /></button>
          <button type="button" className="jd-arrow" aria-label="Next week" disabled={monday >= weekOf(today)} onClick={() => { haptic('light'); onWeek(shift(monday, 7)); }}><Icon name="chevR" cls="sm" /></button>
        </span>
      </div>
      <div className="jd-days" role="group" aria-label="Days">
        {weekDays(monday).map(d => {
          const future = d > today, on = d === date;
          return (
            <button key={d} type="button" data-day={d} className={`jd-day${on ? ' on' : ''}${d === today ? ' today' : ''}${future ? ' future' : ''}`}
              disabled={future} aria-pressed={on} aria-label={future ? `${fmt(d, 'full', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Not here yet.` : dayLabel(d, today, days.get(d), pt)}
              style={colorVar(person(L.me).color)} onClick={() => { if (!on) { haptic('light'); journalDay.set(d === today ? null : d); } }}>
              <span className="jd-wd">{fmt(d, 'wd', { weekday: 'short' })}</span>
              <b>{fromYmd(d).getDate()}</b>
              <Dots w={days.get(d)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A month at a time, for any earlier day (in a sheet) */
function Calendar({ start }: { start: string }) {
  const today = todayStr(), [first, setFirst] = useState(() => monthStart(start));
  const days = writtenDays(), pt = firstWord(person(partnerKey()).name);
  const lead = (fromYmd(first).getDay() + 6) % 7, x = fromYmd(first), count = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => shift(first, i))];
  while (cells.length % 7) cells.push(null);
  const pick = (d: string) => { haptic('light'); journalDay.set(d >= today ? null : d); closeSheet(); };
  const written = cells.filter(d => d && days.has(d)).length;
  return (
    <div className="jd-cal">
      <div className="jd-month">
        <span><h2>{fmt(first, 'my', { month: 'long', year: 'numeric' })}</h2><span className="jd-count">{written ? `${written} day${written === 1 ? '' : 's'} with a page` : 'No pages this month'}</span></span>
        <span className="jd-arrows">
          <button type="button" className="jd-arrow" aria-label="Previous month" onClick={() => setFirst(monthStart(first, -1))}><Icon name="chevL" cls="sm" /></button>
          <button type="button" className="jd-arrow" aria-label="Next month" disabled={first >= monthStart(today)} onClick={() => setFirst(monthStart(first, 1))}><Icon name="chevR" cls="sm" /></button>
        </span>
      </div>
      <div className="jd-grid" aria-hidden="true">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => <span key={i} className="jd-h">{h}</span>)}</div>
      <div className="jd-grid">
        {cells.map((d, i) => d === null ? <span key={'b' + i} /> : (
          <button key={d} type="button" data-day={d} className={`jd-cd${d === start ? ' on' : ''}${d === today ? ' today' : ''}`} disabled={d > today}
            aria-label={dayLabel(d, today, days.get(d), pt)} aria-pressed={d === start} style={colorVar(person(L.me).color)} onClick={() => pick(d)}>
            <b>{fromYmd(d).getDate()}</b><Dots w={days.get(d)} />
          </button>
        ))}
      </div>
      <div className="jd-legend"><span><i style={colorVar(person(L.me).color)} />You wrote</span><span><i style={colorVar(person(partnerKey()).color)} />{pt} wrote</span></div>
      <button type="button" className="jd-go" onClick={() => pick(today)}>Go to today</button>
    </div>
  );
}
const openCalendar = (date: string) => openSheet({ title: 'Pick a day', right: '', body: <Calendar start={date} /> });

/** what you are writing survives leaving the screen (in memory only, until the app closes) */
let draft = { day: '', text: '' };

/** Today's page: the box keeps what you type; Save writes it. If midnight passes while you type, the words stay and
    save to the new day; an untouched box starts the new day empty. */
function TodayPage({ today, earlier, onSaved }: { today: string; earlier: JournalEntry[]; onSaved: () => void }) {
  const saved = todayPage()?.text ?? '';
  const [text, setTextState] = useState(() => (draft.day === today ? draft.text : saved));
  const last = useRef(saved);
  const setText = (t: string) => { draft = { day: today, text: t }; setTextState(t); };
  if (last.current !== saved) { // saved on the other phone, or a new day: an untouched box follows it
    if (text.trim() === last.current) { draft = { day: today, text: saved }; setTextState(saved); }
    last.current = saved;
  }
  useEffect(() => { if (draft.day !== today) draft = { day: today, text }; }, [today, text]);
  const dirty = text.trim() !== saved;
  const save = async () => {
    if (!dirty) return;
    if (!text.trim() && !(await confirmDialog({ title: 'Clear today’s page?', message: `It goes for ${firstWord(person(partnerKey()).name)} too.`, ok: 'Clear', destructive: true }))) return;
    const r = writeToday(text);
    const now = r && !r.deleted ? r.text : '';
    setText(now); last.current = now;
    haptic('success'); onSaved();
  };
  return (<>
    {earlier.length ? <div className="jd-earlier">{earlier.map(e => <p key={e.id} className="jd-text">{e.text}</p>)}</div> : null}
    <div className="jt-grow jd-grow" data-v={text}>
      <textarea className="jt-ta jd-ta" value={text} maxLength={POST_MAX} aria-label="Your page for today"
        onChange={ev => setText(ev.currentTarget.value)} />
    </div>
    <div className="jd-save">
      <span className="jd-note">{text.length > POST_MAX - 500 ? `${POST_MAX - text.length} characters left` : ''}</span>
      <button type="button" className="jd-btn" disabled={!dirty} onClick={() => void save()}>{!dirty && saved ? 'Posted' : saved ? 'Update' : 'Post'}</button>
    </div>
  </>);
}

export function JournalView() {
  useEffect(() => { journalOpen.now = true; return () => { journalOpen.now = false; journalDay.set(null); }; }, []);
  const today = useToday(), picked = useStore(journalDay);
  const date = picked && picked < today ? picked : today, isToday = date === today;
  const [monday, setMonday] = useState(() => weekOf(date));
  useEffect(() => setMonday(weekOf(date)), [date]);
  const [wave, setWave] = useState<{ me: string; pt: string }>({ me: '', pt: '' });
  const [said, setSaid] = useState(false);
  const me = L.me, pk = partnerKey(), pt = firstWord(person(pk).name);
  const mine = entriesOn(date, me), theirs = entriesOn(date, pk), page = isToday ? todayPage() : undefined;
  const play = (who: 'me' | 'pt', mood: string) => {
    if (calm()) return;
    setWave(w => ({ ...w, [who]: '' })); requestAnimationFrame(() => setWave(w => ({ ...w, [who]: mood })));
  };
  return (
    <div className="jd">
      <div className="jd-top">
        <h1 className="large-title">Journal</h1>
        <button type="button" className="jd-calbtn" aria-label="Pick a day" onClick={() => { haptic('light'); openCalendar(date); }}><Icon name="week" /></button>
      </div>
      <WeekStrip monday={monday} date={date} today={today} onWeek={setMonday} />
      <section className="jd-stage" aria-label="The two of you" style={cssVars({ '--a': `var(--c-${person(me).color})`, '--b': `var(--c-${person(pk).color})` })}>
        <span className="jd-badge">{isToday ? null : <Icon name="lock" cls="xs" />}{isToday ? 'Today' : 'Read only'}</span>
        <span className="jd-floor">
          <button type="button" className="jd-char" style={colorVar(person(me).color)} aria-label="You. Waves" onClick={() => play('me', 'wave')}>
            <Character look={avatarOf(me)} who={me} size={150} state={isToday && !mine.length ? 'think' : 'idle'} cls={wave.me} />
          </button>
          <button type="button" className="jd-char" style={colorVar(person(pk).color)} aria-label={`${pt}. Waves`} onClick={() => play('pt', 'wave')}>
            <Character look={avatarOf(pk)} who={pk} size={138} flip cls={wave.pt} />
          </button>
        </span>
      </section>
      <section className="jd-sheet" aria-label={fmt(date, 'full', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
        <span className="jd-label">{isToday ? 'Today' : fmt(date, 'wdl', { weekday: 'long' })}</span>
        <h2 className="jd-date">{fmt(date, 'dm', { day: 'numeric', month: 'long' })}</h2>
        <div className="jd-block" style={colorVar(person(me).color)}>
          <div className="jd-who"><Portrait look={avatarOf(me)} who={me} size={32} /><b>Your page</b>{said ? <span className="jd-saved" role="status">Posted</span> : null}</div>
          {isToday ? <TodayPage today={today} earlier={mine.filter(e => e.id !== page?.id)} onSaved={() => { setSaid(true); play('me', 'happy'); setTimeout(() => setSaid(false), 1800); }} />
            : (<>
              {mine.length ? mine.map(e => <p key={e.id} className="jd-text">{e.text}</p>) : <p className="jd-none">You didn’t write this day.</p>}
              <p className="jd-lock"><Icon name="lock" cls="xs" />Only today’s page can be written.</p>
            </>)}
        </div>
        <div className="jd-block theirs" style={colorVar(person(pk).color)}>
          <div className="jd-who"><Portrait look={avatarOf(pk)} who={pk} size={32} /><b>{pt}’s page</b></div>
          {theirs.length ? theirs.map(e => <p key={e.id} className="jd-text">{e.text}</p>)
            : <p className="jd-none">{isToday ? `${pt} hasn’t written today yet.` : `${pt} didn’t write this day.`}</p>}
        </div>
      </section>
    </div>
  );
}
