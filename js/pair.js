/* Twodo · pairing two accounts by username
   1. A looks up B's username → B's public key.
   2. A wraps its space key with ECDH(A.priv, B.pub) + HKDF and drops a request in B's inbox,
      plus an invite that lets B (and only B) add themselves to A's space.
   3. B checks the safety code, unwraps the space key with ECDH(B.priv, A.pub), joins, and tells A. */
'use strict';

const Pair = {
  async lookup(raw) {
    const username = normUsername(raw);
    if (!USERNAME_RE.test(username)) throw new Error('Usernames are 3–20 letters, numbers, dots or underscores.');
    if (username === L.auth.username) throw new Error('That’s you! Enter your partner’s username.');
    const uid = await dbGet(`usernames/${username}`);
    if (!uid) throw new Error(`No one is using @${username} yet.`);
    const pub = await dbGet(`users/${uid}/public`);
    if (!pub || !pub.pub) throw new Error(`@${username} hasn’t finished setting up.`);
    const me = await KeyStore.get('pub');
    return { uid, username, name: pub.name || username, color: pub.color || 'pink', pub: pub.pub, code: await safetyCode(me, pub.pub) };
  },

  async send(target) {
    const [priv, pub, space] = await Promise.all([KeyStore.get('priv'), KeyStore.get('pub'), KeyStore.get('space')]);
    const kek = await pairKek(priv, target.pub, space.id);
    const me = L.auth.uid, mine = { name: myName(), color: person(L.me).color, uid: me, username: L.auth.username };
    await dbPatch('', {
      [`spaces/${space.id}/invites/${target.uid}`]: me,
      [`requests/${target.uid}/${me}`]: {
        username: L.auth.username, name: mine.name, color: mine.color, pub, space: space.id,
        wk: await encryptObj(kek, { k: b64(space.raw) }), ts: Date.now(),
      },
    });
    const remap = L.me !== 'a';
    if (remap) { remapIdentity(L.me, 'a'); L.me = 'a'; } // the person who invites is "a"
    D.people = { kind: 'people', id: 'people', a: mine, b: { name: target.name, color: target.color, uid: target.uid, username: target.username }, updatedAt: (D.people && D.people.updatedAt) || 0 };
    commit(D.people);
    L.pair = { status: 'sent', uid: target.uid, username: target.username, name: target.name, code: target.code, ts: Date.now() };
    save(); applyTheme();
    if (remap) Sync.init(); // re-upload tasks with the swapped names
  },

  async cancel() {
    const p = L.pair; if (!p) return;
    const space = await KeyStore.get('space');
    await dbPatch('', { [`requests/${p.uid}/${L.auth.uid}`]: null, [`spaces/${space.id}/invites/${p.uid}`]: null });
    L.pair = null; save();
  },

  async review(fromUid) {
    const r = Inbox.items[fromUid];
    if (!r) throw new Error('That request is gone.');
    const owner = await dbGet(`usernames/${r.username}`);
    if (owner !== fromUid) throw new Error('This request couldn’t be verified, so it was ignored.');
    return { ...r, uid: fromUid, code: await safetyCode(await KeyStore.get('pub'), r.pub) };
  },

  async accept(req) {
    const me = L.auth.uid, [priv, wrap, old] = await Promise.all([KeyStore.get('priv'), KeyStore.get('wrap'), KeyStore.get('space')]);
    let k;
    try { ({ k } = await decryptObj(await pairKek(priv, req.pub, req.space), req.wk)); }
    catch (e) { throw new Error('This request couldn’t be decrypted. Ask them to send it again.'); }
    const patch = {
      [`spaces/${req.space}/members/${me}`]: true,
      [`spaces/${req.space}/invites/${me}`]: null,
      [`requests/${me}/${req.uid}`]: null,
      [`requests/${req.uid}/${me}`]: { type: 'accepted', username: L.auth.username, name: myName(), ts: Date.now() },
      [`users/${me}/private/sk`]: await encryptObj(wrap, { id: req.space, k }),
    };
    if (old && old.id !== req.space) {
      patch[`spaces/${old.id}/members/${me}`] = null; // leave my solo space
      if (L.pair && L.pair.status === 'sent') { patch[`requests/${L.pair.uid}/${me}`] = null; patch[`spaces/${old.id}/invites/${L.pair.uid}`] = null; }
    }
    await dbPatch('', patch);
    await KeyStore.set({ space: { id: req.space, raw: unb64(k) } });
    const mine = { name: myName(), color: person(L.me).color, uid: me, username: L.auth.username };
    Sync.close();
    if (L.me !== 'b') { remapIdentity(L.me, 'b'); L.me = 'b'; } // the person who accepts is "b"
    D.people = { kind: 'people', id: 'people', a: { name: req.name, color: req.color, uid: req.uid, username: req.username }, b: mine, updatedAt: 0 };
    resetSyncFlags();
    L.pair = { status: 'paired', uid: req.uid, username: req.username, name: req.name };
    L.sync = { space: req.space }; save(); applyTheme();
    delete Inbox.items[req.uid];
    await Sync.init(); Inbox.start(); scheduleRender();
  },

  async decline(req) {
    await dbPatch('', { [`requests/${L.auth.uid}/${req.uid}`]: null, [`spaces/${req.space}/invites/${L.auth.uid}`]: null });
    delete Inbox.items[req.uid]; updateSyncUI(); scheduleRender();
  },

  onAccepted(from, r) {
    dbPatch('', { [`requests/${L.auth.uid}/${from}`]: null }).catch(() => {});
    if (!L.pair || L.pair.uid !== from) return;
    L.pair.status = 'paired'; save(); Chat.start(); setTimeout(() => Inbox.start(), 0);
    island({ e: '💞', text: `${r.name} accepted your request!`, sub: 'Your lists now sync together' });
    haptic('success'); confetti(); updateSyncUI(); if (Inbox.onChange) Inbox.onChange();
  },

  // Leave the shared space and start a fresh private one. Everything on this phone stays.
  async unpair() {
    const me = L.auth.uid, [wrap, old] = await Promise.all([KeyStore.get('wrap'), KeyStore.get('space')]);
    const space = { id: randHex(20), raw: crypto.getRandomValues(new Uint8Array(32)) };
    await dbPatch('', {
      [`spaces/${space.id}/members/${me}`]: true,
      ...(old ? { [`spaces/${old.id}/members/${me}`]: null } : {}),
      [`users/${me}/private/sk`]: await encryptObj(wrap, { id: space.id, k: b64(space.raw) }),
    });
    await KeyStore.set({ space });
    Sync.close(); Chat.clearLocal();
    if (D.people && D.people[partnerKey()]) { D.people[partnerKey()] = { ...D.people[partnerKey()], uid: null }; commit(D.people, { silent: true }); }
    resetSyncFlags();
    L.pair = null; L.sync = { space: space.id }; save();
    await Sync.init(); Inbox.start(); scheduleRender();
  },
};
