'use client';
/* Twodo · Home when you're signed in: the board the two of you share.
   A few notes pin themselves from what already exists (the latest message, today's to-dos, what is for both of you,
   one list, a pinned to-do, the last thing ticked off) and each one is a door. Two actions never move: message your
   partner, add a to-do. Nothing is stored for the board itself.
   Privacy: every note is built from liveTasks() and the non-private lists, so nothing from a secret list
   (content, titles, counts) can appear here, locked or unlocked. */
import { memo, useEffect, useRef } from 'react';
import { Chat, type Msg } from '@/lib/chat';
import { renderNow } from '@/lib/render';
import { L, SMART, cStr, fmtDue, lists, liveTasks, partnerKey, person, sortTasks } from '@/lib/store';
import { Inbox, Sync } from '@/lib/sync';
import type { List, PersonKey, Task } from '@/lib/types';
import { dayDiff, firstWord, todayStr, ymd } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { useFlip } from '@/hooks/useFlip';
import { boardAdd, navTo, openBoardAdd, openList, openSmart, type Entry } from '@/ui/nav';
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
  msg: MsgNote; today: Task[]; todayMore: number; together: number; list: { l: List; n: number } | null;
  pinned: Task | null; pinnedMore: number; done: { t: Task; who: PersonKey } | null; empty: boolean;
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
  const msg = messageNote(), together = open.filter(SMART.us.match).length;
  return {
    msg, today: today.slice(0, 3), todayMore: Math.max(0, today.length - 3), together,
    list: ranked.length ? { l: ranked[0], n: counts.get(ranked[0].id) || 0 } : null,
    pinned: pins[0] || null, pinnedMore: Math.max(0, pins.length - 1),
    done: recent ? { t: recent, who: recent.doneBy as PersonKey } : null,
    empty: !today.length && !pins.length && !ranked.length && !recent && !together && (msg.kind === 'hello' || msg.kind === 'invite'), // a request is never hidden
  };
}

/* ---------- pieces ---------- */
const Pin = ({ c, at }: { c: string; at?: string }) => <i className="pin" aria-hidden="true" style={cssVars({ '--c': `var(--c-${c})`, ...(at ? { left: at } : {}) })} />;
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
        <Pin c={color(m.who)} />
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
      <Pin c={color(m.who)} />
      <span className="n-who"><span className="n-name">{m.who === L.me ? 'You' : pt}</span>{m.kind === 'new' ? <b className="n-badge">{m.n > 9 ? '9+' : m.n} new</b> : null}</span>
      <span className="n-text">{m.text}</span>
      {stuck ? <span className="n-meta"><Icon name="clock" cls="xs" />{m.kind === 'failed' ? 'Not delivered' : 'Waiting to send'}</span>
        : <span className="n-go">{m.kind === 'new' || m.who !== L.me ? 'Reply' : m.when}<Icon name="chevR" cls="xs" /></span>}
    </button>
  );
}

function TodayNote({ b }: { b: Board }) {
  const rows = useRef<HTMLDivElement>(null);
  useFlip(rows, 'board-today', '.bn-task[data-id]'); // one is ticked off: it fades where it is, then the others slide up
  const a = color('a'), bb = color('b');
  return (
    <div className="note n-today r2">
      <Pin c={a} at="38%" /><Pin c={bb} at="62%" />
      <button className="n-h link" type="button" onClick={() => openSmart('today')}>Today<Icon name="chevR" cls="xs" /></button>
      <div ref={rows}>
        {b.today.map(t => {
          const checked = Pending.has(t.id);
          return (
            <div key={t.id} className={`bn-task${checked ? ' checked' : ''}${Popping.has(t.id) ? ' pop' : ''}${Leaving.has(t.id) ? ' leaving' : ''}`} data-id={t.id}>
              <button className="bn-chk" type="button" style={ringStyle(t)} aria-label={`${checked ? 'Undo' : 'Mark as done'}: ${t.title}${whose(t)}`}
                onClick={() => toggleDone(t.id)}><i>{checked ? <Icon name="check" cls="xs" /> : null}</i></button>
              <button className="bn-title" type="button" onClick={() => openTaskSheet(t.id)}><span>{t.title}</span></button>
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
  if (b.empty) {
    return (
      <main className="board empty">
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
      {online ? null : <div className="tape" role="status"><Icon name="cloud" cls="xs" />Offline. Your board is saved here.</div>}
      <MessageNote m={b.msg} />
      <TodayNote b={b} />
      <button className="note n-us r3" type="button" onClick={() => openSmart('us')} aria-label={`Together: ${b.together} to do as a pair. Open`}>
        <Pin c={color(partnerKey())} />
        <span className="n-photo"><Avatar k="a" /><Avatar k="b" /></span>
        <span className="n-h">Together</span>
        <span className="n-sub">{b.together ? `${b.together} to do as a pair` : 'Nothing for the two of you yet'}</span>
      </button>
      {list ? (
        <button className="note n-list r4" type="button" style={colorVar(list.l.color)} onClick={() => openList(list.l.id)}>
          <Pin c={list.l.color} at="22%" />
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
      {done ? <div className="strip r6"><Icon name="check" cls="xs" /><span>{nameOf(done.who)} ticked off {done.t.title}</span></div> : null}
    </main>
  );
});

export function BoardView({ entry, cls }: { entry: Entry; cls: string }) {
  const v = useApp();
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
    <section className={`${cls} boardview${adding ? ' adding' : ''}`} data-vid={entry.id}>
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
