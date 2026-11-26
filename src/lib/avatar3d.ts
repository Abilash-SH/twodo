/* Twodo · your own 3D you (docs/own-avatar.md): an avatar you made from a selfie (Avaturn, a .glb file), shown on both
   phones instead of a Twodo person.
   - The people record says whose avatar is which file: `model: { h, n }` (SHA-256 of the file, pieces).
   - The file goes to your shared space encrypted, in pieces: spaces/{space}/av/{uid}/{h first 12}/{0…n-1}.
   - Each phone keeps the files the record names in IndexedDB `twodo-people` (key: h), and nothing else.
   Checking, shrinking and the face picture are in avatarfile.ts (loaded only when needed: it brings three.js). */
import { CFG } from './config';
import { decryptBytes, encryptBytes, sha256Hex } from './crypto';
import { dbGet, dbPatch, dbPut } from './firebase';
import { scheduleRender } from './render';
import { D, L, commit, person } from './store';
import { Sync } from './sync';
import type { PersonKey } from './types';

const DB = 'twodo-people', PIECE = 190000, MAX_PIECES = 48;
interface Kept { h: string; glb: ArrayBuffer; face?: string }
let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('m');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('m', mode), q = f(t.objectStore('m'));
    t.oncomplete = () => res(q ? q.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const get = (h: string) => tx<unknown>('readonly', s => s.get(h)).then(v => {
  const o = v as Kept | undefined;   // read back from this phone: still checked (shape here, the file when drawn)
  return o && typeof o.h === 'string' && o.h === h && o.glb instanceof ArrayBuffer && (o.face === undefined || (typeof o.face === 'string' && o.face.startsWith('data:image/jpeg;base64,'))) ? o : null;
}).catch(() => null);
const file = () => import('./avatarfile');
const space = (uid: string, h: string) => `spaces/${Sync.space}/av/${uid}/${h.slice(0, 12)}`;

export type AvatarState = '' | 'checking' | 'sending' | 'sent' | 'local' | 'failed';
export const Avatars = {
  url: {} as Partial<Record<PersonKey, string>>,        // the file, ready to draw (an object URL)
  face: {} as Partial<Record<PersonKey, string>>,       // a small face picture
  hash: {} as Partial<Record<PersonKey, string>>,
  state: '' as AvatarState, note: '', ver: 0,
  busy: false,

  /** what the people record says each of you looks like, made ready (kept files, or downloaded once) */
  async sync(): Promise<void> {
    if (this.busy) return; this.busy = true;
    try {
      for (const k of ['a', 'b'] as PersonKey[]) {
        const m = person(k).model, have = this.hash[k];
        if (!m) { if (have) this.drop(k); continue; }
        if (have === m.h) continue;
        let kept = await get(m.h);
        if (!kept) kept = await this.fetch(k, m.h, m.n);
        if (kept && person(k).model?.h === m.h) this.show(k, kept);
      }
      void this.tidy();
    } finally { this.busy = false; }
  },
  show(k: PersonKey, kept: Kept): void {
    if (this.url[k]) URL.revokeObjectURL(this.url[k]!);
    this.url[k] = URL.createObjectURL(new Blob([kept.glb], { type: 'model/gltf-binary' }));
    this.hash[k] = kept.h; if (kept.face) this.face[k] = kept.face; else delete this.face[k];
    this.ver++; scheduleRender();
  },
  drop(k: PersonKey): void {
    if (this.url[k]) URL.revokeObjectURL(this.url[k]!);
    delete this.url[k]; delete this.hash[k]; delete this.face[k]; this.ver++; scheduleRender();
  },
  /** your partner's (or yours, from your other phone): the pieces, decrypted, checked against the record's hash */
  async fetch(k: PersonKey, h: string, n: number): Promise<Kept | null> {
    const uid = person(k).uid; if (!uid || !Sync.key || !Sync.space) return null;
    try {
      const got = await dbGet<Record<string, unknown> | unknown[] | null>(space(uid, h));
      const pieces: string[] = [];
      for (let i = 0; i < n; i++) { const s = got && (got as Record<string, unknown>)[i]; if (typeof s !== 'string' || s.length > PIECE) return null; pieces.push(s); }
      const bytes = await decryptBytes(Sync.key, pieces.join(''));
      if (await sha256Hex(bytes) !== h) return null;
      const f = await file(); await f.checkKept(bytes.buffer);
      const kept: Kept = { h, glb: bytes.buffer, face: (await f.faceShot(bytes.buffer, person(k).avatar?.look === 'male' ? 'm' : 'f').catch(() => null)) || undefined };
      await tx('readwrite', s => s.put(kept, h)).catch(() => {});
      return kept;
    } catch { return null; }
  },
  /** only the files the people record names stay on this phone */
  async tidy(): Promise<void> {
    const want = new Set((['a', 'b'] as PersonKey[]).map(k => person(k).model?.h).filter(Boolean));
    const keys = (await tx<IDBValidKey[]>('readonly', s => s.getAllKeys()).catch(() => [])) || [];
    for (const k of keys) if (!want.has(String(k))) await tx('readwrite', s => s.delete(k)).catch(() => {});
  },

  /** your avatar file: checked, made small, shown here at once, then sent (encrypted, in pieces) and named in the record */
  async use(buf: ArrayBuffer): Promise<void> {
    this.set('checking', 'Checking your avatar…');
    let f: Awaited<ReturnType<typeof file>> | null = null;
    try {
      f = await file(); const bytes = await f.shrink(buf), h = await sha256Hex(bytes), me = L.me;
      const kept: Kept = { h, glb: bytes.buffer, face: (await f.faceShot(bytes.buffer, person(me).avatar?.look === 'male' ? 'm' : 'f').catch(() => null)) || undefined };
      await tx('readwrite', s => s.put(kept, h)).catch(() => {});
      this.show(me, kept);
      await this.send(kept);
    } catch (e) {
      this.set('failed', f && e instanceof f.AvatarError ? e.message : 'That file couldn’t be used. Export your avatar again as a .glb.');
    }
  },
  async send(kept: Kept): Promise<void> {
    const me = L.me, uid = L.auth?.uid, prev = person(me).model;
    if (!uid || !Sync.key || !Sync.space || !CFG.firebase.databaseURL || !(L.pair && L.pair.status === 'paired')) { this.set('local', 'On this phone only: sign in and add your partner to send it.'); return; }
    this.set('sending', 'Sending it to your partner…');
    try {
      const enc = await encryptBytes(Sync.key, new Uint8Array(kept.glb)), n = Math.ceil(enc.length / PIECE);
      if (n > MAX_PIECES) throw new Error('too big');
      for (let i = 0; i < n; i += 6) {
        const part: Record<string, string> = {};
        for (let j = i; j < Math.min(n, i + 6); j++) part[j] = enc.slice(j * PIECE, (j + 1) * PIECE);
        await dbPatch(space(uid, kept.h), part);
      }
      if (!D.people) D.people = { kind: 'people', id: 'people', a: person('a'), b: person('b'), updatedAt: 0 };
      D.people[me] = { ...person(me), model: { h: kept.h, n } }; commit(D.people);
      if (prev && prev.h !== kept.h) await dbPut(space(uid, prev.h), null).catch(() => {});
      void this.tidy();
      this.set('sent', 'Your avatar is on both phones.');
    } catch {
      this.set('failed', 'It’s on this phone, but it couldn’t be sent yet. Try again when you’re online.');
    }
  },
  /** back to a Twodo person, on both phones */
  async remove(): Promise<void> {
    const me = L.me, prev = person(me).model, uid = L.auth?.uid;
    if (prev && D.people) { const p = { ...person(me) }; delete p.model; D.people[me] = p; commit(D.people); }
    this.drop(me);
    if (prev && uid && Sync.space) await dbPut(space(uid, prev.h), null).catch(() => {});
    void this.tidy(); this.set('', '');
  },
  set(state: AvatarState, note: string): void { this.state = state; this.note = note; this.ver++; scheduleRender(); },
  /** forget every avatar on this phone (unpaired, another account signs in, or the phone is erased) */
  async clear(): Promise<void> {
    for (const k of ['a', 'b'] as PersonKey[]) this.drop(k);
    await tx('readwrite', s => s.clear()).catch(() => {});
  },
};
