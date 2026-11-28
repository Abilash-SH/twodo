/* iOS has no keyboard events. Measure VisualViewport on focus/resize/scroll, coalesced once per frame.
   Never predict a saved height, animate layout, or hide the app to force a reflow. */
import { useEffect } from 'react';
import { isIOS, reducedMotion, standalone } from '@/lib/util';

// a field inside a sheet or a page scrolls itself into view above the keyboard (only that list scrolls, never the page)
function revealField() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !isField(el) || el.closest('#composer, .chatbar')) return;
  const sc = el.closest<HTMLElement>('.sheet-body, .view'); if (!sc) return;
  const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect(), pad = 16;
  if (r.bottom > b.bottom - pad) sc.scrollBy({ top: r.bottom - b.bottom + pad, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}
const isField = (el: Element | null): boolean => !!el?.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=color]), textarea, select, [contenteditable="true"]');

export function useKeyboard(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    let frame = 0, fullHeight = innerHeight, width = innerWidth;
    const measure = () => {
      frame = 0;
      if (width !== innerWidth) { width = innerWidth; fullHeight = innerHeight; }
      const focused = isField(document.activeElement);
      if (!focused) fullHeight = Math.max(fullHeight, innerHeight);
      const height = vv?.height ?? innerHeight, top = vv?.offsetTop ?? 0;
      // Keep the keyboard state through blur until the viewport actually expands. Android may resize innerHeight too.
      const layoutHeight = isIOS() ? innerHeight : Math.max(innerHeight, fullHeight);
      const wasCovered = document.body.classList.contains('kb');
      // Detection needs a meaningful occlusion; dismissal waits until the viewport has really recovered.
      // Clearing at the detection threshold would expand standalone CSS for the final 80 px of keyboard travel.
      const covered = layoutHeight - height - top > (wasCovered ? 4 : 80);
      document.body.classList.toggle('kb', covered);
      if (covered && !wasCovered) setTimeout(revealField, 60);
      const root = document.documentElement.style;
      root.setProperty('--vvh', `${height}px`);
      root.setProperty('--vvt', `${top}px`);
      // At rest the standalone app fills the layout viewport itself (CSS inset: 0), never a viewport unit.
      const installedAtRest = isIOS() && standalone() && !covered && !focused;
      document.body.classList.toggle('ios-fullscreen', installedAtRest);
      // Some installed iPhones report a viewport one status-bar short of the physical screen.
      // Only Explore's non-keyboard scenery may use this extra extent; never resize chat or overlays.
      // Reject zoom, split-screen, transient keyboard geometry and implausibly large differences.
      const portrait = matchMedia('(orientation: portrait)').matches;
      const screenHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
      const screenWidth = portrait ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
      const gap = screenHeight - height;
      const canExtend = installedAtRest && Math.abs((vv?.scale ?? 1) - 1) < .01
        && Math.abs(screenWidth - innerWidth) <= 2 && Math.abs(innerHeight - height) <= 2 && Math.abs(top) <= 2
        && gap > 1 && gap <= 100;
      root.style.setProperty('--explore-screen-gap', `${canExtend ? gap : 0}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const visible = () => { if (!document.hidden) schedule(); };
    measure();
    vv?.addEventListener('resize', schedule); vv?.addEventListener('scroll', schedule);
    addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule); document.addEventListener('focusout', schedule);
    document.addEventListener('visibilitychange', visible);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule); vv?.removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule); document.removeEventListener('focusout', schedule);
      document.removeEventListener('visibilitychange', visible);
      document.body.classList.remove('kb', 'ios-fullscreen');
      document.documentElement.style.removeProperty('--explore-screen-gap');
    };
  }, []);
}
