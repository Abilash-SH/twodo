/** Original geometry, locally served CC0 surface maps and procedural fallbacks. No external runtime origins. */
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { asset } from '../config';
import { BENCH, TREES } from './state';

export interface Environment { photos(values: readonly (string | null)[], changed: () => void): void; dispose(): void }
export function buildEnvironment(scene: T.Scene, renderer: T.WebGLRenderer, tokens: CSSStyleDeclaration, changed: () => void): Environment {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  const color = (name: string) => new T.Color(tokens.getPropertyValue('--world-' + name).trim());
  let seed = 173;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const texture = (kind: 'plaster' | 'wood' | 'stone' | 'grass' | 'roof') => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d')!;
    const pixels = x.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let i = 0; i < 256; i++) {
      let v = 200 + rand() * 45;
      if (kind === 'wood') v -= Math.abs(Math.sin(i * .22 + Math.sin(y * .025) * 2)) * 44;
      if (kind === 'stone') { const row = Math.floor(y / 64), seam = (i + (row % 2) * 64) % 128; if (y % 64 < 3 || seam < 3) v -= 75; }
      if (kind === 'roof') { const seam = (i + Math.floor(y / 85) * 18) % 43; v -= Math.cos(seam / 43 * Math.PI * 2) * 22; if (y % 85 < 3) v -= 45; }
      if (kind === 'grass') v -= rand() * 48;
      const p = (y * 256 + i) * 4; pixels.data[p] = pixels.data[p + 1] = pixels.data[p + 2] = v; pixels.data[p + 3] = 255;
    }
    x.putImageData(pixels, 0, 0);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(kind === 'grass' ? 40 : 3, kind === 'grass' ? 40 : 3); t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t); return t;
  };
  function mat(role: string, kind?: Parameters<typeof texture>[0], extra: T.MeshStandardMaterialParameters = {}) {
    const map = kind ? texture(kind) : null;
    const m = new T.MeshStandardMaterial({ color: color(role), map, bumpMap: map, bumpScale: kind === 'plaster' ? .04 : .025, roughness: .93, ...extra }); materials.add(m); return m;
  }
  const plaster = mat('plaster', 'plaster'), wood = mat('wood', 'wood'), darkWood = mat('wood-dark', 'wood'), stone = mat('stone', 'plaster');
  const grass = mat('grass', 'grass'), roof = mat('roof', 'roof'), leaf = mat('leaf');
  const glass = mat('water', undefined, { roughness: .15, metalness: .2 });
  function mesh(g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, parent: T.Object3D = scene) {
    geometries.add(g); const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, m: T.Material, parent?: T.Object3D) => mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent);
  const cylinder = (x: number, y: number, z: number, r: number, h: number, m: T.Material) => mesh(new T.CylinderGeometry(r * .8, r, h, 9), m, x, y, z);
  function rock(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const g = new T.IcosahedronGeometry(1, 1), pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const f = .88 + rand() * .2; pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f); } g.computeVertexNormals();
    const o = mesh(g, stone, x, y, z); o.scale.set(sx, sy, sz); o.rotation.y = rand() * Math.PI; return o;
  }
  scene.background = color('sky'); scene.fog = new T.Fog(color('sky'), 19, 43);
  scene.add(new T.HemisphereLight(color('sky'), color('earth'), 2));
  const sunlight = new T.DirectionalLight(color('sun'), 3.2); sunlight.position.set(-6, 10, 5); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024); Object.assign(sunlight.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: 1, far: 28 }); sunlight.shadow.bias = -.0006; sunlight.shadow.normalBias = .035; scene.add(sunlight);
  const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .35; room.dispose(); pmrem.dispose();
  const ground = mesh(new T.PlaneGeometry(70, 70), grass, 0, -.025, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  // Grounded, irregular stepping stones rather than an island floating in space.
  for (let i = 0; i < 15; i++) rock(-.7 + Math.sin(i * .7) * .2, .015, 7 - i * .7, .57, .055, .38);
  for (let i = 0; i < 13; i++) rock(-5.2 + i * .8, .012, 3.3 + Math.sin(i) * .15, .48, .05, .38);
  for (let i = 0; i < 7; i++) rock(3.8 + Math.sin(i) * .15, .012, 2.7 - i * .85, .45, .05, .38);
  // Plaster cottage, pitched tiled roof, shutters, porch and hand-built furniture.
  box(-4.8, 1.35, -4.5, 4.4, 2.7, 3.4, plaster);
  box(-4.8, .15, -2.3, 5, .3, 1.25, stone);
  for (const side of [-1, 1]) { const r = box(-4.8 + side * 1.22, 3.06, -4.5, 2.65, .13, 4, roof); r.rotation.z = -side * .42; }
  box(-4.8, 3.6, -4.5, .16, .13, 4, darkWood);
  for (const [z, reverse] of [[-2.8, false], [-6.2, true]] as const) {
    const points = [[-7, 2.7, z], [-2.6, 2.7, z], [-4.8, 3.6, z]];
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute((reverse ? points.reverse() : points).flat(), 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2)); g.computeVertexNormals(); mesh(g, plaster, 0, 0, 0);
  }
  box(-4.7, 1.02, -2.785, .8, 2.04, .08, darkWood);
  cylinder(-4.41, 1, -2.72, .035, .06, stone).rotation.x = Math.PI / 2;
  for (const x of [-6, -3.5]) {
    box(x, 1.5, -2.77, .78, .85, .035, glass);
    for (const sx of [-.48, .48]) box(x + sx, 1.5, -2.67, .22, 1.08, .08, wood);
    box(x, 1.5, -2.72, .035, .85, .04, darkWood); box(x, 1.5, -2.72, .8, .035, .04, darkWood);
    box(x, 1.01, -2.61, 1.1, .08, .24, stone);
  }
  for (const x of [-7.1, -2.5]) cylinder(x, 1.3, -1.8, .07, 2.6, darkWood);
  const porchRoof = box(-4.8, 2.8, -1.92, 5.3, .12, 1.9, wood); porchRoof.rotation.x = -.09;
  for (let i = 0; i < 6; i++) box(-7 + i * .85, 2.75, -2.05, .06, .12, 1.6, darkWood);
  // Pond: reflection from one environment texture, no secondary scene rendering every frame.
  const waterMat = new T.MeshPhysicalMaterial({ color: color('water'), roughness: .19, metalness: .15, clearcoat: .6, clearcoatRoughness: .2 }); materials.add(waterMat);
  const water = mesh(new T.CircleGeometry(1, 48), waterMat, .2, .012, -.6); water.rotation.x = -Math.PI / 2; water.scale.set(1.8, 1.35, 1); water.castShadow = false;
  for (let i = 0; i < 22; i++) { const a = i * Math.PI * 2 / 22; rock(.2 + Math.cos(a) * 1.95, .1, -.6 + Math.sin(a) * 1.5, .24 + rand() * .1, .16, .22); }
  // Bench: the seat height and authored seated pose share a human-scale origin.
  for (const x of [3.1, 5.3]) { box(x, .25, 2.6, .09, .5, .65, darkWood); box(x, .76, 2.29, .07, .6, .07, darkWood); }
  for (let i = 0; i < 4; i++) box(BENCH.x, .48, 2.3 + i * .18, 2.65, .07, .14, wood);
  for (let i = 0; i < 3; i++) box(BENCH.x, .71 + i * .13, 2.27, 2.65, .1, .07, wood);
  // Journal table and book, with separate covers, pages and spine.
  for (const x of [-3.3, -2.1]) for (const z of [-2.88, -2.3]) box(x, .36, z, .07, .72, .07, darkWood);
  box(-2.7, .76, -2.6, 1.5, .09, .8, wood);
  box(-2.7, .83, -2.6, .65, .035, .43, darkWood); box(-2.7, .86, -2.6, .61, .04, .4, plaster); box(-2.7, .89, -2.6, .018, .015, .4, darkWood);
  // Existing shared Moments become physical prints; no new storage or external requests.
  const photoMaterials: T.MeshStandardMaterial[] = [];
  for (const x of [3.2, 5.6]) cylinder(x, .97, -4.15, .04, 1.94, wood);
  box(4.4, 1.8, -4.15, 2.45, .025, .025, darkWood);
  for (const x of [3.85, 4.95]) { const paper = glass.clone(); materials.add(paper); photoMaterials.push(paper); box(x, 1.37, -4.15, .85, .88, .025, plaster); box(x, 1.43, -4.125, .72, .61, .012, paper); box(x, 1.8, -4.12, .055, .15, .04, wood); }
  for (let i = 0; i < 3; i++) { cylinder(-5.4 + i * .75, .15, 4.3, .27, .3, roof); cylinder(-5.4 + i * .75, .52, 4.3, .018, .55, leaf); rock(-5.4 + i * .75, .72, 4.3, .15, .12, .15); }
  // Individual leaves share one alpha-cut texture and one instanced draw call.
  const lc = document.createElement('canvas'); lc.width = lc.height = 64; const lx = lc.getContext('2d')!;
  lx.fillStyle = '#fff'; lx.beginPath(); lx.ellipse(32, 32, 14, 29, .3, 0, Math.PI * 2); lx.fill();
  lx.strokeStyle = '#bbb'; lx.lineWidth = 1; lx.beginPath(); lx.moveTo(24, 57); lx.lineTo(40, 7); lx.stroke();
  const leafTexture = new T.CanvasTexture(lc); textures.add(leafTexture);
  const leafMat = new T.MeshStandardMaterial({ color: color('leaf'), map: leafTexture, alphaTest: .5, side: T.DoubleSide, roughness: 1 }); materials.add(leafMat);
  const leafGeo = new T.PlaneGeometry(.18, .32); geometries.add(leafGeo);
  const leaves = new T.InstancedMesh(leafGeo, leafMat, TREES.length * 360 + 320); leaves.castShadow = true; leaves.receiveShadow = true;
  const dummy = new T.Object3D(); let index = 0;
  function foliage(x: number, y: number, z: number, spread: number, count: number) {
    for (let i = 0; i < count; i++) { const a = rand() * Math.PI * 2, b = Math.acos(rand() * 2 - 1), radius = Math.cbrt(rand()) * spread;
      dummy.position.set(x + Math.sin(b) * Math.cos(a) * radius, y + Math.cos(b) * radius * .7, z + Math.sin(b) * Math.sin(a) * radius);
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI); dummy.scale.setScalar(.6 + rand() * .7); dummy.updateMatrix(); leaves.setMatrixAt(index, dummy.matrix); leaves.setColorAt(index, new T.Color().setScalar(.8 + rand() * .4)); index++;
    }
  }
  TREES.forEach(({ x, z }, i) => { cylinder(x, 1.5, z, .17, 3, darkWood); for (const side of [-1, 1]) { const branch = cylinder(x + side * .4, 2.3, z, .07, 1.6, wood); branch.rotation.z = side * -.55; } foliage(x, 3.25 + (i % 2) * .3, z, 1.65, 360); });
  for (let i = 0; i < 8; i++) foliage(-8 + i * 2.2, .65, -7.6, .65, 40);
  scene.add(leaves);
  // A low garden wall gives the playable boundary an intentional place in the world.
  box(0, .45, -8.5, 20, .9, .3, plaster); box(-9.5, .35, 0, .25, .7, 17, stone); box(9.5, .35, 0, .25, .7, 17, stone);
  const photoUrls: (string | null)[] = [null, null], versions = [0, 0]; let disposed = false;
  // Four optimized maps (828 KB total), fetched only after entering. A previously visited world works offline.
  const surfaces: Record<string, T.MeshStandardMaterial[]> = { grass: [grass], plaster: [plaster], wood: [wood, darkWood], stone: [stone] };
  for (const [name, targets] of Object.entries(surfaces)) {
    const url = asset(`world/${name}.jpg`);
    const kept = navigator.onLine || typeof caches === 'undefined' ? Promise.resolve(navigator.onLine) : caches.match(url).then(r => !!r, () => false);
    void kept.then(ok => {
      if (!ok || disposed) return;
      new T.TextureLoader().load(url, t => {
        if (disposed) { t.dispose(); return; }
        t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(name === 'grass' ? 35 : 1, name === 'grass' ? 35 : 1);
        t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t);
        targets.forEach(m => { m.map = t; if (name !== 'plaster') m.color.setScalar(m === darkWood ? .65 : 1); m.needsUpdate = true; }); changed();
      }, undefined, () => { /* material fallback remains; a decorative download never blanks the scene */ });
    });
  }
  return {
    photos(values, changed) {
      photoMaterials.forEach((m, i) => {
        const url = values[i] || null; if (url === photoUrls[i]) return;
        photoUrls[i] = url; const version = ++versions[i];
        if (m.map) { textures.delete(m.map); m.map.dispose(); m.map = null; } m.color.copy(glass.color); m.needsUpdate = true; changed();
        if (!url || url.length > 140000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(url)) return;
        const image = new Image(); image.onload = () => {
          if (disposed || version !== versions[i] || image.width < 1 || image.height < 1 || image.width * image.height > 1048576 || Math.max(image.width, image.height) > 2048) return;
          const t = new T.Texture(image); t.colorSpace = T.SRGBColorSpace;
          const aspect = image.width / image.height, ratio = .72 / .61;
          t.repeat.set(Math.min(1, ratio / aspect), Math.min(1, aspect / ratio)); t.offset.set((1 - t.repeat.x) / 2, (1 - t.repeat.y) / 2);
          t.needsUpdate = true; textures.add(t); m.map = t; m.color.setScalar(1); m.needsUpdate = true; changed();
        }; image.src = url;
      });
    },
    dispose() { disposed = true; environment.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); sunlight.shadow.map?.dispose(); scene.clear(); },
  };
}
