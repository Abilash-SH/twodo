/** Original 3D city art. All textures are painted on the phone when Explore opens; nothing is downloaded.
 *  A modern city lit by the real hour (daylight.ts): glass, concrete and charcoal towers whose windows light up after
 *  sunset, a granite plaza, a lakeside boardwalk with trees and benches, streets to the south and east, an elevated
 *  train, the loft and the garage. Signs and neon are night accents only. Coordinates, rooms, seats and obstacles come
 *  from state.ts, so walking, presence and the camera all agree with what is drawn. */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildBirds } from './birds';
import { cityArt, paintBillboard, paintBoardwalk, paintFacadeDay, paintPavers, paintRipples, paintSign, paintWallPanels, paintWindowsAtNight, seededNoise } from './city-art';
import { mixHex, type Daylight } from './daylight';
import { buildSky, MOON, skyReflections } from './sky';
import {
  BENCH, BUILDINGS, EAST_KERB, FOUNTAIN, FURNITURE, LAKE_BENCHES, LAKE_EDGE, MOMENTS_KIOSK, PLAZA_FIXTURES, ROOMS, SOUTH_KERB,
  STREET_LAMPS, TASK_TERMINAL, TREES, walls, type RoomName, type Solid,
} from './state';

/** What the rest of the frame needs from the hour: exposure, how much glow blooms, and the sky at the top of the
 *  screen (a linear colour; scene.ts turns it into the status bar's colour). */
export interface Look { exposure: number; bloom: number; sky: T.Color; phase: Phase; /** a soft light near the camera, so you can see each other after dark */ fill: number }
export type Phase = 'Morning' | 'Afternoon' | 'Evening' | 'Sunrise' | 'Sunset' | 'Dusk' | 'Night';

/** a window tile is 10 windows by 12 floors: 1.4 m windows, 3 m floors */
const TILE_U = 14, TILE_V = 36;

export function buildEnvironment(scene: T.Scene, tokens: CSSStyleDeclaration, renderer?: T.WebGLRenderer) {
  const anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() || 1);
  const art = cityArt(scene, tokens, anisotropy);
  const { box, mesh, material, texture, ink, color, shape } = art;
  const solid = (role: string, options: T.MeshStandardMaterialParameters = {}) =>
    material(new T.MeshStandardMaterial({ color: color(role), roughness: .7, ...options }));

  // Lights that follow the hour: [material, its colour at level 1, level by day, level at night]
  const glows: [T.MeshBasicMaterial, T.Color, number, number][] = [];
  const glow = (role: string, day: number, night: number, tint = color(role)) => {
    const surface = material(new T.MeshBasicMaterial({ color: tint, toneMapped: false }));
    glows.push([surface, tint.clone(), day, night]);
    return surface;
  };
  const lamp = glow('lamp', .3, 2.3), neonCyan = glow('cyan', .2, 1), neonPink = glow('pink', .2, 1.2), neonAmber = glow('amber', .3, 1.3);
  const beacon = glow('beacon', .35, 2), trainWindow = glow('amber', .3, 1.4), screen = glow('white', .75, 1.05);

  const frame = solid('frame', { roughness: .5, metalness: .4 }), steel = solid('steel', { metalness: .8, roughness: .32 });
  const concrete = solid('concrete', { roughness: .9 }), podium = solid('podium', { roughness: .62, metalness: .15 });
  const panelMap = texture(128, 128, paintWallPanels);
  panelMap.wrapS = panelMap.wrapT = T.RepeatWrapping;
  panelMap.repeat.set(3, 2);
  const panels = solid('white', { map: panelMap, roughness: .82 });
  const floor = solid('floor', { roughness: .45, metalness: .1 }), textile = solid('cloth'), cushion = solid('cushion');
  const wood = solid('wood', { roughness: .75 }), paint = solid('paint', { roughness: .8 }), bark = solid('bark', { roughness: .95 });
  const leaves = [solid('leaf', { roughness: .92 }), solid('leaf2', { roughness: .92 })];
  // shop windows: dark glass by day, warm rooms behind them after sunset
  const shopfront = solid('glass', { roughness: .12, metalness: .5, emissive: color('shop'), emissiveIntensity: 0 });
  const glass = solid('glass', { roughness: .1, metalness: .6 });
  const railGlass = material(new T.MeshStandardMaterial({ color: color('glass'), roughness: .05, metalness: .3, transparent: true, opacity: .25, depthWrite: false }));
  const ripples = texture(256, 256, paintRipples);
  ripples.colorSpace = T.NoColorSpace; // slopes, not colours
  ripples.wrapS = ripples.wrapT = T.RepeatWrapping;
  ripples.repeat.set(240, 280); // one swell every five metres or so
  const water = solid('water', { roughness: .12, metalness: .85, normalMap: ripples, normalScale: new T.Vector2(.45, .45) });
  const pond = solid('water', { roughness: .08, metalness: .85 });
  const asphalt = solid('asphalt', { roughness: .85 }), sidewalk = solid('sidewalk', { roughness: .85 }), shore = solid('shore', { roughness: .95 });
  const floorMap = texture(256, 256, paintPavers);
  floorMap.wrapS = floorMap.wrapT = T.RepeatWrapping;
  floorMap.repeat.set(7, 6);
  const pavement = solid('white', { map: floorMap, roughness: .72 });
  const deckMap = texture(256, 256, paintBoardwalk);
  deckMap.wrapS = deckMap.wrapT = T.RepeatWrapping;
  deckMap.repeat.set(3, 8);
  const boardwalk = solid('white', { map: deckMap, roughness: .8 });

  const sky = buildSky(scene), birds = buildBirds(scene);
  const hemisphere = new T.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemisphere);
  // one light casts the shadows: the sun by day, the moon at night
  const key = new T.DirectionalLight(0xffffff, 2);
  key.target.position.set(-3, 0, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 140 });
  key.shadow.normalBias = .05;
  key.shadow.bias = -.0006;
  scene.add(key, key.target);
  const moonDir = MOON.clone();
  const lamps: T.PointLight[] = [];
  for (const [role, x, y, z, reach] of [
    ['lamp', FOUNTAIN.x, 2.4, FOUNTAIN.z + 1.6, 9], ['amber', .1, 2.3, -9.2, 8], ['lamp', MOMENTS_KIOSK.x - .5, 2.4, MOMENTS_KIOSK.z + 1, 7],
    ['lamp', -14.4, 3.6, 2.2, 10],
  ] as const) {
    const point = new T.PointLight(color(role), 0, reach, 2);
    point.position.set(x, y, z);
    scene.add(point);
    lamps.push(point);
  }
  scene.fog = new T.Fog(0xffffff, 60, 420);

  function rect(w: number, h: number, x: number, y: number, z: number, surface: T.Material, parent?: T.Object3D) {
    return mesh(new T.PlaneGeometry(w, h), surface, x, y, z, parent);
  }
  function ground(w: number, d: number, x: number, y: number, z: number, surface: T.Material) {
    rect(w, d, x, y, z, surface).rotation.x = -Math.PI / 2;
  }
  function sign(title: string, subtitle: string, role: string, x: number, y: number, z: number, w: number, parent?: T.Object3D) {
    const surface = glow(role, .8, 1.1, new T.Color(1, 1, 1));
    surface.map = texture(512, 152, ctx => paintSign(ctx, title, subtitle, ink(role)));
    box(x, y, z - .065, w + .08, w * .297 + .08, .11, frame, parent);
    return rect(w, w * .297, x, y, z, surface, parent);
  }

  // ---------- the ground: plaza, boardwalk, walks, streets and the lake ----------
  const pools = texture(96, 96, context => {
    const g = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.36, 'rgba(255,255,255,.38)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = g; context.fillRect(0, 0, 96, 96);
  });
  const spills: [T.MeshBasicMaterial, number][] = [];
  function spill(role: string, opacity: number) {
    const surface = material(new T.MeshBasicMaterial({ color: color(role), map: pools, transparent: true, depthWrite: false, opacity: 0, blending: T.AdditiveBlending }));
    spills.push([surface, opacity]);
    return surface;
  }
  const warmPool = spill('lamp', .4), coolPool = spill('cyan', .16), pinkPool = spill('pink', .18);
  ground(220, 400, LAKE_EDGE + 110, -.08, 0, asphalt);
  ground(1200, 1400, LAKE_EDGE - 600.2, -.55, 0, water);
  ground(500, 1400, -510, -.5, 0, shore); // the far shore, under the skyline across the water
  box(LAKE_EDGE - .1, -.32, 10, .3, .52, 120, concrete);
  ground(19.1, 17.1, 0, -.02, -.16, pavement);
  const deckW = -9.45 - LAKE_EDGE;
  ground(deckW, 22.4, LAKE_EDGE + deckW / 2, -.03, 2.6, boardwalk);
  ground(EAST_KERB + 9.45, SOUTH_KERB - 8.39, (EAST_KERB - 9.45) / 2, -.028, (SOUTH_KERB + 8.39) / 2, sidewalk);
  ground(EAST_KERB - 9.45, 17, (EAST_KERB + 9.45) / 2, -.028, -.1, sidewalk);
  box((LAKE_EDGE + EAST_KERB) / 2 + .2, .02, SOUTH_KERB + .12, EAST_KERB - LAKE_EDGE + .5, .16, .26, concrete);
  box(EAST_KERB + .12, .02, 2.6, .26, .16, 22.6, concrete);
  // the far pavements, across each street
  ground(62, 1.6, 12, -.03, 18.6, sidewalk);
  box(12, .02, 17.75, 62, .16, .2, concrete);
  ground(1.2, 46, 16.1, -.03, -4, sidewalk);
  box(15.45, .02, -4, .2, .16, 46, concrete);
  for (const x of [-9.45, 9.45]) box(x, .005, 0, .24, .05, 16.8, concrete); // flush edging where the plaza meets the walks
  for (const x of [-9.45, 9.45]) box(x, .033, 0, .04, .012, 16.6, neonCyan); // an in-ground line of light, at night
  for (const x of [-7, 7]) box(x, .16, -8.35, 4.4, .36, .32, concrete);
  // road markings: dashed centre lines, and a zebra crossing on each street
  for (let z = -24; z < 13; z += 3) if (Math.abs(z + 2) > 2.4) box(14.6 - .05, -.07, z, .14, .01, 1.6, paint);
  for (let x = -18; x < 12.5; x += 3) if (Math.abs(x) > 2.4) box(x, -.07, 15.7, 1.6, .01, .14, paint);
  for (let z = 14.1; z < 17.5; z += .55) box(0, -.069, z, 2.6, .012, .28, paint);
  for (let x = 12.9; x < 15.3; x += .55) box(x, -.069, -2, .28, .012, 2.6, paint);

  // ---------- towers ----------
  const facades = [0, 1, 2].map(i => {
    const day = texture(512, 512, ctx => paintFacadeDay(ctx, i)), night = texture(512, 512, ctx => paintWindowsAtNight(ctx, i));
    for (const map of [day, night]) map.wrapS = map.wrapT = T.RepeatWrapping;
    return solid('white', {
      map: day, emissive: 0xffffff, emissiveMap: night, emissiveIntensity: 0,
      roughness: i === 0 ? .2 : i === 1 ? .88 : .55, metalness: i === 0 ? .6 : i === 2 ? .25 : 0,
    });
  });
  const random = seededNoise(888);
  function body(x: number, z: number, w: number, d: number, y0: number, y1: number, kind: number) {
    const h = y1 - y0, g = new T.BoxGeometry(w, h, d), uv = g.getAttribute('uv') as T.BufferAttribute;
    // start each face on a window edge and a floor line, somewhere different in the tile
    const ou = Math.floor(random() * 10) / 10, ov = Math.floor(random() * 12) / 12, sizes = [d, d, 0, 0, w, w];
    for (let face = 0; face < 6; face++) for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      if (!sizes[face]) uv.setXY(i, .002, .998); // roofs and floors: the plain wall texel
      else uv.setXY(i, uv.getX(i) * sizes[face] / TILE_U + ou, uv.getY(i) * h / TILE_V + ov);
    }
    g.translate(x, y0 + h / 2, z);
    shape(g, facades[kind % facades.length]);
  }
  function roof(x: number, z: number, w: number, d: number, h: number, index: number) {
    box(x, h + .25, z, w + .1, .5, d + .1, concrete);
    box(x, h + .02, z, w - .3, .06, d - .3, frame);
    box(x - w * .2, h + .55, z + d * .15, w * .22, .7, d * .25, steel);
    if (index % 2) {
      const tank = new T.CylinderGeometry(.55, .55, 1.3, 16);
      tank.translate(x + w * .22, h + .9, z - d * .2);
      shape(tank, steel);
    }
    if (index % 3 === 0) { box(x, h + 1.7, z, .07, 3, .07, steel); box(x, h + 3.25, z, .14, .14, .14, beacon); }
  }
  function tower(b: Solid, index: number, kind = index) {
    const { x, z, w, d, h } = b;
    box(x, 1.45, z, w + .15, 2.9, d + .13, podium);
    box(x, 1.25, z, w + .2, 2, d + .18, shopfront);
    box(x, 2.6, z, w + .5, .14, d + .45, frame); // the awning line over the shops
    const setback = h > 12 && index % 2 === 0, top = setback ? 2.9 + (h - 2.9) * .72 : h;
    body(x, z, w, d, 2.9, top, kind);
    if (setback) {
      body(x, z, w * .72, d * .72, top, h, kind);
      box(x, top + .1, z, w + .06, .2, d + .06, concrete);
      roof(x, z, w * .72, d * .72, h, index);
    } else roof(x, z, w, d, h, index);
  }
  BUILDINGS.forEach((b, i) => tower(b, i));
  for (let i = 0; i < 11; i++) tower({ x: -17 + i * 4.4 + random(), z: -24 - 4 * random(), w: 3.2 + 1.2 * random(), d: 4.2, h: 9 + 13 * random() }, i + 3);
  // The skyline all round but the lake, and another across the water: hazy at noon, silhouettes at sunset.
  const far = seededNoise(5150);
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * Math.PI * 2 + far() * .06, r = 46 + far() * 18, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 4 + far() * 5, d = 4 + far() * 5, h = 10 + far() * 22;
    if (x - w / 2 < LAKE_EDGE + 3) continue;
    body(x, z, w, d, 0, h, i);
    box(x, h + .2, z, w + .1, .4, d + .1, concrete);
  }
  // across the lake, about 300 m away: low and hazy by day, a line of lit windows at night
  for (let i = 0; i < 34; i++) {
    const x = -275 - far() * 70, z = -190 + i * 11.5 + far() * 6, w = 9 + far() * 14, d = 9 + far() * 12, h = 14 + Math.pow(far(), 2) * 62;
    body(x, z, w, d, -.5, h, i);
  }
  // a row of shops under the train, between the plaza and the towers
  box(0, 1.6, -12.75, 21, 3.2, 2.1, podium);
  box(0, 3.27, -12.75, 21.3, .14, 2.3, frame);
  // billboards: printed by day, lit from inside at night
  const billboards: T.MeshStandardMaterial[] = [];
  function billboard(title: string, subtitle: string, from: string, to: string, x: number, y: number, z: number, w: number, facing: 'south' | 'west') {
    const map = texture(512, 256, ctx => paintBillboard(ctx, title, subtitle, from, to));
    const surface = solid('white', { map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0, roughness: .6 });
    billboards.push(surface);
    const board = rect(w, w / 2, x, y, z, surface);
    if (facing === 'west') { board.rotation.y = -Math.PI / 2; box(x + .08, y, z, .12, w / 2 + .2, w + .2, frame); }
    else box(x, y, z - .08, w + .2, w / 2 + .2, .12, frame);
  }
  billboard('TWODO', 'TWO OF US · ONE CITY', '#e86f8f', '#6a4bd6', .15, 12.4, -14.92, 4.4, 'south');
  billboard('MOONLINE', 'THE TRAIN OVER THE PLAZA', '#2b8fc7', '#1c3e8a', 16.93, 8.6, 5, 4.2, 'west');
  sign('MOONLINE', 'ELEVATED TRANSIT', 'cyan', .1, 7.3, -14.96, 3.7);
  sign('NIGHT MARKET', 'LATE COUNTER', 'amber', -4.6, 4.45, -11.65, 2.7);
  sign('SIGNAL', 'CITY LINK', 'pink', 4.85, 8.6, -12.35, 2.95);

  // ---------- the night kitchen and shopfronts under the train ----------
  for (const x of [-8, -4.3, 0, 4.5, 8.5]) {
    box(x, 1.55, -11.6, 1.75, 2.04, .12, shopfront);
    for (const edge of [-.56, 0, .56]) box(x + edge, 1.55, -11.5, .05, 2.05, .06, frame);
    box(x, 1.27, -11.49, 1.74, .058, .07, frame);
    box(x, 2.7, -11.43, 1.97, .11, .59, steel);
  }
  box(.1, 1.31, -10.93, 3.65, 2.63, 1.36, frame);
  box(.1, 1.14, -10.235, 3.42, 1.78, .06, shopfront);
  for (let i = 0; i < 5; i++) {
    const x = -1.5 + i * .8;
    box(x, 1.14, -10.197, .035, 1.78, .035, steel);
    box(x + .28, 1.73, -10.18, .37, .047, .045, neonAmber);
  }
  box(.1, .82, -10.146, 3.4, .058, .086, steel);
  sign('NIGHT KITCHEN', 'LATE COUNTER', 'amber', .1, 2.54, -10.2, 3.01);
  box(.1, 2.14, -9.99, 3.88, .095, .5, steel);
  box(.1, 2.087, -9.75, 3.69, .029, .036, neonAmber);
  ground(5.2, 5.25, .1, -.015, -9.75, warmPool);

  // ---------- the elevated train ----------
  const railZ = -9.35;
  box(0, 4.34, railZ, 65, .44, 1.92, concrete);
  box(0, 4.61, railZ, 65, .16, .95, frame);
  box(0, 4.48, railZ + .98, 65, .066, .045, neonCyan);
  for (const x of [-24, -16, -8, 3.1, 10.8, 18.6, 26]) {
    box(x, 2, railZ, .55, 4.1, .65, concrete);
    box(x, 3.92, railZ, 1.25, .42, 1.47, concrete);
  }
  for (let x = -29; x < 30; x += 1.5) box(x, 4.66, railZ + .9, .035, .29, .037, steel);
  const train = new T.Group();
  train.position.set(-1.55, 5.11, railZ);
  scene.add(train);
  const carShell = solid('train', { metalness: .55, roughness: .32 }), stripe = solid('stripe', { roughness: .5 });
  for (const x of [-2.14, 2.14]) {
    mesh(new RoundedBoxGeometry(4.15, .8, 1.12, 2, .22), carShell, x, 0, 0, train);
    box(x, -.24, .562, 3.84, .06, .028, stripe, train);
    for (let i = 0; i < 5; i++) box(x + (i - 2) * .65, .07, .566, .56, .26, .034, i === 2 ? screen : trainWindow, train);
    box(x, 0, .588, .035, .51, .04, frame, train);
  }
  box(0, -.25, 0, .23, .24, .66, frame, train);
  box(-4.01, -.13, .46, .15, .09, .135, beacon, train);
  box(4.01, -.13, .46, .15, .09, .135, screen, train);

  // ---------- the loft and the garage ----------
  const roofs = new Map<RoomName, T.Group>();
  for (const [name, room] of Object.entries(ROOMS) as [RoomName, typeof ROOMS[RoomName]][]) {
    const { minX, maxX, back, front, doorLeft, doorRight } = room;
    const x = (minX + maxX) / 2, z = (back + front) / 2, w = maxX - minX, d = front - back;
    const entry = (doorLeft + doorRight) / 2, opening = doorRight - doorLeft;
    const loft = name === 'villa', accent = loft ? neonAmber : neonCyan;
    const roof = new T.Group();
    scene.add(roof);
    roofs.set(name, roof);
    for (const wall of walls(room)) box(wall.x, wall.h / 2, wall.z, wall.w, wall.h, wall.d, panels);
    box(x, -.02, z, w, .048, d, floor);
    box(entry, .008, front + .43, opening + .19, .043, 1.1, steel);
    for (const edge of [doorLeft, doorRight]) box(edge, 1.13, front + .06, .14, 2.25, .24, frame);
    box(entry, 2.48, front, opening, .64, .21, steel, roof);
    box(x, 2.83, z, w + .37, .2, d + .33, frame, roof);
    box(entry, 2.47, front + .39, opening + .57, .13, .83, frame, roof);
    box(entry, 2.42, front + .8, opening + .59, .039, .036, accent, roof);
    sign(loft ? 'AFTER HOURS' : 'MOTOR BAY', loft ? 'JOURNAL LOUNGE' : 'WORKBENCH', loft ? 'amber' : 'cyan', x, 3.11, front + .1, 2.72, roof);
    for (const side of [-1, 1]) {
      const start = side < 0 ? minX : doorRight, end = side < 0 ? doorLeft : maxX;
      const width = end - start - .36;
      if (width < .5) continue;
      const px = (start + end) / 2;
      box(px, 1.29, front + .11, width, 1.24, .04, frame);
      box(px, 1.32, front + .138, width - .12, 1.08, .018, shopfront);
      for (let i = -1; i <= 1; i++) box(px + i * width * .29, 1.32, front + .17, .054, 1.15, .03, frame);
      box(px, .67, front + .16, width + .12, .042, .1, steel);
    }
    box(x, 2.14, back + .11, w - .2, .067, .065, accent);
    for (let i = 0; i < 5; i++) box(x - 1.6 + .8 * i, .63, back + .108, .49, .65, .06, frame);
    if (loft) sign('AFTER HOURS', 'JOURNAL LOUNGE', 'amber', x - .68, 1.64, back + .16, 1.86);
    else sign('SERVICE', 'WORKBENCH BAY', 'cyan', x - 1.07, 1.63, back + .16, 1.32);
  }

  const sofa = FURNITURE.sofa;
  box(sofa.x, .28, sofa.z, sofa.w, .31, sofa.d, frame);
  box(sofa.x, .5, sofa.z, sofa.w, .19, sofa.d - .12, textile);
  box(sofa.x - .34, .69, sofa.z, .18, .58, sofa.d, textile);
  for (const end of [-1, 1]) {
    box(sofa.x, .61, sofa.z + end * .84, sofa.w, .28, .16, textile);
    box(sofa.x - .15, .67, sofa.z + end * .49, .22, .26, .33, cushion);
  }
  const desk = FURNITURE.desk;
  box(desk.x, .78, desk.z, desk.w, .1, desk.d, wood);
  box(desk.x, .4, desk.z, desk.w * .8, .72, desk.d * .7, frame);
  box(desk.x, .85, desk.z + .13, .46, .027, .25, screen);
  sign('JOURNAL', 'TODAY’S PAGE', 'amber', desk.x, 1.21, desk.z - .23, .85);
  ground(3.5, 3, -5.5, .008, -5.26, warmPool);
  const workbench = FURNITURE.workbench;
  box(workbench.x, .88, workbench.z, workbench.w, .12, workbench.d, steel);
  box(workbench.x, .41, workbench.z, workbench.w * .91, .83, workbench.d * .77, frame);
  box(workbench.x, 1.42, workbench.z - .24, workbench.w, .76, .053, steel);
  for (let i = 0; i < 6; i++) box(workbench.x - .92 + .36 * i, 1.46, workbench.z - .184, .062, .21 + .025 * i, .072, i % 2 ? podium : steel);
  const crate = FURNITURE.boxes;
  box(crate.x, .33, crate.z, crate.w, .66, crate.d, wood);
  for (const y of [.09, .58]) box(crate.x, y, crate.z, crate.w + .035, .059, crate.d + .037, steel);

  // ---------- the fountain ----------
  const { x: fx, z: fz, rx, rz } = FOUNTAIN;
  function basin(radius: number, y: number, depth: number, surface: T.Material) {
    const pool = mesh(new T.CylinderGeometry(radius, radius, depth, 48), surface, fx, y, fz);
    pool.scale.set(rx - .23, 1, rz - .23);
  }
  basin(1, .17, .34, concrete);
  basin(.99, .356, .047, steel);
  basin(.93, .382, .026, pond);
  basin(.16, .62, .5, concrete);
  const spray = material(new T.MeshStandardMaterial({ color: color('spray'), roughness: .2, transparent: true, opacity: .7, emissive: color('spray'), emissiveIntensity: .12 }));
  const jets: T.TubeGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, cx = Math.cos(angle), sz = Math.sin(angle);
    const points = [new T.Vector3(cx * 1.05, 0, sz * .74), new T.Vector3(cx * .53, .69 + i % 3 * .075, sz * .38), new T.Vector3(cx * .13, .15, sz * .11)];
    jets.push(new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, .016 + i % 2 * .008, 5, false));
  }
  const arcs = mergeGeometries(jets);
  jets.forEach(value => value.dispose());
  if (arcs) mesh(arcs, spray, fx, .42, fz);
  ground(7.1, 8.1, FOUNTAIN.x, .001, FOUNTAIN.z + 1.5, coolPool);

  // ---------- plaza furniture, lamps and kiosks (positions unchanged) ----------
  for (const x of [BENCH.x - 1.03, BENCH.x + 1.03]) box(x, .23, BENCH.z, .12, .45, .62, steel);
  box(BENCH.x, .5, BENCH.z, 2.63, .12, .66, wood);
  box(BENCH.x, .8, BENCH.z - .3, 2.62, .46, .085, wood);
  for (const { x, z } of PLAZA_FIXTURES) {
    box(x, .34, z, .53, .68, .55, frame);
    box(x, .66, z, .62, .055, .64, steel);
    box(x, 1.51, z, .074, 1.65, .074, frame);
    box(x, 2.36, z, .56, .12, .31, steel);
    box(x, 2.288, z, .5, .04, .26, lamp);
    ground(3.25, 3.25, x, .005, z, warmPool);
  }
  const photoMaterials = [0, 1].map(() => solid('glass', { emissive: color('glass'), emissiveIntensity: .3 }));
  const kiosk = MOMENTS_KIOSK;
  box(kiosk.x, 1.36, kiosk.z, .96, 1.17, .32, frame);
  sign('MOMENTS', 'PHOTO KIOSK', 'pink', kiosk.x, 1.83, kiosk.z + .183, .91);
  photoMaterials.forEach((surface, i) => box(kiosk.x - .23 + .46 * i, 1.32, kiosk.z + .183, .41, .52, .036, surface));
  box(kiosk.x, .98, kiosk.z + .186, .94, .031, .033, neonPink);
  ground(3.4, 3.6, kiosk.x, .006, kiosk.z + .5, pinkPool);
  box(TASK_TERMINAL.x, .91, TASK_TERMINAL.z, .67, .54, .51, frame);
  sign('TODAY', 'TASK PATCH', 'cyan', TASK_TERMINAL.x, 1.07, TASK_TERMINAL.z + .27, .61);

  // ---------- the lakeside: railing, benches, street lamps and trees ----------
  for (let z = -8.4; z <= 13.6; z += 1.6) box(LAKE_EDGE + .05, .55, z, .07, 1.1, .07, steel);
  box(LAKE_EDGE + .05, 1.12, 2.6, .12, .07, 22.1, wood);
  box(LAKE_EDGE + .05, .55, 2.6, .025, .95, 22, railGlass);
  for (const { x, z } of LAKE_BENCHES) {
    for (const end of [-.7, .7]) box(x, .22, z + end, .5, .44, .08, steel);
    box(x, .46, z, .55, .07, 1.8, wood);
    box(x + .26, .72, z, .07, .45, 1.8, wood); // the back is to the plaza: you sit looking over the lake
  }
  for (const { x, z } of STREET_LAMPS) {
    box(x, 2, z, .1, 4, .1, frame);
    // the heads lean out over the walk: both ways in the middle of the promenade, inwards along the streets
    const heads: [number, number][] = z > 12 ? [[0, -.38]] : x > 11 ? [[-.38, 0]] : [[-.38, 0], [.38, 0]];
    for (const [dx, dz] of heads) {
      box(x + dx / 2, 4, z + dz / 2, dx ? .8 : .1, .07, dz ? .8 : .1, frame);
      box(x + dx, 3.94, z + dz, .32, .05, .22, lamp);
      ground(4.2, 4.2, x + dx, .004, z + dz, warmPool);
    }
  }
  const tree = seededNoise(42);
  for (const { x, z } of TREES) {
    box(x, .27, z, 1.15, .55, 1.15, concrete);
    box(x, .53, z, .98, .04, .98, podium);
    const trunk = new T.CylinderGeometry(.06, .1, 2.9, 7);
    trunk.translate(x, 2, z);
    shape(trunk, bark);
    // a crown of foliage clumps, each a little lumpy, in two greens
    const top = 3.7 + tree() * .4;
    for (let i = 0; i < 7; i++) {
      const a = i / 6 * Math.PI * 2 + tree(), out = i === 6 ? 0 : .45 + tree() * .2;
      // lumps from the vertex's own position, so corners shared by two faces move together (no cracks); the
      // sphere's smooth normals stay
      const clump = new T.IcosahedronGeometry(.45 + tree() * .25, 1), at = clump.getAttribute('position') as T.BufferAttribute;
      const s1 = tree() * 6, s2 = tree() * 6;
      for (let k = 0; k < at.count; k++) {
        const px = at.getX(k), py = at.getY(k), pz = at.getZ(k);
        const n = 1 + .14 * Math.sin(px * 4.1 + s1) * Math.cos(pz * 3.7 + s2) + .08 * Math.sin(py * 5.3 + s1);
        at.setXYZ(k, px * n, py * n * .85, pz * n);
      }
      clump.translate(x + Math.cos(a) * out, top + (i === 6 ? .5 : (tree() - .5) * .5), z + Math.sin(a) * out);
      shape(clump, leaves[i % 2]);
    }
  }
  art.finish();
  const reflections = { target: null as T.WebGLRenderTarget | null, at: 999, colours: '' };
  const keyDir = new T.Vector3(), lastKey = new T.Vector3(), skyTop = new T.Color(), mix = new T.Color(), whiteLight = new T.Color(1, 1, 1), moonlight = new T.Color('#5d6f97');
  const look: Look = { exposure: .82, bloom: .05, fill: 0, sky: new T.Color(.05, .08, .2), phase: 'Afternoon' };
  const photoUrls: (string | null)[] = [null, null];
  const versions = [0, 0];
  let disposed = false, birdsShown = 0;
  return {
    area(name: RoomName | 'garden') { roofs.forEach((roof, id) => { roof.visible = name !== id; }); },
    /** light the city for this moment of the day */
    setDaylight(d: Daylight, reduced: boolean, hour: number) {
      sky.update(d);
      const night = d.night, evening = Math.max(night, d.golden * .45);
      const bySun = d.elevation > -4;
      if (bySun) keyDir.set(d.sun[0], Math.max(.06, d.sun[1]), d.sun[2]).normalize(); else keyDir.copy(moonDir);
      key.position.copy(key.target.position).addScaledVector(keyDir, 70);
      key.color.set(bySun ? d.sunColor : '#aebfdc');
      key.intensity = bySun ? 2.9 * Math.min(1, Math.max(0, (d.elevation + 4) / 14)) : .45 * night;
      if (renderer && lastKey.angleTo(keyDir) > .01) { lastKey.copy(keyDir); renderer.shadowMap.needsUpdate = true; }
      skyTop.set(d.zenith).lerp(mix.set(d.horizon), .35);
      // the sky's own light, and moonlight at night: soft and blue, enough to see each other by
      hemisphere.color.copy(skyTop).lerp(whiteLight, .3 * d.day).lerp(moonlight, .75 * night);
      hemisphere.groundColor.set(mixHex('#221d1a', '#5a4c3c', d.day));
      hemisphere.intensity = .45 + .75 * d.day + .3 * d.golden;
      const fog = scene.fog as T.Fog;
      fog.color.set(d.horizon);
      fog.far = 420 + 200 * night; // clearer at night, so the far shore's lights carry
      for (const [surface, base, day, nightLevel] of glows) surface.color.copy(base).multiplyScalar(day + (nightLevel - day) * evening);
      for (const [surface, opacity] of spills) surface.opacity = opacity * Math.max(night, d.golden * .5);
      for (const facade of facades) facade.emissiveIntensity = .02 + .45 * d.golden + .9 * night;
      for (const board of billboards) board.emissiveIntensity = .02 + .8 * night;
      shopfront.emissiveIntensity = .06 + .3 * d.golden + .85 * night;
      lamps.forEach(point => { point.intensity = 14 * night + 3 * d.golden; });
      birdsShown = reduced ? 0 : Math.min(1, Math.max(d.day, d.golden * .8) * 1.2);
      birds.show(birdsShown);
      // the reflections are remade when the sky has really changed (never through the night, when it doesn't)
      const colours = d.zenith + d.horizon + d.glow;
      if (renderer && colours !== reflections.colours && Math.abs(d.elevation - reflections.at) > 1.5) {
        const next = skyReflections(renderer, sky.reflectionScene);
        if (next) { reflections.target?.dispose(); reflections.target = next; reflections.at = d.elevation; reflections.colours = colours; scene.environment = next.texture; }
      }
      scene.environmentIntensity = .3 + .7 * d.day;
      look.exposure = .8 + .2 * night;
      look.bloom = .03 + .1 * d.golden + .25 * night;
      look.fill = 2.6 * night + .8 * d.golden;
      look.sky.copy(skyTop);
      look.phase = night > .6 ? 'Night' : d.golden > .35 ? (hour < 12 ? 'Sunrise' : 'Sunset') : d.day < .5 ? (hour < 12 ? 'Sunrise' : 'Dusk')
        : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    },
    look: () => look,
    advance(seconds: number) {
      train.position.x += seconds * 3.4;
      if (train.position.x > 34) train.position.x -= 68;
      sky.drift(seconds);
      ripples.offset.x += seconds * .004; ripples.offset.y += seconds * .0025; // the lake moves a little
      if (birdsShown) birds.fly(seconds);
    },
    photos(values: readonly (string | null)[], changed: () => void) {
      photoMaterials.forEach((surface, i) => {
        const url = values[i] || null;
        if (url === photoUrls[i]) return;
        photoUrls[i] = url;
        const version = ++versions[i];
        surface.map?.dispose();
        surface.map = null;
        surface.color.copy(glass.color);
        surface.emissiveIntensity = .3;
        surface.needsUpdate = true;
        changed();
        if (!url || url.length > 140000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(url)) return;
        const image = new Image();
        image.onload = () => {
          if (disposed || version !== versions[i] || image.width < 1 || image.height < 1 || image.width * image.height > 1048576 || Math.max(image.width, image.height) > 2048) return;
          const map = new T.Texture(image);
          map.colorSpace = T.SRGBColorSpace;
          const aspect = image.width / image.height, ratio = .41 / .52;
          map.repeat.set(Math.min(1, ratio / aspect), Math.min(1, aspect / ratio));
          map.offset.set((1 - map.repeat.x) / 2, (1 - map.repeat.y) / 2);
          map.needsUpdate = true;
          surface.map = map;
          surface.color.setScalar(1);
          surface.emissiveIntensity = .1;
          surface.needsUpdate = true;
          changed();
        };
        image.src = url;
      });
    },
    dispose() {
      disposed = true;
      photoMaterials.forEach(surface => surface.map?.dispose());
      sky.dispose();
      birds.dispose();
      reflections.target?.dispose();
      art.dispose();
      key.shadow.map?.dispose();
      scene.environment = null;
      scene.clear();
    },
  };
}
