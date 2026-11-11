/* Twodo · sign-in gate: the first screen when accounts are configured and nobody is signed in */
'use strict';

function startGate(first = 'welcome') {
  $('#ob') && $('#ob').remove();
  Cmp.el.classList.add('hide');
  const ob = document.createElement('div'); ob.id = 'ob'; document.body.append(ob);
  if (typeof Drawer !== 'undefined') Drawer.close();
  if (typeof PhotoView !== 'undefined' && PhotoView.close) PhotoView.close();
  const st = { name: '', color: 'blue', partner: '', email: (L.auth && L.auth.email) || L.lastEmail || '' };
  let cur = null;
  const colors = () => `<div class="colors sm" data-ck="me">${PALETTE.slice(0, 10).map(c => `<button type="button" data-c="${c}" style="--c:var(--c-${c})" class="${c === st.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>`;
  const pw = (id, auto) => `<div class="ob-field"><label for="${id}">Password</label><div class="pw-wrap"><input id="${id}" type="password" autocomplete="${auto}" placeholder="${auto === 'new-password' ? 'At least 8 characters' : 'Your password'}"><button type="button" class="pw-eye" data-g="eye" aria-label="Show password">Show</button></div></div>`;
  const logo = `<svg class="ob-logo" viewBox="0 0 150 110" aria-hidden="true"><circle class="c1" cx="56" cy="55" r="40" fill="var(--c-blue)" opacity=".92"/><circle class="c2" cx="94" cy="55" r="40" fill="var(--c-pink)" opacity=".85"/>
      <path class="ck" d="M58 56l12 12 24-26" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const pages = {
    welcome: () => `<div class="ob-hero">${logo}<h1>Twodo</h1><p class="lead">Your to-dos, together.<br>Private, encrypted, made for two.</p></div>
      <div class="ob-actions"><button class="btn" data-g="go:create" type="button">Create account</button>
        <button class="btn ghost" data-g="go:signin" type="button">I already have an account</button></div>`,
    create: () => `<h1>Create your account</h1><p class="lead">Just for the two of you. Your password never leaves this phone.</p>
      <div class="ob-field"><label for="gName">Your name</label><input id="gName" autocomplete="given-name" maxlength="24" placeholder="e.g. Alex" value="${esc(st.name)}">${colors()}</div>
      <div class="ob-field"><label for="gPartner">Partner’s name <span style="text-transform:none;font-weight:400">(optional)</span></label><input id="gPartner" maxlength="24" placeholder="e.g. Sam" value="${esc(st.partner)}"></div>
      <div class="ob-field"><label for="gEmail">Email</label><input id="gEmail" type="email" autocomplete="email" autocapitalize="off" placeholder="you@example.com" value="${esc(st.email)}"></div>
      ${pw('gPass', 'new-password')}
      <div class="err" id="gErr"></div><div class="spacer"></div>
      <button class="btn" data-g="create" type="button">Create account</button><button class="btn ghost" data-g="go:welcome" type="button">Back</button>`,
    signin: () => `<h1>Welcome back</h1><p class="lead">Sign in to get your lists and your pairing back.</p>
      <div class="ob-field"><label for="gEmail">Email</label><input id="gEmail" type="email" autocomplete="email" autocapitalize="off" placeholder="you@example.com" value="${esc(st.email)}"></div>
      ${pw('gPass', 'current-password')}
      <div class="err" id="gErr"></div>
      <button class="btn ghost" data-g="forgot" type="button" style="height:auto;padding:0;margin:-6px 0 0;font-size:15px;width:auto;align-self:flex-start">Forgot password?</button>
      <div class="spacer"></div>
      <button class="btn" data-g="signin" type="button">Sign in</button><button class="btn ghost" data-g="go:welcome" type="button">Back</button>`,
    username: () => `<h1>Pick your username</h1><p class="lead">${esc(firstWord(ptName()) === 'Partner' ? 'Your partner' : firstWord(ptName()))} will find you by this. It has to be unique.</p>
      <div class="ob-field"><label for="gUser">Username</label><div class="pw-wrap"><span class="at">@</span><input id="gUser" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" style="padding-left:34px"
        placeholder="${esc(normUsername(firstWord(myName())).replace(/[^a-z0-9_.]/g, '') || 'yourname')}"><span class="pw-eye" id="gOk" style="background:none"></span></div></div>
      <div class="err" id="gErr"></div><div class="spacer"></div><button class="btn" data-g="username" type="button">Continue</button>`,
    ready: () => `<h1>You’re in, ${esc(firstWord(myName()))} 💞</h1><p class="lead">A few things that make Twodo feel like magic:</p>
      <ul class="tips">
        <li><span class="e">💌</span><div>Pair with ${esc(firstWord(ptName()) === 'Partner' ? 'your partner' : firstWord(ptName()))}<small>Tap “Add partner” on Home and search their @username.</small></div></li>
        <li><span class="e">✓</span><div>To-dos, one tap away<small>Tap ✓ at the top and just type: “Movie night fri 8pm @us !!”.</small></div></li>
        <li><span class="e">👉</span><div>Swipe right to complete<small>Swipe left to pin or delete. Long-press for more.</small></div></li>
        <li><span class="e">💬</span><div>Home is your chat<small>See when they’re online. A filled ♥ means they’ve seen your message.</small></div></li>
      </ul><div class="spacer"></div><button class="btn" data-g="done" type="button">Start using Twodo</button>
      <button class="btn ghost" data-g="tips" type="button">💡 Show me all the tips</button>`,
  };
  const order = ['welcome', 'create', 'signin', 'username', 'ready'];
  function show(name) {
    const back = cur && order.indexOf(name) < order.indexOf(cur.dataset.p);
    const p = document.createElement('div');
    p.className = 'ob-page ' + (cur ? (back ? 'left' : 'right') : ''); p.dataset.p = name; p.innerHTML = pages[name]();
    ob.append(p);
    if (cur) { const old = cur; old.classList.add(back ? 'right' : 'left'); setTimeout(() => old.remove(), 600); void p.offsetWidth; p.classList.remove('left', 'right'); }
    cur = p;
    const first = p.querySelector('input'); if (first && !isTouch) setTimeout(() => first.focus(), 350);
  }
  function enter(msg) {
    L.onboarded = true; save();
    ob.classList.add('out'); setTimeout(() => ob.remove(), 600);
    boot(); if (msg) setTimeout(() => island(msg), 500);
  }
  const err = t => { const e = cur.querySelector('#gErr'); if (e) e.textContent = t || ''; if (t) haptic('warn'); };
  const val = id => (cur.querySelector('#' + id) || {}).value || '';

  let unT;
  ob.addEventListener('input', e => {
    if (e.target.id === 'gName') st.name = e.target.value.trim();
    if (e.target.id === 'gPartner') st.partner = e.target.value.trim();
    if (e.target.id === 'gEmail') st.email = e.target.value.trim();
    if (e.target.id !== 'gUser') err('');
    if (e.target.id === 'gUser') {
      const v = normUsername(e.target.value).replace(/[^a-z0-9_.]/g, ''); if (e.target.value !== v) e.target.value = v;
      const ok = cur.querySelector('#gOk'); ok.textContent = ''; err(''); clearTimeout(unT);
      if (USERNAME_RE.test(v)) unT = setTimeout(async () => { try { const free = await usernameFree(v); if (e.target.value === v) { ok.textContent = free ? '✅' : '❌'; if (!free) err(`@${v} is taken.`); } } catch (x) { /* ignore */ } }, 350);
    }
  });
  ob.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    const btn = cur.querySelector('[data-g="create"], [data-g="signin"], [data-g="username"]'); if (btn) { e.preventDefault(); btn.click(); }
  });
  ob.addEventListener('click', async e => {
    const c = e.target.closest('[data-c]');
    if (c) {
      st.color = c.dataset.c; c.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === c));
      document.documentElement.style.setProperty('--accent', `var(--c-${st.color})`); haptic('light'); return;
    }
    const b = e.target.closest('[data-g]'); if (!b || b.disabled) return;
    const g = b.dataset.g;
    if (g.startsWith('go:')) { show(g.slice(3)); haptic('light'); return; }
    if (g === 'eye') { const i = b.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; return; }
    if (g === 'forgot') {
      await confirmDialog({ title: 'Forgot your password?', message: 'Twodo can’t reset it — your password is your encryption key, and nobody else has it. Whoever owns the Firebase project can delete your account (Authentication → Users) so you can create it again and re-pair. Tasks on this phone are kept.', ok: 'OK', cancel: null });
      return;
    }
    if (g === 'create') {
      const name = val('gName').trim(), email = val('gEmail').trim(), pass = val('gPass');
      if (!name) return err('Enter your name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return err('Enter a valid email.');
      if (pass.length < 8) return err('Use at least 8 characters for your password.');
      err('');
      return busy(b, async () => {
        try { await signUp(email, pass, { name, color: st.color, partner: st.partner }); haptic('success'); show('username'); }
        catch (x) { err(x.message); }
      });
    }
    if (g === 'signin') {
      const email = val('gEmail').trim(), pass = val('gPass');
      if (!/^\S+@\S+\.\S+$/.test(email)) return err('Enter a valid email.');
      if (!pass) return err('Enter your password.');
      err('');
      return busy(b, async () => {
        try {
          await signIn(email, pass); haptic('success');
          if (!L.auth.username) show('username'); else enter({ e: '🔓', text: `Welcome back, ${firstWord(myName())}`, sub: '@' + L.auth.username });
        } catch (x) { err(x.message); }
      });
    }
    if (g === 'username') {
      const v = val('gUser') || cur.querySelector('#gUser').placeholder;
      return busy(b, async () => {
        try { await claimUsername(v); haptic('success'); show('ready'); }
        catch (x) { err(x.message); }
      });
    }
    if (g === 'done') { haptic('success'); enter({ e: '✨', text: `You’re @${L.auth.username}`, sub: 'Share it with your partner to pair' }); }
    if (g === 'tips') { haptic('light'); enter(); setTimeout(() => openTips(), 420); }
  });
  show(first);
}
