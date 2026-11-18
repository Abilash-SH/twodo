/* Twodo · a character's head and shoulders in a circle, for headers and rows (the Home greeting, a page's author). */
import { useId, useMemo } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { useTheme } from '../theme';
import type { ColorName } from '../tokens';
import type { AvatarLook } from './looks';
import { expressionFor } from './moods';
import { BackHair, Grads, Head, Torso, makePaint } from './parts';

export function Portrait({ avatar, color, size }: { avatar: AvatarLook; color: ColorName; size: number }) {
  const t = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const paint = useMemo(() => makePaint(`p${uid}`, avatar, t.person(color)), [uid, avatar, t, color]);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: t.person(color).tint }}
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="12 4 76 76">
        <Grads p={paint} use={['skin', 'hair', 'outfit', 'blush', 'iris']} />
        <BackHair p={paint} /><Torso p={paint} /><Head p={paint} e={expressionFor('idle')} />
      </Svg>
    </View>
  );
}
