/* Twodo · the two of you, side by side on a soft glow of both colours (design.md: yours 108, your partner's 92,
   turned towards you). Each character sits in a button; the button carries what tapping does. */
import { useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Txt } from '../Text';
import { useTheme } from '../theme';
import { RADIUS, SPACE, type ColorName } from '../tokens';
import { Character, type MomentKey } from './Character';
import type { CharKind, CharState } from './moods';

export interface StagePerson {
  kind: CharKind;
  color: ColorName;
  name: string;
  state?: CharState;
  moment?: MomentKey | null;
  /** What tapping this character does, for VoiceOver ("Open the chat"). */
  hint: string;
  onPress?: () => void;
}

export function Stage({ me, partner }: { me: StagePerson; partner: StagePerson }) {
  const t = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={[styles.stage, { backgroundColor: t.n.raised, boxShadow: t.shadow[1] }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id={`me${id}`} cx="30%" cy="66%" rx="46%" ry="62%">
            <Stop offset="0" stopColor={t.color(me.color)} stopOpacity={0.3} />
            <Stop offset="1" stopColor={t.color(me.color)} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`pt${id}`} cx="70%" cy="66%" rx="46%" ry="62%">
            <Stop offset="0" stopColor={t.color(partner.color)} stopOpacity={0.3} />
            <Stop offset="1" stopColor={t.color(partner.color)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#me${id})`} />
        <Rect width="100%" height="100%" fill={`url(#pt${id})`} />
      </Svg>
      <View style={styles.floor}>
        <Who person={me} size={108} />
        <Who person={partner} size={92} flip />
      </View>
    </View>
  );
}

function Who({ person, size, flip = false }: { person: StagePerson; size: number; flip?: boolean }) {
  return (
    <Pressable onPress={person.onPress} accessibilityRole="button" accessibilityLabel={person.name} accessibilityHint={person.hint} style={styles.who}>
      <Character kind={person.kind} color={person.color} size={size} state={person.state} moment={person.moment} flip={flip} />
      <Txt variant="footnote" tone="soft" style={styles.name} numberOfLines={1}>{person.name}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { borderRadius: RADIUS.xl, overflow: 'hidden', paddingTop: SPACE.xxl + SPACE.xs, paddingBottom: SPACE.s },
  floor: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: SPACE.xl },
  who: { alignItems: 'center', minWidth: 96 },
  name: { marginTop: SPACE.xxs, fontWeight: '600' },
});
