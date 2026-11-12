/* Twodo · a button that doesn't steal the keyboard. On iOS, tapping a button makes the text field lose focus
   (closing the keyboard) before the click arrives. While the field is focused we cancel the touch so focus stays,
   and run the action ourselves on release. A mouse click works as usual. */
import { useEffect, useRef } from 'react';

export function useTapKeep(btn: React.RefObject<HTMLElement | null>, fn: (e: Event) => void, field: React.RefObject<HTMLElement | null>) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const b = btn.current; if (!b) return;
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
