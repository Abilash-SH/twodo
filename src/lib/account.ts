/* Twodo · account flows: sign up, sign in, sign out, usernames, and knowing which of the two people this phone is */
import { ui } from './bridge';
import { cloudReady } from './config';
import { KeyStore, b64, decryptObj, derivePasswordKeys, encryptObj, importPriv, newKeyPair, randHex, unb64, type PubJwk, type SpaceKey } from './crypto';
import { AppError, Auth, USERNAME_RE, dbGet, dbPatch, normUsername } from './firebase';
import { Push } from './push';
import { scheduleRender } from './render';
import { D, L, addSecretList, commit, ensureBasics, liveTasks, person, resetData, save, seedLists, setPeople, setPeopleRec, stamp } from './store';
import { Inbox, Sync } from './sync';
import { applyTheme } from './theme';
import type { PersonKey } from './types';
import type { Color } from './util';

export function resetSyncFlags(): void {
  for (const r of [...Object.values(D.tasks), ...Object.values(D.lists)]) delete r._s;
  if (D.people) delete D.people._s;
  L.remSig = {};
}
async function createKeysAndSpace(uid: string, wrap: CryptoKey): Promise<SpaceKey> {
  const kp = await newKeyPair();
  const space: SpaceKey = { id: randHex(20), raw: crypto.getRandomValues(new Uint8Array(32)) };
  const me = person(L.me);
  await dbPatch('', {
    [`users/${uid}/public`]: { name: me.name, color: me.color, pub: kp.pub, ...(L.auth!.username ? { username: L.auth!.username } : {}) },
    [`users/${uid}/private`]: { kp: await encryptObj(wrap, kp.privJwk), sk: await encryptObj(wrap, { id: space.id, k: b64(space.raw) }) },
    [`spaces/${space.id}/members/${uid}`]: true,
  });
  await KeyStore.set({ wrap, priv: await importPriv(kp.privJwk), pub: kp.pub, space });
  return space;
}
// A different account on this phone must never inherit the previous account's tasks.
function switchingAccount(): void {
  if (L.lastUid && L.lastUid !== L.auth!.uid) {
    resetData();
    L.view = {}; L.remSig = {}; L.focus = null; L.notified = {}; L.pair = null; L.me = 'a';
    localStorage.removeItem('twodo:chat');
    ensureBasics();
  }
  L.lastUid = L.auth!.uid; L.lastEmail = L.auth!.email;
}
export interface Profile { name: string; color?: Color; partner?: string }
export async function signUp(email: string, password: string, profile: Profile | null = null): Promise<void> {
  email = email.trim().toLowerCase();
  const { authPass, wrap } = await derivePasswordKeys(password, email);
  Auth.setSession(await Auth.call('signUp', { email, password: authPass, returnSecureToken: true }));
  L.auth!.email = email;
  switchingAccount();
  if (profile) { // first-run sign-up from the gate: set names, lists and starter tasks
    L.me = 'a';
    setPeople({ name: profile.name, color: profile.color || 'blue' }, { name: profile.partner || 'Partner', color: profile.color === 'pink' ? 'purple' : 'pink' });
    seedLists(); if (!liveTasks().length) ui.seedTasks(); applyTheme();
  }
  const space = await createKeysAndSpace(L.auth!.uid, wrap);
  if (!D.people) setPeople(person('a'), person('b'));
  D.people![L.me] = { ...person(L.me), uid: L.auth!.uid };
  resetSyncFlags(); commit(D.people!, { silent: true });
  L.sync = { space: space.id }; L.pair = null; save();
  await startCloud();
}
export async function signIn(email: string, password: string): Promise<void> {
  email = email.trim().toLowerCase();
  const { authPass, wrap } = await derivePasswordKeys(password, email);
  Auth.setSession(await Auth.call('signInWithPassword', { email, password: authPass, returnSecureToken: true }));
  L.auth!.email = email;
  switchingAccount();
  const uid = L.auth!.uid;
  const [pub, priv] = await Promise.all([
    dbGet<{ name?: string; color?: Color; pub?: PubJwk; username?: string } | null>(`users/${uid}/public`),
    dbGet<{ kp?: string; sk?: string } | null>(`users/${uid}/private`),
  ]);
  let space: SpaceKey;
  if (!priv || !priv.kp || !priv.sk) space = await createKeysAndSpace(uid, wrap);
  else {
    let privJwk: JsonWebKey, sk: { id: string; k: string };
    try { privJwk = await decryptObj<JsonWebKey>(wrap, priv.kp); sk = await decryptObj<{ id: string; k: string }>(wrap, priv.sk); }
    catch { throw new AppError('Signed in, but your encryption keys couldn’t be unlocked with this password.'); }
    space = { id: sk.id, raw: unb64(sk.k) };
    await KeyStore.set({ wrap, priv: await importPriv(privJwk), ...(pub && pub.pub ? { pub: pub.pub } : {}), space });
  }
  if (pub && typeof pub.username === 'string') L.auth!.username = pub.username;
  if (D.people) D.people.updatedAt = 0; // the copy in your space wins over this phone's onboarding names
  else setPeopleRec({ kind: 'people', id: 'people', updatedAt: 0, a: { name: (pub && pub.name) || email.split('@')[0], color: (pub && pub.color) || 'blue', uid }, b: { name: 'Partner', color: 'pink' } });
  ensureBasics(); addSecretList(); applyTheme();
  resetSyncFlags();
  L.sync = { space: space.id }; L.pair = null; save();
  await startCloud();
}
export async function signOut(): Promise<void> {
  try { await Push.disable(); } catch { /* best effort */ }
  Sync.close(); Inbox.stop();
  await KeyStore.clear().catch(() => {});
  L.auth = null; L.pair = null; L.sync = {}; L.push = null; resetSyncFlags(); save();
  Sync.set('off');
  ui.closeSheet();
  ui.showGate('signin'); // tasks stay on this phone, locked behind sign-in
}
export async function claimUsername(raw: string): Promise<string> {
  const name = normUsername(raw);
  if (!USERNAME_RE.test(name)) throw new AppError('Use 3–20 letters, numbers, dots or underscores.');
  const uid = L.auth!.uid;
  const owner = await dbGet<string | null>(`usernames/${name}`);
  if (owner && owner !== uid) throw new AppError(`@${name} is taken. Try another.`);
  const patch: Record<string, unknown> = { [`usernames/${name}`]: uid, [`users/${uid}/public/username`]: name };
  if (L.auth!.username && L.auth!.username !== name) patch[`usernames/${L.auth!.username}`] = null; // release the old one
  try { await dbPatch('', patch); }
  catch (e) { throw new AppError((e as Error).message === 'denied' ? `@${name} was just taken. Try another.` : (e as Error).message); }
  L.auth!.username = name; save();
  return name;
}
export async function usernameFree(raw: string): Promise<boolean | null> {
  const name = normUsername(raw);
  if (!USERNAME_RE.test(name)) return null;
  const owner = await dbGet<string | null>(`usernames/${name}`);
  return !owner || owner === L.auth!.uid;
}

// Swap a/b on tasks (when this phone turns out to be the other person). onlyLocal skips tasks that came from the cloud.
export function remapIdentity(from: PersonKey, to: PersonKey, { onlyLocal = false } = {}): void {
  const swap = <T>(v: T): T => (v === from ? to : v === to ? from : v) as T;
  for (const t of Object.values(D.tasks)) {
    if (onlyLocal && t._s) continue;
    t.createdBy = swap(t.createdBy); t.doneBy = swap(t.doneBy);
    if (t.assignee === 'a' || t.assignee === 'b') t.assignee = swap(t.assignee);
    stamp(t);
  }
}
// After the shared "people" record arrives, make sure this phone knows which person it is.
export function fixIdentity(): void {
  const uid = L.auth && L.auth.uid; if (!uid || !D.people) return;
  const k: PersonKey | null = D.people.a && D.people.a.uid === uid ? 'a' : D.people.b && D.people.b.uid === uid ? 'b' : null;
  if (k && k !== L.me) { remapIdentity(L.me, k, { onlyLocal: true }); L.me = k; applyTheme(); }
  const pk: PersonKey = k === 'a' ? 'b' : 'a', partner = k && D.people[pk];
  if (partner && partner.uid && (!L.pair || L.pair.status !== 'paired')) L.pair = { status: 'paired', uid: partner.uid, name: partner.name, username: partner.username || '' };
  save();
}

export async function startCloud(): Promise<void> {
  if (!cloudReady() || !Auth.user()) return;
  await Sync.init();
  Inbox.start();
  scheduleRender();
}
