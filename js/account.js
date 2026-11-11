/* Twodo · "Together" settings section and the account / pairing sheets */
'use strict';

const sqI = (c, i) => `<span class="sq" style="--c:var(--c-${c})">${ic(i)}</span>`;
async function busy(btn, fn) {
  if (btn.disabled) return;
  const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}

function togetherHTML() {
  if (!cloudReady()) return `<div class="group"><div class="cell">${sqI('gray', 'cloud')}<span class="grow">Accounts & sync are off</span></div></div>
    <p class="note-s">To sync with ${esc(firstWord(ptName()))}, add your free Firebase details to <code>config.js</code> in your GitHub repo (README, “Turn on accounts & sync”).</p>`;
  const u = Auth.user();
  if (!u) return `<div class="group">
      <button class="cell" data-x="signup" type="button">${sqI('green', 'person')}<span class="grow">Create an account</span>${ic('chevR', 'chev')}</button>
      <button class="cell" data-x="signin" type="button">${sqI('blue', 'key')}<span class="grow">Sign in</span>${ic('chevR', 'chev')}</button></div>
    <p class="note-s">An account lets you pair with ${esc(firstWord(ptName()))} by username and back up your lists. Everything is end-to-end encrypted on your phones.</p>`;
  const rows = [];
  rows.push(`<div class="cell">${sqI(person(L.me).color, 'person')}<span class="grow">${u.username ? `<b>@${esc(u.username)}</b>` : 'Signed in'}<br><small class="val">${esc(u.email || '')}</small></span>
    ${u.username ? '' : `<button class="btn-s" data-x="username" type="button">Pick username</button>`}</div>`);
  if (u.expired) rows.push(`<button class="cell" data-x="signin" type="button">${sqI('red', 'key')}<span class="grow">Session expired — sign in again</span>${ic('chevR', 'chev')}</button>`);
  rows.push(`<div class="cell">${sqI(Sync.state === 'live' ? 'green' : Sync.state === 'error' ? 'red' : 'orange', 'cloud')}<span class="grow status ${Sync.state}"><i></i>${esc(Sync.label())}</span></div>`);
  const p = L.pair, inc = Inbox.incoming();
  let pairRows = '';
  if (p && p.status === 'paired') {
    pairRows = `<div class="cell">${sqI('pink', 'heart')}<span class="grow">Paired with <b>${esc(p.name)}</b>${p.username ? ` <span class="val">@${esc(p.username)}</span>` : ''}</span></div>
      <button class="cell red" data-x="unpair" type="button">Unpair</button>`;
  } else if (p && p.status === 'sent') {
    pairRows = `<div class="cell">${sqI('orange', 'clock')}<span class="grow">Waiting for <b>${esc(p.name)}</b> <span class="val">@${esc(p.username)}</span>${p.code ? `<br><small class="val">Safety code ${esc(p.code)}</small>` : ''}</span><button class="btn-s" data-x="paircancel" type="button" style="background:var(--fill);color:var(--label)">Cancel</button></div>`;
  } else if (u.username) {
    pairRows = `<button class="cell" data-x="invite" type="button">${sqI('pink', 'heart')}<span class="grow"><b>Add partner</b></span>${ic('chevR', 'chev')}</button>`;
  }
  const reqRows = inc.length ? `<button class="cell" data-x="invite" type="button"><span class="list-ic" style="--c:var(--c-pink)">💌</span><span class="grow"><b>${inc.length} partner request${inc.length > 1 ? 's' : ''}</b></span><span class="val">View</span>${ic('chevR', 'chev')}</button>` : '';
  const pushRow = Push.configured()
    ? `<div class="cell">${sqI('red', 'bell')}<span class="grow">Push reminders</span><input type="checkbox" class="switch" id="pushSw" ${Push.on() ? 'checked' : ''} aria-label="Push reminders"></div>`
    : `<button class="cell" data-x="vapid" type="button">${sqI('red', 'bell')}<span class="grow">Set up push reminders</span><span class="val">Keys</span>${ic('chevR', 'chev')}</button>`;
  return `<div class="group">${rows.join('')}${reqRows}${pairRows}</div>
    <div class="group">${pushRow}<button class="cell red" data-x="signout" type="button">Sign out</button></div>
    <p class="note-s">🔒 Tasks are encrypted on your phones (AES-256-GCM) before they’re saved. Firebase can’t read them, and only your paired accounts can even download them. ${Push.why() && !Push.on() ? esc(Push.why()) : 'Push reminders arrive within about 5–15 minutes of the due time.'}</p>`;
}
function updateSyncUI() { const g = $('#syncWrap'); if (g) g.innerHTML = togetherHTML(); }

async function togetherAction(x, el, sh) {
  const fail = e => { island({ e: '⚠️', text: e.message, ms: 4500 }); haptic('warn'); };
  switch (x) {
    case 'signup': return openAuthSheet('signup');
    case 'signin': return openAuthSheet('signin');
    case 'username': return openUsernameSheet();
    case 'vapid': return openVapidSheet();
    case 'invite': return openInviteSheet();
    case 'pairfind': return busy(el, async () => {
      try { openPairSheet(await Pair.lookup($('#pairUser', sh).value)); } catch (e) { fail(e); }
    });
    case 'paircancel': return busy(el, async () => { try { await Pair.cancel(); updateSyncUI(); } catch (e) { fail(e); } });
    case 'review': return busy(el, async () => { try { openRequestSheet(await Pair.review(el.dataset.uid)); } catch (e) { fail(e); } });
    case 'unpair':
      if (!(await confirmDialog({ title: `Unpair from ${L.pair.name}?`, message: 'You’ll stop syncing. Everything stays on this phone, and you can pair again later.', ok: 'Unpair', destructive: true }))) return;
      try { await Pair.unpair(); updateSyncUI(); island({ e: '👋', text: 'Unpaired', sub: 'Your lists are private again' }); } catch (e) { fail(e); }
      return;
    case 'signout':
      if (!(await confirmDialog({ title: 'Sign out?', message: 'Your tasks stay on this phone. Sign back in any time to sync again.', ok: 'Sign out', destructive: true }))) return;
      await signOut(); updateSyncUI(); return;
  }
}

/* ---------- Sheets ---------- */
function openAuthSheet(mode) {
  const up = mode === 'signup';
  openSheet({
    title: up ? 'Create account' : 'Sign in', right: '',
    left: `<button class="nav-btn" data-s="back" type="button">${ic('chevL')}Settings</button>`,
    body: `<div class="big-ic" style="--c:var(--accent)">${up ? '💞' : '🔐'}</div>
      <div class="group">
        <div class="cell">${sqI('blue', 'person')}<input class="inp" id="auEmail" type="email" autocomplete="email" autocapitalize="off" placeholder="Email" aria-label="Email"></div>
        <div class="cell">${sqI('gray', 'key')}<input class="inp" id="auPass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="Password${up ? ' (8+ characters)' : ''}" aria-label="Password"></div>
      </div>
      <div class="err" id="auErr" style="margin:-12px 32px 12px"></div>
      <div style="padding:0 16px"><button class="btn" id="auGo" type="button">${up ? 'Create account' : 'Sign in'}</button></div>
      <p class="note-s" style="margin-top:14px">${up
        ? 'Your password never leaves this phone. Twodo turns it into a separate login secret plus an encryption key, so not even Firebase can read your tasks. If you forget it, see the README.'
        : 'Signing in on a new phone restores your encrypted lists and your pairing.'}</p>`,
    onMount: sh => {
      sh.querySelector('[data-s="back"]').addEventListener('click', openSettings);
      const go = sh.querySelector('#auGo'), err = sh.querySelector('#auErr');
      const run = () => busy(go, async () => {
        err.textContent = '';
        const email = sh.querySelector('#auEmail').value, pw = sh.querySelector('#auPass').value;
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) { err.textContent = 'Enter a valid email.'; return; }
        if (pw.length < (up ? 8 : 1)) { err.textContent = up ? 'Use at least 8 characters.' : 'Enter your password.'; return; }
        try {
          await (up ? signUp(email, pw) : signIn(email, pw));
          haptic('success');
          if (!L.auth.username) openUsernameSheet(); else { openSettings(); island({ e: '🔓', text: `Welcome back, @${L.auth.username}` }); }
        } catch (e) { err.textContent = e.message; haptic('warn'); }
      });
      go.addEventListener('click', run);
      sh.querySelector('#auPass').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
      if (!isTouch) setTimeout(() => sh.querySelector('#auEmail').focus(), 350);
    },
  });
}

function openUsernameSheet() {
  openSheet({
    title: 'Your username', right: '',
    body: `<div class="big-ic" style="--c:var(--accent)">@</div>
      <p class="note-s" style="margin:-4px 0 18px;text-align:center">Your partner finds you by this. It has to be unique.</p>
      <div class="group"><div class="cell"><span class="val" style="font-size:20px">@</span><input class="inp" id="unIn" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" placeholder="${esc(normUsername(firstWord(myName())).replace(/[^a-z0-9_.]/g, '') || 'yourname')}" value="${esc(L.auth.username || '')}" aria-label="Username"><span id="unOk" class="val"></span></div></div>
      <div class="err" id="unErr" style="margin:-12px 32px 12px"></div>
      <div style="padding:0 16px"><button class="btn" id="unGo" type="button">Save username</button></div>`,
    onMount: sh => {
      const inp = sh.querySelector('#unIn'), ok = sh.querySelector('#unOk'), err = sh.querySelector('#unErr'), go = sh.querySelector('#unGo');
      let t;
      inp.addEventListener('input', () => {
        const v = normUsername(inp.value).replace(/[^a-z0-9_.]/g, '');
        if (inp.value !== v) inp.value = v;
        err.textContent = ''; ok.textContent = ''; clearTimeout(t);
        if (!USERNAME_RE.test(v)) { if (v) ok.textContent = '3+'; return; }
        t = setTimeout(async () => { try { const free = await usernameFree(v); if (inp.value === v) { ok.textContent = free ? '✅' : '❌'; if (!free) err.textContent = `@${v} is taken.`; } } catch (e) { /* ignore */ } }, 350);
      });
      go.addEventListener('click', () => busy(go, async () => {
        try { const n = await claimUsername(inp.value || inp.placeholder); haptic('success'); openSettings(); island({ e: '✨', text: `You’re @${n}`, sub: `Share it with ${firstWord(ptName())} to pair` }); }
        catch (e) { err.textContent = e.message; haptic('warn'); }
      }));
      if (!isTouch) setTimeout(() => inp.focus(), 350);
    },
  });
}

const personBadge = (name, color, sub) => `<div style="text-align:center;margin:4px 0 18px"><span class="av" style="--c:var(--c-${esc(color || 'pink')});width:72px;height:72px;line-height:72px;font-size:30px;display:block;margin:0 auto 10px">${esc(initial(name))}</span>
  <div style="font-size:22px;font-weight:700">${esc(name)}</div><div class="val">${esc(sub)}</div></div>`;
const codeBox = (code, who) => `<div class="group"><div class="cell" style="flex-direction:column;align-items:center;padding:14px 16px">
  <span class="val" style="font-size:13px">SAFETY CODE</span><span class="code-box" style="font-size:30px;letter-spacing:3px;margin:4px 0">${esc(code)}</span>
  <span class="val" style="font-size:13px;text-align:center">Check that ${esc(who)} sees exactly the same code. If it’s different, don’t continue.</span></div></div>`;

function openPairSheet(t) {
  openSheet({
    title: 'Invite to pair', right: '',
    left: `<button class="nav-btn" data-s="back" type="button">${ic('chevL')}Settings</button>`,
    body: `${personBadge(t.name, t.color, '@' + t.username)}${codeBox(t.code, firstWord(t.name))}
      <div style="padding:0 16px"><button class="btn" id="pgGo" type="button">Send pairing request</button></div>
      <p class="note-s" style="margin-top:14px">Once ${esc(firstWord(t.name))} accepts, you’ll share every list except Secret ones. Only your two accounts can access them.</p>`,
    onMount: sh => {
      sh.querySelector('[data-s="back"]').addEventListener('click', openSettings);
      const go = sh.querySelector('#pgGo');
      go.addEventListener('click', () => busy(go, async () => {
        try { await Pair.send(t); haptic('success'); openSettings(); island({ e: '💌', text: `Request sent to ${t.name}`, sub: `Safety code ${t.code}`, ms: 5000 }); }
        catch (e) { island({ e: '⚠️', text: e.message }); }
      }));
    },
  });
}

function openRequestSheet(r) {
  openSheet({
    title: 'Pairing request', right: '',
    left: `<button class="nav-btn" data-s="back" type="button">${ic('chevL')}Settings</button>`,
    body: `${personBadge(r.name, r.color, '@' + r.username + ' wants to pair with you')}${codeBox(r.code, firstWord(r.name))}
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:8px"><button class="btn" id="rqYes" type="button">Accept</button><button class="btn ghost" id="rqNo" type="button" style="color:var(--c-red)">Decline</button></div>
      <p class="note-s" style="margin-top:14px">Accepting merges the tasks on this phone into your shared lists. Secret lists stay private.</p>`,
    onMount: sh => {
      sh.querySelector('[data-s="back"]').addEventListener('click', openSettings);
      const yes = sh.querySelector('#rqYes'), no = sh.querySelector('#rqNo');
      yes.addEventListener('click', () => busy(yes, async () => {
        try { await Pair.accept(r); haptic('success'); confetti(); closeSheet(); island({ e: '💞', text: `Paired with ${r.name}`, sub: 'Your lists now sync in real time' }); }
        catch (e) { island({ e: '⚠️', text: e.message }); }
      }));
      no.addEventListener('click', () => busy(no, async () => { try { await Pair.decline(r); openSettings(); } catch (e) { island({ e: '⚠️', text: e.message }); } }));
    },
  });
}

/* One-time push setup: make the VAPID key pair right here on the phone, so the private key
   goes straight from your clipboard into GitHub Secrets and nowhere else. */
async function genVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = new Uint8Array([4, ...unb64url(jwk.x), ...unb64url(jwk.y)]);
  return { publicKey: b64(pub).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), privateKey: jwk.d };
}
async function openVapidSheet() {
  const k = await genVapid();
  const row = (label, id, val, c) => `<div class="cell" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px 16px">
      <span class="val" style="font-size:13px;font-weight:600">${label}</span><span class="code-box" id="${id}" style="font-size:13px;user-select:all;-webkit-user-select:all">${esc(val)}</span>
      <button class="btn-s" data-copy="${id}" type="button" style="align-self:flex-start;background:var(--c-${c})">Copy</button></div>`;
  openSheet({
    title: 'Push reminder keys', right: 'Done', tall: true,
    left: `<button class="nav-btn" data-s="back" type="button">${ic('chevL')}Settings</button>`,
    body: `<p class="note-s" style="margin:0 0 16px">Made on this phone just now and not saved anywhere. Follow README → “Push reminders”.</p>
      <div class="group">${row('1 · PUBLIC KEY → config.js <code>vapidPublicKey</code> and secret VAPID_PUBLIC_KEY', 'vpub', k.publicKey, 'blue')}</div>
      <div class="group">${row('2 · PRIVATE KEY → secret VAPID_PRIVATE_KEY only. Never put this in config.js.', 'vpriv', k.privateKey, 'red')}</div>
      <p class="note-s">If you close this before saving both, just open it again for a fresh pair.</p>`,
    onMount: sh => {
      sh.querySelector('[data-s="back"]').addEventListener('click', openSettings);
      sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-copy]'); if (!b) return;
        if (await copyText(sh.querySelector('#' + b.dataset.copy).textContent)) { b.textContent = 'Copied ✓'; haptic('success'); }
      });
    },
  });
}

/* Add partner: friend-request style. Search a username → Add → they Accept or Decline. */
function reqCard(av, title, sub, actions) {
  return `<div class="fr-card">${av}<div class="fr-t"><b>${title}</b><span>${sub}</span></div><div class="fr-a">${actions}</div></div>`;
}
const frAv = (name, color) => `<span class="av" style="--c:var(--c-${esc(color || 'pink')})">${esc(initial(name))}</span>`;
function addPartnerHTML(found) {
  const inc = Inbox.incoming(), p = L.pair;
  let h = '';
  if (inc.length) h += `<div class="sec-h sub">Partner requests</div><div class="group fr">${inc.map(([uid, r]) => reqCard(frAv(r.name, r.color), esc(r.name), '@' + esc(r.username) + ' wants to add you',
    `<button class="btn-s" data-f="accept" data-uid="${esc(uid)}" type="button">Accept</button><button class="btn-s gray" data-f="decline" data-uid="${esc(uid)}" type="button">Decline</button>`)).join('')}</div>`;
  if (p && p.status === 'sent') {
    h += `<div class="sec-h sub">Sent</div><div class="group fr">${reqCard(frAv(p.name, 'pink'), esc(p.name), '@' + esc(p.username) + ' · Requested' + (p.code ? ` · code ${esc(p.code)}` : ''),
      `<button class="btn-s gray" data-f="cancel" type="button">Cancel</button>`)}</div>`;
  } else {
    h += `<div class="sec-h sub">Find your partner</div>
      <div class="group"><div class="cell"><span class="val" style="font-size:20px">@</span><input class="inp" id="frUser" placeholder="username" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Partner username"><button class="btn-s" data-f="search" type="button">Search</button></div></div>`;
    if (found) h += `<div class="group fr">${reqCard(frAv(found.name, found.color), esc(found.name), '@' + esc(found.username), `<button class="btn-s" data-f="add" type="button">${ic('plus', 'xs')} Add</button>`)}</div>`;
  }
  h += `<div class="sec-h sub">Your username</div>
    <div class="group"><div class="cell"><span class="grow" style="font-size:20px;font-weight:700">@${esc(L.auth.username)}</span><button class="btn-s gray" data-f="share" type="button">Share</button></div></div>
    <p class="note-s">Once they accept, you share every list except Secret ones. You’ll each see the same 8-digit code. If it matches, nobody tampered with the request.</p>`;
  return h;
}
function openInviteSheet() {
  if (!Auth.user()) return openSettings();
  if (!L.auth.username) return openUsernameSheet();
  if (L.pair && L.pair.status === 'paired') { island({ e: '💞', text: `You’re already paired with ${L.pair.name}` }); return; }
  let found = null;
  openSheet({
    title: 'Add partner', right: 'Done', tall: true,
    body: `<div id="frWrap">${addPartnerHTML()}</div>`,
    onMount: sh => {
      const wrap = sh.querySelector('#frWrap');
      const redraw = () => { wrap.innerHTML = addPartnerHTML(found); };
      const fail = e => { island({ e: '⚠️', text: e.message, ms: 4000 }); haptic('warn'); };
      Inbox.onChange = () => { if (sh.isConnected) redraw(); };
      wrap.addEventListener('keydown', e => { if (e.target.id === 'frUser' && e.key === 'Enter') wrap.querySelector('[data-f="search"]').click(); });
      wrap.addEventListener('click', async e => {
        const b = e.target.closest('[data-f]'); if (!b) return;
        const f = b.dataset.f;
        if (f === 'search') return busy(b, async () => { try { found = await Pair.lookup(wrap.querySelector('#frUser').value); redraw(); } catch (x) { fail(x); } });
        if (f === 'add') return busy(b, async () => {
          try { await Pair.send(found); found = null; redraw(); haptic('success'); island({ e: '💌', text: `Request sent to ${L.pair.name}`, sub: `Code ${L.pair.code}` }); } catch (x) { fail(x); }
        });
        if (f === 'cancel') return busy(b, async () => { try { await Pair.cancel(); redraw(); } catch (x) { fail(x); } });
        if (f === 'accept') return busy(b, async () => {
          try {
            const r = await Pair.review(b.dataset.uid);
            if (!(await confirmDialog({ title: `Add ${r.name}?`, message: `Check ${firstWord(r.name)} sees this code too: ${r.code}`, ok: 'Accept' }))) return;
            await Pair.accept(r); haptic('success'); confetti(); closeSheet(); island({ e: '💞', text: `You and ${r.name} are paired`, sub: 'Your lists now sync in real time' });
          } catch (x) { fail(x); }
        });
        if (f === 'decline') return busy(b, async () => { try { await Pair.decline(await Pair.review(b.dataset.uid)); redraw(); } catch (x) { fail(x); } });
        if (f === 'share') {
          const text = `Add me on Twodo 💞 My username is @${L.auth.username}\n${location.origin}${location.pathname}`;
          if (navigator.share) { try { await navigator.share({ text }); return; } catch (x) { if (x.name === 'AbortError') return; } }
          if (await copyText(text)) island({ e: '📋', text: 'Copied', ms: 1500 });
        }
      });
    },
    onClose: () => { Inbox.onChange = null; },
  });
}
