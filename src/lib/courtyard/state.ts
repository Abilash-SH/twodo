/** Virtual metres only. This module has no React, storage or network dependencies. */
export interface Point { x: number; z: number }
export type PoseMode = 'idle' | 'walk' | 'sit' | 'wave';
export interface WorldPose extends Point { v: 1; session: string; seq: number; t: number; yaw: number; mode: PoseMode }
export interface WorldEnvelope { u: number; d: string }
export const LEASE_MS = 12000;
export const SPAWN: Point = { x: 0, z: 5.4 };
export const BENCH: Point = { x: 4.2, z: 2.6 };
export const SEATS = [{ x: 3.65, z: 2.6 }, { x: 4.75, z: 2.6 }];
export const TREES: Point[] = [{ x: -7.6, z: 1 }, { x: -7.5, z: 5.3 }, { x: 7.1, z: -2 }, { x: 6.9, z: 5.8 }, { x: -.5, z: -7 }, { x: 3.6, z: -6.4 }];
export const PLACES = {
  partner: { x: 4.2, z: 3.9 }, tasks: { x: -4.6, z: 3.5 }, moments: { x: 4.4, z: -3.2 }, journal: { x: -2.7, z: -1.5 },
};
const boxes = [{ x: -4.8, z: -4.5, w: 4.4, d: 3.4 }, { ...BENCH, w: 2.7, d: .85 }, { x: -2.7, z: -2.6, w: 1.5, d: .8 }];
export function walkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 9 && Math.abs(z) < 8
    && !boxes.some(b => Math.abs(x - b.x) < b.w / 2 + .25 && Math.abs(z - b.z) < b.d / 2 + .25)
    && ((x - .2) / 2.05) ** 2 + ((z + .6) / 1.6) ** 2 > 1
    && !TREES.some(t => Math.hypot(x - t.x, z - t.z) < .6);
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
  return { v: 1, session: q.session, seq: q.seq as number, t, x, z, yaw, mode: q.mode as PoseMode };
}
export function cleanEnvelope(raw: unknown): WorldEnvelope | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  return typeof q.u === 'number' && Number.isFinite(q.u) && q.u > 0 && typeof q.d === 'string'
    && q.d.length >= 40 && q.d.length <= 1024 && /^[A-Za-z0-9+/]+=*$/.test(q.d) ? { u: q.u, d: q.d } : null;
}
