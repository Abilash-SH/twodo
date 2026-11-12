/* Twodo · keep the app exactly in the visible area, and move with the on-screen keyboard instead of jumping.
   iOS only reports the keyboard once it has finished sliding up, so the app learns its height the first time and
   from then on makes room as the keyboard starts to appear (and glides back down as it leaves).

   The layout changes once (the app's height snaps to the new size); what you see glide is a transform on the parts
   that moved (the message bar, the composer, the messages pinned to the bottom, an open sheet). Animating the
   height itself re-laid out the whole screen every frame, which is what made it stutter and blank the header. */
import { useEffect } from 'react';
import { EASE, MS, calm } from '@/lib/motion';
import { isIOS, standalone } from '@/lib/util';

const KB = {
  maxH: 0, w: 0, pending: 0, misses: 0, lastTouch: -1e9, animT: undefined as ReturnType<typeof setTimeout> | undefined,
  key() { return 'twodo:kb' + (innerWidth > innerHeight ? 'l' : 'p'); },
  learned() { try { return +(localStorage.getItem(this.key()) || 0) || 0; } catch { return 0; } },
  learn(h: number) { try { localStorage.setItem(this.key(), String(Math.round(h))); } catch { /* private mode */ } },
};
const isField = (el: Element | null): el is HTMLElement => !!el && !!(el as HTMLElement).matches && ((el as HTMLElement).isContentEditable
  || (el as HTMLElement).matches('textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=color])'));
const isTypingField = (el: Element | null): boolean => isField(el) && !(el as HTMLInputElement).readOnly && !el.matches('select, input[type=date], input[type=time], input[type=datetime-local], input[type=month], input[type=week]');

// what glides with the keyboard (everything else either stays put or is out of view)
const GLIDE = '#composer:not(.hide), .chatview:not(.under) .chatbar, .chatbody[data-pinned="1"] > *, #layer .sheet.open';
function setViewportBox(h: number, top: number, animate?: boolean) {
  const root = document.documentElement.style, prev = parseFloat(root.getPropertyValue('--vvh')) || 0;
  if (animate === undefined) animate = !!prev && Math.abs(prev - h) > 60; // a big change is the keyboard
  const before = animate && !calm() ? Array.from(document.querySelectorAll<HTMLElement>(GLIDE), el => [el, el.getBoundingClientRect().top] as const) : null;
  root.setProperty('--vvh', Math.round(h) + 'px'); root.setProperty('--vvt', Math.round(top) + 'px');
  if (!before) return;
  // the newest message stays at the bottom in the same frame, then everything that moved glides from where it was
  document.querySelectorAll<HTMLElement>('.chatbody[data-pinned="1"]').forEach(b => { b.scrollTop = b.scrollHeight; });
  document.body.classList.add('kb-anim'); clearTimeout(KB.animT);
  KB.animT = setTimeout(() => document.body.classList.remove('kb-anim'), MS.keyboard + 80);
  for (const [el, t0] of before) {
    const d = t0 - el.getBoundingClientRect().top;
    if (Math.abs(d) < 2) continue;
    el.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: MS.keyboard, easing: EASE.keyboard, composite: 'add' });
  }
}
// a field inside a sheet or a page scrolls itself into view above the keyboard (only that list scrolls, never the page)
function revealField() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !isTypingField(el)) return;
  const sc = el.closest<HTMLElement>('.sheet-body, .view'); if (!sc) return;
  const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect(), pad = 16;
  const bottom = b.bottom - (sc.classList.contains('view') ? parseFloat(getComputedStyle(document.getElementById('app')!).getPropertyValue('--composer-h')) || 0 : 0);
  if (r.bottom > bottom - pad) sc.scrollBy({ top: r.bottom - bottom + pad, behavior: calm() ? 'auto' : 'smooth' });
}
function onViewport() {
  const vv = window.visualViewport, el = document.activeElement, field = isField(el);
  if (innerWidth !== KB.w) { KB.w = innerWidth; KB.maxH = 0; } // rotated
  if (!field) KB.maxH = Math.max(KB.maxH, innerHeight);
  const vh = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0;
  const kb = field && !!vv && vh < innerHeight * 0.8;
  if (kb) {
    const opening = !document.body.classList.contains('kb');
    document.body.classList.add('kb');
    if (isTypingField(el)) { KB.learn(innerHeight - vh); KB.misses = 0; }
    KB.pending = 0; setViewportBox(vh, top);
    if (opening || Math.abs(vh - (parseFloat(document.documentElement.style.getPropertyValue('--vvh')) || vh)) < 2) setTimeout(revealField, 60);
    return;
  }
  if (field && performance.now() < KB.pending) return; // the keyboard is still sliding up into the room we made
  document.body.classList.remove('kb');
  if (field) { setViewportBox(vh, top); return; } // e.g. a hardware keyboard: nothing covers the page
  // Nothing focused: use the whole screen (iOS can leave the visual viewport offset after the keyboard closes)
  setViewportBox(innerHeight, 0);
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
}
// Only a finger tapping a field brings up the keyboard on iPhone, so only then make room for it in advance.
// (A field focused by code shows no keyboard: making room then left a gap, and taught the app "no keyboard here".)
function keyboardWillShow(e: FocusEvent) {
  if (!isIOS() || !isTypingField(e.target as Element) || document.body.classList.contains('kb')) return;
  if (performance.now() - KB.lastTouch > 800) return;
  const h = KB.learned(); if (!h || h > innerHeight * 0.7) return;
  KB.pending = performance.now() + 1000;
  document.body.classList.add('kb');
  setViewportBox(innerHeight - h, 0, true);
  setTimeout(() => {
    const vv = window.visualViewport;
    if (isField(document.activeElement) && vv && vv.height >= innerHeight * 0.8) {
      if (++KB.misses >= 2) KB.learn(0); // twice in a row with no on-screen keyboard: a hardware keyboard is attached
    }
    KB.pending = 0; onViewport();
  }, 1050);
}
function keyboardWillHide() {
  if (isField(document.activeElement)) return; // just moved to another field
  KB.pending = 0;
  if (!document.body.classList.contains('kb') && !isIOS()) return;
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
    const touched = () => { KB.lastTouch = performance.now(); };
    vv?.addEventListener('resize', onViewport); vv?.addEventListener('scroll', onViewport);
    addEventListener('resize', onViewport);
    document.addEventListener('touchend', touched, { capture: true, passive: true });
    document.addEventListener('focusin', keyboardWillShow);
    document.addEventListener('focusout', out);
    return () => {
      vv?.removeEventListener('resize', onViewport); vv?.removeEventListener('scroll', onViewport);
      removeEventListener('resize', onViewport);
      document.removeEventListener('touchend', touched, { capture: true });
      document.removeEventListener('focusin', keyboardWillShow); document.removeEventListener('focusout', out);
    };
  }, []);
}
