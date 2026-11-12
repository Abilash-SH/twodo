'use client';
/* Twodo · sheets: card modals that slide up, and close with Done, a tap outside, a drag down or a swipe right */
import { useEffect, useRef, useState } from 'react';
import { clamp, reducedMotion } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { NO_SWIPE, SLOP, Velocity, flung, touchById } from '@/hooks/swipe';
import { EASE, MS } from '@/lib/motion';
import { closeSheet, sheetStore, type SheetEntry } from '@/ui/sheet';
import { useStore } from '@/ui/store';

/* Drag a sheet down to close it (from its top bar, or anywhere once its content is scrolled to the top), or swipe it
   away to the right, like going back. Fingers use touch events so the sheet's own scrolling can't steal the swipe. */
// the rest of the way at the finger's speed: a fast flick finishes fast, a slow drag finishes calmly
const speedMs = (px: number, v: number) => Math.round(Math.max(140, Math.min(MS.page, px / Math.max(Math.abs(v), 0.6))));
function useSheetDrag(sh: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = sh.current; if (!el) return;
    const head = el.querySelector<HTMLElement>('.sheet-head')!, body = el.querySelector<HTMLElement>('.sheet-body')!;
    let settling = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    let S: { id: number; x0: number; y0: number; axis: null | 'x' | 'y'; d: number; v: Velocity; canDown: boolean } | null = null;
    const backdrop = el.previousElementSibling as HTMLElement | null;
    let hW = 0, hH = 0; // measured once per drag, not on every move
    const size = (axis: 'x' | 'y') => (axis === 'y' ? hH || (hH = el.offsetHeight) : hW || (hW = el.offsetWidth));
    const apply = (d: number, axis: 'x' | 'y') => {
      el.style.transform = axis === 'y' ? `translate3d(0,${d}px,0)` : `translate3d(${d}px,0,0)`;
      // only the backdrop fades with the drag: setting this on <body> restyled the whole app on every finger move
      backdrop?.style.setProperty('--sp', String(clamp(1 - d / size(axis), 0, 1)));
    };
    const begin = (id: number, x: number, y: number, target: HTMLElement) => {
      if (settling) return;
      if (target.closest('button') && head.contains(target)) return;
      const inHead = head.contains(target);
      if (!inHead && target.closest(NO_SWIPE)) return;
      hW = hH = 0;
      S = { id, x0: x, y0: y, axis: null, d: 0, v: new Velocity(), canDown: inHead || body.scrollTop <= 0 };
      S.v.add(x, y);
    };
    const track = (x: number, y: number, mouse = false): boolean => {
      const G = S; if (!G) return false;
      const dx = x - G.x0, dy = y - G.y0;
      if (!G.axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return false;
        if (G.canDown && dy > 0 && dy >= Math.abs(dx)) G.axis = 'y';
        else if (!mouse && dx > 0 && dx > Math.abs(dy) * .85) G.axis = 'x';
        else { S = null; return false; }
        document.body.classList.add('sheet-drag'); el.style.transition = 'none';
      }
      G.v.add(x, y);
      G.d = Math.max(0, G.axis === 'y' ? dy : dx);
      apply(G.d, G.axis);
      return true;
    };
    const finish = (cancel: boolean) => {
      const G = S; S = null; if (!G || !G.axis) return;
      document.body.classList.remove('sheet-drag');
      const { vx, vy } = G.v.get();
      const go = !cancel && flung(G.d, G.axis === 'y' ? vy : vx, size(G.axis));
      const far = size(G.axis) + 40;
      const ms = speedMs(far - G.d, G.axis === 'y' ? vy : vx); // a fast flick finishes fast, a slow drag calmly
      settling = true;
      el.style.transition = reducedMotion.matches ? 'none' : go ? `transform ${ms}ms ${EASE.out}` : `transform ${MS.page}ms ${EASE.spring}`;
      if (go) {
        apply(far, G.axis);
        later(() => {
          const back = G.axis === 'x' && el.querySelector<HTMLElement>('.sheet-bar [data-back]');
          if (back) back.click(); else closeSheet();
        }, reducedMotion.matches ? 0 : ms);
      } else {
        el.style.transform = ''; backdrop?.style.setProperty('--sp', '1');
        later(() => { el.style.transition = ''; settling = false; }, reducedMotion.matches ? 0 : MS.page + 10);
      }
    };
    const tStart = (e: TouchEvent) => { if (e.touches.length !== 1) { finish(true); return; } const t = e.touches[0]; begin(t.identifier, t.clientX, t.clientY, e.target as HTMLElement); };
    const tMove = (e: TouchEvent) => {
      if (!S) return; if (e.touches.length > 1) return finish(true);
      const t = touchById(e, S.id); if (!t) return;
      if (track(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const tEnd = (e: TouchEvent) => { if (S && touchById(e, S.id)) finish(e.type === 'touchcancel'); };
    // a mouse can drag the top bar down
    const pDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      try { head.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      begin(e.pointerId, e.clientX, e.clientY, e.target as HTMLElement);
    };
    const pMove = (e: PointerEvent) => { if (e.pointerType === 'mouse' && S && S.id === e.pointerId) track(e.clientX, e.clientY, true); };
    const pUp = (e: PointerEvent) => { if (e.pointerType === 'mouse' && S && S.id === e.pointerId) finish(e.type === 'pointercancel'); };
    el.addEventListener('touchstart', tStart, { passive: true }); el.addEventListener('touchmove', tMove, { passive: false });
    el.addEventListener('touchend', tEnd); el.addEventListener('touchcancel', tEnd);
    head.addEventListener('pointerdown', pDown); head.addEventListener('pointermove', pMove);
    head.addEventListener('pointerup', pUp); head.addEventListener('pointercancel', pUp);
    return () => {
      timers.forEach(clearTimeout); document.body.classList.remove('sheet-drag');
      el.removeEventListener('touchstart', tStart); el.removeEventListener('touchmove', tMove);
      el.removeEventListener('touchend', tEnd); el.removeEventListener('touchcancel', tEnd);
      head.removeEventListener('pointerdown', pDown); head.removeEventListener('pointermove', pMove);
      head.removeEventListener('pointerup', pUp); head.removeEventListener('pointercancel', pUp);
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
      <div className="sheet-body" onScroll={e => { const h = e.currentTarget.previousElementSibling; h?.classList.toggle('scrolled', e.currentTarget.scrollTop > 2); }}>{d.body}</div>
    </div>
  </>);
}
export function SheetHost() {
  const list = useStore(sheetStore);
  return <div id="layer">{list.map(s => <SheetView key={s.id} s={s} />)}</div>;
}
