/* Twodo · whether the launch is showing, and in which two colours. It shows once per start; the Playground can
   play it again. Phase 2 sets the colours from the people record before the first frame. */
import { useSyncExternalStore } from 'react';
import type { ColorName } from '../tokens';

export interface LaunchState { showing: boolean; a: ColorName; b: ColorName }
let state: LaunchState = { showing: true, a: 'blue', b: 'pink' };
const listeners = new Set<() => void>();
const set = (next: Partial<LaunchState>): void => { state = { ...state, ...next }; listeners.forEach(l => l()); };

export const launch = {
  replay(a: ColorName = state.a, b: ColorName = state.b): void { set({ showing: true, a, b }); },
  end(): void { set({ showing: false }); },
};

export function useLaunch(): LaunchState {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
    () => state,
  );
}
