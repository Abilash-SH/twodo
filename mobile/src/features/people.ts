/* Twodo · the two of you, as the screens see you. Until sign-in exists (phase 2) these are sample people for the
   preview build, kept in memory: a look changed in the Playground shows on Home and in the Journal until the app
   closes. Phase 2 fills them from the encrypted people record. Nothing here is stored or sent. */
import { useSyncExternalStore } from 'react';
import { DEFAULT_LOOKS, type AvatarLook } from '@/ui/avatar/looks';
import type { ColorName } from '@/ui/tokens';

export interface Person { name: string; avatar: AvatarLook; color: ColorName }
export interface People { me: Person; partner: Person; partnerOnline: boolean; unread: number }
export type Who = 'me' | 'partner';

export const SAMPLE_PEOPLE: People = {
  me: { name: 'Abilash', avatar: DEFAULT_LOOKS.male, color: 'blue' },
  partner: { name: 'Deiva', avatar: DEFAULT_LOOKS.female, color: 'pink' },
  partnerOnline: true,
  unread: 2,
};

let people = SAMPLE_PEOPLE;
const listeners = new Set<() => void>();

export const peopleStore = {
  get: (): People => people,
  /** Changes one person's look or colour (the Playground's pickers). */
  set(who: Who, change: Partial<Pick<Person, 'avatar' | 'color'>>): void {
    people = { ...people, [who]: { ...people[who], ...change } };
    listeners.forEach(l => l());
  },
  reset(): void { people = SAMPLE_PEOPLE; listeners.forEach(l => l()); },
};

export function usePeople(): People {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    peopleStore.get,
    peopleStore.get,
  );
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;
