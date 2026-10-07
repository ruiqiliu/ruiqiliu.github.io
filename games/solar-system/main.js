/* =====================================================================
   太阳系漫游 · Solar System Tour
   Three.js 场景：太阳 + 八大行星 + 地月系统 + 小行星带。
   - 点星球胶囊 / 点 3D 里的星球 → 相机平滑飞近，信息卡（中英双语）
   - 视角预设：全景 / 俯瞰 / 侧视 / 跟随地球
   - 自写轻量轨道控制：拖拽旋转、滚轮 / 双指缩放
   - 速度按钮：⏸ / 1× / 5× / 20×
   公转周期按开普勒第三定律压缩（T ∝ a^1.5），外行星也能看到在动。
   ===================================================================== */
import * as THREE from './lib/three.module.min.js';

const TAU_ = Math.PI * 2;

/* ---------------- 天体数据（含中英双语说明） ---------------- */

const BODIES = [
  {
    key: 'sun', zh: '太阳', en: 'Sun', dot: '#ffce54',
    r: 16, orbit: 0, spin: 0.04, minR: 44,
    info: {
      rows: [
        ['直径 Diameter', '139 万公里', '1.39 million km'],
        ['表面温度 Surface', '约 5,500°C', '≈ 5,500°C']
      ],
      fun: ['太阳占了整个太阳系质量的 99.86%。', 'The Sun holds 99.86% of all the mass in the solar system.']
    }
  },
  {
    key: 'mercury', zh: '水星', en: 'Mercury', dot: '#b8aea5',
    r: 2.2, orbit: 30, spin: 0.02, minR: 14,
    info: {
      rows: [
        ['直径 Diameter', '4,879 km', '4,879 km'],
        ['一年 Year', '88 天', '88 Earth days'],
        ['一天 Day', '176 天', '176 Earth days']
      ],
      fun: ['离太阳最近，昼夜温差超过 600°C。', 'Closest to the Sun, with a 600°C day-night swing.']
    }
  },
  {
    key: 'venus', zh: '金星', en: 'Venus', dot: '#e8c46f',
    r: 3.4, orbit: 42, spin: -0.012, minR: 16,
    info: {
      rows: [
        ['直径 Diameter', '12,104 km', '12,104 km'],
        ['一年 Year', '225 天', '225 Earth days'],
        ['温度 Temp', '约 465°C', '≈ 465°C']
      ],
      fun: ['最热的行星，而且它「 backwards 」自转——太阳从西边升起。', 'The hottest planet — and it spins backwards, so the Sun rises in the west.']
    }
  },
  {
    key: 'earth', zh: '地球', en: 'Earth', dot: '#6fa8dc',
    r: 3.6, orbit: 56, spin: 0.35, minR: 17,
    info: {
      rows: [
        ['直径 Diameter', '12,742 km', '12,742 km'],
        ['一年 Year', '365 天', '365 days'],
        ['一天 Day', '24 小时', '24 hours']
      ],
      fun: ['我们的家，目前已知唯一有生命的星球。', 'Our home — the only planet known to have life.']
    }
  },
  {
    key: 'moon', zh: '月球', en: 'The Moon', dot: '#c9c9c9',
    r: 1.0, orbit: 0, spin: 0.5, minR: 9, moon: true,
    info: {
      rows: [
        ['直径 Diameter', '3,474 km', '3,474 km'],
        ['绕地球一圈 Orbit', '约 27 天', '≈ 27 days'],
        ['距离 Distance', '38 万公里', '384,400 km']
      ],
      fun: ['月亮引力牵着海水，就有了潮汐。', 'The Moon pulls the oceans — that is what makes tides.']
    }
  },
  {
    key: 'mars', zh: '火星', en: 'Mars', dot: '#d1603d',
    r: 2.7, orbit: 70, spin: 0.3, minR: 15,
    info: {
      rows: [
        ['直径 Diameter', '6,779 km', '6,779 km'],
        ['一年 Year', '687 天', '687 Earth days'],
        ['一天 Day', '24.6 小时', '24.6 hours']
      ],
      fun: ['太阳系最高的山在这里：奥林帕斯山，约 21 公里高。', 'Home to the tallest volcano in the solar system: Olympus Mons, ~21 km high.']
    }
  },
  {
    key: 'jupiter', zh: '木星', en: 'Jupiter', dot: '#d8c9a8',
    r: 9.5, orbit: 112, spin: 0.6, minR: 30,
    info: {
      rows: [
        ['直径 Diameter', '139,820 km', '139,820 km'],
        ['一年 Year', '11.9 年', '11.9 Earth years'],
        ['一天 Day', '约 10 小时', '≈ 10 hours']
      ],
      fun: ['大红斑是一场比地球还大的风暴，刮了三百多年。', 'The Great Red Spot is a storm bigger than Earth, raging for 300+ years.']
    }
  },
  {
    key: 'saturn', zh: '土星', en: 'Saturn', dot: '#e0cba4',
    r: 8.2, orbit: 146, spin: 0.55, minR: 28, ring: true,
    info: {
      rows: [
        ['直径 Diameter', '116,460 km', '116,460 km'],
        ['一年 Year', '29.4 年', '29.4 Earth years'],
        ['光环 Rings', '宽 28 万公里', '280,000 km wide']
      ],
      fun: ['美丽的光环主要是冰块和岩石，薄得像一张纸的比例。', 'Those gorgeous rings are mostly ice and rock — proportionally as thin as a sheet of paper.']
    }
  },
  {
    key: 'uranus', zh: '天王星', en: 'Uranus', dot: '#9fd8e8',
    r: 5.4, orbit: 178, spin: 0.4, minR: 20, tilt: 1.71,
    info: {
      rows: [
        ['直径 Diameter', '50,724 km', '50,724 km'],
        ['一年 Year', '84 年', '84 Earth years'],
        ['一天 Day', '约 17 小时', '≈ 17 hours']
      ],
      fun: ['它是「躺着」自转的，像一颗滚动的球。', 'It spins on its side, rolling around the Sun like a ball.']
    }
  },
  {
    key: 'neptune', zh: '海王星', en: 'Neptune', dot: '#5a7de0',
    r: 5.2, orbit: 206, spin: 0.35, minR: 20,
    info: {
      rows: [
        ['直径 Diameter', '49,244 km', '49,244 km'],
        ['一年 Year', '164.8 年', '164.8 Earth years'],
        ['风速 Wind', '2,100 km/h', '2,100 km/h']
      ],
      fun: ['离太阳最远，风速却是全太阳系最快的。', 'Farthest from the Sun — yet the fastest winds in the solar system.']
    }
  }
];

/* ---------------- 程序化贴图（canvas 生成，零外部资源） ---------------- */

function canvasTexture(w, h, painter) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 气态行星的横向条纹（带正弦扰动），可加大红斑 */
function bands(colors, wobble, spot) {
  return canvasTexture(512, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x += 2) {
        const f = y / h * colors.length + Math.sin(x / 40 + y * 0.06) * wobble;
        g.fillStyle = colors[Math.max(0, Math.min(colors.length - 1, Math.floor(f)))];
        g.fillRect(x, y, 2, 1);
      }
    }
    if (spot) {
      g.fillStyle = 'rgba(200,80,50,.85)';
      g.beginPath();
      g.ellipse(w * 0.68, h * 0.62, 46, 20, 0, 0, TAU_);
      g.fill();
    }
  });
}

/** 岩石行星：底色 + 随机陨石坑 / 斑块，可加极冠 */
function rocky(base, crater, n, caps) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = h * 0.12 + Math.random() * h * 0.76;
      const r = 3 + Math.random() * 14;
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.beginPath(); g.arc(x, y, r, 0, TAU_); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, TAU_); g.fill();
    }
    if (caps) {
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillRect(0, 0, w, 14);
      g.fillRect(0, h - 14, w, 14);
    }
  });
}

const TEX = {
  mercury: rocky('#9c9188', null, 90, false),
  venus: bands(['#e8d5a8', '#d9bd8a', '#f0e2c0', '#d0b078'], 1.4),
  mars: rocky('#c1552f', null, 60, true),
  jupiter: bands(['#d8c9a8', '#b8875a', '#e8dcc0', '#c9a97c', '#e0cba4', '#a97c50'], 1.1, true),
  saturn: bands(['#e0cba4', '#d3b98a', '#ecdcb8', '#c9ad78'], 0.8),
  uranus: bands(['#a8dbe8', '#98d0e0', '#b2e4f0'], 0.5),
  neptune: bands(['#4a6ed0', '#3a5cc0', '#5a80e0', '#3a5cc0'], 0.8),
  sun: canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#ffb54d';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,230,150,.5)' : 'rgba(230,120,30,.4)';
      const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 7;
      g.beginPath(); g.arc(x, y, r, 0, TAU_); g.fill();
    }
  })
};

/* ---------------- 场景搭建 ---------------- */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  document.getElementById('fallback').style.display = 'flex';
  document.getElementById('stage').remove();
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050f);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 6000);

scene.add(new THREE.AmbientLight(0x8fa0c8, 0.8));
const sunLight = new THREE.PointLight(0xfff2d8, 2.6, 0, 0);
scene.add(sunLight);

// 星空
{
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU_, b = Math.acos(2 * Math.random() - 1), r = 1500 + Math.random() * 1100;
    pos[i * 3] = r * Math.sin(b) * Math.cos(a);
    pos[i * 3 + 1] = r * Math.cos(b);
    pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdde6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9 })));
}

// 太阳
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(16, 48, 32),
  new THREE.MeshBasicMaterial({ map: TEX.sun })
);
scene.add(sun);
{ // 光晕
  const glowTex = canvasTexture(256, 256, (g, w, h) => {
    const rad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    rad.addColorStop(0, 'rgba(255,200,90,.85)');
    rad.addColorStop(0.35, 'rgba(255,150,50,.32)');
    rad.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, w, h);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  glow.scale.set(78, 78, 1);
  sun.add(glow);
}

// 行星
const KEPLER = 43.9;            // ω = KEPLER / orbit^1.5，地球一圈约 60 秒（1×）
const pickables = [];
const systems = {};             // key → { body, sys, mesh, pivot }

function makeLabel(zh, en, scale) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 88;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.font = '700 40px "PingFang SC","Microsoft YaHei",sans-serif';
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(0,0,0,.8)';
  g.shadowBlur = 8;
  g.fillText(zh, 128, 38);
  g.font = '600 24px system-ui,sans-serif';
  g.fillStyle = '#9fc0ff';
  g.fillText(en, 128, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  sp.scale.set(8.6 * scale, 3 * scale, 1);
  return sp;
}

function addOrbitLine(orbit) {
  const pts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * TAU_;
    pts.push(new THREE.Vector3(Math.cos(a) * orbit, 0, Math.sin(a) * orbit));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x6f86c9, transparent: true, opacity: 0.3 }));
  scene.add(line);
}

const loader = new THREE.TextureLoader();

for (const body of BODIES) {
  if (body.key === 'moon') continue;           // 月球随地球单独建
  const sys = new THREE.Group();
  scene.add(sys);

  let mesh;
  if (body.key === 'sun') {
    mesh = sun;
  } else {
    const tex = TEX[body.key] || null;
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(body.r, 40, 28),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    sys.add(mesh);
    addOrbitLine(body.orbit);
  }
  mesh.userData.key = body.key;
  pickables.push(mesh);

  const label = makeLabel(body.zh, body.en, body.key === 'sun' ? 1.2 : 1);
  label.position.y = body.r + 5;
  sys.add(label);
  body.label = label;

  systems[body.key] = { body, sys, mesh };
}

// 地球 + 月球
{
  const earth = systems.earth;
  earth.texDone = false;
  const earthMesh = earth.mesh;
  const realEarth = new THREE.MeshLambertMaterial({ color: 0x5f8fd8 });
  loader.load('tex/earth.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; realEarth.map = t; realEarth.needsUpdate = true; });

  const pivot = new THREE.Group();
  earth.sys.add(pivot);
  const moonMat = new THREE.MeshLambertMaterial({ color: 0xc9c9c9 });
  loader.load('tex/moon.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; moonMat.map = t; moonMat.needsUpdate = true; });
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 24), moonMat);
  moonMesh.position.set(7.5, 0.4, 0);
  moonMesh.userData.key = 'moon';
  pivot.add(moonMesh);
  pickables.push(moonMesh);

  const mline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * TAU_;
        return new THREE.Vector3(Math.cos(a) * 7.5, 0.4, Math.sin(a) * 7.5);
      })
    ),
    new THREE.LineBasicMaterial({ color: 0x8fa8d8, transparent: true, opacity: 0.35 })
  );
  earth.sys.add(mline);

  const mlabel = makeLabel('月球', 'Moon', 0.7);
  mlabel.position.set(7.5, 2.6, 0);
  earth.sys.add(mlabel);
  BODIES.find((b) => b.key === 'moon').label = mlabel;

  systems.moon = { body: BODIES.find((b) => b.key === 'moon'), sys: pivot, mesh: moonMesh, earth };
}

// 土星环（UV 重映射成放射条纹）
{
  const saturn = systems.saturn;
  const geo = new THREE.RingGeometry(11, 17, 96);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const rr = Math.sqrt(pos.getX(i) ** 2 + pos.getY(i) ** 2);
    uv.setXY(i, (rr - 11) / 6, 0.5);
  }
  const strip = canvasTexture(256, 8, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const k = 0.35 + 0.4 * Math.abs(Math.sin(x * 0.11)) + (x % 40 < 6 ? -0.15 : 0);
      g.fillStyle = `rgba(216,196,150,${k})`;
      g.fillRect(x, 0, 1, h);
    }
  });
  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: strip, side: THREE.DoubleSide, transparent: true }));
  ring.rotation.x = Math.PI / 2.3;
  saturn.mesh.add(ring);
}

// 天王星淡环
{
  const u = systems.uranus;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.2, 7.8, 64),
    new THREE.MeshBasicMaterial({ color: 0x9fd8e8, side: THREE.DoubleSide, transparent: true, opacity: 0.25 })
  );
  ring.rotation.x = Math.PI / 2.1;
  u.mesh.add(ring);
}

// 小行星带
{
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU_, r = 82 + Math.random() * 14;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const belt = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9a8f80, size: 1.1, transparent: true, opacity: 0.75 }));
  scene.add(belt);
  systems.belt = { mesh: belt };
}

/* ---------------- 轻量轨道控制 ---------------- */

const controls = {
  target: new THREE.Vector3(0, 0, 0),
  r: 640, phi: 1.05, theta: 0.7,
  follow: null,                 // 跟随的天体 sys（null = 原点）
  minR: 44,
  pointers: new Map(),
  lastPinch: 0,
  downX: 0, downY: 0, dragged: false
};

const cvs = renderer.domElement;
cvs.style.touchAction = 'none';

cvs.addEventListener('pointerdown', (e) => {
  cvs.setPointerCapture(e.pointerId);
  controls.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  controls.downX = e.clientX; controls.downY = e.clientY;
  controls.dragged = false;
  if (controls.pointers.size === 2) {
    const ps = [...controls.pointers.values()];
    controls.lastPinch = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
  }
});
cvs.addEventListener('pointermove', (e) => {
  const prev = controls.pointers.get(e.pointerId);
  if (!prev) return;
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  controls.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (controls.pointers.size === 2) {
    const ps = [...controls.pointers.values()];
    const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    if (controls.lastPinch > 0) {
      controls.r = clampR(controls.r * (controls.lastPinch / d));
    }
    controls.lastPinch = d;
    controls.dragged = true;
    return;
  }
  if (Math.hypot(e.clientX - controls.downX, e.clientY - controls.downY) > 6) controls.dragged = true;
  controls.theta -= dx * 0.005;
  controls.phi = Math.max(0.06, Math.min(Math.PI - 0.06, controls.phi - dy * 0.005));
});
window.addEventListener('pointerup', (e) => {
  if (controls.pointers.has(e.pointerId) && !controls.dragged) pick(e);
  controls.pointers.delete(e.pointerId);
  controls.lastPinch = 0;
});
cvs.addEventListener('wheel', (e) => {
  e.preventDefault();
  controls.r = clampR(controls.r * Math.exp(e.deltaY * 0.0012));
}, { passive: false });

function clampR(r) { return Math.max(controls.minR, Math.min(1500, r)); }

const raycaster = new THREE.Raycaster();
function pick(e) {
  const nd = new THREE.Vector2(
    (e.clientX / innerWidth) * 2 - 1,
    -(e.clientY / innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(nd, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length) selectBody(hits[0].object.userData.key);
}

/* ---------------- 选中 / 视角 / 速度 ---------------- */

let simT = 0;
let timeScale = 1;
let selected = 'sun';
let tween = null;   // {t, dur, r0, r1, phi0, phi1, theta0, theta1}

function bodyWorldPos(key, out) {
  const s = systems[key];
  if (!s) return out.set(0, 0, 0);
  if (key === 'moon') return s.mesh.getWorldPosition(out);
  return s.mesh.getWorldPosition(out);
}

function selectBody(key) {
  selected = key;
  const s = systems[key];
  const sph = sunSideSpherical(key, Math.max(s.body.minR * 1.7, 14));
  startTween(sph.r, sph.phi, sph.theta, key);
  renderInfo(key);
}

/** 聚焦天体时，把相机放在「太阳 → 天体」的延长线上（略抬高），
    这样看到的是被照亮的一面，地月关系也一目了然 */
function sunSideSpherical(key, r1) {
  const bw = bodyWorldPos(key, new THREE.Vector3());
  const dir = bw.length() > 0.001 ? bw.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const off = dir.multiplyScalar(r1);
  off.y += r1 * 0.3;
  const len = off.length();
  return {
    r: len,
    phi: Math.acos(Math.max(-1, Math.min(1, off.y / len))),
    theta: Math.atan2(off.z, off.x)
  };
}

function goView(v) {
  if (v === 'earth') {
    const sp = sunSideSpherical('earth', 30);
    startTween(sp.r, sp.phi, sp.theta, 'earth');
    return;
  }
  const t = { overview: { r: 640, phi: 1.05 }, top: { r: 720, phi: 0.1 }, edge: { r: 640, phi: 1.56 } }[v];
  if (!t) return;
  startTween(t.r, t.phi, null, 'sun');
}

function startTween(r1, phi1, theta1, key) {
  tween = {
    t: 0, dur: 0.9,
    r0: controls.r, r1,
    phi0: controls.phi, phi1: phi1 != null ? phi1 : controls.phi,
    theta0: controls.theta, theta1: theta1 != null ? theta1 : controls.theta,
    key
  };
  controls.follow = systems[key];
  controls.minR = systems[key].body.minR;
}

/* ---------------- UI ---------------- */

const chipsEl = document.getElementById('chips');
const infoEl = document.getElementById('info');

function renderChips() {
  chipsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.key === selected));
}

for (const b of BODIES) {
  const btn = document.createElement('button');
  btn.className = 'chip' + (b.key === selected ? ' on' : '');
  btn.dataset.key = b.key;
  btn.innerHTML = `<i style="background:${b.dot}"></i>${b.zh}<small>${b.en}</small>`;
  btn.addEventListener('click', () => selectBody(b.key));
  chipsEl.appendChild(btn);
}

function renderInfo(key) {
  const b = BODIES.find((x) => x.key === key);
  infoEl.innerHTML =
    `<h2>${b.zh}<small>${b.en}</small></h2>` +
    b.info.rows.map((r) => `<div class="row"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('') +
    `<p class="fun">${b.info.fun[0]}</p>` +
    b.info.rows.map((r) => `<div class="row"><span>${r[0].split(' ')[1] || r[0]}</span><span>${r[2]}</span></div>`).join('') +
    `<p class="fun en">${b.info.fun[1]}</p>`;
  renderChips();
}
renderInfo(selected);

// 视角按钮
document.querySelectorAll('#views .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#views .btn').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    goView(btn.dataset.view);
  });
});

// 速度按钮
document.querySelectorAll('#speedbar .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#speedbar .btn').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    timeScale = parseFloat(btn.dataset.speed);
  });
});

// 标签开关
document.getElementById('btnLabels').addEventListener('click', (e) => {
  const on = e.currentTarget.classList.toggle('on');
  for (const b of BODIES) if (b.label) b.label.visible = on;
});

/* ---------------- 每帧推进 ---------------- */

const tmpV = new THREE.Vector3();

function tick() {
  const dt = Math.min(0.05, 1 / 60);
  simT += dt * timeScale;

  // 行星位置（开普勒：外行星更慢）
  for (const b of BODIES) {
    const s = systems[b.key];
    if (!s || b.key === 'moon' || b.key === 'sun') continue;
    const a = (simT * KEPLER) / Math.pow(b.orbit, 1.5);
    s.sys.position.set(Math.cos(a) * b.orbit, 0, Math.sin(a) * b.orbit);
    s.mesh.rotation.y += b.spin * dt * (timeScale ? timeScale : 0);
  }
  sun.rotation.y += 0.04 * dt * timeScale;

  // 月球绕地球
  const moon = systems.moon;
  moon.sys.rotation.y += 0.5 * dt * timeScale;
  moon.mesh.rotation.y += 0.5 * dt * timeScale;   // 潮汐锁定

  systems.belt.mesh.rotation.y += 0.01 * dt * timeScale;

  // 相机跟随 + 补间
  const focus = controls.follow || systems.sun;
  bodyWorldPos(focus.body ? focus.body.key : 'sun', tmpV);
  if (focus.body && focus.body.key === 'sun') tmpV.set(0, 0, 0);
  controls.target.lerp(tmpV, tween ? 0.12 : 1);

  if (tween) {
    tween.t += dt / tween.dur;
    const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3);
    controls.r = tween.r0 + (tween.r1 - tween.r0) * k;
    controls.phi = tween.phi0 + (tween.phi1 - tween.phi0) * k;
    controls.theta = tween.theta0 + (tween.theta1 - tween.theta0) * k;
    if (tween.t >= 1) tween = null;
  }

  camera.position.set(
    controls.target.x + controls.r * Math.sin(controls.phi) * Math.cos(controls.theta),
    controls.target.y + controls.r * Math.cos(controls.phi),
    controls.target.z + controls.r * Math.sin(controls.phi) * Math.sin(controls.theta)
  );
  camera.lookAt(controls.target);

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);
/* 调试 / 自动化测试用：可以手动推帧（无头截图时 rAF 会被冻结） */
window.__solar = { tick };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
