/* Twodo · the two characters' drawings, part by part (original designs for Twodo).
   A 100 x 120 box, feet at the bottom. Soft 3D: every surface has a light-to-shade gradient lit from the top left,
   with highlights on the hair and eyes and soft shadows under the fringe, the chin and the feet. Parts are separate
   so a mood can move the head or an arm while the rest stays put. Gradient ids are unique per character (`p.id`). */
import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { mix } from '../color';
import { HEART } from '../shapes';
import { BLUSH, INK, WHITE, type PersonColors } from '../tokens';
import {
  CLIP, IRIS, LOVE_EYES, MOUTH, PANTS, SCLERA, SHOE, SOLE, TONGUE, hairShades, skinShades, type AvatarLook, type Shades,
} from './looks';
import type { Expression } from './moods';

export interface Paint { id: string; look: AvatarLook['look']; skin: Shades; hair: Shades; outfit: PersonColors; lash: string }
export function makePaint(id: string, a: AvatarLook, outfit: PersonColors): Paint {
  const hair = hairShades(a.hair);
  return { id, look: a.look, skin: skinShades(a.skin), hair, outfit, lash: mix(hair.lo, 60, INK) };
}

type Grad = 'skin' | 'hair' | 'outfit' | 'pants' | 'ground' | 'blush' | 'iris';
const url = (p: Paint, g: Grad): string => `url(#${p.id}${g})`;

/** The gradients a layer uses. Each layer is its own drawing, so each brings its own. */
export function Grads({ p, use }: { p: Paint; use: Grad[] }) {
  const on = (g: Grad) => use.includes(g);
  const o = p.outfit;
  return (
    <Defs>
      {on('skin') ? (
        <RadialGradient id={`${p.id}skin`} cx="38%" cy="30%" r="78%">
          <Stop offset="0" stopColor={p.skin.hi} /><Stop offset="0.55" stopColor={p.skin.base} /><Stop offset="1" stopColor={p.skin.lo} />
        </RadialGradient>
      ) : null}
      {on('hair') ? (
        <LinearGradient id={`${p.id}hair`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={p.hair.hi} /><Stop offset="0.42" stopColor={p.hair.base} /><Stop offset="1" stopColor={p.hair.lo} />
        </LinearGradient>
      ) : null}
      {on('outfit') ? (
        <LinearGradient id={`${p.id}outfit`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={mix(o.base, 70, WHITE)} /><Stop offset="0.5" stopColor={o.base} /><Stop offset="1" stopColor={mix(o.base, 72, INK)} />
        </LinearGradient>
      ) : null}
      {on('pants') ? (
        <LinearGradient id={`${p.id}pants`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={mix(PANTS, 78, WHITE)} /><Stop offset="1" stopColor={PANTS} />
        </LinearGradient>
      ) : null}
      {on('ground') ? (
        <RadialGradient id={`${p.id}ground`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={INK} stopOpacity={0.26} /><Stop offset="1" stopColor={INK} stopOpacity={0} />
        </RadialGradient>
      ) : null}
      {on('blush') ? (
        <RadialGradient id={`${p.id}blush`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={BLUSH} stopOpacity={0.62} /><Stop offset="1" stopColor={BLUSH} stopOpacity={0} />
        </RadialGradient>
      ) : null}
      {on('iris') ? (
        <RadialGradient id={`${p.id}iris`} cx="50%" cy="34%" r="72%">
          <Stop offset="0" stopColor={mix(IRIS, 55, '#E9B98A')} /><Stop offset="0.55" stopColor={IRIS} /><Stop offset="1" stopColor={mix(IRIS, 60, INK)} />
        </RadialGradient>
      ) : null}
    </Defs>
  );
}

/* ---------- Shapes ---------- */
const FACE = 'M50 9 C66.5 9 77.5 20.5 77.5 37 C77.5 53 66 62.5 50 62.5 C34 62.5 22.5 53 22.5 37 C22.5 20.5 33.5 9 50 9 Z';
const FEMALE_FRONT = 'M21 44 C18 22 31 4 50 4 C69 4 82 20 79.5 42 C79 50 78.5 57 76.5 64 C73.5 60 72.4 51 72.6 43 C72.8 35 69 28.5 62 25 C55 30 42 30.5 31 26.5 C28.2 32 27 40 27.2 48 C27.3 54 25.8 60 23 65 C21 58 21.2 51 21 44 Z';
const FEMALE_BACK = 'M50 4 C71 4 85 19 84 42 C83.5 54 86.5 66 83.5 77 C81.5 82 76.5 83 73.5 79.5 C70 83.5 64 83 62 78 L38 78 C36 83 30 83.5 26.5 79.5 C23.5 83 18.5 82 16.5 77 C13.5 66 16.5 54 16 42 C15 19 29 4 50 4 Z';
const MALE_FRONT = 'M22.6 38 C19.8 19 31 2.5 51 2.5 C70 2.5 81.5 15 78.8 36 C77.4 31 75.2 27.4 71.8 25.2 C69.2 22.4 64 20.4 58.6 21.2 C52 22.4 45.4 26.2 38.6 28.4 C34.2 29.8 30 31.6 27.2 35.6 C26.4 37 25.6 38.4 25.2 40 C24.2 39.8 23.2 39.2 22.6 38 Z';
const MALE_QUIFF = 'M54 7 C60 0 72 0.5 77 7.5 C71 5.2 64.5 5.6 59.6 9 C58 8 56 7.4 54 7 Z';
const EYE_X = [39.5, 60.5] as const, EYE_Y = 41;

export function Ground({ p }: { p: Paint }) {
  return <Ellipse cx={50} cy={115.5} rx={25} ry={3.8} fill={url(p, 'ground')} />;
}

export function BackHair({ p }: { p: Paint }) {
  return p.look === 'female' ? <Path d={FEMALE_BACK} fill={url(p, 'hair')} /> : null;
}

export function Legs({ p }: { p: Paint }) {
  const shoe = (side: 1 | -1) => {
    const x = side === 1 ? 0 : 100; // mirror the left shoe for the right
    const m = (n: number) => (side === 1 ? n : x - n);
    return (
      <G>
        <Path d={`M${m(35.5)} 112 C${m(35.5)} 107.5 ${m(39)} 106.5 ${m(43)} 106.5 C${m(47)} 106.5 ${m(49.5)} 108 ${m(49.5)} 111 C${m(49.5)} 113.5 ${m(47.5)} 114 ${m(43)} 114 L${m(38)} 114 C${m(36.3)} 114 ${m(35.5)} 113.4 ${m(35.5)} 112 Z`} fill={SHOE} />
        <Rect x={side === 1 ? 35.5 : 50.5} y={112.4} width={14} height={2} rx={1} fill={SOLE} />
        <Path d={`M${m(39.5)} 109.6 Q${m(42.5)} 107.8 ${m(46)} 109.2`} stroke={p.outfit.base} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      </G>
    );
  };
  return (<>
    <Rect x={39} y={95} width={9.5} height={14} rx={4.5} fill={url(p, 'pants')} />
    <Rect x={51.5} y={95} width={9.5} height={14} rx={4.5} fill={url(p, 'pants')} />
    {shoe(1)}{shoe(-1)}
  </>);
}

export function Torso({ p }: { p: Paint }) {
  const lo = mix(p.outfit.base, 70, INK);
  return (<>
    <Path d="M35 61 C37 52.5 63 52.5 65 61 C59 64.5 41 64.5 35 61 Z" fill={lo} />
    <Path d="M34 63 C34 59.6 37.8 57.8 42 57.8 L58 57.8 C62.2 57.8 66 59.6 66 63 L69.5 93 C70 97 67 100 63 100 L37 100 C33 100 30 97 30.5 93 Z" fill={url(p, 'outfit')} />
    <Ellipse cx={50} cy={62.6} rx={8.5} ry={2.6} fill={p.skin.lo} opacity={0.55} />
    <Path d="M40.5 83 L59.5 83 L62.5 94 L37.5 94 Z" fill={lo} opacity={0.22} />
    <Path d="M40.5 83 L59.5 83" stroke={lo} strokeWidth={1} opacity={0.55} />
    <Path d="M31 95.5 C44 97.5 56 97.5 69 95.5" stroke={lo} strokeWidth={1.2} opacity={0.45} fill="none" />
    <Path d="M37 67 C39 64 43 63 46 63.5" stroke={WHITE} strokeWidth={2} opacity={0.28} strokeLinecap="round" fill="none" />
    <Path d="M46 63 L45.4 71" stroke={WHITE} strokeWidth={1.3} strokeLinecap="round" />
    <Circle cx={45.3} cy={72} r={1.1} fill={WHITE} />
    <Path d="M54 63 L54.6 71" stroke={WHITE} strokeWidth={1.3} strokeLinecap="round" />
    <Circle cx={54.7} cy={72} r={1.1} fill={WHITE} />
  </>);
}

export function Arm({ p, side }: { p: Paint; side: 'left' | 'right' }) {
  const l = side === 'left';
  const sx = l ? 35.5 : 64.5, ex = l ? 31 : 69, hx = l ? 30.6 : 69.4, tx = l ? 33.4 : 66.6;
  const cx = sx + 0.8 * (ex - sx), cy = 63 + 0.8 * 22; // where the cuff starts
  return (<>
    <Path d={`M${sx} 63 L${ex} 85`} stroke={p.outfit.base} strokeWidth={9} strokeLinecap="round" />
    <Path d={`M${sx - 2.4} 64.5 L${ex - 2.4} 80`} stroke={WHITE} strokeWidth={1.6} opacity={0.25} strokeLinecap="round" />
    <Path d={`M${cx} ${cy} L${ex} 85`} stroke={mix(p.outfit.base, 76, INK)} strokeWidth={9.4} strokeLinecap="round" />
    <Circle cx={hx} cy={88.4} r={4.4} fill={url(p, 'skin')} />
    <Ellipse cx={tx} cy={87.4} rx={1.6} ry={2.2} fill={url(p, 'skin')} />
  </>);
}

function Eye({ cx, e, p }: { cx: number; e: Expression; p: Paint }) {
  const y = EYE_Y, lash = p.lash, w = p.look === 'female' ? 1.9 : 1.4;
  const outer = cx < 50 ? -1 : 1;
  switch (e.eyes) {
    case 'happy':
      return <Path d={`M${cx - 5.6} ${y + 1.5} Q${cx} ${y - 5.5} ${cx + 5.6} ${y + 1.5}`} stroke={lash} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
    case 'closed':
      return (<>
        <Path d={`M${cx - 5.6} ${y} Q${cx} ${y + 4.6} ${cx + 5.6} ${y}`} stroke={lash} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        {p.look === 'female' ? <Path d={`M${cx + outer * 5.2} ${y + 0.8} l${outer * 1.8} 1.6`} stroke={lash} strokeWidth={1.4} strokeLinecap="round" /> : null}
      </>);
    case 'heart':
      return (
        <G transform={`translate(${cx} ${y + 2}) scale(0.155)`}>
          <Path d={HEART} fill={LOVE_EYES} />
          <Ellipse cx={-14} cy={-14} rx={8} ry={10} fill={WHITE} opacity={0.85} />
        </G>
      );
    default: {
      const dx = e.eyes === 'up' ? 1.4 : 0, dy = e.eyes === 'up' ? -1.6 : 0;
      return (<>
        <Ellipse cx={cx} cy={y} rx={6.6} ry={7.4} fill={SCLERA} />
        <Path d={`M${cx - 6.4} ${y - 1.5} Q${cx} ${y - 8.8} ${cx + 6.4} ${y - 1.5} Q${cx} ${y - 5.2} ${cx - 6.4} ${y - 1.5} Z`} fill={p.skin.lo} opacity={0.22} />
        <Ellipse cx={cx + dx} cy={y + 0.8 + dy} rx={5.2} ry={5.9} fill={url(p, 'iris')} />
        <Ellipse cx={cx + dx} cy={y + 1 + dy} rx={2.6} ry={3} fill={mix(INK, 70, '#000000')} />
        <Ellipse cx={cx - 1.9 + dx} cy={y - 1.6 + dy} rx={1.9} ry={2.2} fill={WHITE} />
        <Circle cx={cx + 2 + dx} cy={y + 3 + dy} r={0.9} fill={WHITE} opacity={0.9} />
        <Path d={`M${cx - 7} ${y - 1.2} Q${cx} ${y - 9.4} ${cx + 7} ${y - 1.2}`} stroke={lash} strokeWidth={w} strokeLinecap="round" fill="none" />
        {p.look === 'female' ? <Path d={`M${cx + outer * 6.6} ${y - 2} l${outer * 2.2} -1.6`} stroke={lash} strokeWidth={1.5} strokeLinecap="round" /> : null}
      </>);
    }
  }
}

export function Head({ p, e }: { p: Paint; e: Expression }) {
  const female = p.look === 'female';
  const front = female ? FEMALE_FRONT : MALE_FRONT;
  const brow = female ? 1.8 : 2.3, raised = e.brow === 'raised';
  const strong = e.blush === 'strong';
  return (<>
    {[23.6, 76.4].map(x => (
      <G key={x}>
        <Ellipse cx={x} cy={40} rx={4.2} ry={5.4} fill={url(p, 'skin')} />
        <Path d={x < 50 ? 'M23.6 37.4 q-1.6 2.6 0 5.2' : 'M76.4 37.4 q1.6 2.6 0 5.2'} stroke={p.skin.lo} strokeWidth={1.1} opacity={0.6} fill="none" strokeLinecap="round" />
      </G>
    ))}
    <Path d={FACE} fill={url(p, 'skin')} />
    <G transform="translate(0 2.2)"><Path d={front} fill={p.skin.lo} opacity={0.3} /></G>
    <Ellipse cx={32} cy={50.5} rx={strong ? 7.4 : 6.2} ry={strong ? 4.4 : 3.7} fill={url(p, 'blush')} />
    <Ellipse cx={68} cy={50.5} rx={strong ? 7.4 : 6.2} ry={strong ? 4.4 : 3.7} fill={url(p, 'blush')} />
    {EYE_X.map(cx => <Eye key={cx} cx={cx} e={e} p={p} />)}
    <Path d="M33.5 31.8 Q38.5 29.2 44 31" stroke={p.hair.lo} strokeWidth={brow} strokeLinecap="round" fill="none" />
    <Path d={raised ? 'M56 29.8 Q61.5 27 66.5 29.6' : 'M56 31 Q61.5 29.2 66.5 31.8'} stroke={p.hair.lo} strokeWidth={brow} strokeLinecap="round" fill="none" />
    <Ellipse cx={50} cy={48} rx={1.7} ry={1.1} fill={p.skin.lo} opacity={0.55} />
    <Ellipse cx={49.4} cy={47.5} rx={0.6} ry={0.4} fill={WHITE} opacity={0.6} />
    {e.mouth === 'o' ? <Ellipse cx={50} cy={54.2} rx={1.8} ry={2} fill={MOUTH} />
      : e.mouth === 'big' ? (<>
        <Path d="M43.2 51.6 Q50 61 56.8 51.6 Q50 53.6 43.2 51.6 Z" fill={MOUTH} />
        <Ellipse cx={50} cy={56.2} rx={2.8} ry={1.4} fill={TONGUE} />
      </>) : (<>
        <Path d="M44.6 52.2 Q50 58.6 55.4 52.2 Q50 54 44.6 52.2 Z" fill={MOUTH} />
        <Ellipse cx={50} cy={54.7} rx={2.2} ry={1} fill={TONGUE} />
      </>)}
    <Path d={front} fill={url(p, 'hair')} />
    {female ? (<>
      <Path d="M50 6 C45 13 40 20 35 27" stroke={p.hair.lo} strokeWidth={1.1} opacity={0.45} fill="none" strokeLinecap="round" />
      <Path d="M55 7 C52 14 49 21 45 29" stroke={p.hair.lo} strokeWidth={1.1} opacity={0.35} fill="none" strokeLinecap="round" />
      <Path d="M30 16 C36 9.5 47 7.5 56 8.5" stroke={WHITE} strokeWidth={3} opacity={0.32} fill="none" strokeLinecap="round" />
      <Path d="M60 9.8 C64 11 67 13 69 15.5" stroke={WHITE} strokeWidth={2.2} opacity={0.22} fill="none" strokeLinecap="round" />
      <G transform="translate(68 18) rotate(18) scale(0.13)">
        <Path d={HEART} fill={CLIP} stroke={WHITE} strokeWidth={7} strokeLinejoin="round" />
      </G>
    </>) : (<>
      <Path d={MALE_QUIFF} fill={url(p, 'hair')} />
      <Path d="M32 13 C38 20 45 24.5 52 23.5" stroke={p.hair.lo} strokeWidth={1.2} opacity={0.42} fill="none" strokeLinecap="round" />
      <Path d="M46 7.5 C52.5 13.5 59.5 17.5 67 20.5" stroke={p.hair.lo} strokeWidth={1.2} opacity={0.36} fill="none" strokeLinecap="round" />
      <Path d="M30.5 15 C36 8 46 5.6 55 6.2" stroke={WHITE} strokeWidth={2.8} opacity={0.3} fill="none" strokeLinecap="round" />
    </>)}
  </>);
}
