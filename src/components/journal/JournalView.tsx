'use client';
/* Twodo · daily shared journal. Existing encrypted post records are retained; older posts
   remain visible on their original dates. Only today's own entry can be written. */
import { useEffect, useMemo, useState } from 'react';
import { avatarOf } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { POST_MAX, addPost, editPost, heart, hearts, journalOpen, posts } from '@/lib/journal';
import { L, partnerKey, person } from '@/lib/store';
import type { JournalEntry, PersonKey } from '@/lib/types';
import { firstWord, todayStr, ymd } from '@/lib/util';
import { Portrait } from '../home/Character';
import { colorVar } from '../ui/Avatar';

const dateAt = (s: string) => new Date(s + 'T12:00:00');
const niceDate = (s: string) => dateAt(s).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const startOfWeek = (s: string) => {
  const d = dateAt(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const shift = (d: Date, n: number) => { const copy = new Date(d); copy.setDate(copy.getDate() + n); return ymd(copy); };
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(dateAt(s)) === s;
const nameOf = (who: PersonKey) => who === L.me ? 'You' : firstWord(person(who).name);

function DayPage({ who, day, entries, loved, onSave }: {
  who: PersonKey; day: string; entries: JournalEntry[]; loved: Set<string>; onSave: (entry: JournalEntry | undefined, value: string) => void;
}) {
  const mine = who === L.me, today = day === todayStr();
  const own = entries.filter(e => e.who === who);
  // A day's newest post becomes the editable page; older posts are retained as read-only history.
  const editable = mine && today ? own[0] : undefined;
  const [draft, setDraft] = useState(editable?.text || '');
  useEffect(() => { setDraft(editable?.text || ''); }, [day, who, editable?.id, editable?.text]);
  const partner = partnerKey();
  return <section className="jd-page" style={colorVar(person(who).color)}>
    <header className="jd-person">
      <Portrait look={avatarOf(who)} size={36} />
      <strong>{nameOf(who)}'s page</strong>
      {!today && <span className="jd-readonly">Read only</span>}
    </header>
    {own.length === 0 && !editable && <p className="jd-empty">Nothing written for this day.</p>}
    {own.map(e => <article className="jd-entry" key={e.id}>
      {editable?.id === e.id ? null : <p className="jd-words">{e.text}</p>}
      {!mine && <button type="button" className={'jd-heart' + (loved.has(e.id) ? ' on' : '')}
        aria-label={loved.has(e.id) ? 'Remove your heart' : 'Give a heart'} aria-pressed={loved.has(e.id)}
        onClick={() => { heart(e.id); haptic('light'); }}>♥</button>}
    </article>)}
    {editable || (mine && today) ? <div className="jd-editor">
      <label htmlFor="jd-writing">Your words for today</label>
      <textarea id="jd-writing" value={draft} maxLength={POST_MAX} rows={6}
        placeholder="What would you like to remember about today?"
        onChange={e => setDraft(e.currentTarget.value)} />
      <button type="button" className="jd-save" disabled={!draft.trim() || draft.trim() === (editable?.text || '')}
        onClick={() => { onSave(editable, draft); haptic('success'); }}>Save today's page</button>
    </div> : null}
    {!mine && own.length > 0 && <span className="jd-heart-note">{loved.has(own[0].id) ? 'You gave a heart' : 'Tap the heart to show love'}</span>}
    {mine && own.length > 0 && hearts().get(own[0].id)?.has(partner) && <span className="jd-heart-note">♥ {firstWord(person(partner).name)} loved your page</span>}
  </section>;
}

export function JournalView() {
  const [selected, setSelected] = useState(todayStr);
  const today = todayStr();
  const day = isDay(selected) && selected <= today ? selected : today;
  const all = posts(), allHearts = hearts(), partner = partnerKey();
  const dayEntries = useMemo(() => all.filter(e => e.date === day), [all, day]);
  const loved = new Set(all.filter(e => allHearts.get(e.id)?.has(L.me)).map(e => e.id));
  const weekStart = startOfWeek(day);
  const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
  const save = (e: JournalEntry | undefined, value: string) => {
    if (day !== todayStr()) return; // guard midnight and stale editors
    if (e) editPost(e.id, value);
    else addPost(value);
  };
  useEffect(() => { journalOpen.now = true; return () => { journalOpen.now = false; }; }, []);
  return <main className="jd">
    <header className="jd-heading"><h1 className="large-title">Our journal</h1><p>One day at a time, just for the two of you.</p></header>
    <nav className="jd-dates" aria-label="Choose journal date">
      <button type="button" className="jd-week-nav" aria-label="Previous week"
        onClick={() => setSelected(shift(weekStart, -7))}>‹</button>
      <div className="jd-week">
        {days.map(d => <button type="button" key={d} disabled={d > today} aria-current={d === day ? 'date' : undefined}
          className={'jd-date' + (d === day ? ' chosen' : '') + (d === today ? ' today' : '')}
          onClick={() => setSelected(d)}>
          <span>{dateAt(d).toLocaleDateString([], { weekday: 'short' })}</span>
          <b>{dateAt(d).getDate()}</b>
          <i aria-hidden="true">{all.some(e => e.date === d && e.who === L.me) ? '●' : ''}{all.some(e => e.date === d && e.who === partner) ? '♥' : ''}</i>
        </button>)}
      </div>
      <button type="button" className="jd-week-nav" aria-label="Next week"
        disabled={shift(weekStart, 7) > today} onClick={() => setSelected(shift(weekStart, 7))}>›</button>
    </nav>
    <div className="jd-calendar"><label htmlFor="jd-pick">Choose another day</label>
      <input id="jd-pick" type="date" max={today} value={day}
        onChange={e => { if (isDay(e.target.value) && e.target.value <= today) setSelected(e.target.value); }} />
      {day !== today && <button type="button" onClick={() => setSelected(today)}>Back to today</button>}
    </div>
    <h2 className="jd-day-title">{day === today ? 'Today' : niceDate(day)}</h2>
    <div className="jd-pages">
      <DayPage key={'me-'+day} who={L.me} day={day} entries={dayEntries} loved={loved} onSave={save} />
      <DayPage key={'pt-'+day} who={partner} day={day} entries={dayEntries} loved={loved} onSave={save} />
    </div>
  </main>;
}
