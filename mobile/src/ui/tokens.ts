/* Twodo · design tokens. The only place colours, type, space, corners, shadows and motion are defined
   (design.md, "The app"). Screens use them through the components and useTheme(); a test rejects colour values
   anywhere outside src/ui. Values follow the web app so both look like the same Twodo. */
import { Platform, type TextStyle } from 'react-native';
import { mix } from './color';

export const PALETTE = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'mint', 'teal', 'brown', 'gray'] as const;
export type ColorName = (typeof PALETTE)[number];
export type Scheme = 'light' | 'dark';

/** The twelve colours a person can pick: dusty pastels, a lighter set for dark mode. */
export const COLORS: Record<ColorName, Record<Scheme, string>> = {
  blue: { light: '#7592DB', dark: '#93AEEC' },
  indigo: { light: '#8582D6', dark: '#A19EEA' },
  purple: { light: '#A883D3', dark: '#C0A0E6' },
  pink: { light: '#DB82A8', dark: '#EC9DBE' },
  red: { light: '#DD7878', dark: '#EC9090' },
  orange: { light: '#DB9462', dark: '#EBAC7C' },
  yellow: { light: '#CDAC52', dark: '#E0C377' },
  green: { light: '#66B88A', dark: '#85CFA4' },
  mint: { light: '#5CC2B2', dark: '#7DD5C6' },
  teal: { light: '#5FB1BC', dark: '#7FC9D3' },
  brown: { light: '#AC8F78', dark: '#C0A48D' },
  gray: { light: '#9494A2', dark: '#A6A6B2' },
};
export const COLOR_NAMES: Record<ColorName, string> = {
  blue: 'Blue', indigo: 'Indigo', purple: 'Purple', pink: 'Pink', red: 'Red', orange: 'Orange',
  yellow: 'Yellow', green: 'Green', mint: 'Mint', teal: 'Teal', brown: 'Brown', gray: 'Gray',
};

/** Ink: text and icons on a person's colour (at least 4.5:1 on all twelve), and the characters' eyes. */
export const INK = '#1B1730';
export const WHITE = '#FFFFFF';
/** Small accents that never carry meaning: the spark between the hearts, blush on the characters' cheeks. */
export const SPARK = '#FFC857';
export const BLUSH = '#FF8FA8';
export const LEAF = { dark: '#6DBB7B', light: '#82CC8E' } as const;

/** The launch background; app.json uses the same values for the still splash (a test checks it). */
export const LAUNCH_BG: Record<Scheme, string> = { light: '#FBF8FC', dark: '#141019' };
export const LAUNCH_INK: Record<Scheme, string> = { light: INK, dark: '#F3EEF8' };

export interface Neutrals {
  bg: string;      // the page
  raised: string;  // cards, rows on cards, the writing box
  sunken: string;  // inputs, pressed states
  sheet: string;   // sheets and menus
  label: string;   // body text and titles
  soft: string;    // secondary text: sub-titles, times, notes (at least 4.5:1)
  faint: string;   // placeholders and disabled icons only, never information
  line: string;    // hairlines (prefer space)
  fill: string;    // quiet buttons, chips
  fill2: string;   // pressed quiet buttons
  scrim: string;   // behind sheets and dialogs
  danger: string;  // delete and errors, readable as text
}
function neutrals(s: Scheme): Neutrals {
  const dark = s === 'dark';
  const bg = dark ? '#0D0C10' : '#FAF8FB', raised = dark ? '#1A191F' : '#FFFFFF', label = dark ? '#FFFFFF' : '#000000';
  return {
    bg, raised, label,
    sunken: dark ? '#232229' : '#F3F0F5',
    sheet: dark ? '#17161B' : '#FFFFFF',
    soft: mix(label, 64, raised),
    faint: mix(label, 38, raised),
    line: dark ? mix('#545458', 65, bg) : mix('#3C3C43', 18, bg),
    fill: dark ? mix('#787880', 24, bg) : mix('#73648C', 10, bg),
    fill2: dark ? mix('#787880', 36, bg) : mix('#73648C', 18, bg),
    scrim: dark ? 'rgba(0,0,0,0.55)' : 'rgba(27,23,48,0.32)',
    danger: mix(COLORS.red[s], 70, label),
  };
}
export const NEUTRALS: Record<Scheme, Neutrals> = { light: neutrals('light'), dark: neutrals('dark') };

/** Everything a screen needs from one person's colour. */
export interface PersonColors {
  base: string;  // the colour itself: bubbles, primary buttons, the character's body
  tint: string;  // a soft background: chips, a character's tile
  ink: string;   // text in this colour (names), readable on the page
  on: string;    // text and icons on top of `base`
  light: string; // a character's face or tummy
  dark: string;  // a character's feet and outlines
}
export function personColors(name: ColorName, s: Scheme): PersonColors {
  const base = COLORS[name][s], n = NEUTRALS[s];
  return {
    base,
    tint: mix(base, s === 'dark' ? 26 : 18, n.raised),
    ink: mix(base, 45, n.label),
    on: INK,
    light: mix(base, 30, WHITE),
    dark: mix(base, 78, INK),
  };
}

/* ---------- Type: the system font for reading, the iPhone's own rounded face for titles and big moments ---------- */
const ROUNDED = Platform.select({ ios: 'ui-rounded', web: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif', default: undefined });
const t = (s: TextStyle): TextStyle => s;
export const TYPE = {
  largeTitle: t({ fontFamily: ROUNDED, fontSize: 34, lineHeight: 41, fontWeight: '800' }),
  title: t({ fontFamily: ROUNDED, fontSize: 22, lineHeight: 28, fontWeight: '700' }),
  headline: t({ fontFamily: ROUNDED, fontSize: 17, lineHeight: 22, fontWeight: '700' }),
  body: t({ fontSize: 17, lineHeight: 22, fontWeight: '400' }),
  callout: t({ fontSize: 15, lineHeight: 20, fontWeight: '500' }),
  footnote: t({ fontSize: 13, lineHeight: 18, fontWeight: '400' }),
  caption: t({ fontSize: 12, lineHeight: 16, fontWeight: '600' }),
} as const;
export type TypeVariant = keyof typeof TYPE;
/** How far Dynamic Type may grow each style before layouts would break. */
export const MAX_SCALE: Record<TypeVariant, number> = { largeTitle: 1.3, title: 1.5, headline: 1.7, body: 1.8, callout: 1.8, footnote: 1.6, caption: 1.5 };

/* ---------- Space, corners, shadows ---------- */
export const SPACE = { xxs: 4, xs: 8, s: 12, m: 16, l: 20, xl: 24, xxl: 32 } as const;
export const RADIUS = { s: 12, m: 16, l: 20, xl: 28, pill: 999 } as const;
/** Three surface levels: 0 the page (no shadow), 1 resting on it, 2 floating above it. */
export const SHADOW: Record<Scheme, { 1: string; 2: string }> = {
  light: { 1: '0px 1px 2px rgba(40,20,60,0.04), 0px 10px 26px -12px rgba(40,20,60,0.16)', 2: '0px 18px 40px -16px rgba(40,20,60,0.30)' },
  dark: { 1: '0px 0px 0px 0.5px rgba(255,255,255,0.06)', 2: '0px 18px 40px -16px rgba(0,0,0,0.65)' },
};
export const HIT = 44; // the smallest thing you can tap, in points

/* ---------- Motion ---------- */
export const DURATION = { quick: 160, standard: 280, page: 420, sheet: 520 } as const;
/** Cubic-bezier control points (same curves as the web app). */
export const EASE = {
  out: [0.2, 0.8, 0.2, 1],
  ios: [0.32, 0.72, 0, 1],
  bounce: [0.34, 1.56, 0.64, 1],
  pop: [0.34, 1.4, 0.64, 1],
} as const;
export const SPRING = {
  gentle: { damping: 18, stiffness: 180, mass: 1 },
  bouncy: { damping: 9, stiffness: 240, mass: 0.9 },
  snappy: { damping: 24, stiffness: 420, mass: 1 },
} as const;
