/* Twodo · end-to-end encrypted sync over the Firebase Realtime Database REST + streaming API.
   Data lives at /spaces/{space}/r/{record} as { u: updatedAt, d: AES-GCM ciphertext }.
   Only signed-in members of a space can read or write it (firebase.rules.json); only phones holding
   the space key can decrypt it. Last write wins per record. */
import { fixIdentity } from './account';
import { island } from './bridge';
import { Chat } from './chat';
import { cloudReady } from './config';
import { KeyStore, decryptObj, encryptObj, spaceKeyFromRaw } from './crypto';
import { haptic } from './feedback';
import { Auth, dbGet, dbPatch, type AppError } from './firebase';
import { Live, type Stream, type StreamMsg } from './live';
import { Pair } from './pair';
import { Remind } from './push';
import { scheduleRender } from './render';
import { D, L, cleanRecord, hooks, partnerKey, ptName, recKey, save, setPeopleRec } from './store';
import { applyTheme } from './theme';
import type { List, PeopleRec, Rec, Task } from './types';
import { firstWord } from './util';

export type SyncState = 'off' | 'connecting' | 'live' | 'error';
interface Enc { u?: number; d?: string }

export const Sync = {
  state: 'off' as SyncState, msg: '', live: null as Stream | null, key: null as CryptoKey | null, space: null as string | null,
  q: new Set<string>(), timer: undefined as ReturnType<typeof setTimeout> | undefined, ready: false, chain: Promise.resolve(),
  notes: [] as { e: string; text: string; sub?: string }[], notesT: undefined as ReturnType<typeof setTimeout> | undefined,

  enabled(): boolean { return cloudReady() && !!Auth.user() && !!(L.sync && L.sync.space); },
  set(state: SyncState, msg = '') { this.state = state; this.msg = msg; scheduleRender(); },
  label(): string {
    const paired = L.pair && L.pair.status === 'paired';
    return { live: paired ? `Synced with ${firstWord(L.pair!.name || ptName())}` : 'Backed up to your account', connecting: 'Connecting…', error: this.msg || 'Sync problem', off: 'Off' }[this.state];
  },

  async init() {
    this.close();
    if (!this.enabled()) return this.set('off');
    this.set('connecting');
    try {
      const sp = await KeyStore.get('space');
      if (!sp || sp.id !== L.sync.space) throw new Error('This phone is missing its keys. Sign out and in again.');
      this.space = sp.id; this.key = await spaceKeyFromRaw(sp.raw);
    } catch (e) { return this.set('error', (e as Error).message); }
    this.connect();
    Chat.start();
  },
  close() {
    Chat.stop();
    Live.close(this.live); this.live = null;
    this.ready = false;
  },
  connect() {
    Live.close(this.live);
    this.ready = false;
    if (!navigator.onLine) this.set('error', 'Offline — will sync when you’re back');
    this.live = Live.open({
      path: () => `spaces/${this.space}/r`,
      on: (_type, msg) => { this.chain = this.chain.then(() => this.onEvent(msg)).catch(err => console.warn('sync', err)); },
      onDown: () => (L.auth && L.auth.expired ? this.set('error', 'Signed out — please sign in again')
        : this.set(navigator.onLine ? 'connecting' : 'error', navigator.onLine ? '' : 'Offline — will sync when you’re back')),
      onCancel: () => this.set('error', 'No access to this space any more'),
    });
  },

  async onEvent({ path, data }: StreamMsg) {
    if (path === '/') {
      const map = (data && typeof data === 'object' ? data : {}) as Record<string, Enc>;
      if (map.people) await this.apply('people', map.people); // identity first, then everything else
      for (const [k, v] of Object.entries(map)) if (k !== 'people') await this.apply(k, v);
      if (!this.ready) { this.ready = true; this.pushNewer(map); }
    } else {
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 1) await this.apply(parts[0], data as Enc);
      else await this.apply(parts[0], await dbGet<Enc>(`spaces/${this.space}/r/${encodeURIComponent(parts[0])}`));
    }
    if (this.state !== 'live') this.set('live');
  },

  getRec(k: string): Rec | null | undefined {
    if (k === 'people') return D.people;
    const id = k.slice(2);
    return k[0] === 't' ? D.tasks[id] : k[0] === 'l' ? D.lists[id] : null;
  },
  localU(k: string): number { const r = this.getRec(k); return r ? (r.updatedAt || 0) : 0; },
  isPrivate(r: Rec): boolean {
    if (r.kind === 'list') return !!r.private;
    if (r.kind === 'task') { const l = D.lists[r.listId]; return !!(l && l.private); }
    return false;
  },

  async apply(k: string, v: Enc | null | undefined) {
    if (!v || typeof v !== 'object' || typeof v.d !== 'string') return;
    if ((v.u || 0) <= this.localU(k)) return;
    let raw: unknown;
    try { raw = await decryptObj(this.key!, v.d); } catch { return; } // wrong key or tampered → ignore
    const obj = cleanRecord(raw); // checked before it can reach the screen
    if (!obj || (obj.updatedAt || 0) <= this.localU(k)) return;
    if (k !== 'people' && recKey(obj) !== k) return; // a record can't pretend to be another one
    const local = this.getRec(k);
    if (local && this.isPrivate(local)) return; // never overwrite something that's private on this phone
    obj._s = 1;
    if (k === 'people') { setPeopleRec(obj as PeopleRec); fixIdentity(); applyTheme(); Chat.ensure(); }
    else if (obj.kind === 'task') { this.noteTask(local as Task | undefined, obj); D.tasks[obj.id] = obj; }
    else if (obj.kind === 'list') D.lists[obj.id] = obj as List;
    else return;
    save(); scheduleRender();
  },

  noteTask(prev: Task | undefined, t: Task) {
    if (!this.ready || t.deleted || !t.title) return;
    const pk = partnerKey();
    if (t.done && (!prev || !prev.done) && t.doneBy === pk) this.note({ e: '💞', text: `${ptName()} completed “${t.title}”` });
    else if (!prev && t.createdBy === pk && (t.assignee === L.me || t.assignee === 'both'))
      this.note({ e: '✨', text: `${ptName()} added “${t.title}”`, sub: t.assignee === L.me ? 'For you' : 'For both of you' });
  },
  note(n: { e: string; text: string; sub?: string }) {
    this.notes.push(n);
    clearTimeout(this.notesT);
    this.notesT = setTimeout(() => {
      const ns = this.notes; this.notes = [];
      island(ns.length === 1 ? ns[0] : { e: '💞', text: `${ns.length} updates from ${ptName()}` }); haptic('light');
    }, 700);
  },

  pushNewer(map: Record<string, Enc>) {
    const keys: string[] = [];
    if (D.people) keys.push('people');
    for (const id in D.lists) keys.push('l:' + id);
    for (const id in D.tasks) keys.push('t:' + id);
    for (const k of keys) {
      const r = this.getRec(k); if (!r) continue;
      if ((r.updatedAt || 0) > ((map[k] && map[k].u) || 0)) this.q.add(k);
    }
    for (const id in D.tasks) if (D.tasks[id].time) this.q.add('t:' + id); // refresh reminder entries
    this.flushSoon(0);
  },
  queue(k: string) { if (!this.enabled()) return; this.q.add(k); this.flushSoon(); },
  flushSoon(ms = 350) { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms); },
  async flush() {
    if (!this.ready || !this.q.size || !this.key) return;
    const keys = [...this.q]; this.q.clear();
    const body: Record<string, { u: number; d: string }> = {};
    for (const k of keys) {
      const r = this.getRec(k); if (!r) continue;
      let payload: Record<string, unknown>;
      if (this.isPrivate(r)) {
        if (!r._s) continue; // was never shared → nothing to retract
        payload = { id: r.id, kind: r.kind, deleted: true, updatedAt: r.updatedAt, ghost: 1 }; // retract from partner
      } else { payload = { ...r }; delete payload._s; r._s = 1; }
      body[k] = { u: r.updatedAt || 0, d: await encryptObj(this.key, payload) };
    }
    try {
      if (Object.keys(body).length) await dbPatch(`spaces/${this.space}/r`, body);
      const rem = await Remind.collect(keys);
      if (Object.keys(rem).length) await dbPatch(`rem/${this.space}`, rem);
      if (this.state !== 'live') this.set('live');
      save();
    } catch (err) {
      const e = err as AppError;
      keys.forEach(k => this.q.add(k));
      this.set('error', e.offline || !navigator.onLine ? 'Offline — will sync when you’re back' : e.message === 'denied' ? 'Permission denied — check the database rules' : 'Couldn’t save changes — retrying');
      this.flushSoon(8000);
    }
  },
};
hooks.queue = k => Sync.queue(k);

/* Partner requests arrive at /requests/{myUid}/{theirUid}; "accepted" notes come back the same way.
   Streams only while a request can matter (not paired yet); once paired, a quick check on launch and return is enough,
   which leaves one more connection free for messages. */
export interface PartnerRequest { type?: string; username: string; name: string; color: string; pub: import('./crypto').PubJwk; space: string; wk: string; ts: number }
export const Inbox = {
  live: null as Stream | null, items: {} as Record<string, PartnerRequest>, loaded: false, onChange: null as null | (() => void),
  start() {
    this.stop();
    if (!cloudReady() || !Auth.user()) return;
    if (L.pair && L.pair.status === 'paired') { void this.poll(); return; }
    this.live = Live.open({ path: () => `requests/${L.auth!.uid}`, on: (type, m) => this.onEvent(type, m) });
  },
  stop() { Live.close(this.live); this.live = null; this.items = {}; this.loaded = false; },
  async poll() { try { this.onEvent('put', { path: '/', data: await dbGet(`requests/${L.auth!.uid}`) }); } catch { /* next time */ } },
  onEvent(type: 'put' | 'patch', { path, data }: StreamMsg) {
    const before = new Set(this.incoming().map(([k]) => k));
    const parts = path.split('/').filter(Boolean);
    const d = data as Record<string, PartnerRequest | null> | null;
    if (!parts.length) {
      if (type === 'put') this.items = (d && typeof d === 'object' ? d : {}) as Record<string, PartnerRequest>;
      else for (const [k, v] of Object.entries(d || {})) { if (v === null) delete this.items[k]; else this.items[k] = v; }
    } else if (parts.length === 1) { if (data === null) delete this.items[parts[0]]; else this.items[parts[0]] = data as PartnerRequest; }
    else { const it = (this.items[parts[0]] = this.items[parts[0]] || ({} as PartnerRequest)) as unknown as Record<string, unknown>; it[parts[1]] = data; }
    for (const [from, r] of Object.entries(this.items)) if (r && r.type === 'accepted') { delete this.items[from]; Pair.onAccepted(from, r); }
    const fresh = this.incoming().filter(([k]) => !before.has(k));
    if (this.loaded && fresh.length) { const r = fresh[0][1]; island({ e: '💌', text: `${r.name} sent you a partner request`, sub: 'Tap “Add partner” to accept', ms: 5000 }); haptic('success'); }
    this.loaded = true;
    scheduleRender(); if (this.onChange) this.onChange();
  },
  incoming(): [string, PartnerRequest][] {
    return Object.entries(this.items).filter(([, r]) => r && typeof r === 'object' && typeof r.space === 'string' && typeof r.wk === 'string' && r.type !== 'accepted');
  },
};

if (typeof window !== 'undefined') {
  addEventListener('offline', () => { if (Sync.enabled()) Sync.set('error', 'Offline — will sync when you’re back'); });
  addEventListener('online', () => { if (Sync.enabled()) Sync.flushSoon(0); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !Auth.user() || !cloudReady()) return;
    if (!Inbox.live) void Inbox.poll();
    if (Sync.enabled() && Sync.q.size) Sync.flushSoon(0);
  });
}
