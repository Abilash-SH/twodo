/* Twodo · haptics: one named tap for each kind of moment, so every screen feels the same.
   Haptics never block anything and never fail loudly (some devices have none). */
import * as Haptics from 'expo-haptics';

const quiet = (p: Promise<void>): void => { p.catch(() => {}); };

export const haptic = {
  /** a to-do ticked, a chip chosen */
  tick: (): void => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** a heart given */
  heart: (): void => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** the day is done, something big worked */
  done: (): void => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** before a delete */
  warn: (): void => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** a press on a button */
  press: (): void => quiet(Haptics.selectionAsync()),
};
