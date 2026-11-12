'use client';
/* Twodo · task details sheet, calendar export and sharing */
import { useEffect, useRef } from 'react';
import { useApp } from '@/hooks/useApp';
import { blip, haptic } from '@/lib/feedback';
import { renderNow } from '@/lib/render';
import { D, L, commit, fmtDue, listOf, lists, myName, partnerKey, ptName, updateTask, whoName } from '@/lib/store';
import type { Task } from '@/lib/types';
import { REPEATS, addDays, copyText, downloadFile, fromYmd, pad, shortName, todayStr, uid, ymd, type Repeat } from '@/lib/util';
import { island } from '@/ui/island';
import { closeSheet, openSheet } from '@/ui/sheet';
import { deleteTask, duplicateTask, toggleDone } from '@/ui/tasks';
import { openFocus } from '../overlays/FocusOverlay';
import { colorVar, Sq } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';

/* ---------- Calendar (.ics) & sharing ---------- */
function icsFor(t: Task): string {
  const e = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  const f = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  let start: string, end: string, trig: string;
  if (t.time) { const s = new Date(`${t.due}T${t.time}`); start = `DTSTART:${f(s)}`; end = `DTEND:${f(new Date(s.getTime() + 30 * 60e3))}`; trig = 'TRIGGER:PT0M'; }
  else { start = `DTSTART;VALUE=DATE:${t.due!.replace(/-/g, '')}`; end = `DTEND;VALUE=DATE:${ymd(addDays(fromYmd(t.due!), 1)).replace(/-/g, '')}`; trig = 'TRIGGER:PT9H'; }
  const rr = t.repeat ? { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[t.repeat] : '';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Twodo//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${t.id}@twodo`, `DTSTAMP:${stamp}`,
    start, end, `SUMMARY:${e(t.title)}`, t.notes ? `DESCRIPTION:${e(t.notes)}` : '', rr ? `RRULE:${rr}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e(t.title)}`, trig, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
function downloadICS(t: Task) {
  if (!t.due) { island({ e: '📅', text: 'Set a date first', sub: 'Then you can add it to your calendar', ms: 2200 }); return; }
  const name = (t.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task') + '.ics';
  downloadFile(name, 'text/calendar', icsFor(t));
  island({ e: '📅', text: 'Calendar event created', sub: 'Open it to add the alert', ms: 2200 });
}
async function shareTask(t: Task) {
  const text = `${t.title}${t.due ? `\n📅 ${fmtDue(t.due, t.time)}` : ''}${t.notes ? `\n\n${t.notes}` : ''}`;
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
  if (await copyText(text)) island({ e: '📋', text: 'Copied to clipboard', ms: 1600 });
}

const autosize = (ta: HTMLTextAreaElement | null) => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
const fmtStamp = (n: number) => new Date(n).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const upd = (id: string, patch: Partial<Task>) => { updateTask(id, patch); renderNow(); };

function TaskDetails({ id }: { id: string }) {
  useApp(); // live: edits from here, the list, or your partner show straight away
  const title = useRef<HTMLTextAreaElement>(null), notes = useRef<HTMLTextAreaElement>(null), tags = useRef<HTMLInputElement>(null);
  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; n?: ReturnType<typeof setTimeout> }>({});
  useEffect(() => { requestAnimationFrame(() => { autosize(title.current); autosize(notes.current); }); }, []);
  useEffect(() => { if (!D.tasks[id]) closeSheet(); }); // e.g. a secret to-do that just locked
  const t = D.tasks[id];
  if (!t) return null;
  const l = listOf(t);
  const toggleHead = () => {
    const done = !t.done;
    if (done && t.repeat) { closeSheet(); toggleDone(id, { instant: true }); return; }
    upd(id, done ? { done: true, doneAt: Date.now(), doneBy: L.me } : { done: false, doneAt: null, doneBy: null });
    if (done) { haptic('success'); blip('done'); }
  };
  const subs = t.subtasks || [];
  return (<>
    <div className={`d-head${t.done ? ' checked' : ''}`}><button className="chk" type="button" aria-label="Complete" onClick={toggleHead}><Icon name="check" /></button>
      <textarea ref={title} className="d-tt" rows={1} aria-label="Title" defaultValue={t.title}
        onInput={e => { const ta = e.currentTarget; autosize(ta); clearTimeout(timers.current.t); timers.current.t = setTimeout(() => { const v = ta.value.trim(); if (v) updateTask(id, { title: v.replace(/\n/g, ' ') }); }, 250); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} /></div>
    <div className="group"><textarea ref={notes} className="d-notes" rows={2} placeholder="Notes" aria-label="Notes" defaultValue={t.notes}
      onInput={e => { const ta = e.currentTarget; autosize(ta); clearTimeout(timers.current.n); timers.current.n = setTimeout(() => updateTask(id, { notes: ta.value }), 300); }} /></div>
    <div className="group">
      <div className="cell"><Sq c="red" i="cal" /><span className="grow">Date</span>
        <input type="date" className="pill-inp" aria-label="Date" value={t.due || ''} onChange={e => upd(id, { due: e.target.value || null, ...(e.target.value ? {} : { time: null }) })} />
        <button className="clear" type="button" hidden={!t.due} aria-label="Clear date" onClick={() => { upd(id, { due: null, time: null, repeat: null }); haptic('light'); }}><Icon name="xcircle" /></button></div>
      <div className="cell"><Sq c="blue" i="clock" /><span className="grow">Time</span>
        <input type="time" className="pill-inp" aria-label="Time" value={t.time || ''} onChange={e => upd(id, { time: e.target.value || null, ...(e.target.value && !t.due ? { due: todayStr() } : {}) })} />
        <button className="clear" type="button" hidden={!t.time} aria-label="Clear time" onClick={() => { upd(id, { time: null }); haptic('light'); }}><Icon name="xcircle" /></button></div>
      <div className="cell"><Sq c="gray" i="repeat" /><span className="grow">Repeat</span>
        <select className="sel" aria-label="Repeat" value={t.repeat || ''} onChange={e => upd(id, { repeat: (e.target.value || null) as Repeat | null, ...(e.target.value && !t.due ? { due: todayStr() } : {}) })}>
          <option value="">Never</option>{Object.entries(REPEATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    <div className="group">
      <div className="cell"><Sq c="orange" i="flag" /><span className="grow">Priority</span>
        <Segmented name="dprio" opts={[['0', 'None'], ['1', '!'], ['2', '!!'], ['3', '!!!']]} value={String(t.priority || 0)} onChange={v => updateTask(id, { priority: Number(v) as Task['priority'] })} /></div>
      <div className="cell"><Sq c="pink" i="person" /><span className="grow">For</span>
        <Segmented name="dassign" opts={[['', 'Any'], [L.me, shortName(myName(), 6)], [partnerKey(), shortName(ptName(), 6)], ['both', 'Us']]} value={t.assignee || ''} onChange={v => updateTask(id, { assignee: (v || null) as Task['assignee'] })} /></div>
    </div>
    <div className="group">
      <div className="cell"><span className="sq" style={colorVar(l.color)}><Icon name="list" /></span><span className="grow">List</span>
        <select className="sel" aria-label="List" value={l.id} onChange={e => upd(id, { listId: e.target.value })}>
          {lists().map(x => <option key={x.id} value={x.id}>{x.emoji + ' ' + x.name}</option>)}</select></div>
      <div className="cell"><Sq c="purple" i="tag" /><input ref={tags} className="inp" placeholder="Tags, e.g. #work #fun" defaultValue={(t.tags || []).map(x => '#' + x).join(' ')} autoCapitalize="off" aria-label="Tags"
        onChange={() => {}} onBlur={e => {
          const v = [...new Set(e.target.value.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 30);
          updateTask(id, { tags: v }); e.target.value = v.map(x => '#' + x).join(' ');
        }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></div>
      <div className="cell"><Sq c="yellow" i="pin" /><span className="grow">Pinned</span>
        <input type="checkbox" className="switch" aria-label="Pinned" checked={t.pinned} onChange={e => { upd(id, { pinned: e.target.checked }); haptic('light'); }} /></div>
    </div>
    <div className="sec-h sub">Subtasks</div>
    <div className="group subs">
      {subs.map(s => (
        <div key={s.id} className={`sub-row${s.done ? ' checked' : ''}`}>
          <button className="chk" type="button" aria-label="Toggle subtask" onClick={() => { s.done = !s.done; commit(t); renderNow(); haptic('light'); if (s.done) blip('pop'); }}><Icon name="check" /></button>
          <input className="inp" defaultValue={s.title} aria-label="Subtask" onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.title) { s.title = v.slice(0, 1000); commit(t); } }} />
          <button className="clear" type="button" aria-label="Remove subtask" onClick={() => { t.subtasks = t.subtasks.filter(x => x.id !== s.id); commit(t); renderNow(); }}><Icon name="x" /></button></div>
      ))}
      <div className="sub-row sub-add"><Icon name="plus" /><input className="inp" placeholder="Add subtask" enterKeyHint="done" aria-label="Add subtask"
        onKeyDown={e => {
          if (e.key !== 'Enter') return; e.preventDefault();
          const v = e.currentTarget.value.trim(); if (!v) return;
          t.subtasks = [...(t.subtasks || []), { id: uid(), title: v.slice(0, 1000), done: false }]; commit(t);
          e.currentTarget.value = ''; renderNow(); haptic('light');
        }} /></div>
    </div>
    <div className="group">
      <button className="cell" type="button" onClick={() => { closeSheet(); setTimeout(() => openFocus(id), 250); }}><Sq c="indigo" i="timer" /><span className="grow">Start focus timer</span><span className="val">{t.pomos ? '🍅 ' + t.pomos : ''}</span><Icon name="chevR" cls="chev" /></button>
      <button className="cell" type="button" onClick={() => downloadICS(t)}><Sq c="red" i="bell" /><span className="grow">Add to Calendar (alert)</span><Icon name="chevR" cls="chev" /></button>
      <button className="cell" type="button" onClick={() => void shareTask(t)}><Sq c="blue" i="share" /><span className="grow">Share</span><Icon name="chevR" cls="chev" /></button>
      <button className="cell" type="button" onClick={() => { const n = duplicateTask(id); closeSheet(); if (n) setTimeout(() => openTaskSheet(n.id), 450); }}><Sq c="gray" i="copy" /><span className="grow">Duplicate</span><Icon name="chevR" cls="chev" /></button>
    </div>
    <div className="group"><button className="cell red" type="button" onClick={() => { closeSheet(); setTimeout(() => deleteTask(id), 300); }}>Delete Task</button></div>
    <div className="meta-foot">Added by {whoName(t.createdBy)} · {fmtStamp(t.createdAt)}{t.done && t.doneAt ? <><br />Completed by {whoName(t.doneBy)} · {fmtStamp(t.doneAt)}</> : null}</div>
  </>);
}

export function openTaskSheet(id: string): void {
  const t = D.tasks[id]; if (!t || t.deleted) return;
  openSheet({ title: 'Details', tall: true, body: <TaskDetails key={id} id={id} /> });
}
