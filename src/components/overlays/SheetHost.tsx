'use client';
/* Twodo · sheets: card modals that slide up, and close with Done, a tap outside, a drag down or a swipe right */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '@/lib/util';
import { useApp } from '@/hooks/useApp';
import { NO_SWIPE, SLOP, Velocity, flung, touchById } from '@/hooks/swipe';
import { closeSheet, sheetStore, type SheetEntry } from '@/ui/sheet';
import { useStore } from '@/ui/store';

/* Drag a sheet down to close it (from its top bar, or anywhere once its content is scrolled to the top), or swipe it
   away to the right, like going back. Fingers use touch events so the sheet's own scrolling can't steal the swipe. */
function useSheetDrag(sh: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = sh.current; if (!el) return;
    const head = el.querySelector<HTMLElement>('.sheet-head')!, body = el.querySelector<HTMLElement>('.sheet-body')!;
    let S: { id: number; x0: number; y0: number; axis: null | 'x' | 'y'; d: number; v: Velocity; canDown: boolean } | null = null;
    const apply = (d: number, axis: 'x' | 'y') => {
      el.style.transform = axis === 'y' ? `translate3d(0,${d}px,0)` : `translate3d(${d}px,0,0)`;
      document.body.style.setProperty('--sp', String(clamp(1 - d / (axis === 'y' ? el.offsetHeight : el.offsetWidth), 0, 1)));
    };
    const begin = (id: number, x: number, y: number, target: HTMLElement) => {
      if (target.closest('button') && head.contains(target)) return;
      const inHead = head.contains(target);
      if (!inHead && target.closest(NO_SWIPE)) return;
      S = { id, x0: x, y0: y, axis: null, d: 0, v: new Velocity(), canDown: inHead || body.scrollTop <= 0 };
      S.v.add(x, y);
    };
    const track = (x: number, y: number, mouse = false): boolean => {
      const G = S; if (!G) return false;
      const dx = x - G.x0, dy = y - G.y0;
      if (!G.axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return false;
        if (G.canDown && dy > 0 && dy >= Math.abs(dx)) G.axis = 'y';
        else if (!mouse && dx > 0 && dx > Math.abs(dy)) G.axis = 'x';
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
      if (G.axis === 'y') {
        el.style.transition = ''; el.style.transform = '';
        if (!cancel && (G.d > 130 || vy > 0.5)) closeSheet(); else document.body.style.setProperty('--sp', '1');
        return;
      }
      if (!cancel && vx > -0.15 && flung(G.d, vx, el.offsetWidth)) { // swiped away: keep going off to the right
        el.style.transition = 'transform .26s cubic-bezier(.2,.8,.2,1)'; apply(el.offsetWidth + 40, 'x');
        const back = el.querySelector<HTMLElement>('.sheet-bar [data-back]'); // a page inside Settings goes back to Settings
        if (back) back.click(); else closeSheet();
        return;
      }
      el.style.transition = 'transform .42s cubic-bezier(.34,1.4,.64,1)'; el.style.transform = '';
      document.body.style.setProperty('--sp', '1');
      setTimeout(() => { el.style.transition = ''; }, 430);
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
      <div className="sheet-body">{d.body}</div>
    </div>
  </>);
}
export function SheetHost() {
  const list = useStore(sheetStore);
  return <div id="layer">{list.map(s => <SheetView key={s.id} s={s} />)}</div>;
}
