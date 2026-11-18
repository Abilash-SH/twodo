/* Twodo · the two characters (original, drawn for Twodo; design.md, "Characters"; docs/characters.md). A chibi figure in
   a 100 x 120 box, feet at the bottom, in a soft 3D style: every surface has a light-to-shade gradient lit from the top
   left, highlights on the hair and eyes, soft shadows under the fringe, the chin and the feet. Female: long hair with a
   heart clip; male: a side-swept quiff. The hoodie is the person's colour (--c on a parent).
   `state` lasts while it is true (think, sleepy). `cls` plays one moment (wave, hop, happy, cheer, love): set it again
   to play it again. Moments are CSS animations of transform and opacity only, and none play with Reduce Motion
   (src/styles/41-avatars.css). `size` is the height in px. Decorative: the button around it carries the label. */
import { useEffect, useId, useRef, useState } from 'react';
import { hairColor, skinColor } from '@/lib/characters';
import { faceUrl, modelUrl, personFor } from '@/lib/people';
import type { Handle } from '@/lib/people3d';
import type { AvatarLook } from '@/lib/types';

export type CharState = 'idle' | 'think' | 'sleepy';
export const CHAR_RATIO = 100 / 120;

const INK = '#1B1730', WHITE = '#FFFFFF', BLUSH = '#FF8FA8';
const PANTS = '#3B3552', SHOE = '#FBFAFD', SOLE = '#D9D3E2', MOUTH = '#7A2E3A', TONGUE = '#E86F82';
const IRIS = '#4A2D1F', LOVE_EYES = '#F0507A', CLIP = '#FF7DA0', SPARK = '#FFC857';
const OUT = 'var(--cv-o)', OUT_LO = 'color-mix(in srgb, var(--cv-o) 70%, #1B1730)', CUFF = 'color-mix(in srgb, var(--cv-o) 76%, #1B1730)';
const HEART = 'M0 30 C -26 13 -36 -3 -36 -15 C -36 -27 -27 -35 -17 -35 C -9 -35 -3 -31 0 -24 C 3 -31 9 -35 17 -35 C 27 -35 36 -27 36 -15 C 36 -3 26 13 0 30 Z';
const SPARKLE = 'M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10 Z';

/** `mix(a, 30, b)` is CSS `color-mix(in srgb, a 30%, b)`, for the fixed skin and hair colours */
function mix(a: string, pct: number, b: string): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b), t = pct / 100;
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}
interface Paint { id: string; female: boolean; skin: [string, string, string]; hair: [string, string, string]; lash: string }
function paint(id: string, a: AvatarLook): Paint {
  const s = skinColor(a.skin), h = hairColor(a.hair), hairLo = mix(h, 70, '#0E0A0C');
  return { id, female: a.look === 'female', skin: [mix(s, 78, '#FFF4EC'), s, mix(s, 82, '#5A2E24')], hair: [mix(h, 72, WHITE), h, hairLo], lash: mix(hairLo, 60, INK) };
}
const url = (p: Paint, g: string) => `url(#${p.id}${g})`;

function Grads({ p }: { p: Paint }) {
  return (
    <defs>
      <radialGradient id={`${p.id}skin`} cx="38%" cy="30%" r="78%">
        <stop offset="0" stopColor={p.skin[0]} /><stop offset="0.55" stopColor={p.skin[1]} /><stop offset="1" stopColor={p.skin[2]} />
      </radialGradient>
      <linearGradient id={`${p.id}hair`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor={p.hair[0]} /><stop offset="0.42" stopColor={p.hair[1]} /><stop offset="1" stopColor={p.hair[2]} />
      </linearGradient>
      <linearGradient id={`${p.id}outfit`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--cv-o) 70%, #FFFFFF)' }} />
        <stop offset="0.5" style={{ stopColor: OUT }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--cv-o) 72%, #1B1730)' }} />
      </linearGradient>
      <linearGradient id={`${p.id}pants`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={mix(PANTS, 78, WHITE)} /><stop offset="1" stopColor={PANTS} />
      </linearGradient>
      <radialGradient id={`${p.id}ground`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={INK} stopOpacity={0.26} /><stop offset="1" stopColor={INK} stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`${p.id}blush`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor={BLUSH} stopOpacity={0.62} /><stop offset="1" stopColor={BLUSH} stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`${p.id}iris`} cx="50%" cy="34%" r="72%">
        <stop offset="0" stopColor={mix(IRIS, 55, '#E9B98A')} /><stop offset="0.55" stopColor={IRIS} /><stop offset="1" stopColor={mix(IRIS, 60, INK)} />
      </radialGradient>
    </defs>
  );
}

/* ---------- Shapes ---------- */
const FACE = 'M50 9 C66.5 9 77.5 20.5 77.5 37 C77.5 53 66 62.5 50 62.5 C34 62.5 22.5 53 22.5 37 C22.5 20.5 33.5 9 50 9 Z';
const FEMALE_FRONT = 'M21 44 C18 22 31 4 50 4 C69 4 82 20 79.5 42 C79 50 78.5 57 76.5 64 C73.5 60 72.4 51 72.6 43 C72.8 35 69 28.5 62 25 C55 30 42 30.5 31 26.5 C28.2 32 27 40 27.2 48 C27.3 54 25.8 60 23 65 C21 58 21.2 51 21 44 Z';
const FEMALE_BACK = 'M50 4 C71 4 85 19 84 42 C83.5 54 86.5 66 83.5 77 C81.5 82 76.5 83 73.5 79.5 C70 83.5 64 83 62 78 L38 78 C36 83 30 83.5 26.5 79.5 C23.5 83 18.5 82 16.5 77 C13.5 66 16.5 54 16 42 C15 19 29 4 50 4 Z';
const MALE_FRONT = 'M22.6 38 C19.8 19 31 2.5 51 2.5 C70 2.5 81.5 15 78.8 36 C77.4 31 75.2 27.4 71.8 25.2 C69.2 22.4 64 20.4 58.6 21.2 C52 22.4 45.4 26.2 38.6 28.4 C34.2 29.8 30 31.6 27.2 35.6 C26.4 37 25.6 38.4 25.2 40 C24.2 39.8 23.2 39.2 22.6 38 Z';
const MALE_QUIFF = 'M54 7 C60 0 72 0.5 77 7.5 C71 5.2 64.5 5.6 59.6 9 C58 8 56 7.4 54 7 Z';
const EYE_Y = 41;

function BackHair({ p }: { p: Paint }) {
  return p.female ? <path d={FEMALE_BACK} fill={url(p, 'hair')} /> : null;
}

function Legs({ p }: { p: Paint }) {
  const shoe = (side: 1 | -1) => {
    const m = (n: number) => (side === 1 ? n : 100 - n);
    return (
      <g>
        <path d={`M${m(35.5)} 112 C${m(35.5)} 107.5 ${m(39)} 106.5 ${m(43)} 106.5 C${m(47)} 106.5 ${m(49.5)} 108 ${m(49.5)} 111 C${m(49.5)} 113.5 ${m(47.5)} 114 ${m(43)} 114 L${m(38)} 114 C${m(36.3)} 114 ${m(35.5)} 113.4 ${m(35.5)} 112 Z`} fill={SHOE} />
        <rect x={side === 1 ? 35.5 : 50.5} y={112.4} width={14} height={2} rx={1} fill={SOLE} />
        <path d={`M${m(39.5)} 109.6 Q${m(42.5)} 107.8 ${m(46)} 109.2`} style={{ stroke: OUT }} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      </g>
    );
  };
  return (<>
    <rect x={39} y={95} width={9.5} height={14} rx={4.5} fill={url(p, 'pants')} />
    <rect x={51.5} y={95} width={9.5} height={14} rx={4.5} fill={url(p, 'pants')} />
    {shoe(1)}{shoe(-1)}
  </>);
}

function Torso({ p }: { p: Paint }) {
  return (<>
    <path d="M35 61 C37 52.5 63 52.5 65 61 C59 64.5 41 64.5 35 61 Z" style={{ fill: OUT_LO }} />
    <path d="M34 63 C34 59.6 37.8 57.8 42 57.8 L58 57.8 C62.2 57.8 66 59.6 66 63 L69.5 93 C70 97 67 100 63 100 L37 100 C33 100 30 97 30.5 93 Z" fill={url(p, 'outfit')} />
    <ellipse cx={50} cy={62.6} rx={8.5} ry={2.6} fill={p.skin[2]} opacity={0.55} />
    <path d="M40.5 83 L59.5 83 L62.5 94 L37.5 94 Z" style={{ fill: OUT_LO }} opacity={0.22} />
    <path d="M40.5 83 L59.5 83" style={{ stroke: OUT_LO }} strokeWidth={1} opacity={0.55} />
    <path d="M31 95.5 C44 97.5 56 97.5 69 95.5" style={{ stroke: OUT_LO }} strokeWidth={1.2} opacity={0.45} fill="none" />
    <path d="M37 67 C39 64 43 63 46 63.5" stroke={WHITE} strokeWidth={2} opacity={0.28} strokeLinecap="round" fill="none" />
    <path d="M46 63 L45.4 71" stroke={WHITE} strokeWidth={1.3} strokeLinecap="round" />
    <circle cx={45.3} cy={72} r={1.1} fill={WHITE} />
    <path d="M54 63 L54.6 71" stroke={WHITE} strokeWidth={1.3} strokeLinecap="round" />
    <circle cx={54.7} cy={72} r={1.1} fill={WHITE} />
  </>);
}

function Arm({ p, side }: { p: Paint; side: 'l' | 'r' }) {
  const l = side === 'l';
  const sx = l ? 35.5 : 64.5, ex = l ? 31 : 69, hx = l ? 30.6 : 69.4, tx = l ? 33.4 : 66.6;
  const cx = sx + 0.8 * (ex - sx), cy = 63 + 0.8 * 22; // where the cuff starts
  return (
    <g className={`cv-arm cv-arm-${side}`}>
      <path d={`M${sx} 63 L${ex} 85`} style={{ stroke: OUT }} strokeWidth={9} strokeLinecap="round" />
      <path d={`M${sx - 2.4} 64.5 L${ex - 2.4} 80`} stroke={WHITE} strokeWidth={1.6} opacity={0.25} strokeLinecap="round" />
      <path d={`M${cx} ${cy} L${ex} 85`} style={{ stroke: CUFF }} strokeWidth={9.4} strokeLinecap="round" />
      <circle cx={hx} cy={88.4} r={4.4} fill={url(p, 'skin')} />
      <ellipse cx={tx} cy={87.4} rx={1.6} ry={2.2} fill={url(p, 'skin')} />
    </g>
  );
}

type Eyes = 'open' | 'up' | 'closed' | 'happy' | 'heart';
function Eye({ cx, eyes, p }: { cx: number; eyes: Eyes; p: Paint }) {
  const y = EYE_Y, lash = p.lash, w = p.female ? 1.9 : 1.4, outer = cx < 50 ? -1 : 1;
  if (eyes === 'happy') return <path d={`M${cx - 5.6} ${y + 1.5} Q${cx} ${y - 5.5} ${cx + 5.6} ${y + 1.5}`} stroke={lash} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
  if (eyes === 'closed') return (<>
    <path d={`M${cx - 5.6} ${y} Q${cx} ${y + 4.6} ${cx + 5.6} ${y}`} stroke={lash} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    {p.female ? <path d={`M${cx + outer * 5.2} ${y + 0.8} l${outer * 1.8} 1.6`} stroke={lash} strokeWidth={1.4} strokeLinecap="round" /> : null}
  </>);
  if (eyes === 'heart') return (
    <g transform={`translate(${cx} ${y + 2}) scale(0.155)`}>
      <path d={HEART} fill={LOVE_EYES} /><ellipse cx={-14} cy={-14} rx={8} ry={10} fill={WHITE} opacity={0.85} />
    </g>
  );
  const dx = eyes === 'up' ? 1.4 : 0, dy = eyes === 'up' ? -1.6 : 0;
  return (<>
    <ellipse cx={cx} cy={y} rx={6.6} ry={7.4} fill={WHITE} />
    <path d={`M${cx - 6.4} ${y - 1.5} Q${cx} ${y - 8.8} ${cx + 6.4} ${y - 1.5} Q${cx} ${y - 5.2} ${cx - 6.4} ${y - 1.5} Z`} fill={p.skin[2]} opacity={0.22} />
    <ellipse cx={cx + dx} cy={y + 0.8 + dy} rx={5.2} ry={5.9} fill={url(p, 'iris')} />
    <ellipse cx={cx + dx} cy={y + 1 + dy} rx={2.6} ry={3} fill={mix(INK, 70, '#000000')} />
    <ellipse cx={cx - 1.9 + dx} cy={y - 1.6 + dy} rx={1.9} ry={2.2} fill={WHITE} />
    <circle cx={cx + 2 + dx} cy={y + 3 + dy} r={0.9} fill={WHITE} opacity={0.9} />
    <path d={`M${cx - 7} ${y - 1.2} Q${cx} ${y - 9.4} ${cx + 7} ${y - 1.2}`} stroke={lash} strokeWidth={w} strokeLinecap="round" fill="none" />
    {p.female ? <path d={`M${cx + outer * 6.6} ${y - 2} l${outer * 2.2} -1.6`} stroke={lash} strokeWidth={1.5} strokeLinecap="round" /> : null}
  </>);
}
const EyePair = ({ p, eyes, cls }: { p: Paint; eyes: Eyes; cls: string }) => (
  <g className={cls}><Eye cx={39.5} eyes={eyes} p={p} /><Eye cx={60.5} eyes={eyes} p={p} /></g>
);

/** The head with every face it can make: the CSS shows the one for the state or the moment. `still` draws one face. */
function Head({ p, still }: { p: Paint; still: Eyes | null }) {
  const front = p.female ? FEMALE_FRONT : MALE_FRONT, brow = p.female ? 1.8 : 2.3;
  const blush = (strong: boolean) => [32, 68].map(x => <ellipse key={x} cx={x} cy={50.5} rx={strong ? 7.4 : 6.2} ry={strong ? 4.4 : 3.7} fill={url(p, 'blush')} />);
  const smile = (<>
    <path d="M44.6 52.2 Q50 58.6 55.4 52.2 Q50 54 44.6 52.2 Z" fill={MOUTH} /><ellipse cx={50} cy={54.7} rx={2.2} ry={1} fill={TONGUE} />
  </>);
  return (<>
    {[23.6, 76.4].map(x => (
      <g key={x}>
        <ellipse cx={x} cy={40} rx={4.2} ry={5.4} fill={url(p, 'skin')} />
        <path d={x < 50 ? 'M23.6 37.4 q-1.6 2.6 0 5.2' : 'M76.4 37.4 q1.6 2.6 0 5.2'} stroke={p.skin[2]} strokeWidth={1.1} opacity={0.6} fill="none" strokeLinecap="round" />
      </g>
    ))}
    <path d={FACE} fill={url(p, 'skin')} />
    <path d={front} fill={p.skin[2]} opacity={0.3} transform="translate(0 2.2)" />
    {still ? blush(false) : (<><g className="cv-blush">{blush(false)}</g><g className="cv-blush2">{blush(true)}</g></>)}
    {still ? <EyePair p={p} eyes={still} cls="" /> : (<>
      <g className="cv-rest-e">
        <EyePair p={p} eyes="open" cls="cv-e-open" /><EyePair p={p} eyes="up" cls="cv-e-up" /><EyePair p={p} eyes="closed" cls="cv-e-closed" />
      </g>
      <EyePair p={p} eyes="happy" cls="cv-e-happy" /><EyePair p={p} eyes="heart" cls="cv-e-heart" />
    </>)}
    <path d="M33.5 31.8 Q38.5 29.2 44 31" stroke={p.hair[2]} strokeWidth={brow} strokeLinecap="round" fill="none" />
    <path className="cv-brow" d="M56 31 Q61.5 29.2 66.5 31.8" stroke={p.hair[2]} strokeWidth={brow} strokeLinecap="round" fill="none" />
    <ellipse cx={50} cy={48} rx={1.7} ry={1.1} fill={p.skin[2]} opacity={0.55} />
    <ellipse cx={49.4} cy={47.5} rx={0.6} ry={0.4} fill={WHITE} opacity={0.6} />
    {still ? smile : (<>
      <g className="cv-rest-m"><g className="cv-m-smile">{smile}</g><ellipse className="cv-m-o" cx={50} cy={54.2} rx={1.8} ry={2} fill={MOUTH} /></g>
      <g className="cv-m-big">
        <path d="M43.2 51.6 Q50 61 56.8 51.6 Q50 53.6 43.2 51.6 Z" fill={MOUTH} /><ellipse cx={50} cy={56.2} rx={2.8} ry={1.4} fill={TONGUE} />
      </g>
    </>)}
    <path d={front} fill={url(p, 'hair')} />
    {p.female ? (<>
      <path d="M50 6 C45 13 40 20 35 27" stroke={p.hair[2]} strokeWidth={1.1} opacity={0.45} fill="none" strokeLinecap="round" />
      <path d="M55 7 C52 14 49 21 45 29" stroke={p.hair[2]} strokeWidth={1.1} opacity={0.35} fill="none" strokeLinecap="round" />
      <path d="M30 16 C36 9.5 47 7.5 56 8.5" stroke={WHITE} strokeWidth={3} opacity={0.32} fill="none" strokeLinecap="round" />
      <path d="M60 9.8 C64 11 67 13 69 15.5" stroke={WHITE} strokeWidth={2.2} opacity={0.22} fill="none" strokeLinecap="round" />
      <path d={HEART} fill={CLIP} stroke={WHITE} strokeWidth={7} strokeLinejoin="round" transform="translate(68 18) rotate(18) scale(0.13)" />
    </>) : (<>
      <path d={MALE_QUIFF} fill={url(p, 'hair')} />
      <path d="M32 13 C38 20 45 24.5 52 23.5" stroke={p.hair[2]} strokeWidth={1.2} opacity={0.42} fill="none" strokeLinecap="round" />
      <path d="M46 7.5 C52.5 13.5 59.5 17.5 67 20.5" stroke={p.hair[2]} strokeWidth={1.2} opacity={0.36} fill="none" strokeLinecap="round" />
      <path d="M30.5 15 C36 8 46 5.6 55 6.2" stroke={WHITE} strokeWidth={2.8} opacity={0.3} fill="none" strokeLinecap="round" />
    </>)}
  </>);
}

/** What floats around: hearts (love), sparkles (cheer), a thought bubble (think), z's (sleepy). Shown by the CSS. */
function Extras({ flip }: { flip: boolean }) {
  return (<>
    <g className="cv-hearts">
      {[26, 52, 76].map((x, i) => (
        <g key={x} transform={`translate(${x} 10)`}>
          <g className={`cv-h cv-h${i}`}><path d={HEART} transform="scale(0.16)" style={{ fill: OUT }} stroke={WHITE} strokeWidth={6} strokeLinejoin="round" /></g>
        </g>
      ))}
    </g>
    <g className="cv-sparks">
      {[[4, 14], [90, 8], [48, -4]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}><g className={`cv-s cv-s${i}`}><path d={SPARKLE} fill={SPARK} transform="scale(0.9)" /></g></g>
      ))}
    </g>
    <g className="cv-think" transform={`translate(${flip ? 26 : 74} 2)`}>
      <rect x={flip ? -46 : 0} y={-12} width={46} height={22} rx={11} className="cv-bubble" />
      <circle cx={flip ? -2 : 2} cy={14} r={3} className="cv-bubble" />
      {[0, 1, 2].map(i => <circle key={i} className={`cv-dot cv-d${i}`} cx={(flip ? -46 : 0) + 14 + i * 9} cy={-1} r={3} />)}
    </g>
    <g className="cv-zs" transform={`translate(${flip ? 6 : 80} 8)`}>
      <path className="cv-z0" d="M0 0 h7 l-7 8 h7" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path className="cv-z1" d="M6 -12 h9 l-9 10 h9" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </>);
}

/** One character as a drawing: the picture shown until the 3D person is ready, and wherever WebGL isn't there. */
function CharacterSvg({ look, size, cls = '', state = 'idle', flip = false, still = false }: {
  look: AvatarLook; size: number; cls?: string; state?: CharState; flip?: boolean; still?: boolean;
}) {
  const id = 'cv' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = paint(id, look);
  const face: Eyes | null = still ? (state === 'think' ? 'up' : state === 'sleepy' ? 'closed' : 'open') : null;
  return (
    <svg className={`cv cv-${look.look} st-${state}${flip ? ' flip' : ''}${still ? ' still' : ''} ${still ? '' : cls}`.trim()}
      width={Math.round(size * CHAR_RATIO)} height={size} viewBox="0 0 100 120" aria-hidden="true" focusable="false">
      <Grads p={p} />
      <ellipse className="cv-ground" cx={50} cy={115.5} rx={25} ry={3.8} fill={url(p, 'ground')} />
      <g transform={flip ? 'matrix(-1 0 0 1 100 0)' : undefined}>
        <g className="cv-fig">
          <g className="cv-head"><BackHair p={p} /></g>
          <Legs p={p} />
          <Torso p={p} />
          <g className="cv-head"><Head p={p} still={face} /></g>
          <Arm p={p} side="l" />
          <Arm p={p} side="r" />
        </g>
      </g>
      {still ? null : <Extras flip={flip} />}
    </svg>
  );
}

/** One character: the realistic 3D person (lib/people.ts, drawn by lib/people3d.ts, loaded only when needed) over its
 *  drawing, which stays until the person is ready and is all there is without WebGL. A new `cls` (wave, hop, happy,
 *  cheer) plays that mood once; `state="think"` tilts the head. `still` stands still (lists and pickers). */
export function Character({ look, size, cls = '', state = 'idle', flip = false, still = false, half = false }: {
  look: AvatarLook; size: number; cls?: string; state?: CharState; flip?: boolean; still?: boolean; half?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), handle = useRef<Handle | null>(null), [ready, setReady] = useState(false);
  const who = personFor(look), w = Math.round(size * (half ? .64 : CHAR_RATIO)); // from the hips up: shoulders are narrower than a whole body's frame
  useEffect(() => {
    let gone = false; setReady(false);
    const el = canvas.current; if (!el) return;
    import('@/lib/people3d').then(m => m.mount(el, modelUrl(who), { w, h: size, flip, half }))
      .then(h => { if (gone) { h.destroy(); return; } handle.current = h; setReady(true); })
      .catch(() => { /* no WebGL, or the model didn't load: the drawing stays */ });
    return () => { gone = true; handle.current?.destroy(); handle.current = null; };
  }, [who.id, size, w, flip, half]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!still && cls) handle.current?.mood(cls); }, [cls, still, ready]);
  useEffect(() => { handle.current?.think(state === 'think'); }, [state, ready]);
  return (
    <span className={`p3d${ready ? ' ready' : ''}`} style={{ width: w, height: size }} data-person={who.id} aria-hidden="true">
      <CharacterSvg look={look} size={size} cls={cls} state={state} flip={flip} still={still} />
      <canvas ref={canvas} className="p3d-c" style={{ width: w, height: size }} />
    </span>
  );
}

/** Head and shoulders in a circle tinted with the person's colour (--c on a parent), for rows and headers: a photo
 *  of the 3D person (made from the same model), over the drawing in case the photo can't load. */
export function Portrait({ look, size }: { look: AvatarLook; size: number }) {
  const id = 'pt' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = paint(id, look), who = personFor(look);
  return (
    <span className="cv-portrait" style={{ width: size, height: size }} aria-hidden="true" data-person={who.id}>
      <svg width={size} height={size} viewBox="12 4 76 76" focusable="false">
        <Grads p={p} /><BackHair p={p} /><Torso p={p} /><Head p={p} still="open" />
      </svg>
      <img className="pt-photo" src={faceUrl(who)} alt="" width={size} height={size} decoding="async" draggable={false}
        onError={e => { e.currentTarget.hidden = true; }} />
    </span>
  );
}
