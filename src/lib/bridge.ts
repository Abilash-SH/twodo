/* Twodo · the few things the data layer asks of the screen (toasts, the sign-in gate, closing a sheet).
   The React app registers the real implementations at start-up; until then these are harmless no-ops. */
export interface IslandMsg { e?: string; text?: string; sub?: string; btn?: string; onBtn?: (() => void) | null; ms?: number }
type GateMode = 'welcome' | 'create' | 'signin' | 'username' | 'ready';

export const ui = {
  island: (_m: IslandMsg): void => {},
  showGate: (_mode: GateMode): void => {},
  closeSheet: (): void => {},
  seedTasks: (): void => {},
};
export const island = (m: IslandMsg): void => ui.island(m);
