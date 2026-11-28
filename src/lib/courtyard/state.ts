/** Virtual metres only. This module has no React, storage or network dependencies. */
export interface Point { x: number; z: number }
export type PoseMode = 'idle' | 'walk' | 'sit' | 'wave';
export const GESTURES = ['wave', 'clap', 'cheer'] as const;
export type WorldGesture = typeof GESTURES[number];
export interface WorldPose extends Point { v: 1; session: string; seq: number; t: number; yaw: number; mode: PoseMode; gesture?: WorldGesture }
export interface WorldEnvelope { u: number; d: string }
export const LEASE_MS = 12000;
export const SPAWN: Point = { x: 0, z: 5.4 };
export const BENCH: Point = { x: 4.2, z: 2.6 };
export const SEATS = [{ x: 3.65, z: 2.6 }, { x: 4.75, z: 2.6 }];
export const FOUNTAIN = { x: .2, z: -.6, rx: 2.05, rz: 1.6 };
export const MOMENTS_KIOSK = { x: 7.85, z: -2 };
export const TASK_TERMINAL = { x: -7.5, z: 5.3 };
export const PLAZA_FIXTURES: Point[] = [{ x: -7.6, z: 1 }, TASK_TERMINAL, MOMENTS_KIOSK, { x: 6.9, z: 5.8 }, { x: -.5, z: -7 }, { x: 8.4, z: -6.8 }];
export interface Solid extends Point { w: number; d: number; h: number }
export interface Room { minX: number; maxX: number; back: number; front: number; doorLeft: number; doorRight: number }
export const ROOMS = {
  villa: { minX: -7.65, maxX: -2.45, back: -7.1, front: -2.55, doorLeft: -5.95, doorRight: -4.25 },
  garage: { minX: 2.4, maxX: 7.45, back: -7.25, front: -3.65, doorLeft: 3.25, doorRight: 6.6 },
} satisfies Record<string, Room>;
export type RoomName = keyof typeof ROOMS;
export const WALL_HEIGHT = 2.8;
const wall = (x: number, z: number, w: number, d: number): Solid => ({ x, z, w, d, h: WALL_HEIGHT });
export function walls(room: Room): Solid[] {
  const { minX, maxX, back, front, doorLeft, doorRight } = room;
  return [
    wall((minX + maxX) / 2, back, maxX - minX, .18),
    wall(minX, (back + front) / 2, .18, front - back),
    wall(maxX, (back + front) / 2, .18, front - back),
    wall((minX + doorLeft) / 2, front, doorLeft - minX, .18),
    wall((doorRight + maxX) / 2, front, maxX - doorRight, .18),
  ];
}
export function areaAt(x: number, z: number): RoomName | 'garden' {
  for (const [name, room] of Object.entries(ROOMS) as [RoomName, Room][]) {
    if (x > room.minX && x < room.maxX && z > room.back && z < room.front) return name;
  }
  return 'garden';
}
export const PLACES = {
  partner: { x: 4.2, z: 3.9 }, tasks: { x: -4.6, z: 3.5 }, moments: { x: 6.65, z: -1.55 },
  journal: { x: -3.7, z: -5.8 }, workbench: { x: 5.55, z: -5.8 },
};
export const DESTINATIONS = {
  garden: SPAWN, villa: { x: -5.1, z: -4.7 }, garage: { x: 4.9, z: -5.05 }, lake: { x: -15.2, z: 2.2 },
};
/** Where you can walk outdoors (2026-11-28): the plaza as before, a lakeside promenade to the west, and walks along
 *  the streets to the south and east. Poses outside the plaza are only understood by this version onwards. */
export const REGIONS = [
  { minX: -9, maxX: 9, minZ: -8, maxZ: 8 },
  { minX: -19.3, maxX: -8.9, minZ: -7.6, maxZ: 13.3 },
  { minX: -19.3, maxX: 12.2, minZ: 7.9, maxZ: 13.3 },
  { minX: 8.9, maxX: 12.2, minZ: -7.6, maxZ: 13.3 },
] as const; // each overlaps the plaza a little, so its edge is never a gap
/** the railing above the lake, and the far side of the walks (the street kerbs) */
export const LAKE_EDGE = -19.65, SOUTH_KERB = 13.55, EAST_KERB = 12.45;
/** trees in planters and benches looking over the lake; lamp posts are thin and kept apart like plaza fixtures */
export const TREES: Point[] = [
  { x: -11.8, z: -5.4 }, { x: -11.8, z: -1.2 }, { x: -11.8, z: 3 }, { x: -11.8, z: 7.2 }, { x: -11.8, z: 11.4 },
  { x: -17.3, z: -3.6 }, { x: -17.3, z: .6 }, { x: -17.3, z: 4.8 }, { x: -17.3, z: 9 },
  { x: -6, z: 12.4 }, { x: 1, z: 12.4 }, { x: 8, z: 12.4 }, { x: 11.4, z: -5 }, { x: 11.4, z: 1.5 }, { x: 11.4, z: 8 },
];
export const LAKE_BENCHES: Point[] = [{ x: -18.75, z: -1.4 }, { x: -18.75, z: 7 }];
export const STREET_LAMPS: Point[] = [
  { x: -14.4, z: -6.2 }, { x: -14.4, z: -.6 }, { x: -14.4, z: 5 }, { x: -14.4, z: 10.6 },
  { x: -10.4, z: 12.9 }, { x: -2.5, z: 12.9 }, { x: 4.5, z: 12.9 }, { x: 11.9, z: 12.9 }, { x: 11.9, z: -1.8 },
];
/** a resident who stands at the railing taking photos of the lake */
export const PHOTOGRAPHER: Point = { x: -18.85, z: 2.9 };
/** buildings around the walks: only the camera uses them (it never ends up inside one) */
export const BUILDINGS: Solid[] = [
  { x: -16, z: -12.4, w: 5.3, d: 5, h: 8.7 }, { x: -9.7, z: -14.6, w: 4.9, d: 4.7, h: 12.9 }, { x: -4.6, z: -13.9, w: 3.7, d: 4.4, h: 8.5 },
  { x: .15, z: -17.5, w: 4.7, d: 5, h: 16.2 }, { x: 4.85, z: -14.8, w: 4, d: 4.8, h: 10.6 }, { x: 10, z: -14.2, w: 4.6, d: 4.9, h: 13 },
  { x: 19, z: -11, w: 5, d: 5, h: 14 }, { x: 19.2, z: -3, w: 5, d: 5.5, h: 10 }, { x: 19.5, z: 5, w: 5, d: 5, h: 16 }, { x: 19, z: 13, w: 5, d: 4.5, h: 11 },
  { x: -14.5, z: 21, w: 5.2, d: 4.4, h: 9.5 }, { x: -8, z: 20, w: 4.9, d: 4.1, h: 11.3 }, { x: -1, z: 21.5, w: 4.4, d: 5, h: 8.6 }, { x: 6, z: 20.5, w: 5.5, d: 4.7, h: 12.5 },
  { x: 13, z: 21, w: 4.8, d: 4.4, h: 15 },
];
export type Outdoor = 'plaza' | 'lake' | 'south' | 'east';
/** which part of the city a point outdoors is in */
export function outdoorAt(x: number, z: number): Outdoor {
  if (x < -9.2) return 'lake';
  if (x > 9.2 && z < 8.2) return 'east';
  return z > 8.2 ? 'south' : 'plaza';
}
export const FURNITURE = {
  sofa: { x: -6.8, z: -5.85, w: .89, d: 1.9, h: .85 },
  desk: { x: -3.22, z: -6.48, w: 1.15, d: .76, h: .82 },
  workbench: { x: 5.55, z: -6.73, w: 2.3, d: .72, h: .94 },
  boxes: { x: 3.14, z: -6.5, w: .8, d: .8, h: .8 },
} satisfies Record<string, Solid>;
export const SOLIDS: Solid[] = [
  ...Object.values(ROOMS).flatMap(walls),
  ...Object.values(FURNITURE),
  { ...BENCH, w: 2.7, d: .85, h: 1.1 },
  ...TREES.map(t => ({ ...t, w: 1.15, d: 1.15, h: .55 })),
  ...LAKE_BENCHES.map(b => ({ ...b, w: .7, d: 1.9, h: .9 })),
  { ...PHOTOGRAPHER, w: .55, d: .55, h: 1.7 },
];
export function walkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z)
    && REGIONS.some(r => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)
    && !SOLIDS.some(b => Math.abs(x - b.x) < b.w / 2 + .25 && Math.abs(z - b.z) < b.d / 2 + .25)
    && ((x - FOUNTAIN.x) / FOUNTAIN.rx) ** 2 + ((z - FOUNTAIN.z) / FOUNTAIN.rz) ** 2 > 1
    && !PLAZA_FIXTURES.some(t => Math.hypot(x - t.x, z - t.z) < .6)
    && !STREET_LAMPS.some(t => Math.hypot(x - t.x, z - t.z) < .4);
}
export const angleDelta = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function moveWithin(p: Point, dx: number, dz: number): Point {
  // Substeps also protect long/coalesced frames from tunnelling through a trunk or wall.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  let { x, z } = p;
  for (let i = 0; i < steps; i++) {
    if (walkable(x + dx / steps, z)) x += dx / steps;
    if (walkable(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}

/** Consume the full movement budget, including when a frame crosses a route waypoint. */
export function followRoute(position: Point, path: Point[], metres: number): Point {
  while (path.length && metres > 0) {
    const next = path[0];
    const dx = next.x - position.x, dz = next.z - position.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, metres);
    if (distance) position = moveWithin(position, dx / distance * step, dz / distance * step);
    if (Math.hypot(next.x - position.x, next.z - position.z) >= .025) break;
    path.shift();
    metres -= step;
  }
  return position;
}
// The route grid covers every walkable region at 40 cm, with the plaza's points exactly where they were.
const STEP = .4, X0 = -20, Z0 = -8.4, NX = 84, NZ = 56, CELLS = NX * NZ;
const point = (id: number): Point => ({ x: +(X0 + (id % NX) * STEP).toFixed(2), z: +(Z0 + Math.floor(id / NX) * STEP).toFixed(2) });
let open: Uint8Array | null = null;
function walkableCells(): Uint8Array {
  if (!open) { open = new Uint8Array(CELLS); for (let id = 0; id < CELLS; id++) { const p = point(id); open[id] = walkable(p.x, p.z) ? 1 : 0; } }
  return open;
}
function nearest(p: Point): number {
  const cells = walkableCells();
  let best = -1, dist = Infinity;
  for (let id = 0; id < CELLS; id++) { if (!cells[id]) continue; const q = point(id), d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d < dist) { best = id; dist = d; } }
  return best;
}
/** A bounded A* route over a binary heap. Diagonals cannot cut through an obstacle's corner. */
export function route(from: Point, to: Point): Point[] {
  if (![from.x, from.z, to.x, to.z].every(Number.isFinite)) return [];
  const cells = walkableCells(), first = nearest(from), goal = nearest(to); if (first < 0 || goal < 0) return [];
  const cost = new Float64Array(CELLS).fill(Infinity), came = new Int32Array(CELLS).fill(-1), done = new Uint8Array(CELLS);
  const gx = goal % NX, gz = Math.floor(goal / NX);
  const h = (id: number) => Math.hypot(id % NX - gx, Math.floor(id / NX) - gz);
  const heap: number[] = [], f = new Float64Array(CELLS);
  const push = (id: number) => { heap.push(id); let i = heap.length - 1; while (i > 0) { const up = (i - 1) >> 1; if (f[heap[up]] <= f[id]) break; heap[i] = heap[up]; i = up; } heap[i] = id; };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; const fm = () => f[m === i ? last : heap[m]];
    if (l < heap.length && f[heap[l]] < fm()) m = l; if (r < heap.length && f[heap[r]] < fm()) m = r; if (m === i) break; heap[i] = heap[m]; i = m; } heap[i] = last; } return top; };
  cost[first] = 0; f[first] = h(first); push(first);
  while (heap.length) {
    const current = pop();
    if (done[current]) continue;
    done[current] = 1;
    if (current === goal) { const ids = [current]; while (came[ids[ids.length - 1]] >= 0) ids.push(came[ids[ids.length - 1]]); return ids.reverse().map(point); }
    const cx = current % NX, cz = Math.floor(current / NX);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
      const next = z * NX + x;
      if (!cells[next] || done[next]) continue;
      if (dx && dz && (!cells[current + dx] || !cells[current + dz * NX])) continue;
      const n = cost[current] + Math.hypot(dx, dz);
      if (n < cost[next]) { cost[next] = n; came[next] = current; f[next] = n + h(next); push(next); }
    }
  }
  return [];
}
export function cleanPose(raw: unknown): WorldPose | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  if (q.v !== 1 || typeof q.session !== 'string' || !/^[0-9a-f]{16}$/.test(q.session)
    || !Number.isSafeInteger(q.seq) || (q.seq as number) < 1 || !['idle', 'walk', 'sit', 'wave'].includes(q.mode as string)
    || ![q.x, q.z, q.yaw, q.t].every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  const { x, z, yaw, t } = q as unknown as WorldPose;
  if (Math.abs(yaw) > Math.PI || t < 1 || t > 8.64e15) return null;
  if (q.mode === 'sit' ? !SEATS.some(p => Math.hypot(p.x - x, p.z - z) < .08) : !walkable(x, z)) return null;
  const gesture = q.mode === 'wave' && GESTURES.find(value => value === q.gesture);
  return { v: 1, session: q.session, seq: q.seq as number, t, x, z, yaw, mode: q.mode as PoseMode, ...(gesture ? { gesture } : {}) };
}
export function cleanEnvelope(raw: unknown): WorldEnvelope | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  return typeof q.u === 'number' && Number.isFinite(q.u) && q.u > 0 && typeof q.d === 'string'
    && q.d.length >= 40 && q.d.length <= 1024 && /^[A-Za-z0-9+/]+=*$/.test(q.d) ? { u: q.u, d: q.d } : null;
}
