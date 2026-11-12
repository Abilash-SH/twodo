'use client';
/* Twodo · Dynamic Island: toasts with an Undo-style button, and the focus timer's live activity */
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { useTapKeepWithin } from '@/hooks/useTapKeep';
import { EASE, MS, calm } from '@/lib/motion';
import { D, L } from '@/lib/store';
import { hideIsland, islandStore } from '@/ui/island';
import { useStore } from '@/ui/store';
import { focusRemaining, mmss, openFocus } from './FocusOverlay';

function LiveActivity() {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 250); return () => clearInterval(t); }, []);
  const f = L.focus; if (!f) return null;
  const t = f.taskId ? D.tasks[f.taskId] : null, r = focusRemaining(), p = f.total ? r / f.total : 0;
  return (<>
    <span className="e">{f.mode === 'focus' ? '⏱️' : '☕️'}</span>
    <span className="txt"><span className="ltm">{mmss(r)}</span> {t ? t.title : 'Focus'}</span>
    <svg className="lr" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" style={{ stroke: 'rgba(255,255,255,.2)' }} />
      <circle cx="12" cy="12" r="9" style={{ stroke: 'var(--accent)', strokeDasharray: 56.55, strokeLinecap: 'round', strokeDashoffset: 56.55 * (1 - p) }} /></svg>
  </>);
}

export function IslandHost() {
  const s = useStore(islandStore), el = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null);
  useTapKeepWithin(root); // "Undo" while typing keeps the keyboard up
  useEffect(() => {
    if (s.mode === 'toast' && !calm()) el.current?.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: MS.standard, easing: EASE.spring, composite: 'add' });
  }, [s.seq, s.mode]);
  const on = s.mode !== 'off';
  return (
    <div ref={root} id="island">
      <div ref={el} id="isl" className={`isl${on ? ' on' : ''}${s.mode === 'toast' ? ' toast' : ''}${s.mode === 'live' ? ' live' : ''}`} role="status" aria-live="polite"
        onClick={e => {
          if ((e.target as HTMLElement).closest('.ib')) { const fn = islandStore.get().msg.onBtn; hideIsland(); if (fn) { fn(); haptic('light'); } return; }
          if (islandStore.get().mode === 'live' && L.focus) { openFocus(L.focus.taskId); return; }
          hideIsland();
        }}>
        {s.mode === 'live' ? <LiveActivity /> : (<>
          <span className="e">{s.msg.e}</span>
          <span className="txt">{s.msg.text}{s.msg.sub ? <small>{s.msg.sub}</small> : null}</span>
          <button className="ib" type="button">{s.msg.btn}</button>
        </>)}
      </div>
    </div>
  );
}
