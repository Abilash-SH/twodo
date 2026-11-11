/* Twodo · settings, couple sync setup, backup */
'use strict';

function personCardHTML(k) {
  const p = person(k);
  return `<div class="person" data-k="${k}">${k === L.me ? '<span class="tag-me">This phone</span>' : ''}
    <button class="pc-photo" data-ph="${k}" type="button" aria-label="Change ${esc(p.name)}’s photo">${avatar(k)}<span class="pc-cam">${ic('camera')}</span></button>
    <input value="${esc(p.name)}" data-pn="${k}" maxlength="24" aria-label="Name">
    <div class="colors sm">${PALETTE.slice(0, 10).map(c => `<button type="button" data-pc="${c}" style="--c:var(--c-${c})" class="${c === p.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div></div>`;
}

function openSettings() {
  const s = L.settings;
  const sq = (c, i) => `<span class="sq" style="--c:var(--c-${c})">${ic(i)}</span>`;
  const sw = (key, label, c, i) => `<div class="cell">${sq(c, i)}<span class="grow">${label}</span><input type="checkbox" class="switch" data-set="${key}" ${s[key] ? 'checked' : ''} aria-label="${label}"></div>`;
  const notifyNote = isIOS && !standalone() ? 'On iPhone, reminders need Twodo added to your Home Screen first.' : 'Reminders pop up while Twodo is open or recently used. For alerts that always fire, use “Add to Calendar” on a task.';
  const body = `
    <div class="couple" id="couple">${personCardHTML('a')}${personCardHTML('b')}</div>
    ${Auth.user() ? '' : `<div class="group"><div class="cell">${sq('gray', 'phone')}<span class="grow">I am</span>${segHTML('me', [['a', esc(shortName(person('a').name))], ['b', esc(shortName(person('b').name))]], L.me)}</div></div>`}

    <div class="sec-h sub">Together</div>
    <div id="syncWrap">${togetherHTML()}</div>

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
      const couple = sh.querySelector('#couple');
      couple.addEventListener('input', e => {
        const k = e.target.dataset.pn; if (!k) return;
        const name = e.target.value.trim(); if (!name) return;
        D.people[k] = { ...person(k), name }; commit(D.people);
        const av = e.target.closest('.person').querySelector('.av'); if (!person(k).photo) av.textContent = initial(name);
      });
      couple.addEventListener('click', e => {
        const ph = e.target.closest('[data-ph]'); if (ph) return photoMenu(ph.dataset.ph, ph);
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
  const c = $('#couple'); if (c) c.innerHTML = personCardHTML('a') + personCardHTML('b');
};

/* ---------- Profile photos: cropped square on this phone, synced end-to-end encrypted like everything else ---------- */
function photoMenu(k, btn) {
  if (!person(k).photo) return pickPhoto(k);
  showMenu({
    rect: btn.getBoundingClientRect(),
    html: `<button class="mi" data-m="pick" type="button">Choose New Photo${ic('camera')}</button><button class="mi red" data-m="remove" type="button">Remove Photo${ic('trash')}</button>`,
    onPick: m => (m === 'pick' ? pickPhoto(k) : setPhoto(k, null)),
  });
}
function pickPhoto(k) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
  document.body.append(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    try { setPhoto(k, await squarePhoto(f, 200)); }
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
        res(c.toDataURL('image/jpeg', 0.82));
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
  const c = $('#couple'); if (c) c.innerHTML = personCardHTML('a') + personCardHTML('b');
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
      for (const [id, t] of Object.entries(d.tasks || {})) if (!D.tasks[id] || (t.updatedAt || 0) > (D.tasks[id].updatedAt || 0)) { D.tasks[id] = t; commit(t, { silent: true }); n++; }
      for (const [id, l] of Object.entries(d.lists || {})) if (!D.lists[id] || (l.updatedAt || 0) > (D.lists[id].updatedAt || 0)) { D.lists[id] = l; commit(l, { silent: true }); n++; }
      if (d.people && (!D.people || (d.people.updatedAt || 0) > (D.people.updatedAt || 0))) { D.people = d.people; commit(D.people, { silent: true }); }
      ensureBasics(); scheduleRender(); island({ e: '📦', text: `Imported ${n} item${n === 1 ? '' : 's'}` });
    } catch (err) { island({ e: '⚠️', text: 'That file isn’t a Twodo backup' }); }
  });
}
