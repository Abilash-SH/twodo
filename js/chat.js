/* Twodo · Messages (data layer)
   /spaces/{space}/c/m/{id}            = { f: authorUid, u: updatedAt, d: AES-GCM ciphertext }   (only the author can edit/unsend)
   /spaces/{space}/c/e/x/{uid}         = { u, d: { typing, read, at, on } }                       (typing, read receipts, online)
   /spaces/{space}/c/e/rx/{msg}/{uid}  = { u, d: { r } }                                          (tapback reactions)
   Everything is encrypted with the space key; Firebase sees only who wrote and when. */
'use strict';

const CHAT_KEY = 'twodo:chat';
const TAPBACKS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

const Chat = {
  space: null, msgs: {}, rx: {}, played: {}, read: 0, ver: 0, loaded: false,
  liveM: null, liveE: null, eTree: {}, dcache: new Map(), chainM: Promise.resolve(), chainE: Promise.resolve(),
  typingOn: false, typingSentAt: 0, partnerTypingUntil: 0, partnerRead: 0, partnerReadAt: 0, lastPxD: null, typingT: null,
  presence: null, xAt: 0, // partner presence: { on, at (their clock), beat (when we last heard it) }

  partnerUid() { const p = D.people && D.people[partnerKey()]; return (p && p.uid) || (L.pair && L.pair.uid) || null; },
  ready() { return Sync.enabled() && !!Sync.key && !!Sync.space && !!(L.pair && L.pair.status === 'paired') && !!this.partnerUid(); },
  base() { return `spaces/${Sync.space}/c`; },
  bump() { this.ver++; },

  /* ---------- local cache (last 600 messages) ---------- */
  load() {
    let j = null; try { j = JSON.parse(localStorage.getItem(CHAT_KEY) || 'null'); } catch (e) { /* ignore */ }
    const ok = j && j.space === Sync.space;
    this.msgs = ok ? j.msgs || {} : {}; this.rx = ok ? j.rx || {} : {}; this.played = ok ? j.played || {} : {}; this.read = ok ? j.read || 0 : 0;
    for (const m of Object.values(this.msgs)) if (m.status === 'sending') m.status = 'failed';
    this.space = Sync.space; this.loaded = false; this.bump();
  },
  saveSoon() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => {
      const ids = Object.keys(this.msgs).sort().slice(-600), msgs = {};
      ids.forEach(id => { msgs[id] = this.msgs[id]; }); this.msgs = msgs;
      try { localStorage.setItem(CHAT_KEY, JSON.stringify({ space: this.space, msgs, rx: this.rx, played: this.played, read: this.read })); } catch (e) { /* full */ }
    }, 300);
  },
  clearLocal() { this.stop(); this.msgs = {}; this.rx = {}; this.played = {}; this.read = 0; localStorage.removeItem(CHAT_KEY); this.bump(); this.updateBadge(); },

  /* ---------- streams ---------- */
  ensure() { if (!this.liveM && this.ready()) this.start(); },
  start() {
    this.stop();
    if (!this.ready()) { this.updateBadge(); return; }
    if (this.space !== Sync.space) this.load();
    this.liveM = Live.open({ path: () => this.base() + '/m', query: () => this.mQuery(),
      on: (type, m) => { this.chainM = this.chainM.then(() => this.onM(type, m)).catch(err => console.warn('chat', err)); } });
    this.liveE = Live.open({ path: () => this.base() + '/e',
      on: (type, m) => { this.chainE = this.chainE.then(() => this.onE(type, m)).catch(err => console.warn('chat', err)); } });
    this.updateBadge();
    for (const m of Object.values(this.msgs)) if (m.status === 'failed' && m.f === L.auth.uid) this.retry(m.id);
    this.xPending = true; // say we're here once we know what we've already read (a new phone starts at 0)
  },
  stop() { Live.close(this.liveM); Live.close(this.liveE); this.liveM = this.liveE = null; },
  // On a reconnect only fetch what can have changed: anything newer than each person's latest message we already
  // have, minus 20 minutes (Undo Send works for 15). Message ids start with the sender's clock, so this is per sender.
  mQuery() {
    let q = '&orderBy=' + encodeURIComponent('"$key"');
    const newest = {};
    for (const m of Object.values(this.msgs)) if (m.status === 'sent' && m._u && (!newest[m.f] || m.id > newest[m.f])) newest[m.f] = m.id;
    const ids = Object.values(newest);
    if (ids.length >= 2) {
      const t = Math.min(...ids.map(id => parseInt(id.slice(0, 9), 36))) - 20 * 60e3;
      if (t > 0) q += '&startAt=' + encodeURIComponent(JSON.stringify(t.toString(36).padStart(9, '0')));
    }
    return q + '&limitToLast=300';
  },

  async onM(type, { path, data }) {
    const parts = path.split('/').filter(Boolean);
    let entries;
    if (!parts.length) entries = Object.entries(data || {});
    else if (parts.length === 1) entries = [[parts[0], data]];
    else entries = [[parts[0], await dbGet(`${this.base()}/m/${encodeURIComponent(parts[0])}`)]];
    const fresh = [];
    for (const [id, v] of entries) {
      if (!v || !v.d || !v.f) continue; // null = fell out of the 300-message window: keep the local copy
      const prev = this.msgs[id];
      if (prev && prev._u === v.u) continue;
      let o; try { o = await decryptObj(Sync.key, v.d); } catch (e) { continue; }
      if (!o || typeof o !== 'object') continue;
      const tk = o.task && typeof o.task === 'object' ? { id: cStr(o.task.id, 80), title: cStr(o.task.title, 2000), due: DAY_RE.test(o.task.due) ? o.task.due : null, time: TIME_RE.test(o.task.time) ? o.task.time : null } : null;
      this.msgs[id] = { id, f: v.f, ts: cNum(o.ts) || v.u, t: cStr(o.t, 20000), fx: FX.valid(o.fx) ? o.fx : null, task: tk, del: !!o.del, _u: v.u, status: 'sent' };
      if (!prev) fresh.push(this.msgs[id]);
    }
    const initial = !this.loaded; this.loaded = true;
    if (fresh.some(m => m.f !== L.auth.uid) && this.partnerTypingUntil) { this.partnerTypingUntil = 0; clearTimeout(this.typingT); }
    this.bump(); this.saveSoon();
    if (typeof ChatUI !== 'undefined') ChatUI.onMessages(fresh, initial);
    this.updateBadge();
  },

  mirror(type, path, data) {
    const set = (parts, v) => {
      let n = this.eTree;
      for (const k of parts.slice(0, -1)) { if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k]; }
      const last = parts[parts.length - 1];
      if (v === null) delete n[last]; else n[last] = v;
    };
    const parts = path.split('/').filter(Boolean);
    if (!parts.length && type === 'put') { this.eTree = data || {}; return; }
    if (type === 'put') return set(parts, data);
    for (const [k, v] of Object.entries(data || {})) set([...parts, ...k.split('/').filter(Boolean)], v);
  },
  async dec(v) {
    if (!v || !v.d) return null;
    if (this.dcache.has(v.d)) return this.dcache.get(v.d);
    try { const o = await decryptObj(Sync.key, v.d); this.dcache.set(v.d, o); return o; } catch (e) { return null; }
  },
  async onE(type, { path, data }) {
    this.mirror(type, path, data);
    const pu = this.partnerUid(), pv = this.eTree.x && this.eTree.x[pu];
    if (pv && pv.d !== this.lastPxD) {
      this.lastPxD = pv.d;
      const px = await this.dec(pv);
      if (px) {
        // a heartbeat we hear live is "now" by our own clock; one from the first snapshot can be old, so trust its time
        const snap = type === 'put' && path.split('/').filter(Boolean).length === 0;
        if ('on' in px) this.presence = { on: !!px.on, at: px.at || 0, beat: snap ? (px.at || 0) : Date.now() };
        const fresh = Math.abs(Date.now() - (px.at || 0)) < 15000; // ignore stale "typing" from long ago
        this.partnerTypingUntil = px.typing && fresh ? Date.now() + 6500 : 0;
        if ((px.read || 0) !== this.partnerRead) { this.partnerRead = px.read || 0; this.partnerReadAt = px.at || Date.now(); }
        clearTimeout(this.typingT);
        if (this.partnerTypingUntil) this.typingT = setTimeout(() => { this.partnerTypingUntil = 0; this.bump(); ChatUI.onState(); }, 6600);
      }
    }
    const mv = this.eTree.x && this.eTree.x[L.auth.uid];
    if (mv && mv.d !== this.lastMxD) {
      this.lastMxD = mv.d;
      const mx = await this.dec(mv);
      if (mx && (mx.read || 0) > this.read) { this.read = mx.read; this.saveSoon(); this.updateBadge(); }
    }
    if (this.xPending) { this.xPending = false; this.writeX(); }
    const before = this.rx, rx = {};
    for (const [mid, byUid] of Object.entries(this.eTree.rx || {})) {
      for (const [uid, v] of Object.entries(byUid || {})) { const o = await this.dec(v); if (o && TAPBACKS.includes(o.r)) (rx[mid] = rx[mid] || {})[uid] = o.r; }
    }
    if (this.loadedE) for (const [mid, by] of Object.entries(rx)) {
      const r = by[pu], m = this.msgs[mid];
      if (r && (!before[mid] || before[mid][pu] !== r) && m && m.f === L.auth.uid && typeof ChatUI !== 'undefined') ChatUI.onPartnerReaction(m, r);
    }
    this.loadedE = true;
    this.rx = rx; this.bump(); this.saveSoon();
    if (typeof ChatUI !== 'undefined') ChatUI.onState();
  },
  partnerTyping() { return this.partnerTypingUntil > Date.now(); },
  // Online = their app is open on screen (a heartbeat every 45 s); otherwise "last seen" is when it last was.
  partnerOnline() { const p = this.presence; return !!p && p.on && Date.now() - p.beat < 100e3; },
  // short and quiet: "last seen just now · 5m ago · 9:41 PM · yesterday · Mon · 22 Oct"
  lastSeenText() {
    const p = this.presence; if (!p || !p.at) return '';
    const t = Math.min(p.at, Date.now()), ago = Date.now() - t;
    if (ago < 60e3) return 'last seen just now';
    if (ago < 3600e3) return `last seen ${Math.floor(ago / 60e3)}m ago`;
    const dt = new Date(t), sod = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((sod(new Date()) - sod(dt)) / 864e5);
    if (days === 0) return `last seen ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (days === 1) return 'last seen yesterday';
    if (days < 7) return `last seen ${dt.toLocaleDateString([], { weekday: 'short' })}`;
    return `last seen ${dt.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  },

  /* ---------- actions ---------- */
  newId() { return Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 7); },
  send({ t = '', fx = null, task = null }) {
    const id = this.newId(), ts = Date.now();
    const m = { id, f: L.auth.uid, ts, t, fx, task, del: false, _u: ts, status: 'sending' };
    this.msgs[id] = m; this.bump(); this.saveSoon();
    if (this.typingOn) this.setTyping(false);
    this.write(m);
    return m;
  },
  async write(m) {
    try {
      const d = await encryptObj(Sync.key, { ts: m.ts, t: m.t, fx: m.fx, task: m.task, del: m.del });
      await dbPut(`${this.base()}/m/${m.id}`, { f: m.f, u: m._u, d });
      m.status = 'sent';
      if (!m.del) this.notifyPartner(m);
    } catch (e) { m.status = 'failed'; }
    this.bump(); this.saveSoon(); ChatUI.onState();
  },
  retry(id) { const m = this.msgs[id]; if (!m) return; m.status = 'sending'; this.bump(); ChatUI.onState(); this.write(m); },
  unsend(id) {
    const m = this.msgs[id]; if (!m || m.f !== L.auth.uid) return;
    Object.assign(m, { del: true, t: '', task: null, fx: null, _u: Date.now(), status: 'sending' });
    this.bump(); this.saveSoon(); ChatUI.onState(); this.write(m);
  },
  async react(id, r) {
    const me = L.auth.uid, cur = (this.rx[id] || {})[me], next = cur === r ? null : r;
    this.rx[id] = this.rx[id] || {};
    if (next) this.rx[id][me] = next; else delete this.rx[id][me];
    this.bump(); ChatUI.onState();
    try { await dbPut(`${this.base()}/e/rx/${id}/${me}`, next ? { u: Date.now(), d: await encryptObj(Sync.key, { r: next }) } : null); } catch (e) { /* retried on next change */ }
  },
  setTyping(on) {
    const now = Date.now();
    if (on && this.typingOn && now - this.typingSentAt < 2500) return;
    if (!on && !this.typingOn) return;
    this.typingOn = on; this.typingSentAt = on ? now : 0;
    this.writeX();
  },
  async writeX(o = {}) {
    if (!this.ready()) return;
    this.xAt = Date.now();
    const on = o.off || document.hidden ? 0 : 1;
    try {
      const d = await encryptObj(Sync.key, { typing: this.typingOn ? 1 : 0, read: this.read, at: Date.now(), on });
      await dbPut(`${this.base()}/e/x/${L.auth.uid}`, { u: Date.now(), d }, o.off ? { keepalive: true } : undefined);
    } catch (e) { /* ignore */ }
  },
  beat() { if (this.ready() && !document.hidden && Date.now() - this.xAt > 40e3) this.writeX(); },
  lastPartnerTs() { const me = L.auth && L.auth.uid; let t = 0; for (const m of Object.values(this.msgs)) if (m.f !== me && m.ts > t) t = m.ts; return t; },
  markRead() {
    const last = this.lastPartnerTs(); if (!last || last <= this.read) return;
    this.read = last; this.bump(); this.saveSoon(); this.writeX(); this.updateBadge();
    const pu = this.partnerUid(); // cancel a pending "new message" push, we've seen it
    if (pu && CFG.vapidPublicKey) dbPatch(`rem/${Sync.space}`, { ['chat_' + pu]: null }).catch(() => {});
  },
  unread() { const me = L.auth && L.auth.uid; return Object.values(this.msgs).filter(m => m.f !== me && !m.del && m.ts > this.read).length; },
  updateBadge() {
    const n = this.ready() ? this.unread() : 0;
    $$('.chat-badge').forEach(b => { b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n; });
    try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) { /* unsupported */ }
  },
  // If push reminders are set up, the GitHub Action also nudges your partner about unread messages (~5 min).
  notifyPartner(m) {
    const pu = this.partnerUid(); if (!pu || !CFG.vapidPublicKey) return;
    const b = m.task ? `Shared a task: ${m.task.title}` : (m.t || '').slice(0, 140);
    encryptObj(Sync.key, { k: 'chat', t: `💬 ${firstWord(myName())}`, b })
      .then(d => dbPatch(`rem/${Sync.space}`, { ['chat_' + L.auth.uid]: { at: Date.now(), to: { [pu]: true }, d, sent: 0 } }))
      .catch(() => {});
  },
};

// (Live keeps the two message streams connected.) Failed sends are retried when the connection comes back.
addEventListener('online', () => { if (Chat.ready()) for (const m of Object.values(Chat.msgs)) if (m.status === 'failed' && m.f === L.auth.uid) Chat.retry(m.id); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Chat.typingOn = false; Chat.writeX({ off: true }); return; }
  Chat.ensure(); Chat.writeX();
});
addEventListener('pagehide', () => Chat.writeX({ off: true }));
setInterval(() => { Chat.beat(); if (typeof ChatUI !== 'undefined' && ChatUI.shown()) ChatUI.subLine(); }, 15000);
