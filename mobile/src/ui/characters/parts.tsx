/* Twodo · the six characters' drawings (original, drawn for Twodo; design.md, "Characters").
   Body in the person's colour, a lighter face or tummy, darker feet, dark eyes, at most one accent.
   Drawn in a 100 x 100 box with the feet at the bottom, exactly as in the web app, split into parts so a mood can
   move one of them (an arm, the whole figure) while the rest stays put. */
import { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { BLUSH, INK, LEAF, SPARK, WHITE, type PersonColors } from '../tokens';
import type { CharKind, FaceLook } from './moods';

const EYE = 9;

function Eye({ cx, y, look }: { cx: number; y: number; look: 'open' | 'closed' | 'wink' | 'happy' | 'up' }) {
  switch (look) {
    case 'closed':
      return <Path d={`M${cx - 3.5} ${y} q3.5 3 7 0`} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />;
    case 'wink':
      return <Path d={`M${cx - 3.5} ${y} q3.5 -3 7 0`} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />;
    case 'happy':
      return <Path d={`M${cx - 3.5} ${y + 1} q3.5 -4.2 7 0`} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
    case 'up':
      return (<>
        <Ellipse cx={cx + 1.2} cy={y - 1.4} rx={2.9} ry={3.6} fill={INK} />
        <Circle cx={cx + 2.2} cy={y - 2.9} r={1} fill={WHITE} />
      </>);
    default:
      return (<>
        <Ellipse cx={cx} cy={y} rx={2.9} ry={3.6} fill={INK} />
        <Circle cx={cx + 1} cy={y - 1.4} r={1} fill={WHITE} />
      </>);
  }
}

export function Face({ x, y, look }: { x: number; y: number; look: FaceLook }) {
  const strong = look.blush === 'strong';
  const right = look.eyes === 'wink' ? 'wink' : look.eyes;
  const left = look.eyes === 'wink' ? 'open' : look.eyes;
  return (<>
    <Eye cx={x - EYE} y={y} look={left} />
    <Eye cx={x + EYE} y={y} look={right} />
    <Ellipse cx={x - EYE - 5} cy={y + 6} rx={strong ? 4.8 : 4.2} ry={strong ? 3 : 2.6} fill={BLUSH} opacity={strong ? 0.9 : 0.55} />
    <Ellipse cx={x + EYE + 5} cy={y + 6} rx={strong ? 4.8 : 4.2} ry={strong ? 3 : 2.6} fill={BLUSH} opacity={strong ? 0.9 : 0.55} />
    {look.mouth === 'big' ? <Path d={`M${x - 4.5} ${y + 5.5} q4.5 6 9 0 z`} fill={INK} />
      : look.mouth === 'o' ? <Ellipse cx={x} cy={y + 7.5} rx={1.8} ry={1.6} fill={INK} />
        : look.mouth === 'flat' ? <Path d={`M${x - 2.5} ${y + 7} h5`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
          : <Path d={`M${x - 3.5} ${y + 6} q3.5 3.6 7 0`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />}
  </>);
}

export function Shadow() {
  return <Ellipse cx={50} cy={98} rx={30} ry={4} fill={INK} opacity={0.14} />;
}

export function Feet({ p }: { p: PersonColors }) {
  return (<>
    <Ellipse cx={38} cy={95} rx={8} ry={4.5} fill={p.dark} />
    <Ellipse cx={62} cy={95} rx={8} ry={4.5} fill={p.dark} />
  </>);
}

export function Arm({ side, p }: { side: 'left' | 'right'; p: PersonColors }) {
  return <Path d={side === 'left' ? 'M16 64 q-8 8 -4 16' : 'M84 64 q8 8 4 16'} stroke={p.base} strokeWidth={8} strokeLinecap="round" fill="none" />;
}

export function Body({ kind, p, look }: { kind: CharKind; p: PersonColors; look: FaceLook }) {
  const c = p.base, l = p.light;
  switch (kind) {
    case 'bun': return (<>
      <Circle cx={30} cy={30} r={10} fill={c} /><Circle cx={70} cy={30} r={10} fill={c} />
      <Circle cx={30} cy={30} r={5} fill={l} /><Circle cx={70} cy={30} r={5} fill={l} />
      <Ellipse cx={50} cy={62} rx={37} ry={32} fill={c} /><Ellipse cx={50} cy={68} rx={25} ry={20} fill={l} />
      <Face x={50} y={60} look={look} />
    </>);
    case 'sprout': return (<>
      <Path d="M50 30 q-2 -12 -14 -16 q-2 12 14 16z" fill={LEAF.dark} />
      <Path d="M50 30 q2 -14 16 -18 q2 14 -16 18z" fill={LEAF.light} />
      <Path d="M50 30 C 82 30 90 64 84 78 C 78 94 22 94 16 78 C 10 64 18 30 50 30z" fill={c} />
      <Ellipse cx={50} cy={70} rx={24} ry={17} fill={l} />
      <Face x={50} y={62} look={look} />
    </>);
    case 'pebble': return (<>
      <Path d="M14 72 C 14 44 34 38 52 38 C 74 38 88 48 88 70 C 88 90 70 94 50 94 C 30 94 14 90 14 72z" fill={c} />
      <Ellipse cx={38} cy={50} rx={10} ry={5} fill={WHITE} opacity={0.35} transform="rotate(-18 38 50)" />
      <Face x={51} y={66} look={look} />
    </>);
    case 'puff': return (<>
      <Circle cx={32} cy={64} r={20} fill={c} /><Circle cx={52} cy={48} r={24} fill={c} /><Circle cx={70} cy={64} r={20} fill={c} />
      <Rect x={22} y={60} width={58} height={32} rx={16} fill={c} />
      <Ellipse cx={51} cy={72} rx={22} ry={14} fill={l} />
      <Face x={51} y={64} look={look} />
    </>);
    case 'bolt': return (<>
      <Path d="M50 22 v-10" stroke={p.dark} strokeWidth={3} fill="none" />
      <Circle cx={50} cy={10} r={5} fill={SPARK} />
      <Rect x={16} y={22} width={68} height={70} rx={20} fill={c} />
      <Rect x={25} y={34} width={50} height={38} rx={13} fill={l} />
      <Face x={50} y={53} look={look} />
    </>);
    default: return (<>
      <Path d="M50 14 C 64 34 86 52 86 70 C 86 86 70 94 50 94 C 30 94 14 86 14 70 C 14 52 36 34 50 14z" fill={c} />
      <Path d="M36 56 q4 -10 12 -16" stroke={WHITE} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.5} />
      <Ellipse cx={50} cy={76} rx={22} ry={12} fill={l} />
      <Face x={50} y={68} look={look} />
    </>);
  }
}
