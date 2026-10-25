/* =====================================================================
   games/snake/view.js — 贪吃蛇 · UI 层（3D 版）
   斜俯「正交」相机（Crossy Road 视角，格子对位零畸变），
   头尾平滑插值：头往前伸、尾往回收，中间节原地不动。
   ===================================================================== */
import { clamp, lerp } from '../../core/util.js';
import { createStage, stageAlive } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>';

export const HINT =
  '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 控制方向 · ' +
  '也可以在屏幕上滑动 · 撞墙会从另一边穿出来';

export function hud(S) {
  return [
    ['得分', S.score],
    ['长度', S.snake.length],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—']
  ];
}

export function makeBackground() { return null; }

/* ---------------- 3D 舞台与元素 ---------------- */

let st = null, fx = null;
let segPool = [], eyeL = null, eyeR = null, headG = null;
let foodMesh = null, foodSprite = null, tiles = [];
let boardBuilt = false;

const FRUIT_COLORS = { '🍎': 0xe03131, '🍌': 0xfab005, '🍇': 0x9b59b6, '🍓': 0xff6b81, '🍊': 0xff922b, '🍉': 0x51cf66, '🍒': 0xc2255c, '🥝': 0x94c94a };

/** 逻辑坐标 → 平躺板面（x 右、z 朝镜头），y 是离地高度 */
function flat(L, lx, ly, y) {
  return [lx - L.W / 2, y, ly - L.H / 2];
}

function ensureStage(L) {
  // 重进游戏时旧舞台已被拆除：清空视图模块的旧状态再重建
  tiles = [];
  segPool = [];
  prevSnake = null;

  st = createStage({
    W: L.W, H: L.H,
    ortho: { w: L.W, h: L.H, margin: 1.1 },    // 留边小一点，棋盘尽量占满画布
    cam: [0, 700, 430], look: [0, 0, 0],
    bg: 0xfbeed3                               // 奶油底：明亮暖色，绿蛇一眼就跳出来
  });
  if (!st) return false;
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, L.H / 2 - y, z || 0]);
  const T = st.T;

  // 棋盘格（暖沙色棋盘格）：不受灯光影响的 Unlit 材质，
  // 颜色所见即所得，怎么照都是明亮护眼的底子
  for (let y = 0; y < L.N; y++) {
    for (let x = 0; x < L.N; x++) {
      const m = new T.Mesh(
        new T.BoxGeometry(L.CELL - 1, 8, L.CELL - 1),
        new T.MeshBasicMaterial({ color: (x + y) % 2 ? 0xf7ecd4 : 0xefe1bc })
      );
      const [wx, , wz] = flat(L, L.PAD + x * L.CELL + L.CELL / 2, L.PAD + y * L.CELL + L.CELL / 2);
      m.position.set(wx, -4, wz);
      st.world.add(m);
      tiles.push(m);
    }
  }
  // 边框：立在地上的四条蜂蜜木色矮沿
  const frameMat = new T.MeshBasicMaterial({ color: 0xd9a05b });
  const side = L.N * L.CELL + 20;
  const mid = L.PAD + (L.N * L.CELL) / 2;
  for (const [w, d, x, y] of [
    [side + 24, 20, L.W / 2, L.PAD - 12],
    [side + 24, 20, L.W / 2, L.PAD + L.N * L.CELL + 12],
    [20, side + 24, L.PAD - 12, mid],
    [20, side + 24, L.PAD + L.N * L.CELL + 12, mid]
  ]) {
    const m = new T.Mesh(new T.BoxGeometry(w, 26, d), frameMat);
    const [wx, , wz] = flat(L, x, y);
    m.position.set(wx, 0, wz);
    st.world.add(m);
  }

  // 蛇身池（坐在板面上）
  for (let i = 0; i < 70; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(L.CELL - 10, 22, L.CELL - 10),
      new T.MeshLambertMaterial({ color: 0x69db7c })
    );
    st.world.add(m);
    segPool.push(m);
  }

  // 蛇头（带眼睛；眼睛在本地 +z 面，转头朝前进方向）
  headG = new T.Group();
  const head = new T.Mesh(new T.BoxGeometry(L.CELL - 6, 26, L.CELL - 6), new T.MeshLambertMaterial({ color: 0x2f9e44 }));
  head.position.y = 13;
  headG.add(head);
  for (const ex of [-9, 9]) {
    const e = new T.Mesh(new T.SphereGeometry(4.5, 10, 8), new T.MeshLambertMaterial({ color: 0xffffff }));
    e.position.set(ex, 20, 10);
    headG.add(e);
    const p = new T.Mesh(new T.SphereGeometry(2.2, 8, 6), new T.MeshLambertMaterial({ color: 0x212529 }));
    p.position.set(ex, 20, 13);
    headG.add(p);
  }
  st.world.add(headG);

  // 食物：水果球（浮在板面上方）
  foodMesh = new T.Mesh(new T.SphereGeometry(15, 20, 16), new T.MeshLambertMaterial({ color: 0xe03131 }));
  st.world.add(foodMesh);
  const foodCv = document.createElement('canvas');
  foodCv.width = foodCv.height = 64;
  const fcx = foodCv.getContext('2d');
  fcx.font = '48px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  fcx.textAlign = 'center';
  fcx.textBaseline = 'middle';
  fcx.fillText('🍎', 32, 34);
  const fTex = new T.CanvasTexture(foodCv);
  fTex.colorSpace = T.SRGBColorSpace;
  foodSprite = new T.Sprite(new T.SpriteMaterial({ map: fTex, transparent: true }));
  foodSprite.scale.set(30, 30, 1);
  st.world.add(foodSprite);

  st.onFrame = (dt) => { if (fx) fx.update(dt); };
  return true;
}

/* ---------------- 每帧绘制 ---------------- */

let prevSnake = null;   // 上一帧的蛇身快照，用来做头尾平滑插值

export function draw(ctx, S, L) {
  if (st && !stageAlive(st)) st = null;   // 3D 舞台被拆除过（重玩 / 切游戏）→ 重建
  if (!st && !ensureStage(L)) return;

  // 平滑插值：头从旧格滑向新格、尾从被弹出的格缩回，中间节原地不动。
  // 只在「上一帧头/尾与这一帧恰好相邻一格」时插值（正常的逐格移动）；
  // 出生、重开、快进跳格时距离 > 1，直接画在格点上。
  const f = S.over ? 1 : clamp(S.acc / S.tick, 0, 1);
  const cellXY = (s) => [L.PAD + s.x * L.CELL + L.CELL / 2, L.PAD + s.y * L.CELL + L.CELL / 2];
  const adjacent = (a, b) => !!a && !!b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const headFrom = prevSnake && adjacent(prevSnake[0], S.snake[0]) ? prevSnake[0] : null;
  const lastNow = S.snake[S.snake.length - 1];
  const tailFrom =
    prevSnake && prevSnake.length && adjacent(prevSnake[prevSnake.length - 1], lastNow)
      ? prevSnake[prevSnake.length - 1] : null;

  // 蛇身
  for (let i = 0; i < segPool.length; i++) {
    const m = segPool[i];
    if (i < S.snake.length) {
      const s = S.snake[i];
      let [px, py] = cellXY(s);
      if (i === 0 && headFrom) {
        const [ax, ay] = cellXY(headFrom);
        px = lerp(ax, px, f); py = lerp(ay, py, f);
      } else if (i === S.snake.length - 1 && tailFrom && S.snake.length > 2) {
        const [ax, ay] = cellXY(tailFrom);
        px = lerp(ax, px, f); py = lerp(ay, py, f);
      }
      m.visible = true;
      const [wx, , wz] = flat(L, px, py);
      m.position.set(wx, 11, wz);
      const k = i / Math.max(1, S.snake.length);
      m.material.color.setHex(i === 0 ? 0x2b8a3e : (i % 2 ? 0x51cf66 : 0x69db7c));
      m.scale.setScalar(1 - k * 0.25);
    } else m.visible = false;
  }
  prevSnake = S.snake.map((s) => ({ x: s.x, y: s.y }));

  // 蛇头 + 眼睛朝向（与第 0 节同位置）
  const h = S.snake[0];
  if (h) {
    let [hx, hy] = cellXY(h);
    if (headFrom) {
      const [ax, ay] = cellXY(headFrom);
      hx = lerp(ax, hx, f); hy = lerp(ay, hy, f);
    }
    const [wx, , wz] = flat(L, hx, hy);
    headG.position.set(wx, 0, wz);
    headG.rotation.y = Math.atan2(S.dir.x, S.dir.y);
  }

  // 食物
  if (S.food && !S.over) {
    const fx0 = L.PAD + S.food.x * L.CELL + L.CELL / 2;
    const fy0 = L.PAD + S.food.y * L.CELL + L.CELL / 2;
    const bob = Math.sin(S.food.t * 5) * 4;
    foodMesh.position.set(fx0 - L.W / 2, 18 + bob, fy0 - L.H / 2);
    if (S.food.star) {
      // 金色星星：放大的八面体，加自发光在浅底上也醒目
      foodMesh.material.color.setHex(0xffd43b);
      foodMesh.material.emissive.setHex(0x8a6200);
      foodMesh.visible = true;
      foodMesh.scale.setScalar(1.25);
      foodMesh.rotation.y += 0.06;
    } else {
      foodMesh.visible = true;
      foodMesh.scale.setScalar(1);
      foodMesh.rotation.y += 0.03;
      foodMesh.material.color.setHex(FRUIT_COLORS[S.food.emo] || 0xe03131);
      foodMesh.material.emissive.setHex(0x000000);
    }
    foodSprite.visible = false;
  } else {
    foodMesh.visible = false;
    foodSprite.visible = false;
  }

  st.render(1 / 60);
}
