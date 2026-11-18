/* Twodo · the components every screen is built from (docs/architecture.md, section 5). Colours, sizes and motion
   come only from the tokens and the theme. A press shows within a frame (scale on the UI thread), and a button's
   label, role and state are always there for VoiceOver. */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Avatar } from './avatar/Avatar';
import type { AvatarLook } from './avatar/looks';
import { Gradient } from './Gradient';
import { haptic } from './haptics';
import { Icon } from './icons';
import { CHEVRON } from './shapes';
import { Txt } from './Text';
import { useTheme } from './theme';
import { HIT, INK, RADIUS, SPACE, SPRING, type ColorName } from './tokens';

/* ---------- Screen ---------- */
export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme(), insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.n.bg }}
      contentContainerStyle={{ paddingTop: insets.top + SPACE.xs, paddingBottom: insets.bottom + SPACE.xxl, paddingHorizontal: SPACE.m }}
      contentInsetAdjustmentBehavior="never"
    >
      {children}
    </ScrollView>
  );
}

export function LargeTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.titleBox}>
      <Txt variant="largeTitle" accessibilityRole="header">{title}</Txt>
      {sub ? <Txt variant="callout" tone="soft" style={styles.titleSub}>{sub}</Txt> : null}
    </View>
  );
}

/** Back to the screen underneath ("Home"), for screens pushed on top of the tabs. */
export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.press(); onPress(); }} hitSlop={8}
      accessibilityRole="button" accessibilityLabel={`Back to ${label}`}
      style={({ pressed }) => [styles.back, { backgroundColor: pressed ? t.n.fill2 : t.n.fill }]}
    >
      <Icon name="left" size={18} color={t.n.label} width={2.4} />
      <Txt variant="callout" style={{ fontWeight: '600' }}>{label}</Txt>
    </Pressable>
  );
}

export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="title" accessibilityRole="header">{title}</Txt>
      {sub ? <Txt variant="footnote" tone="soft" style={styles.sectionSub}>{sub}</Txt> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.n.raised, boxShadow: t.shadow[1] }, style]}>{children}</View>;
}

/* ---------- Presses ---------- */
function usePress(scaleTo = 0.96) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return {
    style,
    onPressIn: () => { s.value = withTiming(scaleTo, { duration: 90 }); },
    onPressOut: () => { s.value = withSpring(1, SPRING.snappy); },
  };
}

export type ButtonKind = 'primary' | 'quiet' | 'danger';
export function Button({ title, onPress, kind = 'primary', color = 'blue', disabled = false, hint }: {
  title: string; onPress: () => void; kind?: ButtonKind; color?: ColorName; disabled?: boolean; hint?: string;
}) {
  const t = useTheme(), p = t.person(color), press = usePress();
  const bg = kind === 'primary' ? p.base : t.n.fill;
  const fg = kind === 'primary' ? p.on : kind === 'danger' ? t.n.danger : p.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityHint={hint} accessibilityState={{ disabled }} disabled={disabled}
      onPressIn={press.onPressIn} onPressOut={press.onPressOut}
      onPress={() => { if (kind === 'danger') haptic.warn(); else haptic.press(); onPress(); }}
    >
      <Animated.View style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, press.style]}>
        <Txt variant="headline" style={{ color: fg }}>{title}</Txt>
      </Animated.View>
    </Pressable>
  );
}

/** The big call to action on a page ("Save page"): a pill washed from one colour into another, with dark ink. */
export function PillButton({ title, onPress, colors, disabled = false, hint }: {
  title: string; onPress: () => void; colors: [ColorName, ColorName?]; disabled?: boolean; hint?: string;
}) {
  const t = useTheme(), press = usePress();
  return (
    <Pressable
      accessibilityRole="button" accessibilityHint={hint} accessibilityState={{ disabled }} disabled={disabled}
      onPressIn={press.onPressIn} onPressOut={press.onPressOut} onPress={() => { haptic.press(); onPress(); }}
    >
      <Animated.View style={[styles.pillButton, { opacity: disabled ? 0.45 : 1 }, press.style]}>
        <Gradient colors={t.gradient(colors[0], colors[1])} />
        <Txt variant="headline" tone="on">{title}</Txt>
      </Animated.View>
    </Pressable>
  );
}

export function Chip({ label, selected = false, onPress, color = 'blue', swatch, hint }: {
  label: string; selected?: boolean; onPress?: () => void; color?: ColorName; swatch?: ColorName; hint?: string;
}) {
  const t = useTheme(), p = t.person(color), press = usePress(0.94);
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ selected }} accessibilityHint={hint}
      onPressIn={press.onPressIn} onPressOut={press.onPressOut} onPress={() => { haptic.tick(); onPress?.(); }}
      hitSlop={6}
    >
      <Animated.View style={[styles.chip, { backgroundColor: selected ? p.base : t.n.fill }, press.style]}>
        {swatch ? <View style={[styles.swatchDot, { backgroundColor: t.color(swatch), borderColor: selected ? INK : t.n.raised }]} /> : null}
        <Txt variant="callout" style={{ color: selected ? p.on : t.n.label, fontWeight: '600' }}>{label}</Txt>
      </Animated.View>
    </Pressable>
  );
}

export function Badge({ count, color = 'blue' }: { count: number; color?: ColorName }) {
  const t = useTheme(), p = t.person(color);
  return (
    <View style={[styles.badge, { backgroundColor: p.base }]} accessibilityLabel={`${count} new`}>
      <Txt variant="caption" tabular style={{ color: p.on }}>{count > 9 ? '9+' : String(count)}</Txt>
    </View>
  );
}

export function Row({ title, sub, left, right, onPress, last = false }: {
  title: string; sub?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void; last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.n.fill : 'transparent' }]}
    >
      {left ? <View style={styles.rowLeft}>{left}</View> : null}
      <View style={[styles.rowText, !last && { borderBottomColor: t.n.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.grow}>
          <Txt variant="body" numberOfLines={2}>{title}</Txt>
          {sub ? <Txt variant="footnote" tone="soft">{sub}</Txt> : null}
        </View>
        {right}
        {onPress ? <Chevron /> : null}
      </View>
    </Pressable>
  );
}

export function Chevron() {
  const t = useTheme();
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" style={styles.chevron}>
      <Path d={CHEVRON} stroke={t.n.faint} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ---------- Moments without a screen of their own ---------- */
export function EmptyState({ avatar, color, title, line, action }: {
  avatar: AvatarLook; color: ColorName; title: string; line: string; action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Avatar avatar={avatar} color={color} size={110} />
      <Txt variant="headline" align="center" style={styles.emptyTitle}>{title}</Txt>
      <Txt variant="callout" tone="soft" align="center">{line}</Txt>
      {action ? <View style={styles.emptyAction}><Button title={action.title} onPress={action.onPress} color={color} /></View> : null}
    </View>
  );
}

/** A short note at the top of the screen ("Saved on your phone"). Shown by the screen; leaves by itself. */
export function Toast({ text }: { text: string }) {
  const t = useTheme(), insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInUp.duration(280)} exiting={FadeOutUp.duration(200)} pointerEvents="none"
      style={[styles.toast, { top: insets.top + SPACE.xs, backgroundColor: t.n.sheet, boxShadow: t.shadow[2] }]}
      accessibilityLiveRegion="polite" accessibilityRole="alert"
    >
      <Txt variant="callout" style={{ fontWeight: '600' }}>{text}</Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  titleBox: { paddingTop: SPACE.s, paddingBottom: SPACE.xs },
  titleSub: { marginTop: SPACE.xxs },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, minHeight: HIT - 8, paddingLeft: SPACE.xs, paddingRight: SPACE.s, borderRadius: 999, marginTop: SPACE.xxs },
  section: { marginTop: SPACE.xxl },
  sectionSub: { marginTop: 2 },
  sectionBody: { marginTop: SPACE.s },
  card: { borderRadius: RADIUS.l, paddingVertical: SPACE.xxs },
  pillButton: { minHeight: 50, paddingHorizontal: SPACE.xl, borderRadius: RADIUS.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 50, paddingHorizontal: SPACE.l, borderRadius: RADIUS.m, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 36, paddingHorizontal: SPACE.s, borderRadius: RADIUS.pill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatchDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: HIT + 8, paddingLeft: SPACE.m },
  rowLeft: { marginRight: SPACE.s },
  rowText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: HIT + 8, paddingVertical: SPACE.xs, paddingRight: SPACE.m },
  grow: { flex: 1 },
  chevron: { marginLeft: 2 },
  empty: { alignItems: 'center', paddingVertical: SPACE.l, paddingHorizontal: SPACE.xl, gap: SPACE.xxs },
  emptyTitle: { marginTop: SPACE.xs },
  emptyAction: { marginTop: SPACE.s, alignSelf: 'stretch' },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, borderRadius: RADIUS.pill },
});
