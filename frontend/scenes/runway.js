// BANDRIP Studio runway: LED floor, truss lights, instanced audience, looping walkers.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGLB } from './mascot.js';

const STATIC = document.querySelector('meta[name="static-root"]')?.content || '/static/';

export const PALETTES = [
  { name: '01', a: '#E63228', b: '#F2F0E9', c: '#151515' },
  { name: '02', a: '#F2F0E9', b: '#A9A59C', c: '#2A2927' },
  { name: '03', a: '#E63228', b: '#151515', c: '#E4DCCB' },
  { name: '04', a: '#3B3A37', b: '#E63228', c: '#F2F0E9' },
];

const LED_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LED_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uA, uB, uC;
  uniform vec2 uGrid;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    // LED pixel grid
    vec2 cell = vUv * uGrid;
    vec2 g = fract(cell) - 0.5;
    float px = smoothstep(0.5, 0.36, max(abs(g.x), abs(g.y)));
    vec2 q = floor(cell) / uGrid;
    vec2 p = vec2(q.x * 3.0, q.y * 22.0 - uTime * 0.35);
    float n = fbm(p + fbm(p * 0.7 + uTime * 0.05) * 1.6);
    vec3 col = n < 0.42 ? uC : (n < 0.56 ? uA : uB);
    float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
    gl_FragColor = vec4(col * (0.62 + 0.38 * px) * (0.62 + 0.3 * edge) * 0.86, 1.0);
    #include <colorspace_fragment>
  }
`;

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

const OUTFITS = [
  { tee: '#EEEBE3', pants: '#2B2A28', shoes: '#F2F0E9', cap: '#151515', skin: '#D9D4CA' },
  { tee: '#E63228', pants: '#A9A59C', shoes: '#151515', cap: '#151515', skin: '#CFC9BE' },
  { tee: '#151515', pants: '#E4DCCB', shoes: '#F2F0E9', cap: '#E63228', skin: '#D9D4CA' },
  { tee: '#A9A59C', pants: '#151515', shoes: '#E63228', cap: '#EEEBE3', skin: '#CFC9BE' },
  { tee: '#E4DCCB', pants: '#3E4A3A', shoes: '#F2F0E9', cap: '#151515', skin: '#D9D4CA' },
];

export async function createRunwayScene(rt, { mobile, onProgress, canvas }) {
  const { renderer } = rt;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0d0c);
  scene.fog = new THREE.FogExp2(0x0e0d0c, 0.045);
  const camera = new THREE.PerspectiveCamera(mobile ? 48 : 36, 1, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xf3ece4, 0x221a16, 0.6));
  const key = new THREE.DirectionalLight(0xfff0de, 1.6);
  key.position.set(-4, 9, 8);
  scene.add(key);
  const rimL = new THREE.SpotLight(0xff3a24, 70, 30, 0.5, 0.6, 1.5);
  rimL.position.set(-3.5, 6, -4);
  rimL.target.position.set(0, 0, 2);
  const rimR = new THREE.SpotLight(0xf2f0e9, 50, 30, 0.45, 0.6, 1.5);
  rimR.position.set(3.5, 6, 3);
  rimR.target.position.set(0, 0, -2);
  scene.add(rimL, rimL.target, rimR, rimR.target);

  // floor + runway with LED top
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x141211, roughness: 0.65, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const RUN_LEN = 30;
  const ledMat = new THREE.ShaderMaterial({
    vertexShader: LED_VERT, fragmentShader: LED_FRAG,
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() }, uGrid: { value: new THREE.Vector2(58, 540) } },
  });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(3.2, RUN_LEN), ledMat);
  led.rotation.x = -Math.PI / 2;
  led.position.set(0, 0.401, -4);
  scene.add(led);
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.4, RUN_LEN + 0.1), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }));
  base.position.set(0, 0.2, -4);
  scene.add(base);
  const glowLight = new THREE.PointLight(0xe63228, 8, 9, 1.5);
  glowLight.position.set(0, 1.2, 2);
  scene.add(glowLight);

  // entrance doorway
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), new THREE.MeshBasicMaterial({ color: 0xfff6ea, fog: false }));
  door.position.set(0, 2.1, -19.2);
  scene.add(door);
  // graffiti brick around the doorway and along both sides of the hall (BANDRIP spray kit on CC0 brick)
  const tl = new THREE.TextureLoader();
  const wallTex = (url, rx, ry) => { const t = tl.load(`${STATIC}${url}`); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshStandardMaterial({ map: wallTex('img/walls/brick_graffiti.webp', 2, 1), color: 0x6a625c, roughness: 0.95 }));
  wall.position.set(0, 7, -19.3);
  scene.add(wall);
  [-1, 1].forEach((side) => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(34, 10), new THREE.MeshStandardMaterial({ map: wallTex(side < 0 ? 'img/walls/brick_graffiti.webp' : 'img/walls/brick_dark.webp', 3, 1), color: 0x5a524d, roughness: 0.95 }));
    sw.rotation.y = -side * Math.PI / 2;
    sw.position.set(side * 7.4, 5, -3);
    scene.add(sw);
    for (let i = 0; i < 3; i++) {
      const up = new THREE.PointLight(0xe63228, 14, 7, 1.6);
      up.position.set(side * 6.6, 0.4, -14 + i * 9);
      scene.add(up);
    }
  });
  const doorGlow = new THREE.PointLight(0xfff1e0, 30, 14, 1.4);
  doorGlow.position.set(0, 2.2, -17.5);
  scene.add(doorGlow);

  // truss with beam cones
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6, metalness: 0.6 });
  [-2.2, 2.2].forEach((x) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, RUN_LEN + 4), trussMat);
    beam.position.set(x, 7, -4);
    scene.add(beam);
  });
  const beamTex = beamTexture();
  const beamGeo = new THREE.ConeGeometry(1.5, 6.6, 24, 1, true);
  beamGeo.translate(0, -3.3, 0);
  const beams = [];
  for (let i = 0; i < 7; i++) {
    const z = -16 + i * 4.2;
    [-2.2, 2.2].forEach((x, k) => {
      const mat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xfff1e2, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const cone = new THREE.Mesh(beamGeo, mat);
      cone.position.set(x, 7, z);
      cone.rotation.z = (k ? 1 : -1) * 0.32;
      scene.add(cone);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      lamp.position.set(x, 6.85, z);
      scene.add(lamp);
      beams.push({ mat, lamp, i, k });
    });
  }

  // audience: one instanced draw call
  const body = new THREE.CapsuleGeometry(0.2, 0.5, 4, 10);
  body.scale(1.45, 1, 0.8);           // broad shoulders, flat front
  body.translate(0, 0.52, 0);
  const headG = new THREE.SphereGeometry(0.105, 12, 8);
  headG.scale(1, 1.2, 1);
  headG.translate(0, 1.1, 0.02);
  const neckG = new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8);
  neckG.translate(0, 0.98, 0);
  const person = mergeGeometries([body, neckG, headG]);
  const aud = [];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 26; i++) {
        const z = -15 + i * 1.05 + (row % 2) * 0.5;
        aud.push({ x: side * (2.6 + row * 0.95), z, s: 0.92 + ((i * 7 + row * 3) % 10) / 40, ry: side * -Math.PI / 2 + (((i * 13) % 10) - 5) * 0.04, y: row * 0.25 });
      }
    }
  }
  const audMat = new THREE.MeshStandardMaterial({ color: 0x2a2523, roughness: 0.95, transparent: true, opacity: 0.72, depthWrite: false });
  const crowd = new THREE.InstancedMesh(person, audMat, aud.length);
  const m4 = new THREE.Matrix4();
  aud.forEach((a, i) => {
    m4.compose(new THREE.Vector3(a.x, a.y, a.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.ry, 0)), new THREE.Vector3(a.s, a.s, a.s));
    crowd.setMatrixAt(i, m4);
  });
  scene.add(crowd);

  // the crew monument: client-supplied scan (Tulio Portela, CC BY 4.0) baked to concrete in Blender
  loadGLB(`${STATIC}models/crew.glb`).then((g) => {
    const crew = g.scene;
    crew.traverse((o) => { if (o.isMesh) { o.material.color = new THREE.Color(0x8d877e); o.material.roughness = 0.92; o.material.envMapIntensity = 0.2; } });
    const box = new THREE.Box3().setFromObject(crew);
    const k = 3.0 / (box.max.y - box.min.y);
    crew.scale.setScalar(k);
    crew.position.set(0, 0.62 - box.min.y * k, 0);
    const monument = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.62, 1.4), new THREE.MeshStandardMaterial({ map: wallTex('img/walls/concrete_dark_tagged.webp', 0.5, 0.25), color: 0x9a948b, roughness: 0.95 }));
    plinth.position.y = 0.31;
    monument.add(plinth, crew);
    monument.position.set(-4.3, 0, -14.2);
    monument.rotation.y = 0.55;
    scene.add(monument);
    const spot = new THREE.SpotLight(0xfff1e2, 60, 12, 0.45, 0.5, 1.4);
    spot.position.set(-2.5, 7, -10.5);
    spot.target = monument;
    scene.add(spot);
  }).catch((e) => console.warn('[bandrip] crew monument unavailable', e));

  // walkers
  const gltf = await loadGLB(`${STATIC}models/walker.glb`, onProgress);
  const clip = gltf.animations[0];
  const walkers = [];
  const COUNT = mobile ? 3 : 5;
  const LANE_OUT = -0.32;
  const LANE_BACK = 0.62;
  const Z_START = -17.5;
  const Z_END = 6.5;
  const SPEED = 1.32;
  for (let i = 0; i < COUNT; i++) {
    const w = cloneSkinned(gltf.scene);
    const fit = OUTFITS[i % OUTFITS.length];
    w.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      o.material = o.material.clone();
      const key2 = (o.material.name || '').split('.')[0];
      if (fit[key2]) o.material.color.set(fit[key2]);
      o.material.roughness = key2 === 'shoes' ? 0.45 : 0.8;
    });
    const mixer = new THREE.AnimationMixer(w);
    const action = mixer.clipAction(clip);
    action.play();
    action.time = (i * 0.37) % clip.duration;
    // spread walkers evenly along the out-and-back loop
    const run = Z_END - Z_START;
    const d = (i * 2 * run) / COUNT;
    const out = d < run;
    const state = { phase: out ? 'out' : 'back', z: out ? Z_START + d : Z_END - (d - run), x: out ? LANE_OUT : LANE_BACK, ry: out ? 0 : Math.PI, turnT: 0 };
    w.position.set(state.x, 0.4, state.z);
    scene.add(w);
    walkers.push({ w, mixer, state });
  }

  // cameras
  const views = {
    front: { pos: new THREE.Vector3(0, 1.75, 12.5), look: new THREE.Vector3(0, 1.3, -4) },
    side: { pos: new THREE.Vector3(7.2, 2.0, 1.5), look: new THREE.Vector3(0, 1.2, -1.5) },
  };
  const cam = { pos: views.front.pos.clone(), look: views.front.look.clone() };
  let view = 'front';
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.minDistance = 4;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 1.2, -2);
  rt.onResize((w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix(); });

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  });

  let paused = false;
  let t = 0;
  let palette = 0;
  const setPalette = (i) => {
    palette = (i + PALETTES.length) % PALETTES.length;
    const p = PALETTES[palette];
    ledMat.uniforms.uA.value.set(p.a);
    ledMat.uniforms.uB.value.set(p.b);
    ledMat.uniforms.uC.value.set(p.c);
    glowLight.color.set(p.a);
    return p;
  };
  setPalette(0);

  function stepWalker(wk, dt) {
    const s = wk.state;
    wk.mixer.update(dt);
    if (s.phase === 'out') {
      s.z += SPEED * dt;
      if (s.z >= Z_END) { s.phase = 'turn'; s.turnT = 0; s.from = 0; s.to = Math.PI; s.next = 'back'; }
    } else if (s.phase === 'back') {
      s.z -= SPEED * dt;
      if (s.z <= Z_START) { s.phase = 'turn'; s.turnT = 0; s.from = Math.PI; s.to = Math.PI * 2; s.next = 'out'; }
    } else if (s.phase === 'turn') {
      s.turnT += dt / 0.9;
      const k = Math.min(1, s.turnT);
      const e = k * k * (3 - 2 * k);
      s.ry = s.from + (s.to - s.from) * e;
      s.x = s.next === 'back' ? LANE_OUT + (LANE_BACK - LANE_OUT) * e : LANE_BACK + (LANE_OUT - LANE_BACK) * e;
      if (k >= 1) { s.phase = s.next; s.ry %= Math.PI * 2; }
    }
    wk.w.position.set(s.x, 0.4, s.z);
    wk.w.rotation.y = s.ry;
  }

  function frame(dt) {
    if (!paused) {
      t += dt;
      ledMat.uniforms.uTime.value = t;
      walkers.forEach((wk) => stepWalker(wk, dt));
      beams.forEach((b) => { b.mat.opacity = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.2 + b.i * 0.8 + b.k * 2.1)); });
    }
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2);
    if (view === 'free') {
      controls.update();
    } else {
      const v = views[view];
      const sway = view === 'front' ? Math.sin(t * 0.12) * 0.6 : Math.sin(t * 0.1) * 3.0;
      cam.pos.lerp(new THREE.Vector3(v.pos.x + (view === 'front' ? sway * 0.3 : 0), v.pos.y, v.pos.z + (view === 'side' ? sway : -Math.abs(sway) * 0.8)), Math.min(1, dt * 1.6));
      cam.look.lerp(v.look, Math.min(1, dt * 1.6));
      camera.position.set(cam.pos.x + pointer.x * 0.25, cam.pos.y - pointer.y * 0.12, cam.pos.z);
      camera.lookAt(cam.look);
    }
    renderer.render(scene, camera);
  }

  return {
    scene, frame,
    setView(v) {
      view = v;
      controls.enabled = v === 'free';
      if (v === 'free') { controls.target.set(0, 1.2, -2); camera.position.copy(cam.pos); controls.update(); }
    },
    nextPalette() { return setPalette(palette + 1); },
    togglePause() { paused = !paused; return paused; },
    setPaused(v) { paused = v; },
    dispose() { controls.dispose(); },
  };
}
