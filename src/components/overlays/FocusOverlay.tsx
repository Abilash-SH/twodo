'use client';
/* Twodo · focus timer (Pomodoro), with a live activity in the island when minimised */
import { useEffect, useRef, useState } from 'react';
import { useSwipeAway } from '@/hooks/swipe';
import { blip, haptic } from '@/lib/feedback';
import { D, L, save, updateTask } from '@/lib/store';
import { pad } from '@/lib/util';
import { focusOpen, hideIsland, island, islandStore, showLive } from '@/ui/island';
import { sysNotify } from '@/ui/reminders';
import { useStore } from '@/ui/store';
import { toggleDone } from '@/ui/tasks';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';

const RING_C = 339.29; // 2πr, r = 54
export const focusRemaining = (): number => { const f = L.focus; if (!f) return 0; return f.running ? Math.max(0, Math.round(((f.endsAt || 0) - Date.now()) / 1000)) : f.remaining; };
export const mmss = (s: number): string => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

function setFocusMode(mode: 'focus' | 'break') {
  const f = L.focus; if (!f) return;
  f.mode = mode; f.total = (mode === 'focus' ? 25 : 5) * 60; f.remaining = f.total; f.running = false; f.endsAt = null;
}
export function openFocus(taskId: string | null): void {
  if (!L.focus || L.focus.taskId !== taskId) L.focus = { taskId, mode: 'focus', total: 1500, remaining: 1500, endsAt: null, running: false };
  save();
  if (islandStore.get().mode === 'live') islandStore.set(s => ({ ...s, mode: 'off' }));
  focusOpen.set(true);
}
export function closeFocus(): void {
  focusOpen.set(false);
  if (L.focus && L.focus.running) showLive();
}
function finishFocus() {
  const f = L.focus!; f.running = false; f.endsAt = null; f.remaining = 0;
  blip('chime'); haptic('success');
  if (f.mode === 'focus') {
    const t = f.taskId ? D.tasks[f.taskId] : null; if (t) updateTask(t.id, { pomos: (t.pomos || 0) + 1 });
    void sysNotify('Focus session done 🎉', 'Nice work. Time for a 5-minute break.');
    island({ e: '🎉', text: 'Focus session complete', sub: 'Take a 5-minute break' });
    setFocusMode('break');
  } else {
    void sysNotify('Break’s over ☕️', 'Ready for another round?');
    island({ e: '☕️', text: 'Break’s over — ready?' });
    setFocusMode('focus');
  }
  save();
}
// the timer keeps running while the app is open, whether the overlay is shown or minimised to the island
export function focusTick(): void { const f = L.focus; if (f && f.running && focusRemaining() <= 0) finishFocus(); }

export function FocusOverlay() {
  const open = useStore(focusOpen);
  const [, tick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useSwipeAway(ref, { onClose: () => closeFocus(), down: true, scroller: () => ref.current, enabled: open }); // swipe right or down = Minimise
  useEffect(() => { if (!open) return; const t = setInterval(() => tick(n => n + 1), 250); return () => clearInterval(t); }, [open]);
  const f = L.focus;
  const t = f && f.taskId ? D.tasks[f.taskId] : null;
  const r = focusRemaining(), p = f && f.total ? r / f.total : 0;
  const act = (k: string) => {
    const f = L.focus; if (!f) return;
    switch (k) {
      case 'toggle':
        if (f.running) { f.remaining = focusRemaining(); f.running = false; f.endsAt = null; }
        else { if (f.remaining <= 0) setFocusMode(f.mode); f.endsAt = Date.now() + f.remaining * 1000; f.running = true; }
        haptic('medium'); break;
      case 'plus5':
        if (f.running) f.endsAt = (f.endsAt || Date.now()) + 300e3; else f.remaining += 300;
        f.total += 300; haptic('light'); break;
      case 'done': {
        const id = f.taskId; L.focus = null; save(); closeFocus();
        const tk = id ? D.tasks[id] : null; if (tk && !tk.done) setTimeout(() => toggleDone(tk.id, { instant: true }), 300);
        return;
      }
      case 'stop': L.focus = null; save(); closeFocus(); hideIsland(); return;
      case 'min': closeFocus(); return;
    }
    save(); tick(n => n + 1);
  };
  return (
    <div ref={ref} id="focus" className={open ? 'on' : ''} aria-hidden={!open}>
      {f ? (<>
        <div className="f-top"><button className="nav-btn" type="button" onClick={() => act('min')}><Icon name="chevD" /><span>&nbsp;Minimise</span></button>
          <button className="nav-btn" type="button" onClick={() => act('stop')}>End</button></div>
        <Segmented name="fmode" cls="f-mode" opts={[['focus', 'Focus · 25'], ['break', 'Break · 5']]} value={f.mode} onChange={v => { setFocusMode(v as 'focus' | 'break'); save(); tick(n => n + 1); }} />
        <div className="f-ring"><svg viewBox="0 0 120 120"><circle className="trk" cx="60" cy="60" r="54" /><circle className="bar" cx="60" cy="60" r="54" style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - p) }} /></svg>
          <div className="f-time"><b>{mmss(r)}</b><span>{f.running ? (f.mode === 'focus' ? 'Focusing' : 'On a break') : 'Paused'}</span></div></div>
        <div className="f-task">{t ? t.title : 'Focus'}</div>
        <div className="f-sub">{t && t.pomos ? `🍅 × ${t.pomos} sessions so far` : f.mode === 'focus' ? 'One thing at a time ✨' : 'Breathe. Stretch. Hydrate.'}</div>
        <div className="f-ctrl"><button className="side" type="button" aria-label="Add 5 minutes" onClick={() => act('plus5')}>+5</button>
          <button className="main" type="button" aria-label="Start or pause" onClick={() => act('toggle')}><Icon name={f.running ? 'pause' : 'play'} /></button>
          <button className="side" type="button" aria-label="Complete task" onClick={() => act('done')}><Icon name="check" /></button></div>
      </>) : null}
    </div>
  );
}
