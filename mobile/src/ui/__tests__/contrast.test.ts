/* Text stays readable (WCAG 4.5:1) for every colour a person can pick, in light and dark (design.md, "Contrast"). */
import { contrast } from '../color';
import { LAUNCH_BG, LAUNCH_INK, NEUTRALS, PALETTE, personColors, type Scheme } from '../tokens';

const SCHEMES: Scheme[] = ['light', 'dark'];
const AA = 4.5;

describe.each(SCHEMES)('%s', s => {
  const n = NEUTRALS[s];

  test('body, secondary and danger text on the page, cards and sheets', () => {
    for (const bg of [n.bg, n.raised, n.sheet]) {
      expect(contrast(n.label, bg)).toBeGreaterThanOrEqual(AA);
      expect(contrast(n.soft, bg)).toBeGreaterThanOrEqual(AA);
      expect(contrast(n.danger, bg)).toBeGreaterThanOrEqual(AA);
    }
  });

  test('text on quiet buttons and chips', () => {
    expect(contrast(n.label, n.fill)).toBeGreaterThanOrEqual(AA);
    expect(contrast(n.danger, n.fill)).toBeGreaterThanOrEqual(AA);
  });

  test.each(PALETTE)('%s: ink on the colour, the colour as text, text on its tint', name => {
    const p = personColors(name, s);
    expect(contrast(p.on, p.base)).toBeGreaterThanOrEqual(AA); // primary buttons, chosen chips, badges
    for (const bg of [n.bg, n.raised, n.fill]) expect(contrast(p.ink, bg)).toBeGreaterThanOrEqual(AA); // names, quiet buttons
    expect(contrast(n.label, p.tint)).toBeGreaterThanOrEqual(AA); // a chosen tile
  });

  test('the launch caption', () => {
    expect(contrast(LAUNCH_INK[s], LAUNCH_BG[s])).toBeGreaterThanOrEqual(AA);
  });
});
