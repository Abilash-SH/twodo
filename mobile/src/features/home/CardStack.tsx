/* Twodo · Home's fanned stack of cards (after the owner's reference): the top card upright, the next ones tilted and
   peeking out to the left. Swipe the top card away to bring the next one forward; tap it to open (VoiceOver: double
   tap). The dots below bring any card to the top, and are how VoiceOver moves through them. Only transform and opacity move, on the UI
   thread; with Reduce Motion the cards change places without flying. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gradient } from '@/ui/Gradient';
import { haptic } from '@/ui/haptics';
import { Txt } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { BADGE, INK, RADIUS, SPACE, SPRING, type ColorName } from '@/ui/tokens';

export interface StackCard {
  id: string;
  /** Small capitals in the corner pill ("TODAY"). */
  badge: string;
  /** Big capitals at the bottom ("3 TO-DOS LEFT"). */
  title: string;
  sub: string;
  colors: [ColorName, ColorName?];
  /** The picture in the middle. `top` is false while the card waits in the fan: draw it still there. */
  art: (size: { w: number; h: number; top: boolean }) => ReactNode;
  /** The dot's name for VoiceOver ("Show Today"). */
  label: string;
  /** What opening the card does, for VoiceOver ("Opens your to-dos"). */
  hint: string;
  onOpen: () => void;
}

const FAN = { x: -24, rotate: -6.5, scale: 0.045, shift: SPACE.m }; // shift: the whole fan sits a little right, so it looks centred
const SHOWN = 3; // cards visible in the fan; the rest wait, faded, behind

export function CardStack({ cards }: { cards: StackCard[] }) {
  const { width } = useWindowDimensions();
  const w = Math.min(330, Math.round(width * 0.74)), h = Math.round(w * 1.18);
  const [order, setOrder] = useState(() => cards.map(c => c.id));
  const byId = new Map(cards.map(c => [c.id, c]));
  const sendBack = useCallback(() => setOrder(o => [...o.slice(1), o[0]]), []);
  const bring = (id: string) => { haptic.tick(); setOrder(o => [id, ...o.filter(x => x !== id)]); };

  return (
    <View>
      <View style={[styles.stage, { height: h + SPACE.xl }]}>
        {[...order].reverse().map(id => {
          const c = byId.get(id);
          return c ? <Card key={id} card={c} depth={order.indexOf(id)} w={w} h={h} onSwiped={sendBack} /> : null;
        })}
      </View>
      <View style={styles.dots}>
        {cards.map(c => (
          <Dot key={c.id} on={order[0] === c.id} color={c.colors[0]} label={c.label} onPress={() => bring(c.id)} />
        ))}
      </View>
    </View>
  );
}

function Card({ card, depth, w, h, onSwiped }: { card: StackCard; depth: number; w: number; h: number; onSwiped: () => void }) {
  const t = useTheme(), reduce = useReducedMotion();
  const d = useSharedValue(depth), tx = useSharedValue(0);
  const flew = useRef(false);
  const top = depth === 0;

  useEffect(() => {
    if (flew.current || reduce) { flew.current = false; tx.value = 0; d.value = depth; return; } // behind, unseen
    d.value = withSpring(depth, SPRING.gentle);
  }, [depth, reduce, d, tx]);

  const gone = useCallback(() => { flew.current = true; haptic.tick(); onSwiped(); }, [onSwiped]);
  const { onOpen } = card;
  const open = useCallback(() => { haptic.press(); onOpen(); }, [onOpen]);
  // A tap and a swipe race: whichever is recognised first wins, so letting go after a swipe never opens the card.
  const tap = useTapGesture({ enabled: top, maxDistance: 10, runOnJS: true, onActivate: () => open() });
  const pan = usePanGesture({
    enabled: top,
    activeOffsetX: [-12, 12],
    failOffsetY: [-14, 14],
    onUpdate: e => { 'worklet'; tx.value = e.translationX; },
    onDeactivate: e => {
      'worklet';
      const away = Math.abs(e.translationX) > 90 || Math.abs(e.velocityX) > 800;
      if (!away) { tx.value = withSpring(0, SPRING.snappy); return; }
      if (reduce) { scheduleOnRN(gone); return; }
      const dir = (e.translationX || e.velocityX) > 0 ? 1 : -1;
      tx.value = withTiming(dir * (w + 160), { duration: 220 }, done => { 'worklet'; if (done) scheduleOnRN(gone); });
    },
  });

  const gesture = useCompetingGestures(pan, tap);

  const style = useAnimatedStyle(() => {
    const k = d.value;
    return {
      opacity: k > SHOWN - 0.6 ? Math.max(0, (SHOWN - k) / 0.6) : 1,
      transform: [
        { translateX: FAN.shift + FAN.x * k + tx.value },
        { rotate: `${FAN.rotate * k + tx.value / 18}deg` },
        { scale: 1 - FAN.scale * k },
      ],
    };
  });

  // Words fade as a card goes back, so the fan shows clean edges, not half-hidden letters.
  const words = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - d.value * 1.5) }));

  const [a, b] = card.colors;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.card, { width: w, height: h, boxShadow: t.shadow[2] }, style]}
        accessible={top} accessibilityRole="button" accessibilityLabel={`${card.badge}: ${card.title}. ${card.sub}`}
        accessibilityHint={card.hint} onAccessibilityTap={top ? open : undefined}
        accessibilityElementsHidden={!top} importantForAccessibility={top ? 'yes' : 'no-hide-descendants'}
      >
        <View style={styles.clip}>
          <Gradient colors={t.gradient(a, b)} />
          <View style={styles.art} pointerEvents="none">{card.art({ w, h, top })}</View>
          <Animated.View style={[StyleSheet.absoluteFill, words]} pointerEvents="none">
            <View style={[styles.badge, { backgroundColor: BADGE.bg }]}>
              <Txt variant="label" style={{ color: BADGE.text }} numberOfLines={1}>{card.badge}</Txt>
            </View>
            <View style={styles.words}>
              <Txt variant="display" style={{ color: INK }} numberOfLines={2}>{card.title}</Txt>
              <Txt variant="callout" tone="on" numberOfLines={1} style={styles.sub}>{card.sub}</Txt>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function Dot({ on, color, label, onPress }: { on: boolean; color: ColorName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}>
      <View style={[styles.dot, { width: on ? 22 : 8, backgroundColor: on ? t.color(color) : t.n.fill2 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', borderRadius: RADIUS.xl, transformOrigin: '50% 100%' },
  clip: { flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  art: { position: 'absolute', left: 0, right: 0, top: SPACE.xxl, bottom: 104, alignItems: 'center', justifyContent: 'flex-end' },
  badge: { position: 'absolute', top: SPACE.m, left: SPACE.m, paddingHorizontal: SPACE.s, paddingVertical: 5, borderRadius: RADIUS.pill },
  words: { position: 'absolute', left: SPACE.l, right: SPACE.l, bottom: SPACE.l },
  sub: { marginTop: 2, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs, minHeight: 24 },
  dot: { height: 8, borderRadius: 4 },
});
