/* Twodo · motion values for JavaScript animations. Mirrors the --dur-* / --ease-* tokens in styles/01-tokens.css. */
import { reducedMotion } from './util';

export const MS = { quick: 160, standard: 280, page: 420, sheet: 520, keyboard: 380 } as const;
export const EASE = {
  out: 'cubic-bezier(.2,.8,.2,1)',
  ios: 'cubic-bezier(.32,.72,0,1)',
  spring: 'cubic-bezier(.25,1.12,.4,1)',
  bounce: 'cubic-bezier(.34,1.56,.64,1)',
  keyboard: 'cubic-bezier(.22,.9,.28,1)',
} as const;
/** Reduce Motion on: animations become fades (or nothing) */
export const calm = (): boolean => reducedMotion.matches;
