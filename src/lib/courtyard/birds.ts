/** Birds over the city by day and at sunset: pigeons looping over the plaza, gulls over the lake and a far flock
 *  beyond it, each where you'd see it from the usual views. One instanced mesh;
 *  the wings beat in the vertex shader, so a whole flock costs one draw call. They hide at night and with Reduce
 *  Motion, and move only while the city is awake (scene.ts). */
import * as T from 'three';

interface Flock { cx: number; cz: number; rx: number; rz: number; y: number; speed: number; angle: number; size: number; start: number; scale: number }

export function buildBirds(scene: T.Scene) {
  // a bird faces +z with its wings along ±x; "wing" weights how far each vertex beats
  const shape = [
    // body
    0, 0, .26, -.05, 0, -.02, .05, 0, -.02,
    -.05, 0, -.02, 0, .03, -.22, .05, 0, -.02,
    // wings: root at the body, tip out to the side
    -.05, 0, .06, -.6, .02, -.06, -.05, 0, -.1,
    .05, 0, .06, .05, 0, -.1, .6, .02, -.06,
  ];
  const wing = [0, 0, 0, 0, 0, 0, .15, 1, .15, .15, .15, 1];
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(shape, 3));
  geometry.setAttribute('wing', new T.Float32BufferAttribute(wing, 1));
  geometry.computeVertexNormals();
  const time = { value: 0 };
  const material = new T.MeshBasicMaterial({ color: 0x22252c, side: T.DoubleSide, transparent: true, opacity: 0 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wing;\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += wing * sin(uTime * 10.0 + float(gl_InstanceID) * 1.9) * .3;');
  };
  const flocks: Flock[] = [
    { cx: 0, cz: -6, rx: 12, rz: 6, y: 11, speed: -.3, angle: 2.2, size: 6, start: 0, scale: .7 }, // pigeons over the plaza
    { cx: -40, cz: 2, rx: 16, rz: 22, y: 15, speed: .17, angle: 0, size: 7, start: 6, scale: 1.25 }, // gulls over the lake
    { cx: -75, cz: -20, rx: 30, rz: 20, y: 26, speed: .12, angle: 4, size: 5, start: 13, scale: 1.4 },
  ];
  const count = flocks.reduce((n, f) => n + f.size, 0);
  const mesh = new T.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = -6;
  scene.add(mesh);
  const at = new T.Object3D();
  function place() {
    for (const f of flocks) {
      const x = f.cx + Math.cos(f.angle) * f.rx, z = f.cz + Math.sin(f.angle) * f.rz;
      // heading along the ellipse, the direction they fly
      const hx = -Math.sin(f.angle) * f.rx * Math.sign(f.speed), hz = Math.cos(f.angle) * f.rz * Math.sign(f.speed), yaw = Math.atan2(hx, hz);
      for (let i = 0; i < f.size; i++) {
        const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
        const ox = side * rank * 1.3 * f.scale, oz = -rank * 1.1 * f.scale, bob = Math.sin(f.angle * 9 + i) * .35;
        at.position.set(x + Math.cos(yaw) * ox + Math.sin(yaw) * oz, f.y + bob + (i % 3) * .3, z - Math.sin(yaw) * ox + Math.cos(yaw) * oz);
        at.rotation.set(0, yaw, Math.sin(f.angle * 3 + i) * .12);
        at.scale.setScalar(f.scale);
        at.updateMatrix();
        mesh.setMatrixAt(f.start + i, at.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  place();
  return {
    /** how visible the birds are: daylight, gone at night or with Reduce Motion */
    show(amount: number) { material.opacity = amount; mesh.visible = amount > .02; },
    fly(seconds: number) {
      if (!mesh.visible) return;
      time.value += seconds;
      for (const f of flocks) f.angle += seconds * f.speed;
      place();
    },
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); mesh.removeFromParent(); },
  };
}
