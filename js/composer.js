/* Twodo · the Claude-style composer: type naturally, see what it understood, send */
'use strict';

const Cmp = { el: null, ta: null, chips: null, pills: null, send: null, plus: null, ctx: null, ignored: new Set(), sig: '', blurT: null, ph: 0 };

function composerCtx() {
  const v = topView(), spec = v ? v._spec : { type: 'home' };
  const inbox = D.lists.inbox || { emoji: '📥', name: 'Inbox', color: 'blue' };
  const ctx = { listId: 'inbox', due: null, assignee: null, pinned: false, label: `${inbox.emoji} ${inbox.name}`, color: inbox.color };
  const pick = Cmp.listPick && D.lists[Cmp.listPick] && !D.lists[Cmp.listPick].deleted ? D.lists[Cmp.listPick] : null;
  if (pick) Object.assign(ctx, { listId: pick.id, label: `${pick.emoji} ${pick.name}${pick.private ? ' · secret' : ''}`, color: pick.color });
  else if (spec.type === 'list') {
    const l = D.lists[spec.id]; if (l) Object.assign(ctx, { listId: l.id, label: `${l.emoji} ${l.name}${l.private ? ' · secret' : ''}`, color: l.color });
  }
  if (spec.type === 'list' && !pick) { /* list view sets the list */ } else if (spec.type === 'smart') {
    const extra = { today: ['due', todayStr(), 'Today'], upcoming: ['due', ymd(addDays(new Date(), 1)), 'Tomorrow'], pinned: ['pinned', true, 'Pinned'], us: ['assignee', 'both', 'For both of you'] }[spec.key];
    if (extra) { ctx[extra[0]] = extra[1]; ctx.label += ' · ' + extra[2]; }
  }
  if (spec.type !== 'home' && spec.type !== 'search' && !ctx.assignee) {
    const who = viewPrefs(specKey(spec)).who;
    if (who === 'me') ctx.assignee = L.me;
    else if (who === 'partner') { ctx.assignee = partnerKey(); ctx.label += ` · for ${firstWord(ptName())}`; }
    else if (who === 'both') { ctx.assignee = 'both'; ctx.label += ' · for both'; }
  }
  return ctx;
}
function updateComposerCtx() {
  if (!Cmp.el) return;
  const v = topView();
  Cmp.el.classList.toggle('hide', !v || v._spec.type === 'search' || v.classList.contains('chatview') || v._spec.type === 'tips' || !L.onboarded);
  const c = composerCtx();
  Cmp.ctx.innerHTML = `${esc(c.label)} ${ic('chevD', 'xs')}`;
}

const chipHTML = c => `<button class="chip" type="button" data-k="${c.kind}" style="--c:var(--c-${c.color})" title="Tap to ignore">${c.icon ? ic(c.icon) : ''}${esc(c.label)}</button>`;
function updateComposer() {
  const raw = Cmp.ta.value, lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (!raw.trim()) Cmp.ignored.clear();
  let html = '';
  if (lines.length === 1) {
    const p = parseTask(lines[0], Cmp.ignored);
    html = p.chips.map(chipHTML).join('') + [...Cmp.ignored].map(k => `<button class="chip off" type="button" data-off="${k}" title="Tap to use again">${KIND_LABEL[k]}</button>`).join('');
  } else if (lines.length > 1) {
    html = `<span class="chip" style="--c:var(--accent)">${ic('list')}${lines.length} tasks, one per line</span>`;
  }
  if (html !== Cmp.sig) { Cmp.chips.innerHTML = html; Cmp.sig = html; }
  Cmp.send.classList.toggle('on', lines.length > 0);
  Cmp.send.innerHTML = ic('arrowUp') + (lines.length > 1 ? `<span class="badge">${lines.length}</span>` : '');
  Cmp.ta.style.height = 'auto';
  Cmp.ta.style.height = Math.min(Cmp.ta.scrollHeight, 168) + 'px';
}

function pillsHTML() {
  const pill = (kind, tok, label, icon, color) => `<button class="pill" type="button" data-kind="${kind}" data-tok="${esc(tok)}" style="--c:var(--c-${color})">${ic(icon)}${esc(label)}</button>`;
  const who = (tok, k, label) => `<button class="pill" type="button" data-kind="assignee" data-tok="${esc(tok)}">${k === 'both' ? `<span class="av-pair">${avatar('a')}${avatar('b')}</span>` : avatar(k)}${esc(label)}</button>`;
  const pt = firstWord(ptName());
  return [
    pill('due', 'today', 'Today', 'cal', 'blue'), pill('due', 'tomorrow', 'Tomorrow', 'sunrise', 'orange'),
    pill('due', 'tonight', 'Tonight', 'moon', 'indigo'), pill('due', 'this weekend', 'Weekend', 'sofa', 'teal'),
    pill('due', 'next week', 'Next week', 'calnext', 'purple'),
    who('@us', 'both', 'Us'), who('@' + pt.toLowerCase(), partnerKey(), pt), who('@me', L.me, 'Me'),
    pill('priority', '!!!', 'High', 'flag', 'red'), pill('priority', '!!', 'Medium', 'flag', 'orange'),
    ...lists().filter(l => l.id !== 'inbox').slice(0, 6).map(l => `<button class="pill" type="button" data-kind="list" data-tok="#${esc(l.name.replace(/\s+/g, ''))}">${esc(l.emoji)} ${esc(l.name)}</button>`),
    pill('repeat', 'daily', 'Daily', 'repeat', 'gray'), pill('repeat', 'every week', 'Weekly', 'repeat', 'gray'),
  ].join('');
}
function insertToken(kind, tok) {
  const lines = Cmp.ta.value.split('\n');
  let last = lines.pop() || '';
  const p = parseTask(last, new Set());
  const rawOld = p.raw[kind];
  if (rawOld) { const i = last.toLowerCase().indexOf(rawOld.toLowerCase()); if (i >= 0) last = (last.slice(0, i) + last.slice(i + rawOld.length)).replace(/\s{2,}/g, ' '); }
  last = (last.trimEnd() + ' ' + tok + ' ').replace(/^\s+/, '');
  lines.push(last);
  Cmp.ta.value = lines.join('\n');
  Cmp.ignored.delete(kind);
  Cmp.ta.focus();
  Cmp.ta.setSelectionRange(Cmp.ta.value.length, Cmp.ta.value.length);
  updateComposer(); haptic('light');
}

function submitComposer() {
  const lines = Cmp.ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return;
  const ctx = composerCtx(), created = [];
  for (const line of lines) {
    const p = parseTask(line, lines.length === 1 ? Cmp.ignored : new Set());
    const t = makeTask({
      title: p.title, due: p.due || ctx.due, time: p.time, priority: p.priority || 0, tags: p.tags,
      listId: p.listId || ctx.listId, assignee: p.assignee || ctx.assignee, repeat: p.repeat, pinned: ctx.pinned,
    });
    Fresh.add(t.id); created.push(t);
  }
  Cmp.ta.value = ''; Cmp.ignored.clear(); updateComposer();
  haptic('light'); blip('add');
  renderNow();
  const last = created[created.length - 1];
  const row = topView().querySelector(`.task[data-id="${CSS.escape(last.id)}"]`);
  const undo = () => { created.forEach(t => { t.deleted = true; commit(t, { silent: true }); }); scheduleRender(); };
  if (row) {
    row.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    if (created.length > 1) island({ e: '✨', text: `Added ${created.length} tasks`, btn: 'Undo', onBtn: undo });
  } else {
    const l = listOf(last);
    island({ e: '✨', text: created.length > 1 ? `Added ${created.length} tasks` : `Added to ${l.emoji} ${l.name}`,
      sub: created.length === 1 && (last.due || last.assignee) ? [last.due && fmtDue(last.due, last.time), last.assignee && (last.assignee === 'both' ? 'for both of you' : last.assignee === L.me ? 'for you' : 'for ' + ptName())].filter(Boolean).join(' · ') : '',
      btn: 'Undo', onBtn: undo });
  }
}

function initComposer() {
  Object.assign(Cmp, { el: $('#composer'), ta: $('#cta'), chips: $('#chips'), pills: $('#pills'), send: $('#csend'), plus: $('#cplus'), ctx: $('#cctx') });
  Cmp.plus.innerHTML = ic('plus');
  Cmp.send.innerHTML = ic('arrowUp');
  Cmp.ta.addEventListener('input', updateComposer);
  Cmp.ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitComposer(); }
  });
  Cmp.ta.addEventListener('focus', () => {
    clearTimeout(Cmp.blurT);
    if (!Cmp.el.classList.contains('focus')) { Cmp.pills.innerHTML = pillsHTML(); Cmp.pills.scrollLeft = 0; }
    Cmp.el.classList.add('focus'); closeOpenRow();
  });
  Cmp.ta.addEventListener('blur', () => { Cmp.blurT = setTimeout(() => { if (document.activeElement !== Cmp.ta) Cmp.el.classList.remove('focus'); }, 150); });
  // Keep the keyboard open when tapping pills / buttons inside the composer
  [Cmp.pills, Cmp.chips].forEach(el => el.addEventListener('mousedown', e => e.preventDefault()));
  Cmp.pills.addEventListener('click', e => { const b = e.target.closest('.pill'); if (b) insertToken(b.dataset.kind, b.dataset.tok); });
  Cmp.chips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.k) Cmp.ignored.add(b.dataset.k); else if (b.dataset.off) Cmp.ignored.delete(b.dataset.off); else return;
    haptic('light'); updateComposer();
  });
  tapKeep(Cmp.send, () => { submitComposer(); }, Cmp.ta);
  // Tap the list name under the text box to choose where new tasks go
  Cmp.ctx.setAttribute('role', 'button'); Cmp.ctx.setAttribute('tabindex', '0'); Cmp.ctx.style.cursor = 'pointer';
  Cmp.ctx.addEventListener('mousedown', e => e.preventDefault());
  Cmp.ctx.addEventListener('click', () => {
    const cur = composerCtx().listId;
    showMenu({ rect: Cmp.ctx.getBoundingClientRect(), html: `<div class="mrow"><span class="lbl" style="width:auto">Add new tasks to</span></div>` +
      lists().map(l => `<button class="mi" data-m="pick" data-v="${esc(l.id)}" type="button"><span>${esc(l.emoji)} ${esc(l.name)}</span>${l.id === cur ? ic('check', 'ck') : ''}</button>`).join(''),
      onPick: (m, v) => { Cmp.listPick = v; updateComposerCtx(); haptic('light'); } });
  });
  Cmp.plus.addEventListener('click', () => { if (Cmp.el.classList.contains('focus')) Cmp.ta.blur(); else Cmp.ta.focus(); });
  new ResizeObserver(() => $('#app').style.setProperty('--composer-h', Cmp.el.offsetHeight + 'px')).observe(Cmp.el);

  // Rotating placeholder that teaches the syntax
  setInterval(() => {
    if (document.activeElement === Cmp.ta || Cmp.ta.value) return;
    const pt = firstWord(ptName()) || 'partner';
    const ex = ['Add a task…', 'Try “Call mom tomorrow 6pm”', `Try “Movie night fri 8pm @us !!”`, 'Try “Milk #Groceries”',
      'Try “Gym every mon 7am”', `Try “Book flights @${pt.toLowerCase()} !!!”`, 'Paste a list: one task per line'];
    Cmp.ph = (Cmp.ph + 1) % ex.length; Cmp.ta.placeholder = ex[Cmp.ph];
  }, 4500);
}
