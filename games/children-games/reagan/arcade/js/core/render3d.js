/* =====================================================================
   core/render3d.js — 3D 舞台（three.js 封装）
   给「3D 化」的游戏提供：独立的 WebGL 画布（盖在 2D 画布上）、
   场景 / 相机 / 灯光、常用几何工厂、逻辑坐标 → 世界坐标映射、
   屏幕震动与自适应尺寸。

   约定：
   - 游戏的 meta.render3d = true 时，view.js 才会使用本模块；
   - 逻辑坐标 (x∈[0,W], y∈[0,H]，y 向下) 映射到世界坐标：
       wx = x - W/2，wy = H/2 - y（y 轴向上），z 表示景深。
   - three.js 通过 index.html 的 module 胶水挂到 window.THREE；
     未就绪时 createStage 返回 null，视图下一帧会重试。
   ===================================================================== */

import { disposeCurrent3DFX } from './fx3d.js';

const CANVAS_ID = 'stage3d';
let stage = null;

export function getTHREE() {
  return window.THREE || null;
}

/** 创建（或重建）3D 舞台。
    opts: { fov, cam:[x,y,z], look:[x,y,z], bg, ortho:{w,h,margin} }
    ortho 存在时用正交相机：格盘类游戏的判定平面零畸变（可读性优先）。
    w/h 是「必须完整装进画面的内容尺寸」，宽高比不足的一边自动放大留白。 */
export function createStage(opts = {}) {
  const T = getTHREE();
  if (!T) return null;
  if (stage) return stage;

  const two = document.getElementById('cv');
  const stageEl = two.parentElement;               // .stage
  // 注意：不能隐藏 2D 画布 —— .stage 的高度由它撑起，隐藏会让整个舞台塌成 0。
  // 3D 画布以绝对定位盖在它上面（不透明背景会完全遮住）。
  two.getContext('2d').clearRect(0, 0, two.width, two.height);

  const cv = document.createElement('canvas');
  cv.id = CANVAS_ID;
  stageEl.appendChild(cv);

  const w = stageEl.clientWidth || 800;
  const h = stageEl.clientHeight || 560;

  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h);

  const scene = new T.Scene();
  if (opts.bg !== undefined) {
    if (typeof opts.bg === 'number') scene.background = new T.Color(opts.bg);
    else scene.background = opts.bg;                // 已建好的纹理 / 渐变画布
  }

  const camera = opts.ortho
    ? new T.OrthographicCamera(-1, 1, 1, -1, -4000, 8000)
    : new T.PerspectiveCamera(opts.fov || 50, w / h, 0.5, 9000);
  camera.position.set(...(opts.cam || [0, -140, 640]));
  camera.lookAt(...(opts.look || [0, 0, 0]));
  /** 把 ortho 的 fit 尺寸换算成当前视口的左右上下边界 */
  const fitFrustum = (aspect) => {
    const f = opts.ortho;
    const margin = f.margin == null ? 1.06 : f.margin;
    const halfH = Math.max((f.h * margin) / 2, (f.w * margin) / (2 * aspect));
    const halfW = halfH * aspect;
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
  };
  if (opts.ortho) {
    fitFrustum(w / h);
    camera.updateProjectionMatrix();   // 改完 frustum 必须刷新投影矩阵，否则首帧还是 ±1 的极端放大
  }

  scene.add(new T.AmbientLight(0xffffff, opts.ambient ?? 0.85));
  const dl = new T.DirectionalLight(0xfff6e8, opts.dir ?? 0.95);
  dl.position.set(...(opts.dlight || [260, 620, 520]));
  scene.add(dl);

  stage = {
    T, renderer, scene, camera, cv, stageEl, two,
    world: new T.Group(),                           // 游戏物体的公共父节点
    W: opts.W || 800, H: opts.H || 560,
    shakeAmt: 0, shakeT: 0,
    render(dt) {                                    // 每帧渲染（视图在 draw 末尾调用）
      if (stage.onFrame) stage.onFrame(dt);
      if (stage.shakeT > 0) {
        stage.shakeT -= dt;
        const a = stage.shakeAmt * Math.min(1, stage.shakeT / 0.32) * 14;
        camera.position.x += (Math.random() - 0.5) * a;
        camera.position.y += (Math.random() - 0.5) * a;
        if (stage.shakeT <= 0) stage.shakeAmt = 0;
      }
      renderer.render(scene, camera);
    }
  };
  scene.add(stage.world);
  window.__stage3d = stage;

  // 视口尺寸自适应（窗口 / 全屏切换都会触发）
  function onResize() {
    const sw = stageEl.clientWidth || w;
    const sh = stageEl.clientHeight || h;
    renderer.setSize(sw, sh, false);
    camera.aspect = sw / sh;
    if (opts.ortho) fitFrustum(sw / sh);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);
  stage.onResize = onResize;

  return stage;
}

/** 视图持有的 stage 是否还有效：回首页 / 切游戏时画布会被拆除
    （removeStage），视图模块里的 st 还指向它，再渲染就是画到
    一张已经不在页面里的画布上 → 重玩时整屏空白。 */
export function stageAlive(s) {
  return !!s && s.cv.isConnected;
}

/** 逻辑坐标 → 世界坐标（y 翻转成向上） */
export function toWorld(stage, x, y, z = 0) {
  return [x - stage.W / 2, stage.H / 2 - y, z];
}

/** 把 mesh 摆到逻辑坐标 */
export function place(stage, mesh, x, y, z = 0) {
  const [wx, wy, wz] = toWorld(stage, x, y, z);
  mesh.position.set(wx, wy, wz);
}

/* ---------------- 几何工厂（共享几何与材质，按颜色缓存） ---------------- */

const geoCache = new Map();
const matCache = new Map();

export function boxMesh(stage, w, h, d, color, radius) {
  const T = stage.T;
  const key = 'b' + w + 'x' + h + 'x' + d + (radius ? 'r' + radius : '');
  let geo = geoCache.get(key);
  if (!geo) {
    geo = radius ? new T.BoxGeometry(w, h, d, 1, 1, 1) : new T.BoxGeometry(w, h, d);
    geoCache.set(key, geo);
  }
  const mkey = 'm' + color;
  let mat = matCache.get(mkey);
  if (!mat) {
    mat = new T.MeshLambertMaterial({ color });
    matCache.set(mkey, mat);
  }
  const mesh = new T.Mesh(geo, mat);
  stage.world.add(mesh);
  return mesh;
}

export function sphereMesh(stage, r, color) {
  const T = stage.T;
  const key = 's' + r;
  let geo = geoCache.get(key);
  if (!geo) { geo = new T.SphereGeometry(r, 24, 18); geoCache.set(key, geo); }
  const mkey = 'm' + color;
  let mat = matCache.get(mkey);
  if (!mat) { mat = new T.MeshLambertMaterial({ color }); matCache.set(mkey, mat); }
  const mesh = new T.Mesh(geo, mat);
  stage.world.add(mesh);
  return mesh;
}

export function cylinderMesh(stage, rTop, rBottom, h, color) {
  const T = stage.T;
  const key = 'c' + rTop + '_' + rBottom + '_' + h;
  let geo = geoCache.get(key);
  if (!geo) { geo = new T.CylinderGeometry(rTop, rBottom, h, 20); geoCache.set(key, geo); }
  const mkey = 'm' + color;
  let mat = matCache.get(mkey);
  if (!mat) { mat = new T.MeshLambertMaterial({ color }); matCache.set(mkey, mat); }
  const mesh = new T.Mesh(geo, mat);
  stage.world.add(mesh);
  return mesh;
}

/** 头像 / 图片贴成的双面 billboard（保持「靠脸认人」的约定） */
export function spriteMesh(stage, img, w, h) {
  const T = stage.T;
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(w, h, 1);
  stage.world.add(sp);
  return sp;
}

/** 屏幕震动（撞击反馈用），amount 0~1 */
export function shake(stage, amount) {
  stage.shakeAmt = Math.max(stage.shakeAmt, amount);
  stage.shakeT = 0.32;
}

/** 每帧渲染（由游戏视图在 draw 末尾调用）。返回 false 表示 three 尚未就绪 */
export function render(stage, dt) {
  if (!stage) return false;
  const T = stage.T;
  if (stage.shakeT > 0) {
    stage.shakeT -= dt;
    const a = stage.shakeAmt * Math.min(1, stage.shakeT / 0.32) * 14;
    stage.camera.position.x += (Math.random() - 0.5) * a;
    stage.camera.position.y += (Math.random() - 0.5) * a;
    if (stage.shakeT <= 0) stage.shakeAmt = 0;
  }
  renderer_render(stage, dt);
  return true;
}

function renderer_render(stage, dt) {
  if (stage.onFrame) stage.onFrame(dt);
  stage.renderer.render(stage.scene, stage.camera);
}

/** 离开 3D 游戏 / 回首页时调用：拆除 3D 画布，恢复 2D 画布 */
export function removeStage() {
  if (!stage) return;
  disposeCurrent3DFX();               // 先让 fx3d 置空，逻辑层 FX 调用回落 2D
  window.removeEventListener('resize', stage.onResize);
  document.removeEventListener('fullscreenchange', stage.onResize);
  stage.cv.remove();
  stage = null;
  geoCache.clear();
  matCache.clear();
}
