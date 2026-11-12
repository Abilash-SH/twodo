/* Twodo · keep the app exactly in the visible area, and move with the on-screen keyboard instead of jumping.
   iOS only reports the keyboard once it has finished sliding up, so the app learns its height the first time and
   from then on makes room as the keyboard starts to appear (and glides back down as it leaves). */
import { useEffect } from 'react';
import { isIOS, reducedMotion, standalone } from '@/lib/util';

const KB = {
  maxH: 0, w: 0, pending: 0, animT: undefined as ReturnType<typeof setTimeout> | undefined,
  key() { return 'twodo:kb' + (innerWidth > innerHeight ? 'l' : 'p'); },
  learned() { try { return +(localStorage.getItem(this.key()) || 0) || 0; } catch { return 0; } },
  learn(h: number) { try { localStorage.setItem(this.key(), String(Math.round(h))); } catch { /* private mode */ } },
};
const isField = (el: Element | null): el is HTMLElement => !!el && !!(el as HTMLElement).matches && ((el as HTMLElement).isContentEditable
  || (el as HTMLElement).matches('textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=color])'));
const isTypingField = (el: Element | null): boolean => isField(el) && !(el as HTMLInputElement).readOnly && !el.matches('select, input[type=date], input[type=time], input[type=datetime-local], input[type=month], input[type=week]');

function setViewportBox(h: number, top: number, animate?: boolean) {
  const root = document.documentElement.style, prev = parseFloat(root.getPropertyValue('--vvh')) || 0;
  if (animate === undefined) animate = !!prev && Math.abs(prev - h) > 60; // any big change (the keyboard) glides instead of jumping
  if (animate && !reducedMotion.matches) {
    document.body.classList.add('kb-anim'); clearTimeout(KB.animT);
    KB.animT = setTimeout(() => document.body.classList.remove('kb-anim'), 460);
  }
  root.setProperty('--vvh', Math.round(h) + 'px'); root.setProperty('--vvt', Math.round(top) + 'px');
}
function onViewport() {
  const vv = window.visualViewport, el = document.activeElement, field = isField(el);
  if (innerWidth !== KB.w) { KB.w = innerWidth; KB.maxH = 0; } // rotated
  if (!field) KB.maxH = Math.max(KB.maxH, innerHeight);
  const vh = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0;
  const kb = field && !!vv && vh < innerHeight * 0.8;
  if (kb) {
    document.body.classList.add('kb');
    if (isTypingField(el)) KB.learn(innerHeight - vh);
    KB.pending = 0; setViewportBox(vh, top); return;
  }
  if (field && performance.now() < KB.pending) return; // the keyboard is still sliding up into the room we made
  document.body.classList.remove('kb');
  if (field) { setViewportBox(vh, top); return; } // e.g. a hardware keyboard: nothing covers the page
  // Nothing focused: use the whole screen (iOS can leave the visual viewport offset after the keyboard closes)
  setViewportBox(innerHeight, 0);
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
}
function keyboardWillShow(e: FocusEvent) {
  if (!isIOS() || !isTypingField(e.target as Element) || document.body.classList.contains('kb')) return;
  const h = KB.learned(); if (!h || h > innerHeight * 0.7) return;
  KB.pending = performance.now() + 1000;
  document.body.classList.add('kb');
  setViewportBox(innerHeight - h, 0, true);
  setTimeout(() => {
    const vv = window.visualViewport;
    if (isField(document.activeElement) && vv && vv.height >= innerHeight * 0.8) KB.learn(0); // no on-screen keyboard came (hardware keyboard)
    KB.pending = 0; onViewport();
  }, 1050);
}
function keyboardWillHide() {
  if (isField(document.activeElement)) return; // just moved to another field
  KB.pending = 0;
  document.body.classList.remove('kb');
  setViewportBox(innerHeight, 0, isIOS());
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  setTimeout(healViewport, 180);
}
// iOS home-screen apps can get stuck a little shorter after the keyboard closes; a quick re-layout restores full height
function healViewport() {
  if (!isIOS() || !standalone() || isField(document.activeElement) || KB.maxH - innerHeight <= 4) return;
  const app = document.getElementById('app'); if (!app) return;
  const keep = Array.from(document.querySelectorAll<HTMLElement>('.chatbody, .view')).map(x => [x, x.scrollTop] as const);
  app.style.display = 'none'; void app.offsetHeight; app.style.display = '';
  keep.forEach(([x, t]) => { x.scrollTop = t; });
  onViewport();
}

export function useKeyboard(): void {
  useEffect(() => {
    onViewport();
    const vv = window.visualViewport;
    const out = () => setTimeout(keyboardWillHide, 30);
    vv?.addEventListener('resize', onViewport); vv?.addEventListener('scroll', onViewport);
    addEventListener('resize', onViewport);
    document.addEventListener('focusin', keyboardWillShow);
    document.addEventListener('focusout', out);
    return () => {
      vv?.removeEventListener('resize', onViewport); vv?.removeEventListener('scroll', onViewport);
      removeEventListener('resize', onViewport);
      document.removeEventListener('focusin', keyboardWillShow); document.removeEventListener('focusout', out);
    };
  }, []);
}
