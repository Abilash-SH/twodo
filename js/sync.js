/* Twodo · end-to-end encrypted sync over the Firebase Realtime Database REST + streaming API.
   Data lives at /spaces/{space}/r/{record} as { u: updatedAt, d: AES-GCM ciphertext }.
   Only signed-in members of a space can read or write it (firebase.rules.json); only phones holding
   the space key can decrypt it. Last write wins per record. */
'use strict';

const Sync = {
  state: 'off', msg: '', es: null, key: null, space: null,
  q: new Set(), timer: null, ready: false, chain: Promise.resolve(), retryT: null, notes: [], notesT: null,

  enabled() { return cloudReady() && !!Auth.user() && !!(L.sync && L.sync.space); },
  set(state, msg = '') {
    this.state = state; this.msg = msg;
    $$('.sync-dot').forEach(d => { d.className = 'sync-dot ' + state; });
    if (typeof updateSyncUI === 'function') updateSyncUI();
  },
  label() {
    const paired = L.pair && L.pair.status === 'paired';
    return { live: paired ? `Synced with ${firstWord(L.pair.name || ptName())}` : 'Backed up to your account', connecting: 'Connecting…', error: this.msg || 'Sync problem', off: 'Off' }[this.state];
  },

  async init() {
    this.close();
    if (!this.enabled()) return this.set('off');
    this.set('connecting');
    try {
      const sp = await KeyStore.get('space');
      if (!sp || sp.id !== L.sync.space) throw new Error('This phone is missing its keys. Sign out and in again.');
      this.space = sp.id; this.key = await spaceKeyFromRaw(sp.raw);
    } catch (e) { return this.set('error', e.message); }
    this.connect();
  },
  close() {
    if (this.es) { this.es.close(); this.es = null; }
    clearTimeout(this.retryT); this.ready = false;
  },
  async connect() {
    if (this.es) this.es.close();
    this.ready = false;
    if (!navigator.onLine) return this.set('error', 'Offline — will sync when you’re back');
    let url;
    try { url = await streamUrl(`spaces/${this.space}/r`); }
    catch (e) { return this.set('error', L.auth && L.auth.expired ? 'Signed out — please sign in again' : e.message); }
    const es = new EventSource(url);
    this.es = es;
    const handle = e => {
      let msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      this.chain = this.chain.then(() => this.onEvent(msg)).catch(err => console.warn('sync', err));
    };
    es.addEventListener('put', handle);
    es.addEventListener('patch', handle);
    es.addEventListener('auth_revoked', () => { es.close(); L.auth.exp = 0; this.connect(); }); // token expired → refresh
    es.addEventListener('cancel', () => { es.close(); this.set('error', 'No access to this space any more'); });
    es.onerror = () => {
      if (es.readyState === 2) {
        this.set('error', 'Can’t reach the database');
        clearTimeout(this.retryT); this.retryT = setTimeout(() => this.connect(), 15000);
      } else this.set('connecting');
    };
  },

  async onEvent({ path, data }) {
    if (path === '/') {
      const map = data || {};
      if (map.people) await this.apply('people', map.people); // identity first, then everything else
      for (const [k, v] of Object.entries(map)) if (k !== 'people') await this.apply(k, v);
      if (!this.ready) { this.ready = true; this.pushNewer(map); }
    } else {
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 1) await this.apply(parts[0], data);
      else await this.apply(parts[0], await dbGet(`spaces/${this.space}/r/${encodeURIComponent(parts[0])}`));
    }
    if (this.state !== 'live') this.set('live');
  },

  getRec(k) {
    if (k === 'people') return D.people;
    const id = k.slice(2);
    return k[0] === 't' ? D.tasks[id] : k[0] === 'l' ? D.lists[id] : null;
  },
  localU(k) { const r = this.getRec(k); return r ? (r.updatedAt || 0) : 0; },
  isPrivate(r) {
    if (r.kind === 'list') return !!r.private;
    if (r.kind === 'task') { const l = D.lists[r.listId]; return !!(l && l.private); }
    return false;
  },

  async apply(k, v) {
    if (!v || typeof v !== 'object' || !v.d) return;
    if ((v.u || 0) <= this.localU(k)) return;
    let obj;
    try { obj = await decryptObj(this.key, v.d); } catch (e) { return; } // wrong key or tampered → ignore
    if (!obj || (obj.updatedAt || 0) <= this.localU(k)) return;
    const local = this.getRec(k);
    if (local && this.isPrivate(local)) return; // never overwrite something that's private on this phone
    obj._s = 1;
    if (k === 'people') { D.people = obj; fixIdentity(); applyTheme(); }
    else if (obj.kind === 'task') { this.noteTask(local, obj); D.tasks[obj.id] = obj; }
    else if (obj.kind === 'list') D.lists[obj.id] = obj;
    else return;
    save(); scheduleRender();
  },

  noteTask(prev, t) {
    if (!this.ready || t.deleted || !t.title) return;
    const pk = partnerKey();
    if (t.done && (!prev || !prev.done) && t.doneBy === pk) this.note({ e: '💞', text: `${ptName()} completed “${t.title}”` });
    else if (!prev && t.createdBy === pk && (t.assignee === L.me || t.assignee === 'both'))
      this.note({ e: '✨', text: `${ptName()} added “${t.title}”`, sub: t.assignee === L.me ? 'For you' : 'For both of you' });
  },
  note(n) {
    this.notes.push(n);
    clearTimeout(this.notesT);
    this.notesT = setTimeout(() => {
      const ns = this.notes; this.notes = [];
      island(ns.length === 1 ? ns[0] : { e: '💞', text: `${ns.length} updates from ${ptName()}` }); haptic('light');
    }, 700);
  },

  pushNewer(map) {
    const keys = [];
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
  queue(k) { if (!this.enabled()) return; this.q.add(k); this.flushSoon(); },
  flushSoon(ms = 350) { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms); },
  async flush() {
    if (!this.ready || !this.q.size || !this.key) return;
    const keys = [...this.q]; this.q.clear();
    const body = {};
    for (const k of keys) {
      const r = this.getRec(k); if (!r) continue;
      let payload;
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
    } catch (e) {
      keys.forEach(k => this.q.add(k));
      this.set('error', e.offline || !navigator.onLine ? 'Offline — will sync when you’re back' : e.message === 'denied' ? 'Permission denied — check the database rules' : 'Couldn’t save changes — retrying');
      this.flushSoon(8000);
    }
  },
};

/* Partner requests arrive at /requests/{myUid}/{theirUid}; "accepted" notes come back the same way. */
const Inbox = {
  es: null, items: {}, retryT: null, loaded: false,
  start() { this.stop(); if (cloudReady() && Auth.user()) this.connect(); },
  stop() { if (this.es) this.es.close(); this.es = null; clearTimeout(this.retryT); this.items = {}; this.loaded = false; },
  async connect() {
    if (this.es) this.es.close();
    let url;
    try { url = await streamUrl(`requests/${L.auth.uid}`); } catch (e) { this.retryT = setTimeout(() => this.connect(), 30000); return; }
    const es = new EventSource(url);
    this.es = es;
    const h = type => e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.onEvent(type, m); };
    es.addEventListener('put', h('put'));
    es.addEventListener('patch', h('patch'));
    es.addEventListener('auth_revoked', () => { es.close(); L.auth.exp = 0; this.connect(); });
    es.addEventListener('cancel', () => es.close());
    es.onerror = () => { if (es.readyState === 2) { clearTimeout(this.retryT); this.retryT = setTimeout(() => this.connect(), 20000); } };
  },
  onEvent(type, { path, data }) {
    const before = new Set(this.incoming().map(([k]) => k));
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) {
      if (type === 'put') this.items = data || {};
      else for (const [k, v] of Object.entries(data || {})) { if (v === null) delete this.items[k]; else this.items[k] = v; }
    } else if (parts.length === 1) { if (data === null) delete this.items[parts[0]]; else this.items[parts[0]] = data; }
    else { const it = this.items[parts[0]] = this.items[parts[0]] || {}; it[parts[1]] = data; }
    for (const [from, r] of Object.entries(this.items)) if (r && r.type === 'accepted') { delete this.items[from]; Pair.onAccepted(from, r); }
    const fresh = this.incoming().filter(([k]) => !before.has(k));
    if (this.loaded && fresh.length) { const r = fresh[0][1]; island({ e: '💞', text: `${r.name} wants to pair with you`, sub: 'Open Settings to review', ms: 5000 }); haptic('success'); }
    this.loaded = true;
    scheduleRender(); updateSyncUI();
  },
  incoming() { return Object.entries(this.items).filter(([, r]) => r && r.space && r.wk && r.type !== 'accepted'); },
};

addEventListener('online', () => { if (Sync.enabled()) Sync.connect(); if (Auth.user()) Inbox.start(); });
addEventListener('offline', () => { if (Sync.enabled()) Sync.set('error', 'Offline — will sync when you’re back'); });
document.addEventListener('visibilitychange', () => {
  // iOS suspends background pages; reconnect the streams when we come back
  if (document.hidden || !Auth.user() || !cloudReady()) return;
  if (Sync.enabled() && (!Sync.es || Sync.es.readyState === 2)) Sync.connect();
  if (!Inbox.es || Inbox.es.readyState === 2) Inbox.start();
});
