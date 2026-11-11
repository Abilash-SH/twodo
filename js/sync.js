/* Twodo · end-to-end encrypted sync over the Firebase Realtime Database REST + streaming API.
   - The pair code (120 random bits) never leaves your devices except inside the invite link you share.
   - SHA-256(code) picks an unguessable path; another SHA-256(code) is the AES-256-GCM key.
   - The database only ever stores { u: updatedAt, d: ciphertext } per record. Last write wins per record. */
'use strict';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I, L, O, U)
function genCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(15)); // 120 bits → 24 chars
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
    val &= (1 << bits) - 1;
  }
  return formatCode(out);
}
const normCode = s => String(s || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
const formatCode = s => (normCode(s).match(/.{1,4}/g) || []).join('-');
function normUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKeys(code) {
  const n = normCode(code);
  if (n.length < 20) throw new Error('That pair code looks too short');
  const enc = new TextEncoder();
  const h1 = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('twodo:space:' + n)));
  const space = Array.from(h1, b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  const h2 = await crypto.subtle.digest('SHA-256', enc.encode('twodo:key:' + n));
  const key = await crypto.subtle.importKey('raw', h2, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { space, key };
}
async function encryptObj(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
async function decryptObj(key, s) {
  const b = unb64(s);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

// Look into a space before joining it: returns the couple's names (or null if the space is empty).
async function probeSpace(url, code) {
  if (!window.crypto || !crypto.subtle) throw new Error('Sync needs the site to be served over HTTPS');
  const { space, key } = await deriveKeys(code);
  let res;
  try { res = await fetch(normUrl(url) + '/twodo/' + space + '/r/people.json', { cache: 'no-store' }); }
  catch (e) { throw new Error('Couldn’t reach the database. Check the URL and your connection.'); }
  if (res.status === 401 || res.status === 403) throw new Error('Permission denied. Did you publish the database rules from the README?');
  if (!res.ok) throw new Error(`The database answered with an error (${res.status}). Check the URL.`);
  const v = await res.json();
  if (!v || !v.d) return { people: null };
  try { return { people: await decryptObj(key, v.d) }; }
  catch (e) { throw new Error('That code doesn’t match this space.'); }
}

const Sync = {
  state: 'off', msg: '', es: null, key: null, space: null,
  q: new Set(), timer: null, ready: false, chain: Promise.resolve(), retryT: null, notes: [], notesT: null,

  enabled() { return !!(L.sync.url && L.sync.code); },
  base() { return normUrl(L.sync.url) + '/twodo/' + this.space; },
  set(state, msg = '') {
    this.state = state; this.msg = msg;
    $$('.sync-dot').forEach(d => { d.className = 'sync-dot ' + state; });
    if (typeof updateSyncUI === 'function') updateSyncUI();
  },
  label() {
    return { live: `Synced with ${ptName()}`, connecting: 'Connecting…', error: this.msg || 'Sync problem', off: 'Off' }[this.state];
  },

  async init() {
    this.close();
    if (!this.enabled()) return this.set('off');
    if (!window.crypto || !crypto.subtle) return this.set('error', 'Sync needs HTTPS');
    this.set('connecting');
    try { const k = await deriveKeys(L.sync.code); this.space = k.space; this.key = k.key; }
    catch (e) { return this.set('error', e.message); }
    this.connect();
  },
  close() {
    if (this.es) { this.es.close(); this.es = null; }
    clearTimeout(this.retryT); this.ready = false;
  },
  connect() {
    if (this.es) this.es.close();
    this.ready = false;
    if (!navigator.onLine) return this.set('error', 'Offline — will sync when you’re back');
    const es = new EventSource(this.base() + '/r.json');
    this.es = es;
    const handle = e => {
      let msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      this.chain = this.chain.then(() => this.onEvent(msg)).catch(err => console.warn('sync', err));
    };
    es.addEventListener('put', handle);
    es.addEventListener('patch', handle);
    es.addEventListener('cancel', () => { this.set('error', 'Permission denied — check the database rules'); es.close(); });
    es.addEventListener('auth_revoked', () => { this.set('error', 'Access revoked'); es.close(); });
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
      for (const [k, v] of Object.entries(map)) await this.apply(k, v);
      if (!this.ready) { this.ready = true; this.pushNewer(map); }
    } else {
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 1) await this.apply(parts[0], data);
      else {
        const r = await fetch(this.base() + '/r/' + encodeURIComponent(parts[0]) + '.json', { cache: 'no-store' });
        if (r.ok) await this.apply(parts[0], await r.json());
      }
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
    if (k === 'people') D.people = obj;
    else if (obj.kind === 'task') { this.noteTask(local, obj); D.tasks[obj.id] = obj; }
    else if (obj.kind === 'list') D.lists[obj.id] = obj;
    else return;
    save(); scheduleRender();
  },

  // Friendly heads-up when your partner does something relevant to you
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
      const one = ns.length === 1 ? ns[0] : { e: '💞', text: `${ns.length} updates from ${ptName()}` };
      island(one); haptic('light');
      if (document.hidden) sysNotify('Twodo', one.text + (one.sub ? ' · ' + one.sub : ''));
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
    if (!Object.keys(body).length) return;
    try {
      const res = await fetch(this.base() + '/r.json', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      if (this.state !== 'live') this.set('live');
      save();
    } catch (e) {
      keys.forEach(k => this.q.add(k));
      this.set('error', navigator.onLine ? 'Couldn’t save changes — retrying' : 'Offline — will sync when you’re back');
      this.flushSoon(8000);
    }
  },
};

addEventListener('online', () => { if (Sync.enabled()) Sync.connect(); });
addEventListener('offline', () => { if (Sync.enabled()) Sync.set('error', 'Offline — will sync when you’re back'); });
document.addEventListener('visibilitychange', () => {
  // iOS suspends background pages; reconnect the stream when we come back
  if (!document.hidden && Sync.enabled() && (!Sync.es || Sync.es.readyState === 2)) Sync.connect();
});
