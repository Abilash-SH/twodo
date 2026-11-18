/* Text stays readable (WCAG 4.5:1) for every colour a person can pick, in light and dark (design.md, "Contrast"). */
import { contrast } from '../color';
import { BADGE, INK, LAUNCH_BG, LAUNCH_INK, LOVE, NEUTRALS, PALETTE, PILL, cardGradient, loveTint, personColors, type Scheme } from '../tokens';

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

  test.each(PALETTE)('%s: ink text on cards washed from this colour into every other', a => {
    for (const b of PALETTE) for (const end of cardGradient(a, b, s)) expect(contrast(INK, end)).toBeGreaterThanOrEqual(AA);
  });

  test('badges, and the tab bar icons (3:1 for icons)', () => {
    expect(contrast(BADGE.text, BADGE.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(PILL[s].icon, PILL[s].bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(PILL[s].activeIcon, PILL[s].activeBg)).toBeGreaterThanOrEqual(3);
  });

  test('a given heart stands out on cards and on its own circle (3:1 for icons)', () => {
    for (const bg of [n.raised, n.sheet, loveTint(s)]) expect(contrast(LOVE[s], bg)).toBeGreaterThanOrEqual(3);
  });

  test('the journal: the chosen day, days to come, and soft text on the writing box', () => {
    expect(contrast(n.bg, n.label)).toBeGreaterThanOrEqual(AA); // the chosen day is inverted
    expect(contrast(n.label, n.sunken)).toBeGreaterThanOrEqual(AA); // your words in the box
    expect(contrast(n.soft, n.sunken)).toBeGreaterThanOrEqual(AA);
  });

  test('the launch caption', () => {
    expect(contrast(LAUNCH_INK[s], LAUNCH_BG[s])).toBeGreaterThanOrEqual(AA);
  });
});
