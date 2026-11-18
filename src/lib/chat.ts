/* Twodo · Messages (data layer)
   /spaces/{space}/c/m/{id}            = { f: authorUid, u: updatedAt, d: AES-GCM ciphertext }   (only the author can edit/unsend)
   /spaces/{space}/c/e/x/{uid}         = { u, d: { typing, read, at, on, poke? } }                (typing, read receipts, online,
                                                                                                  a reaction from Home: lib/reactions.ts)
   /spaces/{space}/c/e/rx/{msg}/{uid}  = { u, d: { r } }                                          (tapback reactions)
   Everything is encrypted with the space key; Firebase sees only who wrote and when. */
import { CFG } from './config';
import { decryptObj, encryptObj } from './crypto';
import { dbPatch, dbPut } from './firebase';
import { FX } from './fx';
import { Live, type Stream, type StreamMsg } from './live';
import { scheduleRender } from './render';
import { D, DAY_RE, L, TIME_RE, cNum, cStr, myName, partnerKey } from './store';
import { Sync } from './sync';
import { firstWord } from './util';
import { POKE_MS, isReaction, type ReactionEmoji } from './reactions';

const CHAT_KEY = 'twodo:chat';
export const REACTS = ['❤️', '😂', '😮', '🥹', '🔥', '👍'];                 // what the picker offers
export const TAPBACKS = [...REACTS, '👎', '‼️', '❓'];                        // what we accept (older versions also had these)
const MSG_ID = /^[0-9a-z]{9,24}$/;
const LOVE_RE = /(^|[^a-z])(i\s*)?(love|luv|lub)\s*(you|u|ya|yaa|uu)\b|(^|[^a-z])ily\b|\bi\s*love\s*you\b/i;
export const isLove = (t: unknown): boolean => typeof t === 'string' && t.length <= 120 && LOVE_RE.test(t);

export interface TaskRef { id: string; title: string; due: string | null; time: string | null }
export interface ReplyRef { id: string; f: string; q: string }
export interface Msg {
  id: string; f: string; ts: number; t: string; fx: string | null; task: TaskRef | null; rp: ReplyRef | null; del: boolean;
  _u: number; status: 'sending' | 'sent' | 'failed';
}
interface Presence { on: boolean; at: number; beat: number }
interface Enc { u?: number; d?: string; f?: string }
type ETree = { x?: Record<string, Enc>; rx?: Record<string, Record<string, Enc>> } & Record<string, unknown>;

/** what the chat screen wants to hear about (registered by the React chat view) */
export const chatEvents = {
  onMessages: (_fresh: Msg[], _initial: boolean): void => {},
  onState: (): void => {},
  onPartnerReaction: (_m: Msg, _r: string): void => {},
  onReadElsewhere: (): void => {}, // another of your devices read further than this one
  onPoke: (_e: ReactionEmoji): void => {}, // your partner sent a reaction from Home
};

export const Chat = {
  space: null as string | null, msgs: {} as Record<string, Msg>, rx: {} as Record<string, Record<string, string>>, played: {} as Record<string, 1>,
  read: 0, ver: 0, loaded: false, loadedE: false,
  liveM: null as Stream | null, liveE: null as Stream | null, eTree: {} as ETree, dcache: new Map<string, unknown>(),
  writeGen: 0, writes: new Map<string, Promise<void>>(),
  chainM: Promise.resolve(), chainE: Promise.resolve(),
  typingOn: false, typingSentAt: 0, partnerTypingUntil: 0, partnerRead: 0, partnerReadAt: 0,
  lastPxD: null as string | null, lastMxD: null as string | null, typingT: undefined as ReturnType<typeof setTimeout> | undefined,
  presence: null as Presence | null, xAt: 0, xPending: false, poke: null as { e: ReactionEmoji; at: number } | null, seenPoke: 0, saveT: undefined as ReturnType<typeof setTimeout> | undefined,
  readT: undefined as ReturnType<typeof setTimeout> | undefined,

  partnerUid(): string | null { const p = D.people && D.people[partnerKey()]; return (p && p.uid) || (L.pair && L.pair.uid) || null; },
  ready(): boolean { return Sync.enabled() && !!Sync.key && !!Sync.space && !!(L.pair && L.pair.status === 'paired') && !!this.partnerUid(); },
  base(): string { return `spaces/${Sync.space}/c`; },
  bump() { this.ver++; scheduleRender(); },

  /* ---------- local cache (last 600 messages) ---------- */
  load() {
    let j: { space?: string; msgs?: Record<string, Msg>; rx?: Chat['rx']; played?: Chat['played']; read?: number } | null = null;
    try { j = JSON.parse(localStorage.getItem(CHAT_KEY) || 'null'); } catch { /* ignore */ }
    const ok = !!j && j.space === Sync.space;
    this.msgs = ok ? j!.msgs || {} : {}; this.rx = ok ? j!.rx || {} : {}; this.played = ok ? j!.played || {} : {}; this.read = ok ? j!.read || 0 : 0;
    for (const m of Object.values(this.msgs)) if (m.status === 'sending') m.status = 'failed';
    this.space = Sync.space; this.loaded = false; this.bump();
  },
  saveSoon() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 300); },
  /** write the local cache now (before the app reloads or goes away) */
  saveNow() {
    clearTimeout(this.saveT);
    if (!this.space) return;
    const ids = Object.keys(this.msgs).sort().slice(-600), msgs: Record<string, Msg> = {};
    ids.forEach(id => { msgs[id] = this.msgs[id]; }); this.msgs = msgs;
    try { localStorage.setItem(CHAT_KEY, JSON.stringify({ space: this.space, msgs, rx: this.rx, played: this.played, read: this.read })); } catch { /* full */ }
  },
  clearLocal() { this.stop(); this.msgs = {}; this.rx = {}; this.played = {}; this.read = 0; localStorage.removeItem(CHAT_KEY); this.bump(); this.updateBadge(); },

  /* ---------- streams ---------- */
  ensure() { if (!this.liveM && this.ready()) this.start(); },
  start() {
    this.stop();
    if (!this.ready()) { this.updateBadge(); return; }
    if (this.space !== Sync.space) this.load();
    const gen = this.writeGen;
    this.liveM = Live.open({ path: () => this.base() + '/m', query: () => this.mQuery(), records: true,
      on: (type, m) => { this.chainM = this.chainM.then(() => gen === this.writeGen ? this.onM(type, m) : undefined).catch(err => console.warn('chat', err)); } });
    this.liveE = Live.open({ path: () => this.base() + '/e',
      on: (type, m) => { this.chainE = this.chainE.then(() => gen === this.writeGen ? this.onE(type, m) : undefined).catch(err => console.warn('chat', err)); } });
    this.updateBadge();
    for (const m of Object.values(this.msgs)) if (m.status === 'failed' && m.f === L.auth!.uid) this.retry(m.id);
    this.xPending = true; // say we're here once we know what we've already read (a new phone starts at 0)
  },
  stop() {
    Live.close(this.liveM); Live.close(this.liveE); this.liveM = this.liveE = null;
    this.writeGen++;
    // A new session retries its latest local state. Keep in-flight queues until
    // they settle so a restart cannot let an older request overtake that retry.
    for (const id of this.writes.keys()) if (this.msgs[id]?.status === 'sending') this.msgs[id].status = 'failed';
    this.dcache.clear(); this.eTree = {}; this.lastPxD = this.lastMxD = null; this.loadedE = false;
  },
  // On a reconnect only fetch what can have changed: anything newer than each person's latest message we already
  // have, minus 20 minutes (Undo Send works for 15). Message ids start with the sender's clock, so this is per sender.
  mQuery(): string {
    let q = '&orderBy=' + encodeURIComponent('"$key"');
    const newest: Record<string, string> = {};
    for (const m of Object.values(this.msgs)) if (m.status === 'sent' && m._u && (!newest[m.f] || m.id > newest[m.f])) newest[m.f] = m.id;
    const ids = Object.values(newest);
    if (ids.length >= 2) {
      const t = Math.min(...ids.map(id => parseInt(id.slice(0, 9), 36))) - 20 * 60e3;
      if (t > 0) q += '&startAt=' + encodeURIComponent(JSON.stringify(t.toString(36).padStart(9, '0')));
    }
    return q + '&limitToLast=300';
  },

  async onM(_type: string, { path, data }: StreamMsg) {
    const gen = this.writeGen;
    const parts = path.split('/').filter(Boolean);
    let entries: [string, Enc | null][];
    if (!parts.length) entries = Object.entries((data && typeof data === 'object' ? data : {}) as Record<string, Enc>);
    else if (parts.length === 1) entries = [[parts[0], data as Enc]];
    else return; // record streams reconstruct nested patches before dispatching
    const fresh: Msg[] = [];
    for (const [id, v] of entries) {
      if (!MSG_ID.test(id)) continue; // ids are ours (time + random): anything else isn't a message
      if (!v || typeof v.d !== 'string' || typeof v.f !== 'string') continue; // null = fell out of the 300-message window: keep the local copy
      const prev = this.msgs[id];
      if (prev && prev._u >= cNum(v.u)) continue;
      let o: Record<string, unknown>; try { o = await decryptObj(Sync.key!, v.d); } catch { continue; }
      if (gen !== this.writeGen) return;
      if (this.msgs[id] && this.msgs[id]._u >= cNum(v.u)) continue; // local edit while decryption was pending
      if (!o || typeof o !== 'object') continue;
      const ot = o.task as Record<string, unknown> | null, orp = o.rp as Record<string, unknown> | null;
      const tk = ot && typeof ot === 'object' ? { id: cStr(ot.id, 80), title: cStr(ot.title, 2000), due: DAY_RE.test(String(ot.due)) ? ot.due as string : null, time: TIME_RE.test(String(ot.time)) ? ot.time as string : null } : null;
      const rp = orp && typeof orp === 'object' && MSG_ID.test(String(orp.id)) ? { id: orp.id as string, f: cStr(orp.f, 80), q: cStr(orp.q, 140) } : null; // a reply's quote: plain text only
      this.msgs[id] = { id, f: v.f, ts: cNum(o.ts) || cNum(v.u), t: cStr(o.t, 20000), fx: FX.valid(o.fx) ? o.fx : null, task: tk, rp, del: !!o.del, _u: cNum(v.u), status: 'sent' };
      if (!prev) fresh.push(this.msgs[id]);
    }
    const initial = !this.loaded; this.loaded = true;
    if (fresh.some(m => m.f !== L.auth!.uid) && this.partnerTypingUntil) { this.partnerTypingUntil = 0; clearTimeout(this.typingT); }
    this.bump(); this.saveSoon();
    chatEvents.onMessages(fresh, initial);
    this.updateBadge();
  },

  mirror(type: string, path: string, data: unknown) {
    const set = (parts: string[], v: unknown) => {
      let n = this.eTree as Record<string, unknown>;
      for (const k of parts.slice(0, -1)) { if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k] as Record<string, unknown>; }
      const last = parts[parts.length - 1];
      if (v === null) delete n[last]; else n[last] = v;
    };
    const parts = path.split('/').filter(Boolean);
    if (!parts.length && type === 'put') { this.eTree = (data && typeof data === 'object' ? data : {}) as ETree; return; }
    if (type === 'put') return set(parts, data);
    for (const [k, v] of Object.entries((data && typeof data === 'object' ? data : {}) as Record<string, unknown>)) set([...parts, ...k.split('/').filter(Boolean)], v);
  },
  async dec<T>(v: Enc | undefined, cache = true): Promise<T | null> {
    if (!v || typeof v.d !== 'string') return null;
    if (cache && this.dcache.has(v.d)) return this.dcache.get(v.d) as T;
    const gen = this.writeGen;
    try {
      const o = await decryptObj<T>(Sync.key!, v.d);
      if (gen !== this.writeGen) return null;
      if (!cache) return o;
      // Heartbeats continually create new ciphertext; never keep an unbounded history.
      if (this.dcache.size >= 512) this.dcache.delete(this.dcache.keys().next().value!);
      this.dcache.set(v.d, o); return o;
    } catch { return null; }
  },
  async onE(type: string, { path, data }: StreamMsg) {
    const gen = this.writeGen;
    this.mirror(type, path, data);
    const pu = this.partnerUid(), pv = pu ? this.eTree.x && this.eTree.x[pu] : undefined;
    if (pv && pv.d !== this.lastPxD) {
      this.lastPxD = pv.d || null;
      const px = await this.dec<{ typing?: number; read?: number; at?: number; on?: number; poke?: { e?: unknown; at?: unknown } }>(pv, false);
      if (gen !== this.writeGen) return;
      if (px) {
        // a heartbeat we hear live is "now" by our own clock; one from the first snapshot can be old, so trust its time
        const snap = type === 'put' && path.split('/').filter(Boolean).length === 0;
        const at = cNum(px.at);
        if ('on' in px) this.presence = { on: !!px.on, at, beat: snap ? at : Date.now() };
        const fresh = Math.abs(Date.now() - at) < 15000; // ignore stale "typing" from long ago
        this.partnerTypingUntil = px.typing && fresh ? Date.now() + 6500 : 0;
        const read = cNum(px.read);
        if (read !== this.partnerRead) { this.partnerRead = read; this.partnerReadAt = at || Date.now(); }
        clearTimeout(this.typingT);
        if (this.partnerTypingUntil) this.typingT = setTimeout(() => { this.partnerTypingUntil = 0; this.bump(); chatEvents.onState(); }, 6600);
        // a reaction from Home: played once, only while it is fresh (it is never stored)
        const pk = px.poke && typeof px.poke === 'object' ? px.poke : null, pat = pk ? cNum(pk.at) : 0;
        if (pk && isReaction(pk.e) && pat > this.seenPoke && Math.abs(Date.now() - pat) < POKE_MS) { this.seenPoke = pat; chatEvents.onPoke(pk.e); }
      }
    }
    const mv = this.eTree.x && L.auth ? this.eTree.x[L.auth.uid] : undefined;
    if (mv && mv.d !== this.lastMxD) {
      this.lastMxD = mv.d || null;
      const mx = await this.dec<{ read?: number }>(mv, false);
      if (gen !== this.writeGen) return;
      if (mx && cNum(mx.read) > this.read) { this.read = cNum(mx.read); this.saveSoon(); this.updateBadge(); chatEvents.onReadElsewhere(); }
    }
    if (this.xPending) { this.xPending = false; void this.writeX(); }
    // Reactions rarely change. Presence/typing updates must not walk and rebuild
    // every reaction (or overwrite a reaction just applied optimistically).
    const parts = path.split('/').filter(Boolean);
    const changesRx = !parts.length ? type === 'put' || Object.keys((data || {}) as object).some(k => k === 'rx' || k.startsWith('rx/')) : parts[0] === 'rx';
    if (!changesRx) { this.bump(); chatEvents.onState(); return; }
    const before = this.rx, rx: Record<string, Record<string, string>> = {};
    for (const [mid, byUid] of Object.entries(this.eTree.rx || {})) {
      for (const [uid, v] of Object.entries(byUid || {})) { const o = await this.dec<{ r?: string }>(v); if (o && typeof o.r === 'string' && TAPBACKS.includes(o.r)) (rx[mid] = rx[mid] || {})[uid] = o.r; }
    }
    if (gen !== this.writeGen) return;
    if (this.loadedE && pu) for (const [mid, by] of Object.entries(rx)) {
      const r = by[pu], m = this.msgs[mid];
      if (r && (!before[mid] || before[mid][pu] !== r) && m && m.f === L.auth!.uid) chatEvents.onPartnerReaction(m, r);
    }
    this.loadedE = true;
    this.rx = rx; this.bump(); this.saveSoon();
    chatEvents.onState();
  },
  partnerTyping(): boolean { return this.partnerTypingUntil > Date.now(); },
  // Online = their app is open on screen (a heartbeat every 45 s); otherwise "last seen" is when it last was.
  partnerOnline(): boolean { const p = this.presence; return !!p && p.on && Date.now() - p.beat < 100e3; },
  // short and quiet: "last seen just now · 5m ago · 9:41 PM · yesterday · Mon · 22 Oct"
  lastSeenText(): string {
    const p = this.presence; if (!p || !p.at) return '';
    const t = Math.min(p.at, Date.now()), ago = Date.now() - t;
    if (ago < 60e3) return 'last seen just now';
    if (ago < 3600e3) return `last seen ${Math.floor(ago / 60e3)}m ago`;
    const dt = new Date(t), sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((sod(new Date()) - sod(dt)) / 864e5);
    if (days === 0) return `last seen ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (days === 1) return 'last seen yesterday';
    if (days < 7) return `last seen ${dt.toLocaleDateString([], { weekday: 'short' })}`;
    return `last seen ${dt.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  },
  // Both of you said "love you" within 10 minutes: returns the other person's message to pair with m (once only)
  lovePair(m: Msg | undefined): Msg | null {
    if (!m || m.del || !isLove(m.t) || this.played['ly' + m.id]) return null;
    let o: Msg | null = null;
    for (const x of Object.values(this.msgs)) {
      if (x.f === m.f || x.del || !isLove(x.t) || this.played['ly' + x.id] || x.ts > m.ts || m.ts - x.ts > 600e3) continue;
      if (!o || x.ts > o.ts) o = x;
    }
    if (o) { this.played['ly' + m.id] = 1; this.played['ly' + o.id] = 1; this.saveSoon(); }
    return o;
  },

  /* ---------- actions ---------- */
  newId(): string { return Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 7).padEnd(5, '0'); },
  send({ t = '', fx = null, task = null, rp = null }: { t?: string; fx?: string | null; task?: TaskRef | null; rp?: ReplyRef | null }): Msg {
    const id = this.newId(), ts = Date.now();
    const m: Msg = { id, f: L.auth!.uid, ts, t, fx, task, rp, del: false, _u: ts, status: 'sending' };
    this.msgs[id] = m; this.bump(); this.saveSoon();
    if (this.typingOn) this.setTyping(false);
    void this.write(m);
    return m;
  },
  write(m: Msg): Promise<void> {
    // Snapshot the optimistic state now. Serialize edits to the same message so a
    // slow send can never arrive AFTER Undo Send and resurrect its original text.
    const snapshot = { ...m }, gen = this.writeGen, key = Sync.key!, base = this.base();
    const previous = this.writes.get(m.id) || Promise.resolve();
    const write = previous.then(async () => {
      if (gen !== this.writeGen) return;
      let status: Msg['status'] = 'sent';
      try {
        const d = await encryptObj(key, { ts: snapshot.ts, t: snapshot.t, fx: snapshot.fx, task: snapshot.task, rp: snapshot.rp || null, del: snapshot.del });
        if (gen !== this.writeGen) return;
        await dbPut(`${base}/m/${snapshot.id}`, { f: snapshot.f, u: snapshot._u, d });
      } catch { status = 'failed'; }
      const current = this.msgs[snapshot.id];
      if (gen !== this.writeGen || !current || current._u !== snapshot._u) return;
      current.status = status;
      if (status === 'sent' && !current.del) this.notifyPartner(current);
      this.bump(); this.saveSoon(); chatEvents.onState();
    });
    this.writes.set(m.id, write);
    void write.finally(() => { if (this.writes.get(m.id) === write) this.writes.delete(m.id); });
    return write;
  },
  retry(id: string) { const m = this.msgs[id]; if (!m) return; m.status = 'sending'; this.bump(); chatEvents.onState(); void this.write(m); },
  unsend(id: string) {
    const m = this.msgs[id]; if (!m || m.f !== L.auth!.uid) return;
    Object.assign(m, { del: true, t: '', task: null, fx: null, rp: null, _u: Math.max(Date.now(), m._u + 1), status: 'sending' });
    this.bump(); this.saveSoon(); chatEvents.onState(); void this.write(m);
  },
  async react(id: string, r: string) {
    const me = L.auth!.uid, cur = (this.rx[id] || {})[me], next = cur === r ? null : r;
    this.rx[id] = this.rx[id] || {};
    if (next) this.rx[id][me] = next; else delete this.rx[id][me];
    this.bump(); chatEvents.onState();
    try { await dbPut(`${this.base()}/e/rx/${id}/${me}`, next ? { u: Date.now(), d: await encryptObj(Sync.key!, { r: next }) } : null); } catch { /* retried on next change */ }
  },
  setTyping(on: boolean) {
    const now = Date.now();
    if (on && this.typingOn && now - this.typingSentAt < 2500) return;
    if (!on && !this.typingOn) return;
    this.typingOn = on; this.typingSentAt = on ? now : 0;
    void this.writeX();
  },
  async writeX(o: { off?: boolean } = {}) {
    if (!this.ready()) return;
    this.xAt = Date.now();
    const on = o.off || document.hidden ? 0 : 1;
    try {
      const poke = this.poke && Date.now() - this.poke.at < POKE_MS ? this.poke : undefined; // kept a minute, so a later heartbeat doesn't drop it
      const d = await encryptObj(Sync.key!, { typing: this.typingOn ? 1 : 0, read: this.read, at: Date.now(), on, ...(poke ? { poke } : {}) });
      await dbPut(`${this.base()}/e/x/${L.auth!.uid}`, { u: Date.now(), d }, o.off ? { keepalive: true } : undefined);
    } catch { /* ignore */ }
  },
  /** Send your partner a reaction from Home: live, encrypted, never a message. False when not connected. */
  sendPoke(e: ReactionEmoji): boolean {
    if (!this.ready() || !isReaction(e)) return false;
    this.poke = { e, at: Math.max(Date.now(), (this.poke?.at || 0) + 1) };
    void this.writeX();
    return true;
  },
  beat() { if (this.ready() && !document.hidden && Date.now() - this.xAt > 40e3) void this.writeX(); },
  lastPartnerTs(): number { const me = L.auth && L.auth.uid; let t = 0; for (const m of Object.values(this.msgs)) if (m.f !== me && m.ts > t) t = m.ts; return t; },
  /** Everything from your partner up to `upTo` (default: the latest message) has been on your screen.
   *  The chat screen decides what that is; reading in older history must not mark newer messages as seen. */
  markRead(upTo?: number) {
    const last = this.lastPartnerTs(), to = upTo === undefined ? last : Math.min(upTo, last);
    if (!to || to <= this.read) return;
    this.read = to; this.bump(); this.saveSoon(); this.updateBadge();
    // one receipt for a burst of reading (scrolling through several new messages)
    clearTimeout(this.readT); this.readT = setTimeout(() => { void this.writeX(); }, 250);
    if (to < last) return;
    const pu = this.partnerUid(); // cancel a pending "new message" push, we've seen it all
    if (pu && CFG.vapidPublicKey) dbPatch(`rem/${Sync.space}`, { ['chat_' + pu]: null }).catch(() => {});
  },
  unread(): number { const me = L.auth && L.auth.uid; return Object.values(this.msgs).filter(m => m.f !== me && !m.del && m.ts > this.read).length; },
  updateBadge() {
    const n = this.ready() ? this.unread() : 0;
    try { const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }; if (nav.setAppBadge) { if (n) void nav.setAppBadge(n); else void nav.clearAppBadge!(); } } catch { /* unsupported */ }
    scheduleRender();
  },
  // If push reminders are set up, the GitHub Action also nudges your partner about unread messages (~5 min).
  notifyPartner(m: Msg) {
    const pu = this.partnerUid(); if (!pu || !CFG.vapidPublicKey) return;
    const b = m.task ? `Shared a task: ${m.task.title}` : (m.t || '').slice(0, 140);
    encryptObj(Sync.key!, { k: 'chat', t: `💬 ${firstWord(myName())}`, b })
      .then(d => dbPatch(`rem/${Sync.space}`, { ['chat_' + L.auth!.uid]: { at: Date.now(), to: { [pu]: true }, d, sent: 0 } }))
      .catch(() => {});
  },
};
type Chat = typeof Chat;

if (typeof window !== 'undefined') {
  // (Live keeps the two message streams connected.) Failed sends are retried when the connection comes back.
  addEventListener('online', () => { if (Chat.ready()) for (const m of Object.values(Chat.msgs)) if (m.status === 'failed' && m.f === L.auth!.uid) Chat.retry(m.id); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Chat.typingOn = false; void Chat.writeX({ off: true }); return; }
    Chat.ensure(); void Chat.writeX();
  });
  addEventListener('pagehide', () => { Chat.saveNow(); void Chat.writeX({ off: true }); }); // a message sent a moment ago is kept
}
