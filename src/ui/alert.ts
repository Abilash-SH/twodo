/* Twodo · confirm dialogs (iOS-style alerts) */
import { haptic } from '@/lib/feedback';
import { createStore } from './store';

export interface AlertOpts { title: string; message?: string; ok?: string; cancel?: string | null; destructive?: boolean }
interface AlertEntry extends AlertOpts { id: number; resolve: (ok: boolean) => void }
export const alertStore = createStore<AlertEntry[]>([]);
let seq = 0;
export function confirmDialog(o: AlertOpts): Promise<boolean> {
  haptic('warn');
  return new Promise(resolve => alertStore.set(a => [...a, { ok: 'OK', cancel: 'Cancel', message: '', destructive: false, ...o, id: ++seq, resolve }]));
}
export const alertOpen = (): boolean => alertStore.get().length > 0;
