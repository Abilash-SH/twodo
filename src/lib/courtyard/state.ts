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
  garden: SPAWN, villa: { x: -5.1, z: -4.7 }, garage: { x: 4.9, z: -5.05 },
};
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
];
export function walkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 9 && Math.abs(z) < 8
    && !SOLIDS.some(b => Math.abs(x - b.x) < b.w / 2 + .25 && Math.abs(z - b.z) < b.d / 2 + .25)
    && ((x - FOUNTAIN.x) / FOUNTAIN.rx) ** 2 + ((z - FOUNTAIN.z) / FOUNTAIN.rz) ** 2 > 1
    && !PLAZA_FIXTURES.some(t => Math.hypot(x - t.x, z - t.z) < .6);
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
const STEP = .4, HALF = 24, SIZE = 49;
const point = (id: number): Point => ({ x: (id % SIZE - HALF) * STEP, z: (Math.floor(id / SIZE) - HALF) * STEP });
function nearest(p: Point): number {
  let best = -1, dist = Infinity;
  for (let id = 0; id < SIZE * SIZE; id++) { const q = point(id), d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d < dist && walkable(q.x, q.z)) { best = id; dist = d; } }
  return best;
}
/** A bounded A* route. Diagonals cannot cut through an obstacle's corner. */
export function route(from: Point, to: Point): Point[] {
  if (![from.x, from.z, to.x, to.z].every(Number.isFinite)) return [];
  const first = nearest(from), goal = nearest(to); if (first < 0 || goal < 0) return [];
  const open = new Set([first]), came = new Map<number, number>(), cost = new Map([[first, 0]]);
  const h = (id: number) => Math.hypot(id % SIZE - goal % SIZE, Math.floor(id / SIZE) - Math.floor(goal / SIZE));
  for (let count = 0; open.size && count < SIZE * SIZE; count++) {
    let current = -1, best = Infinity;
    for (const id of open) { const f = cost.get(id)! + h(id); if (f < best) { current = id; best = f; } }
    if (current === goal) { const ids = [current]; while (came.has(ids[ids.length - 1])) ids.push(came.get(ids[ids.length - 1])!); return ids.reverse().map(point); }
    open.delete(current);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = current % SIZE + dx, z = Math.floor(current / SIZE) + dz;
      if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) continue;
      const next = z * SIZE + x, p = point(next);
      if (!walkable(p.x, p.z)) continue;
      if (dx && dz) { const a = point(current + dx), b = point(current + dz * SIZE); if (!walkable(a.x, a.z) || !walkable(b.x, b.z)) continue; }
      const n = cost.get(current)! + Math.hypot(dx, dz);
      if (n < (cost.get(next) ?? Infinity)) { cost.set(next, n); came.set(next, current); open.add(next); }
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
