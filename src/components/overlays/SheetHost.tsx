'use client';
/* Twodo · sheets: card modals that slide up, and close with Done, a tap outside, or a drag down */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { closeSheet, sheetStore, type SheetEntry } from '@/ui/sheet';
import { useStore } from '@/ui/store';

function useSheetDrag(sh: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = sh.current; if (!el) return;
    const head = el.querySelector<HTMLElement>('.sheet-head')!, body = el.querySelector<HTMLElement>('.sheet-body')!;
    let y0: number | null = null, dy = 0, t0 = 0, active = false;
    const start = (y: number) => { y0 = y; dy = 0; t0 = performance.now(); active = false; };
    const move = (y: number, e?: Event) => {
      if (y0 === null) return;
      dy = Math.max(0, y - y0);
      if (!active && dy > 6) { active = true; document.body.classList.add('sheet-drag'); }
      if (!active) return;
      if (e && e.cancelable) e.preventDefault();
      el.style.transform = `translateY(${dy}px)`;
      document.body.style.setProperty('--sp', String(clamp(1 - dy / el.offsetHeight, 0, 1)));
    };
    const end = () => {
      if (y0 === null) return;
      const v = dy / Math.max(1, performance.now() - t0);
      y0 = null;
      document.body.classList.remove('sheet-drag');
      el.style.transform = '';
      if (active && (dy > 130 || v > 0.6)) closeSheet();
      else document.body.style.setProperty('--sp', '1');
      active = false;
    };
    const hDown = (e: PointerEvent) => { if ((e.target as HTMLElement).closest('button')) return; try { head.setPointerCapture(e.pointerId); } catch { /* ignore */ } start(e.clientY); };
    const hMove = (e: PointerEvent) => move(e.clientY, e);
    const bStart = (e: TouchEvent) => {
      if (body.scrollTop <= 0 && !(e.target as HTMLElement).closest('input, textarea, select, .seg, .picker, .colors')) start(e.touches[0].clientY);
      else y0 = null;
    };
    const bMove = (e: TouchEvent) => {
      if (y0 === null) return;
      const y = e.touches[0].clientY;
      if (!active && y - y0 < -2) { y0 = null; return; }
      move(y, e);
    };
    head.addEventListener('pointerdown', hDown); head.addEventListener('pointermove', hMove);
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    body.addEventListener('touchstart', bStart, { passive: true }); body.addEventListener('touchmove', bMove, { passive: false });
    body.addEventListener('touchend', end); body.addEventListener('touchcancel', end);
    return () => {
      head.removeEventListener('pointerdown', hDown); head.removeEventListener('pointermove', hMove);
      head.removeEventListener('pointerup', end); head.removeEventListener('pointercancel', end);
      body.removeEventListener('touchstart', bStart); body.removeEventListener('touchmove', bMove);
      body.removeEventListener('touchend', end); body.removeEventListener('touchcancel', end);
    };
  }, [sh]);
}

function SheetView({ s }: { s: SheetEntry }) {
  useApp(); // sheet contents show live data
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { let r2 = 0; const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)); }); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); }; }, []);
  useSheetDrag(ref);
  const on = shown && !s.closing, d = s.desc, right = d.right === undefined ? 'Done' : d.right;
  return (<>
    <div className={`backdrop${on ? ' on' : ''}`} onClick={() => closeSheet()} />
    <div ref={ref} className={`sheet${d.tall ? ' tall' : ''}${on ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label={d.title}>
      <div className="sheet-head"><div className="grab" /><div className="sheet-bar"><div>{d.left}</div><h3>{d.title}</h3><div>
        {right ? <button className="nav-btn b" data-s="done" type="button" onClick={() => (d.onRight ? d.onRight() : closeSheet())}>{right}</button> : null}</div></div></div>
      <div className="sheet-body">{d.body}</div>
    </div>
  </>);
}
export function SheetHost() {
  const list = useStore(sheetStore);
  return <div id="layer">{list.map(s => <SheetView key={s.id} s={s} />)}</div>;
}
