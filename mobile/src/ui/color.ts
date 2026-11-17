/* Twodo · colour maths for the design system: mixing like CSS `color-mix(in srgb, …)` and WCAG contrast.
   Pure functions, used by the tokens and checked by the contrast tests. */

const clamp = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/** `mix(a, 30, b)` is CSS `color-mix(in srgb, a 30%, b)`. */
export function mix(a: string, percentOfA: number, b: string): string {
  const [r1, g1, b1] = parseHex(a), [r2, g2, b2] = parseHex(b), t = percentOfA / 100;
  return toHex(r1 * t + r2 * (1 - t), g1 * t + g2 * (1 - t), b1 * t + b2 * (1 - t));
}

/** A hex colour with transparency, for washes and glows. */
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** WCAG contrast ratio between two opaque colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}
