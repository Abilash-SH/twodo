/* Twodo · shared swipe helpers. Touch gestures use touch events (not pointer events): the phone can't take a
   sideways swipe away from us halfway through to start scrolling, so swipes start at the first few pixels and
   feel as quick as a native app. A mouse still uses pointer events where it matters. */
import { useEffect, useRef } from 'react';

// places where a sideways drag belongs to the control itself, not to "go back / close"
export const NO_SWIPE = 'input, textarea, select, [contenteditable], .seg, .pills, .tip-pills, .no-pan, .picker, .colors, .f-ring';
// how far a finger moves before we decide what the gesture is
export const SLOP = 7;

// finger speed over the last ~100 ms, in px per ms (a quick flick counts even if the swipe is short)
export class Velocity {
  private s: [number, number, number][] = [];
  add(x: number, y: number): void {
    const t = performance.now(); this.s.push([x, y, t]);
    while (this.s.length > 2 && t - this.s[0][2] > 100) this.s.shift();
  }
  get(): { vx: number; vy: number } {
    if (this.s.length < 2) return { vx: 0, vy: 0 };
    const a = this.s[0], b = this.s[this.s.length - 1], dt = Math.max(8, b[2] - a[2]);
    return { vx: (b[0] - a[0]) / dt, vy: (b[1] - a[1]) / dt };
  }
}
export const touchById = (e: TouchEvent, id: number): Touch | undefined => {
  for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === id) return e.changedTouches[i];
  for (let i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === id) return e.touches[i];
  return undefined;
};
// a swipe "counts" when it went far enough, or was a quick flick in that direction
export const flung = (d: number, v: number, size: number): boolean => d > size * 0.3 || (d > 24 && v > 0.35);

interface SwipeAwayOpts {
  onClose: () => void;
  down?: boolean; // a drag down closes too (when the content is scrolled to the top)
  scroller?: () => HTMLElement | null;
  onProgress?: (p: number) => void; // 0 = resting, 1 = fully away (fade a backdrop with it)
  enabled?: boolean;
}
/* Swipe a full-screen layer right (or down) to close it: it follows the finger and springs back if you let go early */
export function useSwipeAway(ref: React.RefObject<HTMLElement | null>, opts: SwipeAwayOpts): void {
  const o = useRef(opts);
  o.current = opts;
  const on = opts.enabled !== false;
  useEffect(() => {
    const el = ref.current; if (!el || !on) return;
    let S: { id: number; x0: number; y0: number; axis: null | 'x' | 'y'; d: number; v: Velocity; canDown: boolean } | null = null;
    const set = (d: number, axis: 'x' | 'y') => {
      el.style.transform = axis === 'x' ? `translate3d(${d}px,0,0)` : `translate3d(0,${d}px,0)`;
      o.current.onProgress?.(Math.min(1, d / (axis === 'x' ? el.offsetWidth : el.offsetHeight)));
    };
    const stop = () => { el.removeEventListener('touchmove', move); S = null; };
    const start = (e: TouchEvent) => {
      if (S || e.touches.length !== 1 || (e.target as HTMLElement).closest(NO_SWIPE)) return;
      const t = e.touches[0], sc = o.current.scroller?.();
      S = { id: t.identifier, x0: t.clientX, y0: t.clientY, axis: null, d: 0, v: new Velocity(), canDown: !!o.current.down && (!sc || sc.scrollTop <= 0) };
      S.v.add(t.clientX, t.clientY);
      el.addEventListener('touchmove', move, { passive: false });
    };
    const move = (e: TouchEvent) => {
      if (!S) return;
      if (e.touches.length > 1) return end(true);
      const t = touchById(e, S.id); if (!t) return;
      const dx = t.clientX - S.x0, dy = t.clientY - S.y0;
      if (!S.axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (dx > 0 && dx > Math.abs(dy)) S.axis = 'x';
        else if (S.canDown && dy > 0 && dy > Math.abs(dx)) S.axis = 'y';
        else return stop(); // scrolling, or a swipe the other way: not ours
        el.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      S.v.add(t.clientX, t.clientY);
      S.d = Math.max(0, S.axis === 'x' ? dx : dy);
      set(S.d, S.axis);
    };
    const end = (cancel = false) => {
      const G = S; stop(); if (!G || !G.axis) return;
      const { vx, vy } = G.v.get(), size = G.axis === 'x' ? el.offsetWidth : el.offsetHeight;
      const go = !cancel && flung(G.d, G.axis === 'x' ? vx : vy, size);
      el.style.transition = go ? 'transform .26s cubic-bezier(.2,.8,.2,1)' : 'transform .42s cubic-bezier(.34,1.4,.64,1)';
      if (go) { set(size + 40, G.axis); setTimeout(() => { o.current.onClose(); setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 420); }, 200); }
      else { el.style.transform = ''; o.current.onProgress?.(0); setTimeout(() => { el.style.transition = ''; }, 430); }
    };
    const touchEnd = (e: TouchEvent) => { if (S && touchById(e, S.id)) end(e.type === 'touchcancel'); };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', touchEnd); el.addEventListener('touchcancel', touchEnd);
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', touchEnd); el.removeEventListener('touchcancel', touchEnd);
    };
  }, [ref, on]);
}
