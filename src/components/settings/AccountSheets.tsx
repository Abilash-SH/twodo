'use client';
/* Twodo · account and pairing sheets: sign in / create account, username, invite, partner requests, push keys */
import { useEffect, useRef, useState } from 'react';
import { claimUsername, signIn, signUp, usernameFree } from '@/lib/account';
import { b64, unb64url } from '@/lib/crypto';
import { confetti, haptic } from '@/lib/feedback';
import { Auth, USERNAME_RE, normUsername } from '@/lib/firebase';
import { Pair, type PairTarget, type ReviewedRequest } from '@/lib/pair';
import { renderNow } from '@/lib/render';
import { SignInForm, SignUpForm, firstError } from '@/lib/schemas';
import { L, myName, ptName } from '@/lib/store';
import { Inbox } from '@/lib/sync';
import { copyText, firstWord, isTouch } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { closeSheet, focusWhenOpen, openSheet } from '@/ui/sheet';
import { cssVars, PlainAvatar, Sq } from '../ui/Avatar';
import { BusyButton } from '../ui/Busy';
import { Icon } from '../ui/Icon';
import { openSettings } from './Settings';

const BackToSettings = () => <button className="nav-btn" type="button" data-back="" onClick={() => openSettings()}><Icon name="chevL" />Settings</button>;
const fail = (e: unknown, ms = 4500) => { island({ e: '⚠️', text: (e as Error).message, ms }); haptic('warn'); };
const delayFocus = (r: React.RefObject<HTMLInputElement | null>) => focusWhenOpen(r.current);

/* ---------- Sign in / create account (from Settings, when signed out) ---------- */
function AuthForm({ up }: { up: boolean }) {
  const email = useRef<HTMLInputElement>(null), pass = useRef<HTMLInputElement>(null), goRef = useRef<HTMLButtonElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => delayFocus(email), []);
  const run = async () => {
    setErr('');
    const form = { email: email.current!.value, password: pass.current!.value };
    const bad = firstError((up ? SignUpForm : SignInForm).safeParse(form)); if (bad) { setErr(bad); return; }
    try {
      await (up ? signUp(form.email, form.password) : signIn(form.email, form.password));
      haptic('success');
      if (!L.auth!.username) openUsernameSheet(); else { openSettings(); island({ e: '🔓', text: `Welcome back, @${L.auth!.username}` }); }
    } catch (e) { setErr((e as Error).message); haptic('warn'); }
  };
  return (<>
    <div className="big-ic" style={cssVars({ '--c': 'var(--accent)' })}>{up ? '💞' : '🔐'}</div>
    <div className="group">
      <div className="cell"><Sq c="blue" i="person" /><input ref={email} className="inp" type="email" autoComplete="email" autoCapitalize="off" placeholder="Email" aria-label="Email" maxLength={254} /></div>
      <div className="cell"><Sq c="gray" i="key" /><input ref={pass} className="inp" type="password" autoComplete={up ? 'new-password' : 'current-password'} placeholder={`Password${up ? ' (8+ characters)' : ''}`} aria-label="Password"
        onKeyDown={e => { if (e.key === 'Enter') goRef.current?.click(); }} /></div>
    </div>
    <div className="err" style={{ margin: '-12px 32px 12px' }}>{err}</div>
    <div className="tw:px-4"><BusyButton ref={goRef} className="btn" onRun={run}>{up ? 'Create account' : 'Sign in'}</BusyButton></div>
    <p className="note-s" style={{ marginTop: 14 }}>{up
      ? 'Your password never leaves this phone. Twodo turns it into a separate login secret plus an encryption key, so not even Firebase can read your tasks. If you forget it, see the README.'
      : 'Signing in on a new phone restores your encrypted lists and your pairing.'}</p>
  </>);
}
export function openAuthSheet(mode: 'signup' | 'signin'): void {
  const up = mode === 'signup';
  openSheet({ title: up ? 'Create account' : 'Sign in', right: '', left: <BackToSettings />, body: <AuthForm key={mode} up={up} /> });
}

/* ---------- Username ---------- */
export function useUsernameCheck() {
  const [ok, setOk] = useState(''), [err, setErr] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onInput = (inp: HTMLInputElement, short = true) => {
    const v = normUsername(inp.value).replace(/[^a-z0-9_.]/g, '');
    if (inp.value !== v) inp.value = v;
    setErr(''); setOk(''); clearTimeout(t.current);
    if (!USERNAME_RE.test(v)) { if (v && short) setOk('3+'); return; }
    t.current = setTimeout(async () => { try { const free = await usernameFree(v); if (inp.value === v) { setOk(free ? '✅' : '❌'); if (!free) setErr(`@${v} is taken.`); } } catch { /* ignore */ } }, 350);
  };
  return { ok, err, setErr, onInput };
}
export const usernamePlaceholder = (): string => normUsername(firstWord(myName())).replace(/[^a-z0-9_.]/g, '') || 'yourname';
function UsernameForm() {
  const inp = useRef<HTMLInputElement>(null), { ok, err, setErr, onInput } = useUsernameCheck();
  useEffect(() => delayFocus(inp), []);
  return (<>
    <div className="big-ic" style={cssVars({ '--c': 'var(--accent)' })}>@</div>
    <p className="note-s" style={{ margin: '-4px 0 18px', textAlign: 'center' }}>Your partner finds you by this. It has to be unique.</p>
    <div className="group"><div className="cell"><span className="val" style={{ fontSize: 20 }}>@</span>
      <input ref={inp} className="inp" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={20} placeholder={usernamePlaceholder()} defaultValue={L.auth?.username || ''} aria-label="Username" onInput={e => onInput(e.currentTarget)} />
      <span className="val">{ok}</span></div></div>
    <div className="err" style={{ margin: '-12px 32px 12px' }}>{err}</div>
    <div className="tw:px-4"><BusyButton className="btn" onRun={async () => {
      try { const n = await claimUsername(inp.current!.value || inp.current!.placeholder); haptic('success'); openSettings(); island({ e: '✨', text: `You’re @${n}`, sub: `Share it with ${firstWord(ptName())} to pair` }); }
      catch (e) { setErr((e as Error).message); haptic('warn'); }
    }}>Save username</BusyButton></div>
  </>);
}
export function openUsernameSheet(): void { openSheet({ title: 'Your username', right: '', body: <UsernameForm /> }); }

/* ---------- Pairing ---------- */
const PersonBadge = ({ name, color, sub }: { name: string; color: string; sub: string }) => (
  <div className="tw:text-center tw:mt-1 tw:mb-[18px]">
    <PlainAvatar name={name} color={color} style={{ width: 72, height: 72, lineHeight: '72px', fontSize: 30, display: 'block', margin: '0 auto 10px' }} />
    <div className="tw:text-[22px] tw:font-bold">{name}</div><div className="val">{sub}</div></div>
);
const CodeBox = ({ code, who }: { code: string; who: string }) => (
  <div className="group"><div className="cell" style={{ flexDirection: 'column', alignItems: 'center', padding: '14px 16px' }}>
    <span className="val" style={{ fontSize: 13 }}>SAFETY CODE</span><span className="code-box" style={{ fontSize: 30, letterSpacing: 3, margin: '4px 0' }}>{code}</span>
    <span className="val" style={{ fontSize: 13, textAlign: 'center' }}>Check that {who} sees exactly the same code. If it’s different, don’t continue.</span></div></div>
);
export function openPairSheet(t: PairTarget): void {
  openSheet({
    title: 'Invite to pair', right: '', left: <BackToSettings />,
    body: (<>
      <PersonBadge name={t.name} color={t.color} sub={'@' + t.username} /><CodeBox code={t.code} who={firstWord(t.name)} />
      <div className="tw:px-4"><BusyButton className="btn" onRun={async () => {
        try { await Pair.send(t); haptic('success'); openSettings(); island({ e: '💌', text: `Request sent to ${t.name}`, sub: `Safety code ${t.code}`, ms: 5000 }); }
        catch (e) { island({ e: '⚠️', text: (e as Error).message }); }
      }}>Send pairing request</BusyButton></div>
      <p className="note-s" style={{ marginTop: 14 }}>Once {firstWord(t.name)} accepts, you’ll share every list except Secret ones. Only your two accounts can access them.</p>
    </>),
  });
}
export function openRequestSheet(r: ReviewedRequest): void {
  openSheet({
    title: 'Pairing request', right: '', left: <BackToSettings />,
    body: (<>
      <PersonBadge name={r.name} color={r.color} sub={'@' + r.username + ' wants to pair with you'} /><CodeBox code={r.code} who={firstWord(r.name)} />
      <div className="tw:px-4 tw:flex tw:flex-col tw:gap-2">
        <BusyButton className="btn" onRun={async () => {
          try { await Pair.accept(r); haptic('success'); confetti(); closeSheet(); island({ e: '💞', text: `Paired with ${r.name}`, sub: 'Your lists now sync in real time' }); }
          catch (e) { island({ e: '⚠️', text: (e as Error).message }); }
        }}>Accept</BusyButton>
        <BusyButton className="btn ghost" style={{ color: 'var(--c-red)' }} onRun={async () => { try { await Pair.decline(r); openSettings(); } catch (e) { island({ e: '⚠️', text: (e as Error).message }); } }}>Decline</BusyButton>
      </div>
      <p className="note-s" style={{ marginTop: 14 }}>Accepting merges the tasks on this phone into your shared lists. Secret lists stay private.</p>
    </>),
  });
}

/* ---------- One-time push setup: the VAPID key pair is made right here on the phone, so the private key
   goes straight from the clipboard into GitHub Secrets and nowhere else. ---------- */
async function genVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = new Uint8Array([4, ...unb64url(jwk.x!), ...unb64url(jwk.y!)]);
  return { publicKey: b64(pub).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), privateKey: jwk.d! };
}
function KeyRow({ label, val, c }: { label: React.ReactNode; val: string; c: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="cell" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '12px 16px' }}>
      <span className="val" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span className="code-box" style={{ fontSize: 13, userSelect: 'all', WebkitUserSelect: 'all' }}>{val}</span>
      <button className="btn-s" type="button" style={{ alignSelf: 'flex-start', background: `var(--c-${c})` }} onClick={async () => { if (await copyText(val)) { setCopied(true); haptic('success'); } }}>{copied ? 'Copied ✓' : 'Copy'}</button>
    </div>
  );
}
export async function openVapidSheet(): Promise<void> {
  const k = await genVapid();
  openSheet({
    title: 'Push reminder keys', right: 'Done', tall: true, left: <BackToSettings />,
    body: (<>
      <p className="note-s" style={{ margin: '0 0 16px' }}>Made on this phone just now and not saved anywhere. Follow README → “Push reminders”.</p>
      <div className="group"><KeyRow label={<>1 · PUBLIC KEY → <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> and secret VAPID_PUBLIC_KEY</>} val={k.publicKey} c="blue" /></div>
      <div className="group"><KeyRow label="2 · PRIVATE KEY → secret VAPID_PRIVATE_KEY only. Never put this in the app’s configuration." val={k.privateKey} c="red" /></div>
      <p className="note-s">If you close this before saving both, just open it again for a fresh pair.</p>
    </>),
  });
}

/* ---------- Add partner: friend-request style. Search a username → Add → they Accept or Decline. ---------- */
function ReqCard({ av, title, sub, children }: { av: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return <div className="fr-card">{av}<div className="fr-t"><b>{title}</b><span>{sub}</span></div><div className="fr-a">{children}</div></div>;
}
function AddPartner() {
  useApp();
  const [found, setFound] = useState<PairTarget | null>(null);
  const user = useRef<HTMLInputElement>(null), searchBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { Inbox.onChange = () => renderNow(); return () => { Inbox.onChange = null; }; }, []);
  const inc = Inbox.incoming(), p = L.pair;
  const failX = (x: unknown) => fail(x, 4000);
  return (<>
    {inc.length ? (<><div className="sec-h sub">Partner requests</div><div className="group fr">{inc.map(([uid, r]) => (
      <ReqCard key={uid} av={<PlainAvatar name={r.name} color={r.color} />} title={String(r.name)} sub={'@' + r.username + ' wants to add you'}>
        <BusyButton className="btn-s" onRun={async () => {
          try {
            const rr = await Pair.review(uid);
            if (!(await confirmDialog({ title: `Add ${rr.name}?`, message: `Check ${firstWord(rr.name)} sees this code too: ${rr.code}`, ok: 'Accept' }))) return;
            await Pair.accept(rr); haptic('success'); confetti(); closeSheet(); island({ e: '💞', text: `You and ${rr.name} are paired`, sub: 'Your lists now sync in real time' });
          } catch (x) { failX(x); }
        }}>Accept</BusyButton>
        <BusyButton className="btn-s gray" onRun={async () => { try { await Pair.decline(await Pair.review(uid)); } catch (x) { failX(x); } }}>Decline</BusyButton>
      </ReqCard>))}</div></>) : null}
    {p && p.status === 'sent' ? (<><div className="sec-h sub">Sent</div><div className="group fr">
      <ReqCard av={<PlainAvatar name={p.name} color="pink" />} title={p.name} sub={'@' + p.username + ' · Requested' + (p.code ? ` · code ${p.code}` : '')}>
        <BusyButton className="btn-s gray" onRun={async () => { try { await Pair.cancel(); renderNow(); } catch (x) { failX(x); } }}>Cancel</BusyButton></ReqCard></div></>) : (<>
      <div className="sec-h sub">Find your partner</div>
      <div className="group"><div className="cell"><span className="val" style={{ fontSize: 20 }}>@</span>
        <input ref={user} className="inp" placeholder="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" maxLength={21} aria-label="Partner username"
          onKeyDown={e => { if (e.key === 'Enter') searchBtn.current?.click(); }} />
        <BusyButton ref={searchBtn} className="btn-s" onRun={async () => { try { setFound(await Pair.lookup(user.current!.value)); } catch (x) { failX(x); } }}>Search</BusyButton></div></div>
      {found ? <div className="group fr"><ReqCard av={<PlainAvatar name={found.name} color={found.color} />} title={found.name} sub={'@' + found.username}>
        <BusyButton className="btn-s" onRun={async () => {
          try { await Pair.send(found); setFound(null); haptic('success'); island({ e: '💌', text: `Request sent to ${L.pair!.name}`, sub: `Code ${L.pair!.code}` }); } catch (x) { failX(x); }
        }}><Icon name="plus" cls="xs" /> Add</BusyButton></ReqCard></div> : null}
    </>)}
    <div className="sec-h sub">Your username</div>
    <div className="group"><div className="cell"><span className="grow" style={{ fontSize: 20, fontWeight: 700 }}>@{L.auth?.username}</span>
      <button className="btn-s gray" type="button" onClick={async () => {
        const text = `Add me on Twodo 💞 My username is @${L.auth!.username}\n${location.origin}${location.pathname}`;
        if (navigator.share) { try { await navigator.share({ text }); return; } catch (x) { if ((x as Error).name === 'AbortError') return; } }
        if (await copyText(text)) island({ e: '📋', text: 'Copied', ms: 1500 });
      }}>Share</button></div></div>
    <p className="note-s">Once they accept, you share every list except Secret ones. You’ll each see the same 8-digit code. If it matches, nobody tampered with the request.</p>
  </>);
}
export function openInviteSheet(): void {
  if (!Auth.user()) return openSettings();
  if (!L.auth!.username) return openUsernameSheet();
  if (L.pair && L.pair.status === 'paired') { island({ e: '💞', text: `You’re already paired with ${L.pair.name}` }); return; }
  openSheet({ title: 'Add partner', right: 'Done', tall: true, body: <AddPartner /> });
}
