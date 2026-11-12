'use client';
/* Twodo · locking secret lists: a passcode keypad (no keyboard needed), Face ID, and the lock screen a secret list
   shows while it's locked. The cryptography lives in lib/vault.ts. */
import { useEffect, useRef, useState } from 'react';
import { blip, haptic } from '@/lib/feedback';
import { renderNow } from '@/lib/render';
import { D } from '@/lib/store';
import { PIN_LEN, Vault, VaultError } from '@/lib/vault';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { closeSheet, openSheet } from '@/ui/sheet';
import { Sq } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

type Mode = 'unlock' | 'create' | 'change';
type Step = 'current' | 'new' | 'confirm' | 'bio';

/** Is this list hidden behind the lock right now? (a locked secret list isn't even in memory) */
export function vaultBlocks(listId: string | undefined): boolean {
  if (!listId) return false;
  const l = D.lists[listId];
  if (!l) return Vault.locked();
  return !!l.private && !l.deleted && !Vault.unlocked();
}

const secs = (ms: number) => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`; };
const bioFail = (e: unknown) => {
  const code = e instanceof VaultError ? e.code : '';
  island({ e: '🔒', text: code === 'unsupported' ? 'Face ID can’t unlock secret lists on this phone' : 'Face ID didn’t unlock', sub: code === 'unsupported' ? 'Use your passcode instead' : 'Try again, or use your passcode', ms: 3200 });
  haptic('warn');
};

export async function unlockWithBio(): Promise<boolean> {
  try { await Vault.unlockBio(); haptic('success'); blip('chime'); renderNow(); return true; }
  catch (e) { bioFail(e); return false; }
}

function Pad({ mode, then }: { mode: Mode; then?: () => void }) {
  const [step, setStep] = useState<Step>(mode === 'change' ? 'current' : mode === 'create' ? 'new' : 'current');
  const [pin, setPin] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [shake, setShake] = useState(0);
  const [wait, setWait] = useState(() => Vault.waitLeft()), [bio, setBio] = useState(false);
  const first = useRef('');
  useEffect(() => { if (!wait) return; const t = setInterval(() => setWait(Vault.waitLeft()), 500); return () => clearInterval(t); }, [wait]);
  useEffect(() => { if (step === 'bio') return; void Vault.bioAvailable().then(setBio); }, [step]);

  const wrong = (text: string) => { setPin(''); setMsg(text); setShake(n => n + 1); haptic('warn'); };
  const done = (text: string, sub?: string) => {
    haptic('success'); blip('chime'); island({ e: '🔒', text, sub, ms: 2600 });
    closeSheet(); renderNow(); then?.();
  };
  const submit = async (p: string) => {
    setBusy(true);
    try {
      if (step === 'current') {
        if (mode === 'unlock') { await Vault.unlock(p); haptic('success'); closeSheet(); renderNow(); then?.(); return; }
        // change: prove you know the current one (this also unlocks)
        if (Vault.locked()) await Vault.unlock(p); else if (!(await Vault.check(p))) { wrong('Wrong passcode'); setWait(Vault.waitLeft()); return; }
        setStep('new'); setPin(''); setMsg(''); return;
      }
      if (step === 'new') { first.current = p; setStep('confirm'); setPin(''); setMsg(''); return; }
      if (step === 'confirm') {
        if (p !== first.current) { setStep('new'); wrong('Passcodes didn’t match. Try again.'); return; }
        if (mode === 'create') {
          await Vault.create(p);
          if (bio) { setStep('bio'); setPin(''); haptic('success'); return; }
          done('Secret lists are locked', 'Only your passcode opens them'); return;
        }
        await Vault.changePin(p); done('Passcode changed'); return;
      }
    } catch (e) {
      const err = e instanceof VaultError ? e : null;
      if (err && err.code === 'wait') { setWait(err.wait); wrong(''); }
      else wrong('Wrong passcode');
    } finally { setBusy(false); }
  };
  const key = (d: string) => {
    if (busy || wait) return;
    haptic('light');
    setMsg('');
    const p = (pin + d).slice(0, PIN_LEN); setPin(p);
    if (p.length === PIN_LEN) setTimeout(() => void submit(p), 120); // let the last dot fill first
  };
  const back = () => { if (!busy && pin) { setPin(pin.slice(0, -1)); haptic('light'); } };
  // a hardware keyboard works too
  const keyRef = useRef(key), backRef = useRef(back); keyRef.current = key; backRef.current = back;
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (/^[0-9]$/.test(e.key)) { e.preventDefault(); keyRef.current(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); backRef.current(); } };
    addEventListener('keydown', kd); return () => removeEventListener('keydown', kd);
  }, []);

  if (step === 'bio') return (
    <div className="vault-pad">
      <div className="vault-ic big"><Icon name="faceid" /></div>
      <h3 className="vault-h">Unlock with Face ID too?</h3>
      <p className="vault-p">Open secret lists with a glance. Your passcode always works as well.</p>
      <button className="btn" type="button" onClick={async () => {
        try { await Vault.enableBio(); done('Secret lists are locked', 'Face ID or your passcode opens them'); }
        catch (e) { bioFail(e); done('Secret lists are locked', 'Only your passcode opens them'); }
      }}>Turn on Face ID</button>
      <button className="btn ghost" type="button" onClick={() => done('Secret lists are locked', 'Only your passcode opens them')}>Not now</button>
    </div>
  );
  const title = step === 'current' ? (mode === 'change' ? 'Enter your current passcode' : 'Enter passcode')
    : step === 'new' ? (mode === 'change' ? 'Choose a new passcode' : 'Create a passcode') : 'Enter it once more';
  const sub = wait ? `Too many tries. Try again in ${secs(wait)}.` : msg || (step === 'new' ? `${PIN_LEN} digits. If you forget it, secret lists can’t be recovered.` : busy ? 'Checking…' : ' ');
  return (
    <div className="vault-pad">
      <div className="vault-ic"><Icon name={step === 'current' ? 'lock' : 'shield'} /></div>
      <h3 className="vault-h">{title}</h3>
      <div key={shake} className={`pin-dots${shake ? ' shake' : ''}${busy ? ' busy' : ''}`} aria-label={`${pin.length} of ${PIN_LEN} digits entered`}>
        {Array.from({ length: PIN_LEN }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      <p className={`vault-p${msg || wait ? ' warn' : ''}`} role="status">{sub}</p>
      <div className="keypad" role="group" aria-label="Passcode keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} type="button" disabled={!!wait} onClick={() => key(d)}>{d}</button>)}
        {mode === 'unlock' && Vault.hasBio() ? <button type="button" className="kp-fn" aria-label="Unlock with Face ID" onClick={() => void unlockWithBio().then(ok => { if (ok) { closeSheet(); then?.(); } })}><Icon name="faceid" /></button> : <span />}
        <button type="button" disabled={!!wait} onClick={() => key('0')}>0</button>
        <button type="button" className="kp-fn" aria-label="Delete" onClick={back}><Icon name="backspace" /></button>
      </div>
      {mode === 'unlock' ? <button className="link-btn vault-forgot" type="button" onClick={() => void forgot()}>Forgot passcode?</button> : null}
    </div>
  );
}

async function forgot(): Promise<void> {
  const ok = await confirmDialog({
    title: 'Erase secret lists?', destructive: true, ok: 'Erase',
    message: 'Without the passcode nobody can open them, not even Twodo. Erasing removes them from this phone so you can start again. Your other lists aren’t touched.',
  });
  if (!ok) return;
  Vault.reset(); closeSheet(); island({ e: '🗑️', text: 'Secret lists erased' }); renderNow();
}

export function openVault(mode: Mode = 'unlock', then?: () => void): void {
  if (mode === 'unlock' && !Vault.exists()) mode = 'create';
  openSheet({
    title: mode === 'create' ? 'Secret lists' : mode === 'change' ? 'Change passcode' : 'Unlock',
    left: <button className="nav-btn" type="button" onClick={() => closeSheet()}>Cancel</button>, right: '',
    body: <Pad mode={mode} then={then} />,
  });
}

/** What a secret list shows while it's locked (or before a passcode exists) */
export function VaultGate() {
  const has = Vault.exists();
  return (
    <div className="empty vault-gate">
      <span className="e vault-lock"><Icon name="lock" /></span>
      <h3>{has ? 'Secret lists are locked' : 'Lock your secret lists'}</h3>
      <p>{has ? 'They stay encrypted on this phone, never synced, and lock again when you leave the app.'
        : 'Create a passcode to open them. They’re encrypted on this phone and never synced — surprises stay surprises 🎁'}</p>
      <div className="vault-acts">
        {has && Vault.hasBio() ? <button className="btn" type="button" onClick={() => void unlockWithBio()}><Icon name="faceid" cls="sm" /> Unlock with Face ID</button> : null}
        <button className={`btn${has && Vault.hasBio() ? ' tint' : ''}`} type="button" onClick={() => openVault(has ? 'unlock' : 'create')}>{has ? 'Enter passcode' : 'Create passcode'}</button>
      </div>
    </div>
  );
}

/** Settings → Secret lists */
export function VaultSettings() {
  const [bioOk, setBioOk] = useState(false), [, force] = useState(0);
  useEffect(() => { void Vault.bioAvailable().then(setBioOk); }, []);
  const has = Vault.exists(), open = Vault.unlocked();
  return (<>
    <div className="sec-h sub">Secret lists</div>
    <div className="group">
      {!has ? <button className="cell" type="button" onClick={() => openVault('create')}><Sq c="purple" i="lock" /><span className="grow">Set a passcode</span><Icon name="chevR" cls="chev" /></button> : (<>
        <button className="cell" type="button" onClick={() => openVault('change')}><Sq c="purple" i="key" /><span className="grow">Change passcode</span><Icon name="chevR" cls="chev" /></button>
        {bioOk ? <div className="cell"><Sq c="green" i="faceid" /><span className="grow">Unlock with Face ID</span>
          <input type="checkbox" className="switch" aria-label="Unlock with Face ID" checked={Vault.hasBio()} onChange={async e => {
            if (!e.target.checked) { Vault.disableBio(); force(n => n + 1); haptic('light'); return; }
            if (!Vault.unlocked()) { island({ e: '🔒', text: 'Unlock your secret lists first', sub: 'Then turn on Face ID' }); force(n => n + 1); return; }
            try { await Vault.enableBio(); haptic('success'); island({ e: '✅', text: 'Face ID can unlock secret lists' }); } catch (err) { bioFail(err); }
            force(n => n + 1);
          }} /></div> : null}
        {open ? <button className="cell" type="button" onClick={() => { void Vault.lock().then(() => { force(n => n + 1); island({ e: '🔒', text: 'Secret lists locked' }); }); }}><Sq c="gray" i="lock" /><span className="grow">Lock now</span></button> : null}
      </>)}
    </div>
    <p className="note-s">🔒 Secret lists are encrypted on this phone (AES-256-GCM, with a key made from your passcode) and never synced. They lock as soon as you leave the app, and their to-dos never show in Today, search or counts. If you forget the passcode, they can’t be recovered.</p>
  </>);
}
