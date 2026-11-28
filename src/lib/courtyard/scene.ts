/** Imperative game loop: no React updates while walking/looking, no background render loop. */
import * as T from 'three';
import { makeRenderer } from '../people3d';
import { reducedMotion } from '../util';
import { loadActor, type Actor } from './actor';
import { buildEnvironment } from './environment';
import { angleDelta, areaAt, DESTINATIONS, followRoute, moveWithin, PLACES, route, SEATS, SOLIDS, SPAWN, type Point, type PoseMode, type WorldGesture, type WorldPose } from './state';
import type { LocalPose } from './presence';

export type Place = keyof typeof PLACES;
export interface SceneReport { near: Place | null; area: keyof typeof DESTINATIONS; portrait: boolean; sitting: boolean; canSit: boolean; ready: boolean; partnerReady: boolean }
export interface WorldScene {
  input(x: number, y: number): void; look(dx: number, dy: number): void; find(): void; bench(): void; react(gesture: WorldGesture): void; sit(): void;
  visit(place: keyof typeof DESTINATIONS): void; viewAvatar(): void;
  peer(p: WorldPose | null): void; active(on: boolean): void; resize(w: number, h: number): void;
  photos(values: readonly (string | null)[]): void;
  pose(): LocalPose; destroy(): void;
}
interface AvatarSource { urls: readonly string[]; gender: 'm' | 'f' }
interface Options { slot: 0 | 1; me: AvatarSource; partner: AvatarSource; report(r: SceneReport): void; failure(): void }
const OUTDOOR_LOOK_LIFT = .86;
export function mountWorld(canvas: HTMLCanvasElement, w: number, h: number, o: Options): WorldScene {
  const created = makeRenderer(canvas); if (!created) throw new Error('3D is unavailable');
  const renderer: T.WebGLRenderer = created;
  let invalidate = () => {};
  let environment: ReturnType<typeof buildEnvironment>;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(52, w / h, .08, 70);
  try { environment = buildEnvironment(scene, getComputedStyle(canvas)); } catch (error) { renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); throw error; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const abort = new AbortController();
  let player: Actor | null = null, partner: Actor | null = null, livePeer: WorldPose | null = null;
  let position: Point = { ...SPAWN, x: o.slot === 0 ? -.7 : .7 }, yaw = Math.PI, sitting = false, standAt = { ...position }, waveUntil = 0;
  let movement = { x: 0, y: 0 }, path: Point[] = [], cameraYaw = 0, pitch = .22, size = { w, h };
  let active = true, inViewport = true, gone = false, frame = 0, last = 0, settling = 0, mode: PoseMode = 'idle', lastReport = '', rendered = 0, dpr = Math.min(1.5, devicePixelRatio || 1);
  let directLook = false, placementBlend = 0;
  let gesture: WorldGesture = 'wave', peerGesture: WorldGesture = 'wave';
  let reactionLeft = 0, peerReactionLeft = 0;
  let portrait = false, room = areaAt(position.x, position.z), portraitYaw = 0;
  const target = new T.Vector3(position.x, 1.25, position.z), eye = new T.Vector3(position.x, 2.3, position.z + 4.6);
  const nearPoint = new T.Vector3(), nextEye = new T.Vector3(), lookTarget = new T.Vector3(), offset = new T.Vector3();
  const aim = new T.Vector3();
  let skylineLift = OUTDOOR_LOOK_LIFT;
  const portraitTarget = new T.Vector3();
  let updatePortraitTarget = false;
  const cameraRay = new T.Ray(), hit = new T.Vector3(), direction = new T.Vector3();
  const cameraSolids = SOLIDS.filter(s => s.h >= 2).map(s => new T.Box3(
    new T.Vector3(s.x - s.w / 2 - .1, 0, s.z - s.d / 2 - .1),
    new T.Vector3(s.x + s.w / 2 + .1, s.h, s.z + s.d / 2 + .1),
  ));
  const faceFill = new T.DirectionalLight(0xfff1e1, 0);
  scene.add(faceFill, faceFill.target);
  const restingSeat = SEATS[o.slot === 0 ? 1 : 0], ownSeat = SEATS[o.slot];
  const peerPosition = new T.Vector3(restingSeat.x, 0, restingSeat.z);
  const fail = () => { if (gone) return; stop(); o.failure(); };
  function cancelReaction() { reactionLeft = 0; waveUntil = 0; }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; movement = { x: 0, y: 0 }; path = []; cancelReaction(); peerReactionLeft = 0; }
  function nearest(): Place | null {
    let result: Place | null = null, distance = 2;
    for (const [name, p] of Object.entries(PLACES) as [Place, Point][]) {
      const at = name === 'partner' && livePeer ? livePeer : p, d = Math.hypot(position.x - at.x, position.z - at.z);
      if (d < distance && areaAt(at.x, at.z) === room) { result = name; distance = d; }
    }
    return result;
  }
  function report() {
    const value = { near: nearest(), area: room, portrait, sitting, canSit: Math.hypot(position.x - PLACES.partner.x, position.z - PLACES.partner.z) < 2, ready: !!player, partnerReady: !!partner }, key = JSON.stringify(value);
    if (key !== lastReport) { lastReport = key; o.report(value); }
  }
  function stand() { if (sitting) { sitting = false; position = { ...standAt }; settling = .4; placementBlend = .35; updatePortraitTarget = true; } }
  function travel(point: Point) {
    if (!player) return;
    portrait = false;
    cancelReaction();
    stand();
    path = route(position, point);
    settling = .4;
    wake();
  }
  function constrainCamera(to: T.Vector3) {
    direction.copy(to).sub(target);
    const distance = direction.length();
    if (distance < .001) return;
    cameraRay.set(target, direction.divideScalar(distance));
    let nearest = distance;
    for (const solid of cameraSolids) {
      if (cameraRay.intersectBox(solid, hit)) nearest = Math.min(nearest, hit.distanceTo(target));
    }
    if (nearest < distance) to.copy(target).addScaledVector(direction, Math.max(.1, nearest - .12));
  }
  function tick(now: number) {
    frame = 0; if (gone || !active || !inViewport || document.hidden) { last = 0; return; }
    // Movement can catch up on slow frames using collision substeps, without skipping camera easing.
    const elapsed = last ? Math.min(.25, (now - last) / 1000) : .016;
    const dt = Math.min(.05, elapsed);
    const metres = 1.45 * elapsed;
    last = now;
    const reduced = reducedMotion.matches, inputLength = Math.hypot(movement.x, movement.y), old = { ...position };
    if (player && inputLength > .08) {
      portrait = false; stand(); path = [];
      const vx = movement.x / Math.max(1, inputLength), vz = movement.y / Math.max(1, inputLength);
      const dx = Math.cos(cameraYaw) * vx + Math.sin(cameraYaw) * vz, dz = -Math.sin(cameraYaw) * vx + Math.cos(cameraYaw) * vz;
      position = moveWithin(position, dx * metres, dz * metres);
    } else if (player && path.length) {
      stand();
      position = followRoute(position, path, metres);
    }
    const dx = position.x - old.x, dz = position.z - old.z, walking = Math.hypot(dx, dz) > .0001 && !sitting;
    if (walking) yaw += angleDelta(yaw, Math.atan2(dx, dz)) * (reduced ? 1 : 1 - Math.exp(-dt * 12));
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    mode = sitting ? 'sit' : walking ? 'walk' : reactionLeft > 0 ? 'wave' : 'idle';
    if (player) {
      nearPoint.set(position.x, 0, position.z); player.holder.position.lerp(nearPoint, !reduced && placementBlend > 0 ? 1 - Math.exp(-dt * 18) : 1); player.holder.rotation.y = yaw;
      player.mode(mode, reduced, gesture); player.update(elapsed, reduced);
    }
    const peerAt = livePeer || { ...restingSeat, yaw: 0, mode: 'sit' as const };
    const peerReacting = !!livePeer && peerAt.mode !== 'walk' && peerAt.mode !== 'sit' && peerReactionLeft > 0;
    peerPosition.set(peerAt.x, 0, peerAt.z);
    let peerBusy = false;
    if (partner) {
      peerBusy = partner.holder.position.distanceTo(peerPosition) > .015;
      partner.holder.position.lerp(peerPosition, reduced || partner.holder.position.distanceTo(peerPosition) > 3 ? 1 : 1 - Math.exp(-dt * 12));
      partner.holder.rotation.y += angleDelta(partner.holder.rotation.y, peerAt.yaw) * (reduced ? 1 : 1 - Math.exp(-dt * 12));
      partner.mode(peerReacting ? 'wave' : peerAt.mode === 'sit' ? 'sit' : peerBusy ? 'walk' : 'idle', reduced, peerGesture);
      partner.update(elapsed, reduced);
    }
    const nextRoom = areaAt(position.x, position.z);
    if (room !== nextRoom) { room = nextRoom; environment.area(room); }
    if (portrait && player && updatePortraitTarget) {
      player.head.getWorldPosition(portraitTarget);
      portraitTarget.y += .065;
      updatePortraitTarget = false;
    }
    if (portrait) lookTarget.copy(portraitTarget);
    else lookTarget.set(position.x, room === 'garden' ? 1.25 : 1.05, position.z);
    target.lerp(lookTarget, reduced ? 1 : 1 - Math.exp(-dt * 10));
    const bearing = portrait ? portraitYaw : cameraYaw, incline = portrait ? .045 : pitch;
    offset.set(Math.sin(bearing) * Math.cos(incline), Math.sin(incline), Math.cos(bearing) * Math.cos(incline))
      .multiplyScalar(portrait ? 1.25 : room === 'garden' ? 4.8 : 2.25);
    nextEye.copy(target).add(offset); constrainCamera(nextEye);
    nextEye.y = Math.max(1.1, nextEye.y); eye.lerp(nextEye, reduced || directLook ? 1 : 1 - Math.exp(-dt * 12));
    constrainCamera(eye);
    faceFill.intensity = portrait ? .8 : 0;
    if (portrait) {
      faceFill.position.set(eye.x - .65, eye.y + .35, eye.z);
      faceFill.target.position.copy(lookTarget);
    }
    const lift = !portrait && room === 'garden' ? OUTDOOR_LOOK_LIFT : 0;
    skylineLift = reduced ? lift : T.MathUtils.lerp(skylineLift, lift, 1 - Math.exp(-dt * 9));
    aim.copy(target);
    aim.y += skylineLift;
    directLook = false; placementBlend = Math.max(0, placementBlend - dt); camera.position.copy(eye); camera.lookAt(aim); camera.updateMatrixWorld();
    if (!reduced) environment.advance(elapsed);
    try { renderer.render(scene, camera); } catch { fail(); return; }
    rendered++; canvas.dataset.frames = String(rendered); canvas.dataset.x = position.x.toFixed(3); canvas.dataset.z = position.z.toFixed(3); canvas.dataset.mode = mode;
    canvas.dataset.cameraYaw = cameraYaw.toFixed(3);
    canvas.dataset.area = room;
    canvas.dataset.gesture = mode === 'wave' ? gesture : '';
    canvas.dataset.peerGesture = peerReacting ? peerGesture : '';
    canvas.dataset.peerX = peerPosition.x.toFixed(3); canvas.dataset.peerZ = peerPosition.z.toFixed(3); canvas.dataset.peer = livePeer ? 'live' : 'resting';
    canvas.dataset.drawCalls = String(renderer.info.render.calls); canvas.dataset.triangles = String(renderer.info.render.triangles);
    report(); settling = Math.max(0, settling - dt);
    const reacting = reactionLeft > 0 || peerReactionLeft > 0;
    reactionLeft = Math.max(0, reactionLeft - elapsed);
    peerReactionLeft = Math.max(0, peerReactionLeft - elapsed);
    const cameraBusy = eye.distanceTo(nextEye) > .003 || target.distanceTo(lookTarget) > .003 || Math.abs(lift - skylineLift) > .003;
    if (walking || peerBusy || inputLength > .08 || path.length || cameraBusy || reacting || settling > 0) wake(); else last = 0;
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
      const actor = await loadActor(person.urls, person.gender, abort.signal);
      if (gone) { actor.destroy(); return; }
      scene.add(actor.holder);
      if (index === 0) { player = actor; actor.holder.position.set(position.x, 0, position.z); }
      else { partner = actor; actor.holder.position.copy(peerPosition); }
      settling = .4; report(); wake();
    } catch { if (!gone && index === 0) fail(); }
  });
  void Promise.all(tasks);
  return {
    input(x, y) { movement = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }; if (Math.hypot(x, y) > .08) cancelReaction(); settling = .35; wake(); },
    look(dx, dy) { if (portrait) portraitYaw -= dx * .006; else { cameraYaw -= dx * .006; pitch = Math.max(.08, Math.min(.85, pitch + dy * .004)); } directLook = true; settling = .35; wake(); },
    find() {
      if (!livePeer || livePeer.mode === 'sit') { travel(PLACES.partner); return; }
      const dx = position.x - livePeer.x, dz = position.z - livePeer.z;
      const distance = Math.hypot(dx, dz);
      if (distance < .95) return;
      const sameRoom = room === areaAt(livePeer.x, livePeer.z);
      travel(sameRoom ? { x: livePeer.x + dx / distance * .8, z: livePeer.z + dz / distance * .8 } : livePeer);
    },
    bench() { travel(PLACES.partner); },
    visit(place) { travel(DESTINATIONS[place]); },
    viewAvatar() { if (!player) return; portrait = !portrait; updatePortraitTarget = portrait; portraitYaw = yaw; path = []; settling = .35; report(); wake(); },
    react(next) {
      if (!player) return;
      stand();
      path = []; movement = { x: 0, y: 0 };
      gesture = next;
      waveUntil = performance.now() + 1300;
      reactionLeft = reducedMotion.matches ? .1 : 1.3;
      wake();
    },
    sit() { if (!player) return; cancelReaction(); if (sitting) stand(); else if (Math.hypot(position.x - PLACES.partner.x, position.z - PLACES.partner.z) < 2) { standAt = { ...position }; position = { ...ownSeat }; yaw = 0; sitting = true; path = []; placementBlend = .35; updatePortraitTarget = true; } settling = .5; report(); wake(); },
    peer(p) {
      const newGesture = p?.mode === 'wave' && (livePeer?.mode !== 'wave' || p.gesture !== livePeer.gesture || p.session !== livePeer.session);
      if (newGesture) { peerGesture = p.gesture || 'wave'; peerReactionLeft = reducedMotion.matches ? .1 : 1.3; }
      else if (!p || p.mode === 'walk' || p.mode === 'sit') peerReactionLeft = 0;
      const changed = !!p !== !!livePeer || (p && livePeer && (p.x !== livePeer.x || p.z !== livePeer.z || p.yaw !== livePeer.yaw || p.mode !== livePeer.mode));
      livePeer = p;
      if (changed || newGesture) { settling = .4; wake(); }
    },
    active(on) { active = on; if (!on) stop(); else { settling = .4; wake(); } },
    resize,
    photos(values) { if (!gone) environment.photos(values, () => { settling = .1; wake(); }); },
    pose() {
      // Presence samples the tap even when the next animation frame is delayed.
      const current = sitting ? 'sit' : performance.now() < waveUntil ? 'wave' : mode === 'wave' ? 'idle' : mode;
      return { ...position, yaw, mode: current, ...(current === 'wave' ? { gesture } : {}) };
    },
    destroy() { if (gone) return; gone = true; stop(); abort.abort(); seen.disconnect(); document.removeEventListener('visibilitychange', visibility); motionMedia.removeEventListener('change', motion); canvas.removeEventListener('webglcontextlost', lost); player?.destroy(); partner?.destroy(); environment.dispose(); renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); },
  };
}
