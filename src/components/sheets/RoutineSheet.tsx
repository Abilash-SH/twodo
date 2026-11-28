'use client';
/* Twodo · add or edit a routine: a name, an emoji, a colour, and who keeps it (docs/routines.md) */
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { scheduleRender } from '@/lib/render';
import { D, L, partnerKey, person } from '@/lib/store';
import { MAX_ROUTINES, addRoutine, routines, updateRoutine } from '@/lib/routines';
import type { Routine } from '@/lib/types';
import { PALETTE, firstWord, type Color } from '@/lib/util';
import { confirmDialog } from '@/ui/alert';
import { island } from '@/ui/island';
import { closeSheet, focusWhenOpen, openSheet } from '@/ui/sheet';
import { colorVar } from '../ui/Avatar';
import { Segmented } from '../ui/Segmented';

const ROUTINE_EMOJIS = ['🏋️', '👟', '🍭', '🚶', '🍲', '💧', '🧘', '🏃', '🚴', '🏊', '🥗', '🍎', '😴', '📖', '🧠', '🪥', '💊', '🌿', '☀️', '📵', '✍️', '🎸', '🧹', '❤️'];
const form = { save: () => {} };

function RoutineEditor({ id }: { id: string | null }) {
  const ex = id ? D.routines[id] : null, me = L.me, pt = partnerKey();
  const [emoji, setEmoji] = useState(ex ? ex.emoji : '🏋️'), [color, setColor] = useState<Color>(ex ? ex.color : 'green');
  const [who, setWho] = useState<Routine['who']>(ex ? ex.who : 'both');
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!ex) focusWhenOpen(nameRef.current); }, [ex]);
  const save = () => {
    const name = (nameRef.current?.value || '').trim().slice(0, 40);
    if (!name) { nameRef.current?.focus(); haptic('warn'); return; }
    if (ex) updateRoutine(ex.id, { name, emoji, color, who });
    else if (!addRoutine({ name, emoji, color, who })) { island({ e: '🎟️', text: `${MAX_ROUTINES} routines is the most`, sub: 'Remove one to add another' }); return; }
    closeSheet(); haptic('success'); scheduleRender();
  };
  form.save = save;
  const del = async () => {
    if (!ex) return;
    if (!(await confirmDialog({ title: `Remove “${ex.name}”?`, message: 'Its punches stay in the weeks that are over.', ok: 'Remove', destructive: true }))) return;
    updateRoutine(ex.id, { deleted: true });
    closeSheet(); island({ e: '🗑️', text: `Removed ${ex.name}` }); scheduleRender();
  };
  return (<>
    <div className="big-ic" style={colorVar(color)}>{emoji}</div>
    <input ref={nameRef} className="name-inp" placeholder="Gym, 10k steps, no sugar…" defaultValue={ex ? ex.name : ''} maxLength={40} style={colorVar(color)}
      aria-label="Routine name" enterKeyHint="done" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
    <div className="group rt-who"><Segmented name="rtwho" value={who} onChange={v => setWho(v as Routine['who'])}
      opts={[['both', 'Both of us'], [me, firstWord(person(me).name)], [pt, firstWord(person(pt).name)]]} /></div>
    <div className="group"><div className="colors">{PALETTE.map(c => (
      <button key={c} type="button" style={colorVar(c)} className={c === color ? 'on' : ''} aria-label={c} aria-pressed={c === color} onClick={() => { setColor(c); haptic('light'); }} />))}</div></div>
    <div className="group"><div className="picker">{ROUTINE_EMOJIS.map(e => (
      <button key={e} type="button" className={e === emoji ? 'on' : ''} aria-pressed={e === emoji} onClick={() => { setEmoji(e); haptic('light'); }}>{e}</button>))}</div></div>
    <p className="note-s">Each of you punches your own card. Your partner sees your punches, and the two of you get a summary every week.</p>
    {ex ? <div className="group"><button className="cell red" type="button" onClick={() => void del()}>Remove Routine</button></div> : null}
  </>);
}

export function openRoutineSheet(id: string | null = null): void {
  const ex = id ? D.routines[id] : null;
  if (!ex && routines().length >= MAX_ROUTINES) { island({ e: '🎟️', text: `${MAX_ROUTINES} routines is the most`, sub: 'Remove one to add another' }); return; }
  openSheet({
    title: ex ? 'Edit Routine' : 'New Routine', right: ex ? 'Done' : 'Add', onRight: () => form.save(),
    left: <button className="nav-btn" type="button" onClick={() => closeSheet()}>Cancel</button>,
    body: <RoutineEditor key={id || 'new'} id={id} />,
  });
}
