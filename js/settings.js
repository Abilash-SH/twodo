/* Twodo · settings, couple sync setup, backup */
'use strict';

function personCardHTML(k) {
  const p = person(k);
  return `<div class="person" data-k="${k}">${k === L.me ? '<span class="tag-me">This phone</span>' : ''}
    <span class="av" style="--c:var(--c-${p.color})">${esc(initial(p.name))}</span>
    <input value="${esc(p.name)}" data-pn="${k}" maxlength="24" aria-label="Name">
    <div class="colors sm">${PALETTE.slice(0, 10).map(c => `<button type="button" data-pc="${c}" style="--c:var(--c-${c})" class="${c === p.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div></div>`;
}

function syncGroupHTML() {
  const sq = (c, i) => `<span class="sq" style="--c:var(--c-${c})">${ic(i)}</span>`;
  if (!Sync.enabled()) return `
    <div class="group">
      <div class="cell">${sq('orange', 'cloud')}<input class="inp" id="sUrl" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://your-app-default-rtdb.firebaseio.com" value="${esc(L.sync.url)}" aria-label="Firebase database URL"></div>
      <button class="cell" data-x="create" type="button">${sq('green', 'plus')}<span class="grow">Create our shared space</span>${ic('chevR', 'chev')}</button>
      <button class="cell" data-x="joinshow" type="button">${sq('pink', 'heart')}<span class="grow">Join ${esc(firstWord(ptName()))}’s space</span>${ic('chevR', 'chev')}</button>
      <div class="cell" id="sJoinRow" hidden>${sq('indigo', 'key')}<input class="inp" id="sCode" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="Pair code" aria-label="Pair code"><button class="btn-s" data-x="join" type="button">Join</button></div>
    </div>
    <p class="note-s">Free and private. Make a Firebase Realtime Database (2 minutes, see the README), paste its URL, then invite ${esc(firstWord(ptName()))}. Tasks are encrypted on your phones — the server only stores gibberish.</p>`;
  return `
    <div class="group">
      <div class="cell">${sq(Sync.state === 'live' ? 'green' : Sync.state === 'error' ? 'red' : 'orange', 'cloud')}<span class="grow status ${Sync.state}"><i></i>${esc(Sync.label())}</span></div>
      <button class="cell" data-x="invite" type="button">${sq('pink', 'share')}<span class="grow">Invite ${esc(firstWord(ptName()))}</span>${ic('chevR', 'chev')}</button>
      <button class="cell" data-x="copycode" type="button">${sq('indigo', 'key')}<span class="grow code-box">${esc(L.sync.code)}</span><span class="val">Copy</span></button>
      <button class="cell" data-x="resync" type="button">${sq('blue', 'repeat')}<span class="grow">Sync now</span></button>
      <button class="cell red" data-x="disconnect" type="button">Stop syncing on this phone</button>
    </div>
    <p class="note-s">🔒 End-to-end encrypted (AES-256-GCM). Anyone with the invite link or code can join, so only send it to ${esc(firstWord(ptName()))}. Secret lists never leave this phone.</p>`;
}
function updateSyncUI() {
  const g = $('#syncWrap'); if (g) g.innerHTML = syncGroupHTML();
}

function openSettings() {
  const s = L.settings;
  const sq = (c, i) => `<span class="sq" style="--c:var(--c-${c})">${ic(i)}</span>`;
  const sw = (key, label, c, i) => `<div class="cell">${sq(c, i)}<span class="grow">${label}</span><input type="checkbox" class="switch" data-set="${key}" ${s[key] ? 'checked' : ''} aria-label="${label}"></div>`;
  const notifyNote = isIOS && !standalone() ? 'On iPhone, reminders need Twodo added to your Home Screen first.' : 'Reminders pop up while Twodo is open or recently used. For alerts that always fire, use “Add to Calendar” on a task.';
  const body = `
    <div class="couple" id="couple">${personCardHTML('a')}${personCardHTML('b')}</div>
    <div class="group"><div class="cell">${sq('gray', 'phone')}<span class="grow">I am</span>${segHTML('me', [['a', esc(shortName(person('a').name))], ['b', esc(shortName(person('b').name))]], L.me)}</div></div>

    <div class="sec-h sub">Appearance</div>
    <div class="group">
      <div class="cell">${sq('indigo', 'sun')}<span class="grow">Theme</span>${segHTML('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}</div>
      <div class="cell noico" style="flex-direction:column;align-items:stretch;gap:0"><span style="padding-top:6px">Accent colour</span>
        <div class="colors accents" id="accents" style="padding:12px 0 8px"><button type="button" data-ac="me" style="--c:var(--c-${person(L.me).color});background:conic-gradient(var(--c-${person(L.me).color}) 0 50%, var(--c-${person(partnerKey()).color}) 0)" class="${s.accent === 'me' ? 'on' : ''}" aria-label="My colour"></button>${
          PALETTE.slice(0, 8).map(c => `<button type="button" data-ac="${c}" style="--c:var(--c-${c})" class="${s.accent === c ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div></div>
    </div>

    <div class="sec-h sub">Feel</div>
    <div class="group">
      ${sw('haptics', 'Haptics', 'pink', 'hand')}
      ${sw('sounds', 'Sounds', 'orange', 'bell')}
      ${sw('confetti', 'Celebrations', 'purple', 'sparkles')}
      ${sw('notify', 'Reminders', 'red', 'clock')}
      <div class="cell">${sq('blue', 'cal')}<span class="grow">5/12 is</span>${segHTML('dmy', [['dmy', '5 Dec'], ['mdy', 'May 12']], s.dmy ? 'dmy' : 'mdy')}</div>
    </div>
    <p class="note-s">${esc(notifyNote)}</p>

    <div class="sec-h sub">Sync with ${esc(firstWord(ptName()))}</div>
    <div id="syncWrap">${syncGroupHTML()}</div>

    <div class="sec-h sub">Backup</div>
    <div class="group">
      <button class="cell" data-x="export" type="button">${sq('green', 'download')}<span class="grow">Export backup</span></button>
      <button class="cell" data-x="import" type="button">${sq('blue', 'upload')}<span class="grow">Import backup</span></button>
      <button class="cell red" data-x="reset" type="button">Erase everything on this phone</button>
    </div>

    <div class="sec-h sub">Tips</div>
    <div class="group kbd-list">
      <div class="cell noico">👉 Swipe right to complete · left to pin or delete</div>
      <div class="cell noico">👆 Long-press a task for quick actions</div>
      <div class="cell noico">↩️ Swipe from the left edge to go back</div>
      <div class="cell noico">⌨️ <span>Type <kbd>tomorrow 6pm</kbd> <kbd>!!</kbd> <kbd>@us</kbd> <kbd>#Groceries</kbd> <kbd>every mon</kbd></span></div>
      <div class="cell noico">🧩 Tap a chip in the composer to ignore it</div>
      <div class="cell noico">💻 <span><kbd>N</kbd> new task · <kbd>⌘K</kbd> search · <kbd>Esc</kbd> back</span></div>
    </div>
    <div class="foot">Twodo 1.0 · made for two 💞</div>`;

  openSheet({
    title: 'Settings', body, tall: true,
    onMount: sh => {
      const couple = sh.querySelector('#couple');
      couple.addEventListener('input', e => {
        const k = e.target.dataset.pn; if (!k) return;
        const name = e.target.value.trim(); if (!name) return;
        D.people[k] = { ...person(k), name }; commit(D.people);
        e.target.closest('.person').querySelector('.av').textContent = initial(name);
      });
      couple.addEventListener('click', e => {
        const b = e.target.closest('[data-pc]'); if (!b) return;
        const k = b.closest('.person').dataset.k;
        D.people[k] = { ...person(k), color: b.dataset.pc }; commit(D.people);
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        b.closest('.person').querySelector('.av').style.setProperty('--c', `var(--c-${b.dataset.pc})`);
        applyTheme(); haptic('light');
      });
      sh.querySelector('#accents').addEventListener('click', e => {
        const b = e.target.closest('[data-ac]'); if (!b) return;
        L.settings.accent = b.dataset.ac; save(); applyTheme(); haptic('light');
        $$('#accents button', sh).forEach(x => x.classList.toggle('on', x === b));
      });
      sh.querySelectorAll('[data-set]').forEach(inp => inp.addEventListener('change', async () => {
        const key = inp.dataset.set;
        if (key === 'notify' && inp.checked) {
          if (!('Notification' in window)) { inp.checked = false; island({ e: '🔕', text: 'Notifications aren’t available here', sub: isIOS ? 'Add Twodo to your Home Screen first' : '' }); return; }
          const p = await Notification.requestPermission();
          if (p !== 'granted') { inp.checked = false; island({ e: '🔕', text: 'Notifications are blocked', sub: 'Allow them in your browser settings' }); return; }
          sysNotify('Reminders are on ✨', 'Twodo will nudge you when tasks are due.');
        }
        L.settings[key] = inp.checked; save();
        if (inp.checked) haptic('light');
      }));
      sh.querySelector('.sheet-body').addEventListener('click', e => {
        const b = e.target.closest('[data-x]'); if (b) settingsAction(b.dataset.x, sh);
      });
    },
  });
}
SegHandlers.theme = v => { L.settings.theme = v; save(); applyTheme(); };
SegHandlers.dmy = v => { L.settings.dmy = v === 'dmy'; save(); };
SegHandlers.me = v => {
  L.me = v; save(); applyTheme(); scheduleRender();
  const c = $('#couple'); if (c) c.innerHTML = personCardHTML('a') + personCardHTML('b');
};

async function settingsAction(x, sh) {
  switch (x) {
    case 'joinshow': { const r = $('#sJoinRow'); r.hidden = false; r.querySelector('input').focus(); return; }
    case 'create': {
      const url = normUrl($('#sUrl').value);
      if (!/^https?:\/\/.+\..+/.test(url)) { island({ e: '⚠️', text: 'Paste your Firebase database URL first' }); $('#sUrl').focus(); return; }
      const code = genCode();
      island({ e: '⏳', text: 'Checking the database…', ms: 6000 });
      try { await probeSpace(url, code); } catch (e) { island({ e: '⚠️', text: 'Couldn’t connect', sub: e.message, ms: 5000 }); return; }
      if (!D.people) setPeople(person('a'), person('b')); else commit(D.people, { silent: true });
      L.sync = { url, code }; save();
      await Sync.init(); updateSyncUI();
      island({ e: '💞', text: 'Shared space created', sub: `Now tap “Invite ${firstWord(ptName())}”` });
      return;
    }
    case 'join': {
      const url = normUrl($('#sUrl').value), code = $('#sCode').value;
      if (!/^https?:\/\/.+\..+/.test(url)) { island({ e: '⚠️', text: 'Paste the database URL first' }); return; }
      return joinSpace(url, code);
    }
    case 'invite': return invitePartner();
    case 'copycode': if (await copyText(L.sync.code)) island({ e: '📋', text: 'Pair code copied', ms: 1600 }); return;
    case 'resync': Sync.connect(); island({ e: '🔄', text: 'Syncing…', ms: 1400 }); return;
    case 'disconnect':
      if (!(await confirmDialog({ title: 'Stop syncing?', message: 'Your tasks stay on this phone. You can rejoin later with the same code.', ok: 'Stop', destructive: true }))) return;
      Sync.close(); L.sync = { url: L.sync.url, code: '' }; save(); Sync.set('off'); updateSyncUI(); return;
    case 'export': {
      downloadFile(`twodo-backup-${todayStr()}.json`, 'application/json', JSON.stringify({ app: 'twodo', version: 1, exportedAt: new Date().toISOString(), data: D }, null, 2));
      island({ e: '💾', text: 'Backup saved' }); return;
    }
    case 'import': $('#importFile').click(); return;
    case 'reset':
      if (!(await confirmDialog({ title: 'Erase everything?', message: 'This removes all tasks and settings from this phone. Synced data stays in your shared space.', ok: 'Erase', destructive: true }))) return;
      Sync.close(); localStorage.removeItem(KD); localStorage.removeItem(KL); location.reload(); return;
  }
}

function inviteLink() {
  const data = btoa(unescape(encodeURIComponent(JSON.stringify({ u: L.sync.url, c: L.sync.code }))));
  return `${location.origin}${location.pathname}#join=${encodeURIComponent(data)}`;
}
async function invitePartner() {
  const url = inviteLink();
  const text = `Join me on Twodo 💞 Open this link on your phone:`;
  if (navigator.share) { try { await navigator.share({ title: 'Twodo invite', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  if (await copyText(url)) island({ e: '🔗', text: 'Invite link copied', sub: `Send it to ${firstWord(ptName())} privately` });
}
function readJoinHash() {
  const m = location.hash.match(/^#join=(.+)$/); if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try { const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); return o && o.u && o.c ? o : null; } catch (e) { return null; }
}

// Ask which person this phone belongs to (used when joining).
function chooseIdentity(people) {
  return new Promise(res => {
    let picked = null;
    const btn = k => `<button type="button" data-k="${k}"><span class="av" style="--c:var(--c-${people[k].color})">${esc(initial(people[k].name))}</span>${esc(people[k].name)}</button>`;
    openSheet({
      title: 'Which one are you?', right: '',
      body: `<p class="note-s" style="margin:0 0 18px;text-align:center">So Twodo knows whose phone this is.</p><div class="ob-who" style="margin:0 16px 24px">${btn('a')}${btn('b')}</div>`,
      onClose: () => res(picked),
      onMount: sh => sh.querySelector('.ob-who').addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        picked = b.dataset.k; b.classList.add('on'); haptic('success'); setTimeout(closeSheet, 250);
      }),
    });
  });
}
function remapIdentity(from, to) {
  const swap = v => v === from ? to : v === to ? from : v;
  for (const t of Object.values(D.tasks)) {
    t.createdBy = swap(t.createdBy); t.doneBy = swap(t.doneBy);
    if (t.assignee === 'a' || t.assignee === 'b') t.assignee = swap(t.assignee);
    stamp(t);
  }
}
async function joinSpace(url, code) {
  island({ e: '⏳', text: 'Looking for your shared space…', ms: 8000 });
  let people;
  try { ({ people } = await probeSpace(url, code)); } catch (e) { island({ e: '⚠️', text: 'Couldn’t join', sub: e.message, ms: 5000 }); return false; }
  if (!people) { island({ e: '🤔', text: 'No shared space for that code', sub: 'Check the code, or create a new space', ms: 5000 }); return false; }
  hideIsland();
  const k = await chooseIdentity(people);
  if (!k) return false;
  if (k !== L.me) remapIdentity(L.me, k);
  L.me = k; D.people = { ...people, _s: 1 };
  L.sync = { url: normUrl(url), code: formatCode(code) };
  addSecretList(); save(); applyTheme();
  await Sync.init(); scheduleRender();
  island({ e: '💞', text: `Connected with ${firstWord(person(partnerKey()).name)}`, sub: 'Your lists now sync in real time' });
  return true;
}

function initImport() {
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text()), d = j.data || j;
      if (!d || typeof d.tasks !== 'object') throw new Error('bad');
      let n = 0;
      for (const [id, t] of Object.entries(d.tasks || {})) if (!D.tasks[id] || (t.updatedAt || 0) > (D.tasks[id].updatedAt || 0)) { D.tasks[id] = t; commit(t, { silent: true }); n++; }
      for (const [id, l] of Object.entries(d.lists || {})) if (!D.lists[id] || (l.updatedAt || 0) > (D.lists[id].updatedAt || 0)) { D.lists[id] = l; commit(l, { silent: true }); n++; }
      if (d.people && (!D.people || (d.people.updatedAt || 0) > (D.people.updatedAt || 0))) { D.people = d.people; commit(D.people, { silent: true }); }
      ensureBasics(); scheduleRender(); island({ e: '📦', text: `Imported ${n} item${n === 1 ? '' : 's'}` });
    } catch (err) { island({ e: '⚠️', text: 'That file isn’t a Twodo backup' }); }
  });
}
