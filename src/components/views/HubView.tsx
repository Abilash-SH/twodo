'use client';
/* Twodo · To-dos & reminders: every list in one place */
import { haptic } from '@/lib/feedback';
import { L, SMART, calcStreak, listOf, liveTasks, lists, save, type SmartKey } from '@/lib/store';
import type { List, Task } from '@/lib/types';
import { Vault } from '@/lib/vault';
import { island } from '@/ui/island';
import { isIOS, isTouch, standalone } from '@/lib/util';
import { renderNow } from '@/lib/render';
import { openList, openSearch, openSmart } from '@/ui/nav';
import { Install } from '@/ui/install';
import { colorVar, cssVars } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { openListSheet } from '../sheets/ListSheet';
import { openVault, unlockWithBio } from '../vault/VaultUI';

function InstallBanner() {
  if (standalone() || L.tips.install || !(isTouch() || Install.evt)) return null;
  return (
    <div className="banner"><span className="tw:text-[26px]">📲</span><div><b>Get the full app feel</b>
      {Install.evt ? <button className="btn-s" type="button" onClick={() => { void Install.evt!.prompt(); Install.evt = null; renderNow(); }}>Install</button>
        : isIOS() ? <span>Tap <Icon name="share" cls="sm" /> Share, then “Add to Home Screen”.</span> : <span>Use your browser menu → “Install app”.</span>}</div>
      <button className="x" aria-label="Dismiss" type="button" onClick={() => { L.tips.install = 1; save(); renderNow(); }}><Icon name="x" cls="sm" /></button></div>
  );
}

function ListRow({ l, n }: { l: List; n: number }) {
  return <button className="cell" type="button" onClick={() => openList(l.id)}><span className="list-ic" style={colorVar(l.color)}>{l.emoji}</span><span className="grow">{l.name}</span>{l.private ? <Icon name="lock" cls="lock" /> : null}<span className="val">{n || ''}</span><Icon name="chevR" cls="chev" /></button>;
}
/* Secret lists: one locked row until you unlock them (then the lists, with a Lock button) */
function SecretLists({ all }: { all: Task[] }) {
  const sec = lists().filter(l => l.private), has = Vault.exists();
  if (!has && !sec.length) return null;
  const open = Vault.unlocked();
  return (<>
    <div className="sec-h sub secret-h"><span>Secret</span>
      {open ? <button className="link-btn" type="button" onClick={() => { void Vault.lock().then(() => island({ e: '🔒', text: 'Secret lists locked' })); haptic('light'); }}><Icon name="lock" cls="xs" /> Lock</button> : null}</div>
    <div className="group secret-group">
      {open || !has ? sec.map(l => <ListRow key={l.id} l={l} n={open ? all.filter(t => !t.done && listOf(t).id === l.id).length : 0} />)
        : <button className="cell" type="button" onClick={() => (Vault.hasBio() ? void unlockWithBio().then(ok => { if (!ok) openVault('unlock'); }) : openVault('unlock'))}>
          <span className="list-ic" style={colorVar('purple')}><Icon name="lock" cls="sm" /></span><span className="grow">Secret lists</span><span className="val">Locked</span><Icon name="chevR" cls="chev" /></button>}
    </div>
  </>);
}

export function HubView() {
  const all = liveTasks(), withSecret = liveTasks({ secret: true }), cnt = (k: SmartKey) => all.filter(SMART[k].match).length;
  const doneWeek = all.filter(t => t.done && (t.doneAt || 0) > Date.now() - 7 * 864e5).length;
  const streak = calcStreak();
  const stats = [streak ? `🔥 ${streak}-day streak` : '', doneWeek ? `💞 ${doneWeek} done together this week` : ''].filter(Boolean).join(' · ');
  return (<>
    <h1 className="large-title">To-dos</h1>{stats ? <div className="subtitle">{stats}</div> : null}
    <button className="searchbar" type="button" onClick={() => openSearch()}><Icon name="search" /><span>Search tasks, notes, #tags</span></button>
    <InstallBanner />
    <div className="hub-grid">{(['today', 'upcoming', 'reminders', 'us', 'pinned', 'all'] as SmartKey[]).map(k => {
      const m = SMART[k], n = cnt(k);
      return (
        <button key={k} className="hub-card" type="button" style={colorVar(m.color)} onClick={() => openSmart(k)}>
          <span className="hub-ic">{k === 'today' ? <b>{new Date().getDate()}</b> : <Icon name={m.icon} />}</span>
          <span className="hub-n">{n || ''}</span><span className="hub-t">{m.title}</span></button>
      );
    })}</div>
    <button className="hub-done" type="button" onClick={() => openSmart('done')}><Icon name="check" cls="sm" /><span className="grow">Completed</span><span className="val">{doneWeek ? `${doneWeek} this week` : ''}</span><Icon name="chevR" cls="chev" /></button>
    <div className="sec-h sub">My Lists</div>
    <div className="group">
      {lists().filter(l => !l.private).map(l => <ListRow key={l.id} l={l} n={withSecret.filter(t => !t.done && listOf(t).id === l.id).length} />)}
      <button className="cell accent" type="button" onClick={() => openListSheet()}><span className="list-ic" style={cssVars({ '--c': 'var(--accent)' })}><Icon name="plus" cls="sm" /></span><span className="grow">New List</span></button>
    </div>
    <SecretLists all={withSecret} />
  </>);
}
