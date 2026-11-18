/* Twodo · the few icons the app needs, drawn as simple strokes on a 24 x 24 grid (no icon library). */
import Svg, { G, Path } from 'react-native-svg';
import { HEART } from './shapes';

const PATHS = {
  home: 'M3.5 10.5 L12 3.5 L20.5 10.5 V19.5 A1.5 1.5 0 0 1 19 21 H14.5 V15 H9.5 V21 H5 A1.5 1.5 0 0 1 3.5 19.5 Z',
  todos: 'M10 6.5 H20 M10 12 H20 M10 17.5 H20 M4 6.5 L5.3 7.8 L7.6 5.2 M4 12 L5.3 13.3 L7.6 10.7 M4 17.5 L5.3 18.8 L7.6 16.2',
  journal: 'M5.5 4 H17.5 A1.5 1.5 0 0 1 19 5.5 V20 H7.5 A2 2 0 0 1 5.5 18 Z M5.5 18 A2 2 0 0 1 7.5 16 H19 M9.5 8 H15',
  chat: 'M12 4.5 C16.7 4.5 20.5 7.6 20.5 11.5 C20.5 15.4 16.7 18.5 12 18.5 C11 18.5 10 18.4 9.1 18.1 L5 19.8 L6 16.2 C4.4 15 3.5 13.3 3.5 11.5 C3.5 7.6 7.3 4.5 12 4.5 Z',
  calendar: 'M4.5 7.5 A2 2 0 0 1 6.5 5.5 H17.5 A2 2 0 0 1 19.5 7.5 V18.5 A2 2 0 0 1 17.5 20.5 H6.5 A2 2 0 0 1 4.5 18.5 Z M4.5 10 H19.5 M8.5 3.5 V7 M15.5 3.5 V7',
  lock: 'M6.5 11 H17.5 V20 H6.5 Z M9 11 V8.2 A3 3 0 0 1 15 8.2 V11',
  left: 'M14.5 5.5 L8 12 L14.5 18.5',
  right: 'M9.5 5.5 L16 12 L9.5 18.5',
  close: 'M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5',
} as const;
export type IconName = keyof typeof PATHS | 'heart' | 'heartFill';

export function Icon({ name, size = 24, color, width = 2 }: { name: IconName; size?: number; color: string; width?: number }) {
  if (name === 'heart' || name === 'heartFill') {
    return (
      <Svg width={size} height={size} viewBox="-44 -44 88 88">
        <G transform="translate(0 4)">
          <Path d={HEART} fill={name === 'heartFill' ? color : 'none'} stroke={color} strokeWidth={width * 3.6} strokeLinejoin="round" />
        </G>
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PATHS[name]} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
