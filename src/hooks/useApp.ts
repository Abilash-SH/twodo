/* Twodo · re-render when the app's data changes (tasks, lists, messages, sync state…) */
import { useSyncExternalStore } from 'react';
import { getVersion, subscribe } from '@/lib/render';

export const useApp = (): number => useSyncExternalStore(subscribe, getVersion, getVersion);
