/* Twodo · one character (docs/architecture.md, section 5; design.md, "Characters").
   `state` is what it is for as long as it's true (idle, think, sleepy). `moment` plays one short reaction; change
   its `key` to play it again. Moments go through useMoments(), which keeps them rare. Only Views move (transform
   and opacity), on the UI thread; the drawing itself never re-renders during a motion. `still` draws one plain
   picture for long lists. Characters are decorative: the button they sit in carries the label. */
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { useTheme } from '../theme';
import { EASE, type ColorName } from '../tokens';
import { Hearts, Sparkles, ThinkBubble, Zs } from './extras';
import { MOMENT_MS, faceFor, type CharKind, type CharState, type Moment } from './moods';
import { Arm, Body, Feet, Shadow } from './parts';

export interface MomentKey { mood: Moment; key: number }

export interface CharacterProps {
  kind: CharKind;
  color: ColorName;
  size: number;
  state?: CharState;
  moment?: MomentKey | null;
  /** Turned towards the other person (faces left). */
  flip?: boolean;
  /** One still drawing, for lists. */
  still?: boolean;
}

interface Rig { ty: SharedValue<number>; sx: SharedValue<number>; sy: SharedValue<number>; armL: SharedValue<number>; armR: SharedValue<number>; ground: SharedValue<number> }
const out = Easing.bezier(...EASE.out);
const fall = Easing.bezier(0.55, 0.085, 0.68, 0.53); // ease-in: coming back down
const t = (to: number, duration: number, easing = out) => withTiming(to, { duration, easing });

function hop(r: Rig, size: number, delay = 0): void {
  r.ty.value = withDelay(delay, withSequence(t(-0.09 * size, 180), t(0, 170, fall)));
  r.sx.value = withDelay(delay, withSequence(t(1.03, 180), t(0.98, 170), t(1, 170)));
  r.sy.value = withDelay(delay, withSequence(t(0.97, 180), t(1.02, 170), t(1, 170)));
  r.ground.value = withDelay(delay, withSequence(t(0.82, 180), t(1, 170)));
}

/** The motion for each moment. Durations add up to MOMENT_MS. */
function play(mood: Moment, r: Rig, size: number): void {
  switch (mood) {
    case 'hop': hop(r, size); break;
    case 'wave':
      r.armR.value = withSequence(t(-120, 240), t(-90, 240), t(-120, 240), t(0, 380));
      break;
    case 'happy':
      r.sy.value = withSequence(t(0.93, 120), t(1.05, 160), t(1, 300));
      r.sx.value = withSequence(t(1.05, 120), t(0.97, 160), t(1, 300));
      break;
    case 'cheer':
      r.armR.value = withSequence(t(-150, 200), withDelay(800, t(0, 300)));
      r.armL.value = withSequence(t(150, 200), withDelay(800, t(0, 300)));
      hop(r, size, 150);
      hop(r, size, 650);
      break;
    case 'love':
      r.sx.value = withSequence(t(1.06, 150), t(1, 150), t(1.06, 150), t(1, 250));
      r.sy.value = withSequence(t(1.06, 150), t(1, 150), t(1.06, 150), t(1, 250));
      break;
  }
}

export function Character({ kind, color, size, state = 'idle', moment = null, flip = false, still = false }: CharacterProps) {
  const th = useTheme();
  const p = th.person(color);
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState<Moment | null>(null);
  const look = faceFor(kind, playing ?? state);

  const ty = useSharedValue(0), sx = useSharedValue(1), sy = useSharedValue(1);
  const armL = useSharedValue(0), armR = useSharedValue(0), ground = useSharedValue(1);

  const key = moment ? moment.key : 0, mood = moment ? moment.mood : null;
  useEffect(() => {
    if (!mood || reduce || still) return;
    setPlaying(mood);
    play(mood, { ty, sx, sy, armL, armR, ground }, size);
    const done = setTimeout(() => setPlaying(null), MOMENT_MS[mood]);
    return () => clearTimeout(done);
  }, [key, mood, reduce, still, size, ty, sx, sy, armL, armR, ground]);

  const fig = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }, { scaleX: sx.value }, { scaleY: sy.value }] }));
  const left = useAnimatedStyle(() => ({ transform: [{ rotate: `${armL.value}deg` }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ rotate: `${armR.value}deg` }] }));
  const shadow = useAnimatedStyle(() => ({ transform: [{ scaleX: ground.value }] }));

  const box = { width: size, height: size };
  const layer = (children: ReactNode) => <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>{children}</Svg>;

  if (still) {
    return (
      <View style={[box, flip && styles.flip]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Shadow /><Feet p={p} /><Arm side="left" p={p} /><Arm side="right" p={p} /><Body kind={kind} p={p} look={look} />
        </Svg>
      </View>
    );
  }

  return (
    <View style={box} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[StyleSheet.absoluteFill, flip && styles.flip]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.groundOrigin, shadow]}>{layer(<Shadow />)}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.figOrigin, fig]}>
          {layer(<Feet p={p} />)}
          <Animated.View style={[StyleSheet.absoluteFill, styles.leftOrigin, left]}>{layer(<Arm side="left" p={p} />)}</Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.rightOrigin, right]}>{layer(<Arm side="right" p={p} />)}</Animated.View>
          {layer(<Body kind={kind} p={p} look={look} />)}
        </Animated.View>
      </View>
      {playing === 'love' ? <Hearts size={size} color={color} /> : null}
      {playing === 'cheer' ? <Sparkles size={size} /> : null}
      {state === 'think' ? <ThinkBubble size={size} flip={flip} reduce={reduce} /> : null}
      {state === 'sleepy' ? <Zs size={size} flip={flip} reduce={reduce} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flip: { transform: [{ scaleX: -1 }] },
  figOrigin: { transformOrigin: '50% 96%' },
  groundOrigin: { transformOrigin: '50% 98%' },
  leftOrigin: { transformOrigin: '16% 64%' },
  rightOrigin: { transformOrigin: '84% 64%' },
});
