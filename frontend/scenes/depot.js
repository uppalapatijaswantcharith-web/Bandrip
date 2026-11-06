// The Depot: a concrete hall, seven plinths in an arc, one hero object per category.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadGLB } from './mascot.js';

const STATIC = document.querySelector('meta[name="static-root"]')?.content || '/static/';

function concreteTexture(size = 512, base = [156, 151, 141], seed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${base.join(',')})`;
  g.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const r = rnd() * size * 0.08 + 2;
    const v = (rnd() - 0.5) * 26;
    g.fillStyle = `rgba(${base.map((b) => Math.max(0, Math.min(255, b + v))).join(',')},${0.05 + rnd() * 0.12})`;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    g.fill();
  }
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function numberTexture(num) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(21,21,21,0.85)';
  g.font = '96px Anton, Impact, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(num, 10, 68);
  g.font = 'bold 18px "Space Mono", monospace';
  g.fillText('BANDRIP // DEPOT', 120, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function centerAndFit(obj, size) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const k = size / Math.max(dim.x, dim.y, dim.z * 1.4);
  obj.position.sub(ctr);
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.scale.setScalar(k);
  return wrap;
}

export async function createDepotScene(rt, { categories, mobile, onProgress }) {
  const { renderer } = rt;
  const scene = new THREE.Scene();
  const bg = new THREE.Color(0x8c877e);
  scene.background = bg;
  scene.fog = new THREE.Fog(0x8c877e, 14, 34);
  const camera = new THREE.PerspectiveCamera(mobile ? 52 : 38, 1, 0.1, 80);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xf4efe6, 0x5a554c, 1.3);
  const key = new THREE.DirectionalLight(0xfff2e2, 2.2);
  key.position.set(-6, 10, 8);
  const back = new THREE.DirectionalLight(0xff4a30, 1.6);
  back.position.set(0, 5, -10);
  scene.add(hemi, key, back);

  // floor: CC0 worn concrete (Poly Haven) · wall: graffiti-covered brick from the BANDRIP spray kit
  const tl = new THREE.TextureLoader();
  const loadTex = (url, srgb = true, rep = [1, 1]) => {
    const t = tl.load(`${STATIC}${url}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...rep);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const floorMat = new THREE.MeshStandardMaterial({
    map: loadTex('img/tex/floor_diff.webp', true, [9, 9]),
    normalMap: loadTex('img/tex/floor_nor.webp', false, [9, 9]),
    roughnessMap: loadTex('img/tex/floor_rough.webp', false, [9, 9]),
    color: 0xd8d2c6,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallTex = loadTex('img/walls/brick_graffiti.webp', true, [-2, 1]);   // inside of a cylinder: flip U so tags read correctly
  const wallGeo = new THREE.CylinderGeometry(15, 15, 9, 96, 1, true, Math.PI * 0.62, Math.PI * 0.76);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, side: THREE.BackSide, color: 0xb9b2a8 }));
  wall.position.set(0, 4.5, 6);
  scene.add(wall);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(15.05, 15.05, 8, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshStandardMaterial({ map: concreteTexture(512, [150, 145, 136], 11), side: THREE.BackSide, roughness: 1 }));
  sky.position.set(0, 13, 6);
  scene.add(sky);
  // red practical strip along the back wall
  const glow = new THREE.PointLight(0xe63228, 26, 12, 1.4);
  glow.position.set(0, 0.6, -7.6);
  scene.add(glow);
  // soft radial textures for floor light pools and contact shadows
  const radial = (inner, outer) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };
  const poolTex = radial('rgba(255,248,235,0.28)', 'rgba(255,248,235,0)');
  const shadowTex = radial('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
  // chalk tape arc on the floor
  const tape = new THREE.Mesh(new THREE.RingGeometry(6.35, 6.42, 128, 1, Math.PI * 1.17, Math.PI * 0.66), new THREE.MeshBasicMaterial({ color: 0xf2f0e9, transparent: true, opacity: 0.7 }));
  tape.rotation.x = -Math.PI / 2;
  tape.position.set(0, 0.005, 4);
  scene.add(tape);

  // load objects: five garments + cap and shades from the mascot
  const [depot, mascot] = await Promise.all([
    loadGLB(`${STATIC}models/depot.glb`, (p) => onProgress?.(p * 0.7)),
    loadGLB(`${STATIC}models/accessories.glb`, (p) => onProgress?.(0.7 + p * 0.3)),
  ]);
  const pick = (root, names) => {
    const g = new THREE.Group();
    root.traverse((o) => { if (o.isMesh && names.some((n) => (o.name || '').startsWith(n) || (o.material?.name || '').startsWith(n))) g.add(o.clone()); });
    return g;
  };
  const sources = {
    tee: pick(depot.scene, ['tee']),
    shirt: pick(depot.scene, ['shirt']),
    jacket: pick(depot.scene, ['jacket']),
    pants: pick(depot.scene, ['pants']),
    bandana: pick(depot.scene, ['bandana']),
    cap: pick(mascot.scene, ['cap', 'patch']),
    shades: pick(mascot.scene, ['glasses', 'lenses', 'frame', 'lens']),
  };
  sources.shades.traverse((o) => {
    if (!o.isMesh) return;
    if ((o.material.name || '').startsWith('lens')) o.material = new THREE.MeshPhysicalMaterial({ color: 0x1b0d0b, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.94, envMapIntensity: 2 });
    else o.material = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.2, clearcoat: 1, envMapIntensity: 1.5 });
  });

  const plinthMat = new THREE.MeshStandardMaterial({ map: concreteTexture(256, [190, 185, 175], 3), roughness: 0.85 });
  const R = mobile ? 3.6 : 6.2;
  const items = [];
  const n = categories.length;
  categories.forEach((cat, i) => {
    const spread = mobile ? 62 : 42;
    const a = THREE.MathUtils.degToRad(-spread + (2 * spread * i) / (n - 1));
    const pos = new THREE.Vector3(Math.sin(a) * R, 0, 4 - Math.cos(a) * R);
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = -a * 0.85;
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.8, 1.15, 3, 0.04), plinthMat);
    plinth.position.y = 0.4;
    group.add(plinth);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;
    group.add(pool);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.805;
    group.add(contact);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: numberTexture(cat.num), transparent: true }));
    num.position.set(0, 0.46, 0.578);
    group.add(num);
    const src = sources[cat.object] || sources.tee;
    const obj = centerAndFit(src.clone(), cat.object === 'shades' ? 1.35 : cat.object === 'cap' ? 1.25 : 1.6);
    const holder = new THREE.Group();
    holder.position.y = 1.75;
    holder.add(obj);
    group.add(holder);
    scene.add(group);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.9, 1.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.45;
    group.add(hit);
    items.push({ cat, group, holder, hit, phase: i * 0.9, spin: 0.25 + (i % 3) * 0.08, lift: 0, hover: 0 });
  });

  const home = { pos: new THREE.Vector3(0, mobile ? 3.4 : 2.6, mobile ? 10.6 : 9.0), look: new THREE.Vector3(0, mobile ? 1.3 : 1.25, mobile ? 0.6 : -0.6) };
  const cam = { pos: home.pos.clone(), look: home.look.clone() };
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  rt.onResize((w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix(); });

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let hovered = null;
  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  function hitTest(clientX, clientY, rect) {
    v2.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    const hits = ray.intersectObjects(items.map((it) => it.hit), false);
    return hits.length ? items.find((it) => it.hit === hits[0].object) : null;
  }

  function screenPos(item) {
    tmp.set(0, -0.02, 0.6);
    item.group.localToWorld(tmp);
    tmp.project(camera);
    const { w, h } = rt.size;
    return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, visible: tmp.z < 1 };
  }

  function focusPose(item) {
    const p = item.group.position.clone();
    const toCam = new THREE.Vector3(0, 0, 4).sub(p).setY(0).normalize();
    return { pos: p.clone().add(toCam.multiplyScalar(3.0)).setY(2.25), look: p.clone().setY(1.75) };
  }

  let t = 0;
  function frame(dt) {
    t += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    items.forEach((it) => {
      const target = it === hovered ? 1 : 0;
      it.hover += (target - it.hover) * Math.min(1, dt * 6);
      it.holder.position.y = 1.75 + Math.sin(t * 1.1 + it.phase) * 0.04 + it.hover * 0.18;
      it.turn = (it.turn || 0) + dt * it.hover * 2.4;
      it.holder.rotation.y = Math.sin(t * it.spin + it.phase) * 0.6 + it.turn;
      const s = 1 + it.hover * 0.08;
      it.holder.scale.setScalar(s);
    });
    camera.position.set(cam.pos.x + pointer.x * 0.35, cam.pos.y - pointer.y * 0.18, cam.pos.z);
    camera.lookAt(cam.look);
    renderer.render(scene, camera);
  }

  return {
    scene, camera, items, cam, home, frame, hitTest, screenPos, focusPose,
    setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; },
    setHover(item) { hovered = item; },
    get hovered() { return hovered; },
  };
}
