'use client';
/* Twodo · Home when you're signed in: your character tells you about your day (in the voice of the role you picked),
   then your partner's latest message (their character on it), today's to-dos to tick in place, and three doors: the
   week, the journal, things for the two of you. Two actions never move: message your partner, add a to-do.
   Nothing is stored for Home itself; your character and role live in the people record (docs/characters.md).
   Privacy: everything here comes from liveTasks(), the chat and the shared journal, so nothing from a secret list
   (content, titles, counts) can appear, and the character never mentions one. */
import { memo, useEffect, useRef, useState } from 'react';
import { Chat, type Msg } from '@/lib/chat';
import { charName, charOf, lines, roleName, roleOf, type Facts } from '@/lib/characters';
import { haptic } from '@/lib/feedback';
import { posts } from '@/lib/journal';
import { renderNow } from '@/lib/render';
import { L, SMART, cStr, fmtDue, fmtTime, liveTasks, partnerKey, person, sortTasks } from '@/lib/store';
import { Inbox, Sync } from '@/lib/sync';
import type { PersonKey, Task } from '@/lib/types';
import { dayDiff, firstWord, reducedMotion, todayStr, ymd } from '@/lib/util';
import { thisWeek, weekPlan } from '@/lib/week';
import { useApp } from '@/hooks/useApp';
import { useFlip } from '@/hooks/useFlip';
import { boardAdd, navTo, openBoardAdd, openCharacter, openJournal, openSmart, openWeek, type Entry } from '@/ui/nav';
import { useStore } from '@/ui/store';
import { Leaving, Pending, Popping, toggleDone } from '@/ui/tasks';
import { updateStore } from '@/ui/update';
import { ChatCtl } from '../chat/chatCtl';
import { openInviteSheet } from '../settings/AccountSheets';
import { openSettings } from '../settings/Settings';
import { openTaskSheet } from '../sheets/TaskSheet';
import { colorVar, cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Character } from './Character';

/* ---------- what is on the board (plain data, so it is easy to check) ---------- */
interface MsgNote { kind: 'invite' | 'request' | 'sent' | 'hello' | 'new' | 'waiting' | 'failed' | 'last'; who: PersonKey; text: string; n: number; when: string }
export interface Board {
  msg: MsgNote; today: Task[]; todayMore: number; together: number; week: number; posted: PersonKey | null; facts: Facts;
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
  const t0 = todayStr(), today = sortTasks(open.filter(SMART.today.match)), pins = sortTasks(open.filter(t => t.pinned));
  const dueToday = open.filter(t => t.due === t0), timed = dueToday.filter(t => t.time).sort((a, b) => (a.time! < b.time! ? -1 : 1));
  const pk = partnerKey(), paired = !!(L.pair && L.pair.status === 'paired');
  const doneByPt = liveTasks().filter(t => t.done && t.doneAt && t.doneBy === pk && Date.now() - t.doneAt < 36 * 3600e3).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))[0];
  const msg = messageNote(), together = open.filter(SMART.us.match).length;
  const post = posts().find(e => e.date === t0), plan = weekPlan(thisWeek());
  const unread = msg.kind === 'new' ? msg.n : 0;
  const facts: Facts = {
    hour: new Date().getHours(), me: firstWord(person(L.me).name), pt: firstWord(person(pk).name), paired,
    unread, today: dueToday.length, next: timed.length ? { title: timed[0].title, time: fmtTime(timed[0].time) } : null,
    overdue: open.filter(t => t.due && t.due < t0).length,
    pinned: pins[0] ? { title: pins[0].title, when: pins[0].due ? fmtDue(pins[0].due, pins[0].time) : '' } : null,
    doneByPt: doneByPt ? doneByPt.title : null, together, ptPosted: !!posts().find(e => e.date === t0 && e.who === pk),
  };
  return {
    msg, today: today.slice(0, 3), todayMore: Math.max(0, today.length - 3), together,
    week: plan.days.reduce((n, d) => n + d.open.length, 0), posted: post ? post.who : null, facts,
  };
}

/* ---------- pieces ---------- */
const color = (k: PersonKey) => person(k).color;
/** the ring of a checkbox says whose to-do it is: one colour, both colours, or neutral */
function ringStyle(t: Task) {
  if (t.assignee === 'both') return cssVars({ '--ca': `var(--c-${color('a')})`, '--cb': `var(--c-${color('b')})` });
  return t.assignee ? cssVars({ '--ca': `var(--c-${color(t.assignee)})`, '--cb': `var(--c-${color(t.assignee)})` }) : undefined;
}
const whose = (t: Task) => (t.assignee === 'both' ? ', for both of you' : !t.assignee ? '' : t.assignee === L.me ? ', for you' : `, for ${firstWord(person(t.assignee).name)}`);

/** Your character and what it says. Tap it for the next thing it has to tell you. */
function Stage({ facts }: { facts: Facts }) {
  const me = L.me, kind = charOf(me), role = roleOf(me), said = lines(facts, role);
  const [i, setI] = useState(0), [play, setPlay] = useState('wave');
  const line = said[i % said.length];
  const next = () => {
    setI(n => n + 1); haptic('light');
    if (!reducedMotion.matches) { setPlay(''); requestAnimationFrame(() => setPlay('hop')); }
  };
  return (
    <section className="stage" style={colorVar(color(me))} aria-label="Your character">
      <button className="stage-char" type="button" onClick={next} aria-label={`${charName(kind)}, your character. Tap for what’s next`}>
        <Character kind={kind} size={112} cls={reducedMotion.matches ? '' : play} />
      </button>
      <div className="stage-say">
        <p className="say" aria-live="polite">{line}</p>
        <div className="stage-chips">
          <span className="role">{roleName(role)}</span>
          <button className="role-change" type="button" onClick={openCharacter}>Change</button>
          {said.length > 1 ? <span className="say-n" aria-hidden="true">{(i % said.length) + 1}/{said.length}</span> : null}
        </div>
      </div>
    </section>
  );
}

function MessageNote({ m }: { m: MsgNote }) {
  const pk = partnerKey(), pt = firstWord(person(pk).name), them = <span className="msg-char" aria-hidden="true"><Character kind={charOf(m.who === L.me ? L.me : pk)} size={50} /></span>;
  if (m.kind === 'invite' || m.kind === 'request' || m.kind === 'sent' || m.kind === 'hello') {
    const [title, sub, go] = m.kind === 'request' ? [`${m.text} wants to connect`, 'Accept to chat and share to-dos.', 'See request']
      : m.kind === 'sent' ? [`Waiting for ${m.text}`, 'Your chat starts here as soon as they accept.', 'Open']
      : m.kind === 'invite' ? ['Add your partner', 'Connect to chat and share to-dos.', 'Connect'] : [`Say hi to ${pt}`, 'No messages yet.', 'Write'];
    return (
      <button className="note n-msg hcard" type="button" style={colorVar(color(m.who))} onClick={() => (m.kind === 'hello' ? ChatCtl.open() : openInviteSheet())}>
        {m.kind === 'hello' ? them : <span className="msg-ic" aria-hidden="true"><Icon name={m.kind === 'invite' ? 'person' : 'chat'} /></span>}
        <span className="msg-col"><span className="n-h">{title}</span><span className="n-sub">{sub}</span><span className="n-go">{go}<Icon name="chevR" cls="xs" /></span></span>
      </button>
    );
  }
  const stuck = m.kind === 'waiting' || m.kind === 'failed';
  return (
    <button className={`note n-msg hcard${stuck ? ' stuck' : ''}`} type="button" style={colorVar(color(m.who))} onClick={() => ChatCtl.open()}
      aria-label={`${m.kind === 'new' ? `${m.n} new from ${pt}` : m.who === L.me ? 'You wrote' : `${pt} wrote`}: ${m.text}. Open the chat`}>
      {them}
      <span className="msg-col">
        <span className="n-who"><span className="n-name">{m.who === L.me ? 'You' : pt}</span>{m.kind === 'new' ? <b className="n-badge">{m.n > 9 ? '9+' : m.n} new</b> : <span className="n-when">{m.when}</span>}</span>
        <span className="n-text">{m.text}</span>
        {stuck ? <span className="n-meta"><Icon name="clock" cls="xs" />{m.kind === 'failed' ? 'Not delivered' : 'Waiting to send'}</span> : null}
      </span>
    </button>
  );
}

let dl: Intl.DateTimeFormat | null = null;
const dateLine = () => (dl ||= new Intl.DateTimeFormat([], { weekday: 'short', day: 'numeric', month: 'short' })).format(new Date());
function TodayNote({ b }: { b: Board }) {
  const rows = useRef<HTMLDivElement>(null);
  useFlip(rows, 'board-today', '.bn-task[data-id]'); // one is ticked off: it fades where it is, then the others slide up
  return (
    <section className="note n-today hcard" aria-label="Today">
      <div className="n-th">
        <button className="n-h link" type="button" onClick={() => openSmart('today')}>Today<Icon name="chevR" cls="xs" /></button>
        <span className="n-date">{dateLine()}</span>
      </div>
      <div ref={rows}>
        {b.today.map(t => {
          const checked = Pending.has(t.id);
          return (
            <div key={t.id} className={`bn-task${checked ? ' checked' : ''}${Popping.has(t.id) ? ' pop' : ''}${Leaving.has(t.id) ? ' leaving' : ''}`} data-id={t.id}>
              <button className="bn-chk" type="button" style={ringStyle(t)} aria-label={`${checked ? 'Undo' : 'Mark as done'}: ${t.title}${whose(t)}`}
                onClick={() => toggleDone(t.id)}><i>{checked ? <Icon name="check" cls="xs" /> : null}</i></button>
              <button className="bn-title" type="button" onClick={() => openTaskSheet(t.id)}><span>{t.title}</span></button>
              {t.time ? <span className="bn-time">{t.due && t.due < todayStr() ? fmtDue(t.due, t.time) : fmtTime(t.time)}</span> : null}
            </div>
          );
        })}
      </div>
      {b.today.length ? null : <span className="n-sub">Nothing planned today.</span>}
      {b.todayMore ? <button className="n-go" type="button" onClick={() => openSmart('today')}>{b.todayMore} more<Icon name="chevR" cls="xs" /></button> : null}
    </section>
  );
}

/** Home's content only draws again when the data changes (or the connection does), never when a screen slides over it. */
const Notes = memo(function Notes({ v, online }: { v: number; online: boolean }) {
  void v;
  const b = boardData(), pt = firstWord(person(partnerKey()).name);
  const journal = b.posted ? `${b.posted === L.me ? 'You' : pt} posted today` : 'Write something';
  return (
    <main className="board home">
      {online ? null : <div className="tape" role="status"><Icon name="cloud" cls="xs" />Offline. Everything is saved here.</div>}
      <Stage facts={b.facts} />
      <MessageNote m={b.msg} />
      <TodayNote b={b} />
      <nav className="tiles" aria-label="More">
        <button className="note hcard tile n-week" type="button" onClick={openWeek}><Icon name="week" /><span className="n-h">This week</span><span className="n-sub">{b.week ? `${b.week} planned` : 'Nothing planned'}</span></button>
        <button className="note hcard tile n-page" type="button" onClick={() => openJournal()}><Icon name="journal" /><span className="n-h">Journal</span><span className="n-sub">{journal}</span></button>
        <button className="note hcard tile n-us" type="button" onClick={() => openSmart('us')} aria-label={`Together: ${b.together} to do as a pair. Open`}>
          <Icon name="heart" /><span className="n-h">Together</span><span className="n-sub">{b.together ? `${b.together} to do` : 'Nothing yet'}</span></button>
      </nav>
    </main>
  );
});

export function BoardView({ entry, cls }: { entry: Entry; cls: string }) {
  const v = useApp();
  const update = useStore(updateStore).ready, adding = useStore(boardAdd);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const warn = Sync.state === 'error' || !!(L.auth && L.auth.expired), todoDot = liveTasks().some(SMART.today.match);
  const unread = paired && Chat.ready() ? Chat.unread() : 0, pt = firstWord(person(partnerKey()).name);
  useEffect(() => { // the offline note and "Waiting to send" follow the connection
    const net = () => renderNow();
    addEventListener('online', net); addEventListener('offline', net);
    return () => { removeEventListener('online', net); removeEventListener('offline', net); };
  }, []);
  return (
    <section className={`${cls} boardview${adding ? ' adding' : ''}`} data-vid={entry.id}>
      <header className="board-top">
        <button className="fab-btn" type="button" aria-label="Settings" onClick={() => openSettings()}><Icon name="gear" /><i className={`fab-dot${warn ? ' warn' : ''}`} hidden={!warn && !update} /></button>
        <h1 className="board-title">Home</h1>
        <button className="fab-btn" type="button" aria-label="To-dos and reminders" onClick={() => navTo({ type: 'todos' })}><Icon name="todo" /><i className="fab-dot" hidden={!todoDot} /></button>
      </header>
      <Notes v={v} online={typeof navigator === 'undefined' || navigator.onLine} />
      <nav className="board-tray" aria-label="Main actions">
        <button className="tray-btn chat" type="button" style={colorVar(color(partnerKey()))} onClick={() => (paired ? ChatCtl.open() : openInviteSheet())}
          aria-label={paired ? (unread ? `Message ${pt}, ${unread} new` : `Message ${pt}`) : 'Add your partner'}>
          <span className="tray-ic"><Icon name="chat" />{unread ? <b className="tray-n">{unread > 9 ? '9+' : unread}</b> : null}</span>
          <span>{paired ? `Message ${pt}` : 'Add partner'}</span>
        </button>
        <button className="tray-btn add" type="button" id="boardAdd" onClick={openBoardAdd}><Icon name="plus" /><span>Add a to-do</span></button>
      </nav>
    </section>
  );
}
