/** Original 3D city art. All local textures are painted once when Explore opens. */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cityArt, paintFacade, paintPavers, paintSign, paintWallPanels, seededNoise } from './city-art';
import { BENCH, FOUNTAIN, FURNITURE, MOMENTS_KIOSK, PLAZA_FIXTURES, ROOMS, TASK_TERMINAL, walls, type RoomName } from './state';

export function buildEnvironment(scene: T.Scene, tokens: CSSStyleDeclaration) {
  const art = cityArt(scene, tokens);
  const { box, mesh, material, texture, ink, color } = art;
  const solid = (role: string, options: T.MeshStandardMaterialParameters = {}) =>
    material(new T.MeshStandardMaterial({ color: color(role), roughness: .72, ...options }));
  const light = (role: string) => material(new T.MeshBasicMaterial({ color: color(role), toneMapped: false }));
  const panelMap = texture(128, 128, paintWallPanels);
  panelMap.wrapS = panelMap.wrapT = T.RepeatWrapping;
  panelMap.repeat.set(3, 2);
  const frame = solid('frame'), panels = solid('panel', { map: panelMap }), chrome = solid('steel', { metalness: .22 });
  const floor = solid('floor'), textile = solid('cloth'), cushion = solid('cushion');
  const cyan = light('cyan'), pink = light('pink'), amber = light('amber'), white = light('white');
  const glass = solid('glass', { roughness: .32, emissive: color('glass'), emissiveIntensity: .65 });
  const asphalt = solid('asphalt');
  const floorMap = texture(256, 256, paintPavers);
  floorMap.wrapS = floorMap.wrapT = T.RepeatWrapping;
  floorMap.repeat.set(7, 6);
  const pavement = solid('pavement', { map: floorMap, roughness: .5 });

  scene.background = color('sky');
  scene.fog = new T.Fog(color('sky'), 23, 59);
  scene.add(new T.HemisphereLight(color('fill'), color('bounce'), 1.9));
  const key = new T.DirectionalLight(color('key'), 2.15);
  key.position.set(-5, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 32 });
  key.shadow.normalBias = .045;
  key.shadow.bias = -.0007;
  scene.add(key);

  function rect(w: number, h: number, x: number, y: number, z: number, surface: T.Material, parent?: T.Object3D) {
    return mesh(new T.PlaneGeometry(w, h), surface, x, y, z, parent);
  }
  function sign(title: string, subtitle: string, role: string, x: number, y: number, z: number, w: number, parent?: T.Object3D) {
    const surface = material(new T.MeshBasicMaterial({
      map: texture(512, 152, ctx => paintSign(ctx, title, subtitle, ink(role))), toneMapped: false,
    }));
    box(x, y, z - .065, w + .08, w * .297 + .08, .11, frame, parent);
    return rect(w, w * .297, x, y, z, surface, parent);
  }
  function ground(w: number, d: number, x: number, y: number, z: number, surface: T.Material) {
    rect(w, d, x, y, z, surface).rotation.x = -Math.PI / 2;
  }

  ground(89, 89, 0, -.08, 0, asphalt);
  ground(19.3, 17.1, 0, -.02, -.16, pavement);
  // Edge lighting and crosswalks outline the playable city block.
  for (const x of [-9.45, 9.45]) {
    box(x, .04, 0, .24, .12, 16.8, frame);
    box(x * .997, .105, 0, .042, .012, 16.65, cyan);
    for (let z = -7; z <= 9; z += 2.8) box(x * 1.22, -.067, z, .067, .01, 1.02, amber);
  }
  for (let x = -4; x <= 4; x += .5) box(x, -.012, 8.75, .24, .012, 1.4, chrome);
  for (const x of [-7, 7]) box(x, .16, -8.35, 4.4, .36, .32, frame);
  for (const x of [-7, 7]) box(x, .345, -8.16, 4.3, .037, .035, cyan);

  const pools = texture(96, 96, context => {
    const glow = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    glow.addColorStop(0, 'rgba(255,255,255,.9)');
    glow.addColorStop(.36, 'rgba(255,255,255,.38)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 96, 96);
  });
  function spill(role: string, opacity: number) {
    return material(new T.MeshBasicMaterial({
      color: color(role), map: pools, transparent: true, depthWrite: false, opacity, blending: T.AdditiveBlending,
    }));
  }
  const bluePool = spill('cyan', .34), warmPool = spill('amber', .4), pinkPool = spill('pink', .26);
  ground(7.1, 8.1, FOUNTAIN.x, .001, FOUNTAIN.z + 1.5, bluePool);
  ground(5.6, 6.5, -5.1, .005, -1.4, warmPool);
  ground(6.2, 6.7, 4.9, .007, -2.3, pinkPool);
  ground(4.6, 6.5, 4.6, .002, 3.6, bluePool);
  ground(5.5, 6.5, -7.5, .003, 3, warmPool);
  for (const side of [-1, 1]) {
    for (let z = 1.4; z <= 7; z += 1.6) {
      box(side * 2.14, -.006, z, .033, .008, 1.07, side < 0 ? amber : cyan);
    }
    ground(1.5, 7.4, side * 2.14, .004, 4.2, side < 0 ? warmPool : bluePool);
  }

  const facade = [0, 1, 2].map(i => material(new T.MeshBasicMaterial({
    map: texture(256, 512, ctx => paintFacade(ctx, i)), toneMapped: false,
  })));
  const random = seededNoise(888);
  function tower(x: number, z: number, w: number, d: number, h: number, index: number) {
    box(x, h / 2, z, w, h, d, facade[index % facade.length]);
    box(x, h + .1, z, w + .13, .18, d + .13, frame);
    const trim = [cyan, pink, glass][index % 3];
    box(x, h - .16, z + d * .5 + .04, w * .94, .055, .052, trim);
    if (index % 2 === 0) box(x + w * .42, h * .55, z + d * .5 + .05, .045, h * .86, .075, cyan);
    if (index % 3 === 0) {
      box(x, h + .88, z, .075, 1.5, .075, chrome);
      box(x, h + 1.65, z, .14, .14, .14, pink);
    }
    box(x, 1.45, z + .04, w + .15, 2.9, d + .13, panels);
  }
  const blocks = [
    [-16, -12.4, 5.3, 5.0, 12.4], [-9.7, -14.6, 4.9, 4.7, 18.4], [-4.6, -13.9, 3.7, 4.4, 12.1],
    [.15, -17.5, 4.7, 5.0, 23.1], [4.85, -14.8, 4.0, 4.8, 15.1], [10, -14.2, 4.6, 4.9, 18.6],
    [16, -11.5, 5.0, 5.0, 13.2], [-13.5, -4.5, 4.4, 4.4, 10.8], [13.4, -5, 4.2, 4.9, 16],
    [-13.25, 2, 4.7, 4.6, 16.2], [13.5, 1.9, 4.2, 4.5, 10.4],
    [-14.4, 8.5, 5.1, 4.0, 11.6], [14.5, 8.1, 4.8, 4.2, 14.1],
    [-8, 20, 4.9, 4.1, 16.1], [-1, 21.5, 4.4, 5.0, 12.3], [6, 20.5, 5.5, 4.7, 17.8],
  ] as const;
  blocks.forEach(([x, z, w, d, h], i) => tower(x, z, w, d, h, i));
  for (let i = 0; i < 12; i++) tower(-30 + i * 5.35, -23 - 4 * random(), 3 + 1.7 * random(), 4.2, 12 + 17 * random(), i + 1);
  // Real setbacks, frosted billboards and warm shopfront panels give the skyline a more varied scale.
  box(.15, 24.1, -17.5, 3.5, 2.0, 3.7, facade[0]);
  box(.15, 25.16, -17.5, 3.62, .12, 3.78, cyan);
  sign('MOONLINE', 'ELEVATED TRANSIT', 'cyan', .1, 7.3, -14.96, 3.7);
  sign('NIGHT MARKET', 'LATE COUNTER', 'amber', -4.6, 4.45, -11.65, 2.7);
  sign('SIGNAL', 'CITY LINK', 'pink', 4.85, 8.6, -12.35, 2.95);
  for (const x of [-8, -4.3, 0, 4.5, 8.5]) {
    box(x, 1.55, -11.6, 1.75, 2.04, .12, amber);
    for (const edge of [-.56, 0, .56]) box(x + edge, 1.55, -11.5, .05, 2.05, .06, frame);
    box(x, 1.27, -11.49, 1.74, .058, .07, frame);
    box(x, 2.7, -11.43, 1.97, .11, .59, chrome);
  }
  box(.1, 1.31, -10.93, 3.65, 2.63, 1.36, frame);
  box(.1, 1.14, -10.235, 3.42, 1.78, .06, glass);
  for (let i = 0; i < 5; i++) {
    const x = -1.5 + i * .8;
    box(x, 1.14, -10.197, .035, 1.78, .035, chrome);
    box(x + .28, 1.73, -10.18, .37, .047, .045, amber);
  }
  box(.1, .82, -10.146, 3.4, .058, .086, chrome);
  sign('NIGHT KITCHEN', 'LATE COUNTER', 'amber', .1, 2.54, -10.2, 3.01);
  box(.1, 2.14, -9.99, 3.88, .095, .5, chrome);
  box(.1, 2.087, -9.75, 3.69, .029, .036, amber);
  ground(5.2, 5.25, .1, -.061, -9.75, warmPool);

  const railZ = -9.35;
  box(0, 4.34, railZ, 65, .44, 1.92, chrome);
  box(0, 4.61, railZ, 65, .16, .95, frame);
  box(0, 4.48, railZ + .98, 65, .066, .045, cyan);
  box(0, 4.22, railZ + .98, 65, .032, .045, white);
  for (const x of [-24, -16, -8, 3.1, 10.8, 18.6, 26]) {
    box(x, 2, railZ, .55, 4.1, .65, panels);
    box(x, 3.92, railZ, 1.25, .42, 1.47, chrome);
    box(x, 1.85, railZ + .345, .055, 2.8, .04, glass);
  }
  for (let x = -29; x < 30; x += 1.5) {
    box(x, 4.66, railZ + .9, .035, .29, .037, chrome);
    box(x, 4.14, railZ + .98, .42, .033, .044, glass);
  }
  const train = new T.Group();
  train.position.set(-1.55, 5.11, railZ);
  scene.add(train);
  for (const x of [-2.14, 2.14]) {
    mesh(new RoundedBoxGeometry(4.15, .8, 1.12, 2, .22), chrome, x, 0, 0, train);
    box(x, -.26, .562, 3.84, .057, .028, cyan, train);
    box(x, .307, .51, 3.8, .046, .035, glass, train);
    for (let i = 0; i < 5; i++) box(x + (i - 2) * .65, .055, .566, .56, .262, .034, i === 2 ? white : amber, train);
    box(x, 0, .588, .035, .51, .04, frame, train);
  }
  box(0, -.25, 0, .23, .24, .66, frame, train);
  box(-4.01, -.13, .46, .15, .09, .135, pink, train);
  box(4.01, -.13, .46, .15, .09, .135, white, train);

  const roofs = new Map<RoomName, T.Group>();
  for (const [name, room] of Object.entries(ROOMS) as [RoomName, typeof ROOMS[RoomName]][]) {
    const { minX, maxX, back, front, doorLeft, doorRight } = room;
    const x = (minX + maxX) / 2, z = (back + front) / 2, w = maxX - minX, d = front - back;
    const entry = (doorLeft + doorRight) / 2, opening = doorRight - doorLeft;
    const loft = name === 'villa', accent = loft ? amber : cyan;
    const rim = loft ? pink : cyan;
    const roof = new T.Group();
    scene.add(roof);
    roofs.set(name, roof);
    for (const wall of walls(room)) box(wall.x, wall.h / 2, wall.z, wall.w, wall.h, wall.d, panels);
    box(x, -.02, z, w, .048, d, floor);
    box(entry, .008, front + .43, opening + .19, .043, 1.1, chrome);
    box(entry, .037, front + .91, opening + .17, .017, .035, accent);
    for (const edge of [doorLeft, doorRight]) {
      box(edge, 1.13, front + .06, .14, 2.25, .24, frame);
      box(edge, 1.13, front + .192, .032, 2.17, .033, accent);
    }
    box(entry, 2.48, front, opening, .64, .21, chrome, roof);
    box(x, 2.83, z, w + .37, .2, d + .33, frame, roof);
    box(x, 2.92, front + .26, w + .39, .056, .046, rim, roof);
    box(entry, 2.47, front + .39, opening + .57, .13, .83, frame, roof);
    box(entry, 2.42, front + .8, opening + .59, .039, .036, accent, roof);
    sign(loft ? 'AFTER HOURS' : 'MOTOR BAY', loft ? 'JOURNAL LOUNGE' : 'WORKBENCH', loft ? 'amber' : 'cyan',
      x, 3.11, front + .1, 2.72, roof);
    for (const side of [-1, 1]) {
      const start = side < 0 ? minX : doorRight, end = side < 0 ? doorLeft : maxX;
      const width = end - start - .36;
      if (width < .5) continue;
      const px = (start + end) / 2;
      box(px, 1.29, front + .11, width, 1.24, .04, frame);
      box(px, 1.32, front + .138, width - .12, 1.08, .018, loft ? amber : glass);
      for (let i = -1; i <= 1; i++) box(px + i * width * .29, 1.32, front + .17, .054, 1.15, .03, frame);
      box(px, 1.48, front + .177, width, .068, .05, frame);
      box(px, .67, front + .16, width + .12, .042, .1, chrome);
    }
    for (const rail of [minX, maxX]) box(rail, 2.12, z, .075, .06, d - .18, accent);
    box(x, 2.14, back + .11, w - .2, .067, .065, rim);
    for (let i = 0; i < 5; i++) {
      box(x - 1.6 + .8 * i, .63, back + .108, .49, .65, .06, frame);
      box(x - 1.6 + .8 * i, .93, back + .144, .38, .022, .018, i % 2 ? glass : accent);
    }
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
  box(sofa.x + .43, .22, sofa.z, .026, .046, sofa.d * .81, pink);
  const desk = FURNITURE.desk;
  box(desk.x, .78, desk.z, desk.w, .1, desk.d, chrome);
  box(desk.x, .4, desk.z, desk.w * .8, .72, desk.d * .7, frame);
  box(desk.x, .85, desk.z + .13, .46, .027, .25, amber);
  sign('JOURNAL', 'TODAY’S PAGE', 'amber', desk.x, 1.21, desk.z - .23, .85);
  ground(3.5, 3, -5.5, .008, -5.26, warmPool);
  const workbench = FURNITURE.workbench;
  box(workbench.x, .88, workbench.z, workbench.w, .12, workbench.d, chrome);
  box(workbench.x, .41, workbench.z, workbench.w * .91, .83, workbench.d * .77, frame);
  box(workbench.x, .71, workbench.z + workbench.d * .42, workbench.w * .85, .03, .051, cyan);
  box(workbench.x, 1.42, workbench.z - .24, workbench.w, .76, .053, chrome);
  for (let i = 0; i < 6; i++) {
    const x = workbench.x - .92 + .36 * i;
    box(x, 1.46, workbench.z - .184, .062, .21 + .025 * i, .072, i % 2 ? amber : white);
  }
  const crate = FURNITURE.boxes;
  box(crate.x, .33, crate.z, crate.w, .66, crate.d, panels);
  for (const y of [.09, .58]) box(crate.x, y, crate.z, crate.w + .035, .059, crate.d + .037, chrome);
  box(crate.x, .38, crate.z + crate.d / 2 + .011, .44, .057, .02, amber);
  for (const x of [3.15, 6.81]) box(x, .017, -5.03, .059, .014, 2.4, cyan);

  const { x: fx, z: fz, rx, rz } = FOUNTAIN;
  function basin(radius: number, y: number, depth: number, surface: T.Material) {
    const pool = mesh(new T.CylinderGeometry(radius, radius, depth, 40), surface, fx, y, fz);
    pool.scale.set(rx - .23, 1, rz - .23);
  }
  basin(1, .17, .34, frame);
  basin(.99, .356, .047, cyan);
  basin(.93, .382, .026, glass);
  basin(.69, .407, .018, solid('water', { roughness: .31, emissive: color('water'), emissiveIntensity: .4 }));
  // Each slim water jet is static; reflected cyan pools light the paving without a reflection pass.
  const jets: T.TubeGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, cx = Math.cos(angle), sz = Math.sin(angle);
    const points = [new T.Vector3(cx * 1.05, 0, sz * .74), new T.Vector3(cx * .53, .69 + i % 3 * .075, sz * .38),
      new T.Vector3(cx * .13, .15, sz * .11)];
    jets.push(new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, .015 + i % 2 * .008, 4, false));
  }
  const arcs = mergeGeometries(jets);
  jets.forEach(value => value.dispose());
  if (arcs) mesh(arcs, cyan, fx, .42, fz);
  for (let i = 0; i < 4; i++) box(fx + (i - 1.5) * .069, .78, fz + (i % 2) * .11, .025, .72 + .12 * (i % 2), .025, white);

  // Existing seats and obstacle centres remain fixed for compatible two-player movement.
  for (const x of [BENCH.x - 1.03, BENCH.x + 1.03]) box(x, .23, BENCH.z, .12, .45, .62, chrome);
  box(BENCH.x, .5, BENCH.z, 2.63, .12, .66, textile);
  box(BENCH.x, .8, BENCH.z - .3, 2.62, .46, .085, chrome);
  box(BENCH.x, .522, BENCH.z + .34, 2.6, .035, .045, cyan);
  for (const { x, z } of PLAZA_FIXTURES) {
    box(x, .34, z, .53, .68, .55, frame);
    box(x, .66, z, .62, .055, .64, chrome);
    box(x, 1.51, z, .074, 1.65, .074, frame);
    box(x, 2.36, z, .56, .12, .31, chrome);
    box(x, 2.288, z, .5, .04, .26, white);
    ground(3.25, 3.25, x, .005, z, bluePool);
  }

  // The kiosk fits the existing fixture clearance and keeps the garage entrance open.
  const photoMaterials = [0, 1].map(() => solid('glass', { emissive: color('glass'), emissiveIntensity: .45 }));
  const kiosk = MOMENTS_KIOSK;
  box(kiosk.x, 1.36, kiosk.z, .96, 1.17, .32, frame);
  sign('MOMENTS', 'PHOTO KIOSK', 'pink', kiosk.x, 1.83, kiosk.z + .183, .91);
  photoMaterials.forEach((surface, i) => box(kiosk.x - .23 + .46 * i, 1.32, kiosk.z + .183, .41, .52, .036, surface));
  box(kiosk.x, .98, kiosk.z + .186, .94, .031, .033, pink);
  ground(3.4, 3.6, kiosk.x, .006, kiosk.z + .5, pinkPool);
  box(TASK_TERMINAL.x, .91, TASK_TERMINAL.z, .67, .54, .51, frame);
  sign('TODAY', 'TASK PATCH', 'cyan', TASK_TERMINAL.x, 1.07, TASK_TERMINAL.z + .27, .61);
  for (const x of [-5.8, -5.2, -4.6, -4]) box(x, .006, 3.42, .29, .018, .04, cyan);

  art.finish();
  const photoUrls: (string | null)[] = [null, null];
  const versions = [0, 0];
  let disposed = false;
  return {
    area(name: RoomName | 'garden') { roofs.forEach((roof, id) => { roof.visible = name !== id; }); },
    advance(seconds: number) {
      train.position.x += seconds * 3.4;
      if (train.position.x > 34) train.position.x -= 68;
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
        surface.emissiveIntensity = .45;
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
      art.dispose();
      key.shadow.map?.dispose();
      scene.clear();
    },
  };
}
