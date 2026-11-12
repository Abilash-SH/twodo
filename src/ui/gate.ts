/* Twodo · full-screen first screens: the sign-in gate (accounts on) or the offline onboarding */
import { createStore } from './store';

export type GatePage = 'welcome' | 'create' | 'signin' | 'username' | 'ready';
export const gateStore = createStore<{ kind: 'gate' | 'onboarding'; first: GatePage; seq: number } | null>(null);
let seq = 0;
export const showGate = (first: GatePage = 'welcome'): void => gateStore.set({ kind: 'gate', first, seq: ++seq });
export const showOnboarding = (): void => gateStore.set({ kind: 'onboarding', first: 'welcome', seq: ++seq });
export const boot = { run: (): void => {} };
