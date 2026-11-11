/* Twodo · Firebase Auth (REST, no SDK), database helpers and account flows */
'use strict';

const CFG = window.TWODO_CONFIG || {};
const cloudReady = () => !!(CFG.firebase && CFG.firebase.apiKey && CFG.firebase.databaseURL && window.crypto && crypto.subtle);
const dbBase = () => String(CFG.firebase.databaseURL).replace(/\/+$/, '');
const authBase = () => (CFG.authEmulator ? CFG.authEmulator.replace(/\/+$/, '') + '/' : 'https://');
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const normUsername = s => String(s || '').trim().toLowerCase().replace(/^@/, '');

const AUTH_ERRORS = {
  EMAIL_EXISTS: 'That email already has an account. Try signing in.',
  EMAIL_NOT_FOUND: 'Wrong email or password.', INVALID_PASSWORD: 'Wrong email or password.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.', USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  INVALID_EMAIL: 'That email doesn’t look right.', MISSING_EMAIL: 'Enter your email.',
  OPERATION_NOT_ALLOWED: 'Email/password sign-in isn’t switched on in Firebase yet (README, step 2).',
  CONFIGURATION_NOT_FOUND: 'Authentication isn’t set up in Firebase yet (README, step 2).',
  TOKEN_EXPIRED: 'Please sign in again.', USER_NOT_FOUND: 'Please sign in again.', INVALID_REFRESH_TOKEN: 'Please sign in again.',
};

const Auth = {
  refreshing: null,
  user() { return L.auth && L.auth.uid ? L.auth : null; },
  async call(kind, body) {
    const key = encodeURIComponent(CFG.firebase.apiKey);
    const url = kind === 'refresh' ? `${authBase()}securetoken.googleapis.com/v1/token?key=${key}`
      : `${authBase()}identitytoolkit.googleapis.com/v1/accounts:${kind}?key=${key}`;
    let res, j;
    try {
      res = await fetch(url, kind === 'refresh'
        ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      j = await res.json();
    } catch (e) { throw new Error('Can’t reach Firebase. Check your connection.'); }
    if (!res.ok) {
      const code = String((j.error && j.error.message) || '').split(' ')[0];
      if (/API key not valid/i.test((j.error && j.error.message) || '')) throw new Error('The API key in config.js isn’t right.');
      const err = new Error(AUTH_ERRORS[code] || code || 'Sign-in failed'); err.code = code; throw err;
    }
    return j;
  },
  setSession(j) {
    L.auth = {
      ...(L.auth || {}), uid: j.localId || j.user_id, idToken: j.idToken || j.id_token,
      refresh: j.refreshToken || j.refresh_token, exp: Date.now() + (Number(j.expiresIn || j.expires_in || 3600) - 90) * 1000,
    };
    save();
  },
  async token() {
    const a = L.auth; if (!a || !a.refresh) throw new Error('Not signed in');
    if (a.idToken && Date.now() < a.exp) return a.idToken;
    if (!this.refreshing) {
      this.refreshing = this.call('refresh', { grant_type: 'refresh_token', refresh_token: a.refresh })
        .then(j => { this.setSession(j); return L.auth.idToken; })
        .catch(e => { if (e.code) { L.auth.expired = true; save(); } throw e; })
        .finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  },
};

async function dbReq(path, { method = 'GET', body, retry = true } = {}) {
  const tok = await Auth.token();
  let res;
  try {
    res = await fetch(`${dbBase()}/${path}.json?auth=${encodeURIComponent(tok)}`, {
      method, cache: 'no-store',
      ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch (e) { const err = new Error('You’re offline'); err.offline = true; throw err; }
  if (res.status === 401 && retry) { L.auth.exp = 0; return dbReq(path, { method, body, retry: false }); }
  if (!res.ok) { const err = new Error(res.status === 401 || res.status === 403 ? 'denied' : 'Database error ' + res.status); err.status = res.status; throw err; }
  return res.json();
}
const dbGet = p => dbReq(p);
const dbPatch = (p, b) => dbReq(p, { method: 'PATCH', body: b });
const dbPut = (p, b) => dbReq(p, { method: 'PUT', body: b });
const streamUrl = async p => `${dbBase()}/${p}.json?auth=${encodeURIComponent(await Auth.token())}`;

/* ---------- Account flows ---------- */
function resetSyncFlags() {
  for (const r of [...Object.values(D.tasks), ...Object.values(D.lists)]) delete r._s;
  if (D.people) delete D.people._s;
  L.remSig = {};
}
async function createKeysAndSpace(uid, wrap) {
  const kp = await newKeyPair();
  const space = { id: randHex(20), raw: crypto.getRandomValues(new Uint8Array(32)) };
  const me = person(L.me);
  await dbPatch('', {
    [`users/${uid}/public`]: { name: me.name, color: me.color, pub: kp.pub, ...(L.auth.username ? { username: L.auth.username } : {}) },
    [`users/${uid}/private`]: { kp: await encryptObj(wrap, kp.privJwk), sk: await encryptObj(wrap, { id: space.id, k: b64(space.raw) }) },
    [`spaces/${space.id}/members/${uid}`]: true,
  });
  await KeyStore.set({ wrap, priv: await importPriv(kp.privJwk), pub: kp.pub, space });
  return space;
}
// A different account on this phone must never inherit the previous account's tasks.
function switchingAccount() {
  if (L.lastUid && L.lastUid !== L.auth.uid) {
    D = { tasks: {}, lists: {}, people: null };
    L.view = {}; L.remSig = {}; L.focus = null; L.notified = {}; L.pair = null; L.me = 'a';
    ensureBasics();
  }
  L.lastUid = L.auth.uid; L.lastEmail = L.auth.email;
}
async function signUp(email, password, profile = null) {
  email = email.trim().toLowerCase();
  const { authPass, wrap } = await derivePasswordKeys(password, email);
  Auth.setSession(await Auth.call('signUp', { email, password: authPass, returnSecureToken: true }));
  L.auth.email = email;
  switchingAccount();
  if (profile) { // first-run sign-up from the gate: set names, lists and starter tasks
    L.me = 'a';
    setPeople({ name: profile.name, color: profile.color || 'blue' }, { name: profile.partner || 'Partner', color: profile.color === 'pink' ? 'purple' : 'pink' });
    seedLists(); if (!liveTasks().length) seedTasks(); applyTheme();
  }
  const space = await createKeysAndSpace(L.auth.uid, wrap);
  if (!D.people) setPeople(person('a'), person('b'));
  D.people[L.me] = { ...person(L.me), uid: L.auth.uid };
  resetSyncFlags(); commit(D.people, { silent: true });
  L.sync = { space: space.id }; L.pair = null; save();
  await startCloud();
}
async function signIn(email, password) {
  email = email.trim().toLowerCase();
  const { authPass, wrap } = await derivePasswordKeys(password, email);
  Auth.setSession(await Auth.call('signInWithPassword', { email, password: authPass, returnSecureToken: true }));
  L.auth.email = email;
  switchingAccount();
  const uid = L.auth.uid;
  const [pub, priv] = await Promise.all([dbGet(`users/${uid}/public`), dbGet(`users/${uid}/private`)]);
  let space;
  if (!priv || !priv.kp || !priv.sk) space = await createKeysAndSpace(uid, wrap);
  else {
    let privJwk, sk;
    try { privJwk = await decryptObj(wrap, priv.kp); sk = await decryptObj(wrap, priv.sk); }
    catch (e) { throw new Error('Signed in, but your encryption keys couldn’t be unlocked with this password.'); }
    space = { id: sk.id, raw: unb64(sk.k) };
    await KeyStore.set({ wrap, priv: await importPriv(privJwk), pub: pub && pub.pub, space });
  }
  if (pub && pub.username) L.auth.username = pub.username;
  if (D.people) D.people.updatedAt = 0; // the copy in your space wins over this phone's onboarding names
  else D.people = { kind: 'people', id: 'people', updatedAt: 0, a: { name: (pub && pub.name) || email.split('@')[0], color: (pub && pub.color) || 'blue', uid }, b: { name: 'Partner', color: 'pink' } };
  ensureBasics(); addSecretList(); applyTheme();
  resetSyncFlags();
  L.sync = { space: space.id }; L.pair = null; save();
  await startCloud();
}
async function signOut() {
  try { await Push.disable(); } catch (e) { /* best effort */ }
  Sync.close(); Inbox.stop();
  await KeyStore.clear().catch(() => {});
  L.auth = null; L.pair = null; L.sync = {}; L.push = null; resetSyncFlags(); save();
  Sync.set('off');
  if (Sheet.cur) closeSheet();
  startGate('signin'); // tasks stay on this phone, locked behind sign-in
}
async function claimUsername(raw) {
  const name = normUsername(raw);
  if (!USERNAME_RE.test(name)) throw new Error('Use 3–20 letters, numbers, dots or underscores.');
  const uid = L.auth.uid;
  const owner = await dbGet(`usernames/${name}`);
  if (owner && owner !== uid) throw new Error(`@${name} is taken. Try another.`);
  const patch = { [`usernames/${name}`]: uid, [`users/${uid}/public/username`]: name };
  if (L.auth.username && L.auth.username !== name) patch[`usernames/${L.auth.username}`] = null; // release the old one
  try { await dbPatch('', patch); }
  catch (e) { throw new Error(e.message === 'denied' ? `@${name} was just taken. Try another.` : e.message); }
  L.auth.username = name; save();
  return name;
}
async function usernameFree(raw) {
  const name = normUsername(raw);
  if (!USERNAME_RE.test(name)) return null;
  const owner = await dbGet(`usernames/${name}`);
  return !owner || owner === L.auth.uid;
}

// Swap a/b on tasks (when this phone turns out to be the other person). onlyLocal skips tasks that came from the cloud.
function remapIdentity(from, to, { onlyLocal = false } = {}) {
  const swap = v => v === from ? to : v === to ? from : v;
  for (const t of Object.values(D.tasks)) {
    if (onlyLocal && t._s) continue;
    t.createdBy = swap(t.createdBy); t.doneBy = swap(t.doneBy);
    if (t.assignee === 'a' || t.assignee === 'b') t.assignee = swap(t.assignee);
    stamp(t);
  }
}
// After the shared "people" record arrives, make sure this phone knows which person it is.
function fixIdentity() {
  const uid = L.auth && L.auth.uid; if (!uid || !D.people) return;
  const k = D.people.a && D.people.a.uid === uid ? 'a' : D.people.b && D.people.b.uid === uid ? 'b' : null;
  if (k && k !== L.me) { remapIdentity(L.me, k, { onlyLocal: true }); L.me = k; applyTheme(); }
  const pk = k === 'a' ? 'b' : 'a', partner = k && D.people[pk];
  if (partner && partner.uid && (!L.pair || L.pair.status !== 'paired')) L.pair = { status: 'paired', uid: partner.uid, name: partner.name, username: partner.username || '' };
  save();
}

async function startCloud() {
  if (!cloudReady() || !Auth.user()) return;
  await Sync.init();
  Inbox.start();
  scheduleRender();
}
