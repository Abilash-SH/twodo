/* Twodo · Messages (UI): iMessage-style chat with your partner */
'use strict';

const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
function jumboCount(t) {
  const s = String(t || '').trim();
  if (!s || s.length > 40 || /[0-9#*]/.test(s) || !/\p{Extended_Pictographic}/u.test(s)) return 0;
  if (!/^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+$/u.test(s)) return 0;
  const n = graphemes ? [...graphemes.segment(s.replace(/\s+/g, ''))].length : 1;
  return n <= 3 ? n : 0;
}
const linkify = s => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
function chatTime(ts) {
  const d = new Date(ts), diff = dayDiff(todayStr(), ymd(d)), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? d.toLocaleDateString([], { weekday: 'long' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
  return `<b>${esc(day)}</b> ${esc(t)}`;
}
function chatSound(kind) {
  if (!L.settings.sounds) return;
  if (kind !== 'send') return blip('pop');
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(360, t); o.frequency.exponentialRampToValueAtTime(1350, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.2);
  } catch (e) { /* ignore */ }
}

const ChatUI = {
  view: null, lastVer: -1, animUntil: 0, drawR: 0, lp: null, lastTap: { id: null, t: 0 }, nearBottom: true,

  isOpen() { const v = topView(); return !!(v && v._spec.type === 'chat' && !document.hidden); },
  open() {
    if (!cloudReady()) return island({ e: '💬', text: 'Messages need accounts turned on', sub: 'See README → accounts & sync' });
    if (!Auth.user()) return openSettings();
    if (!(L.pair && L.pair.status === 'paired')) { island({ e: '💌', text: 'Add your partner to start chatting', ms: 2500 }); return openInviteSheet(); }
    if (topView()._spec.type !== 'chat') pushView({ type: 'chat' });
    Chat.ensure();
    this.draw({ toBottom: true });
    Chat.markRead(); this.playPending();
  },

  /* ---------- markup ---------- */
  build(v) {
    v.classList.add('chatview');
    v.innerHTML = `
      <div class="chatbody"><div class="chatlist"></div><div class="c-typing"></div></div>
      <header class="nav chat-nav"><div class="nav-side l"><button class="nav-btn back" data-a="back" type="button">${ic('chevL')}<span class="chat-badge" hidden></span></button></div>
        <div class="chat-who"><span class="av-slot"></span><span class="nm"></span></div><div class="nav-side r"></div></header>
      <button class="c-jump" type="button" hidden>${ic('chevD', 'xs')} New message</button>
      <div class="chatbar">
        <button class="cb-plus" type="button" aria-label="Share a task">${ic('plus')}</button>
        <div class="cb-pill"><textarea class="cb-in" rows="1" placeholder="Message" aria-label="Message" enterkeyhint="${isTouch ? 'enter' : 'send'}"></textarea>
          <button class="cb-heart" type="button" aria-label="Send a heart">❤️</button>
          <button class="cb-send" type="button" aria-label="Send. Hold for effects">${ic('arrowUp')}</button></div>
      </div>`;
    this.bind(v);
  },
  render(v) {
    this.view = v;
    const p = person(partnerKey());
    v.querySelector('.av-slot').innerHTML = avatar(partnerKey());
    v.querySelector('.nm').innerHTML = `${esc(p.name)} ${ic('chevR', 'xs')}`;
    if (this.lastVer !== Chat.ver || v.querySelector('.tcard')) this.queueDraw();
    Chat.updateBadge();
  },
  // A row is its class list (grouping, which changes as messages arrive) plus its content; keeping them apart lets
  // the list update a row's tail without rebuilding it, so running animations aren't cut short.
  rowParts(m, mine, start, end) {
    const side = mine ? 'me' : 'them';
    if (m.del) return { cls: `msg-row ${side} start end`, h: `<div class="unsent">${mine ? 'You' : esc(firstWord(ptName()))} unsent a message</div>` };
    let inner; const n = !m.task && m.fx !== 'ink' ? jumboCount(m.t) : 0;
    if (m.task) inner = this.cardHTML(m.task, mine);
    else if (n) inner = `<div class="jumbo n${n}">${esc(m.t)}</div>`;
    else inner = `<div class="bub ${side}${m.fx === 'ink' ? ' ink' : ''}">${linkify(esc(m.t))}</div>`;
    const rs = Object.entries(Chat.rx[m.id] || {});
    const tb = rs.length ? `<div class="tapb">${rs.map(([uid, e]) => `<span class="${uid === L.auth.uid ? 'mine' : ''}">${e}</span>`).join('')}</div>` : '';
    const fail = m.status === 'failed' ? `<button class="c-fail" data-retry="${m.id}" type="button" aria-label="Retry sending">!</button>` : '';
    return { cls: `msg-row ${side}${start ? ' start' : ''}${end ? ' end' : ''}${rs.length ? ' has-tb' : ''}`, h: `${fail}<div class="bwrap">${inner}${tb}</div>` };
  },
  cardHTML(tk, mine) {
    const t = D.tasks[tk.id], live = t && !t.deleted ? t : null, done = !!(live && live.done);
    const title = live ? live.title : tk.title, due = live ? fmtDue(live.due, live.time) : fmtDue(tk.due, tk.time);
    return `<div class="tcard ${mine ? 'me' : 'them'}${done ? ' done' : ''}${live ? '' : ' gone'}" data-task="${esc(tk.id)}">
      <div class="tc-h">${ic('list', 'xs')} Shared task</div>
      <div class="tc-b"><button class="tc-chk" data-taskchk="${esc(tk.id)}" type="button" aria-label="Complete task">${ic('check')}</button>
        <div><div class="tc-t">${esc(title)}</div>${due ? `<div class="tc-m">${ic('cal', 'xs')} ${esc(due)}</div>` : ''}</div></div></div>`;
  },
  statusParts(m) {
    if (m.status === 'failed') return { cls: 'c-status fail', h: 'Not Delivered' };
    if (m.status === 'sending') return { cls: 'c-status', h: Date.now() - m.ts < 900 ? '&nbsp;' : 'Sending…' }; // no flicker on a fast send
    if (Chat.partnerRead >= m.ts) return { cls: 'c-status', h: `<b>Read</b> ${esc(new Date(Chat.partnerReadAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}` };
    return { cls: 'c-status', h: 'Delivered' };
  },
  // Everything the list shows, in order, as keyed items: [{ k, cls, h, id? }]
  items() {
    const me = L.auth.uid, ms = Object.values(Chat.msgs).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (!ms.length) {
      const pn = firstWord(ptName());
      return [{ k: 'empty', cls: 'c-empty', h: `<span class="av big" style="--c:var(--c-${person(partnerKey()).color})">${esc(initial(ptName()))}</span>
        <h3>${esc(ptName())}</h3><p>Messages are end-to-end encrypted.<br>Only you and ${esc(pn)} can read them.</p>
        <div class="c-quick">${['👋 Hi!', '❤️', 'Miss you 🥺', 'What’s for dinner?'].map(q => `<button type="button" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>` }];
    }
    const out = []; let prev = null;
    const lastMine = [...ms].reverse().find(m => m.f === me && !m.del), last = ms[ms.length - 1];
    ms.forEach((m, i) => {
      const next = ms[i + 1], brk = !prev || m.ts - prev.ts > 3600e3;
      if (brk) out.push({ k: 't' + m.id, cls: 'c-time', h: chatTime(m.ts) });
      const start = brk || prev.f !== m.f || m.ts - prev.ts > 120e3 || prev.del || m.del;
      const end = !next || next.f !== m.f || next.ts - m.ts > 120e3 || next.del || m.del;
      out.push({ k: m.id, id: m.id, ...this.rowParts(m, m.f === me, start, end) });
      if (m === lastMine && (m === last || m.status !== 'sent')) out.push({ k: 's' + m.id, ...this.statusParts(m) });
      prev = m;
    });
    return out;
  },
  mk(it) { const el = document.createElement('div'); el._k = it.k; el._h = it.h; el.className = it.cls; el.innerHTML = it.h; if (it.id) el.dataset.id = it.id; return el; },
  // Update the list in place: untouched rows stay (with their animations and ink), changed rows are swapped,
  // new ones inserted. Returns the elements that were created.
  reconcile(list, items) {
    const old = new Map(), keep = new Set(), fresh = [];
    for (const el of list.children) if (el._k) old.set(el._k, el);
    let pos = list.firstElementChild;
    for (const it of items) {
      let el = old.get(it.k);
      if (el && el._h !== it.h) { const n = this.mk(it); el.replaceWith(n); if (pos === el) pos = n; el = n; fresh.push(n); }
      else if (!el) { el = this.mk(it); fresh.push(el); }
      if (el.className !== it.cls) el.className = it.cls;
      keep.add(el);
      if (el === pos) pos = pos.nextElementSibling; else list.insertBefore(el, pos);
    }
    for (const el of [...list.children]) if (!keep.has(el)) el.remove();
    return fresh;
  },
  typingHTML() {
    return Chat.partnerTyping() ? `<div class="msg-row them start end"><div class="bwrap"><div class="bub them typing"><i></i><i></i><i></i></div></div></div>` : '';
  },

  /* ---------- drawing ---------- */
  queueDraw() {
    if (this.drawR) return;
    this.drawR = requestAnimationFrame(() => { this.drawR = 0; this.draw(); });
  },
  draw(opts = {}) {
    const v = this.view; if (!v || !v.isConnected) return;
    if (this.drawR) { cancelAnimationFrame(this.drawR); this.drawR = 0; }
    const body = v.querySelector('.chatbody'), list = v.querySelector('.chatlist');
    const near = body.scrollHeight - body.scrollTop - body.clientHeight < 140;
    const fresh = this.reconcile(list, this.items());
    this.drawTyping(false);
    this.lastVer = Chat.ver;
    fresh.forEach(el => el.querySelectorAll('.bub.ink').forEach(b => Ink.attach(b)));
    if (opts.toBottom || opts.sentId || near) body.scrollTop = body.scrollHeight;
    if (opts.sentId) this.animateSent(opts.sentId, opts.fromRect);
    for (const id of opts.newIds || []) this.animateIn(id);
    if ((opts.newIds || []).length && !near) v.querySelector('.c-jump').hidden = false;
  },
  drawTyping(scroll = true) {
    const v = this.view; if (!v || !v.isConnected) return;
    const box = v.querySelector('.c-typing'), html = this.typingHTML();
    if ((box.innerHTML !== '') === !!html) return;
    const body = v.querySelector('.chatbody'), near = body.scrollHeight - body.scrollTop - body.clientHeight < 140;
    box.innerHTML = html;
    const b = box.querySelector('.bwrap'); if (b) playBubbleFx(b, 'pop');
    if (scroll && near) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  },
  el(id) { return this.view && this.view.querySelector(`.msg-row[data-id="${CSS.escape(id)}"] .bwrap`); },
  center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  animateSent(id, from) {
    const el = this.el(id), m = Chat.msgs[id]; if (!el || !m) return;
    const body = this.view.querySelector('.chatbody');
    this.animUntil = Date.now() + 900;
    if (m.fx && FX.isBubble(m.fx) && m.fx !== 'ink') { playBubbleFx(el, m.fx, body); this.animUntil = Date.now() + 2700; }
    else if (from && !reducedMotion.matches) {
      const to = el.getBoundingClientRect();
      el.animate([{ transform: `translate(${from.left + 6 - to.left}px, ${from.bottom - to.bottom}px) scale(.96)`, opacity: 0.6 },
        { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.22,.95,.3,1.08)' });
    }
    if (m.fx && !FX.isBubble(m.fx)) setTimeout(() => playScreenFx(m.fx, { from: this.center(el), text: m.t, mine: true }), 300);
  },
  animateIn(id) {
    const el = this.el(id), m = Chat.msgs[id]; if (!el || !m) return;
    if (m.fx && !Chat.played[id]) { Chat.played[id] = 1; Chat.saveSoon(); this.playFx(m, el); }
    else playBubbleFx(el, 'pop');
  },
  playFx(m, el) {
    if (FX.isBubble(m.fx)) { if (m.fx === 'ink') playBubbleFx(el, 'pop'); else { playBubbleFx(el, m.fx, this.view.querySelector('.chatbody')); this.animUntil = Date.now() + 2700; } }
    else { playBubbleFx(el, 'pop'); setTimeout(() => playScreenFx(m.fx, { from: this.center(el), text: m.t, mine: m.f === L.auth.uid }), 250); }
  },
  // When the chat opens, play the effect of the newest unseen message from your partner (like iMessage)
  playPending() {
    const me = L.auth.uid, cand = Object.values(Chat.msgs).filter(m => m.f !== me && m.fx && !m.del && !Chat.played[m.id] && Date.now() - m.ts < 864e5).sort((a, b) => (a.id < b.id ? -1 : 1));
    cand.forEach(m => { Chat.played[m.id] = 1; }); Chat.saveSoon();
    const m = cand[cand.length - 1]; if (!m) return;
    setTimeout(() => { const el = this.el(m.id); if (el) this.playFx(m, el); }, 450);
  },

  /* ---------- events from the data layer ---------- */
  onMessages(fresh, initial) {
    const me = L.auth.uid, incoming = fresh.filter(m => m.f !== me && !m.del);
    if (this.isOpen()) {
      this.draw({ newIds: initial ? [] : incoming.map(m => m.id) });
      if (incoming.length && !initial) { chatSound('recv'); haptic('light'); }
      Chat.markRead(); if (initial) this.playPending();
    } else if (!initial && incoming.length) {
      const m = incoming[incoming.length - 1];
      island({ e: '💬', text: `${firstWord(ptName())}: ${m.task ? '📋 ' + m.task.title : m.t}`, sub: m.fx ? `Sent with ${(FX.bubble.concat(FX.screen).find(f => f[0] === m.fx) || [, 'an effect'])[1]}` : '', btn: 'Reply', onBtn: () => this.open(), ms: 4500 });
      blip('pop'); haptic('light');
    }
  },
  onState() {
    if (!this.isOpen()) return;
    this.drawTyping();
    if (this.lastVer !== Chat.ver) this.queueDraw();
  },
  onPartnerReaction(m, r) {
    if (this.isOpen()) return;
    island({ e: r, text: `${firstWord(ptName())} reacted to “${(m.t || (m.task && m.task.title) || 'your message').slice(0, 40)}”`, btn: 'Open', onBtn: () => this.open() });
  },

  /* ---------- input ---------- */
  sendNow(text, fx = null, task = null) {
    const v = this.view; if (!v) return;
    const input = v.querySelector('.cb-in');
    text = String(text || '').trim();
    if (!text && !task) return;
    if (!Chat.ready()) return island({ e: '⚠️', text: 'Not connected yet', sub: 'Check you’re online and paired' });
    if (!fx && text) fx = autoFx(text);
    const from = input.getBoundingClientRect();
    const m = Chat.send({ t: text, fx, task });
    Chat.played[m.id] = 1;
    if (!task) { input.value = ''; this.autosize(input); }
    this.draw({ sentId: m.id, fromRect: from });
    setTimeout(() => { if (m.status === 'sending') this.queueDraw(); }, 950);
    chatSound('send'); haptic('light');
  },
  autosize(input) {
    input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    input.closest('.cb-pill').classList.toggle('has', !!input.value.trim());
  },
  bind(v) {
    const body = v.querySelector('.chatbody'), list = v.querySelector('.chatlist'), input = v.querySelector('.cb-in');
    const send = v.querySelector('.cb-send'), heart = v.querySelector('.cb-heart'), plus = v.querySelector('.cb-plus'), jump = v.querySelector('.c-jump');
    [send, heart, plus].forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    input.addEventListener('input', () => { this.autosize(input); Chat.setTyping(!!input.value.trim()); });
    input.addEventListener('blur', () => Chat.setTyping(false));
    input.addEventListener('focus', () => setTimeout(() => { body.scrollTop = body.scrollHeight; }, 300));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) { e.preventDefault(); this.sendNow(input.value); } });
    // tap = send, hold = "Send with effect"
    let held = false, holdT = null;
    send.addEventListener('pointerdown', () => { held = false; holdT = setTimeout(() => { held = true; haptic('medium'); this.openFxPicker(input.value.trim()); }, 450); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => send.addEventListener(ev, () => clearTimeout(holdT)));
    send.addEventListener('click', () => { if (held) { held = false; return; } this.sendNow(input.value); });
    send.addEventListener('contextmenu', e => e.preventDefault());
    heart.addEventListener('click', () => this.sendNow('❤️', 'love'));
    plus.addEventListener('click', () => this.openShare(plus));
    jump.addEventListener('click', () => { body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }); });
    body.addEventListener('scroll', () => {
      const near = body.scrollHeight - body.scrollTop - body.clientHeight < 140;
      if (near) { jump.hidden = true; if (document.activeElement !== input || true) Chat.markRead(); }
      v.querySelector('.chat-nav').classList.toggle('scrolled', true);
    }, { passive: true });
    if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (this.isOpen() && this.nearBottom) body.scrollTop = body.scrollHeight; });
    body.addEventListener('scroll', () => { this.nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 140; }, { passive: true });

    // bubbles: tap ink to reveal, double-tap = ❤️, long-press = tapbacks + menu
    list.addEventListener('click', e => {
      const q = e.target.closest('[data-quick]'); if (q) return this.sendNow(q.dataset.quick, q.dataset.quick === '❤️' ? 'love' : null);
      const r = e.target.closest('[data-retry]'); if (r) return Chat.retry(r.dataset.retry);
      const chk = e.target.closest('[data-taskchk]');
      if (chk) { const t = D.tasks[chk.dataset.taskchk]; if (t) { toggleDone(t.id, { instant: true }); setTimeout(() => this.queueDraw(), 100); } return; }
      if (performance.now() < (this.suppressUntil || 0)) return;
      const ink = e.target.closest('.bub.ink'); if (ink) { Ink.reveal(ink); return; }
      const card = e.target.closest('.tcard');
      const row = e.target.closest('.msg-row'); if (!row) return;
      const now = performance.now();
      if (this.lastTap.id === row.dataset.id && now - this.lastTap.t < 320) { this.lastTap = { id: null, t: 0 }; this.quickHeart(row); return; }
      this.lastTap = { id: row.dataset.id, t: now };
      if (card) setTimeout(() => { if (this.lastTap.id === row.dataset.id && D.tasks[card.dataset.task]) openTaskSheet(card.dataset.task); }, 330);
    });
    list.addEventListener('pointerdown', e => {
      const w = e.target.closest('.bwrap'); if (!w || e.target.closest('button')) return;
      const x0 = e.clientX, y0 = e.clientY;
      clearTimeout(this.lp);
      this.lp = setTimeout(() => { this.suppressUntil = performance.now() + 700; this.openBubbleMenu(w.closest('.msg-row')); }, 450);
      const cancel = ev => { if (!ev.clientX || Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { clearTimeout(this.lp); off(); } };
      const off = () => { removeEventListener('pointermove', cancel); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); };
      const end = () => { clearTimeout(this.lp); off(); };
      addEventListener('pointermove', cancel); addEventListener('pointerup', end); addEventListener('pointercancel', end);
    });
    list.addEventListener('contextmenu', e => { const row = e.target.closest('.msg-row'); if (!row) return; e.preventDefault(); if (!isTouch) this.openBubbleMenu(row); });
  },
  quickHeart(row) {
    const id = row.dataset.id, m = Chat.msgs[id]; if (!m || m.del) return;
    Chat.react(id, '❤️'); haptic('success');
    const w = row.querySelector('.bwrap'), h = document.createElement('div'); h.className = 'c-pop-heart'; h.textContent = '❤️'; w.appendChild(h);
    h.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-90%) scale(1)', opacity: 0 }],
      { duration: 800, easing: 'cubic-bezier(.34,1.56,.64,1)' }).onfinish = () => h.remove();
  },
  openBubbleMenu(row) {
    if (!row) return;
    const id = row.dataset.id, m = Chat.msgs[id]; if (!m || m.del) return;
    const mine = m.f === L.auth.uid, myR = (Chat.rx[id] || {})[L.auth.uid], w = row.querySelector('.bwrap');
    haptic('medium');
    const items = [];
    if (m.t) items.push(['copy', 'Copy', 'copy']);
    if (m.t) items.push(['task', 'Make it a task', 'check']);
    if (m.task && D.tasks[m.task.id]) items.push(['open', 'Open task', 'list']);
    if (mine && m.status === 'failed') items.push(['retry', 'Try again', 'repeat']);
    if (mine && m.status === 'sent' && Date.now() - m.ts < 15 * 60e3) items.push(['unsend', 'Undo Send', 'trash']);
    const html = `<div class="mpal tbp">${TAPBACKS.map(e => `<button data-m="react" data-v="${e}" class="${myR === e ? 'on' : ''}" type="button"><span>${e}</span></button>`).join('')}</div>` +
      (items.length ? '<div class="mgap"></div>' + items.map(([k, label, icon]) => `<button class="mi${k === 'unsend' ? ' red' : ''}" data-m="${k}" type="button">${label}${ic(icon)}</button>`).join('') : '');
    showMenu({
      rect: w.getBoundingClientRect(), preview: `<div class="msg-row ${mine ? 'me' : 'them'} end bare">${w.outerHTML}</div>`, html, align: mine ? 'right' : 'left',
      onPick: async (k, val) => {
        if (k === 'react') return Chat.react(id, val);
        if (k === 'copy') { if (await copyText(m.t)) island({ e: '📋', text: 'Copied', ms: 1200 }); return; }
        if (k === 'open') return openTaskSheet(m.task.id);
        if (k === 'retry') return Chat.retry(id);
        if (k === 'unsend') {
          const el = this.el(id);
          if (el && !reducedMotion.matches) el.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(.6)', opacity: 0, filter: 'blur(6px)' }], { duration: 350, easing: 'ease-in', fill: 'forwards' });
          setTimeout(() => Chat.unsend(id), 330); return;
        }
        if (k === 'task') {
          const p = parseTask(m.t);
          const t = makeTask({ title: p.title, due: p.due, time: p.time, priority: p.priority || 0, tags: p.tags, listId: p.listId || 'inbox', assignee: p.assignee || L.me, repeat: p.repeat });
          island({ e: '✅', text: `Added “${t.title}”`, sub: p.due ? fmtDue(t.due, t.time) : 'to your Inbox', btn: 'Open', onBtn: () => openTaskSheet(t.id) });
        }
      },
    });
    const pv = Menu.el.querySelector('.mprev'); if (pv) pv.classList.add('bare');
  },
  openShare(btn) {
    const ts = sortTasks(liveTasks().filter(t => !t.done && !Sync.isPrivate(t))).slice(0, 14);
    if (!ts.length) return island({ e: '📋', text: 'No open tasks to share', ms: 1800 });
    showMenu({
      rect: btn.getBoundingClientRect(),
      html: `<div class="mrow"><span class="lbl" style="width:auto">Share a task</span></div>` + ts.map(t => `<button class="mi" data-m="share" data-v="${esc(t.id)}" type="button"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</span><span class="val" style="font-size:13px">${esc(fmtDue(t.due, t.time))}</span></button>`).join(''),
      onPick: (k, id) => { const t = D.tasks[id]; if (t) this.sendNow('', null, { id, title: t.title, due: t.due, time: t.time }); },
    });
  },

  /* ---------- "Send with effect" ---------- */
  openFxPicker(text) {
    if (!text) { island({ e: '✨', text: 'Type a message first', sub: 'Then hold ↑ to pick an effect', ms: 2000 }); return; }
    const o = document.createElement('div'); o.className = 'fxp'; document.body.append(o);
    let tab = 'bubble', sel = null;
    const rows = () => FX[tab].map(([k, l]) => `<button class="fxp-row${sel === k ? ' on' : ''}" data-fx="${k}" type="button"><span>${l}</span><span class="fxp-go" data-go="${k}">${ic('arrowUp')}</span></button>`).join('');
    o.innerHTML = `<div class="fxp-bg"></div><div class="fxp-top"><h3>Send with effect</h3>${segHTML('fxtab', [['bubble', 'Bubble'], ['screen', 'Screen']], 'bubble')}</div>
      <div class="fxp-list">${rows()}</div>
      <div class="fxp-prev"><div class="bwrap"><div class="bub me">${linkify(esc(text))}</div></div></div>
      <button class="fxp-x" type="button" aria-label="Cancel">${ic('x')}</button>`;
    requestAnimationFrame(() => o.classList.add('on'));
    const list = o.querySelector('.fxp-list'), prev = o.querySelector('.fxp-prev .bwrap');
    const close = () => { o.classList.remove('on'); setTimeout(() => o.remove(), 320); delete SegHandlers.fxtab; };
    SegHandlers.fxtab = val => { tab = val; sel = null; list.innerHTML = rows(); haptic('light'); };
    o.querySelector('.fxp-x').addEventListener('click', close);
    o.querySelector('.fxp-bg').addEventListener('click', close);
    list.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (go && sel === go.dataset.go) { close(); this.sendNow(text, sel); return; }
      const r = e.target.closest('[data-fx]'); if (!r) return;
      sel = r.dataset.fx; list.innerHTML = rows(); haptic('light');
      const b = prev.querySelector('.bub'); b.classList.toggle('ink', sel === 'ink'); b.querySelector('canvas') && b.querySelector('canvas').remove(); delete b._ink; b.classList.remove('inked', 'revealed');
      if (sel === 'ink') Ink.attach(b);
      else if (FX.isBubble(sel)) playBubbleFx(prev, sel, null);
      else playScreenFx(sel, { from: this.center(prev), text, mine: true });
    });
  },
};
