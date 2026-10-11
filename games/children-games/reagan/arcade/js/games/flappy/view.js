/* =====================================================================
   games/flappy/view.js — 小鸟飞飞 · UI 层（3D 版）
   three.js 渲染：立体管子、带光影的小鸟（脸是小朋友的头像）、视差云。
   逻辑层 game.js 与控制层 controls.js 不变。
   ===================================================================== */
import { clamp } from '../../core/util.js';
import { createStage, place } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad wide" data-act="flap">🪽 拍翅膀</button>' +
  '</div>';

export const HINT =
  '<kbd>空格</kbd> 或 <kbd>↑</kbd> 拍翅膀 · 也可以直接点屏幕 · ' +
  '撞到管子会掉一颗爱心，还有两次机会';

export function hud(S) {
  return [
    ['得分', S.score],
    ['最好', S.best],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—']
  ];
}

export function makeBackground() { return null; }

/* ---------------- 3D 舞台与元素 ---------------- */

let st = null, fx = null;
let birdG = null, wingL = null, wingR = null;
let pipePool = [], starMesh = null, clouds = [];

const PIPE_R = 47, RIM_R = 56;

function ensureStage(L) {
  st = createStage({
    W: L.W, H: L.H,
    fov: 50,
    cam: [0, -120, 660], look: [0, -60, 0],
    bg: 0x8fd3f4
  });
  if (!st) return false;
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, L.H / 2 - y, z || 0]);

  const T = st.T;

  // 地面
  const ground = new T.Mesh(new T.BoxGeometry(3200, 90, 420), new T.MeshLambertMaterial({ color: 0x8fd96a }));
  ground.position.set(0, L.H / 2 - L.GROUND_Y - 45, 0);
  st.scene.add(ground);

  // 云（视差）
  for (let i = 0; i < 6; i++) {
    const c = new T.Mesh(new T.SphereGeometry(34 + (i % 3) * 14, 12, 10), new T.MeshLambertMaterial({ color: 0xffffff }));
    c.position.set(-600 + i * 260, 60 + (i % 3) * 60, -420 - (i % 2) * 160);
    c.scale.y = 0.55;
    c.userData.base = c.position.x;
    st.scene.add(c);
    clouds.push(c);
  }

  // 管子池（8 组：上管 / 下管 / 两个管口圈）
  const mat = new T.MeshLambertMaterial({ color: 0x4fae4f });
  const rimMat = new T.MeshLambertMaterial({ color: 0x3c8c3c });
  for (let i = 0; i < 8; i++) {
    const g = new T.Group();
    const top = new T.Mesh(new T.CylinderGeometry(PIPE_R, PIPE_R, 10, 18), mat);
    const bot = new T.Mesh(new T.CylinderGeometry(PIPE_R, PIPE_R, 10, 18), mat);
    const rimT = new T.Mesh(new T.CylinderGeometry(RIM_R, RIM_R, 18, 18), rimMat);
    const rimB = new T.Mesh(new T.CylinderGeometry(RIM_R, RIM_R, 18, 18), rimMat);
    g.add(top, bot, rimT, rimB);
    g.userData = { top, bot, rimT, rimB };
    st.world.add(g);
    pipePool.push(g);
  }

  // 星星
  starMesh = new T.Mesh(new T.OctahedronGeometry(16), new T.MeshLambertMaterial({ color: 0xffd43b, emissive: 0xaa8800 }));
  st.world.add(starMesh);

  // 小鸟：身体 + 翅膀 + 头像脸
  birdG = new T.Group();
  const body = new T.Mesh(new T.SphereGeometry(19, 24, 18), new T.MeshLambertMaterial({ color: 0xffd43b }));
  birdG.add(body);
  const wingMat = new T.MeshLambertMaterial({ color: 0xf59f00 });
  wingL = new T.Mesh(new T.BoxGeometry(20, 5, 14), wingMat);
  wingL.position.set(-2, 4, 16);
  wingR = new T.Mesh(new T.BoxGeometry(20, 5, 14), wingMat);
  wingR.position.set(-2, 4, -16);
  birdG.add(wingL, wingR);
  // 头像脸（billboard 贴片）
  const img = new Image();
  img.src = avatar.heroURL();
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace;
  const face = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
  face.scale.set(26, 26, 1);
  face.position.set(8, 2, 17);
  birdG.add(face);
  img.onload = () => { tex.needsUpdate = true; };
  st.world.add(birdG);

  st.onFrame = (dt) => { if (fx) fx.update(dt); };
  return true;
}

/* ---------------- 每帧绘制 ---------------- */

export function draw(ctx, S, L) {
  if (!st && !ensureStage(L)) return;

  // 云的视差
  for (const c of clouds) {
    let x = ((c.userData.base - S.pos * 0.22) % 1600 + 1600) % 1600 - 700;
    c.position.x = x;
  }

  // 管子
  for (let i = 0; i < pipePool.length; i++) {
    const g = pipePool[i], p = S.pipes[i];
    if (!p || p.x > L.W + 80 || p.x + 200 < -80) { g.visible = false; continue; }
    g.visible = true;
    g.position.set(p.x - L.W / 2 + L.PIPE_W / 2, 0, 0);
    const hT = p.gapY + 40;
    g.userData.top.scale.y = hT / 10;
    g.userData.top.position.y = L.H / 2 - hT / 2 + 20;
    g.userData.rimT.position.y = L.H / 2 - p.gapY + 9;
    const hB = L.GROUND_Y - (p.gapY + p.gap);
    g.userData.bot.scale.y = hB / 10;
    g.userData.bot.position.y = L.H / 2 - p.gapY - p.gap - hB / 2;
    g.userData.rimB.position.y = L.H / 2 - p.gapY - p.gap - 9;
  }

  // 星星
  const coinPipe = S.pipes.find((p) => p.hasCoin && !p.coinTaken && p.x < L.W + 60 && p.x > -60);
  if (coinPipe) {
    starMesh.visible = true;
    place(st, starMesh, coinPipe.x + L.PIPE_W / 2, coinPipe.gapY + coinPipe.gap / 2 + Math.sin(S.T * 4) * 6, 30);
    starMesh.rotation.y += 0.04;
    starMesh.rotation.x = 0.5;
  } else starMesh.visible = false;

  // 小鸟
  birdG.visible = !(S.invul > 0 && Math.floor(S.invul * 12) % 2 === 0);
  place(st, birdG, L.BIRD_X, S.bird.y, 80);
  birdG.rotation.z = clamp(-S.bird.vy / 900, -0.9, 0.45);
  const flapK = S.bird.wing / 0.25;
  wingL.rotation.x = -flapK * 1.1;
  wingR.rotation.x = flapK * 1.1;

  st.render(1 / 60);
}
