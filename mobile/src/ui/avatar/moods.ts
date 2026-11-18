/* Twodo · what the characters feel (docs/architecture.md, section 5).
   A state lasts as long as it is true (your partner is typing: think; away a long time: sleepy).
   A moment is a short reaction to something that happened (a tick, a post, a heart). Moments are earned and rare:
   one at a time, at most one per character every COOLDOWN_MS, and none with Reduce Motion. Pure: no React here. */

export const STATES = ['idle', 'think', 'sleepy'] as const;
export type CharState = (typeof STATES)[number];
export const MOMENTS = ['happy', 'wave', 'hop', 'cheer', 'love'] as const;
export type Moment = (typeof MOMENTS)[number];
export type Mood = CharState | Moment;

/** How long each moment plays. Reactions stay under 1.3 s, celebrations under 1.5 s (design.md, motion). */
export const MOMENT_MS: Record<Moment, number> = { happy: 700, wave: 1200, hop: 520, cheer: 1300, love: 1300 };
export const COOLDOWN_MS = 2500;

export const MOOD_NAMES: Record<Mood, string> = {
  idle: 'Idle', think: 'Thinking', sleepy: 'Sleepy', happy: 'Happy', wave: 'Wave', hop: 'Hop', cheer: 'Cheer', love: 'Love',
};

/** Decides whether a moment may play now. `force` is for a direct request (the Playground), never for app events. */
export interface MomentGate { allow(now: number, reduceMotion: boolean, force?: boolean): boolean }
export function createMomentGate(cooldownMs = COOLDOWN_MS): MomentGate {
  let last = Number.NEGATIVE_INFINITY;
  return {
    allow(now, reduceMotion, force = false) {
      if (reduceMotion) return false;
      if (!force && now - last < cooldownMs) return false;
      last = now;
      return true;
    },
  };
}

/** The face for a mood. */
export interface Expression {
  eyes: 'open' | 'happy' | 'closed' | 'heart' | 'up';
  mouth: 'smile' | 'big' | 'o';
  blush: 'soft' | 'strong';
  brow: 'calm' | 'raised';
}
export function expressionFor(mood: Mood): Expression {
  switch (mood) {
    case 'happy': case 'cheer': return { eyes: 'happy', mouth: 'big', blush: 'soft', brow: 'calm' };
    case 'love': return { eyes: 'heart', mouth: 'big', blush: 'strong', brow: 'calm' };
    case 'sleepy': return { eyes: 'closed', mouth: 'o', blush: 'soft', brow: 'calm' };
    case 'think': return { eyes: 'up', mouth: 'o', blush: 'soft', brow: 'raised' };
    default: return { eyes: 'open', mouth: 'smile', blush: 'soft', brow: 'calm' };
  }
}

/** How far the head leans for a state, in degrees (the figure faces right; turned figures mirror it). */
export const STATE_TILT: Record<CharState, number> = { idle: 0, think: -6, sleepy: 8 };
