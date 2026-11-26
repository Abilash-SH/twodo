/* Twodo · the realistic 3D people (2026-11-18: "a 3D character with a realistic look, like a perfect human").
   From Microsoft Rocketbox (MIT, public/people/LICENSE-Rocketbox.md), converted to small glTF files with colour
   textures (scripts in docs/characters.md). No new data: each person stands for one look + skin + hair, the same
   `avatar` record as before, so older versions draw their own picture of the same choice. */
import type { AvatarLook, Hair, Look, Skin } from './types';
import { asset } from './config';
import { SKINS } from './characters';

export interface Person3 { id: string; look: Look; skin: Skin; hair: Hair }
export const PEOPLE: Person3[] = [
  { id: 'f07', look: 'female', skin: 'honey', hair: 'espresso' }, { id: 'f03', look: 'female', skin: 'honey', hair: 'black' },
  { id: 'f11', look: 'female', skin: 'caramel', hair: 'black' }, { id: 'f05', look: 'female', skin: 'peach', hair: 'black' },
  { id: 'f14', look: 'female', skin: 'peach', hair: 'chestnut' }, { id: 'f12', look: 'female', skin: 'porcelain', hair: 'black' },
  { id: 'f13', look: 'female', skin: 'porcelain', hair: 'golden' },
  { id: 'm17', look: 'male', skin: 'caramel', hair: 'black' }, { id: 'm10', look: 'male', skin: 'honey', hair: 'black' },
  { id: 'm04', look: 'male', skin: 'cocoa', hair: 'black' }, { id: 'm12', look: 'male', skin: 'ebony', hair: 'black' },
  { id: 'm08', look: 'male', skin: 'peach', hair: 'espresso' }, { id: 'm06', look: 'male', skin: 'peach', hair: 'chestnut' },
  { id: 'm16', look: 'male', skin: 'porcelain', hair: 'golden' },
];
const skinIdx = (s: Skin) => SKINS.findIndex(x => x[0] === s);
/** The person for a choice: the exact one, or the closest skin tone (then hair) of the same look */
export function personFor(a: AvatarLook): Person3 {
  const same = PEOPLE.filter(p => p.look === a.look);
  return same.find(p => p.skin === a.skin && p.hair === a.hair)
    || [...same].sort((x, y) => (Math.abs(skinIdx(x.skin) - skinIdx(a.skin)) - Math.abs(skinIdx(y.skin) - skinIdx(a.skin))) || ((x.hair === a.hair ? 0 : 1) - (y.hair === a.hair ? 0 : 1)))[0];
}
export const modelUrl = (p: Person3): string => asset(`people/${p.id}.glb`);
export const faceUrl = (p: Person3): string => asset(`people/${p.id}.jpg`);
