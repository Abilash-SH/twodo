/* Twodo · what the characters feel (docs/architecture.md, section 5).
   A state lasts as long as it is true (your partner is typing: think; away a long time: sleepy).
   A moment is a short reaction to something that happened (a tick, a post, a heart). Moments are earned and rare:
   one at a time, at most one per character every COOLDOWN_MS, and none with Reduce Motion. Pure: no React here. */

export const CHAR_KINDS = ['bun', 'sprout', 'pebble', 'puff', 'bolt', 'drop'] as const;
export type CharKind = (typeof CHAR_KINDS)[number];
export const CHAR_NAMES: Record<CharKind, string> = { bun: 'Bun', sprout: 'Sprout', pebble: 'Pebble', puff: 'Puff', bolt: 'Bolt', drop: 'Drop' };

export const STATES = ['idle', 'think', 'sleepy'] as const;
export type CharState = (typeof STATES)[number];
export const MOMENTS = ['happy', 'wave', 'hop', 'cheer', 'love'] as const;
export type Moment = (typeof MOMENTS)[number];
export type Mood = CharState | Moment;

/** How long each moment plays. Reactions stay under 1.2 s, celebrations under 1.5 s (design.md, motion). */
export const MOMENT_MS: Record<Moment, number> = { happy: 700, wave: 1100, hop: 520, cheer: 1300, love: 1300 };
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

/** What the face looks like for a mood, given the character's own resting face. */
export type Eyes = 'open' | 'closed' | 'wink' | 'happy' | 'up';
export type Mouth = 'smile' | 'big' | 'o' | 'flat';
export interface FaceLook { eyes: Eyes; mouth: Mouth; blush: 'soft' | 'strong' }
export const RESTING_EYES: Record<CharKind, Eyes> = { bun: 'open', sprout: 'open', pebble: 'closed', puff: 'open', bolt: 'open', drop: 'wink' };

export function faceFor(kind: CharKind, mood: Mood): FaceLook {
  switch (mood) {
    case 'happy': case 'cheer': return { eyes: 'happy', mouth: 'big', blush: 'soft' };
    case 'love': return { eyes: 'happy', mouth: 'big', blush: 'strong' };
    case 'sleepy': return { eyes: 'closed', mouth: 'o', blush: 'soft' };
    case 'think': return { eyes: 'up', mouth: 'flat', blush: 'soft' };
    default: return { eyes: RESTING_EYES[kind], mouth: 'smile', blush: 'soft' };
  }
}
