// Extra actors that share the home stage's single WebGL context:
//  - THE DROP: a blank BANDRIP hoodie that gets spray-tagged as you scroll (shader spray front),
//    with the Blender spray can tracking the front and emitting paint particles.
//  - The footer skater (Mishu, CC BY 4.0) who rolls in on her board.
import * as THREE from 'three';
import { loadGLB } from './mascot.js';

const STATIC = document.querySelector('meta[name="static-root"]')?.content || '/static/';

const SPRAY_FUNCS = /* glsl */`
  float bh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float bn(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

const SPRAY_CHUNK = /* glsl */`
  // ---- BANDRIP spray front ----
  vec2 gUv = vec2(vObj.x / uSize.x + 0.5, vObj.y / uSize.y + 0.5);
  if (vObjN.z < -0.15) gUv.x = 1.0 - gUv.x;                 // back panel mirrored so it also reads left-to-right
  vec4 graf = texture2D(uGraffiti, gUv);
  float front = gUv.x * 0.78 + (1.0 - gUv.y) * 0.12 + bn(vObj * 7.0) * 0.22;
  float reach = uProgress * 1.25 - 0.05;
  float wet = smoothstep(reach + 0.015, reach - 0.015, front);
  float speck = step(0.83, bh(floor(vObj * 260.0))) * smoothstep(reach + 0.09, reach, front) * (1.0 - wet);
  float paint = clamp(wet + speck * 0.9, 0.0, 1.0) * graf.a;
  diffuseColor.rgb = mix(diffuseColor.rgb, graf.rgb, paint);
`;

export async function createDrop(stage, { onProgress, mobile = false } = {}) {
  const [hoodie, can] = await Promise.all([
    loadGLB(`${STATIC}models/hoodie.glb`, onProgress),
    loadGLB(`${STATIC}models/spraycan.glb`),
  ]);
  const tex = await new THREE.TextureLoader().loadAsync(`${STATIC}img/graffiti/hoodie_graffiti.webp`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const uniforms = { uGraffiti: { value: tex }, uProgress: { value: 0 }, uSize: { value: new THREE.Vector2(1.84, 1.0) } };
  const group = new THREE.Group();
  const model = hoodie.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  uniforms.uSize.value.set(size.x, size.y);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material.envMapIntensity = 0.25;
    o.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvObjN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\nuniform sampler2D uGraffiti;\nuniform float uProgress;\nuniform vec2 uSize;\n${SPRAY_FUNCS}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${SPRAY_CHUNK}`);
    };
    o.material.needsUpdate = true;
  });
  group.add(model);

  // spray can + paint particles
  const canObj = can.scene;
  canObj.scale.setScalar(0.42);
  const canPivot = new THREE.Group();
  canPivot.add(canObj);
  canObj.rotation.set(0, Math.PI * 0.5, 0);        // nozzle (−Y in Blender → +Z) turned toward the hoodie
  group.add(canPivot);
  const N = 380;
  const pos = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const vel = new Float32Array(N * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xe63228, size: 0.02, transparent: true, opacity: 0.85, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  group.add(points);

  group.position.set(mobile ? 0.1 : 1.15, mobile ? -1.15 : 0.25, 0);
  group.scale.setScalar(mobile ? 1.15 : 1.75);
  group.visible = false;
  stage.scene.add(group);

  let progress = 0;
  let spraying = false;
  let t = 0;
  const nozzle = new THREE.Vector3();
  stage.onFrame((dt) => {
    if (!group.visible) return;
    t += dt;
    model.rotation.y = Math.sin(t * 0.35) * 0.22 + (progress - 0.5) * 0.4;
    model.position.y = Math.sin(t * 0.8) * 0.015;
    // the can rides the spray front, a little in front of the chest
    const fx = (Math.min(1, progress * 1.25) - 0.5) * size.x * 0.9;
    const fy = Math.sin(progress * 18.0) * 0.18 + 0.05;
    canPivot.position.set(fx + 0.12, fy + 0.18, 0.62);
    canPivot.rotation.set(0.35, -0.5, -0.25 + Math.sin(t * 9) * (spraying ? 0.03 : 0));
    nozzle.set(fx + 0.02, fy + 0.27, 0.48);
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0 && spraying && Math.random() < 0.5) {
        life[i] = 0.35 + Math.random() * 0.2;
        pos[i * 3] = nozzle.x; pos[i * 3 + 1] = nozzle.y; pos[i * 3 + 2] = nozzle.z;
        vel[i * 3] = (Math.random() - 0.6) * 0.5;
        vel[i * 3 + 1] = (Math.random() - 0.65) * 0.5;
        vel[i * 3 + 2] = -1.2 - Math.random() * 0.8;
      }
      if (life[i] > 0) {
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 2] < 0.12) life[i] = 0;
      } else { pos[i * 3 + 2] = -50; }
    }
    pGeo.attributes.position.needsUpdate = true;
  });

  return {
    group,
    setProgress(p, velocity = 0) {
      progress = p;
      uniforms.uProgress.value = p;
      spraying = p > 0.01 && p < 0.99 && Math.abs(velocity) > 0.05;
      canPivot.visible = p > 0.005 && p < 0.995;
    },
    setVisible(v) { group.visible = v; },
  };
}

export async function createSkater(stage, { onProgress, mobile = false } = {}) {
  const gltf = await loadGLB(`${STATIC}models/skater.glb`, onProgress);
  const palette = { Jacket: '#E63228', Legs: '#2A2927', Shoes: '#F2F0E9', Skateboard: '#E4DCCB', Hair: '#151515', Arm: '#D8CFC4', Head: '#D8CFC4' };
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name || '';
    const key = Object.keys(palette).find((k) => name.startsWith(k));
    if (name.includes('Ink')) { o.material = new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.BackSide }); return; }   // toon outline shell (inverted hull)
    if (key) { o.material = o.material.clone(); o.material.color.set(palette[key]); o.material.map = null; o.material.needsUpdate = true; }
    if (name.startsWith('Chain') || name.startsWith('Necklace') || name.startsWith('Earring')) { o.material.metalness = 1; o.material.roughness = 0.25; }
  });
  const group = new THREE.Group();
  group.add(gltf.scene);
  gltf.scene.rotation.y = -Math.PI * 0.5;          // board points along the direction of travel (−X)
  group.scale.setScalar(1.05);
  group.visible = false;
  stage.scene.add(group);
  const fill = new THREE.DirectionalLight(0xfff1e4, 1.6);
  fill.position.set(-2, 3, 6);
  fill.target = group;
  group.add(fill);
  let t = 0;
  let k = 0;
  stage.onFrame((dt) => {
    if (!group.visible) return;
    t += dt;
    group.position.set((mobile ? 0.3 : 1.75) + (1 - k) * 4.6, (mobile ? 0.9 : 1.08) + Math.abs(Math.sin(t * 6)) * 0.01 * (1 - k), 0.3);
    group.rotation.z = (1 - k) * 0.04 * Math.sin(t * 8);
    group.rotation.y = 0.35 * k;
  });
  return {
    group,
    setProgress(p) { k = p; },
    setVisible(v) { group.visible = v; },
  };
}
