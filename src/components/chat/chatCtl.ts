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
  view: null as HTMLElement | null, pending: null as DrawOp | null, pinned: true, limit: 120, total: 0, animUntil: 0, jumpShown: false,
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
    setTimeout(() => { this.draw({ toBottom: true }); Chat.markRead(); }, 60);
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
    if (op.toBottom || op.sentId || (op.near && !incoming)) { body.scrollTop = body.scrollHeight; this.pinned = true; }
    else if (op.near && incoming) { body.scrollTo({ top: body.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); this.pinned = true; }
    if (op.sentId) this.animateSent(op.sentId, op.fromRect);
    for (const id of op.newIds || []) this.animateIn(id);
    if (incoming && !op.near) { this.jumpShown = true; renderNow(); }
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
    if (this.isOpen()) {
      this.draw({ newIds: initial ? [] : incoming.map(m => m.id) });
      let pair: Msg | null = null;
      if (incoming.length && !initial) { chatSound('recv'); haptic('light'); for (const m of incoming) pair = Chat.lovePair(m) || pair; }
      Chat.markRead(); if (initial) this.playPending();
      if (pair) setTimeout(() => this.loveYou(), 650);
    } else if (!initial && incoming.length) {
      const m = incoming[incoming.length - 1];
      island({ e: '💬', text: `${firstWord(ptName())}: ${m.task ? '📋 ' + m.task.title : m.t}`, sub: m.fx ? `Sent with ${FX.label(m.fx)}` : '', btn: 'Reply', onBtn: () => this.open(), ms: 4500 });
      chatSound('recv'); haptic('light');
    }
  },
  onState() { if (!this.isOpen()) return; Chat.markRead(); renderNow(); },
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
sheetEvents.onClosed = () => ChatCtl.onState();
