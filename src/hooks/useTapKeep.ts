/* Twodo · a button that doesn't steal the keyboard. On iOS, tapping a button makes the text field lose focus
   (closing the keyboard) before the click arrives. While the field is focused we cancel the touch so focus stays,
   and run the action ourselves on release. A mouse click works as usual. */
import { useEffect, useRef } from 'react';

export function useTapKeep(btn: React.RefObject<HTMLElement | null>, fn: (e: Event) => void, field: React.RefObject<HTMLElement | null>) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const b = btn.current; if (!b) return;
    b.dataset.tapkeep = '1'; // areas using useTapKeepWithin leave this one alone
    let own = false, x0 = 0, y0 = 0;
    const md = (e: MouseEvent) => e.preventDefault();
    const ts = (e: TouchEvent) => {
      const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
      own = !!field.current && document.activeElement === field.current;
      if (own && e.cancelable) e.preventDefault();
    };
    const te = (e: TouchEvent) => {
      if (!own) return; own = false;
      const t = e.changedTouches[0];
      if (Math.hypot(t.clientX - x0, t.clientY - y0) > 14) return;
      if (e.cancelable) e.preventDefault();
      cb.current(e);
    };
    const tc = () => { own = false; };
    const click = (e: MouseEvent) => cb.current(e);
    b.addEventListener('mousedown', md);
    b.addEventListener('touchstart', ts, { passive: false });
    b.addEventListener('touchend', te, { passive: false });
    b.addEventListener('touchcancel', tc);
    b.addEventListener('click', click);
    return () => {
      b.removeEventListener('mousedown', md); b.removeEventListener('touchstart', ts); b.removeEventListener('touchend', te);
      b.removeEventListener('touchcancel', tc); b.removeEventListener('click', click);
    };
  }, [btn, field]);
}

/* The same for every button inside an area (the composer's pills, chips, + and list picker): tapping any of them
   while the field is focused keeps the keyboard up. Inside a row that scrolls sideways the touch isn't cancelled at
   the start (so the row can still scroll); only the release is, and the tap is replayed as a click. */
const CONTROL = 'button, [role=button], a[href]';
const typing = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).matches?.('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), [contenteditable]');
/** field: the text field to keep focused; leave it out for "whichever text field is focused" (menus, the island) */
export function useTapKeepWithin(zone: React.RefObject<HTMLElement | null>, field?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const z = zone.current; if (!z) return;
    let tgt: HTMLElement | null = null, x0 = 0, y0 = 0, moved = false;
    const scrolls = (el: HTMLElement) => { for (let p: HTMLElement | null = el; p && p !== z.parentElement; p = p.parentElement) if (p.scrollWidth > p.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(p).overflowX)) return true; return false; };
    const ts = (e: TouchEvent) => {
      tgt = null;
      const f = field ? field.current : document.activeElement;
      if (!f || document.activeElement !== f || !typing(f) || e.touches.length !== 1) return;
      const c = (e.target as HTMLElement).closest<HTMLElement>(CONTROL); if (!c || !z.contains(c) || c.dataset.tapkeep || (c as HTMLButtonElement).disabled) return;
      tgt = c; moved = false; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      if (!scrolls(c) && e.cancelable) e.preventDefault();
    };
    const tm = (e: TouchEvent) => { if (tgt && Math.hypot(e.touches[0].clientX - x0, e.touches[0].clientY - y0) > 10) moved = true; };
    const te = (e: TouchEvent) => {
      const c = tgt; tgt = null; if (!c) return;
      if (e.cancelable) e.preventDefault(); // no compatibility mouse events: they're what make iOS drop the focus
      if (!moved) c.click();
    };
    const tc = () => { tgt = null; };
    const md = (e: MouseEvent) => { if ((e.target as HTMLElement).closest(CONTROL) && typing(document.activeElement) && (!field || document.activeElement === field.current)) e.preventDefault(); };
    z.addEventListener('touchstart', ts, { passive: false }); z.addEventListener('touchmove', tm, { passive: true });
    z.addEventListener('touchend', te, { passive: false }); z.addEventListener('touchcancel', tc); z.addEventListener('mousedown', md);
    return () => {
      z.removeEventListener('touchstart', ts); z.removeEventListener('touchmove', tm);
      z.removeEventListener('touchend', te); z.removeEventListener('touchcancel', tc); z.removeEventListener('mousedown', md);
    };
  }, [zone, field]);
}
