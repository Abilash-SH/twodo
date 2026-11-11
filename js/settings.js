/* Twodo · settings, couple sync setup, backup */
'use strict';

// Your profile: only you can change your photo, name and colour. Your colour is the app's accent and your bubbles.
function profileHTML() {
  const k = L.me, p = person(k), u = Auth.user();
  return `<button class="pc-photo" data-ph="${k}" type="button" aria-label="Your photo">${avatar(k)}<span class="pc-cam">${ic('camera')}</span></button>
    <input class="me-name" value="${esc(p.name)}" data-pn="${k}" maxlength="24" aria-label="Your name" autocomplete="off">
    ${u && u.username ? `<div class="me-handle">@${esc(u.username)}</div>` : ''}
    <div class="colors me-colors" role="radiogroup" aria-label="Your colour">${PALETTE.slice(0, 10).map(c => `<button type="button" data-pc="${c}" style="--c:var(--c-${c})" class="${c === p.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>
    <p class="me-hint">Your colour shows on your messages and across the app.</p>`;
}

function openSettings() {
  const s = L.settings;
  const sq = (c, i) => `<span class="sq" style="--c:var(--c-${c})">${ic(i)}</span>`;
  const sw = (key, label, c, i) => `<div class="cell">${sq(c, i)}<span class="grow">${label}</span><input type="checkbox" class="switch" data-set="${key}" ${s[key] ? 'checked' : ''} aria-label="${label}"></div>`;
  const notifyNote = isIOS && !standalone() ? 'On iPhone, reminders need Twodo added to your Home Screen first.' : 'Reminders pop up while Twodo is open or recently used. For alerts that always fire, use “Add to Calendar” on a task.';
  const body = `
    <div class="me-prof" id="meProf">${profileHTML()}</div>
    ${Auth.user() ? '' : `<div class="group"><div class="cell">${sq('gray', 'phone')}<span class="grow">I am</span>${segHTML('me', [['a', esc(shortName(person('a').name))], ['b', esc(shortName(person('b').name))]], L.me)}</div></div>`}

    <div class="sec-h sub">Together</div>
    <div id="syncWrap">${togetherHTML()}</div>

    <div class="sec-h sub">Appearance</div>
    <div class="group">
      <div class="cell">${sq('indigo', 'sun')}<span class="grow">Theme</span>${segHTML('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}</div>
    </div>

    <div class="sec-h sub">Feel</div>
    <div class="group">
      ${sw('haptics', 'Haptics', 'pink', 'hand')}
      ${sw('sounds', 'Sounds', 'orange', 'bell')}
      ${sw('confetti', 'Celebrations', 'purple', 'sparkles')}
      ${sw('notify', 'In-app reminders', 'red', 'clock')}
      <div class="cell">${sq('blue', 'cal')}<span class="grow">5/12 is</span>${segHTML('dmy', [['dmy', '5 Dec'], ['mdy', 'May 12']], s.dmy ? 'dmy' : 'mdy')}</div>
    </div>
    <p class="note-s">${esc(notifyNote)}</p>


    <div class="sec-h sub">Backup</div>
    <div class="group">
      <button class="cell" data-x="export" type="button">${sq('green', 'download')}<span class="grow">Export backup</span></button>
      <button class="cell" data-x="import" type="button">${sq('blue', 'upload')}<span class="grow">Import backup</span></button>
      <button class="cell red" data-x="reset" type="button">Erase everything on this phone</button>
    </div>

    <div class="group">
      <button class="cell" data-x="tips" type="button">${sq('yellow', 'bulb')}<span class="grow">Tips &amp; tricks</span>${ic('chevR', 'chev')}</button>
    </div>
    <div class="foot">Twodo 1.0 · made for two 💞</div>`;

  openSheet({
    title: 'Settings', body, tall: true,
    onMount: sh => {
      const prof = sh.querySelector('#meProf');
      prof.addEventListener('input', e => {
        if (e.target.dataset.pn !== L.me) return;
        const name = e.target.value.trim(); if (!name) return;
        D.people[L.me] = { ...person(L.me), name }; commit(D.people);
        const av = prof.querySelector('.av'); if (!person(L.me).photo) av.textContent = initial(name);
      });
      prof.addEventListener('click', e => {
        const ph = e.target.closest('[data-ph]'); if (ph) return person(L.me).photo ? viewPhoto(L.me, ph.querySelector('.av')) : pickPhoto(L.me);
        const b = e.target.closest('[data-pc]'); if (!b) return;
        D.people[L.me] = { ...person(L.me), color: b.dataset.pc }; commit(D.people);
        L.settings.accent = 'me'; save();
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        prof.querySelector('.av').style.setProperty('--c', `var(--c-${b.dataset.pc})`);
        applyTheme(); scheduleRender(); haptic('light');
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
        const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'tips') { closeSheet(); setTimeout(() => openTips(), 350); }
        else if (['export', 'import', 'reset'].includes(b.dataset.x)) settingsAction(b.dataset.x, sh); else togetherAction(b.dataset.x, b, sh);
      });
      sh.querySelector('.sheet-body').addEventListener('change', async e => {
        if (e.target.id !== 'pushSw') return;
        const on = e.target.checked;
        try { if (on) { await Push.enable(); island({ e: '🔔', text: 'Push reminders are on', sub: 'They arrive within about 5–15 minutes' }); } else await Push.disable(); }
        catch (err) { e.target.checked = !on; island({ e: '🔕', text: err.message, ms: 4500 }); }
      });
      sh.querySelector('.sheet-body').addEventListener('keydown', e => { if (e.target.id === 'pairUser' && e.key === 'Enter') { const b = sh.querySelector('[data-x="pairfind"]'); if (b) b.click(); } });
    },
  });
}
SegHandlers.theme = v => { L.settings.theme = v; save(); applyTheme(); };
SegHandlers.dmy = v => { L.settings.dmy = v === 'dmy'; save(); };
SegHandlers.me = v => {
  L.me = v; save(); applyTheme(); scheduleRender();
  const c = $('#meProf'); if (c) c.innerHTML = profileHTML();
};

/* ---------- Profile photos: cropped square on this phone, synced end-to-end encrypted like everything else.
   Tap any picture to see it big; only your own can be changed. ---------- */
const PhotoView = { close: null };
function viewPhoto(k, fromEl) {
  if (PhotoView.close) return;
  const mine = k === L.me, p = person(k), paired = !!(L.pair && L.pair.status === 'paired');
  if (!mine && !paired && cloudReady()) return;
  const el = document.createElement('div'); el.className = 'pv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', p.name);
  el.innerHTML = `<div class="pv-bg"></div><button class="pv-x" type="button" aria-label="Close">${ic('x')}</button>
    <div class="pv-main"><div class="pv-img">${avatar(k)}</div><div class="pv-name">${esc(p.name)}</div>
      ${mine ? `<div class="pv-acts"><button class="pv-b" data-pvx="pick" type="button">${ic('camera')}<span>${p.photo ? 'Change' : 'Add photo'}</span></button>${p.photo ? `<button class="pv-b red" data-pvx="remove" type="button">${ic('trash')}<span>Remove</span></button>` : ''}</div>` : ''}</div>`;
  document.body.append(el);
  const img = el.querySelector('.pv-img');
  const fromT = () => {
    if (!fromEl || !fromEl.isConnected) return 'scale(.6)';
    const a = fromEl.getBoundingClientRect(), b = img.getBoundingClientRect();
    return `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${a.width / b.width})`;
  };
  const ease = 'cubic-bezier(.32,.72,0,1)';
  if (!reducedMotion.matches) img.animate([{ transform: fromT() }, { transform: 'none' }], { duration: 480, easing: ease });
  requestAnimationFrame(() => el.classList.add('on'));
  haptic('light');
  let closing = false;
  const close = (after) => {
    if (closing) return; closing = true; PhotoView.close = null;
    el.classList.remove('on');
    const cur = getComputedStyle(img).transform;
    const anim = reducedMotion.matches ? null : img.animate([{ transform: cur === 'none' ? 'none' : cur }, { transform: fromT() }], { duration: 380, easing: ease, fill: 'forwards' });
    const done = () => { el.remove(); if (after) after(); };
    if (anim) anim.onfinish = done; else setTimeout(done, 200);
    return true;
  };
  PhotoView.close = () => close();
  el.addEventListener('click', e => {
    const x = e.target.closest('[data-pvx]');
    if (x) return close(() => (x.dataset.pvx === 'pick' ? pickPhoto(k) : setPhoto(k, null)));
    if (!e.target.closest('.pv-acts, .pv-img')) close();
  });
  // drag down to dismiss
  let d = null;
  el.addEventListener('pointerdown', e => { if (!e.target.closest('button')) d = { y0: e.clientY, id: e.pointerId, dy: 0 }; });
  el.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    img.style.transform = `translateY(${d.dy}px) scale(${1 - Math.min(d.dy, 300) / 1200})`;
    el.querySelector('.pv-bg').style.opacity = String(1 - Math.min(d.dy, 300) / 400);
  });
  const end = e => {
    if (!d || e.pointerId !== d.id) return;
    const dy = d.dy; d = null;
    if (dy > 90) { img.style.transform = ''; close(); return; }
    img.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1)'; img.style.transform = ''; el.querySelector('.pv-bg').style.opacity = '';
    setTimeout(() => { img.style.transition = ''; }, 360);
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
function pickPhoto(k) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
  document.body.append(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    try { setPhoto(k, await squarePhoto(f, 360)); }
    catch (e) { island({ e: '⚠️', text: 'That photo couldn’t be used', sub: 'Try another one' }); }
  });
  inp.click();
}
function squarePhoto(file, size) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const s = Math.min(img.naturalWidth, img.naturalHeight); if (!s) throw new Error('empty');
        const c = document.createElement('canvas'); c.width = c.height = size;
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
        x.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        let q = 0.84, url = c.toDataURL('image/jpeg', q);
        while (url.length > 42000 && q > 0.5) { q -= 0.08; url = c.toDataURL('image/jpeg', q); } // keep the synced record small
        res(url);
      } catch (e) { rej(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}
function setPhoto(k, photo) {
  const p = { ...person(k) };
  if (photo) p.photo = photo; else delete p.photo;
  D.people[k] = p; commit(D.people);
  applyTheme(); scheduleRender(); haptic('success');
  const c = $('#meProf'); if (c) c.innerHTML = profileHTML();
  island({ e: photo ? '📸' : '🗑️', text: photo ? 'Photo updated' : 'Photo removed', sub: photo && cloudReady() && L.pair && L.pair.status === 'paired' ? `${firstWord(k === L.me ? ptName() : myName())} will see it too` : '', ms: 1800 });
}

async function settingsAction(x, sh) {
  switch (x) {
    case 'export': {
      downloadFile(`twodo-backup-${todayStr()}.json`, 'application/json', JSON.stringify({ app: 'twodo', version: 1, exportedAt: new Date().toISOString(), data: D }, null, 2));
      island({ e: '💾', text: 'Backup saved' }); return;
    }
    case 'import': $('#importFile').click(); return;
    case 'reset':
      if (!(await confirmDialog({ title: 'Erase everything?', message: 'This removes all tasks and settings from this phone. Synced data stays in your shared space.', ok: 'Erase', destructive: true }))) return;
      Sync.close(); Inbox.stop(); await KeyStore.clear().catch(() => {}); localStorage.removeItem('twodo:chat'); localStorage.removeItem(KD); localStorage.removeItem(KL); location.reload(); return;
  }
}

function initImport() {
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text()), d = j.data || j;
      if (!d || typeof d.tasks !== 'object') throw new Error('bad');
      let n = 0;
      for (const [id, t] of Object.entries(cleanMap(d.tasks))) if (!D.tasks[id] || (t.updatedAt || 0) > (D.tasks[id].updatedAt || 0)) { D.tasks[id] = t; commit(t, { silent: true }); n++; }
      for (const [id, l] of Object.entries(cleanMap(d.lists))) if (!D.lists[id] || (l.updatedAt || 0) > (D.lists[id].updatedAt || 0)) { D.lists[id] = l; commit(l, { silent: true }); n++; }
      const pp = d.people && cleanRecord(d.people);
      if (pp && (!D.people || (pp.updatedAt || 0) > (D.people.updatedAt || 0))) { D.people = pp; commit(D.people, { silent: true }); }
      ensureBasics(); scheduleRender(); island({ e: '📦', text: `Imported ${n} item${n === 1 ? '' : 's'}` });
    } catch (err) { island({ e: '⚠️', text: 'That file isn’t a Twodo backup' }); }
  });
}
