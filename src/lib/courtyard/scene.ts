/** Imperative game loop: no React updates while walking/looking, no background render loop. */
import * as T from 'three';
import { makeRenderer } from '../people3d';
import { reducedMotion } from '../util';
import { loadActor, type Actor } from './actor';
import { buildEnvironment } from './environment';
import { angleDelta, moveWithin, PLACES, route, SEATS, SPAWN, type Point, type PoseMode, type WorldPose } from './state';
import type { LocalPose } from './presence';

export type Place = keyof typeof PLACES;
export interface SceneReport { near: Place | null; sitting: boolean; canSit: boolean; ready: boolean; partnerReady: boolean }
export interface WorldScene {
  input(x: number, y: number): void; look(dx: number, dy: number): void; find(): void; bench(): void; wave(): void; sit(): void;
  peer(p: WorldPose | null): void; active(on: boolean): void; resize(w: number, h: number): void;
  photos(values: readonly (string | null)[]): void;
  pose(): LocalPose; destroy(): void;
}
interface AvatarSource { url: string; fallback: string; gender: 'm' | 'f' }
interface Options { slot: 0 | 1; me: AvatarSource; partner: AvatarSource; report(r: SceneReport): void; failure(): void }
export function mountWorld(canvas: HTMLCanvasElement, w: number, h: number, o: Options): WorldScene {
  const created = makeRenderer(canvas); if (!created) throw new Error('3D is unavailable');
  const renderer: T.WebGLRenderer = created;
  let invalidate = () => {};
  let environment: ReturnType<typeof buildEnvironment>;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(52, w / h, .08, 70);
  try { environment = buildEnvironment(scene, renderer, getComputedStyle(canvas), () => invalidate()); } catch (error) { renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); throw error; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const abort = new AbortController();
  let player: Actor | null = null, partner: Actor | null = null, livePeer: WorldPose | null = null;
  let position: Point = { ...SPAWN, x: o.slot === 0 ? -.7 : .7 }, yaw = Math.PI, sitting = false, standAt = { ...position }, waveUntil = 0;
  let movement = { x: 0, y: 0 }, path: Point[] = [], cameraYaw = 0, pitch = .35, size = { w, h };
  let active = true, inViewport = true, gone = false, frame = 0, last = 0, settling = 0, mode: PoseMode = 'idle', lastReport = '', rendered = 0, dpr = Math.min(1.5, devicePixelRatio || 1);
  let directLook = false, placementBlend = 0;
  const target = new T.Vector3(position.x, 1.05, position.z), eye = new T.Vector3(position.x, 2.65, position.z + 4.5);
  const nearPoint = new T.Vector3(), nextEye = new T.Vector3(), lookTarget = new T.Vector3(), offset = new T.Vector3();
  const cameraRay = new T.Ray(), house = new T.Box3(new T.Vector3(-7.2, 0, -6.4), new T.Vector3(-2.4, 3.6, -2.3)), hit = new T.Vector3();
  const restingSeat = SEATS[o.slot === 0 ? 1 : 0], ownSeat = SEATS[o.slot];
  const peerPosition = new T.Vector3(restingSeat.x, 0, restingSeat.z);
  const fail = () => { if (gone) return; stop(); o.failure(); };
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; movement = { x: 0, y: 0 }; path = []; }
  function nearest(): Place | null {
    let result: Place | null = null, distance = 2;
    for (const [name, p] of Object.entries(PLACES) as [Place, Point][]) {
      const at = name === 'partner' && livePeer ? livePeer : p, d = Math.hypot(position.x - at.x, position.z - at.z);
      if (d < distance) { result = name; distance = d; }
    }
    return result;
  }
  function report() {
    const value = { near: nearest(), sitting, canSit: Math.hypot(position.x - PLACES.partner.x, position.z - PLACES.partner.z) < 2, ready: !!player, partnerReady: !!partner }, key = JSON.stringify(value);
    if (key !== lastReport) { lastReport = key; o.report(value); }
  }
  function stand() { if (sitting) { sitting = false; position = { ...standAt }; settling = .4; placementBlend = .35; } }
  function tick(now: number) {
    frame = 0; if (gone || !active || !inViewport || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
    const reduced = reducedMotion.matches, inputLength = Math.hypot(movement.x, movement.y), old = { ...position };
    if (player && inputLength > .08) {
      stand(); path = [];
      const vx = movement.x / Math.max(1, inputLength), vz = movement.y / Math.max(1, inputLength);
      const dx = Math.cos(cameraYaw) * vx + Math.sin(cameraYaw) * vz, dz = -Math.sin(cameraYaw) * vx + Math.cos(cameraYaw) * vz;
      position = moveWithin(position, dx * 1.45 * dt, dz * 1.45 * dt);
    } else if (player && path.length) {
      stand(); const next = path[0], dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz), step = 1.45 * dt;
      position = moveWithin(position, dx / Math.max(distance, .001) * Math.min(distance, step), dz / Math.max(distance, .001) * Math.min(distance, step));
      if (Math.hypot(position.x - next.x, position.z - next.z) < .025) path.shift();
    }
    const dx = position.x - old.x, dz = position.z - old.z, walking = Math.hypot(dx, dz) > .0001 && !sitting;
    if (walking) yaw += angleDelta(yaw, Math.atan2(dx, dz)) * (reduced ? 1 : 1 - Math.exp(-dt * 12));
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    mode = sitting ? 'sit' : walking ? 'walk' : now < waveUntil ? 'wave' : 'idle';
    if (player) {
      nearPoint.set(position.x, 0, position.z); player.holder.position.lerp(nearPoint, !reduced && placementBlend > 0 ? 1 - Math.exp(-dt * 18) : 1); player.holder.rotation.y = yaw;
      player.mode(mode, reduced); player.update(dt, reduced);
    }
    const peerAt = livePeer || { ...restingSeat, yaw: 0, mode: 'sit' as const };
    peerPosition.set(peerAt.x, 0, peerAt.z);
    let peerBusy = false;
    if (partner) {
      peerBusy = partner.holder.position.distanceTo(peerPosition) > .015;
      partner.holder.position.lerp(peerPosition, reduced || partner.holder.position.distanceTo(peerPosition) > 3 ? 1 : 1 - Math.exp(-dt * 12));
      partner.holder.rotation.y += angleDelta(partner.holder.rotation.y, peerAt.yaw) * (reduced ? 1 : 1 - Math.exp(-dt * 12));
      partner.mode(peerAt.mode === 'wave' ? 'wave' : peerAt.mode === 'sit' ? 'sit' : peerBusy ? 'walk' : 'idle', reduced); partner.update(dt, reduced);
    }
    lookTarget.set(position.x, 1.05, position.z); target.lerp(lookTarget, reduced ? 1 : 1 - Math.exp(-dt * 10));
    offset.set(Math.sin(cameraYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cameraYaw) * Math.cos(pitch)).multiplyScalar(4.8);
    nextEye.copy(target).add(offset); cameraRay.set(target, offset.clone().normalize());
    if (cameraRay.intersectBox(house, hit) && hit.distanceTo(target) < offset.length()) nextEye.copy(hit).addScaledVector(cameraRay.direction, -.22);
    nextEye.y = Math.max(1.1, nextEye.y); eye.lerp(nextEye, reduced || directLook ? 1 : 1 - Math.exp(-dt * 12));
    nearPoint.copy(eye).sub(target); const eyeDistance = nearPoint.length(); cameraRay.set(target, nearPoint.normalize());
    if (cameraRay.intersectBox(house, hit) && hit.distanceTo(target) < eyeDistance) eye.copy(hit).addScaledVector(cameraRay.direction, -.22);
    directLook = false; placementBlend = Math.max(0, placementBlend - dt); camera.position.copy(eye); camera.lookAt(target); camera.updateMatrixWorld();
    try { renderer.render(scene, camera); } catch { fail(); return; }
    rendered++; canvas.dataset.frames = String(rendered); canvas.dataset.x = position.x.toFixed(3); canvas.dataset.z = position.z.toFixed(3); canvas.dataset.mode = mode;
    canvas.dataset.cameraYaw = cameraYaw.toFixed(3);
    canvas.dataset.peerX = peerPosition.x.toFixed(3); canvas.dataset.peerZ = peerPosition.z.toFixed(3); canvas.dataset.peer = livePeer ? 'live' : 'resting';
    canvas.dataset.drawCalls = String(renderer.info.render.calls); canvas.dataset.triangles = String(renderer.info.render.triangles);
    report(); settling = Math.max(0, settling - dt);
    const cameraBusy = eye.distanceTo(nextEye) > .003 || target.distanceTo(lookTarget) > .003;
    if (walking || peerBusy || inputLength > .08 || path.length || cameraBusy || now < waveUntil || settling > 0) wake(); else last = 0;
  }
  function wake() { if (!frame && !gone && active && inViewport && !document.hidden) frame = requestAnimationFrame(tick); }
  invalidate = () => { settling = .1; wake(); };
  function resize(nw: number, nh: number) { size = { w: Math.max(1, nw), h: Math.max(1, nh) }; renderer.setPixelRatio(dpr); renderer.setSize(size.w, size.h, false); camera.aspect = size.w / size.h; camera.updateProjectionMatrix(); wake(); }
  const lost = (event: Event) => { event.preventDefault(); fail(); };
  canvas.addEventListener('webglcontextlost', lost);
  const visibility = () => { if (document.hidden) stop(); else { settling = .3; wake(); } };
  document.addEventListener('visibilitychange', visibility);
  const seen = new IntersectionObserver(es => { inViewport = es[es.length - 1].isIntersecting; if (inViewport) wake(); else stop(); }); seen.observe(canvas);
  const motion = () => { settling = .3; wake(); }, motionMedia = matchMedia('(prefers-reduced-motion: reduce)'); motionMedia.addEventListener('change', motion);
  resize(w, h);
  const tasks = [o.me, o.partner].map(async (person, index) => {
    try {
      const actor = await loadActor(person.url, person.gender, abort.signal).catch(error => {
        if (abort.signal.aborted || person.url === person.fallback) throw error;
        return loadActor(person.fallback, person.gender, abort.signal);
      });
      if (gone) { actor.destroy(); return; }
      scene.add(actor.holder);
      if (index === 0) { player = actor; actor.holder.position.set(position.x, 0, position.z); }
      else { partner = actor; actor.holder.position.copy(peerPosition); }
      settling = .4; report(); wake();
    } catch { if (!gone && index === 0) fail(); }
  });
  void Promise.all(tasks);
  return {
    input(x, y) { movement = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }; settling = .35; wake(); },
    look(dx, dy) { cameraYaw -= dx * .006; pitch = Math.max(.08, Math.min(.85, pitch + dy * .004)); directLook = true; settling = .35; wake(); },
    find() { if (!player) return; stand(); const p = livePeer && livePeer.mode !== 'sit' ? livePeer : PLACES.partner, d = Math.hypot(position.x - p.x, position.z - p.z); const approach = livePeer && livePeer.mode !== 'sit' && d > 1 ? { x: p.x + (position.x - p.x) / d * .8, z: p.z + (position.z - p.z) / d * .8 } : p; path = route(position, approach); settling = .4; wake(); },
    bench() { if (!player) return; stand(); path = route(position, PLACES.partner); settling = .4; wake(); },
    wave() { if (!player || reducedMotion.matches) return; waveUntil = performance.now() + 1300; settling = 1.6; wake(); },
    sit() { if (!player) return; if (sitting) stand(); else if (Math.hypot(position.x - PLACES.partner.x, position.z - PLACES.partner.z) < 2) { standAt = { ...position }; position = { ...ownSeat }; yaw = 0; sitting = true; path = []; placementBlend = .35; } settling = .5; report(); wake(); },
    peer(p) { const changed = !!p !== !!livePeer || (p && livePeer && (p.x !== livePeer.x || p.z !== livePeer.z || p.yaw !== livePeer.yaw || p.mode !== livePeer.mode)); livePeer = p; if (changed) { settling = .4; wake(); } },
    active(on) { active = on; if (!on) stop(); else { settling = .4; wake(); } },
    resize,
    photos(values) { if (!gone) environment.photos(values, () => { settling = .1; wake(); }); },
    pose() { return { ...position, yaw, mode: sitting ? 'sit' : mode }; },
    destroy() { if (gone) return; gone = true; stop(); abort.abort(); seen.disconnect(); document.removeEventListener('visibilitychange', visibility); motionMedia.removeEventListener('change', motion); canvas.removeEventListener('webglcontextlost', lost); player?.destroy(); partner?.destroy(); environment.dispose(); renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); },
  };
}
