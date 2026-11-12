/* Twodo · tiny observable stores for screen state (which sheet, menu, toast… is showing). No dependency needed. */
import { useSyncExternalStore } from 'react';

export interface Store<T> { get: () => T; set: (next: T | ((cur: T) => T)) => void; subscribe: (fn: () => void) => () => void }
export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => { value = typeof next === 'function' ? (next as (c: T) => T)(value) : next; listeners.forEach(fn => fn()); },
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}
export const useStore = <T,>(s: Store<T>): T => useSyncExternalStore(s.subscribe, s.get, s.get);
