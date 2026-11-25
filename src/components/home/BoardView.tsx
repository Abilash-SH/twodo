'use client';
/* Twodo · Home when you're signed in (after the owner's reference, like the iPhone app): your picture and name, your
   partner's chip, a big hello with what today holds in your character's voice, then a fanned stack of cards for what
   matters (Today, your partner, the journal, this week): swipe or tap a dot to bring one up, tap it to open. Below,
   the two of you as your characters (tap yours for the next thing it has to say, your partner's for the chat), and a
   floating bar to go to To-dos, the journal or the chat, with Add a to-do next to it.
   Nothing is stored for Home itself; characters and roles live in the people record (docs/characters.md).
   Privacy: everything here comes from liveTasks(), the chat and the shared journal, so nothing from a secret list
   (content, titles, counts) can appear, and the character never mentions one. It never shows a message's text. */
import { memo, useEffect, useState } from 'react';
import { Chat, type Msg } from '@/lib/chat';
import { avatarOf, dayLine, lines, roleOf, type Facts } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { wroteOn } from '@/lib/journal';
import { renderNow } from '@/lib/render';
import { L, SMART, cStr, fmtDue, fmtTime, liveTasks, partnerKey, person, sortTasks } from '@/lib/store';
import { Inbox, Sync } from '@/lib/sync';
import type { PersonKey } from '@/lib/types';
import { dayDiff, firstWord, todayStr, ymd } from '@/lib/util';
import { thisWeek, weekPlan } from '@/lib/week';
import { useApp } from '@/hooks/useApp';
import { boardAdd, navTo, openBoardAdd, openJournal, openSmart, type Entry } from '@/ui/nav';
import { useStore } from '@/ui/store';
import { updateStore } from '@/ui/update';
import { ChatCtl } from '../chat/chatCtl';
import { openInviteSheet } from '../settings/AccountSheets';
import { openSettings } from '../settings/Settings';
import { AreaBoundary } from '../ui/AreaBoundary';
import { colorVar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Portrait } from './Character';
import { HomeMoments } from './Moments';
import { HomePeople } from './People';

/* ---------- what is on the board (plain data, so it is easy to check) ---------- */
interface MsgNote { kind: 'invite' | 'request' | 'sent' | 'hello' | 'new' | 'waiting' | 'failed' | 'last'; who: PersonKey; text: string; n: number; when: string }
export interface Board {
  msg: MsgNote; today: number; next: { title: string; time: string } | null; overdue: number; together: number;
  weekOpen: number; weekDone: number; wrote: boolean; ptWrote: boolean; facts: Facts;
}
const when = (ts: number): string => {
  const d = new Date(ts), diff = dayDiff(todayStr(), ymd(d));
  return diff === 0 ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : diff === 1 ? 'Yesterday'
    : diff < 7 ? d.toLocaleDateString([], { weekday: 'long' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
function messageNote(): MsgNote {
  const pk = partnerKey(), none = { text: '', n: 0, when: '' };
  if (!(L.pair && L.pair.status === 'paired') || !L.auth) {
    // not connected yet: someone asked to connect, you asked and are waiting, or nobody has
    const asked = Inbox.incoming();
    // (a request comes from the network, written by someone else: its name is clamped before it is shown)
    if (asked.length) return { kind: 'request', who: pk, ...none, text: firstWord(cStr(asked[0][1].name, 40)) || 'Someone' };
    return { kind: L.pair && L.pair.status === 'sent' ? 'sent' : 'invite', who: pk, ...none, text: L.pair ? firstWord(cStr(L.pair.name, 40)) : '' };
  }
  // one pass over the conversation: the latest message, and what your partner sent since you last read (ids sort by time)
  const me = L.auth.uid;
  let last: Msg | null = null, newest: Msg | null = null, n = 0;
  for (const m of Object.values(Chat.msgs)) {
    if (m.del) continue;
    if (!last || m.id > last.id) last = m;
    if (m.f !== me && m.ts > Chat.read) { n++; if (!newest || m.id > newest.id) newest = m; }
  }
  if (!last) return { kind: 'hello', who: pk, ...none };
  const note = (kind: MsgNote['kind'], m: Msg, count = 0): MsgNote => ({ kind, who: m.f === me ? L.me : pk, text: ChatCtl.previewOf(m), n: count, when: when(m.ts) });
  if (newest) return note('new', newest, n);
  // your own message that has not gone out: waiting for a connection, or really failed
  if (last.f === me && last.status === 'failed') return note(navigator.onLine ? 'failed' : 'waiting', last);
  if (last.f === me && last.status === 'sending' && !navigator.onLine) return note('waiting', last);
  return note('last', last);
}
export function boardData(): Board {
  const open = liveTasks().filter(t => !t.done); // never includes a secret list's to-dos
  const t0 = todayStr(), today = open.filter(SMART.today.match), pins = sortTasks(open.filter(t => t.pinned));
  const dueToday = open.filter(t => t.due === t0), timed = dueToday.filter(t => t.time).sort((a, b) => (a.time! < b.time! ? -1 : 1));
  const pk = partnerKey(), paired = !!(L.pair && L.pair.status === 'paired');
  const doneByPt = liveTasks().filter(t => t.done && t.doneAt && t.doneBy === pk && Date.now() - t.doneAt < 36 * 3600e3).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))[0];
  const msg = messageNote(), together = open.filter(SMART.us.match).length;
  const plan = weekPlan(thisWeek());
  const unread = msg.kind === 'new' ? msg.n : 0;
  const facts: Facts = {
    hour: new Date().getHours(), me: firstWord(person(L.me).name), pt: firstWord(person(pk).name), paired,
    unread, today: dueToday.length, next: timed.length ? { title: timed[0].title, time: fmtTime(timed[0].time) } : null,
    overdue: open.filter(t => t.due && t.due < t0).length,
    pinned: pins[0] ? { title: pins[0].title, when: pins[0].due ? fmtDue(pins[0].due, pins[0].time) : '' } : null,
    doneByPt: doneByPt ? doneByPt.title : null, together, ptPosted: wroteOn(t0, pk),
  };
  return {
    msg, today: today.length, next: facts.next, overdue: facts.overdue, together,
    weekOpen: plan.days.reduce((n, d) => n + d.open.length, 0), weekDone: plan.days.reduce((n, d) => n + d.done.length, 0),
    wrote: wroteOn(t0, L.me), ptWrote: facts.ptPosted, facts,
  };
}

/* ---------- pieces ---------- */
const color = (k: PersonKey) => person(k).color;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const paired = () => !!(L.pair && L.pair.status === 'paired');
const unreadNow = () => (paired() && Chat.ready() ? Chat.unread() : 0);
const toPartner = () => (paired() ? ChatCtl.open() : openInviteSheet());

/** Home's one card: today. A tap opens Today. (The two of you stand above it, free: People.tsx.) */
function TodayCard({ b }: { b: Board }) {
  const title = b.today ? `${plural(b.today, 'to-do')} left` : 'Nothing today';
  const sub = b.next ? `${b.next.time} · ${b.next.title}` : b.overdue ? `${b.overdue} left from before` : b.today ? 'Tap to see them' : 'Enjoy it, or add something';
  return (
    <button type="button" className="home-card" onClick={() => openSmart('today')} aria-label={`Today. ${title}. ${sub}. Opens Today`}>
      <span className="home-card-ic" aria-hidden="true"><Icon name="sun" /></span>
      <span className="home-card-txt">
        <span className="home-card-badge">Today</span>
        <b className="home-card-title">{title}</b>
        <span className="home-card-sub">{sub}</span>
      </span>
    </button>
  );
}

/** Home's content only draws again when the data changes (or the connection does), never when a screen slides over it. */
const Notes = memo(function Notes({ v, online }: { v: number; online: boolean }) {
  void v;
  const b = boardData(), me = L.me;
  const role = roleOf(me), said = lines(b.facts, role);
  said[0] = dayLine(b.facts, role);
  const [i, setI] = useState(0);
  return (
    <main className="board home">
      {online ? null : <div className="tape" role="status"><Icon name="cloud" cls="xs" />Offline. Everything is saved here.</div>}
      <div className="home-hello">
        <p className="home-hi">Hello, {firstWord(person(me).name)}!</p>
        <button type="button" className="home-line" onClick={() => { setI(n => n + 1); haptic('light'); }} aria-label={`${said[i % said.length]}${said.length > 1 ? '. Tap for the next' : ''}`}>
          <span className="say" aria-live="polite">{said[i % said.length]}</span>
          {said.length > 1 ? <span className="say-n" aria-hidden="true">{(i % said.length) + 1}/{said.length}</span> : null}
        </button>
      </div>
      <AreaBoundary area="Home’s people" compact>
        <HomePeople vibe={{ free: !b.today && !b.overdue, unread: b.facts.unread > 0, ptDone: !!b.facts.doneByPt }} />
      </AreaBoundary>
      <TodayCard b={b} />
      <HomeMoments v={v} />
    </main>
  );
});

export function BoardView({ entry, cls }: { entry: Entry; cls: string }) {
  const v = useApp();
  const update = useStore(updateStore).ready, adding = useStore(boardAdd);
  const ok = paired(), me = L.me, pk = partnerKey();
  const warn = Sync.state === 'error' || !!(L.auth && L.auth.expired), todoDot = liveTasks().some(SMART.today.match);
  const unread = unreadNow(), pt = firstWord(person(pk).name);
  const posted = wroteOn(todayStr(), pk); // your partner wrote in the journal today
  useEffect(() => { // the offline note and "Waiting to send" follow the connection
    const net = () => renderNow();
    addEventListener('online', net); addEventListener('offline', net);
    return () => { removeEventListener('online', net); removeEventListener('offline', net); };
  }, []);
  return (
    <section className={`${cls} boardview home-v2${adding ? ' adding' : ''}`} data-vid={entry.id}>
      <header className="home-top">
        <h1 className="board-title">Home</h1>
        <AreaBoundary area="Home’s top" compact>
        <button className="fab-btn home-me" type="button" aria-label="Settings" onClick={() => openSettings()} style={colorVar(color(me))}>
          <Portrait look={avatarOf(me)} who={me} size={46} /><i className={`fab-dot${warn ? ' warn' : ''}`} hidden={!warn && !update} />
        </button>
        <span className="home-me-txt"><b>{firstWord(person(me).name)}</b><span>{ok ? `with ${pt}` : 'Just you, for now'}</span></span>
        <button className="home-pt" type="button" style={colorVar(color(pk))} onClick={toPartner}
          aria-label={ok ? `${pt}${unread ? `, ${unread} new` : ''}. Open your chat` : 'Add your partner'}>
          <Portrait look={avatarOf(pk)} who={pk} size={32} /><span className="home-pt-name">{ok ? pt : 'Add partner'}</span>
          {unread ? <b className="home-n" aria-hidden="true">{unread > 9 ? '9+' : unread}</b> : null}
        </button>
        </AreaBoundary>
      </header>
      <AreaBoundary area="Home"><Notes v={v} online={typeof navigator === 'undefined' || navigator.onLine} /></AreaBoundary>
      <nav className="board-tray home-dock" aria-label="Main">
        <div className="dock-pill">
          <button className="dock-tab on" type="button" aria-label="Home" aria-current="page"><Icon name="home" /></button>
          <button className="fab-btn dock-tab" type="button" aria-label="To-dos and reminders" onClick={() => navTo({ type: 'todos' })}><Icon name="todo" /><i className="fab-dot" hidden={!todoDot} /></button>
          <button className="fab-btn dock-tab" type="button" aria-label={posted ? 'Journal, new today' : 'Journal'} onClick={() => openJournal()}><Icon name="journal" /><i className="fab-dot" hidden={!posted} /></button>
          <button className="tray-btn chat dock-tab" type="button" onClick={toPartner}
            aria-label={ok ? (unread ? `Message ${pt}, ${unread} new` : `Message ${pt}`) : 'Add your partner'}>
            <Icon name="chat" />{unread ? <b className="tray-n">{unread > 9 ? '9+' : unread}</b> : null}
          </button>
        </div>
        <button className="tray-btn add dock-add" type="button" id="boardAdd" aria-label="Add a to-do" onClick={openBoardAdd}><Icon name="plus" /></button>
      </nav>
    </section>
  );
}
