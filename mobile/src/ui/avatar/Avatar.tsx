/* Twodo · one character (docs/architecture.md, section 5; design.md, "Characters").
   `avatar` is the look, skin and hair; `color` is the person's colour, worn as the hoodie.
   `state` is what it is for as long as it's true (idle, think, sleepy). `moment` plays one short reaction; change
   its `key` to play it again (ask through useMoments(), which keeps moments rare). Only Views move (transform and
   opacity) on the UI thread; the drawing re-renders only when the face changes. `still` draws one plain picture for
   lists. Characters are decorative: the button they sit in carries the label. `size` is the height in points. */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { useTheme } from '../theme';
import { EASE, type ColorName } from '../tokens';
import { Hearts, Sparkles, ThinkBubble, Zs } from './extras';
import type { AvatarLook } from './looks';
import { MOMENT_MS, STATE_TILT, expressionFor, type CharState, type Moment } from './moods';
import { Arm, BackHair, Grads, Ground, Head, Legs, Torso, makePaint } from './parts';

export interface MomentKey { mood: Moment; key: number }

export interface AvatarProps {
  avatar: AvatarLook;
  color: ColorName;
  size: number;
  state?: CharState;
  moment?: MomentKey | null;
  /** Turned towards the other person (faces left). */
  flip?: boolean;
  /** One still drawing, for lists. */
  still?: boolean;
}

export const AVATAR_RATIO = 100 / 120; // width / height

interface Rig {
  ty: SharedValue<number>; sx: SharedValue<number>; sy: SharedValue<number>; head: SharedValue<number>;
  armL: SharedValue<number>; armR: SharedValue<number>; ground: SharedValue<number>;
}
const out = Easing.bezier(...EASE.out);
const fall = Easing.bezier(0.55, 0.085, 0.68, 0.53);
const t = (to: number, duration: number, easing = out) => withTiming(to, { duration, easing });

function hop(r: Rig, size: number, delay = 0): void {
  r.ty.value = withDelay(delay, withSequence(t(-0.07 * size, 180), t(0, 170, fall)));
  r.sx.value = withDelay(delay, withSequence(t(1.03, 180), t(0.98, 170), t(1, 170)));
  r.sy.value = withDelay(delay, withSequence(t(0.97, 180), t(1.02, 170), t(1, 170)));
  r.ground.value = withDelay(delay, withSequence(t(0.8, 180), t(1, 170)));
}

/** The motion for each moment; each adds up to MOMENT_MS. `rest` is the head's lean for the current state. */
function play(mood: Moment, r: Rig, size: number, rest: number): void {
  switch (mood) {
    case 'hop': hop(r, size); break;
    case 'wave':
      r.armR.value = withSequence(t(-145, 260), t(-118, 200), t(-145, 200), t(-118, 200), t(0, 340));
      r.head.value = withSequence(t(-5, 260), withDelay(600, t(rest, 340)));
      break;
    case 'happy':
      r.head.value = withSequence(t(6, 160), t(-3, 200), t(rest, 340));
      r.sy.value = withSequence(t(0.95, 120), t(1.04, 160), t(1, 300));
      r.sx.value = withSequence(t(1.04, 120), t(0.98, 160), t(1, 300));
      break;
    case 'cheer':
      r.armR.value = withSequence(t(-150, 200), withDelay(800, t(0, 300)));
      r.armL.value = withSequence(t(150, 200), withDelay(800, t(0, 300)));
      hop(r, size, 150);
      hop(r, size, 650);
      break;
    case 'love':
      r.head.value = withSequence(t(5, 220), withDelay(780, t(rest, 300)));
      r.sx.value = withSequence(t(1.05, 150), t(1, 150), t(1.05, 150), t(1, 250));
      r.sy.value = withSequence(t(1.05, 150), t(1, 150), t(1.05, 150), t(1, 250));
      break;
  }
}

export function Avatar({ avatar, color, size, state = 'idle', moment = null, flip = false, still = false }: AvatarProps) {
  const th = useTheme();
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const paint = useMemo(() => makePaint(`a${uid}`, avatar, th.person(color)), [uid, avatar, th, color]);
  const [playing, setPlaying] = useState<Moment | null>(null);
  const face = expressionFor(playing ?? state);
  const width = size * AVATAR_RATIO;

  const ty = useSharedValue(0), sx = useSharedValue(1), sy = useSharedValue(1), head = useSharedValue(0);
  const armL = useSharedValue(0), armR = useSharedValue(0), ground = useSharedValue(1);
  const rest = STATE_TILT[state];

  useEffect(() => {
    head.value = reduce || still ? 0 : withTiming(rest, { duration: 420, easing: out });
  }, [rest, reduce, still, head]);

  const key = moment ? moment.key : 0, mood = moment ? moment.mood : null;
  useEffect(() => {
    if (!mood || reduce || still) return;
    setPlaying(mood);
    play(mood, { ty, sx, sy, head, armL, armR, ground }, size, rest);
    const done = setTimeout(() => setPlaying(null), MOMENT_MS[mood]);
    return () => clearTimeout(done);
    // `rest` is read when the moment starts; a state change mid-moment settles through the effect above.
  }, [key, mood, reduce, still, size, ty, sx, sy, head, armL, armR, ground]);

  const fig = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }, { scaleX: sx.value }, { scaleY: sy.value }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${head.value}deg` }] }));
  const left = useAnimatedStyle(() => ({ transform: [{ rotate: `${armL.value}deg` }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ rotate: `${armR.value}deg` }] }));
  const groundStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: ground.value }] }));

  const layer = (use: Parameters<typeof Grads>[0]['use'], children: ReactNode) => (
    <Svg width={width} height={size} viewBox="0 0 100 120" style={StyleSheet.absoluteFill}>
      <Grads p={paint} use={use} />
      {children}
    </Svg>
  );
  const box = { width, height: size };
  const hidden = { pointerEvents: 'none' as const, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  if (still) {
    return (
      <View style={[box, flip && styles.flip]} {...hidden}>
        <Svg width={width} height={size} viewBox="0 0 100 120">
          <Grads p={paint} use={['skin', 'hair', 'outfit', 'pants', 'ground', 'blush', 'iris']} />
          <Ground p={paint} /><BackHair p={paint} /><Legs p={paint} /><Torso p={paint} />
          <Head p={paint} e={face} /><Arm p={paint} side="left" /><Arm p={paint} side="right" />
        </Svg>
      </View>
    );
  }

  return (
    <View style={box} {...hidden}>
      <View style={[StyleSheet.absoluteFill, flip && styles.flip]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.groundOrigin, groundStyle]}>{layer(['ground'], <Ground p={paint} />)}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.figOrigin, fig]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.headOrigin, headStyle]}>{layer(['hair'], <BackHair p={paint} />)}</Animated.View>
          {layer(['pants', 'outfit'], <Legs p={paint} />)}
          {layer(['outfit'], <Torso p={paint} />)}
          <Animated.View style={[StyleSheet.absoluteFill, styles.headOrigin, headStyle]}>
            {layer(['skin', 'hair', 'blush', 'iris'], <Head p={paint} e={face} />)}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.leftOrigin, left]}>{layer(['skin'], <Arm p={paint} side="left" />)}</Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.rightOrigin, right]}>{layer(['skin'], <Arm p={paint} side="right" />)}</Animated.View>
        </Animated.View>
      </View>
      {playing === 'love' ? <Hearts width={width} height={size} color={color} /> : null}
      {playing === 'cheer' ? <Sparkles width={width} height={size} /> : null}
      {state === 'think' ? <ThinkBubble width={width} height={size} flip={flip} reduce={reduce} /> : null}
      {state === 'sleepy' ? <Zs width={width} height={size} flip={flip} reduce={reduce} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flip: { transform: [{ scaleX: -1 }] },
  figOrigin: { transformOrigin: '50% 95%' },
  groundOrigin: { transformOrigin: '50% 96%' },
  headOrigin: { transformOrigin: '50% 52%' },
  leftOrigin: { transformOrigin: '35.5% 52.5%' },
  rightOrigin: { transformOrigin: '64.5% 52.5%' },
});
