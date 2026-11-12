/* Twodo · rows slide into place. After every update, each row that moved (because a row above it was added, completed,
   deleted or moved) glides from where it was to where it is now: one layout change, then a transform (FLIP). */
import { useLayoutEffect, useRef } from 'react';
import { EASE, MS, calm } from '@/lib/motion';

// where a row sits inside its scrolling page, ignoring any animation in flight
function layoutTop(el: HTMLElement, stop: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== stop; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}
export function useFlip(container: React.RefObject<HTMLElement | null>, key: string, itemSel = '.task[data-id]') {
  const prev = useRef(new Map<string, number>()), lastKey = useRef('');
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) { prev.current = new Map(); return; }
    const page = (root.closest('.view') as HTMLElement | null) || root;
    const els = Array.from(root.querySelectorAll<HTMLElement>(itemSel));
    const now = new Map<string, number>();
    for (const el of els) if (el.dataset.id && !el.classList.contains('leaving')) now.set(el.dataset.id, layoutTop(el, page));
    const same = lastKey.current === key; lastKey.current = key;
    // only for the screen you're looking at, never while a finger is moving things, never with Reduce Motion
    if (same && !calm() && !page.classList.contains('under') && !document.getElementById('stack')?.classList.contains('dragging')) {
      const moves: [HTMLElement, number][] = [];
      for (const el of els) {
        const id = el.dataset.id!, p = prev.current.get(id), n = now.get(id);
        if (p === undefined || n === undefined || el.classList.contains('swiping')) continue;
        if (Math.abs(p - n) > 1) moves.push([el, p - n]);
      }
      if (moves.length <= 40) for (const [el, d] of moves)
        el.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: MS.standard, easing: EASE.out, composite: 'add' });
    }
    prev.current = now;
  });
}
