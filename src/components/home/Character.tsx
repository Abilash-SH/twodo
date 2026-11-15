/* Twodo · the six characters (original, drawn for Twodo; design.md, "Characters"). Body in the person's colour (--c),
   a lighter tummy or face, a darker edge; dark eyes. Still by default: `hop` and `wave` play once (under 1.2 s), and
   not at all with Reduce Motion. Drawn in a 100 x 100 box, feet at the bottom. */
import type { CharKind } from '@/lib/types';

const INK = '#1B1730';
function Face({ x, y, sleepy, wink }: { x: number; y: number; sleepy?: boolean; wink?: boolean }) {
  const e = 9;
  return (
    <g>
      {sleepy ? <path d={`M${x - e - 3.5} ${y} q3.5 3 7 0 M${x + e - 3.5} ${y} q3.5 3 7 0`} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        : <>
          <ellipse cx={x - e} cy={y} rx="2.9" ry="3.6" fill={INK} /><circle cx={x - e + 1} cy={y - 1.4} r="1" fill="#fff" />
          {wink ? <path d={`M${x + e - 3.5} ${y} q3.5 -3 7 0`} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            : <><ellipse cx={x + e} cy={y} rx="2.9" ry="3.6" fill={INK} /><circle cx={x + e + 1} cy={y - 1.4} r="1" fill="#fff" /></>}
        </>}
      <ellipse cx={x - e - 5} cy={y + 6} rx="4.2" ry="2.6" fill="#FF8FA8" opacity=".55" />
      <ellipse cx={x + e + 5} cy={y + 6} rx="4.2" ry="2.6" fill="#FF8FA8" opacity=".55" />
      <path d={`M${x - 3.5} ${y + 6} q3.5 3.6 7 0`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Body({ kind }: { kind: CharKind }) {
  switch (kind) {
    case 'bun': return (<>
      <circle className="cr-c" cx="30" cy="30" r="10" /><circle className="cr-c" cx="70" cy="30" r="10" />
      <circle className="cr-l" cx="30" cy="30" r="5" /><circle className="cr-l" cx="70" cy="30" r="5" />
      <ellipse className="cr-c" cx="50" cy="62" rx="37" ry="32" /><ellipse className="cr-l" cx="50" cy="68" rx="25" ry="20" />
      <Face x={50} y={60} /></>);
    case 'sprout': return (<>
      <path d="M50 30 q-2 -12 -14 -16 q-2 12 14 16z" fill="#6DBB7B" /><path d="M50 30 q2 -14 16 -18 q2 14 -16 18z" fill="#82CC8E" />
      <path className="cr-c" d="M50 30 C 82 30 90 64 84 78 C 78 94 22 94 16 78 C 10 64 18 30 50 30z" />
      <ellipse className="cr-l" cx="50" cy="70" rx="24" ry="17" /><Face x={50} y={62} /></>);
    case 'pebble': return (<>
      <path className="cr-c" d="M14 72 C 14 44 34 38 52 38 C 74 38 88 48 88 70 C 88 90 70 94 50 94 C 30 94 14 90 14 72z" />
      <ellipse cx="38" cy="50" rx="10" ry="5" fill="#fff" opacity=".35" transform="rotate(-18 38 50)" /><Face x={51} y={66} sleepy /></>);
    case 'puff': return (<>
      <circle className="cr-c" cx="32" cy="64" r="20" /><circle className="cr-c" cx="52" cy="48" r="24" /><circle className="cr-c" cx="70" cy="64" r="20" />
      <rect className="cr-c" x="22" y="60" width="58" height="32" rx="16" /><ellipse className="cr-l" cx="51" cy="72" rx="22" ry="14" /><Face x={51} y={64} /></>);
    case 'bolt': return (<>
      <path className="cr-ds" d="M50 22 v-10" strokeWidth="3" /><circle cx="50" cy="10" r="5" fill="#FFC857" />
      <rect className="cr-c" x="16" y="22" width="68" height="70" rx="20" /><rect className="cr-l" x="25" y="34" width="50" height="38" rx="13" /><Face x={50} y={53} /></>);
    default: return (<>
      <path className="cr-c" d="M50 14 C 64 34 86 52 86 70 C 86 86 70 94 50 94 C 30 94 14 86 14 70 C 14 52 36 34 50 14z" />
      <path d="M36 56 q4 -10 12 -16" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".5" />
      <ellipse className="cr-l" cx="50" cy="76" rx="22" ry="12" /><Face x={50} y={68} wink /></>);
  }
}

/** One character. `cls` adds `hop` or `wave` to play that once. */
export function Character({ kind, size, cls = '' }: { kind: CharKind; size: number; cls?: string }) {
  return (
    <svg className={`cr cr-${kind} ${cls}`.trim()} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <ellipse className="cr-shadow" cx="50" cy="98" rx="30" ry="4" />
      <g className="cr-fig">
        <ellipse className="cr-d" cx="38" cy="95" rx="8" ry="4.5" /><ellipse className="cr-d" cx="62" cy="95" rx="8" ry="4.5" />
        <path className="cr-arm" d="M16 64 q-8 8 -4 16" />
        <g className="cr-wave"><path className="cr-arm" d="M84 64 q8 8 4 16" /></g>
        <Body kind={kind} />
      </g>
    </svg>
  );
}
