'use client';
/* Twodo · Home when you're signed in: the two of you, as your characters. Yours tells you about your day in the voice
   of the role you picked; tap your partner's to open your chat (a number says how many are new). Then today's to-dos
   to tick in place, with the week one tap away. Two actions never move: message your partner, add a to-do.
   Nothing is stored for Home itself; characters and roles live in the people record (docs/characters.md).
   Privacy: everything here comes from liveTasks(), the chat and the shared journal, so nothing from a secret list
   (content, titles, counts) can appear, and the character never mentions one. It never shows a message's text. */
import { memo, useEffect, useRef, useState } from 'react';
import { Chat, type Msg } from '@/lib/chat';
import { avatarOf, lines, roleName, roleOf, type Facts } from '@/lib/characters';
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

/** The two of you. Yours speaks (tap it for the next thing); your partner's is the way into your chat. */
function Stage({ facts, unread }: { facts: Facts; unread: number }) {
  const me = L.me, pk = partnerKey(), role = roleOf(me), said = lines(facts, role);
  const paired = !!(L.pair && L.pair.status === 'paired'), pt = firstWord(person(pk).name);
  const [i, setI] = useState(0), [play, setPlay] = useState('wave'), [ptPlay, setPtPlay] = useState('');
  const line = said[i % said.length];
  const still = reducedMotion.matches;
  const next = () => {
    setI(n => n + 1); haptic('light');
    if (!still) { setPlay(''); requestAnimationFrame(() => setPlay('hop')); }
  };
  const toPartner = () => {
    if (!still) { setPtPlay(''); requestAnimationFrame(() => setPtPlay('wave')); }
    if (paired) ChatCtl.open(); else openInviteSheet();
  };
  return (
    <section className="stage" aria-label="The two of you">
      <div className="stage-say" style={colorVar(color(me))}>
        <p className="say" aria-live="polite">{line}</p>
        <div className="stage-chips">
          <span className="role">{roleName(role)}</span>
          <button className="role-change" type="button" onClick={openCharacter}>Change</button>
          {said.length > 1 ? <span className="say-n" aria-hidden="true">{(i % said.length) + 1}/{said.length}</span> : null}
        </div>
      </div>
      <div className="stage-floor">
        <button className="stage-char me" type="button" style={colorVar(color(me))} onClick={next} aria-label="Your character. Tap for what’s next">
          <Character look={avatarOf(me)} size={122} cls={still ? '' : play} /><span className="stage-name">You</span>
        </button>
        <button className="stage-char pt" type="button" style={colorVar(color(pk))} onClick={toPartner}
          aria-label={paired ? `${pt}${unread ? `, ${unread} new` : ''}. Open your chat` : 'Add your partner'}>
          <Character look={avatarOf(pk)} size={110} cls={still ? '' : ptPlay} flip />
          {unread ? <b className="pt-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</b> : null}
          <span className="stage-name">{paired ? pt : 'Add partner'}</span>
        </button>
      </div>
    </section>
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
        <button className="n-h link" type="button" onClick={() => openSmart('today')}><span className="n-hcol">Today<span className="n-date">{dateLine()}</span></span><Icon name="chevR" cls="xs" /></button>
        <button className="n-week" type="button" onClick={openWeek} aria-label={`This week: ${b.week ? `${b.week} planned` : 'nothing planned'}. Open the planner`}><Icon name="week" cls="xs" />This week</button>
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
  const b = boardData(), paired = !!(L.pair && L.pair.status === 'paired');
  return (
    <main className="board home">
      {online ? null : <div className="tape" role="status"><Icon name="cloud" cls="xs" />Offline. Everything is saved here.</div>}
      <Stage facts={b.facts} unread={paired && Chat.ready() ? Chat.unread() : 0} />
      <TodayNote b={b} />
    </main>
  );
});

export function BoardView({ entry, cls }: { entry: Entry; cls: string }) {
  const v = useApp();
  const update = useStore(updateStore).ready, adding = useStore(boardAdd);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const warn = Sync.state === 'error' || !!(L.auth && L.auth.expired), todoDot = liveTasks().some(SMART.today.match);
  const unread = paired && Chat.ready() ? Chat.unread() : 0, pt = firstWord(person(partnerKey()).name);
  const posted = posts().some(e => e.date === todayStr() && e.who === partnerKey()); // your partner posted in the journal today
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
        <span className="board-acts">
          <button className="fab-btn" type="button" aria-label={posted ? 'Journal, new today' : 'Journal'} onClick={() => openJournal()}><Icon name="journal" /><i className="fab-dot" hidden={!posted} /></button>
          <button className="fab-btn" type="button" aria-label="To-dos and reminders" onClick={() => navTo({ type: 'todos' })}><Icon name="todo" /><i className="fab-dot" hidden={!todoDot} /></button>
        </span>
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
