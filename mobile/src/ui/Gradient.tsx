/* Twodo · a soft diagonal wash between two colours from the theme, behind a card's content. */
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function Gradient({ colors, angle = 'diagonal' }: { colors: [string, string]; angle?: 'diagonal' | 'down' }) {
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const down = angle === 'down';
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={down ? '0' : '1'} y2="1">
          <Stop offset="0" stopColor={colors[0]} /><Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
