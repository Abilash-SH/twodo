/* Twodo · the two characters' choices: a look (female or male), a skin tone and a hair colour. The outfit is always
   the person's own colour. Original designs, drawn for Twodo in a soft 3D style (big eyes, rounded shapes, light from
   the top left). Stored with the person in phase 2 (HANDOFF.md, "Data decisions"). */
import { mix } from '../color';

export const LOOKS = ['female', 'male'] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_NAMES: Record<Look, string> = { female: 'Female', male: 'Male' };

export const SKINS = {
  porcelain: '#F8DCCB',
  peach: '#F1C2A2',
  honey: '#DDA57F',
  caramel: '#C68558',
  cocoa: '#9A6243',
  ebony: '#6A4130',
} as const;
export type Skin = keyof typeof SKINS;
export const SKIN_NAMES: Record<Skin, string> = { porcelain: 'Porcelain', peach: 'Peach', honey: 'Honey', caramel: 'Caramel', cocoa: 'Cocoa', ebony: 'Ebony' };

export const HAIRS = {
  black: '#231A1C',
  espresso: '#3D2A22',
  chestnut: '#6E4431',
  auburn: '#94402E',
  golden: '#C99A55',
} as const;
export type Hair = keyof typeof HAIRS;
export const HAIR_NAMES: Record<Hair, string> = { black: 'Black', espresso: 'Espresso', chestnut: 'Chestnut', auburn: 'Auburn', golden: 'Golden' };

export interface AvatarLook { look: Look; skin: Skin; hair: Hair }
export const DEFAULT_LOOKS: Record<Look, AvatarLook> = {
  female: { look: 'female', skin: 'honey', hair: 'espresso' },
  male: { look: 'male', skin: 'caramel', hair: 'black' },
};

/** Fixed colours of the drawings that never carry meaning. */
export const PANTS = '#3B3552';
export const SHOE = '#FBFAFD';
export const SOLE = '#D9D3E2';
export const MOUTH = '#7A2E3A';
export const TONGUE = '#E86F82';
export const IRIS = '#4A2D1F';
export const LOVE_EYES = '#F0507A';
export const CLIP = '#FF7DA0';
export const SCLERA = '#FFFFFF';

/** Light, base and shade for a skin tone or a hair colour, for the soft 3D shading. */
export interface Shades { hi: string; base: string; lo: string }
export const skinShades = (s: Skin): Shades => ({ hi: mix(SKINS[s], 78, '#FFF4EC'), base: SKINS[s], lo: mix(SKINS[s], 82, '#5A2E24') });
export const hairShades = (h: Hair): Shades => ({ hi: mix(HAIRS[h], 72, '#FFFFFF'), base: HAIRS[h], lo: mix(HAIRS[h], 70, '#0E0A0C') });
