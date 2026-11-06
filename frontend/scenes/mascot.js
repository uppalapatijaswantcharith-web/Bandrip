// Hero mascot scene: Blender-baked GLB, product-shot lighting, pose driven by the page.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const STATIC = document.querySelector('meta[name="static-root"]')?.content || '/static/';

// Phones load copies with textures capped at 1024px (tools/mobile_glb.py): the renderer caps DPR at 1.25 there.
const MOBILE_GLB = /\/models\/(mascot|crew)\.glb$/;
const phone = window.matchMedia('(max-width: 760px)').matches;

export function loadGLB(url, onProgress) {
  if (phone && MOBILE_GLB.test(url)) url = url.replace(/\.glb$/, '-m.glb');
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${STATIC}draco/`);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => { draco.dispose(); resolve(g); }, (e) => { if (e.total) onProgress?.(e.loaded / e.total); }, reject);
  });
}

export async function createMascotScene(rt, { onProgress, mobile }) {
  const { renderer } = rt;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  camera.position.set(0, 0.35, 8.5);
  camera.lookAt(0, 0.35, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xfff0de, 2.6);
  key.position.set(-3.2, 4.2, 5);
  const rim = new THREE.DirectionalLight(0xff3b22, 3.4);
  rim.position.set(4.5, 2.2, -4.5);
  const rim2 = new THREE.DirectionalLight(0xff6a4a, 1.2);
  rim2.position.set(-4.5, 0.5, -3.5);
  const fill = new THREE.DirectionalLight(0xdde6ff, 0.45);
  fill.position.set(4, -1, 3);
  const hemi = new THREE.HemisphereLight(0xfff4e8, 0x2a1512, 0.55);
  scene.add(key, rim, rim2, fill, hemi);

  const gltf = await loadGLB(`${STATIC}models/mascot.glb`, onProgress);
  const model = gltf.scene;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    const name = m.name || '';
    if (name.startsWith('skull') || name.startsWith('teeth')) {
      m.envMapIntensity = 0.55;
      if (name.startsWith('teeth')) m.roughness = 0.4;
    } else if (name.startsWith('hat')) {
      m.envMapIntensity = 0.35;
      if ('sheen' in m) { m.sheen = 0.25; m.sheenColor = new THREE.Color(0x6a5a50); m.sheenRoughness = 0.7; }
    } else if (name.startsWith('bandana')) {
      m.envMapIntensity = 0.3;
      m.roughness = Math.max(m.roughness ?? 0.8, 0.78);
      if ('sheen' in m) { m.sheen = 0.35; m.sheenColor = new THREE.Color(0xff8a70); m.sheenRoughness = 0.6; }
    }
  });

  // pivot sits at the visual centre of the head so rotations look natural
  const pivot = new THREE.Group();
  model.position.set(0, 0.15, 0);
  pivot.add(model);
  const holder = new THREE.Group();
  holder.add(pivot);
  scene.add(holder);
  // head-and-bandana emblem like the logo: drop the neck stub, then measure what is left so the page
  // can dock the mascot into reserved layout slots (centre and height in holder space at scale 1)
  model.traverse((o) => { if (o.isMesh && (o.material.name || '').startsWith('neck')) o.visible = false; });
  holder.updateMatrixWorld(true);
  const fitBox = new THREE.Box3();
  model.traverse((o) => { if (o.isMesh && o.visible) fitBox.expandByObject(o); });
  const fit = { cx: (fitBox.min.x + fitBox.max.x) / 2, cy: (fitBox.min.y + fitBox.max.y) / 2, h: fitBox.max.y - fitBox.min.y, w: fitBox.max.x - fitBox.min.x };

  // thin orbit rings (DICH "rock" chapter) — hidden until the values chapter
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2f0e9, transparent: true, opacity: 0, depthWrite: false });
  const rings = new THREE.Group();
  [[1.9, 0.0038, 1.2, 0.3], [2.25, 0.003, -0.9, 0.8]].forEach(([r, t, rx, rz]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 160), ringMat);
    ring.rotation.set(rx, 0, rz);
    rings.add(ring);
  });
  holder.add(rings);

  // pose is written by the page (scroll) and read every frame
  const pose = { x: 0, y: 0, z: 0, ry: 0, rx: 0, s: mobile ? 0.86 : 1, rings: 0, enter: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  rt.onResize((w, h) => {
    camera.aspect = w / h;
    // keep the bust height stable; on narrow portrait screens step back a little
    camera.position.z = w / h < 0.7 ? 10.2 : 8.5;
    camera.updateProjectionMatrix();
  });

  const hooks = new Set();
  let t = 0;
  function frame(dt) {
    t += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    const e = pose.enter;
    holder.position.set(pose.x, pose.y - (1 - e) * 0.9 + Math.sin(t * 0.9) * 0.025, pose.z);
    holder.scale.setScalar(pose.s * (0.84 + 0.16 * e));
    pivot.rotation.y = pose.ry + pointer.x * 0.22 + Math.sin(t * 0.35) * 0.04 - (1 - e) * 0.5;
    pivot.rotation.x = pose.rx + pointer.y * 0.07;
    pivot.rotation.z = Math.sin(t * 0.5) * 0.012;
    rings.rotation.y = t * 0.25;
    rings.rotation.x = Math.sin(t * 0.3) * 0.2;
    ringMat.opacity = pose.rings * 0.75;
    rings.visible = pose.rings > 0.01;
    holder.visible = pose.s > 0.01 && Math.abs(pose.x) < 4.5 && pose.y < 4;
    hooks.forEach((fn) => fn(dt, t));
    renderer.render(scene, camera);
  }

  return { scene, camera, pose, frame, model, renderer, fit, onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); } };
}
