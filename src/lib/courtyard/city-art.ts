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

/** Dark plaza tiles with fine glowing seams, like a circuit board you can walk on (map and emission). */
export function paintPavers(context: CanvasRenderingContext2D) {
  const random = seededNoise(602);
  context.fillStyle = '#05040c';
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const shade = Math.floor(22 + random() * 10);
    const gradient = context.createLinearGradient(x, y, x + 60, y + 62);
    gradient.addColorStop(0, `rgb(${shade + 8} ${shade + 4} ${shade + 30})`);
    gradient.addColorStop(1, `rgb(${shade - 4} ${shade - 6} ${shade + 14})`);
    context.fillStyle = gradient;
    context.fillRect(x + 2, y + 2, 60, 60);
    context.fillStyle = 'rgba(200,190,255,.12)';
    context.fillRect(x + 2, y + 2, 60, 1);
  }
  // Seams: most faint, a few lit, so lines of light run across the plaza.
  for (let i = 0; i <= 4; i++) {
    const lit = i === 0 || i === 2;
    context.fillStyle = lit ? 'rgba(94,242,255,.75)' : 'rgba(94,242,255,.16)';
    context.fillRect(i * 64 - 1, 0, 2, 256);
    context.fillStyle = i === 2 ? 'rgba(255,111,208,.55)' : 'rgba(255,111,208,.1)';
    context.fillRect(0, i * 64 - 1, 256, 2);
  }
  for (let i = 0; i < 1800; i++) {
    context.fillStyle = i % 2 ? 'rgba(180,170,255,.05)' : 'rgba(0,0,0,.18)';
    context.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1);
  }
}

/** Window light for the glass towers: 10 windows by 12 floors per tile, used as the emission map, so lit windows glow
 *  and everything else stays dark glass that reflects the neon. Three moods: warm offices, cool flats, neon bands. */
export function paintFacade(context: CanvasRenderingContext2D, variant: number) {
  const random = seededNoise(132 + variant * 17);
  context.fillStyle = '#000';
  context.fillRect(0, 0, 512, 512);
  const pick = (r: number) => variant === 0
    ? (r < .62 ? '#ffe2b8' : r < .9 ? '#cfe9ff' : r < .96 ? '#5ef2ff' : '#ff6fd0')
    : variant === 1 ? (r < .5 ? '#cfe9ff' : r < .82 ? '#ffe2b8' : r < .93 ? '#5ef2ff' : '#a98bff')
      : (r < .45 ? '#ffe2b8' : r < .7 ? '#cfe9ff' : r < .86 ? '#a98bff' : '#ff6fd0');
  const rows = 12, cols = 10, rowH = 512 / rows, colW = 512 / cols;
  for (let row = 0; row < rows; row++) {
    const fullFloor = variant === 0 && random() < .14;
    for (let col = 0; col < cols; col++) {
      const x = col * colW, y = row * rowH;
      if (!fullFloor && random() < .5) continue; // dark window: glass only
      context.globalAlpha = fullFloor ? .7 : .3 + random() * .5;
      context.fillStyle = fullFloor ? '#ffe9c8' : pick(random());
      context.fillRect(x + 4, y + 8, colW - 8, rowH - 14);
      if (random() < .4) { context.globalAlpha = .6; context.fillStyle = '#000'; context.fillRect(x + 4, y + 8 + (rowH - 14) * (.4 + random() * .4), colW - 8, rowH - 14); }
      context.globalAlpha = 1;
      context.fillStyle = '#000';
      context.fillRect(x + colW / 2 - 1, y + 8, 2, rowH - 14);
    }
    context.fillStyle = '#000';
    context.fillRect(0, row * rowH + rowH - 6, 512, 6);
  }
  if (variant === 2) for (let row = 2; row < rows; row += 4) { context.fillStyle = '#ff4fd8'; context.fillRect(0, row * rowH + rowH - 6, 512, 3); }
  if (variant === 1) for (const x of [0, 256]) { context.fillStyle = '#5ef2ff'; context.fillRect(x, 0, 2, 512); }
  // the top-left corner stays black: roofs and floors sample it
  context.fillStyle = '#000';
  context.fillRect(0, 0, 5, 9);
}

export function paintWallPanels(context: CanvasRenderingContext2D) {
  const steel = context.createLinearGradient(0, 0, 128, 128);
  steel.addColorStop(0, '#3a3466');
  steel.addColorStop(.65, '#2a2550');
  steel.addColorStop(1, '#332d5c');
  context.fillStyle = steel;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = '#16122e';
  context.fillRect(0, 0, 2, 128);
  context.fillRect(0, 125, 128, 3);
  context.fillStyle = '#5b528f';
  context.fillRect(3, 0, 1, 128);
  context.fillRect(0, 123, 128, 1);
  context.fillStyle = 'rgba(156,123,255,.45)';
  context.fillRect(64, 0, 1, 128);
}

export function paintSign(context: CanvasRenderingContext2D, title: string, subtitle: string, hue: string) {
  const background = context.createLinearGradient(0, 0, 512, 152);
  background.addColorStop(0, '#1d1446');
  background.addColorStop(1, '#0d0824');
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 152);
  context.strokeStyle = hue;
  context.lineWidth = 5;
  context.strokeRect(6, 6, 500, 140);
  context.fillStyle = hue;
  context.fillRect(20, 27, 7, 94);
  context.textBaseline = 'middle';
  context.shadowColor = hue;
  context.shadowBlur = 14;
  context.fillStyle = '#ffffff';
  context.font = 'italic 800 52px system-ui, sans-serif';
  context.fillText(title, 44, 58, 431);
  context.shadowBlur = 0;
  context.fillStyle = hue;
  context.font = '700 21px system-ui, sans-serif';
  context.fillText(subtitle, 46, 110, 429);
}

/** A hologram: glowing letters and corner brackets on nothing (drawn with additive blending). */
export function paintHolo(context: CanvasRenderingContext2D, title: string, subtitle: string, hue: string) {
  const w = context.canvas.width, h = context.canvas.height;
  context.clearRect(0, 0, w, h);
  context.fillStyle = 'rgba(0,0,0,1)';
  context.fillRect(0, 0, w, h);
  context.strokeStyle = hue;
  context.lineWidth = 6;
  context.shadowColor = hue;
  context.shadowBlur = 18;
  const c = 60;
  for (const [x, y, dx, dy] of [[14, 14, 1, 1], [w - 14, 14, -1, 1], [14, h - 14, 1, -1], [w - 14, h - 14, -1, -1]] as const) {
    context.beginPath(); context.moveTo(x + dx * c, y); context.lineTo(x, y); context.lineTo(x, y + dy * c); context.stroke();
  }
  for (let y = 0; y < h; y += 6) { context.fillStyle = 'rgba(255,255,255,.035)'; context.fillRect(0, y, w, 2); }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.font = `italic 900 ${Math.round(h * .36)}px system-ui, sans-serif`;
  context.fillText(title, w / 2, h * .44, w - 90);
  context.fillStyle = hue;
  context.font = `700 ${Math.round(h * .1)}px system-ui, sans-serif`;
  context.fillText(subtitle, w / 2, h * .76, w - 120);
  context.shadowBlur = 0;
}
