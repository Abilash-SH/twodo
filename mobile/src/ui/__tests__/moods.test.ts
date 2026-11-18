/* Characters' moods: moments are rare, short, and off with Reduce Motion; faces follow the mood. */
import { COOLDOWN_MS, MOMENTS, MOMENT_MS, STATES, STATE_TILT, createMomentGate, expressionFor } from '../avatar/moods';

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

test('reactions stay under 1.3 s and celebrations under 1.5 s; the cooldown outlasts the longest', () => {
  for (const m of MOMENTS) expect(MOMENT_MS[m]).toBeLessThanOrEqual(m === 'cheer' || m === 'love' ? 1500 : 1300);
  expect(COOLDOWN_MS).toBeGreaterThan(Math.max(...MOMENTS.map(m => MOMENT_MS[m])));
});

test('faces follow the mood', () => {
  expect(expressionFor('idle')).toEqual({ eyes: 'open', mouth: 'smile', blush: 'soft', brow: 'calm' });
  expect(expressionFor('wave').eyes).toBe('open');
  expect(expressionFor('happy').eyes).toBe('happy');
  expect(expressionFor('cheer').mouth).toBe('big');
  expect(expressionFor('love')).toEqual({ eyes: 'heart', mouth: 'big', blush: 'strong', brow: 'calm' });
  expect(expressionFor('sleepy').eyes).toBe('closed');
  expect(expressionFor('think')).toEqual({ eyes: 'up', mouth: 'o', blush: 'soft', brow: 'raised' });
});

test('the head leans a little for a state, never far', () => {
  for (const s of STATES) expect(Math.abs(STATE_TILT[s])).toBeLessThanOrEqual(10);
  expect(STATE_TILT.idle).toBe(0);
});
