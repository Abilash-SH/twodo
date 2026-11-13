'use client';
/* Twodo · the sign-in gate: the first screen when accounts are configured and nobody is signed in */
import { useEffect, useRef, useState } from 'react';
import { claimUsername, signIn, signUp } from '@/lib/account';
import { haptic } from '@/lib/feedback';
import type { IslandMsg } from '@/lib/bridge';
import { CreateAccountForm, SignInForm, firstError } from '@/lib/schemas';
import { L, myName, ptName, save } from '@/lib/store';
import { PALETTE, firstWord, isTouch, type Color } from '@/lib/util';
import { confirmDialog } from '@/ui/alert';
import { boot, gateStore, type GatePage } from '@/ui/gate';
import { island } from '@/ui/island';
import { openTips } from '@/ui/nav';
import { PhotoView } from '@/ui/photos';
import { usernamePlaceholder, useUsernameCheck } from '../settings/AccountSheets';
import { colorVar } from '../ui/Avatar';
import { BusyButton } from '../ui/Busy';
import { Logo, ObPages, useObPages } from './ObPages';

const ORDER: GatePage[] = ['welcome', 'create', 'signin', 'username', 'ready'];

function Password({ id, auto }: { id: string; auto: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ob-field"><label htmlFor={id}>Password</label><div className="pw-wrap">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={auto} placeholder={auto === 'new-password' ? 'At least 8 characters' : 'Your password'} maxLength={1024} />
      <button type="button" className="pw-eye" aria-label="Show password" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button></div></div>
  );
}

export function Gate({ first }: { first: GatePage }) {
  const wrap = useRef<HTMLDivElement>(null);
  const { pages, setPages, cur, show } = useObPages(first, ORDER);
  const st = useRef({ name: '', color: 'blue' as Color, partner: '', email: (L.auth && L.auth.email) || L.lastEmail || '' });
  const [err, setErr] = useState(''), [color, setColor] = useState<Color>('blue'), [out, setOut] = useState(false);
  const un = useUsernameCheck();
  useEffect(() => { PhotoView.close?.(); }, []);
  useEffect(() => { setErr(''); un.setErr(''); const t = setTimeout(() => { if (!isTouch()) wrap.current?.querySelector<HTMLInputElement>(`.ob-page[data-p="${cur}"] input`)?.focus(); }, 350); return () => clearTimeout(t); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (p: GatePage) => { show(p); haptic('light'); };
  const val = (id: string) => (wrap.current?.querySelector<HTMLInputElement>(`.ob-page[data-p="${cur}"] #${id}`)?.value) || '';
  const fail = (t: string) => { setErr(t); if (t) haptic('warn'); };
  const enter = (msg?: IslandMsg) => {
    L.onboarded = true; save();
    setOut(true); setTimeout(() => gateStore.set(null), 600);
    boot.run(); if (msg) setTimeout(() => island(msg), 500);
  };
  const submitBtn = () => wrap.current?.querySelector<HTMLButtonElement>(`.ob-page[data-p="${cur}"] [data-submit]`);

  const page = (name: string) => {
    const e = name === cur ? err || un.err : '';
    switch (name as GatePage) {
      case 'welcome': return (<>
        <div className="ob-hero"><Logo /><h1>Twodo</h1><p className="lead">Your to-dos, together.<br />Private, encrypted, made for two.</p></div>
        <div className="ob-actions"><button className="btn" type="button" onClick={() => go('create')}>Create account</button>
          <button className="btn ghost" type="button" onClick={() => go('signin')}>I already have an account</button></div></>);
      case 'create': return (<>
        <h1>Create your account</h1><p className="lead">Just for the two of you. Your password never leaves this phone.</p>
        <div className="ob-field"><label htmlFor="gName">Your name</label><input id="gName" autoComplete="given-name" maxLength={24} placeholder="e.g. Alex" defaultValue={st.current.name} onInput={ev => { st.current.name = ev.currentTarget.value.trim(); setErr(''); }} />
          <div className="colors sm" data-ck="me">{PALETTE.slice(0, 10).map(c => <button key={c} type="button" style={colorVar(c)} className={c === color ? 'on' : ''} aria-label={c}
            onClick={() => { st.current.color = c; setColor(c); document.documentElement.style.setProperty('--accent', `var(--c-${c})`); haptic('light'); }} />)}</div></div>
        <div className="ob-field"><label htmlFor="gPartner">Partner’s name <span className="tw:normal-case tw:font-normal">(optional)</span></label><input id="gPartner" maxLength={24} placeholder="e.g. Sam" defaultValue={st.current.partner} onInput={ev => { st.current.partner = ev.currentTarget.value.trim(); }} /></div>
        <div className="ob-field"><label htmlFor="gEmail">Email</label><input id="gEmail" type="email" autoComplete="email" autoCapitalize="off" placeholder="you@example.com" maxLength={254} defaultValue={st.current.email} onInput={ev => { st.current.email = ev.currentTarget.value.trim(); setErr(''); }} /></div>
        <Password id="gPass" auto="new-password" />
        <div className="err">{e}</div><div className="spacer" />
        <BusyButton className="btn" data-submit="" onRun={async () => {
          const form = { name: val('gName'), partner: val('gPartner'), email: val('gEmail'), password: val('gPass') };
          const bad = firstError(CreateAccountForm.safeParse(form)); if (bad) return fail(bad);
          fail('');
          try { await signUp(form.email, form.password, { name: form.name.trim(), color: st.current.color, partner: form.partner.trim() }); haptic('success'); show('username'); }
          catch (x) { fail((x as Error).message); }
        }}>Create account</BusyButton>
        <button className="btn ghost" type="button" onClick={() => go('welcome')}>Back</button></>);
      case 'signin': return (<>
        <h1>Welcome back</h1><p className="lead">Sign in to get your lists and your pairing back.</p>
        <div className="ob-field"><label htmlFor="gEmail">Email</label><input id="gEmail" type="email" autoComplete="email" autoCapitalize="off" placeholder="you@example.com" maxLength={254} defaultValue={st.current.email} onInput={ev => { st.current.email = ev.currentTarget.value.trim(); setErr(''); }} /></div>
        <Password id="gPass" auto="current-password" />
        <div className="err">{e}</div>
        <button className="btn ghost" type="button" style={{ height: 'auto', padding: 0, margin: '-6px 0 0', fontSize: 15, width: 'auto', alignSelf: 'flex-start' }} onClick={() => void confirmDialog({ title: 'Forgot your password?', message: 'Twodo can’t reset it — your password is your encryption key, and nobody else has it. Whoever owns the Firebase project can delete your account (Authentication → Users) so you can create it again and re-pair. Tasks on this phone are kept.', ok: 'OK', cancel: null })}>Forgot password?</button>
        <div className="spacer" />
        <BusyButton className="btn" data-submit="" onRun={async () => {
          const form = { email: val('gEmail'), password: val('gPass') };
          const bad = firstError(SignInForm.safeParse(form)); if (bad) return fail(bad);
          fail('');
          try {
            await signIn(form.email, form.password); haptic('success');
            if (!L.auth!.username) show('username'); else enter({ e: '🔓', text: `Welcome back, ${firstWord(myName())}`, sub: '@' + L.auth!.username });
          } catch (x) { fail((x as Error).message); }
        }}>Sign in</BusyButton>
        <button className="btn ghost" type="button" onClick={() => go('welcome')}>Back</button></>);
      case 'username': return (<>
        <h1>Pick your username</h1><p className="lead">{firstWord(ptName()) === 'Partner' ? 'Your partner' : firstWord(ptName())} will find you by this. It has to be unique.</p>
        <div className="ob-field"><label htmlFor="gUser">Username</label><div className="pw-wrap"><span className="at">@</span>
          <input id="gUser" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={20} style={{ paddingLeft: 34 }} placeholder={usernamePlaceholder()} onInput={ev => un.onInput(ev.currentTarget, false)} />
          <span className="pw-eye" style={{ background: 'none' }}>{un.ok}</span></div></div>
        <div className="err">{e}</div><div className="spacer" />
        <BusyButton className="btn" data-submit="" onRun={async () => {
          const inp = wrap.current!.querySelector<HTMLInputElement>('#gUser')!;
          try { await claimUsername(inp.value || inp.placeholder); haptic('success'); show('ready'); }
          catch (x) { fail((x as Error).message); }
        }}>Continue</BusyButton></>);
      case 'ready': return (<>
        <h1>You’re in, {firstWord(myName())} 💞</h1><p className="lead">A few things that make Twodo feel like magic:</p>
        <ul className="tips">
          <li><span className="e">💌</span><div>Pair with {firstWord(ptName()) === 'Partner' ? 'your partner' : firstWord(ptName())}<small>Tap “Add partner” on Home and search their @username.</small></div></li>
          <li><span className="e">✅</span><div>To-dos, one tap away<small>Tap the button at the top right and just type: “Movie night fri 8pm @us !!”.</small></div></li>
          <li><span className="e">👉</span><div>Swipe right to complete<small>Swipe left to pin or delete. Long-press for more.</small></div></li>
          <li><span className="e">📌</span><div>Home is your board<small>The latest message and today’s to-dos pin themselves there. Tap Message to chat.</small></div></li>
        </ul><div className="spacer" />
        <button className="btn" type="button" onClick={() => { haptic('success'); enter({ e: '✨', text: `You’re @${L.auth!.username}`, sub: 'Share it with your partner to pair' }); }}>Start using Twodo</button>
        <button className="btn ghost" type="button" onClick={() => { haptic('light'); enter(); setTimeout(() => openTips(), 420); }}>💡 Show me all the tips</button></>);
    }
  };
  return (
    <div id="ob" ref={wrap} className={out ? 'out' : undefined}
      onKeyDown={e => { if (e.key !== 'Enter' || (e.target as HTMLElement).tagName !== 'INPUT') return; const b = submitBtn(); if (b) { e.preventDefault(); b.click(); } }}>
      <ObPages pages={pages} setPages={setPages} render={page} wrap={wrap} />
    </div>
  );
}
