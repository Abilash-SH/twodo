'use client';
/* Twodo · list editor: name, colour, emoji, and whether it's a Secret list (never synced) */
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { scheduleRender } from '@/lib/render';
import { D, commit, liveTasks, mkList } from '@/lib/store';
import { EMOJIS, PALETTE, type Color } from '@/lib/util';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { openList, popView, topSpec } from '@/ui/nav';
import { closeSheet, focusWhenOpen, openSheet } from '@/ui/sheet';
import { Vault } from '@/lib/vault';
import { openVault } from '../vault/VaultUI';
import { colorVar, Sq } from '../ui/Avatar';

interface St { name: string; emoji: string; color: Color; priv: boolean }
const listForm = { save: () => {} };

function ListEditor({ id }: { id: string | null }) {
  const ex = id ? D.lists[id] : null;
  const [st, setSt] = useState<St>({ name: ex ? ex.name : '', emoji: ex ? ex.emoji : '📝', color: ex ? ex.color : 'blue', priv: !!(ex && ex.private) });
  const nameRef = useRef<HTMLInputElement>(null), bigRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!ex) focusWhenOpen(nameRef.current); }, [ex]);
  const save = () => {
    const name = (nameRef.current?.value || '').trim().slice(0, 40);
    if (!name) { nameRef.current?.focus(); haptic('warn'); return; }
    // a list only becomes secret behind the lock: unlock first (or make the passcode right after)
    if (st.priv && !(ex && ex.private) && Vault.locked()) { closeSheet(); setTimeout(() => openVault('unlock'), 350); island({ e: '🔒', text: 'Unlock secret lists first', sub: 'Then make this list secret' }); return; }
    const needPin = st.priv && !Vault.exists();
    if (ex) {
      const privChanged = ex.private !== st.priv;
      Object.assign(ex, { name, emoji: st.emoji, color: st.color, private: st.priv }); commit(ex);
      if (privChanged) liveTasks({ secret: true }).filter(t => t.listId === ex.id).forEach(t => commit(t, { silent: true })); // retract from / re-share with partner
      closeSheet();
      if (needPin) setTimeout(() => openVault('create'), 350);
    } else {
      const l = mkList({ name, emoji: st.emoji, color: st.color, private: st.priv });
      D.lists[l.id] = l; commit(l);
      closeSheet(); setTimeout(() => (needPin ? openVault('create', () => openList(l.id)) : openList(l.id)), 350);
    }
    haptic('success');
  };
  listForm.save = save;
  const del = async () => {
    if (!ex) return;
    const n = liveTasks({ secret: true }).filter(t => t.listId === ex.id).length;
    if (!(await confirmDialog({ title: `Delete “${ex.name}”?`, message: n ? `This also deletes its ${n} task${n === 1 ? '' : 's'}.` : 'This can’t be undone.', ok: 'Delete', destructive: true }))) return;
    ex.deleted = true; commit(ex);
    liveTasks({ secret: true }).filter(t => t.listId === ex.id).forEach(t => { t.deleted = true; commit(t, { silent: true }); });
    closeSheet();
    const s = topSpec(); if (s.type === 'list' && s.id === ex.id) setTimeout(popView, 300);
    island({ e: '🗑️', text: `Deleted ${ex.name}` }); scheduleRender();
  };
  return (<>
    <div ref={bigRef} className="big-ic" style={colorVar(st.color)}>{st.emoji}</div>
    <input ref={nameRef} className="name-inp" placeholder="List name" defaultValue={st.name} maxLength={40} style={colorVar(st.color)} aria-label="List name"
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
    <div className="group"><div className="colors" id="lcolors">{PALETTE.map(c => (
      <button key={c} type="button" style={colorVar(c)} className={c === st.color ? 'on' : ''} aria-label={c} onClick={() => { setSt(s => ({ ...s, color: c })); haptic('light'); }} />))}</div></div>
    <div className="group"><div className="picker" id="lemoji">{EMOJIS.map(e => (
      <button key={e} type="button" className={e === st.emoji ? 'on' : ''} onClick={() => {
        setSt(s => ({ ...s, emoji: e })); haptic('light');
        bigRef.current?.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
      }}>{e}</button>))}</div></div>
    {!ex || ex.id !== 'inbox' ? (<>
      <div className="group"><div className="cell"><Sq c="purple" i="lock" /><span className="grow">Secret list</span>
        <input type="checkbox" className="switch" checked={st.priv} aria-label="Secret list" onChange={e => { const v = e.target.checked; setSt(s => ({ ...s, priv: v })); haptic('light'); }} /></div></div>
      <p className="note-s">Secret lists are locked with a passcode, encrypted on this phone and never synced — perfect for planning surprises 🎁</p>
    </>) : null}
    {ex && ex.id !== 'inbox' ? <div className="group"><button className="cell red" type="button" onClick={() => void del()}>Delete List</button></div> : null}
  </>);
}

export function openListSheet(id: string | null = null): void {
  const ex = id ? D.lists[id] : null;
  openSheet({
    title: ex ? 'Edit List' : 'New List', right: ex ? 'Done' : 'Add', onRight: () => listForm.save(),
    left: <button className="nav-btn" type="button" onClick={() => closeSheet()}>Cancel</button>,
    body: <ListEditor key={id || 'new'} id={id} />,
  });
}
