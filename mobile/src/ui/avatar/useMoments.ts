/* Twodo · asking a character for a moment. The gate keeps reactions rare (one per character every few seconds)
   and off with Reduce Motion; `force` is only for direct requests in the Playground. */
import { useCallback, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import type { MomentKey } from './Avatar';
import { createMomentGate, type Moment } from './moods';

export function useMoments(): { moment: MomentKey | null; react: (mood: Moment, force?: boolean) => boolean } {
  const reduce = useReducedMotion();
  const gate = useRef(createMomentGate()).current;
  const [moment, setMoment] = useState<MomentKey | null>(null);
  const react = useCallback((mood: Moment, force = false): boolean => {
    if (!gate.allow(Date.now(), reduce, force)) return false;
    setMoment(m => ({ mood, key: (m ? m.key : 0) + 1 }));
    return true;
  }, [gate, reduce]);
  return { moment, react };
}
