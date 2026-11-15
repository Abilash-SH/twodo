'use client';
/* Twodo · Home when you're signed in: the board the two of you share.
   A few notes pin themselves from what already exists (the latest message, today's to-dos, what is for both of you,
   one list, a pinned to-do, the last thing ticked off) and each one is a door. Two actions never move: message your
   partner, add a to-do. Nothing is stored for the board itself.
   Privacy: every note is built from liveTasks() and the non-private lists, so nothing from a secret list
   (content, titles, counts) can appear here, locked or unlocked.
   It looks like a cork board at home (design.md, "The board"): a string of lights that glows in the evening, notes on
   paper, a polaroid, a kraft tag, a sticky note. Tap the lights to send your partner a glow: an ordinary message, and
   the lights on their board twinkle in your colour until they read it. */
import { memo, useEffect, useRef, useState } from 'react';
import { Chat, type Msg } from '@/lib/chat';
import { renderNow } from '@/lib/render';
import { L, SMART, cStr, fmtDue, fmtTime, lists, liveTasks, partnerKey, person, sortTasks } from '@/lib/store';
import { Inbox, Sync } from '@/lib/sync';
import type { JournalEntry, List, PersonKey, Task } from '@/lib/types';
import { dayDiff, firstWord, reducedMotion, todayStr, ymd } from '@/lib/util';
import { haptic } from '@/lib/feedback';
import { useApp } from '@/hooks/useApp';
import { useFlip } from '@/hooks/useFlip';
import { boardAdd, navTo, openBoardAdd, openJournal, openList, openSmart, type Entry } from '@/ui/nav';
import { WEATHER, getPage, hasWords, promptFor } from '@/lib/journal';
import { island } from '@/ui/island';
import { useStore } from '@/ui/store';
import { Leaving, Pending, Popping, toggleDone } from '@/ui/tasks';
import { updateStore } from '@/ui/update';
import { ChatCtl } from '../chat/chatCtl';
import { openInviteSheet } from '../settings/AccountSheets';
import { openSettings } from '../settings/Settings';
import { openTaskSheet } from '../sheets/TaskSheet';
import { Avatar, colorVar, cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

/* ---------- what is on the board (plain data, so it is easy to check) ---------- */
interface MsgNote { kind: 'invite' | 'request' | 'sent' | 'hello' | 'new' | 'waiting' | 'failed' | 'last'; who: PersonKey; text: string; n: number; when: string }
export interface Board {
  msg: MsgNote; today: Task[]; todayMore: number; together: number; next: Task | null; list: { l: List; n: number } | null;
  pinned: Task | null; pinnedMore: number; done: { t: Task; who: PersonKey } | null; empty: boolean;
  page: { mine?: JournalEntry; theirs?: JournalEntry }; // today's shared journal page (never the private one)
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
  const today = sortTasks(open.filter(SMART.today.match)), pins = sortTasks(open.filter(t => t.pinned));
  const counts = new Map<string, number>();
  for (const t of open) counts.set(t.listId, (counts.get(t.listId) || 0) + 1);
  // one list: the one with the most left to do (your own lists before the Inbox)
  const ranked = lists().filter(l => !l.private && (counts.get(l.id) || 0) > 0)
    .sort((a, b) => Number(a.id === 'inbox') - Number(b.id === 'inbox') || (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.order - b.order);
  const recent = liveTasks().filter(t => t.done && t.doneAt && t.doneBy && Date.now() - t.doneAt < 36 * 3600e3).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))[0];
  const msg = messageNote(), us = open.filter(SMART.us.match), t0 = todayStr();
  // the next thing planned for the two of you, from today on
  const next = us.filter(t => t.due && t.due >= t0).sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : (a.time || '99') < (b.time || '99') ? -1 : 1))[0] || null;
  return {
    msg, today: today.slice(0, 3), todayMore: Math.max(0, today.length - 3), together: us.length, next,
    list: ranked.length ? { l: ranked[0], n: counts.get(ranked[0].id) || 0 } : null,
    pinned: pins[0] || null, pinnedMore: Math.max(0, pins.length - 1),
    done: recent ? { t: recent, who: recent.doneBy as PersonKey } : null,
    page: { mine: getPage(false, todayStr(), L.me), theirs: getPage(false, todayStr(), partnerKey()) },
    empty: !today.length && !pins.length && !ranked.length && !recent && !us.length && (msg.kind === 'hello' || msg.kind === 'invite'), // a request is never hidden
  };
}

/* ---------- pieces ---------- */
const Pin = ({ c, at }: { c: string; at?: string }) => <i className="pin" aria-hidden="true" style={cssVars({ '--c': `var(--c-${c})`, ...(at ? { left: at } : {}) })} />;
/** washi tape across the top of a note, in a person's colour (or kraft paper) */
const Tape = ({ c, kind = 'dots' }: { c?: string; kind?: 'dots' | 'kraft' }) => <i className={`washi ${kind}`} aria-hidden="true" style={c ? cssVars({ '--c': `var(--c-${c})` }) : undefined} />;

/* ---------- the string of lights ---------- */
/** The message a glow sends: plain text, so older versions and the chat show it as it is */
export const GLOW = 'Thinking of you ✨';
const WIRE = 'M-3 3 C-1.8 3.8 0.9 5.7 4 8 C7.1 10.3 11.7 14.8 15.5 17 C19.3 19.2 23.2 21 27 21 C30.8 21 34.7 19 38.5 17 C42.3 15 46.2 9.2 50 9 C53.8 8.8 57.7 14 61.5 16 C65.3 18 69.2 20.8 73 21 C76.8 21.2 80.7 19 84.5 17 C88.3 15 92.9 11.3 96 9 C99.1 6.7 101.8 4 103 3';
const isEvening = (): boolean => { const h = new Date().getHours(); return h >= 18 || h < 6; };
/** evening from 6 pm to 6 am: the lights come on by themselves (checked again when the app comes back) */
function useEvening(): boolean {
  const [ev, setEv] = useState(isEvening);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const n = new Date(), at = new Date(n), h = n.getHours();
      at.setHours(h >= 18 ? 30 : h < 6 ? 6 : 18, 0, 2, 0); // the next 6 am or 6 pm
      t = setTimeout(() => { setEv(isEvening()); arm(); }, at.getTime() - n.getTime());
    };
    const back = () => { if (!document.hidden) { setEv(isEvening()); clearTimeout(t); arm(); } };
    arm(); document.addEventListener('visibilitychange', back);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', back); };
  }, []);
  return ev;
}
/** Send your partner a glow: asked first (one tap on the island), then sent as an ordinary message */
function offerGlow(): void {
  if (!(L.pair && L.pair.status === 'paired') || !L.auth || !Chat.ready()) return;
  const pt = firstWord(person(partnerKey()).name);
  island({ e: '✨', text: `Send ${pt} a little glow?`, sub: 'The lights on their board will twinkle', btn: 'Send', ms: 3800, onBtn: () => {
    const m = Chat.send({ t: GLOW, fx: 'gentle' });
    Chat.played[m.id] = 1; Chat.saveSoon(); haptic('success'); renderNow();
    island({ e: '✨', text: `Glow sent to ${pt}`, sub: 'It’s in your chat too' });
  } });
}
/** A string of nine bulbs across the top of the board. They glow in the evening; a tap makes them twinkle.
    `from`: your partner sent a glow you haven't read yet, so they twinkle in their colour. */
function Lights({ from }: { from: PersonKey | null }) {
  const ref = useRef<HTMLButtonElement>(null);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const tap = () => {
    haptic('light');
    // a wave from left to right (opacity only, on the compositor); from and to are whatever the bulb shows now
    if (ref.current && !reducedMotion.matches) ref.current.querySelectorAll<HTMLElement>('.glow').forEach((g, k) =>
      g.animate([{ opacity: 1, offset: .25 }, { opacity: .25, offset: .55 }, { opacity: 1, offset: .8 }], { duration: 900, delay: k * 55, easing: 'ease-in-out' }));
    if (paired) offerGlow();
  };
  return (
    <button ref={ref} type="button" className={`lights${from ? ' from' : ''}`} style={from ? colorVar(color(from)) : undefined} onClick={tap}
      aria-label={paired ? `String of lights. Send ${firstWord(person(partnerKey()).name)} a glow` : 'String of lights'}>
      <svg className="wire" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d={WIRE} vectorEffect="non-scaling-stroke" /></svg>
      {Array.from({ length: 9 }, (_, k) => <i key={k} className="bulb" aria-hidden="true"><b className="glow" /></i>)}
    </button>
  );
}
/** a sprig of lavender, tied with twine (decoration only) */
const Lavender = () => (
  <svg className="lavender" viewBox="0 0 24 96" aria-hidden="true">
    {[[0, -8], [8, 0], [15, 9]].map(([dx, rot]) => (
      <g key={dx} transform={`rotate(${rot} ${dx + 2} 80)`}>
        <path className="stem" d={`M${dx + 2} 6 L${dx + 2} 92`} />
        {Array.from({ length: 7 }, (_, k) => <ellipse key={k} className={k % 2 ? 'bud a' : 'bud'} cx={dx + 2 + (k % 2 ? 1.6 : -1.6)} cy={6 + k * 5.2} rx="2.4" ry="3.4" />)}
      </g>
    ))}
    <path className="tie" d="M3 66 C 8 62, 14 62, 20 66 M11 65 l -6 10 M11 65 l 5 11" />
  </svg>
);
const color = (k: PersonKey) => person(k).color;
const nameOf = (k: PersonKey) => (k === L.me ? 'You' : firstWord(person(k).name));
/** the ring of a checkbox says whose to-do it is: one colour, both colours, or neutral */
function ringStyle(t: Task) {
  if (t.assignee === 'both') return cssVars({ '--ca': `var(--c-${color('a')})`, '--cb': `var(--c-${color('b')})` });
  return t.assignee ? cssVars({ '--ca': `var(--c-${color(t.assignee)})`, '--cb': `var(--c-${color(t.assignee)})` }) : undefined;
}
const whose = (t: Task) => (t.assignee === 'both' ? ', for both of you' : !t.assignee ? '' : t.assignee === L.me ? ', for you' : `, for ${firstWord(person(t.assignee).name)}`);

function MessageNote({ m }: { m: MsgNote }) {
  const pt = firstWord(person(partnerKey()).name);
  if (m.kind === 'invite' || m.kind === 'request' || m.kind === 'sent' || m.kind === 'hello') {
    const [title, sub, go] = m.kind === 'request' ? [`${m.text} wants to connect`, 'Accept to chat and share to-dos.', 'See request']
      : m.kind === 'sent' ? [`Waiting for ${m.text}`, 'Your chat starts here as soon as they accept.', 'Open']
      : m.kind === 'invite' ? ['Add your partner', 'Connect to chat and share to-dos.', 'Connect'] : [`Say hi to ${pt}`, 'No messages yet.', 'Write'];
    return (
      <button className="note n-msg r1" type="button" style={colorVar(color(m.who))} onClick={() => (m.kind === 'hello' ? ChatCtl.open() : openInviteSheet())}>
        <Tape c={color(m.who)} />
        <span className="n-h">{title}</span>
        <span className="n-sub">{sub}</span>
        <span className="n-go">{go}<Icon name="chevR" cls="xs" /></span>
      </button>
    );
  }
  const stuck = m.kind === 'waiting' || m.kind === 'failed';
  return (
    <button className={`note n-msg r1${stuck ? ' stuck' : ''}`} type="button" style={colorVar(color(m.who))} onClick={() => ChatCtl.open()}
      aria-label={`${m.kind === 'new' ? `${m.n} new from ${pt}` : m.who === L.me ? 'You wrote' : `${pt} wrote`}: ${m.text}. Open the chat`}>
      <Tape c={color(m.who)} />
      <span className="n-who"><span className="n-name">{m.who === L.me ? 'You' : pt}</span>{m.kind === 'new' ? <b className="n-badge">{m.n > 9 ? '9+' : m.n} new</b> : null}</span>
      <span className="n-text">{m.text}</span>
      {stuck ? <span className="n-meta"><Icon name="clock" cls="xs" />{m.kind === 'failed' ? 'Not delivered' : 'Waiting to send'}</span>
        : <span className="n-go">{m.kind === 'new' || m.who !== L.me ? 'Reply' : m.when}<Icon name="chevR" cls="xs" /></span>}
    </button>
  );
}

/** Today's journal page: what your partner wrote (the shared journal only), or a prompt to start it */
function PageNote({ p }: { p: Board['page'] }) {
  const pk = partnerKey(), pt = firstWord(person(pk).name), theirs = hasWords(p.theirs) ? p.theirs! : null, mine = hasWords(p.mine);
  const [who, head, body, go] = theirs ? [pk, `${pt} wrote today`, theirs.text, mine ? 'Read' : 'Read and write']
    : mine ? [L.me, 'You wrote today', `${pt} hasn’t written yet.`, 'Open'] : [L.me, 'Today’s page', promptFor(todayStr()), 'Write'];
  const wx = theirs && theirs.mood ? WEATHER.find(w => w[0] === theirs.mood) : null;
  return (
    <button className={`note n-page r7${theirs ? ' wrote' : ''}`} type="button" style={colorVar(color(who))} onClick={() => openJournal('us')}
      aria-label={`${head}${theirs ? `: ${theirs.text.slice(0, 120)}` : ''}. Open the journal`}>
      <svg className="clip" viewBox="0 0 14 36" aria-hidden="true"><path d="M4 10 V27 a3 3 0 0 0 6 0 V6 a4.5 4.5 0 0 0 -9 0 V26 a6 6 0 0 0 12 0 V12" /></svg>
      <span className="n-h">{head}{wx ? <span className="n-wx" title={wx[2]}><Icon name={wx[1]} cls="xs" /></span> : null}</span>
      <span className={`n-page-t${theirs ? '' : ' prompt'}`}>{body}</span>
      <span className="n-go">{go}<Icon name="chevR" cls="xs" /></span>
    </button>
  );
}

let dl: Intl.DateTimeFormat | null = null;
const dateLine = () => (dl ||= new Intl.DateTimeFormat([], { weekday: 'short', day: 'numeric', month: 'short' })).format(new Date());
function TodayNote({ b }: { b: Board }) {
  const rows = useRef<HTMLDivElement>(null);
  useFlip(rows, 'board-today', '.bn-task[data-id]'); // one is ticked off: it fades where it is, then the others slide up
  const a = color('a'), bb = color('b');
  return (
    <div className="note n-today r2">
      <Pin c={a} at="30%" /><Pin c={bb} at="70%" />
      <i className="holes" aria-hidden="true" />
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
              {t.time ? <span className="bn-time">{fmtTime(t.time)}</span> : null}
            </div>
          );
        })}
      </div>
      {b.today.length ? null : <span className="n-sub">Nothing planned today.</span>}
      {b.todayMore ? <button className="n-go" type="button" onClick={() => openSmart('today')}>{b.todayMore} more<Icon name="chevR" cls="xs" /></button> : null}
    </div>
  );
}

/** The notes only draw again when the data changes (or the connection does), never when a screen slides over the board. */
const Notes = memo(function Notes({ v, online }: { v: number; online: boolean }) {
  void v;
  const b = boardData();
  const glowFrom = b.msg.kind === 'new' && b.msg.text === GLOW ? b.msg.who : null;
  if (b.empty) {
    return (
      <main className="board empty">
        <Lights from={null} />
        {online ? null : <div className="tape" role="status"><Icon name="cloud" cls="xs" />Offline. Your board is saved here.</div>}
        <div className="slot s1" aria-hidden="true">{b.msg.kind === 'invite' ? 'Your partner' : `${firstWord(person(partnerKey()).name)}’s latest message`}</div>
        <div className="slot s2" aria-hidden="true">Today</div>
        <div className="note n-empty">
          <Pin c={color(L.me)} />
          <span className="n-h">Nothing pinned yet</span>
          <span className="n-sub">{b.msg.kind === 'invite' ? 'Connect with your partner, or add a to-do.' : `Say hi to ${firstWord(person(partnerKey()).name)} or add a to-do.`} What matters today pins itself here for both of you.</span>
        </div>
      </main>
    );
  }
  const { list, pinned, done } = b;
  return (
    <main className="board">
      <Lights from={glowFrom} />
      {online ? null : <div className="tape" role="status"><Icon name="cloud" cls="xs" />Offline. Your board is saved here.</div>}
      <MessageNote m={b.msg} />
      <TodayNote b={b} />
      <button className="note n-us r3" type="button" onClick={() => openSmart('us')}
        aria-label={`Together: ${b.together} to do as a pair${b.next ? `. Next: ${b.next.title}, ${fmtDue(b.next.due, b.next.time)}` : ''}. Open`}>
        <Tape kind="kraft" />
        <span className="n-photo"><Avatar k="a" /><Avatar k="b" /></span>
        <span className="n-h">Together</span>
        <span className="n-sub">{b.together ? `${b.together} to do as a pair` : 'Nothing for the two of you yet'}</span>
        {b.next ? <span className="n-next">Next: {b.next.title} · {fmtDue(b.next.due, b.next.time)}</span> : null}
      </button>
      {list ? (
        <button className="note n-list r4" type="button" style={colorVar(list.l.color)} onClick={() => openList(list.l.id)}>
          <i className="kraft" aria-hidden="true" />
          <svg className="twine" viewBox="0 0 40 60" aria-hidden="true"><path d="M14 4 C 2 20, 6 40, 21 56" /><path className="b" d="M14 4 C 24 18, 24 40, 21 56" /></svg>
          <Pin c={list.l.color} at="20px" />
          <span className="n-ic" aria-hidden="true">{list.l.emoji}</span>
          <span className="n-col"><span className="n-h">{list.l.name}</span><span className="n-sub">{list.n} to do</span></span>
        </button>
      ) : null}
      {pinned ? (
        <div className="note n-pin r5">
          <Pin c="orange" />
          <button className="n-open" type="button" onClick={() => openTaskSheet(pinned.id)}>
            <span className="n-tag"><Icon name="pin" cls="xs" />Pinned</span>
            <span className="n-h">{pinned.title}</span>
            <span className="n-sub">{[fmtDue(pinned.due, pinned.time), pinned.assignee === 'both' ? 'Both of you' : pinned.assignee ? nameOf(pinned.assignee) : ''].filter(Boolean).join(' · ') || 'No date'}</span>
          </button>
          {b.pinnedMore ? <button className="n-go" type="button" onClick={() => openSmart('pinned')}>{b.pinnedMore} more pinned<Icon name="chevR" cls="xs" /></button> : null}
        </div>
      ) : <div className="slot s-pin">Pin a to-do and it stays here</div>}
      <PageNote p={b.page} />
      <Lavender />
      {done ? <div className="strip r6" style={colorVar(color(done.who))}><i className="torn" aria-hidden="true" /><b className="strip-chk" aria-hidden="true"><Icon name="check" cls="xs" /></b><span>{nameOf(done.who)} ticked off {done.t.title}</span></div> : null}
    </main>
  );
});

export function BoardView({ entry, cls }: { entry: Entry; cls: string }) {
  const v = useApp(), evening = useEvening();
  const update = useStore(updateStore).ready, adding = useStore(boardAdd);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const warn = Sync.state === 'error' || !!(L.auth && L.auth.expired), todoDot = liveTasks().some(SMART.today.match);
  const unread = paired && Chat.ready() ? Chat.unread() : 0, pt = firstWord(person(partnerKey()).name);
  useEffect(() => { // the offline tape and "Waiting to send" follow the connection
    const net = () => renderNow();
    addEventListener('online', net); addEventListener('offline', net);
    return () => { removeEventListener('online', net); removeEventListener('offline', net); };
  }, []);
  return (
    <section className={`${cls} boardview${adding ? ' adding' : ''}${evening ? ' evening' : ''}`} data-vid={entry.id}>
      <header className="board-top">
        <button className="fab-btn" type="button" aria-label="Settings" onClick={() => openSettings()}><Icon name="gear" /><i className={`fab-dot${warn ? ' warn' : ''}`} hidden={!warn && !update} /></button>
        <h1 className="board-title">Our board</h1>
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
