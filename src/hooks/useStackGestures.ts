/* Twodo · touch gestures on the screen stack:
   - task rows: swipe right to complete, left for Pin / Delete (long swipe deletes), long-press for the menu
   - pages: swipe right from the edge, or a sideways drag anywhere (including task text; controls retain their own gestures), to go back
   Fingers are followed with touch events (decided within a few pixels, then the page can't scroll underneath);
   a mouse uses pointer events. */
import { useEffect } from 'react';
import { haptic } from '@/lib/feedback';
import { flushDeferred, renderGate } from '@/lib/render';
import { isTouch, reducedMotion } from '@/lib/util';
import { NO_SWIPE, SLOP, Velocity, flung, touchById } from './swipe';
import { Menu, menuOpen } from '@/ui/menu';
import { Nav, liveEntries, popView, viewEl } from '@/ui/nav';
import { deleteTask, toggleDone } from '@/ui/tasks';
import { openTaskMenu } from '@/components/views/taskMenus';

interface RowG { kind: 'row'; row: HTMLElement; ti: HTMLElement; id: string; x0: number; y0: number; base: number; cur: number; mode: null | 'swipe' | 'scroll' | 'lp'; pid: number; touch: boolean; v: Velocity; vx: number; lp?: ReturnType<typeof setTimeout>; armed?: boolean; full?: boolean }
interface PageG { kind: 'edge' | 'pan'; pid: number; touch: boolean; x0: number; y0: number; top: HTMLElement; prev: HTMLElement; w: number; dx: number; active: boolean; v: Velocity }
type Gest = RowG | PageG;
export const Gesture = { g: null as Gest | null, suppressClickUntil: 0, openRow: null as HTMLElement | null, openOffset: 0 };
renderGate.busy = () => Nav.dragging || (!!Gesture.g && Gesture.g.kind === 'row' && Gesture.g.mode === 'swipe');

const EDGE = 32; // px from the left edge where a swipe always means "back"
const shade = () => document.querySelector<HTMLElement>('#stack > .shade');

function setSwipe(g: RowG, x: number) {
  const w = g.row.offsetWidth; let v = x;
  if (v > 0) {
    if (v > 140) v = 140 + (v - 140) * 0.35;
    g.row.dataset.dir = 'r';
    const armed = v > 100;
    if (armed !== !!g.armed) { g.armed = armed; g.row.classList.toggle('armed', armed); if (armed) haptic('light'); }
  } else if (v < 0) {
    g.row.dataset.dir = 'l';
    const full = -v > w * 0.62;
    if (full !== !!g.full) { g.full = full; g.row.classList.toggle('full', full); haptic('light'); }
  } else delete g.row.dataset.dir;
  g.cur = v;
  g.ti.style.transform = `translateX(${v}px)`;
  g.row.style.setProperty('--sw', Math.max(0, -v) + 'px');
}
export function settleRow(row: HTMLElement, x: number, cb?: () => void) {
  const ti = row.querySelector<HTMLElement>('.ti'); if (!ti) return;
  ti.style.transition = 'transform .45s var(--spring)';
  ti.style.transform = `translateX(${x}px)`;
  row.style.setProperty('--sw', Math.max(0, -x) + 'px');
  setTimeout(() => {
    ti.style.transition = '';
    if (x === 0) { ti.style.transform = ''; delete row.dataset.dir; row.classList.remove('armed', 'full'); }
    if (cb) cb();
  }, 460);
}
export function closeOpenRow() { const r = Gesture.openRow; if (r) { if (r.isConnected) settleRow(r, 0); Gesture.openRow = null; } }
function endSwipe(g: RowG, cancelled: boolean) {
  const { row, ti, id } = g, v = g.cur, w = row.offsetWidth;
  row.classList.remove('swiping');
  if (cancelled) { settleRow(row, 0); if (Gesture.openRow === row) Gesture.openRow = null; return; }
  if (v > 100 || (v > 40 && g.vx > 0.45)) { settleRow(row, 0); if (Gesture.openRow === row) Gesture.openRow = null; toggleDone(id); return; }
  if (g.full) {
    ti.style.transition = 'transform .3s var(--spring)'; ti.style.transform = `translateX(${-w}px)`;
    row.style.setProperty('--sw', w + 'px');
    Gesture.openRow = null; setTimeout(() => deleteTask(id), 220); return;
  }
  if (v < -50 || (v < -20 && g.vx < -0.4)) { settleRow(row, -156); Gesture.openRow = row; Gesture.openOffset = -156; return; }
  settleRow(row, 0); if (Gesture.openRow === row) Gesture.openRow = null;
}

interface Pt { x: number; y: number; id: number; touch: boolean; target: HTMLElement }

function moveEdge(G: PageG, p: Pt): boolean {
  const dx = Math.max(0, p.x - G.x0), dy = p.y - G.y0;
  if (!G.active) {
    if (Math.abs(p.x - G.x0) < SLOP && Math.abs(dy) < SLOP) return false;
    if (p.x <= G.x0 || Math.abs(dy) > dx * 1.5) { Gesture.g = null; return false; } // scrolling down the edge of the page: let it
    G.active = true; document.getElementById('stack')!.classList.add('dragging'); Nav.dragging = true;
  }
  G.v.add(p.x, p.y);
  G.dx = Math.max(0, p.x - G.x0);
  const k = Math.min(1, G.dx / G.w);
  G.top.style.transform = `translate3d(${G.dx}px,0,0)`;
  G.prev.style.transform = `translate3d(${-28 * (1 - k)}%,0,0)`;
  const sh = shade(); if (sh) sh.style.opacity = String(0.12 * (1 - k));
  return true;
}
function endEdge(G: PageG, cancelled = false) {
  if (!G.active) return;
  document.getElementById('stack')!.classList.remove('dragging'); Nav.dragging = false;
  const { vx } = G.v.get();
  const go = !cancelled && vx > -0.15 && flung(G.dx, vx, G.w);
  // Commit the dragged position before switching the CSS destination; release never restarts at zero.
  void G.top.offsetWidth;
  G.top.style.transition = reducedMotion.matches ? 'none' : go ? 'transform .26s cubic-bezier(.2,.8,.2,1)' : 'transform .42s cubic-bezier(.34,1.4,.64,1)';
  G.prev.style.transition = G.top.style.transition;
  G.top.style.transform = ''; G.prev.style.transform = '';
  setTimeout(() => { G.top.style.transition = ''; G.prev.style.transition = ''; }, 440);
  if (go) { Gesture.suppressClickUntil = performance.now() + 400; haptic('light'); popView(); }
  else { const sh = shade(); if (sh) sh.style.opacity = '.12'; }
  flushDeferred();
}

export function useStackGestures(stackRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const stackEl = stackRef.current; if (!stackEl) return;
    const pageG = (kind: 'edge' | 'pan', p: Pt): PageG | null => {
      const live = liveEntries(); if (live.length < 2) return null;
      const top = viewEl(live[live.length - 1].id), prev = viewEl(live[live.length - 2].id); if (!top || !prev) return null;
      const g: PageG = { kind, pid: p.id, touch: p.touch, x0: p.x, y0: p.y, top, prev, w: stackEl.offsetWidth, dx: 0, active: false, v: new Velocity() };
      g.v.add(p.x, p.y); return g;
    };
    // a finger or the mouse went down: work out what it might become
    const down = (p: Pt) => {
      const t = p.target;
      if (t.closest('.chatview')) return; // the chat has its own gestures
      const sx = p.x - stackEl.getBoundingClientRect().left, deep = liveEntries().length > 1;
      if (deep && sx < EDGE && p.touch) { Gesture.g = pageG('edge', p); return; }
      const ti = t.closest<HTMLElement>('.ti');
      // Anywhere else on a screen you opened: drag sideways to the right to go back (task rows keep their own swipes)
      if (!ti && deep && p.touch && !t.closest(NO_SWIPE)) {
        if (Gesture.openRow && !t.closest('.act-r')) closeOpenRow();
        Gesture.g = pageG('pan', p); return;
      }
      if (!ti) { if (Gesture.openRow && !t.closest('.act-r')) closeOpenRow(); return; }
      const row = ti.parentElement as HTMLElement;
      if (Gesture.openRow && Gesture.openRow !== row) closeOpenRow();
      const g: RowG = { kind: 'row', row, ti, id: row.dataset.id!, x0: p.x, y0: p.y, base: row === Gesture.openRow ? Gesture.openOffset : 0, cur: 0, mode: null, pid: p.id, touch: p.touch, v: new Velocity(), vx: 0 };
      g.cur = g.base; g.v.add(p.x, p.y);
      g.lp = setTimeout(() => {
        if (Gesture.g === g && !g.mode) { g.mode = 'lp'; Gesture.suppressClickUntil = performance.now() + 700; openTaskMenu(row); }
      }, 480);
      Gesture.g = g;
    };
    // returns true when the movement is ours (so the page must not scroll with it)
    const move = (p: Pt): boolean => {
      const G = Gesture.g; if (!G || p.id !== G.pid || p.touch !== G.touch) return false;
      if (G.kind === 'pan') { // decide: scrolling (let it be) or a swipe back (follow the finger from here)
        const dx = p.x - G.x0, dy = p.y - G.y0;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return false;
        if (dx > 0 && dx >= Math.abs(dy) * .85) { G.kind = 'edge'; return moveEdge(G, p); }
        Gesture.g = null; return false;
      }
      if (G.kind === 'edge') return moveEdge(G, p);
      const R = G as RowG;
      if (R.mode === 'lp' || R.mode === 'scroll') return R.mode === 'lp';
      const dx = p.x - R.x0, dy = p.y - R.y0;
      if (!R.mode) {
        if (R.touch && R.base === 0 && dx >= SLOP && dx > Math.abs(dy) * .85 && liveEntries().length > 1 && !R.row.querySelector('.chk')?.contains(p.target)) {
          clearTimeout(R.lp);
          const back = pageG('edge', { ...p, x: R.x0, y: R.y0 });
          if (back) { back.v = R.v; Gesture.g = back; return moveEdge(back, p); }
        }
        if (Math.hypot(dx, dy) > 8) clearTimeout(R.lp);
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) { R.mode = 'swipe'; R.row.classList.add('swiping'); }
        else if (Math.abs(dy) > SLOP) { R.mode = 'scroll'; return false; }
        else return false;
      }
      R.v.add(p.x, p.y); R.vx = R.v.get().vx;
      setSwipe(R, R.base + dx);
      return true;
    };
    const up = (id: number, touch: boolean, cancelled: boolean) => {
      const g = Gesture.g; if (!g || id !== g.pid || touch !== g.touch) return;
      Gesture.g = null;
      if (g.kind === 'pan') return;
      if (g.kind === 'edge') {
        // cancelled = the system took the gesture over (e.g. Safari's own back swipe): never pop here as well
        if (cancelled) Nav.edgeCancelAt = performance.now();
        endEdge(g, cancelled); return;
      }
      const r = g as RowG;
      clearTimeout(r.lp);
      if (r.mode === 'swipe') { r.vx = r.v.get().vx; Gesture.suppressClickUntil = performance.now() + 350; endSwipe(r, cancelled); }
      if (r.mode === 'lp') Menu.armAt = performance.now() + 150;
      setTimeout(flushDeferred, 480);
    };

    // touch
    const pt = (t: Touch, target: EventTarget | null): Pt => ({ x: t.clientX, y: t.clientY, id: t.identifier, touch: true, target: target as HTMLElement });
    const tStart = (e: TouchEvent) => {
      if (e.touches.length > 1) { const g = Gesture.g; if (g && g.touch) up(g.pid, true, true); return; } // a second finger: not a swipe
      down(pt(e.touches[0], e.target));
    };
    const tMove = (e: TouchEvent) => {
      const G = Gesture.g; if (!G || !G.touch) return;
      const t = touchById(e, G.pid); if (!t) return;
      if (move(pt(t, e.target)) && e.cancelable) e.preventDefault();
    };
    const tEnd = (e: TouchEvent) => {
      const G = Gesture.g; if (!G || !G.touch) return;
      if (!touchById(e, G.pid)) return;
      up(G.pid, true, e.type === 'touchcancel');
    };
    // mouse (touch screens send pointer events too: those are ignored here)
    const pDown = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down({ x: e.clientX, y: e.clientY, id: e.pointerId, touch: false, target: e.target as HTMLElement }); };
    const pMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') move({ x: e.clientX, y: e.clientY, id: e.pointerId, touch: false, target: e.target as HTMLElement }); };
    const pUp = (e: PointerEvent) => { if (e.pointerType === 'mouse') up(e.pointerId, false, e.type === 'pointercancel'); };
    const ctx = (e: MouseEvent) => {
      const ti = (e.target as HTMLElement).closest<HTMLElement>('.ti'); if (!ti) return;
      e.preventDefault();
      if (isTouch() || menuOpen()) return; // touch devices use the long-press
      openTaskMenu(ti.parentElement as HTMLElement); Menu.armAt = performance.now() + 50;
    };
    stackEl.addEventListener('touchstart', tStart, { passive: true });
    stackEl.addEventListener('touchmove', tMove, { passive: false });
    stackEl.addEventListener('touchend', tEnd); stackEl.addEventListener('touchcancel', tEnd);
    stackEl.addEventListener('pointerdown', pDown);
    addEventListener('pointermove', pMove, { passive: true });
    addEventListener('pointerup', pUp); addEventListener('pointercancel', pUp);
    stackEl.addEventListener('contextmenu', ctx);
    return () => {
      stackEl.removeEventListener('touchstart', tStart); stackEl.removeEventListener('touchmove', tMove);
      stackEl.removeEventListener('touchend', tEnd); stackEl.removeEventListener('touchcancel', tEnd);
      stackEl.removeEventListener('pointerdown', pDown); removeEventListener('pointermove', pMove);
      removeEventListener('pointerup', pUp); removeEventListener('pointercancel', pUp); stackEl.removeEventListener('contextmenu', ctx);
    };
  }, [stackRef]);
}
