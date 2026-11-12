/* Twodo · the secret vault: secret lists (and their to-dos) are encrypted on this phone and never synced.

   passcode ──PBKDF2-SHA256(600k, random salt)──▶ key ──unwraps──▶ vault key (random AES-256) ──▶ secret lists
   Face ID (optional): a passkey's PRF secret ──HKDF──▶ key ──unwraps──▶ the same vault key

   While locked, the secret lists aren't in memory at all, so nothing else in the app can show, count, search or sync
   them. Unlocked, they live in memory only; what's saved to the phone is always ciphertext. The app locks itself as
   soon as you leave it. Lose the passcode (and Face ID) and the secret lists can't be opened by anyone: that's the point. */
import { b64, te, unb64 } from './crypto';
import { scheduleRender } from './render';
import { D, cleanMap, save, saveNow, vaultHooks } from './store';
import type { List, Task } from './types';

const KV = 'twodo:vault';
const ITER = 600000;
const AAD_WK = te.encode('twodo/vault/v1/key'), AAD_DATA = te.encode('twodo/vault/v1/data'), AAD_BIO = te.encode('twodo/vault/v1/bio');
export const PIN_LEN = 6;

interface VaultFile {
  v: 1;
  salt: string; iter: number; // PBKDF2 for the passcode
  wk: string; // the vault key, encrypted with the passcode key
  data: string; // { lists, tasks }, encrypted with the vault key
  bio?: { id: string; salt: string; wk: string }; // passkey id, PRF salt, the vault key encrypted with the Face ID key
  fails?: number; until?: number; // wrong guesses → growing wait
}
export class VaultError extends Error {
  constructor(public code: 'wrong' | 'wait' | 'none' | 'bio' | 'unsupported', public wait = 0) { super(code); }
}

let dek: CryptoKey | null = null; // the vault key, only while unlocked
let chain: Promise<void> = Promise.resolve(); // writes happen one at a time

function read(): VaultFile | null {
  try {
    const f = JSON.parse(localStorage.getItem(KV) || 'null');
    return f && f.v === 1 && typeof f.salt === 'string' && typeof f.wk === 'string' && typeof f.data === 'string' ? f as VaultFile : null;
  } catch { return null; }
}
function write(f: VaultFile): void { localStorage.setItem(KV, JSON.stringify(f)); }

async function seal(key: CryptoKey, plain: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plain));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function open(key: CryptoKey, s: string, aad: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const b = unb64(s);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12), additionalData: aad }, key, b.slice(12)));
}
async function pinKey(pin: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function prfKey(secret: ArrayBuffer, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('twodo/vault/v1/faceid') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const importDek = (raw: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
const rawDek = async (): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await crypto.subtle.exportKey('raw', dek!));

/* ---------- which records are secret ---------- */
const secretLists = (): List[] => Object.values(D.lists).filter(l => l.private);
function secretRecords(): { lists: Record<string, List>; tasks: Record<string, Task> } {
  const lists: Record<string, List> = {}, tasks: Record<string, Task> = {};
  for (const l of secretLists()) lists[l.id] = l;
  for (const t of Object.values(D.tasks)) if (lists[t.listId]) tasks[t.id] = t;
  return { lists, tasks };
}
function dropFromMemory(): void {
  const { lists, tasks } = secretRecords();
  for (const id in tasks) delete D.tasks[id];
  for (const id in lists) delete D.lists[id];
}

/* ---------- attempts: after 5 wrong passcodes, wait 30 s, then a minute, 2, 4… (up to an hour) ---------- */
function waitLeft(f: VaultFile): number { return Math.max(0, (f.until || 0) - Date.now()); }
function noteFail(f: VaultFile): void {
  f.fails = (f.fails || 0) + 1;
  if (f.fails >= 5) f.until = Date.now() + Math.min(3600e3, 30e3 * 2 ** (f.fails - 5));
  write(f);
}

async function openWith(key: CryptoKey, f: VaultFile, which: 'pin' | 'bio'): Promise<void> {
  const raw = await open(key, which === 'pin' ? f.wk : f.bio!.wk, which === 'pin' ? AAD_WK : AAD_BIO);
  const k = await importDek(raw);
  const data = JSON.parse(new TextDecoder().decode(await open(k, f.data, AAD_DATA))) as { lists?: unknown; tasks?: unknown };
  dek = k;
  // the vault's copy wins for its own records (checked like any stored record before it's used)
  const lists = cleanMap<List>(data.lists), tasks = cleanMap<Task>(data.tasks);
  for (const [id, l] of Object.entries(lists)) D.lists[id] = { ...l, private: true };
  for (const [id, t] of Object.entries(tasks)) if (lists[t.listId]) D.tasks[id] = t;
  if (f.fails || f.until) { delete f.fails; delete f.until; write(f); }
  scheduleRender();
}

export const Vault = {
  exists: (): boolean => !!read(),
  unlocked: (): boolean => !!dek,
  locked: (): boolean => !!read() && !dek,
  hasBio: (): boolean => !!read()?.bio,
  waitLeft: (): number => { const f = read(); return f ? waitLeft(f) : 0; },

  /** First passcode: everything already in secret lists moves into the vault */
  async create(pin: string): Promise<void> {
    if (read()) throw new VaultError('wrong');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const wk = await seal(await pinKey(pin, salt, ITER), new Uint8Array(await crypto.subtle.exportKey('raw', k)), AAD_WK);
    dek = k;
    write({ v: 1, salt: b64(salt), iter: ITER, wk, data: await seal(k, te.encode(JSON.stringify(secretRecords())), AAD_DATA) });
    saveNow(); // the plain copy of the secret lists is gone from the phone from this moment
    scheduleRender();
  },
  async unlock(pin: string): Promise<void> {
    const f = read(); if (!f) throw new VaultError('none');
    if (dek) return;
    const w = waitLeft(f); if (w) throw new VaultError('wait', w);
    let key: CryptoKey;
    try { key = await pinKey(pin, unb64(f.salt), f.iter || ITER); await openWith(key, f, 'pin'); }
    catch { noteFail(f); const w2 = waitLeft(f); throw new VaultError(w2 ? 'wait' : 'wrong', w2); }
  },
  /** Checks a passcode without changing anything (used before changing it) */
  async check(pin: string): Promise<boolean> {
    const f = read(); if (!f) return false;
    if (waitLeft(f)) throw new VaultError('wait', waitLeft(f));
    try { await open(await pinKey(pin, unb64(f.salt), f.iter || ITER), f.wk, AAD_WK); return true; } catch { noteFail(f); return false; }
  },
  async changePin(pin: string): Promise<void> {
    if (!read() || !dek) throw new VaultError('none');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wk = await seal(await pinKey(pin, salt, ITER), await rawDek(), AAD_WK);
    const f = read(); if (!f) throw new VaultError('none'); // read-modify-write with no wait in between
    f.salt = b64(salt); f.iter = ITER; f.wk = wk; delete f.fails; delete f.until; write(f);
  },
  /** Save the secret lists (encrypted). Called after every change while unlocked. */
  persist(): Promise<void> {
    chain = chain.then(async () => {
      if (!read() || !dek) return;
      const data = await seal(dek, te.encode(JSON.stringify(secretRecords())), AAD_DATA);
      const f = read(); if (!f) return; // reset meanwhile
      f.data = data; write(f);
    }).catch(e => console.warn('vault save', e));
    return chain;
  },
  async lock(): Promise<void> {
    if (!dek) return;
    await this.persist();
    dek = null;
    dropFromMemory();
    scheduleRender();
  },
  /** Forgot the passcode: the secret lists are erased from this phone (nobody can open them anyway) */
  reset(): void {
    dek = null; dropFromMemory();
    localStorage.removeItem(KV); save(); scheduleRender();
  },

  /* ---------- Face ID / Touch ID: a passkey on this phone whose PRF secret unwraps the vault key ---------- */
  async bioAvailable(): Promise<boolean> {
    try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
  },
  async enableBio(): Promise<void> {
    const f = read(); if (!f || !dek) throw new VaultError('none');
    const raw = await rawDek(); // taken now: the Face ID prompt may background the app, which locks it
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({ publicKey: {
      rp: { name: 'Twodo' }, // this site only
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'Twodo secret lists', displayName: 'Twodo secret lists' },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    } }) as PublicKeyCredential | null;
    if (!cred) throw new VaultError('bio');
    const ext = cred.getClientExtensionResults() as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
    if (ext.prf && ext.prf.enabled === false) throw new VaultError('unsupported');
    const id = new Uint8Array(cred.rawId);
    // some phones only hand out the secret when the passkey is used, not when it's made
    const secret = ext.prf?.results?.first || await prfSecret(id, salt);
    const wk = await seal(await prfKey(secret, salt), raw, AAD_BIO);
    const cur = read(); if (!cur) throw new VaultError('none'); // re-read: the vault may have been saved meanwhile
    cur.bio = { id: b64(id), salt: b64(salt), wk }; write(cur);
  },
  disableBio(): void { const f = read(); if (f && f.bio) { delete f.bio; write(f); } },
  async unlockBio(): Promise<void> {
    const f = read(); if (!f) throw new VaultError('none');
    if (!f.bio) throw new VaultError('bio');
    if (dek) return;
    const salt = unb64(f.bio.salt);
    const secret = await prfSecret(unb64(f.bio.id), salt);
    try { await openWith(await prfKey(secret, salt), f, 'bio'); } catch { throw new VaultError('bio'); }
  },
};

async function prfSecret(id: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const a = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ type: 'public-key', id }],
    userVerification: 'required', timeout: 60000,
    extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
  } }) as PublicKeyCredential | null;
  const r = a && (a.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } }).prf?.results?.first;
  if (!r) throw new VaultError('unsupported');
  return r;
}

/* the store asks the vault whether secret records may be written in plain text (only before a passcode exists) */
vaultHooks.active = () => Vault.exists();
vaultHooks.changed = () => { if (dek) void Vault.persist(); };

/* Leaving the app locks it straight away */
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) void Vault.lock(); });
  addEventListener('pagehide', () => { void Vault.lock(); });
}
