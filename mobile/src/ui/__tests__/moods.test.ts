/* Characters' moods: moments are rare, short, and off with Reduce Motion; faces follow the mood. */
import { CHAR_KINDS, COOLDOWN_MS, MOMENTS, MOMENT_MS, RESTING_EYES, createMomentGate, faceFor } from '../characters/moods';

describe('the moment gate', () => {
  test('one moment per cooldown', () => {
    const g = createMomentGate();
    expect(g.allow(1000, false)).toBe(true);
    expect(g.allow(1000 + COOLDOWN_MS - 1, false)).toBe(false);
    expect(g.allow(1000 + COOLDOWN_MS, false)).toBe(true);
  });
  test('never with Reduce Motion, even when asked directly', () => {
    const g = createMomentGate();
    expect(g.allow(0, true)).toBe(false);
    expect(g.allow(0, true, true)).toBe(false);
  });
  test('a direct request (the Playground) skips the cooldown', () => {
    const g = createMomentGate();
    expect(g.allow(0, false)).toBe(true);
    expect(g.allow(10, false, true)).toBe(true);
  });
});

test('reactions stay under 1.2 s and celebrations under 1.5 s; the cooldown outlasts the longest', () => {
  for (const m of MOMENTS) expect(MOMENT_MS[m]).toBeLessThanOrEqual(m === 'cheer' || m === 'love' ? 1500 : 1200);
  expect(COOLDOWN_MS).toBeGreaterThan(Math.max(...MOMENTS.map(m => MOMENT_MS[m])));
});

test('faces follow the mood, and each character keeps its own resting face', () => {
  for (const k of CHAR_KINDS) {
    expect(faceFor(k, 'idle').eyes).toBe(RESTING_EYES[k]);
    expect(faceFor(k, 'wave').eyes).toBe(RESTING_EYES[k]);
    expect(faceFor(k, 'sleepy').eyes).toBe('closed');
    expect(faceFor(k, 'happy')).toEqual({ eyes: 'happy', mouth: 'big', blush: 'soft' });
    expect(faceFor(k, 'love').blush).toBe('strong');
    expect(faceFor(k, 'think').eyes).toBe('up');
  }
  expect(RESTING_EYES.pebble).toBe('closed');
  expect(RESTING_EYES.drop).toBe('wink');
});
