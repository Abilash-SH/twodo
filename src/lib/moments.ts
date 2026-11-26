/* Twodo · Moments (asked for 2026-11-25: "something like Instagram's Instants or Locket, to share images at one tap").
   A photo you take on Home goes to your partner's Home. Data (docs/moments.md):
   - The server keeps only the latest moment of each of you: one `moment` record per person in the same encrypted
     records as everything else (`r/o:a`, `r/o:b`), so a new one replaces the last and the database never fills up.
   - Each phone keeps the moments it has seen (yours and your partner's) in its own IndexedDB `twodo-moments`, the
     latest 60, for looking back. They never leave the phone again.
   - Removing your latest moment removes it from both phones.
   - A notification goes to your partner's phone through the same encrypted push entries as reminders. */
import { Chat } from './chat';
import { CFG } from './config';
import { encryptObj } from './crypto';
import { dbPatch } from './firebase';
import { scheduleRender } from './render';
import { Sync } from './sync';
import { L, MOMENT_MAX, cleanRecord, hooks, myName, partnerKey, stamp } from './store';
import type { Moment, PersonKey } from './types';
import { firstWord } from './util';

const DB = 'twodo-moments', KEEP = 60;
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('m'); // key: `${who}-${at}`
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('m', mode), r = f(t.objectStore('m'));
    t.oncomplete = () => res(r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
};
const hkey = (m: Pick<Moment, 'who' | 'at'>) => `${m.who}-${String(m.at).padStart(15, '0')}`;

/** Set by the screen: what to do when your partner's moment arrives (a line on the island) */
export const momentEvents = { onArrive: (_m: Moment): void => {} };

export const Moments = {
  latest: {} as Partial<Record<PersonKey, Moment>>, // the newest of each of you (the synced records)
  history: [] as Moment[],                          // everything this phone has seen, newest first
  ready: false, ver: 0, loading: null as Promise<void> | null,

  load(): Promise<void> { return (this.loading ||= this.readKept()); },
  async readKept(): Promise<void> {
    try {
      const all = ((await tx('readonly', s => s.getAll())) || []) as unknown[];
      const ok = all.map(cleanRecord).filter((m): m is Moment => !!m && m.kind === 'moment' && !m.deleted);
      const seen = new Set(this.history.map(hkey)); // anything that arrived while this was loading stays
      this.history = [...this.history, ...ok.filter(m => !seen.has(hkey(m)))].sort((a, b) => b.at - a.at).slice(0, KEEP);
      for (const m of this.history) if (!this.latest[m.who] || this.latest[m.who]!.updatedAt < m.updatedAt) this.latest[m.who] = m;
    } catch { /* private mode or no IndexedDB: moments still arrive, they just aren't kept */ }
    this.ready = true; this.ver++; scheduleRender();
  },
  /** for sync: the record behind `o:<who>` */
  rec(who: string): Moment | undefined { return who === 'a' || who === 'b' ? this.latest[who] : undefined; },

  async keep(m: Moment): Promise<void> {
    if (m.deleted) { // removed: from Home and from what this phone kept
      this.history = this.history.filter(x => !(x.who === m.who && x.at === m.at));
      try { await tx('readwrite', s => s.delete(hkey(m))); } catch { /* nothing kept */ }
      return;
    }
    this.history = [m, ...this.history.filter(x => !(x.who === m.who && x.at === m.at))].sort((a, b) => b.at - a.at);
    const gone = this.history.slice(KEEP); this.history = this.history.slice(0, KEEP);
    try {
      await tx('readwrite', s => { s.put({ ...m, _s: undefined }, hkey(m)); for (const g of gone) s.delete(hkey(g)); });
    } catch { /* not kept; still shown */ }
  },

  /** from sync: your partner's newest moment (or your own from your other phone), or one removed (it keeps the time of
   *  the moment it removes, so only that one goes) */
  async receive(m: Moment): Promise<void> {
    if (this.loading) await this.loading; // what this phone already has decides whether it's new
    const prev = this.latest[m.who];
    if (prev && prev.updatedAt >= m.updatedAt) return;
    this.latest[m.who] = m;
    await this.keep(m);
    this.ver++; scheduleRender();
    if (!m.deleted && m.who === partnerKey() && Date.now() - m.at < 10 * 60e3) momentEvents.onArrive(m);
  },

  /** share a photo (a JPEG data URL from `photoForMoment`) with an optional caption */
  async send(img: string, caption: string): Promise<Moment | null> {
    if (!/^data:image\/jpeg;base64,/.test(img) || img.length > MOMENT_MAX) return null;
    const m: Moment = { kind: 'moment', id: L.me, who: L.me, img, caption: caption.trim().slice(0, 80), at: Date.now(), updatedAt: 0, deleted: false };
    stamp(m);
    this.latest[L.me] = m; await this.keep(m);
    hooks.queue('o:' + L.me);
    this.ver++; scheduleRender();
    void notifyPartner();
    return m;
  },
  /** take back your latest moment: it goes from both phones (your earlier ones stay) */
  async remove(): Promise<void> {
    const cur = this.of(L.me); if (!cur) return;
    const m: Moment = { ...cur, img: '', caption: '', deleted: true }; stamp(m);
    await this.keep(m);
    this.latest[L.me] = m; hooks.queue('o:' + L.me);
    this.ver++; scheduleRender();
  },
  /** forget every moment on this phone (unpaired, another account signs in, or the phone is erased) */
  async clear(): Promise<void> {
    if (this.loading) await this.loading;
    this.latest = {}; this.history = []; this.ver++; scheduleRender();
    try { await tx('readwrite', s => s.clear()); } catch { /* nothing kept */ }
  },
  /** what Home shows of someone: their newest moment this phone has that wasn't removed */
  of(who: PersonKey): Moment | undefined { return this.history.find(m => m.who === who); },
};

/* A push to your partner's phone ("📸 Abilash · Shared a moment"), sent by the reminders job within a few minutes.
   Encrypted with your space key like reminders; nothing about the photo is in it. */
async function notifyPartner(): Promise<void> {
  const pu = Chat.partnerUid();
  if (!CFG.vapidPublicKey || !pu || !Sync.key || !Sync.space || !L.auth) return;
  try {
    const d = await encryptObj(Sync.key, { k: 'moment', t: `📸 ${firstWord(myName())}`, b: 'Shared a moment' });
    await dbPatch(`rem/${Sync.space}`, { ['moment_' + L.auth.uid]: { at: Date.now(), to: { [pu]: true }, d, sent: 0 } });
  } catch { /* no notification this time; the moment itself still syncs */ }
}

/** A photo from the camera or library, made small enough to share: the long side 960 px (smaller if needed), JPEG.
 *  Drawing it re-encodes the picture, so nothing else from the file (location, camera details) is kept. */
export function photoForMoment(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const src = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const w0 = img.naturalWidth, h0 = img.naturalHeight; if (!w0 || !h0) throw new Error('empty');
        for (const side of [960, 800, 640, 520]) {
          const s = Math.min(1, side / Math.max(w0, h0)), w = Math.round(w0 * s), h = Math.round(h0 * s);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
          for (let q = .82; q >= .5; q -= .08) { const url = c.toDataURL('image/jpeg', q); if (url.length <= MOMENT_MAX) { res(url); return; } }
        }
        throw new Error('too big');
      } catch (e) { rej(e); } finally { URL.revokeObjectURL(src); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('bad image')); };
    img.src = src;
  });
}
