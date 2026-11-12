/* Twodo · the app's render clock. Data lives in plain objects (D, L, Chat); anything that changes them calls
   scheduleRender(), and React components subscribe with useApp() (useSyncExternalStore). One frame, one render.
   While a finger is dragging something (a task row, the page), renders wait until it lets go. */
let version = 0;
let queued = 0;
let deferred = false;
const listeners = new Set<() => void>();
export const renderGate = { busy: (): boolean => false };

export const subscribe = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getVersion = (): number => version;
export function renderNow(): void {
  if (queued) { cancelAnimationFrame(queued); queued = 0; }
  deferred = false;
  version++;
  listeners.forEach(fn => fn());
}
export function scheduleRender(): void {
  if (queued || typeof requestAnimationFrame !== 'function') return;
  queued = requestAnimationFrame(() => {
    queued = 0;
    if (renderGate.busy()) { deferred = true; return; }
    renderNow();
  });
}
/** called when a drag ends: catch up on anything that changed meanwhile */
export function flushDeferred(): void { if (deferred) scheduleRender(); }
