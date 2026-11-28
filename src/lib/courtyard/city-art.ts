import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type CanvasArt = (context: CanvasRenderingContext2D) => void;

/** The city batches its pieces: unit boxes become one instanced mesh per material and parent, other shapes (towers
 *  with their own window scale, spires) are merged into one mesh per material and parent. */
export function cityArt(scene: T.Scene, tokens: CSSStyleDeclaration, anisotropy = 1) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  const batches = new Map<T.Object3D, Map<T.Material, T.Matrix4[]>>();
  const shapes = new Map<T.Object3D, Map<T.Material, T.BufferGeometry[]>>();
  const instances: T.InstancedMesh[] = [];
  const cube = new T.BoxGeometry();
  geometries.add(cube);
  const transform = new T.Object3D();
  const ink = (name: string) => tokens.getPropertyValue('--world-' + name).trim();
  const color = (name: string) => new T.Color(ink(name));

  function material<M extends T.Material>(value: M): M {
    materials.add(value);
    return value;
  }

  function texture(w: number, h: number, paint: CanvasArt) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('City textures are unavailable');
    paint(context);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = anisotropy;
    textures.add(map);
    return map;
  }

  function mesh<G extends T.BufferGeometry>(geometry: G, surface: T.Material, x: number, y: number, z: number, parent: T.Object3D = scene) {
    geometries.add(geometry);
    const piece = new T.Mesh(geometry, surface);
    piece.position.set(x, y, z);
    piece.receiveShadow = surface instanceof T.MeshStandardMaterial;
    parent.add(piece);
    return piece;
  }

  function box(x: number, y: number, z: number, w: number, h: number, d: number, surface: T.Material, parent: T.Object3D = scene) {
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    let parentBatches = batches.get(parent);
    if (!parentBatches) { parentBatches = new Map(); batches.set(parent, parentBatches); }
    let matrices = parentBatches.get(surface);
    if (!matrices) { matrices = []; parentBatches.set(surface, matrices); }
    matrices.push(transform.matrix.clone());
  }

  /** A shape already placed in world space; merged with the others of its material when the city is finished. */
  function shape(geometry: T.BufferGeometry, surface: T.Material, parent: T.Object3D = scene) {
    let parentShapes = shapes.get(parent);
    if (!parentShapes) { parentShapes = new Map(); shapes.set(parent, parentShapes); }
    let list = parentShapes.get(surface);
    if (!list) { list = []; parentShapes.set(surface, list); }
    list.push(geometry); // every shape here is indexed (boxes, cones, planes), as merging needs
  }

  function finish() {
    for (const [parent, groups] of batches) for (const [surface, matrices] of groups) {
      const batch = new T.InstancedMesh(cube, surface, matrices.length);
      matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
      batch.computeBoundingSphere();
      batch.receiveShadow = surface instanceof T.MeshStandardMaterial;
      batch.castShadow = batch.receiveShadow && parent === scene;
      parent.add(batch);
      instances.push(batch);
    }
    batches.clear();
    for (const [parent, groups] of shapes) for (const [surface, list] of groups) {
      const merged = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const piece = mesh(merged, surface, 0, 0, 0, parent);
      piece.castShadow = piece.receiveShadow && parent === scene;
    }
    shapes.clear();
  }

  return {
    ink, color, material, texture, mesh, box, shape, finish,
    dispose() {
      instances.forEach(value => value.dispose());
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      textures.forEach(value => value.dispose());
    },
  };
}

export function seededNoise(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Light granite pavers in two tones with dark joints and a little speckle. */
export function paintPavers(context: CanvasRenderingContext2D) {
  const random = seededNoise(602);
  context.fillStyle = '#6f6c68';
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const base = 168 + Math.floor(random() * 22), warm = random() < .5 ? 4 : -2;
    const gradient = context.createLinearGradient(x, y, x + 62, y + 62);
    gradient.addColorStop(0, `rgb(${base + 8 + warm} ${base + 6} ${base + 2})`);
    gradient.addColorStop(1, `rgb(${base - 6 + warm} ${base - 8} ${base - 12})`);
    context.fillStyle = gradient;
    context.fillRect(x + 2, y + 2, 60, 60);
  }
  for (let i = 0; i < 2600; i++) {
    context.fillStyle = i % 3 ? 'rgba(60,58,55,.16)' : 'rgba(255,255,255,.16)';
    context.fillRect(random() * 256, random() * 256, 1 + random() * 1.5, 1);
  }
}

/** Weathered wooden boardwalk planks for the lakeside. */
export function paintBoardwalk(context: CanvasRenderingContext2D) {
  const random = seededNoise(915);
  context.fillStyle = '#3b2c22';
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const tone = 112 + Math.floor(random() * 30);
    context.fillStyle = `rgb(${tone + 22} ${tone - 2} ${tone - 30})`;
    context.fillRect(0, y + 2, 256, 28);
    for (let i = 0; i < 40; i++) { context.fillStyle = 'rgba(60,40,25,.18)'; context.fillRect(random() * 256, y + 4 + random() * 24, 20 + random() * 60, 1); }
    const seam = random() * 256;
    context.fillStyle = '#3b2c22'; context.fillRect(seam, y + 2, 2, 28);
  }
}

/** Small waves for the lake, as a normal map (the slopes of a few crossing swells), tiling seamlessly. */
export function paintRipples(context: CanvasRenderingContext2D) {
  const size = context.canvas.width, image = context.createImageData(size, size), data = image.data, k = Math.PI * 2 / size;
  const waves = [[3, 1, .9], [-2, 3, .7], [5, -2, .45], [1, 6, .35], [-7, -3, .25]]; // whole cycles across the tile, so it repeats
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let dx = 0, dy = 0;
    for (const [u, v, a] of waves) { const c = Math.cos((u * x + v * y) * k) * a; dx += c * u; dy += c * v; }
    const nx = -dx * .06, ny = -dy * .06, inv = 1 / Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    data[i] = (nx * inv * .5 + .5) * 255; data[i + 1] = (ny * inv * .5 + .5) * 255; data[i + 2] = (inv * .5 + .5) * 255; data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

type Look = { wall: string; glass: string; frame: string; kind: 'glass' | 'concrete' | 'ribbon' };
const LOOKS: Look[] = [
  { kind: 'glass', wall: '#5d7489', glass: '#6f8aa3', frame: '#2c3640' },
  { kind: 'concrete', wall: '#c8bfb0', glass: '#3c4b59', frame: '#ece6da' },
  { kind: 'ribbon', wall: '#4b4f57', glass: '#6c7f92', frame: '#33363c' },
];
/** A tower's face by day: three kinds (glass curtain wall, concrete with punched windows, charcoal with ribbon
 *  windows), 10 windows by 12 floors a tile. paintWindowsAtNight lights the same windows. */
export function paintFacadeDay(context: CanvasRenderingContext2D, variant: number) {
  const look = LOOKS[variant % LOOKS.length], random = seededNoise(211 + variant * 7);
  const rows = 12, cols = 10, rowH = 512 / rows, colW = 512 / cols;
  context.fillStyle = look.wall;
  context.fillRect(0, 0, 512, 512);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col * colW, y = row * rowH, shade = random() * .18;
    if (look.kind === 'glass') {
      const g = context.createLinearGradient(x, y, x + colW, y + rowH);
      g.addColorStop(0, look.glass); g.addColorStop(1, `rgba(20,30,40,${.25 + shade})`);
      context.fillStyle = look.glass; context.fillRect(x, y, colW, rowH);
      context.fillStyle = g; context.fillRect(x, y, colW, rowH);
      context.fillStyle = look.frame; context.fillRect(x, y, 2, rowH); context.fillRect(x, y + rowH - 4, colW, 4);
    } else if (look.kind === 'concrete') {
      context.fillStyle = look.frame; context.fillRect(x + 6, y + 8, colW - 12, rowH - 16);
      context.fillStyle = look.glass; context.fillRect(x + 9, y + 11, colW - 18, rowH - 22);
      context.fillStyle = `rgba(255,255,255,${.06 + shade * .5})`; context.fillRect(x + 9, y + 11, colW - 18, (rowH - 22) * .4);
      context.fillStyle = 'rgba(0,0,0,.12)'; context.fillRect(x, y + rowH - 3, colW, 3);
    } else {
      context.fillStyle = look.glass; context.fillRect(x, y + 10, colW, rowH - 22);
      context.fillStyle = `rgba(255,255,255,${.05 + shade * .4})`; context.fillRect(x, y + 10, colW, (rowH - 22) * .35);
      context.fillStyle = look.frame; context.fillRect(x, y + 10, 2, rowH - 22);
    }
  }
  context.fillStyle = look.wall;
  context.fillRect(0, 0, 5, 9);
}
/** The same windows at night: about half lit, warm or cool, brighter under the ceiling, some with blinds half down,
 *  each with its mullion; whole office floors lit now and then. Used as the emission map. */
export function paintWindowsAtNight(context: CanvasRenderingContext2D, variant: number) {
  const look = LOOKS[variant % LOOKS.length], random = seededNoise(977 + variant * 13);
  const rows = 12, cols = 10, rowH = 512 / rows, colW = 512 / cols;
  context.fillStyle = '#000';
  context.fillRect(0, 0, 512, 512);
  for (let row = 0; row < rows; row++) {
    const office = random() < .08;
    for (let col = 0; col < cols; col++) {
      if (!office && random() < .5) continue;
      const x = col * colW, y = row * rowH, r = random();
      // the glass of this window, as paintFacadeDay draws it
      const [gx, gy, gw, gh] = look.kind === 'concrete' ? [x + 9, y + 11, colW - 18, rowH - 22]
        : look.kind === 'ribbon' ? [x + 2, y + 10, colW - 2, rowH - 22] : [x + 2, y + 1, colW - 2, rowH - 6];
      const tone = office ? [255, 240, 214] : r < .6 ? [255, 214, 160] : r < .88 ? [214, 232, 255] : [255, 186, 150];
      const level = office ? .6 : .35 + random() * .55;
      const light = context.createLinearGradient(0, gy, 0, gy + gh);
      light.addColorStop(0, `rgba(${tone[0]},${tone[1]},${tone[2]},${level})`);
      light.addColorStop(1, `rgba(${tone[0]},${tone[1]},${tone[2]},${level * .55})`);
      context.fillStyle = light;
      context.fillRect(gx, gy, gw, gh);
      if (!office && random() < .35) { context.fillStyle = 'rgba(0,0,0,.72)'; context.fillRect(gx, gy, gw, gh * (.25 + random() * .5)); } // a blind
      if (!office && random() < .25) { context.fillStyle = 'rgba(0,0,0,.5)'; context.fillRect(gx + gw * random() * .6, gy + gh * .45, gw * .3, gh * .55); } // someone's furniture
      context.fillStyle = '#000';
      context.fillRect(gx + gw / 2 - 1, gy, 2, gh); // the mullion
    }
  }
  context.fillStyle = '#000';
  context.fillRect(0, 0, 5, 9);
}

export function paintWallPanels(context: CanvasRenderingContext2D) {
  const panel = context.createLinearGradient(0, 0, 128, 128);
  panel.addColorStop(0, '#e2ddd3');
  panel.addColorStop(1, '#cfc9be');
  context.fillStyle = panel;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = '#a9a398';
  context.fillRect(0, 0, 2, 128);
  context.fillRect(0, 125, 128, 3);
  context.fillStyle = '#f1ede6';
  context.fillRect(3, 0, 1, 128);
}

/** A shop or street sign: a charcoal panel, a coloured bar and white letters. By day it reads as a printed sign; the
 *  scene lights it from behind after sunset. */
export function paintSign(context: CanvasRenderingContext2D, title: string, subtitle: string, hue: string) {
  const background = context.createLinearGradient(0, 0, 0, 152);
  background.addColorStop(0, '#2a2d33');
  background.addColorStop(1, '#1b1d22');
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 152);
  context.strokeStyle = 'rgba(255,255,255,.18)';
  context.lineWidth = 3;
  context.strokeRect(5, 5, 502, 142);
  context.fillStyle = hue;
  context.fillRect(20, 27, 7, 94);
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.font = '800 50px system-ui, sans-serif';
  context.fillText(title, 44, 58, 431);
  context.fillStyle = hue;
  context.font = '700 21px system-ui, sans-serif';
  context.fillText(subtitle, 46, 110, 429);
}

/** A billboard: a printed advert by day, lit from inside at night (the material's emission). */
export function paintBillboard(context: CanvasRenderingContext2D, title: string, subtitle: string, from: string, to: string) {
  const w = context.canvas.width, h = context.canvas.height;
  const g = context.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, from); g.addColorStop(1, to);
  context.fillStyle = g; context.fillRect(0, 0, w, h);
  context.fillStyle = 'rgba(255,255,255,.12)';
  context.beginPath(); context.arc(w * .82, h * .3, h * .5, 0, Math.PI * 2); context.fill();
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.font = `italic 900 ${Math.round(h * .3)}px system-ui, sans-serif`;
  context.fillText(title, w * .06, h * .42, w * .8);
  context.font = `600 ${Math.round(h * .1)}px system-ui, sans-serif`;
  context.fillStyle = 'rgba(255,255,255,.88)';
  context.fillText(subtitle, w * .065, h * .72, w * .8);
}
