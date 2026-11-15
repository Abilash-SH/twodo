'use client';
/* Twodo · the journal. One page a day, in two voices: your partner's half (to read) and yours (to write), joined by a
   small heart. "Just me" is the same page with one voice, behind the passcode, never synced.
   Writing saves itself; a gentle prompt helps with a blank page; the weather says how your day was.
   No streaks, no counts of words or days. Data and privacy: docs/journal-and-planner.md */
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { renderNow } from '@/lib/render';
import { L, partnerKey, person, save } from '@/lib/store';
import type { JournalEntry, Mood } from '@/lib/types';
import { firstWord, fromYmd, reducedMotion, todayStr } from '@/lib/util';
import { Vault } from '@/lib/vault';
import { WEATHER, getPage, hasWords, onThisDay, promptFor, spreads, writePage, type Spread } from '@/lib/journal';
import { viewPrefs } from '@/ui/nav';
import { Avatar, colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { openVault, unlockWithBio } from '../vault/VaultUI';

const FMT: Record<string, Intl.DateTimeFormat> = {};
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => (FMT[k] = FMT[k] || new Intl.DateTimeFormat([], o));
const longDate = (d: string) => fmt('long', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromYmd(d));
const shortDate = (d: string) => {
  const t = fromYmd(d), same = t.getFullYear() === new Date().getFullYear();
  return fmt(same ? 'short' : 'shortY', same ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(t);
};
const nameOf = (k: 'a' | 'b') => (k === L.me ? 'You' : firstWord(person(k).name));
const weatherOf = (m: Mood) => WEATHER.find(w => w[0] === m);

function WeatherMark({ m }: { m: Mood }) {
  const w = weatherOf(m); if (!w) return null;
  return <span className="jr-wx" title={w[2]}><Icon name={w[1]} cls="xs" /><span className="jr-wxl">{w[2]}</span></span>;
}

/** Your half: the weather, an optional prompt, and the writing itself (saved as you type) */
function MyHalf({ priv, date, e, autoFocusPrompt }: { priv: boolean; date: string; e?: JournalEntry; autoFocusPrompt?: boolean }) {
  const ta = useRef<HTMLTextAreaElement>(null), textRef = useRef(e ? e.text : ''), saveT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [text, setText] = useState(e ? e.text : ''), [shift, setShift] = useState(0), [saved, setSaved] = useState(false);
  const stored = e ? e.text : '';
  // the same half written on your other phone: take it, unless you are typing here
  useEffect(() => { if (document.activeElement !== ta.current && stored !== textRef.current) { textRef.current = stored; setText(stored); } }, [stored]);
  const flush = () => {
    clearTimeout(saveT.current); saveT.current = undefined;
    const cur = getPage(priv, date, L.me);
    if ((cur ? cur.text : '') === textRef.current) return;
    if (writePage(priv, date, { text: textRef.current })) { setSaved(true); setTimeout(() => setSaved(false), 1600); }
  };
  useEffect(() => () => { if (saveT.current) flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- leaving the screen keeps what was typed
  const prompt = e ? e.prompt : '', mood = e ? e.mood : 0, me = L.me;
  const suggestion = promptFor(date, shift);
  return (
    <section className="jr-half mine" style={colorVar(person(me).color)} aria-label="Your half">
      <div className="jr-who"><Avatar k={me} /><span>{priv ? 'Just you' : 'You'}</span>
        <span className="jr-saved" aria-live="polite">{saved ? 'Saved' : ''}</span></div>
      <div className="jr-weather" role="group" aria-label="Your weather today">
        {WEATHER.map(([m, ic, label]) => (
          <button key={m} type="button" className={mood === m ? 'on' : ''} aria-pressed={mood === m} aria-label={label}
            onClick={() => { writePage(priv, date, { mood: mood === m ? 0 : m }); haptic('light'); }}><Icon name={ic} /></button>
        ))}
      </div>
      {prompt ? (
        <p className="jr-q"><span>{prompt}</span>
          <button type="button" className="jr-qx" aria-label="Remove the prompt" onClick={() => writePage(priv, date, { prompt: '' })}><Icon name="x" cls="xs" /></button></p>
      ) : !text.trim() ? (
        <div className="jr-prompt">
          <span className="jr-ph-l">{autoFocusPrompt ? 'Today’s prompt' : 'A prompt'}</span>
          <p>{suggestion}</p>
          <div className="jr-pacts">
            <button type="button" className="jr-use" onClick={() => { writePage(priv, date, { prompt: suggestion }); ta.current?.focus({ preventScroll: true }); }}>Write about it</button>
            <button type="button" className="jr-another" onClick={() => { setShift(s => s + 1); haptic('light'); }}><Icon name="shuffle" cls="xs" />Another</button>
          </div>
        </div>
      ) : null}
      {/* the page grows with the writing in CSS (a hidden copy of the text sizes the grid), so nothing measures layout */}
      <div className="jr-grow" data-v={text}>
      <textarea ref={ta} className="jr-ta" rows={4} value={text} maxLength={20000} aria-label={`Your page for ${longDate(date)}`}
        placeholder={prompt ? 'Write…' : date === todayStr() ? 'Write a few lines about today…' : 'Write…'}
        onChange={ev => {
          const v = ev.currentTarget.value; textRef.current = v; setText(v);
          clearTimeout(saveT.current); saveT.current = setTimeout(flush, 700);
        }}
        onBlur={flush} />
      </div>
    </section>
  );
}

/** A half you read: your partner's (or yours, on an earlier page) */
function Half({ e, clamp }: { e: JournalEntry; clamp: boolean }) {
  return (
    <section className={`jr-half ${e.who === L.me ? 'mine' : 'theirs'}`} style={colorVar(person(e.who).color)} aria-label={`${nameOf(e.who)}`}>
      <div className="jr-who"><Avatar k={e.who} /><span>{nameOf(e.who)}</span>{e.mood ? <WeatherMark m={e.mood} /> : null}</div>
      {e.prompt ? <p className="jr-q"><span>{e.prompt}</span></p> : null}
      {e.text.trim() ? <p className={`jr-text${clamp ? ' clamp' : ''}`}>{e.text}</p> : null}
    </section>
  );
}

function TodayPage({ priv }: { priv: boolean }) {
  const today = todayStr(), pt = partnerKey(), theirs = priv ? undefined : getPage(false, today, pt), mine = getPage(priv, today, L.me);
  return (
    <article className="jr-page today" id={`jr-${today}`} aria-labelledby="jr-today-h">
      <header className="jr-ph"><h2 id="jr-today-h" className="jr-date">{longDate(today)}</h2><span className="jr-chip">Today</span></header>
      {priv ? null : hasWords(theirs) || (theirs && theirs.mood) ? <Half e={theirs!} clamp={false} />
        : <section className="jr-half theirs waiting" style={colorVar(person(pt).color)} aria-label={firstWord(person(pt).name)}>
            <div className="jr-who"><Avatar k={pt} /><span>{firstWord(person(pt).name)}</span></div>
            <p className="jr-wait">{firstWord(person(pt).name)} hasn’t written today yet.</p></section>}
      {priv ? null : <div className="jr-seam" aria-hidden="true"><span><Icon name="heart" cls="xs" /></span></div>}
      <MyHalf priv={priv} date={today} e={mine} autoFocusPrompt />
    </article>
  );
}

function PastPage({ s, priv }: { s: Spread; priv: boolean }) {
  const [open, setOpen] = useState(false), [edit, setEdit] = useState(false);
  const long = [s.mine, s.theirs].some(e => e && (e.text.length > 220 || e.text.split('\n').length > 4));
  return (
    <article className="jr-page past" id={`jr-${s.date}`} aria-labelledby={`jrh-${s.date}`}>
      <header className="jr-ph"><h3 id={`jrh-${s.date}`} className="jr-date">{shortDate(s.date)}</h3></header>
      {s.theirs ? <Half e={s.theirs} clamp={!open} /> : null}
      {s.theirs && s.mine ? <div className="jr-seam" aria-hidden="true"><span><Icon name="heart" cls="xs" /></span></div> : null}
      {s.mine ? (edit ? <MyHalf priv={priv} date={s.date} e={s.mine} /> : <Half e={s.mine} clamp={!open} />) : null}
      {(long && !edit) || (s.mine && !edit) ? (
        <div className="jr-acts">
          {long && !edit ? <button type="button" onClick={() => setOpen(o => !o)}>{open ? 'Show less' : 'Read all'}</button> : null}
          {s.mine && !edit ? <button type="button" onClick={() => setEdit(true)}><Icon name="edit" cls="xs" />Edit</button> : null}
        </div>) : null}
    </article>
  );
}

/** "Just me" before the passcode: what it is, and the way in */
function PrivateGate() {
  const has = Vault.exists();
  return (
    <div className="jr-gate">
      <span className="jr-gate-ic"><Icon name="lock" /></span>
      <h2>{has ? 'Your private journal is locked' : 'A journal just for you'}</h2>
      <p>Only you can read it. It’s encrypted on this phone with your passcode (the same one as your Secret lists), never synced and never in a backup.</p>
      <div className="jr-gate-acts">
        {has && Vault.hasBio() ? <button className="btn" type="button" onClick={() => void unlockWithBio()}><Icon name="faceid" cls="sm" /> Unlock with Face ID</button> : null}
        <button className={`btn${has && Vault.hasBio() ? ' tint' : ''}`} type="button" onClick={() => openVault(has ? 'unlock' : 'create')}>{has ? 'Enter passcode' : 'Create a passcode'}</button>
      </div>
    </div>
  );
}

const PAGE = 14;
export function JournalView() {
  const vp = viewPrefs('journal'), priv = vp.tab === 'me', pt = firstWord(person(partnerKey()).name);
  const [shown, setShown] = useState(PAGE);
  const open = !priv || Vault.unlocked();
  const past = open ? spreads(priv) : [], otd = open ? onThisDay(priv) : null;
  const go = (date: string) => {
    const i = past.findIndex(s => s.date === date);
    if (i >= shown) setShown(i + 1);
    setTimeout(() => document.getElementById(`jr-${date}`)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' }), 30);
  };
  return (
    <div className="jr">
      <h1 className="large-title">Journal</h1>
      <div className="subtitle jr-sub">
        {priv ? <><Icon name="lock" cls="xs" /> Only you · on this phone, never synced</> : `Shared with ${pt}`}
        {priv && open ? <button className="link-btn" type="button" onClick={() => { void Vault.lock(); haptic('light'); }}>Lock</button> : null}
      </div>
      <Segmented name="jtab" cls="jtab" opts={[['us', 'Us'], ['me', <><Icon name="lock" cls="xs" /> Just me</>]]} value={priv ? 'me' : 'us'}
        onChange={v => { vp.tab = v; save(); setShown(PAGE); renderNow(); }} />
      {!open ? <PrivateGate /> : (<>
        <TodayPage key={priv ? 'me' : 'us'} priv={priv} />
        {otd ? (
          <button className="jr-otd" type="button" onClick={() => go(otd.s.date)}>
            <span className="jr-otd-h"><Icon name="clock" cls="xs" />{otd.label}</span>
            <span className="jr-otd-t">{(hasWords(otd.s.theirs) ? otd.s.theirs : otd.s.mine)!.text.slice(0, 140)}</span>
            <span className="jr-otd-w">{nameOf((hasWords(otd.s.theirs) ? otd.s.theirs : otd.s.mine)!.who)} wrote · {shortDate(otd.s.date)}</span>
          </button>) : null}
        {past.length ? <h2 className="jr-earlier">Earlier pages</h2> : <p className="jr-empty">{priv ? 'Your earlier pages will be here, for your eyes only.' : `The pages you and ${pt} write will be here, one for each day.`}</p>}
        {past.slice(0, shown).map(s => <PastPage key={s.date} s={s} priv={priv} />)}
        {past.length > shown ? <button className="jr-more" type="button" onClick={() => setShown(n => n + PAGE)}>Show older pages</button> : null}
      </>)}
    </div>
  );
}
