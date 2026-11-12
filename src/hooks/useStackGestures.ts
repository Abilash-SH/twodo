/* Twodo · touch gestures on the screen stack:
   - task rows: swipe right to complete, left for Pin / Delete (long swipe deletes), long-press for the menu
   - pages: swipe right from the edge, or a sideways drag anywhere that isn't a task row or a control, to go back */
import { useEffect } from 'react';
import { haptic } from '@/lib/feedback';
import { flushDeferred, renderGate } from '@/lib/render';
import { isTouch } from '@/lib/util';
import { Menu, menuOpen } from '@/ui/menu';
import { Nav, liveEntries, popView, viewEl } from '@/ui/nav';
import { deleteTask, toggleDone } from '@/ui/tasks';
import { openTaskMenu } from '@/components/views/taskMenus';

interface RowG { kind: 'row'; row: HTMLElement; ti: HTMLElement; id: string; x0: number; y0: number; base: number; cur: number; mode: null | 'swipe' | 'scroll' | 'lp'; pid: number; lastX: number; lastT: number; vx: number; lp?: ReturnType<typeof setTimeout>; armed?: boolean; full?: boolean }
interface PageG { kind: 'edge' | 'pan'; pid: number; x0: number; y0: number; top: HTMLElement; prev: HTMLElement; w: number; dx: number; active: boolean; vx: number; lastX: number; lastT: number }
type Gest = RowG | PageG;
export const Gesture = { g: null as Gest | null, suppressClickUntil: 0, openRow: null as HTMLElement | null, openOffset: 0 };
renderGate.busy = () => Nav.dragging || (!!Gesture.g && Gesture.g.kind === 'row' && Gesture.g.mode === 'swipe');

const NO_PAN = 'input, textarea, select, [contenteditable], .seg, .pills, .tip-pills, .no-pan';
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
  if (v > 100 || (v > 45 && g.vx > 0.6)) { settleRow(row, 0); if (Gesture.openRow === row) Gesture.openRow = null; toggleDone(id); return; }
  if (g.full) {
    ti.style.transition = 'transform .3s var(--spring)'; ti.style.transform = `translateX(${-w}px)`;
    row.style.setProperty('--sw', w + 'px');
    Gesture.openRow = null; setTimeout(() => deleteTask(id), 220); return;
  }
  if (v < -50 || (v < -20 && g.vx < -0.5)) { settleRow(row, -156); Gesture.openRow = row; Gesture.openOffset = -156; return; }
  settleRow(row, 0); if (Gesture.openRow === row) Gesture.openRow = null;
}

function moveEdge(G: PageG, e: PointerEvent) {
  const dx = Math.max(0, e.clientX - G.x0);
  if (!G.active && dx > 6) { G.active = true; document.getElementById('stack')!.classList.add('dragging'); Nav.dragging = true; }
  if (!G.active) return;
  const now = performance.now();
  G.vx = (e.clientX - G.lastX) / Math.max(1, now - G.lastT); G.lastX = e.clientX; G.lastT = now;
  G.dx = dx;
  const p = Math.min(1, dx / G.w);
  G.top.style.transform = `translateX(${dx}px)`;
  G.prev.style.transform = `translateX(${-28 * (1 - p)}%)`;
  const sh = shade(); if (sh) sh.style.opacity = String(0.12 * (1 - p));
}
function endEdge(G: PageG, cancelled = false) {
  if (!G.active) return;
  document.getElementById('stack')!.classList.remove('dragging'); Nav.dragging = false;
  const go = !cancelled && (G.dx > G.w * 0.33 || G.vx > 0.45);
  // clear the finger offsets and pop in the same frame, so the page keeps sliding from where it was let go
  G.top.style.transform = ''; G.prev.style.transform = '';
  if (go) { Gesture.suppressClickUntil = performance.now() + 400; popView(); }
  else { const sh = shade(); if (sh) sh.style.opacity = '.12'; }
  flushDeferred();
}

export function useStackGestures(stackRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const stackEl = stackRef.current; if (!stackEl) return;
    const pageG = (kind: 'edge' | 'pan', e: PointerEvent): PageG | null => {
      const live = liveEntries(); if (live.length < 2) return null;
      const top = viewEl(live[live.length - 1].id), prev = viewEl(live[live.length - 2].id); if (!top || !prev) return null;
      return { kind, pid: e.pointerId, x0: e.clientX, y0: e.clientY, top, prev, w: stackEl.offsetWidth, dx: 0, active: false, vx: 0, lastX: e.clientX, lastT: performance.now() };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest('.chatview')) return; // the chat has its own gestures
      const sx = e.clientX - stackEl.getBoundingClientRect().left, deep = liveEntries().length > 1;
      if (deep && sx < 24 && e.pointerType !== 'mouse') { Gesture.g = pageG('edge', e); return; }
      const ti = t.closest<HTMLElement>('.ti');
      // Anywhere else on a screen you opened: drag sideways to the right to go back (task rows keep their own swipes)
      if (!ti && deep && e.pointerType !== 'mouse' && !t.closest(NO_PAN)) {
        if (Gesture.openRow && !t.closest('.act-r')) closeOpenRow();
        Gesture.g = pageG('pan', e); return;
      }
      if (!ti) { if (Gesture.openRow && !t.closest('.act-r')) closeOpenRow(); return; }
      const row = ti.parentElement as HTMLElement;
      if (Gesture.openRow && Gesture.openRow !== row) closeOpenRow();
      const g: RowG = { kind: 'row', row, ti, id: row.dataset.id!, x0: e.clientX, y0: e.clientY, base: row === Gesture.openRow ? Gesture.openOffset : 0, cur: 0, mode: null, pid: e.pointerId, lastX: e.clientX, lastT: performance.now(), vx: 0 };
      g.cur = g.base;
      g.lp = setTimeout(() => {
        if (Gesture.g === g && !g.mode) { g.mode = 'lp'; Gesture.suppressClickUntil = performance.now() + 700; openTaskMenu(row); }
      }, 480);
      Gesture.g = g;
    };
    const move = (e: PointerEvent) => {
      const G = Gesture.g; if (!G || e.pointerId !== G.pid) return;
      if (G.kind === 'pan') { // decide: scrolling (let it be) or a swipe back (follow the finger from here)
        const dx = e.clientX - G.x0, dy = e.clientY - G.y0;
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { Gesture.g = null; return; }
        if (dx < -12) { Gesture.g = null; return; }
        if (dx > 12 && dx > Math.abs(dy) * 1.4) { G.kind = 'edge'; G.x0 = e.clientX - 7; G.lastX = e.clientX; G.lastT = performance.now(); }
        return;
      }
      if (G.kind === 'edge') return moveEdge(G, e);
      const R = G as RowG;
      if (R.mode === 'lp' || R.mode === 'scroll') return;
      const dx = e.clientX - R.x0, dy = e.clientY - R.y0;
      if (!R.mode) {
        if (Math.hypot(dx, dy) > 8) clearTimeout(R.lp);
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          R.mode = 'swipe'; R.row.classList.add('swiping');
          try { R.ti.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        } else if (Math.abs(dy) > 10) { R.mode = 'scroll'; return; }
      }
      if (R.mode === 'swipe') {
        const now = performance.now();
        R.vx = (e.clientX - R.lastX) / Math.max(1, now - R.lastT); R.lastX = e.clientX; R.lastT = now;
        setSwipe(R, R.base + dx);
      }
    };
    const up = (e: PointerEvent) => {
      const g = Gesture.g; if (!g || e.pointerId !== g.pid) return;
      Gesture.g = null;
      if (g.kind === 'pan') return;
      if (g.kind === 'edge') {
        // cancelled = the system took the gesture over (e.g. the iPhone's own back swipe): never pop here as well
        if (e.type === 'pointercancel') Nav.edgeCancelAt = performance.now();
        endEdge(g, e.type === 'pointercancel'); return;
      }
      const r = g as RowG;
      clearTimeout(r.lp);
      if (r.mode === 'swipe') { Gesture.suppressClickUntil = performance.now() + 350; endSwipe(r, e.type === 'pointercancel'); }
      if (r.mode === 'lp') Menu.armAt = performance.now() + 150;
      setTimeout(flushDeferred, 480);
    };
    const ctx = (e: MouseEvent) => {
      const ti = (e.target as HTMLElement).closest<HTMLElement>('.ti'); if (!ti) return;
      e.preventDefault();
      if (isTouch() || menuOpen()) return; // touch devices use the long-press
      openTaskMenu(ti.parentElement as HTMLElement); Menu.armAt = performance.now() + 50;
    };
    stackEl.addEventListener('pointerdown', down);
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    stackEl.addEventListener('contextmenu', ctx);
    return () => {
      stackEl.removeEventListener('pointerdown', down); removeEventListener('pointermove', move);
      removeEventListener('pointerup', up); removeEventListener('pointercancel', up); stackEl.removeEventListener('contextmenu', ctx);
    };
  }, [stackRef]);
}
