/* =====================================================================
   games/brick/view.js — 积木救救队 · UI 层（3D 版）
   斜俯正交相机看一块乐高底板：水面凹下去、高台立起来、
   每块积木顶上有一颗小圆柱 stud。光标是一块半透明的「幽灵砖」，
   小人 = 圆柱身体 + 小朋友头像的头。
   ===================================================================== */
import { lerp } from '../../core/util.js';
import { createStage, stageAlive } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>' +
  '<div class="row">' +
    '<button class="pad" data-act="place">▣ 放一块</button>' +
    '<button class="pad" data-act="remove">▢ 拆一块</button>' +
    '<button class="pad" data-act="test">🚩 出发</button>' +
    '<button class="pad" data-act="love">❤️ +10</button>' +
  '</div>';

export const HINT =
  '<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 移动光标 · <kbd>空格</kbd> 放积木 · ' +
  '<kbd>X</kbd> 拆积木 · <kbd>回车</kbd> 出发让小人走 · 也可以直接点画面试试';

export function hud(S) {
  const lvName = ['搭桥过河', '桥加台阶', '宽河与高台', '翻过大墙', '自由搭建'][S.level - 1] || '';
  return [
    ['关卡', lvName],
    ['砖块', S.bricksLeft > 900 ? '管够' : S.bricksLeft],
    ['星星', '⭐' + S.stars]
  ];
}

export function makeBackground() { return null; }

/* ---------------- 3D 舞台 ---------------- */

let st = null, fx = null;
let cellGroup = null, brickPool = [], brickUsed = 0;
let ghost = null, figG = null, goalFlag = null, waterTiles = [];
let builtKey = '';

const PALETTE = [0xe03131, 0xffd43b, 0x4dabf7, 0x51cf66, 0xff922b, 0xf1f3f5, 0x9b7bff, 0xff8fb1];

const GRID_COLS = 9, GRID_ROWS = 7;   // 与 game.js 的世界尺寸对应（避免循环引用不 import）

/** 逻辑格 → 3D 世界（板面平躺，逻辑 y → z；网格在画布里居中） */
function cellWorld(L, x, z) {
  const ox = (L.W - GRID_COLS * L.CELL) / 2;
  const oz = (L.H - GRID_ROWS * L.CELL) / 2;
  return [ox + x * L.CELL - L.W / 2 + L.CELL / 2, oz + z * L.CELL - L.H / 2 + L.CELL / 2];
}

function ensureStage(L) {
  // 重进游戏时旧舞台已被拆除：清空视图模块的旧状态再重建
  brickPool = []; brickUsed = 0; builtKey = ''; waterTiles = [];

  st = createStage({
    W: L.W, H: L.H,
    ortho: { w: L.W, h: L.H, margin: 1.32 },
    cam: [0, 860, 560], look: [0, 0, 0],
    bg: 0x87ceeb
  });
  if (!st) return false;
  st.cellSize = L.CELL;   // pickCell 射线拾取要用
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, z || 24, y - L.H / 2]);
  const T = st.T;

  // 底板（乐高底板的绿色厚板）
  const plate = new T.Mesh(
    new T.BoxGeometry(L.W - 40, 18, L.H - 40),
    new T.MeshLambertMaterial({ color: 0x6fbf5f })
  );
  plate.position.y = -9;
  st.scene.add(plate);

  // 底板 stud：绿色小圆柱阵列（真·乐高底板的样子）
  const studGeo = new T.CylinderGeometry(7, 7, 5, 10);
  const studMat = new T.MeshLambertMaterial({ color: 0x7fce6f });
  for (let z = 0; z < 7; z++) {
    for (let x = 0; x < 9; x++) {
      const s = new T.Mesh(studGeo, studMat);
      const [wx, wz] = cellWorld(L, x, z);
      s.position.set(wx, 2.5, wz);
      st.scene.add(s);
    }
  }

  // 单元格内容（水面 / 高台）每关重建
  cellGroup = new T.Group();
  st.scene.add(cellGroup);

  // 幽灵光标砖
  ghost = new T.Group();
  const gb = new T.Mesh(
    new T.BoxGeometry(L.CELL * 0.9, L.BRICK_H, L.CELL * 0.9),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38 })
  );
  ghost.add(gb);
  const gring = new T.Mesh(
    new T.BoxGeometry(L.CELL * 1.02, 3, L.CELL * 1.02),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  gring.position.y = -L.BRICK_H / 2 - 1;
  ghost.add(gring);
  st.scene.add(ghost);

  // 终点小旗
  goalFlag = new T.Group();
  const pole = new T.Mesh(new T.BoxGeometry(5, 64, 5), new T.MeshBasicMaterial({ color: 0xe9ecef }));
  pole.position.y = 32;
  goalFlag.add(pole);
  const flag = new T.Mesh(new T.BoxGeometry(32, 19, 4), new T.MeshBasicMaterial({ color: 0xff6b6b }));
  flag.position.set(16, 54, 0);
  goalFlag.add(flag);
  st.scene.add(goalFlag);

  // 小人：腿 + 身体 + 圆手 + 头像头
  figG = new T.Group();
  const legMat = new T.MeshLambertMaterial({ color: 0x4dabf7 });
  for (const lx of [-8, 8]) {
    const leg = new T.Mesh(new T.BoxGeometry(11, 20, 11), legMat);
    leg.position.set(lx, 10, 0);
    figG.add(leg);
  }
  const torso = new T.Mesh(new T.BoxGeometry(30, 26, 16), new T.MeshLambertMaterial({ color: 0xff6b6b }));
  torso.position.y = 33;
  figG.add(torso);
  for (const hx of [-19, 19]) {
    const hand = new T.Mesh(new T.CylinderGeometry(5, 5, 14, 10), new T.MeshLambertMaterial({ color: 0xffd43b }));
    hand.position.set(hx, 32, 0);
    figG.add(hand);
  }
  const img = new Image();
  img.src = avatar.heroURL();
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace;
  const head = new T.Mesh(new T.CylinderGeometry(13, 13, 18, 16), new T.MeshLambertMaterial({ color: 0xffe066 }));
  head.position.y = 55;
  figG.add(head);
  const face = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
  face.scale.set(24, 24, 1);
  face.position.set(0, 56, 13.5);
  figG.add(face);
  img.onload = () => { tex.needsUpdate = true; };
  st.scene.add(figG);

  st.onFrame = (dt) => { if (fx) fx.update(dt); };
  return true;
}

/** 一块积木 = 圆角感的盒子 + 顶面 stud，从池子里取 */
function takeBrick(L, colorHex) {
  const T = st.T;
  let g = brickPool[brickUsed];
  if (!g) {
    g = new T.Group();
    const body = new T.Mesh(
      new T.BoxGeometry(L.CELL * 0.9, L.BRICK_H, L.CELL * 0.9),
      new T.MeshLambertMaterial({ color: 0xffffff })
    );
    body.position.y = L.BRICK_H / 2;
    g.add(body);
    const stud = new T.Mesh(
      new T.CylinderGeometry(L.CELL * 0.18, L.CELL * 0.18, 7, 12),
      new T.MeshLambertMaterial({ color: 0xffffff })
    );
    stud.position.y = L.BRICK_H + 3.5;
    g.add(stud);
    g.userData = { body, stud };
    st.scene.add(g);
    brickPool.push(g);
  }
  g.visible = true;
  g.userData.body.material.color.setHex(colorHex);
  g.userData.stud.material.color.setHex(colorHex);
  brickUsed++;
  return g;
}

/** 每关 / 每次搭拆后重建整个板面（格子数少，重建比 diff 简单可靠） */
function rebuild(S, L) {
  const T = st.T;
  const w = S.world;
  cellGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  st.scene.remove(cellGroup);
  cellGroup = new T.Group();
  st.scene.add(cellGroup);
  waterTiles = [];
  brickUsed = 0;

  for (let z = 0; z < w.D; z++) {
    for (let x = 0; x < w.W; x++) {
      const g = w.ground[z][x];
      const [wx, wz] = cellWorld(L, x, z);

      // 水面：蓝色半透明小板，凹在底板下面
      if (g < 0) {
        const water = new T.Mesh(
          new T.BoxGeometry(L.CELL - 2, 8, L.CELL - 2),
          new T.MeshLambertMaterial({ color: 0x4dabf7, transparent: true, opacity: 0.85 })
        );
        water.position.set(wx, -4, wz);
        cellGroup.add(water);
        waterTiles.push(water);
        continue;
      }
      // 高台 / 高墙：从底板立起来的柱子
      if (g > 0) {
        const col = new T.Mesh(
          new T.BoxGeometry(L.CELL - 2, g * L.BRICK_H, L.CELL - 2),
          new T.MeshLambertMaterial({ color: 0x8fce7f })
        );
        col.position.set(wx, (g * L.BRICK_H) / 2, wz);
        cellGroup.add(col);
      }
      // 该格叠着的积木
      const stack = w.stacks[z][x];
      for (let i = 0; i < stack.length; i++) {
        const m = takeBrick(L, PALETTE[stack[i] % PALETTE.length]);
        m.position.set(wx, (g < 0 ? 0 : g * L.BRICK_H) + i * L.BRICK_H, wz);
      }
    }
  }

  // 终点旗
  if (S.level <= LEVELS_GOAL.length) {
    const gl = LEVELS_GOAL[S.level - 1];
    if (gl) {
      const [gx, gz] = cellWorld(L, gl[0], gl[1]);
      goalFlag.visible = true;
      goalFlag.position.set(gx, surfaceTop(S, L, gl[0], gl[1]), gz);
    } else goalFlag.visible = false;
  }
  builtKey = levelKey(S);
}

function surfaceTop(S, L, x, z) {
  const w = S.world;
  const g = w.ground[z][x];
  const n = w.stacks[z][x].length;
  return (g < 0 ? 0 : g * L.BRICK_H) + n * L.BRICK_H;
}

/** 关卡目标表（跟 game.js 的 LEVELS 对应，只取 goal 坐标画旗子） */
const LEVELS_GOAL = [[7, 3], [6, 3], [7, 3], [7, 3], null];

function levelKey(S) {
  return S.level + ':' + S.world.stacks.map((r) => r.map((c) => c.length).join('')).join('|');
}

/* ---------------- 每帧绘制 ---------------- */

/** 画布点击 → 板面格子：把 2D 画布上的点还原成 3D 射线，与板面 y=0 求交 */
export function pickCell(p, LW, LH) {
  if (!st || !st.cellSize) return null;
  const T = st.T;
  // 2D 画布在舞台元素里按宽高比居中 letterbox，先换算成元素内的相对位置
  const rect2 = st.two.getBoundingClientRect();
  const rectE = st.stageEl.getBoundingClientRect();
  const relX = rect2.left - rectE.left + (p.x / LW) * rect2.width;
  const relY = rect2.top - rectE.top + (p.y / LH) * rect2.height;
  const ndc = new T.Vector2((relX / rectE.width) * 2 - 1, -(relY / rectE.height) * 2 + 1);
  const ray = new T.Raycaster();
  ray.setFromCamera(ndc, st.camera);

  if (Math.abs(ray.ray.direction.y) < 1e-6) return null;
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  if (t < 0) return null;
  const wx = ray.ray.origin.x + ray.ray.direction.x * t;
  const wz = ray.ray.origin.z + ray.ray.direction.z * t;

  const cs = st.cellSize;
  const ox = (LW - GRID_COLS * cs) / 2;
  const oz = (LH - GRID_ROWS * cs) / 2;
  const x = Math.floor((wx + LW / 2 - ox) / cs);
  const z = Math.floor((wz + LH / 2 - oz) / cs);
  if (x < 0 || z < 0 || x >= GRID_COLS || z >= GRID_ROWS) return null;
  return { x, z };
}

export function draw(ctx, S, L) {
  if (st && !stageAlive(st)) st = null;   // 3D 舞台被拆除过（重玩 / 切游戏）→ 重建
  if (!st && !ensureStage(L)) return;
  if (!S.world) return;
  if (builtKey !== levelKey(S)) rebuild(S, L);

  // 光标幽灵砖：悬在落点高度上，呼吸闪烁
  {
    const w = S.world;
    const { x, z } = S.cursor;
    const [wx, wz] = cellWorld(L, x, z);
    const g = w.ground[z][x];
    const h = (g < 0 ? 0 : g * L.BRICK_H) + w.stacks[z][x].length * L.BRICK_H;
    ghost.visible = S.phase === 'build';
    ghost.position.set(wx, h + L.BRICK_H / 2, wz);
    ghost.children[0].material.opacity = 0.3 + Math.sin(S.T * 5) * 0.1;
  }

  // 水面轻微起伏
  for (let i = 0; i < waterTiles.length; i++) {
    waterTiles[i].position.y = -4 + Math.sin(S.T * 2.4 + i) * 1.2;
  }

  // 小人：格子间插值 + 走路小跳 + 面朝前进方向
  {
    const t = Math.min(1, S.prog);
    const fx0 = lerp(S.from.x, S.fig.x, t);
    const fz0 = lerp(S.from.z, S.fig.z, t);
    const w = S.world;
    const gA = w.ground[S.from.z] ? w.ground[S.from.z][S.from.x] : 0;
    const gB = w.ground[S.fig.z] ? w.ground[S.fig.z][S.fig.x] : 0;
    const nA = w.stacks[S.from.z][S.from.x].length;
    const nB = w.stacks[S.fig.z][S.fig.x].length;
    const yA = (gA < 0 ? 0 : gA * L.BRICK_H) + nA * L.BRICK_H;
    const yB = (gB < 0 ? 0 : gB * L.BRICK_H) + nB * L.BRICK_H;
    const y = lerp(yA, yB, t) + Math.abs(Math.sin(t * Math.PI)) * (S.phase === 'walk' ? 8 : 0);
    const [wx, wz] = cellWorld(L, fx0, fz0);
    figG.position.set(wx, y, wz);
    if (S.phase === 'walk') {
      const dx = S.fig.x - S.from.x, dz = S.fig.z - S.from.z;
      if (dx || dz) figG.rotation.y = Math.atan2(dx, dz);
      figG.rotation.z = Math.sin(S.T * 18) * 0.06;
    } else {
      figG.rotation.z = Math.sin(S.T * 2) * 0.03;
    }
  }

  // 终点旗飘动
  if (goalFlag.visible) goalFlag.rotation.y = Math.sin(S.T * 2.6) * 0.14;

  st.render(1 / 60);
}
