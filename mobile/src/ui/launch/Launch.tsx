/* Twodo · the launch (design.md, "Launch"): two hearts, one in each of your colours, fly in from either side, meet
   with a small spark and one heartbeat, then "Two souls, one space."; then the hearts zoom through to the app.
   The same timing as the web app. It starts on the still splash's colour, so the hand-over is invisible.
   With Reduce Motion the hearts are simply there and the screen fades. A tap skips it. */
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { HEART, SPARKLE } from '../shapes';
import { Txt } from '../Text';
import { useTheme } from '../theme';
import { EASE, LAUNCH_BG, LAUNCH_INK, SPACE, SPARK, type ColorName } from '../tokens';

const W = 176, H = 110; // the mark, as on the web
export const LAUNCH_MS = { hold: 1500, exit: 700, reducedHold: 900, reducedExit: 280 } as const;

export function Launch({ a = 'blue', b = 'pink', onDone }: { a?: ColorName; b?: ColorName; onDone: () => void }) {
  const t = useTheme(), reduce = useReducedMotion();
  const bg = LAUNCH_BG[t.scheme], ink = LAUNCH_INK[t.scheme];
  const start = reduce ? 1 : 0;
  const pa = useSharedValue(start), pb = useSharedValue(start), cap = useSharedValue(start), wash = useSharedValue(start);
  const spark = useSharedValue(0), beat = useSharedValue(1), exit = useSharedValue(0);
  const left = useRef(false), timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const splashHidden = useRef(false);

  const leave = (): void => {
    if (left.current) return;
    left.current = true;
    exit.value = withTiming(1, { duration: reduce ? LAUNCH_MS.reducedExit : LAUNCH_MS.exit, easing: reduce ? Easing.linear : Easing.bezier(0.7, 0, 0.84, 0) });
    timers.current.push(setTimeout(onDone, (reduce ? LAUNCH_MS.reducedExit : LAUNCH_MS.exit) + 20));
  };

  useEffect(() => {
    if (!reduce) {
      const pop = Easing.bezier(...EASE.pop);
      wash.value = withTiming(1, { duration: 400 });
      pa.value = withDelay(40, withTiming(1, { duration: 800, easing: pop }));
      pb.value = withDelay(100, withTiming(1, { duration: 800, easing: pop }));
      spark.value = withDelay(620, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
      beat.value = withDelay(740, withSequence(withTiming(1.09, { duration: 147 }), withTiming(0.98, { duration: 105 }), withTiming(1, { duration: 168 })));
      cap.value = withDelay(500, withTiming(1, { duration: 700, easing: Easing.bezier(0.34, 1.3, 0.64, 1) }));
    }
    const all = timers.current;
    all.push(setTimeout(leave, reduce ? LAUNCH_MS.reducedHold : LAUNCH_MS.hold));
    return () => all.forEach(clearTimeout);
    // The launch plays once per mount; it never restarts on a re-render.
  }, []);

  const clamp = (v: number): number => { 'worklet'; return Math.min(1, Math.max(0, v)); };
  const heartA = useAnimatedStyle(() => ({
    opacity: clamp(pa.value),
    transform: [{ translateX: (1 - pa.value) * -70 }, { rotate: `${-34 + 24 * pa.value}deg` }, { scale: 0.5 + 0.5 * pa.value }],
  }));
  const heartB = useAnimatedStyle(() => ({
    opacity: clamp(pb.value),
    transform: [{ translateX: (1 - pb.value) * 70 }, { rotate: `${34 - 24 * pb.value}deg` }, { scale: 0.5 + 0.5 * pb.value }],
  }));
  const sparkStyle = useAnimatedStyle(() => {
    const p = spark.value, up = p < 0.4;
    return {
      opacity: up ? p / 0.4 : 1 - (p - 0.4) / 0.6,
      transform: [{ scale: up ? 0.2 + 1.2 * (p / 0.4) : 1.4 - 0.8 * ((p - 0.4) / 0.6) }, { rotate: `${90 * p}deg` }],
    };
  });
  const mark = useAnimatedStyle(() => ({
    opacity: exit.value < 0.4 ? 1 : 1 - (exit.value - 0.4) / 0.6,
    transform: [{ scale: beat.value * (reduce ? 1 : 1 + 7 * exit.value) }],
  }));
  const caption = useAnimatedStyle(() => ({
    opacity: clamp(cap.value) * clamp(1 - exit.value * 2),
    transform: [{ translateY: (1 - cap.value) * 14 + exit.value * 8 }],
  }));
  const screen = useAnimatedStyle(() => ({ opacity: 1 - clamp((exit.value - 0.3) / 0.7) }));
  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));

  const heart = (x: number, color: string) => (
    <Svg width={W} height={H} viewBox="0 0 160 100" style={StyleSheet.absoluteFill}>
      <G transform={`translate(${x} 52)`}><Path d={HEART} fill={color} stroke={bg} strokeWidth={4} strokeLinejoin="round" /></G>
    </Svg>
  );

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: bg }, screen]}
      onLayout={() => { if (!splashHidden.current) { splashHidden.current = true; SplashScreen.hideAsync().catch(() => {}); } }}
    >
      <Pressable style={styles.fill} onPress={leave} accessibilityRole="button" accessibilityLabel="Two souls, one space." accessibilityHint="Opens the app">
        <Animated.View style={[StyleSheet.absoluteFill, washStyle]} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="launchA" cx="25%" cy="30%" rx="70%" ry="45%">
                <Stop offset="0" stopColor={t.color(a)} stopOpacity={0.22} /><Stop offset="1" stopColor={t.color(a)} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="launchB" cx="78%" cy="68%" rx="70%" ry="45%">
                <Stop offset="0" stopColor={t.color(b)} stopOpacity={0.22} /><Stop offset="1" stopColor={t.color(b)} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#launchA)" />
            <Rect width="100%" height="100%" fill="url(#launchB)" />
          </Svg>
        </Animated.View>
        <View style={styles.center} pointerEvents="none">
          <Animated.View style={[styles.mark, mark]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.originA, heartA]}>{heart(60, t.color(a))}</Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.originB, heartB]}>{heart(100, t.color(b))}</Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.originSpark, sparkStyle]}>
              <Svg width={W} height={H} viewBox="0 0 160 100"><G transform="translate(80 22)"><Path d={SPARKLE} fill={SPARK} /></G></Svg>
            </Animated.View>
          </Animated.View>
          <Animated.View style={caption}>
            <Txt variant="title" style={[styles.caption, { color: ink }]}>Two souls, one space.</Txt>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: W, height: H },
  originA: { transformOrigin: '37.5% 56%' },
  originB: { transformOrigin: '62.5% 56%' },
  originSpark: { transformOrigin: '50% 22%' },
  caption: { marginTop: SPACE.l + 2, letterSpacing: 0.2 },
});
