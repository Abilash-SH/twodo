/* iOS has no keyboard events. Measure VisualViewport on focus/resize/scroll, coalesced once per frame.
   Never predict a saved height, animate layout, or hide the app to force a reflow. */
import { useEffect } from 'react';
import { isIOS, standalone } from '@/lib/util';

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
      const root = document.documentElement.style;
      root.setProperty('--vvh', `${height}px`);
      root.setProperty('--vvt', `${top}px`);
      // A standalone iPhone's layout viewport can stay short after dismissal; CSS uses 100lvh at rest.
      document.body.classList.toggle('ios-fullscreen', isIOS() && standalone() && !covered && !focused);
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
    };
  }, []);
}
