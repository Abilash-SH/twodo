/* Twodo · what floats around a character: hearts (love), sparkles (cheer), a thought bubble (think), z's (sleepy).
   Only transform and opacity animate. With Reduce Motion they are shown still (states) or not at all (moments). */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { HEART, SPARKLE } from '../shapes';
import { Txt } from '../Text';
import { useTheme } from '../theme';
import { SPARK, WHITE, type ColorName } from '../tokens';

/** Something that drifts up and fades: once (a moment) or again and again (a state). */
function Drift({ x, y, w, delay, rise, loop, reduce, children }: {
  x: number; y: number; w: number; delay: number; rise: number; loop: boolean; reduce: boolean; children: ReactNode;
}) {
  const p = useSharedValue(reduce ? 0.35 : 0);
  useEffect(() => {
    if (reduce) return;
    const once = withTiming(1, { duration: loop ? 1600 : 1000, easing: Easing.out(Easing.quad) });
    p.value = withDelay(delay, loop ? withRepeat(withSequence(withTiming(0, { duration: 0 }), once), -1, false) : once);
    return () => cancelAnimation(p);
  }, [reduce, loop, delay, p]);
  const style = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : p.value < 0.2 ? p.value * 5 : 1 - (p.value - 0.2) / 0.8,
    transform: [{ translateY: -rise * p.value }, { scale: 0.6 + 0.4 * Math.min(1, p.value * 2) }],
  }));
  return <Animated.View style={[styles.abs, { left: x, top: y, width: w, height: w }, style]}>{children}</Animated.View>;
}

/** Pops in, turns a little, and goes. */
function Pop({ x, y, w, delay, children }: { x: number; y: number; w: number; delay: number; children: ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withSequence(withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }), withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) })));
    return () => cancelAnimation(p);
  }, [delay, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: p.value * 1.2 }, { rotate: `${p.value * 45}deg` }] }));
  return <Animated.View style={[styles.abs, { left: x, top: y, width: w, height: w }, style]}>{children}</Animated.View>;
}

export function Hearts({ size, color }: { size: number; color: ColorName }) {
  const t = useTheme(), w = Math.max(12, size * 0.18);
  return (<>
    {[-0.2, 0.02, 0.22].map((dx, i) => (
      <Drift key={i} x={size * (0.5 + dx) - w / 2} y={size * 0.08} w={w} delay={i * 170} rise={size * 0.36} loop={false} reduce={false}>
        <Svg width={w} height={w} viewBox="-40 -40 80 80"><Path d={HEART} fill={t.color(color)} stroke={WHITE} strokeWidth={6} strokeLinejoin="round" /></Svg>
      </Drift>
    ))}
  </>);
}

export function Sparkles({ size }: { size: number }) {
  const w = Math.max(12, size * 0.16);
  return (<>
    {[[0.06, 0.12], [0.84, 0.04], [0.46, -0.1]].map(([x, y], i) => (
      <Pop key={i} x={size * x} y={size * y} w={w} delay={i * 140}>
        <Svg width={w} height={w} viewBox="-10 -10 20 20"><Path d={SPARKLE} fill={SPARK} /></Svg>
      </Pop>
    ))}
  </>);
}

export function Zs({ size, flip, reduce }: { size: number; flip: boolean; reduce: boolean }) {
  const w = Math.max(14, size * 0.2), x = flip ? size * 0.06 : size * 0.74;
  return (<>
    {[0, 1].map(i => (
      <Drift key={i} x={x + (flip ? -i : i) * w * 0.4} y={size * 0.1 - i * w * 0.5} w={w} delay={i * 800} rise={size * 0.22} loop reduce={reduce}>
        <Txt variant={i ? 'headline' : 'callout'} tone="soft" allowFontScaling={false} align="center">z</Txt>
      </Drift>
    ))}
  </>);
}

function Dot({ i, reduce }: { i: number; reduce: boolean }) {
  const t = useTheme(), p = useSharedValue(reduce ? 1 : 0.3);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(i * 160, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 320 })), -1, false));
    return () => cancelAnimation(p);
  }, [i, reduce, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: t.n.soft }, style]} />;
}

/** "Thinking…": a small bubble with three dots, for when your partner is typing. */
export function ThinkBubble({ size, flip, reduce }: { size: number; flip: boolean; reduce: boolean }) {
  const t = useTheme(), w = Math.max(34, size * 0.42), h = w * 0.52;
  const left = flip ? size * 0.3 - w : size * 0.7;
  return (
    <View style={[styles.abs, { left, top: -h * 0.55, width: w, height: h }]} pointerEvents="none">
      <View style={[styles.bubble, { backgroundColor: t.n.raised, boxShadow: t.shadow[2], borderRadius: h / 2 }]}>
        {[0, 1, 2].map(i => <Dot key={i} i={i} reduce={reduce} />)}
      </View>
      <View style={[styles.trail, { backgroundColor: t.n.raised, left: flip ? w - 12 : 4, boxShadow: t.shadow[1] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  bubble: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  trail: { position: 'absolute', bottom: -7, width: 8, height: 8, borderRadius: 4 },
});
