'use client';
/* Twodo · Settings: your profile (only yours), Together (account, pairing, push), appearance, feel, backup */
import { useRef } from 'react';
import { signOut } from '@/lib/account';
import { cloudReady } from '@/lib/config';
import { KeyStore } from '@/lib/crypto';
import { haptic } from '@/lib/feedback';
import { Auth } from '@/lib/firebase';
import { Pair } from '@/lib/pair';
import { Push } from '@/lib/push';
import { renderNow, scheduleRender } from '@/lib/render';
import { D, L, cleanMap, cleanRecord, commit, ensureBasics, person, ptName, publicData, save, setPeopleRec } from '@/lib/store';
import { Vault } from '@/lib/vault';
import { Inbox, Sync } from '@/lib/sync';
import { applyTheme } from '@/lib/theme';
import type { List, PeopleRec, PersonKey, Task } from '@/lib/types';
import { PALETTE, downloadFile, firstWord, initial, isIOS, shortName, standalone, todayStr } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { openTips } from '@/ui/nav';
import { pickPhoto, viewPhoto } from '@/ui/photos';
import { sysNotify } from '@/ui/reminders';
import { closeSheet, openSheet } from '@/ui/sheet';
import { Avatar, colorVar, Sq } from '../ui/Avatar';
import { BusyButton } from '../ui/Busy';
import { Icon } from '../ui/Icon';
import { LearnMore } from '../ui/LearnMore';
import { Segmented } from '../ui/Segmented';
import { VaultSettings } from '../vault/VaultUI';
import { openAuthSheet, openInviteSheet, openUsernameSheet, openVapidSheet } from './AccountSheets';

// Your profile: only you can change your photo, name and colour. Your colour is the app's accent and your bubbles.
function Profile() {
  const k = L.me, p = person(k), u = Auth.user(), photoBtn = useRef<HTMLButtonElement>(null);
  return (
    <div className="me-prof" id="meProf">
      <button ref={photoBtn} className="pc-photo" type="button" aria-label="Your photo"
        onClick={() => (person(L.me).photo ? viewPhoto(L.me, photoBtn.current!.querySelector('.av')) : pickPhoto(L.me))}>
        <Avatar k={k} /><span className="pc-cam"><Icon name="camera" /></span></button>
      <input key={k} className="me-name" defaultValue={p.name} maxLength={24} aria-label="Your name" autoComplete="off"
        onInput={e => {
          const name = e.currentTarget.value.trim(); if (!name || !D.people) return;
          D.people[L.me] = { ...person(L.me), name }; commit(D.people);
          const av = photoBtn.current?.querySelector('.av'); if (av && !person(L.me).photo) av.textContent = initial(name);
        }} />
      {u && u.username ? <div className="me-handle">@{u.username}</div> : null}
      <div className="colors me-colors" role="radiogroup" aria-label="Your colour">{PALETTE.slice(0, 10).map(c => (
        <button key={c} type="button" style={colorVar(c)} className={c === p.color ? 'on' : ''} aria-label={c} onClick={() => {
          if (!D.people) setPeopleRec({ kind: 'people', id: 'people', a: person('a'), b: person('b'), updatedAt: 0 });
          D.people![L.me] = { ...person(L.me), color: c }; commit(D.people!);
          L.settings.accent = 'me'; save(); applyTheme(); renderNow(); haptic('light');
        }} />))}</div>
      <p className="me-hint">Your colour, on your messages and across Twodo.</p>
    </div>
  );
}

function Together() {
  if (!cloudReady()) return (<>
    <div className="group" id="syncWrap"><div className="cell"><Sq c="gray" i="cloud" /><span className="grow">Accounts &amp; sync are off</span></div></div>
    <p className="note-s">Add Firebase details to sync (see the README).</p>
  </>);
  const u = Auth.user();
  if (!u) return (<>
    <div className="group" id="syncWrap">
      <button className="cell" type="button" onClick={() => openAuthSheet('signup')}><Sq c="green" i="person" /><span className="grow">Create an account</span><Icon name="chevR" cls="chev" /></button>
      <button className="cell" type="button" onClick={() => openAuthSheet('signin')}><Sq c="blue" i="key" /><span className="grow">Sign in</span><Icon name="chevR" cls="chev" /></button></div>
    <p className="note-s">Pair with {firstWord(ptName())} by username. Everything is end-to-end encrypted.</p>
  </>);
  const fail = (e: unknown) => { island({ e: '⚠️', text: (e as Error).message, ms: 4500 }); haptic('warn'); };
  const p = L.pair, inc = Inbox.incoming();
  const sc = Sync.state === 'live' ? 'green' : Sync.state === 'error' ? 'red' : 'orange';
  return (
    <div className="group" id="syncWrap">
      <div className="cell"><Sq c={person(L.me).color} i="person" /><span className="grow">{u.username ? <b>@{u.username}</b> : 'Signed in'}<br /><small className="val">{u.email || ''}</small></span>
        {u.username ? null : <button className="btn-s" type="button" onClick={() => openUsernameSheet()}>Pick username</button>}</div>
      {u.expired ? <button className="cell" type="button" onClick={() => openAuthSheet('signin')}><Sq c="red" i="key" /><span className="grow">Session expired — sign in again</span><Icon name="chevR" cls="chev" /></button> : null}
      <div className="cell"><Sq c={sc} i="cloud" /><span className={`grow status ${Sync.state}`}><i />{Sync.label()}</span></div>
      {inc.length ? <button className="cell" type="button" onClick={() => openInviteSheet()}><span className="list-ic" style={colorVar('pink')}>💌</span><span className="grow"><b>{inc.length} partner request{inc.length > 1 ? 's' : ''}</b></span><span className="val">View</span><Icon name="chevR" cls="chev" /></button> : null}
      {p && p.status === 'paired' ? (
        <div className="cell"><Sq c="pink" i="heart" /><span className="grow">Paired with <b>{p.name}</b>{p.username ? <> <span className="val">@{p.username}</span></> : null}</span></div>
      ) : p && p.status === 'sent' ? (
        <div className="cell"><Sq c="orange" i="clock" /><span className="grow">Waiting for <b>{p.name}</b> <span className="val">@{p.username}</span>{p.code ? <><br /><small className="val">Safety code {p.code}</small></> : null}</span>
          <BusyButton className="btn-s gray" onRun={async () => { try { await Pair.cancel(); renderNow(); } catch (e) { fail(e); } }}>Cancel</BusyButton></div>
      ) : u.username ? <button className="cell" type="button" onClick={() => openInviteSheet()}><Sq c="pink" i="heart" /><span className="grow"><b>Add partner</b></span><Icon name="chevR" cls="chev" /></button> : null}
      {Push.configured()
        ? <div className="cell"><Sq c="red" i="bell" /><span className="grow">Push reminders</span><input key={String(Push.on())} type="checkbox" className="switch" id="pushSw" defaultChecked={Push.on()} aria-label="Push reminders" onChange={async e => {
            const inp = e.currentTarget, on = inp.checked;
            try { if (on) { await Push.enable(); island({ e: '🔔', text: 'Push reminders are on', sub: 'They arrive within about 5–15 minutes' }); } else await Push.disable(); }
            catch (err) { inp.checked = !on; island({ e: '🔕', text: (err as Error).message, ms: 4500 }); }
            renderNow();
          }} /></div>
        : <button className="cell" type="button" onClick={() => void openVapidSheet()}><Sq c="red" i="bell" /><span className="grow">Set up push reminders</span><span className="val">Keys</span><Icon name="chevR" cls="chev" /></button>}
      <LearnMore label="How your data is protected">
        <p>🔒 Tasks are encrypted on your phones (AES-256-GCM) before they’re saved. Firebase can’t read them, and only your paired accounts can even download them.</p>
        <p>{Push.why() && !Push.on() ? Push.why() : 'Push reminders arrive within about 5–15 minutes of the due time.'}</p>
      </LearnMore>
    </div>
  );
}

/* Unpair, Sign out and Erase: together at the bottom, each asks first */
function DangerZone() {
  const u = Auth.user(), p = L.pair;
  const fail = (e: unknown) => { island({ e: '⚠️', text: (e as Error).message, ms: 4500 }); haptic('warn'); };
  return (
    <div className="group danger">
      {u && p && p.status === 'paired' ? <button className="cell" type="button" onClick={async () => {
        if (!(await confirmDialog({ title: `Unpair from ${p.name}?`, message: 'You’ll stop syncing. Everything stays on this phone, and you can pair again later.', ok: 'Unpair', destructive: true }))) return;
        try { await Pair.unpair(); renderNow(); island({ e: '👋', text: 'Unpaired', sub: 'Your lists are private again' }); } catch (e) { fail(e); }
      }}>Unpair from {firstWord(p.name)}</button> : null}
      {u ? <button className="cell" type="button" onClick={async () => {
        if (!(await confirmDialog({ title: 'Sign out?', message: 'Your tasks stay on this phone. Sign back in any time to sync again.', ok: 'Sign out', destructive: true }))) return;
        await signOut(); renderNow();
      }}>Sign out</button> : null}
      <button className="cell" type="button" onClick={async () => {
        if (!(await confirmDialog({ title: 'Erase everything?', message: 'This removes all tasks, secret lists and settings from this phone. Synced data stays in your shared space.', ok: 'Erase', destructive: true }))) return;
        Sync.close(); Inbox.stop(); await KeyStore.clear().catch(() => {});
        ['twodo:chat', 'twodo:data', 'twodo:local', 'twodo:vault'].forEach(k => localStorage.removeItem(k)); location.reload();
      }}>Erase everything on this phone</button>
    </div>
  );
}

function Switch({ k, label, c, i }: { k: 'haptics' | 'sounds' | 'confetti' | 'notify'; label: string; c: string; i: string }) {
  return (
    <div className="cell"><Sq c={c} i={i} /><span className="grow">{label}</span>
      <input type="checkbox" className="switch" defaultChecked={L.settings[k]} aria-label={label} onChange={async e => {
        const inp = e.currentTarget;
        if (k === 'notify' && inp.checked) {
          if (!('Notification' in window)) { inp.checked = false; island({ e: '🔕', text: 'Notifications aren’t available here', sub: isIOS() ? 'Add Twodo to your Home Screen first' : '' }); return; }
          const p = await Notification.requestPermission();
          if (p !== 'granted') { inp.checked = false; island({ e: '🔕', text: 'Notifications are blocked', sub: 'Allow them in your browser settings' }); return; }
          void sysNotify('Reminders are on ✨', 'Twodo will nudge you when tasks are due.');
        }
        L.settings[k] = inp.checked; save();
        if (inp.checked) haptic('light');
      }} /></div>
  );
}

function SettingsBody() {
  useApp();
  const s = L.settings;
  const notifyNote = isIOS() && !standalone() ? 'On iPhone, reminders need Twodo on your Home Screen.' : 'In-app reminders show while Twodo is open.';
  return (<>
    <Profile />
    {Auth.user() ? null : <div className="group"><div className="cell"><Sq c="gray" i="phone" /><span className="grow">I am</span>
      <Segmented name="me" opts={[['a', shortName(person('a').name)], ['b', shortName(person('b').name)]]} value={L.me} onChange={v => { L.me = v as PersonKey; save(); applyTheme(); renderNow(); }} /></div></div>}
    <div className="sec-h sub">Together</div>
    <Together />
    <div className="sec-h sub">Appearance</div>
    <div className="group">
      <div className="cell"><Sq c="indigo" i="sun" /><span className="grow">Theme</span>
        <Segmented name="theme" opts={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} value={s.theme} onChange={v => { L.settings.theme = v as typeof s.theme; save(); applyTheme(); }} /></div>
      <div className="cell"><Sq c="blue" i="cal" /><span className="grow">5/12 is</span>
        <Segmented name="dmy" opts={[['dmy', '5 Dec'], ['mdy', 'May 12']]} value={s.dmy ? 'dmy' : 'mdy'} onChange={v => { L.settings.dmy = v === 'dmy'; save(); renderNow(); }} /></div>
    </div>
    <div className="sec-h sub">Feel</div>
    <div className="group">
      <Switch k="haptics" label="Haptics" c="pink" i="hand" />
      <Switch k="sounds" label="Sounds" c="orange" i="bell" />
      <Switch k="confetti" label="Celebrations" c="purple" i="sparkles" />
      <Switch k="notify" label="In-app reminders" c="red" i="clock" />
    </div>
    <p className="note-s">{notifyNote}</p>
    <VaultSettings />
    <div className="sec-h sub">Backup &amp; help</div>
    <div className="group">
      <button className="cell" type="button" onClick={() => {
        // secret lists never leave this phone, not even in a backup file
        downloadFile(`twodo-backup-${todayStr()}.json`, 'application/json', JSON.stringify({ app: 'twodo', version: 1, exportedAt: new Date().toISOString(), data: publicData() }, null, 2));
        island({ e: '💾', text: 'Backup saved' });
      }}><Sq c="green" i="download" /><span className="grow">Export backup</span></button>
      <button className="cell" type="button" onClick={() => document.getElementById('importFile')?.click()}><Sq c="blue" i="upload" /><span className="grow">Import backup</span></button>
      <button className="cell" type="button" onClick={() => { closeSheet(); setTimeout(() => openTips(), 350); }}><Sq c="yellow" i="bulb" /><span className="grow">Tips &amp; tricks</span><Icon name="chevR" cls="chev" /></button>
    </div>
    <DangerZone />
    <div className="foot">Twodo 5.0 · made for two 💞</div>
  </>);
}
export function openSettings(): void { openSheet({ title: 'Settings', tall: true, body: <SettingsBody /> }); }

/* ---------- Backup import: everything in the file is checked like synced data before it's used ---------- */
export async function importBackup(f: File): Promise<void> {
  try {
    if (f.size > 20 * 1024 * 1024) throw new Error('too big');
    const j = JSON.parse(await f.text()), d = j && typeof j === 'object' ? (j.data || j) : null;
    if (!d || typeof d.tasks !== 'object') throw new Error('bad');
    let n = 0;
    const lists = cleanMap<List>(d.lists), tasks = cleanMap<Task>(d.tasks);
    // secret lists from an old backup can only go behind the lock while it's open
    const skip = Vault.locked() ? new Set(Object.values(lists).filter(l => l.private).map(l => l.id)) : new Set<string>();
    for (const [id, l] of Object.entries(lists)) if (!skip.has(id) && (!D.lists[id] || (l.updatedAt || 0) > (D.lists[id].updatedAt || 0))) { D.lists[id] = l; commit(l, { silent: true }); n++; }
    for (const [id, t] of Object.entries(tasks)) if (!skip.has(t.listId) && (!D.tasks[id] || (t.updatedAt || 0) > (D.tasks[id].updatedAt || 0))) { D.tasks[id] = t; commit(t, { silent: true }); n++; }
    const pp = d.people ? cleanRecord(d.people) as PeopleRec | null : null;
    if (pp && pp.kind === 'people' && (!D.people || (pp.updatedAt || 0) > (D.people.updatedAt || 0))) { setPeopleRec(pp); commit(D.people!, { silent: true }); }
    ensureBasics(); applyTheme(); scheduleRender(); island({ e: '📦', text: `Imported ${n} item${n === 1 ? '' : 's'}`, sub: skip.size ? 'Unlock secret lists and import again for the secret ones' : undefined, ms: skip.size ? 4500 : undefined });
  } catch { island({ e: '⚠️', text: 'That file isn’t a Twodo backup' }); }
}
