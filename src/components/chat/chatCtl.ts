/* Twodo · chat controller: what happens when you send, when messages arrive, replies, effects and scrolling.
   The ChatView component renders; this keeps the bits of state that outlive a render. */
import { Chat, chatEvents, isLove, type Msg, type ReplyRef, type TaskRef } from '@/lib/chat';
import { cloudReady } from '@/lib/config';
import { chatSound, haptic } from '@/lib/feedback';
import { Auth } from '@/lib/firebase';
import { FX, autoFx, playBubbleFx, playScreenFx } from '@/lib/fx';
import { EASE, MS } from '@/lib/motion';
import { renderNow } from '@/lib/render';
import { L, ptName } from '@/lib/store';
import { firstWord, reducedMotion } from '@/lib/util';
import { focusOpen, island } from '@/ui/island';
import { navTo, topEntry } from '@/ui/nav';
import { closeSheet, sheetOpen, sheetEvents } from '@/ui/sheet';
import { createStore } from '@/ui/store';
import { openInviteSheet } from '../settings/AccountSheets';
import { openSettings } from '../settings/Settings';

export interface DrawOp { near: boolean; toBottom?: boolean; sentId?: string; fromRect?: DOMRect; newIds?: string[] }
export const replyStore = createStore<{ r: (ReplyRef & { q: string }) | null; pop: number }>({ r: null, pop: 0 });
export const fxPickerStore = createStore<{ text: string; seq: number } | null>(null);
export const loveStore = createStore<{ ids: string[]; seq: number } | null>(null);
let seq = 0;

export const ChatCtl = {
  view: null as HTMLElement | null, pending: null as DrawOp | null, pinned: true, limit: 120, total: 0, animUntil: 0,
  /* Reading position. `divider`: the "New messages" line sits above the first message from your partner newer than
     this read mark (null = no line); it is decided when a visit to the chat starts and stays put while you read.
     `landing`: the next draw should bring the first unread message into view. `far`: you are well above the bottom. */
  divider: null as number | null, landing: false, far: false, here: false, visitAt: 0,
  lastTap: { id: null as string | null, t: 0 }, suppressUntil: 0, blurAt: -1e9, lp: undefined as ReturnType<typeof setTimeout> | undefined,

  body(): HTMLElement | null { return this.view && this.view.querySelector('.chatbody'); },
  shown(): boolean { const t = topEntry(); return !!t && t.spec.type === 'home' && !!this.view && this.view.isConnected; },
  // actually on screen: Home is on top and nothing covers it
  isOpen(): boolean { return this.shown() && !document.hidden && !sheetOpen() && !focusOpen.get(); },
  open() {
    if (!cloudReady()) return island({ e: '💬', text: 'Messages need accounts turned on', sub: 'See README → accounts & sync' });
    if (!Auth.user()) return openSettings();
    if (!(L.pair && L.pair.status === 'paired')) { island({ e: '💌', text: 'Add your partner to start chatting', ms: 2500 }); return openInviteSheet(); }
    if (sheetOpen()) closeSheet();
    if (!this.shown()) navTo({ type: 'home' });
    Chat.ensure();
    // "Reply" on a toast or a notification: go to what's new (the first unread message, or the bottom)
    setTimeout(() => { this.landing = true; this.draw({ toBottom: true }); this.readVisible(); }, 60);
  },

  /* ---------- reading position ---------- */
  /** A visit starts when the chat comes on screen (launch, coming back from another screen or another app).
   *  Returns true when the "New messages" line changed and the chat must be drawn again. */
  presence(): boolean {
    const here = this.shown() && !document.hidden;
    if (here === this.here) return false;
    this.here = here;
    if (!here) return false;
    this.visitAt = Date.now();
    const line = Chat.read > 0 && Chat.unread() > 0 ? Chat.read : null;
    if (line !== null) this.landing = true;
    if (line === this.divider) return false;
    this.divider = line;
    return true;
  },
  /** the first message from your partner that hasn't been on screen yet */
  firstUnreadRow(): HTMLElement | null {
    const rows = this.view ? this.view.querySelectorAll<HTMLElement>('.chatlist > .msg-row.them[data-id]') : [];
    let first: HTMLElement | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const m = Chat.msgs[rows[i].dataset.id!];
      if (!m || m.ts <= Chat.read) break;
      if (!m.del) first = rows[i];
    }
    return first;
  },
  /** where the conversation is visible: under the header, above the message box */
  frame(): { top: number; bottom: number } | null {
    const v = this.view; if (!v) return null;
    const head = v.querySelector('.chat-nav'), bar = v.querySelector('.chatbar'); if (!head || !bar) return null;
    return { top: head.getBoundingClientRect().bottom, bottom: bar.getBoundingClientRect().top };
  },
  /** bring the first unread message (with its "New messages" line) to the top, or go to the bottom if it all fits */
  land(smooth = false) {
    const body = this.body(), f = this.frame(); if (!body || !f) return;
    const row = this.firstUnreadRow(), max = body.scrollHeight - body.clientHeight;
    let top = max;
    if (row) {
      const prev = row.previousElementSibling, line = prev && prev.classList.contains('c-new') ? prev : row;
      top = Math.max(0, Math.min(max, body.scrollTop + line.getBoundingClientRect().top - f.top - 10));
    }
    if (smooth && !reducedMotion.matches) body.scrollTo({ top, behavior: 'smooth' }); else body.scrollTop = top;
    this.pinned = max - top < 80;
  },
  /** Mark as read only what has been on screen: everything when you're at the bottom, otherwise the new messages
   *  that have scrolled into view. Never while the chat is covered, hidden or another screen is on top. */
  readVisible() {
    if (!this.isOpen()) return;
    const last = Chat.lastPartnerTs(); if (!last || last <= Chat.read) return;
    if (this.near()) { Chat.markRead(); return; }
    const f = this.frame(); if (!f) return;
    const rows = this.view!.querySelectorAll<HTMLElement>('.chatlist > .msg-row.them[data-id]');
    let i = rows.length;
    while (i > 0) { const m = Chat.msgs[rows[i - 1].dataset.id!]; if (!m || m.ts <= Chat.read) break; i--; }
    let seen = 0;
    for (; i < rows.length; i++) {
      if (rows[i].getBoundingClientRect().bottom > f.bottom + 4) break;
      seen = Chat.msgs[rows[i].dataset.id!].ts;
    }
    if (seen) Chat.markRead(seen);
  },
  /** the "N new messages" pill: first to where they start, then (already there) to the bottom */
  jumpNew() {
    const body = this.body(), f = this.frame(); if (!body || !f) return;
    const row = this.firstUnreadRow();
    if (row && row.getBoundingClientRect().top > f.bottom - 40) { this.land(true); return; }
    body.scrollTo({ top: body.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  },
  near(): boolean { const b = this.body(); return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 140; },
  /** re-render now, then scroll and animate once the new rows are on screen (see ChatView's layout effect) */
  draw(op: Omit<DrawOp, 'near'> = {}) { this.pending = { near: this.near(), ...op }; renderNow(); },
  el(id: string): HTMLElement | null { return this.view && this.view.querySelector(`.msg-row[data-id="${CSS.escape(id)}"] .bwrap`); },
  center(el: Element) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },

  /* ---------- after a render ---------- */
  afterDraw(op: DrawOp) {
    const body = this.body(); if (!body) return;
    const incoming = (op.newIds || []).length > 0;
    if (op.sentId) { this.landing = false; body.scrollTop = body.scrollHeight; this.pinned = true; }
    // messages you weren't here for: start where they start, unless you're reading further up (then the pill shows)
    else if (this.landing) { this.landing = false; if (op.near || op.toBottom) this.land(); }
    else if (op.toBottom || (op.near && !incoming)) { body.scrollTop = body.scrollHeight; this.pinned = true; }
    else if (op.near && incoming) { body.scrollTo({ top: body.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); this.pinned = true; }
    if (op.sentId) this.animateSent(op.sentId, op.fromRect);
    for (const id of op.newIds || []) this.animateIn(id);
  },
  animateSent(id: string, from?: DOMRect) {
    const el = this.el(id), m = Chat.msgs[id]; if (!el || !m) return;
    this.animUntil = Date.now() + 900;
    if (!reducedMotion.matches) {
      const heart = document.createElement('span'); heart.className = 'c-send-heart'; heart.setAttribute('aria-hidden', 'true');
      el.append(heart);
      heart.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 },
        { transform: 'translateY(-8px) scale(1)', opacity: 1, offset: .35 },
        { transform: 'translateY(-22px) scale(.7)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => heart.remove();
    }
    if (m.fx && FX.isBubble(m.fx) && m.fx !== 'ink') { playBubbleFx(el, m.fx, this.body()); this.animUntil = Date.now() + 2700; }
    else if (from && !reducedMotion.matches) { // the bubble travels from the message field into its place
      const to = el.getBoundingClientRect();
      const a = el.animate([{ transform: `translate(${from.left + 6 - to.left}px, ${from.bottom - to.bottom}px) scale(.96)`, opacity: 0.6 },
        { transform: 'none', opacity: 1 }], { duration: MS.page, easing: EASE.spring });
      a.onfinish = () => haptic('light');
      return this.fxLater(m, el);
    }
    haptic('light');
    this.fxLater(m, el);
  },
  fxLater(m: Msg, el: HTMLElement) {
    if (m.fx && !FX.isBubble(m.fx)) setTimeout(() => playScreenFx(m.fx!, { from: this.center(el), text: m.t, mine: true }), 300);
  },
  animateIn(id: string) {
    const el = this.el(id), m = Chat.msgs[id]; if (!el || !m) return;
    if (m.fx && !Chat.played[id]) { Chat.played[id] = 1; Chat.saveSoon(); this.playFx(m, el); }
    else playBubbleFx(el, 'pop');
  },
  playFx(m: Msg, el: HTMLElement) {
    if (FX.isBubble(m.fx)) { if (m.fx === 'ink') playBubbleFx(el, 'pop'); else { playBubbleFx(el, m.fx!, this.body()); this.animUntil = Date.now() + 2700; } }
    else { playBubbleFx(el, 'pop'); setTimeout(() => playScreenFx(m.fx!, { from: this.center(el), text: m.t, mine: m.f === L.auth!.uid }), 250); }
  },
  // When the chat opens, play the effect of the newest unseen message from your partner (like iMessage)
  playPending() {
    const me = L.auth!.uid, cand = Object.values(Chat.msgs).filter(m => m.f !== me && m.fx && !m.del && !Chat.played[m.id] && Date.now() - m.ts < 864e5).sort((a, b) => (a.id < b.id ? -1 : 1));
    cand.forEach(m => { Chat.played[m.id] = 1; }); Chat.saveSoon();
    const m = cand[cand.length - 1];
    if (m) setTimeout(() => { const el = this.el(m.id); if (el) this.playFx(m, el); }, 450);
    else { // a "love you" pair that completed while the app was closed
      const recent = Object.values(Chat.msgs).filter(x => x.f !== me && isLove(x.t) && Date.now() - x.ts < 864e5).sort((a, b) => a.ts - b.ts);
      for (const x of recent.reverse()) if (Chat.lovePair(x)) { setTimeout(() => this.loveYou(), 900); break; }
    }
  },
  loveYou() {
    if (!this.isOpen()) return;
    const ids = Object.values(Chat.msgs).filter(m => !m.del && isLove(m.t) && Date.now() - m.ts < 660e3).sort((a, b) => b.ts - a.ts).slice(0, 2).map(m => m.id);
    loveStore.set({ ids, seq: ++seq });
  },

  /* ---------- events from the data layer ---------- */
  onMessages(fresh: Msg[], initial: boolean) {
    const me = L.auth!.uid, incoming = fresh.filter(m => m.f !== me && !m.del);
    if (incoming.length) {
      // the first load after opening the app, or sent before you were looking: you weren't here for these
      const away = initial || incoming.some(m => m.ts < this.visitAt - 3000);
      if ((away || !this.isOpen() || !this.near()) && this.divider === null && Chat.read > 0) this.divider = Chat.read;
      if (away) this.landing = true;
    }
    if (this.isOpen()) {
      this.draw({ newIds: initial ? [] : incoming.map(m => m.id) });
      let pair: Msg | null = null;
      if (incoming.length && !initial) { chatSound('recv'); haptic('light'); for (const m of incoming) pair = Chat.lovePair(m) || pair; }
      this.readVisible(); if (initial) this.playPending();
      if (pair) setTimeout(() => this.loveYou(), 650);
    } else if (!initial && incoming.length) {
      const m = incoming[incoming.length - 1];
      island({ e: '💬', text: `${firstWord(ptName())}: ${m.task ? '📋 ' + m.task.title : m.t}`, sub: m.fx ? `Sent with ${FX.label(m.fx)}` : '', btn: 'Reply', onBtn: () => this.open(), ms: 4500 });
      chatSound('recv'); haptic('light');
    }
  },
  onState() { if (!this.isOpen()) return; this.readVisible(); renderNow(); },
  // another of your devices read further: the line moves with it (or goes, when nothing is new any more)
  onReadElsewhere() { if (this.divider !== null && Chat.read > this.divider) this.divider = Chat.unread() ? Chat.read : null; },
  onPartnerReaction(m: Msg, r: string) {
    if (this.isOpen()) return;
    island({ e: r, text: `${firstWord(ptName())} reacted to “${(m.t || (m.task && m.task.title) || 'your message').slice(0, 40)}”`, btn: 'Open', onBtn: () => this.open() });
  },

  /* ---------- sending ---------- */
  input(): HTMLTextAreaElement | null { return this.view && this.view.querySelector('.cb-in'); },
  sendNow(text: string, fx: string | null = null, task: TaskRef | null = null) {
    const input = this.input(); if (!input) return;
    text = String(text || '').trim();
    if (!text && !task) return;
    if (!Chat.ready()) return island({ e: '⚠️', text: 'Not connected yet', sub: 'Check you’re online and paired' });
    if (!fx && text) fx = autoFx(text);
    const from = input.getBoundingClientRect();
    const r = replyStore.get().r, rp = r && !task ? { id: r.id, f: r.f, q: r.q } : null;
    const m = Chat.send({ t: text.slice(0, 20000), fx, task, rp });
    Chat.played[m.id] = 1;
    this.divider = null; // you answered: nothing is "new" any more
    if (rp) this.clearReply();
    if (!task) { input.value = ''; autosize(input); }
    this.draw({ sentId: m.id, fromRect: from });
    setTimeout(() => { if (m.status === 'sending') renderNow(); }, 950);
    chatSound('send'); // the haptic comes when the bubble lands (animateSent)
    if (Chat.lovePair(m)) setTimeout(() => this.loveYou(), 420);
    const sb = this.view!.querySelector('.cb-send');
    if (sb && !reducedMotion.matches) sb.animate([{ translate: '0 0', opacity: 1 }, { translate: '0 -22px', opacity: 0, offset: .5 }, { translate: '0 14px', opacity: 0, offset: .51 }, { translate: '0 0', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.3,.8,.3,1)' });
  },

  /* ---------- reply ---------- */
  previewOf(m: Msg): string { return String(m.del ? 'Unsent message' : m.task ? '📋 ' + m.task.title : m.t || '').replace(/\s+/g, ' ').trim().slice(0, 120); },
  setReply(m: Msg | undefined, withHaptic = true) {
    if (!this.view || !m || m.del) return;
    replyStore.set(s => ({ r: { id: m.id, f: m.f, q: this.previewOf(m) }, pop: s.pop + 1 }));
    this.input()?.focus({ preventScroll: true });
    if (withHaptic) haptic('light');
  },
  clearReply() { replyStore.set(s => ({ ...s, r: null })); },
  // scroll to the message a reply quotes, and let it glow for a moment
  jumpTo(id: string) {
    if (!this.view || !Chat.msgs[id]) return;
    let row = this.el(id);
    if (!row) { this.limit = Math.max(this.limit, this.total); renderNow(); row = this.el(id); }
    if (!row) return;
    row.closest('.msg-row')!.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    const r = row;
    setTimeout(() => { r.classList.remove('hl'); void r.offsetWidth; r.classList.add('hl'); setTimeout(() => r.classList.remove('hl'), 1400); }, 280);
    haptic('light'); this.body()?.dispatchEvent(new Event('scroll'));
  },
  openFxPicker(text: string) {
    if (!text) { island({ e: '✨', text: 'Type a message first', sub: 'Then hold ↑ to pick an effect', ms: 2000 }); return; }
    fxPickerStore.set({ text, seq: ++seq });
  },
};
export const autosize = (input: HTMLTextAreaElement): void => {
  input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  input.closest('.cb-pill')?.classList.toggle('has', !!input.value.trim());
};

chatEvents.onMessages = (f, i) => ChatCtl.onMessages(f, i);
chatEvents.onState = () => ChatCtl.onState();
chatEvents.onPartnerReaction = (m, r) => ChatCtl.onPartnerReaction(m, r);
chatEvents.onReadElsewhere = () => ChatCtl.onReadElsewhere();
sheetEvents.onClosed = () => ChatCtl.onState();
