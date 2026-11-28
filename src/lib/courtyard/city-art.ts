import * as T from 'three';

type CanvasArt = (context: CanvasRenderingContext2D) => void;

/** The city batches solid details by material and parent, including removable room roofs. */
export function cityArt(scene: T.Scene, tokens: CSSStyleDeclaration) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  const batches = new Map<T.Object3D, Map<T.Material, T.Matrix4[]>>();
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
  }

  return {
    ink, color, material, texture, mesh, box, finish,
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

export function paintPavers(context: CanvasRenderingContext2D) {
  const random = seededNoise(602);
  context.fillStyle = '#152233';
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const shade = Math.floor(35 + random() * 14);
    const gradient = context.createLinearGradient(x, y, x + 58, y + 60);
    gradient.addColorStop(0, `rgb(${shade + 10} ${shade + 18} ${shade + 26})`);
    gradient.addColorStop(1, `rgb(${shade} ${shade + 7} ${shade + 15})`);
    context.fillStyle = gradient;
    context.fillRect(x + 1, y + 1, 62, 62);
    context.fillStyle = 'rgba(160,190,205,.15)';
    context.fillRect(x + 1, y + 1, 62, 1);
  }
  for (let i = 0; i < 2600; i++) {
    context.fillStyle = i % 2 ? 'rgba(180,208,222,.09)' : 'rgba(0,0,0,.16)';
    context.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1);
  }
}

export function paintFacade(context: CanvasRenderingContext2D, variant: number) {
  const random = seededNoise(132 + variant);
  const gradient = context.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, '#0c1527');
  gradient.addColorStop(.38, variant === 1 ? '#27304f' : '#1b3448');
  gradient.addColorStop(.68, '#17243c');
  gradient.addColorStop(1, '#0a1323');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 512);
  const columns = [8, 11, 5][variant];
  const row = [20, 16, 25][variant];
  const cell = 244 / columns;
  for (let y = 10; y < 503; y += row) {
    context.fillStyle = 'rgba(4,11,24,.85)';
    context.fillRect(0, y + row - 4, 256, 4);
    for (let i = 0; i < columns; i++) {
      const x = 6 + i * cell;
      const lamp = random();
      context.fillStyle = lamp > .89 ? '#f4d0a0' : lamp > .72 ? '#a5d3ee' : lamp > .44 ? '#437894' : '#172b43';
      context.fillRect(x + 2, y, cell - 4, row - 7);
      context.fillStyle = 'rgba(2,10,24,.34)';
      context.fillRect(x + 2, y + (row - 7) * .56, cell - 4, (row - 7) * .44);
      context.fillRect(x + cell * .58, y, 1, row - 7);
      if (lamp > .72) {
        context.fillStyle = '#d1ecf5';
        context.fillRect(x + 3, y + 1, cell - 6, 1);
      }
    }
  }
  for (const x of [3, 123, 250]) {
    context.fillStyle = '#263b56';
    context.fillRect(x, 0, 3, 512);
    if (variant !== 2) {
      context.fillStyle = variant === 1 ? '#d971c5' : '#62cfe9';
      context.fillRect(x + 2, 0, 1, 512);
    }
  }
}

export function paintWallPanels(context: CanvasRenderingContext2D) {
  const steel = context.createLinearGradient(0, 0, 128, 128);
  steel.addColorStop(0, '#f5f7fa');
  steel.addColorStop(.65, '#d3d8e0');
  steel.addColorStop(1, '#e4e7ed');
  context.fillStyle = steel;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = '#aeb6c2';
  context.fillRect(0, 0, 1, 128);
  context.fillRect(127, 0, 1, 128);
  context.fillRect(0, 126, 128, 2);
  context.fillStyle = '#f8f9fc';
  context.fillRect(2, 0, 1, 128);
  context.fillRect(0, 124, 128, 1);
}

export function paintSign(context: CanvasRenderingContext2D, title: string, subtitle: string, hue: string) {
  const background = context.createLinearGradient(0, 0, 512, 152);
  background.addColorStop(0, '#172942');
  background.addColorStop(1, '#101628');
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 152);
  context.strokeStyle = hue;
  context.lineWidth = 4;
  context.strokeRect(5, 5, 502, 142);
  context.fillStyle = hue;
  context.fillRect(20, 27, 6, 94);
  context.textBaseline = 'middle';
  context.fillStyle = '#f4faff';
  context.font = '700 49px system-ui, sans-serif';
  context.fillText(title, 44, 57, 431);
  context.fillStyle = hue;
  context.font = '600 20px system-ui, sans-serif';
  context.fillText(subtitle, 46, 108, 429);
}
