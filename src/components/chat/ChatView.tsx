'use client';
/* Twodo · Home is your chat: the two of you on top, the conversation, and a floating message box */
import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chat, REACTS, type Msg, type TaskRef } from '@/lib/chat';
import { haptic } from '@/lib/feedback';
import { Ink, playBubbleFx } from '@/lib/fx';
import { EASE, MS, calm } from '@/lib/motion';
import { renderNow } from '@/lib/render';
import { D, L, SMART, fmtDue, liveTasks, makeTask, partnerKey, person, ptName, sortTasks } from '@/lib/store';
import { Inbox, Sync } from '@/lib/sync';
import { parseTask } from '@/lib/parse';
import { copyText, dayDiff, firstWord, isTouch, reducedMotion, todayStr, ymd } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { useTapKeep } from '@/hooks/useTapKeep';
import { Velocity, touchById } from '@/hooks/swipe';
import { island } from '@/ui/island';
import { showMenu } from '@/ui/menu';
import { navTo, type Entry } from '@/ui/nav';
import { viewPhoto } from '@/ui/photos';
import { useStore } from '@/ui/store';
import { toggleDone } from '@/ui/tasks';
import { openTaskSheet } from '../sheets/TaskSheet';
import { openInviteSheet } from '../settings/AccountSheets';
import { openSettings } from '../settings/Settings';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { ChatCtl, autosize, replyStore } from './chatCtl';

const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
function jumboCount(t: string): number {
  const s = String(t || '').trim();
  if (!s || s.length > 40 || /[0-9#*]/.test(s) || !/\p{Extended_Pictographic}/u.test(s)) return 0;
  if (!/^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+$/u.test(s)) return 0;
  const n = graphemes ? [...graphemes.segment(s.replace(/\s+/g, ''))].length : 1;
  return n <= 3 ? n : 0;
}
// links become tappable; everything else stays plain text
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : <Fragment key={i}>{p}</Fragment>))}</>;
}
function ChatTime({ ts }: { ts: number }) {
  const d = new Date(ts), diff = dayDiff(todayStr(), ymd(d)), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? d.toLocaleDateString([], { weekday: 'long' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
  return <><b>{day}</b>{' ' + t}</>;  // one text node: a lone space would vanish inside .c-time (display: table)
}
const HEART = 'M12 20.3s-7.6-4.6-9.4-9.3C1.4 7.6 3.7 4.3 7.1 4.3c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.4 0 5.7 3.3 4.5 6.7-1.8 4.7-9.4 9.3-9.4 9.3z';

/* ---------- one message ---------- */
function TaskCard({ tk, mine }: { tk: TaskRef; mine: boolean }) {
  const t = D.tasks[tk.id], live = t && !t.deleted ? t : null, done = !!(live && live.done);
  const title = live ? live.title : tk.title, due = live ? fmtDue(live.due, live.time) : fmtDue(tk.due, tk.time);
  return (
    <div className={`tcard ${mine ? 'me' : 'them'}${done ? ' done' : ''}${live ? '' : ' gone'}`} data-task={tk.id}>
      <div className="tc-h"><Icon name="list" cls="xs" /> Shared task</div>
      <div className="tc-b"><button className="tc-chk" data-taskchk={tk.id} type="button" aria-label="Complete task"><Icon name="check" /></button>
        <div><div className="tc-t">{title}</div>{due ? <div className="tc-m"><Icon name="cal" cls="xs" /> {due}</div> : null}</div></div>
    </div>
  );
}
function InkBubble({ cls, children }: { cls: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el) Ink.attach(el); return () => { if (el) Ink.detach(el); }; }, []);
  return <div ref={ref} className={cls}>{children}</div>;
}
function Quote({ m }: { m: Msg }) {
  const rp = m.rp!, ref = Chat.msgs[rp.id], who = rp.f === L.auth!.uid ? 'You' : firstWord(ptName()), q = ref ? ChatCtl.previewOf(ref) : rp.q;
  return <span className="rq" data-rq={rp.id} role="button"><b>{who}</b><span>{q || 'Message'}</span></span>;
}
export function MessageInner({ m, mine }: { m: Msg; mine: boolean }) {
  const side = mine ? 'me' : 'them';
  const n = !m.task && !m.rp && m.fx !== 'ink' ? jumboCount(m.t) : 0;
  const by: Record<string, string[]> = {};
  for (const [uid, e] of Object.entries(Chat.rx[m.id] || {})) (by[e] = by[e] || []).push(uid);
  const rs = Object.entries(by);
  const bubCls = `bub ${side}${m.fx === 'ink' ? ' ink' : ''}${m.rp ? ' has-rq' : ''}`;
  const content = <>{m.rp ? <Quote m={m} /> : null}<Linkified text={m.t} /></>;
  return (
    <div className="bwrap">
      {m.task ? <TaskCard tk={m.task} mine={mine} /> : n ? <div className={`jumbo n${n}`}>{m.t}</div>
        : m.fx === 'ink' ? <InkBubble cls={bubCls}>{content}</InkBubble> : <div className={bubCls}>{content}</div>}
      {/* reactions: one small glass capsule on the bubble's corner, grouped by emoji */}
      {rs.length ? <div className="tapb">{rs.map(([e, us]) => <span key={e} className={us.includes(L.auth!.uid) ? 'mine' : ''}>{e}{us.length > 1 ? <b>{us.length}</b> : null}</span>)}</div> : null}
    </div>
  );
}

/* ---------- the list, as keyed rows ---------- */
// The data layer mutates status/reactions in place. Capture a primitive revision at render time;
// object identity alone would miss acknowledgements, unsends, quotes and live shared-task edits.
const MessageRow = memo(function MessageRow({ m, cls }: { m: Msg; cls: string; revision: string; photo?: string }) {
  const mine = m.f === L.auth!.uid;
  return <div className={cls} data-id={m.id}>{m.del
    ? <div className="unsent">{mine ? 'You' : firstWord(ptName())} unsent a message</div>
    : <>
      {m.status === 'failed' ? <button className="c-fail" data-retry={m.id} type="button" aria-label="Retry sending">!</button> : null}
      {mine ? null : <span className="c-av">{cls.includes(' end') ? <Avatar k={partnerKey()} /> : null}</span>}
      <MessageInner m={m} mine={mine} />
    </>}</div>;
}, (a, b) => a.m.id === b.m.id && a.m.status === b.m.status && a.m._u === b.m._u
  && a.m.t === b.m.t && a.m.del === b.m.del && a.m.fx === b.m.fx && a.m.f === b.m.f && a.m.ts === b.m.ts
  && a.m.rp === b.m.rp && a.m.task === b.m.task && a.revision === b.revision && a.cls === b.cls && a.photo === b.photo);

interface Item { k: string; cls: string; node?: React.ReactNode; id?: string; m?: Msg; revision?: string; photo?: string }
function items(): Item[] {
  const me = L.auth!.uid, sorted = Object.values(Chat.msgs).sort((a, b) => (a.id < b.id ? -1 : 1));
  // reading older messages? new ones mustn't push rows out of the top (that would make the page jump)
  if (ChatCtl.total && sorted.length > ChatCtl.total && !ChatCtl.pinned) ChatCtl.limit += sorted.length - ChatCtl.total;
  ChatCtl.total = sorted.length;
  const ms = sorted.length > ChatCtl.limit ? sorted.slice(-ChatCtl.limit) : sorted;
  if (!(L.pair && L.pair.status === 'paired')) {
    const inc = Inbox.incoming(), sent = L.pair && L.pair.status === 'sent';
    return [{ k: 'pair' + inc.length + (sent ? 's' : ''), cls: 'c-empty', node: inc.length
      ? <><span className="c-e">💌</span><h3>{inc[0][1].name} wants to connect</h3><p>Accept to start your chat and share to-dos.</p><button className="c-cta" type="button" onClick={() => openInviteSheet()}>See request</button></>
      : sent ? <><span className="c-e">⏳</span><h3>Waiting for {firstWord(L.pair!.name)}</h3><p>As soon as {firstWord(L.pair!.name)} accepts, your chat starts right here.</p></>
      : <><span className="c-e">💞</span><h3>Add your partner</h3><p>Connect with their username to chat and share to-dos.</p><button className="c-cta" type="button" onClick={() => openInviteSheet()}>Add partner</button></> }];
  }
  if (!ms.length) {
    return [{ k: 'empty', cls: 'c-empty', node: <><span className="c-e">👋</span><h3>Say hi to {firstWord(ptName())}</h3><p>Your messages and shared to-dos live here.</p>
      <div className="c-quick">{['👋 Hi!', '❤️', 'Miss you 🥺', 'What’s for dinner?'].map(q => <button key={q} type="button" data-quick={q}>{q}</button>)}</div></> }];
  }
  const out: Item[] = []; let prev: Msg | null = null;
  const lastMine = [...ms].reverse().find(m => m.f === me && !m.del), last = ms[ms.length - 1];
  ms.forEach((m, i) => {
    const next = ms[i + 1], brk = !prev || m.ts - prev.ts > 3600e3;
    if (brk) out.push({ k: 't' + m.id, cls: 'c-time', node: <ChatTime ts={m.ts} /> });
    const start = brk || prev!.f !== m.f || m.ts - prev!.ts > 120e3 || prev!.del || m.del;
    const end = !next || next.f !== m.f || next.ts - m.ts > 120e3 || next.del || m.del;
    const mine = m.f === me, side = mine ? 'me' : 'them';
    const hasTb = Object.keys(Chat.rx[m.id] || {}).length > 0;
    out.push({ k: m.id, id: m.id, m: { ...m }, photo: person(partnerKey()).photo,
      cls: `msg-row ${side}${start ? ' start' : ''}${end ? ' end' : ''}${hasTb ? ' has-tb' : ''}`,
      revision: JSON.stringify([Chat.rx[m.id], m.task ? D.tasks[m.task.id]?.updatedAt : null,
        m.rp ? ChatCtl.previewOf(Chat.msgs[m.rp.id] || m) : null,
        L.auth!.uid, partnerKey(), person(partnerKey()).name, person(partnerKey()).color]) });
    // One heart delivered, two overlapping hearts seen; faint while sending.
    if (m === lastMine && (m === last || m.status !== 'sent')) {
      const heart = <svg className="hs" viewBox="0 0 24 24" aria-hidden="true"><path d={HEART} /></svg>;
      out.push(m.status === 'failed' ? { k: 's' + m.id, cls: 'c-status fail', node: 'Not delivered' }
        : m.status === 'sending' ? { k: 's' + m.id, cls: 'c-status sending', node: heart }
        : Chat.partnerRead >= m.ts ? { k: 's' + m.id, cls: 'c-status seen', node: <>{heart}{heart}<span className="sr">Seen</span></> }
        : { k: 's' + m.id, cls: 'c-status sent', node: <>{heart}<span className="sr">Delivered</span></> });
    }
    prev = m;
  });
  return out;
}

/* ---------- menus ---------- */
function quickHeart(row: HTMLElement) {
  const id = row.dataset.id!, m = Chat.msgs[id]; if (!m || m.del) return;
  void Chat.react(id, '❤️'); haptic('success');
  const w = row.querySelector('.bwrap')!, h = document.createElement('div'); h.className = 'c-pop-heart'; h.textContent = '❤️'; w.appendChild(h);
  if (reducedMotion.matches) { h.remove(); return; }
  h.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-90%) scale(1)', opacity: 0 }],
    { duration: 800, easing: 'cubic-bezier(.34,1.56,.64,1)' }).onfinish = () => h.remove();
}
function openBubbleMenu(row: HTMLElement | null) {
  if (!row) return;
  const id = row.dataset.id!, m = Chat.msgs[id]; if (!m || m.del) return;
  const mine = m.f === L.auth!.uid, myR = (Chat.rx[id] || {})[L.auth!.uid], w = row.querySelector('.bwrap')!;
  haptic('medium');
  const its: [string, string, string][] = [['reply', 'Reply', 'reply']];
  if (m.t) its.push(['copy', 'Copy', 'copy']);
  if (m.t) its.push(['task', 'Make it a task', 'check']);
  if (m.task && D.tasks[m.task.id]) its.push(['open', 'Open task', 'list']);
  if (mine && m.status === 'failed') its.push(['retry', 'Try again', 'repeat']);
  if (mine && m.status === 'sent' && Date.now() - m.ts < 15 * 60e3) its.push(['unsend', 'Undo Send', 'trash']);
  showMenu({
    rect: w.getBoundingClientRect(), align: mine ? 'right' : 'left', previewBare: true,
    preview: <div className={`msg-row ${mine ? 'me' : 'them'} end bare`}><MessageInner m={m} mine={mine} /></div>,
    content: (<>
      <div className="mpal tbp">{REACTS.map((e, i) => <button key={e} data-m="react" data-v={e} style={{ ['--i' as string]: i }} className={myR === e ? 'on' : ''} type="button" aria-label={`React ${e}`}><span>{e}</span></button>)}</div>
      {its.length ? <><div className="mgap" />{its.map(([k, label, icon]) => <button key={k} className={`mi${k === 'unsend' ? ' red' : ''}`} data-m={k} type="button">{label}<Icon name={icon} /></button>)}</> : null}
    </>),
    onPick: async (k, val) => {
      if (k === 'react') { haptic('light'); return Chat.react(id, val!); }
      if (k === 'reply') return ChatCtl.setReply(m);
      if (k === 'copy') { if (await copyText(m.t)) island({ e: '📋', text: 'Copied', ms: 1200 }); return; }
      if (k === 'open') return openTaskSheet(m.task!.id);
      if (k === 'retry') return Chat.retry(id);
      if (k === 'unsend') {
        const el = ChatCtl.el(id);
        if (el && !reducedMotion.matches) el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.6)', opacity: 0 }], { duration: 350, easing: 'ease-in', fill: 'forwards' });
        setTimeout(() => Chat.unsend(id), 330); return;
      }
      if (k === 'task') {
        const p = parseTask(m.t);
        const t = makeTask({ title: p.title, due: p.due, time: p.time, priority: p.priority || 0, tags: p.tags, listId: p.listId || 'inbox', assignee: p.assignee || L.me, repeat: p.repeat });
        island({ e: '✅', text: `Added “${t.title}”`, sub: p.due ? fmtDue(t.due, t.time) : 'to your Inbox', btn: 'Open', onBtn: () => openTaskSheet(t.id) });
      }
    },
  });
}
function openShare(btn: HTMLElement) {
  const ts = sortTasks(liveTasks().filter(t => !t.done && !Sync.isPrivate(t))).slice(0, 14);
  if (!ts.length) return island({ e: '📋', text: 'No open tasks to share', ms: 1800 });
  showMenu({
    rect: btn.getBoundingClientRect(),
    content: (<>
      <div className="mrow"><span className="lbl" style={{ width: 'auto' }}>Share a task</span></div>
      {ts.map(t => <button key={t.id} className="mi" data-m="share" data-v={t.id} type="button"><span className="tw:flex-1 tw:min-w-0 tw:truncate">{t.title}</span><span className="val" style={{ fontSize: 13 }}>{fmtDue(t.due, t.time)}</span></button>)}
    </>),
    onPick: (k, id) => { const t = id ? D.tasks[id] : null; if (t) ChatCtl.sendNow('', null, { id: t.id, title: t.title, due: t.due, time: t.time }); },
  });
}

/* ---------- header ---------- */
function ChatHeader() {
  const pk = partnerKey(), paired = !!(L.pair && L.pair.status === 'paired');
  const t = paired && Chat.partnerTyping(), on = paired && Chat.partnerOnline();
  const sub = !paired ? 'not connected yet' : t ? 'typing…' : on ? 'online' : Chat.lastSeenText();
  const subRef = useRef<HTMLDivElement>(null), heart = useRef<SVGSVGElement>(null), first = useRef(true);
  useEffect(() => { // the status line fades when it changes
    if (first.current) { first.current = false; return; }
    const el = subRef.current; if (!el) return; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
  }, [sub]);
  const setWarn = Sync.state === 'error' || !!(L.auth && L.auth.expired), todoDot = liveTasks().some(SMART.today.match);
  return (
    <header className="chat-nav">
      <button className="fab-btn" type="button" aria-label="Settings" onClick={() => openSettings()}><Icon name="gear" /><i className="fab-dot warn" hidden={!setWarn} /></button>
      <div className="ch-who">
        <div className={`lovebar${on ? ' live' : ''}`}>
          <button className="lb-av pt" type="button" aria-label="View photo" onClick={e => (paired ? viewPhoto(pk, e.currentTarget.querySelector('.av')) : openInviteSheet())}>
            <span className="av-slot">{paired ? <Avatar k={pk} /> : <span className="av lb-ghost"><Icon name="plus" /></span>}</span></button>
          <span className="lb-link" aria-hidden="true" onClick={() => { haptic('light'); const h = heart.current; if (!h) return; h.classList.remove('beat'); void h.getBoundingClientRect(); h.classList.add('beat'); }}>
            <svg viewBox="0 0 100 34" preserveAspectRatio="none"><defs><linearGradient id="lbLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" className="lb-s1" /><stop offset="1" className="lb-s2" /></linearGradient></defs><path className="lb-line" d="M3 27 Q50 -4 97 27" /></svg>
            <svg ref={heart} className="lb-heart" viewBox="0 0 24 24"><defs><linearGradient id="lbHeart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="lb-s1" /><stop offset="1" className="lb-s2" /></linearGradient></defs><path d={HEART} fill="url(#lbHeart)" /></svg></span>
          <button className="lb-av me" type="button" aria-label="View your photo" onClick={e => viewPhoto(L.me, e.currentTarget.querySelector('.av'))}><span className="av-slot"><Avatar k={L.me} /></span></button>
        </div>
        <div className="ch-pill"><div className="lb-name">{paired ? person(pk).name : 'Your partner'}</div><div ref={subRef} className={`c-sub${t ? ' typing' : ''}${on && !t ? ' online' : ''}`}>{sub}</div></div>
      </div>
      <button className="fab-btn" type="button" aria-label="To-dos and reminders" onClick={() => navTo({ type: 'todos' })}><Icon name="todo" /><i className="fab-dot" hidden={!todoDot} /></button>
    </header>
  );
}

/* ---------- the message box ---------- */
function CancelReply({ input }: { input: React.RefObject<HTMLTextAreaElement | null> }) {
  const button = useRef<HTMLButtonElement>(null);
  useTapKeep(button, () => { ChatCtl.clearReply(); haptic('light'); }, input);
  return <button ref={button} className="rb-x" type="button" aria-label="Cancel reply"><Icon name="x" /></button>;
}
function ChatBar() {
  const input = useRef<HTMLTextAreaElement>(null), send = useRef<HTMLButtonElement>(null), heart = useRef<HTMLButtonElement>(null), plus = useRef<HTMLButtonElement>(null);
  const { r, pop } = useStore(replyStore);
  const [barState, setBarState] = useState<'hidden' | 'in' | 'shown' | 'out'>('hidden');
  const held = useRef(false), holdT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const paired = !!(L.pair && L.pair.status === 'paired');
  useEffect(() => {
    if (r) { setBarState(pop ? 'in' : 'shown'); return; }
    setBarState(s => (s === 'hidden' ? s : 'out'));
    const t = setTimeout(() => setBarState(s => (s === 'out' ? 'hidden' : s)), 240);
    return () => clearTimeout(t);
  }, [r, pop]);
  useTapKeep(send, () => { if (held.current) { held.current = false; return; } ChatCtl.sendNow(input.current!.value); }, input);
  useTapKeep(heart, () => ChatCtl.sendNow('❤️', 'love'), input);
  useTapKeep(plus, () => openShare(plus.current!), input);
  return (
    <div className="chatbar">
      <div className={`cb-reply${barState === 'in' ? ' in' : ''}${barState === 'out' ? ' out' : ''}`} hidden={barState === 'hidden'} key={barState === 'in' ? 'in' + pop : 'bar'}>
        <span className="rb-ic"><Icon name="reply" /></span>
        <div className="rb-t"><b>{r ? (r.f === L.auth!.uid ? 'Replying to yourself' : 'Replying to ' + firstWord(ptName())) : ''}</b><span>{r ? r.q || 'Message' : ''}</span></div>
        <CancelReply input={input} />
      </div>
      <div className="cb-row">
        <button ref={plus} className="cb-plus" type="button" aria-label="Share a to-do"><Icon name="plus" /></button>
        <div className="cb-pill"><textarea ref={input} className="cb-in" rows={1} placeholder={paired ? `Message ${firstWord(ptName())}…` : 'Message'} aria-label="Message" enterKeyHint={isTouch() ? 'enter' : 'send'} maxLength={20000}
          onInput={e => { autosize(e.currentTarget); Chat.setTyping(!!e.currentTarget.value.trim()); }}
          onBlur={() => { ChatCtl.blurAt = performance.now(); Chat.setTyping(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch()) { e.preventDefault(); ChatCtl.sendNow(e.currentTarget.value); } }} />
          <button ref={heart} className="cb-heart" type="button" aria-label="Send a heart">❤️</button>
          {/* tap = send, hold = "Send with effect" */}
          <button ref={send} className="cb-send" type="button" aria-label="Send. Hold for effects"
            onPointerDown={() => { held.current = false; holdT.current = setTimeout(() => { held.current = true; haptic('medium'); ChatCtl.openFxPicker(input.current!.value.trim()); }, 450); }}
            onPointerUp={() => clearTimeout(holdT.current)} onPointerCancel={() => clearTimeout(holdT.current)} onPointerLeave={() => clearTimeout(holdT.current)}
            onContextMenu={e => e.preventDefault()}><Icon name="arrowUp" /></button></div>
      </div>
    </div>
  );
}

// the little reply arrow that appears behind a message you're swiping (built with DOM calls: no HTML strings anywhere)
function replyIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'i'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M9.5 5L4 10.5 9.5 16', 'M4 10.5h9.5a6.5 6.5 0 016.5 6.5v1.5']) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.append(p); }
  return svg;
}

/* ---------- swipe a message to the right to reply (mouse drag works too; the long-press menu has Reply as well) ----------
   Like other messengers: it picks up within a few pixels of sideways movement (even at a slight angle), and a short
   quick flick is enough. Touch uses touch events, so the list can't start scrolling halfway through the swipe. */
function useBubbleGestures(list: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = list.current; if (!el) return;
    const TH = 48;
    interface S { row: HTMLElement; m: Msg; sx: number; x0: number; y0: number; id: number; touch: boolean; lock: null | 'x'; hint: HTMLElement | null; dx: number; hit: boolean; buzzed: boolean; v: Velocity }
    let S: S | null = null;
    const begin = (target: HTMLElement, x: number, y: number, id: number, touch: boolean) => {
      const row = target.closest<HTMLElement>('.msg-row[data-id]'); if (!row || target.closest('a, button')) return;
      const m = Chat.msgs[row.dataset.id!]; if (!m || m.del) return;
      S = { row, m, sx: x, x0: x, y0: y, id, touch, lock: null, hint: null, dx: 0, hit: false, buzzed: false, v: new Velocity() };
      S.v.add(x, y);
    };
    // returns true once the swipe is ours
    const track = (x: number, y: number): boolean => {
      const G = S; if (!G) return false;
      const mx = x - G.x0, my = y - G.y0;
      if (G.lock === null) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return false;
        if (mx > 0 && mx > Math.abs(my) * 0.85) { // sideways-ish to the right: it's a reply swipe
          G.lock = 'x'; clearTimeout(ChatCtl.lp); ChatCtl.suppressUntil = performance.now() + 700;
          G.hint = document.createElement('span'); G.hint.className = 'rp-hint';
          G.hint.append(replyIcon());
          G.row.append(G.hint); G.row.classList.add('swiping'); G.row.style.transition = 'none';
        } else { S = null; return false; } // scrolling, or a swipe to the left
      }
      G.v.add(x, y);
      G.dx = Math.max(0, x - G.x0);
      const t = Math.min(96, G.dx < TH ? G.dx : TH + (G.dx - TH) * 0.25);
      G.row.style.transform = `translate3d(${t}px,0,0)`;
      const p = Math.min(1, G.dx / TH);
      G.hint!.style.opacity = String(Math.min(1, p * 1.4)); G.hint!.style.transform = `scale(${0.5 + 0.5 * p})`;
      if (G.dx >= TH && !G.hit) { G.hit = true; G.hint!.classList.add('hit'); if (!G.buzzed) { G.buzzed = true; haptic('medium'); } } // one catch per swipe
      else if (G.dx < TH - 8 && G.hit) { G.hit = false; G.hint!.classList.remove('hit'); }
      return true;
    };
    const finish = (fire: boolean) => {
      const G = S; S = null; if (!G || G.lock !== 'x') return;
      const { vx } = G.v.get(), last = G.dx + G.x0 - G.sx; // how far the finger really travelled
      const go = fire && (G.hit || (last > 24 && vx > 0.3)); // reached the arrow, or flicked toward it
      const row = G.row, hint = G.hint;
      row.style.transition = reducedMotion.matches ? 'none' : `transform ${MS.page}ms ${EASE.bounce}`; row.style.transform = '';
      setTimeout(() => { row.style.transition = ''; row.classList.remove('swiping'); if (hint) hint.remove(); }, MS.page + 20);
      if (go) { if (!G.buzzed) haptic('medium'); ChatCtl.setReply(G.m, false); }
    };
    // touch
    const tStart = (e: TouchEvent) => { if (e.touches.length !== 1) { finish(false); return; } const t = e.touches[0]; begin(e.target as HTMLElement, t.clientX, t.clientY, t.identifier, true); };
    const tMove = (e: TouchEvent) => {
      if (!S || !S.touch) return;
      if (e.touches.length > 1) return finish(false);
      const t = touchById(e, S.id); if (!t) return;
      if (track(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const tEnd = (e: TouchEvent) => { if (S && S.touch && touchById(e, S.id)) finish(e.type === 'touchend'); };
    // mouse
    const pDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      begin(e.target as HTMLElement, e.clientX, e.clientY, e.pointerId, false); if (!S) return;
      const move = (ev: PointerEvent) => { if (S && ev.pointerId === S.id) track(ev.clientX, ev.clientY); };
      const end = (ev: PointerEvent) => {
        if (S && ev.pointerId !== S.id) return;
        removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
        finish(ev.type === 'pointerup');
      };
      addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
    };
    // long-press = reactions + menu
    const press = (e: PointerEvent) => {
      const w = (e.target as HTMLElement).closest('.bwrap'); if (!w || (e.target as HTMLElement).closest('button')) return;
      const x0 = e.clientX, y0 = e.clientY;
      clearTimeout(ChatCtl.lp);
      ChatCtl.lp = setTimeout(() => { ChatCtl.suppressUntil = performance.now() + 700; openBubbleMenu(w.closest('.msg-row')); }, 450);
      const cancel = (ev: PointerEvent) => { if (!ev.clientX || Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { clearTimeout(ChatCtl.lp); off(); } };
      const off = () => { removeEventListener('pointermove', cancel); removeEventListener('pointerup', stop); removeEventListener('pointercancel', stop); };
      const stop = () => { clearTimeout(ChatCtl.lp); off(); };
      addEventListener('pointermove', cancel); addEventListener('pointerup', stop); addEventListener('pointercancel', stop);
    };
    const ctx = (e: MouseEvent) => { const row = (e.target as HTMLElement).closest<HTMLElement>('.msg-row'); if (!row) return; e.preventDefault(); if (!isTouch()) openBubbleMenu(row); };
    el.addEventListener('touchstart', tStart, { passive: true }); el.addEventListener('touchmove', tMove, { passive: false });
    el.addEventListener('touchend', tEnd); el.addEventListener('touchcancel', tEnd);
    el.addEventListener('pointerdown', pDown); el.addEventListener('pointerdown', press); el.addEventListener('contextmenu', ctx);
    return () => {
      el.removeEventListener('touchstart', tStart); el.removeEventListener('touchmove', tMove);
      el.removeEventListener('touchend', tEnd); el.removeEventListener('touchcancel', tEnd);
      el.removeEventListener('pointerdown', pDown); el.removeEventListener('pointerdown', press); el.removeEventListener('contextmenu', ctx);
    };
  }, [list]);
}

export function ChatView({ entry, cls }: { entry: Entry; cls: string }) {
  const v = useApp();
  const ref = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null), list = useRef<HTMLDivElement>(null);
  const paired = !!(L.pair && L.pair.status === 'paired');
  const typingShown = useRef(false), moreT = useRef(0), drawnV = useRef(-1);
  const [, force] = useState(0);
  useBubbleGestures(list);
  useLayoutEffect(() => { ChatCtl.view = ref.current; return () => { if (ChatCtl.view === ref.current) ChatCtl.view = null; }; }, []);
  useEffect(() => { Chat.ensure(); }, []);
  useEffect(() => { // every 15 s: say we're here, refresh "last seen"
    const t = setInterval(() => { Chat.beat(); if (ChatCtl.shown()) renderNow(); }, 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const b = body.current!, h = ref.current!.querySelector<HTMLElement>('.chat-nav')!, cb = ref.current!.querySelector<HTMLElement>('.chatbar')!;
    if (!window.ResizeObserver) return;
    // The keyboard opening/closing (or rotating) changes the chat's height: keep the latest message in view, in the same frame
    const r1 = new ResizeObserver(() => { if (ChatCtl.pinned) b.scrollTop = b.scrollHeight; });
    // the conversation starts right under the header, and ends above the message box, whatever their height
    const r2 = new ResizeObserver(() => ref.current?.style.setProperty('--head-full', h.offsetHeight + 'px'));
    let barH = cb.offsetHeight;
    const r3 = new ResizeObserver(() => {
      const h = cb.offsetHeight, d = h - barH; barH = h;
      ref.current?.style.setProperty('--bar-h', h + 'px');
      if (!ChatCtl.pinned) return;
      b.scrollTop = b.scrollHeight;
      // the reply bar opening/closing (not the keyboard, which glides on its own): messages slide instead of jumping
      if (Math.abs(d) > 2 && Math.abs(d) < 160 && !calm())
        for (const el of [list.current, b.querySelector<HTMLElement>('.c-typing')]) el?.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: MS.standard, easing: EASE.out, composite: 'add' });
    });
    r1.observe(b); r2.observe(h); r3.observe(cb);
    return () => { r1.disconnect(); r2.disconnect(); r3.disconnect(); };
  }, []);
  // after every render: scroll/animate for what just happened, or simply stay at the bottom
  useLayoutEffect(() => {
    const op = ChatCtl.pending; ChatCtl.pending = null;
    // Only new content needs pinning. A navigation re-render (the chat sliding under a page) must not read
    // scrollHeight: that forces a full layout of the page being pushed, inside the tap (~20 ms on a phone).
    const fresh = drawnV.current !== v; drawnV.current = v;
    if (op) ChatCtl.afterDraw(op);
    else if (fresh && ChatCtl.pinned && body.current) body.current.scrollTop = body.current.scrollHeight;
    const typing = !!(paired && Chat.partnerTyping());
    if (typing && !typingShown.current) {
      const b = ref.current!.querySelector<HTMLElement>('.c-typing .bwrap'); if (b) playBubbleFx(b, 'pop');
      const bd = body.current!; if (bd.scrollHeight - bd.scrollTop - bd.clientHeight < 140) bd.scrollTo({ top: bd.scrollHeight, behavior: 'smooth' });
    }
    typingShown.current = typing;
    if (ChatCtl.isOpen()) Chat.markRead();
  });

  // rebuilt only when the data changes, not when the chat merely slides under a page
  const its = useMemo(items, [v, paired]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section ref={ref} className={`${cls} chatview${paired ? '' : ' nopair'}`} data-vid={entry.id}>
      <div ref={body} className="chatbody" onScroll={e => {
        const b = e.currentTarget, gap = b.scrollHeight - b.scrollTop - b.clientHeight;
        ChatCtl.pinned = gap < 80;
        if (gap < 140 && ChatCtl.jumpShown) { ChatCtl.jumpShown = false; force(n => n + 1); }
        if (gap < 140) Chat.markRead();
        ref.current!.querySelector('.chat-nav')!.classList.toggle('scrolled', b.scrollTop > 2);
        if (b.scrollTop < 400 && ChatCtl.total > ChatCtl.limit && !moreT.current) moreT.current = requestAnimationFrame(() => { // load older messages, keeping your place
          moreT.current = 0;
          const h = b.scrollHeight, t = b.scrollTop; ChatCtl.limit += 120; renderNow();
          b.scrollTop = t + (b.scrollHeight - h);
        });
      }}>
        <div ref={list} className="chatlist" onClick={e => {
          const t = e.target as HTMLElement;
          const q = t.closest<HTMLElement>('[data-quick]'); if (q) return ChatCtl.sendNow(q.dataset.quick!, q.dataset.quick === '❤️' ? 'love' : null);
          const r = t.closest<HTMLElement>('[data-retry]'); if (r) return Chat.retry(r.dataset.retry!);
          const rq = t.closest<HTMLElement>('[data-rq]'); if (rq) return ChatCtl.jumpTo(rq.dataset.rq!);
          const chk = t.closest<HTMLElement>('[data-taskchk]');
          if (chk) { const tk = D.tasks[chk.dataset.taskchk!]; if (tk) { toggleDone(tk.id, { instant: true }); setTimeout(() => renderNow(), 100); } return; }
          if (performance.now() < ChatCtl.suppressUntil) return;
          const ink = t.closest<HTMLElement>('.bub.ink'); if (ink) { Ink.reveal(ink); return; }
          const card = t.closest<HTMLElement>('.tcard'), row = t.closest<HTMLElement>('.msg-row'); if (!row) return;
          const now = performance.now();
          // double-tap = ❤️
          if (ChatCtl.lastTap.id === row.dataset.id && now - ChatCtl.lastTap.t < 320) { ChatCtl.lastTap = { id: null, t: 0 }; quickHeart(row); return; }
          ChatCtl.lastTap = { id: row.dataset.id || null, t: now };
          if (card) setTimeout(() => { if (ChatCtl.lastTap.id === row.dataset.id && D.tasks[card.dataset.task!]) openTaskSheet(card.dataset.task!); }, 330);
        }}>
          {its.map(it => it.m ? <MessageRow key={it.k} m={it.m} cls={it.cls} revision={it.revision!} photo={it.photo} /> : <div key={it.k} className={it.cls}>{it.node}</div>)}
        </div>
        <div className="c-typing">{paired && Chat.partnerTyping() ? <div className="msg-row them start end"><span className="c-av"><Avatar k={partnerKey()} /></span><div className="bwrap"><div className="bub them typing"><i /><i /><i /></div></div></div> : null}</div>
      </div>
      <ChatHeader />
      <button className="c-jump" type="button" hidden={!ChatCtl.jumpShown} onClick={() => body.current!.scrollTo({ top: body.current!.scrollHeight, behavior: 'smooth' })}><Icon name="chevD" cls="xs" /> New message</button>
      <ChatBar />
    </section>
  );
}
