/* =====================================================================
   games/snake/view.js — 贪吃蛇 · UI 层（3D 版）
   俯视 3D 棋盘：立体蛇身（带头和眼睛）、水果球、金色星星。
   ===================================================================== */
import { createStage, place } from '../../core/render3d.js';
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

function ensureStage(L) {
  st = createStage({
    W: L.W, H: L.H,
    fov: 46,
    cam: [0, 560, 460], look: [0, -40, 0],
    bg: 0x0e1a12
  });
  if (!st) return false;
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, L.H / 2 - y, z || 0]);
  const T = st.T;

  // 棋盘格子（棋盘格双色）
  for (let y = 0; y < L.N; y++) {
    for (let x = 0; x < L.N; x++) {
      const m = new T.Mesh(
        new T.BoxGeometry(L.CELL - 4, 8, L.CELL - 4),
        new T.MeshLambertMaterial({ color: (x + y) % 2 ? 0x8fd08a : 0x9edc98 })
      );
      place(st, m, L.PAD + x * L.CELL + L.CELL / 2, L.PAD + y * L.CELL + L.CELL / 2, -12);
      st.world.add(m);
      tiles.push(m);
    }
  }
  // 边框
  const frameMat = new T.MeshLambertMaterial({ color: 0x2f6b3a });
  const side = L.N * L.CELL + 20;
  for (const [w, h, x, y] of [
    [side + 24, 20, L.W / 2, L.PAD - 12],
    [side + 24, 20, L.W / 2, L.PAD + L.N * L.CELL + 12],
    [20, side + 24, L.PAD - 12, L.W / 2],
    [20, side + 24, L.PAD + L.N * L.CELL + 12, L.W / 2]
  ]) {
    const m = new T.Mesh(new T.BoxGeometry(w, 26, h), frameMat);
    place(st, m, x, y, 0);
    st.world.add(m);
  }

  // 蛇身池
  for (let i = 0; i < 70; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(L.CELL - 10, 22, L.CELL - 10),
      new T.MeshLambertMaterial({ color: 0x69db7c })
    );
    st.world.add(m);
    segPool.push(m);
  }

  // 蛇头（带眼睛）
  headG = new T.Group();
  const head = new T.Mesh(new T.BoxGeometry(L.CELL - 6, 26, L.CELL - 6), new T.MeshLambertMaterial({ color: 0x2f9e44 }));
  headG.add(head);
  for (const ex of [-9, 9]) {
    const e = new T.Mesh(new T.SphereGeometry(4.5, 10, 8), new T.MeshLambertMaterial({ color: 0xffffff }));
    e.position.set(ex, 8, -10);
    headG.add(e);
    const p = new T.Mesh(new T.SphereGeometry(2.2, 8, 6), new T.MeshLambertMaterial({ color: 0x212529 }));
    p.position.set(ex, 8, -13);
    headG.add(p);
  }
  st.world.add(headG);

  // 食物：水果球 + 表情牌
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

export function draw(ctx, S, L) {
  if (!st && !ensureStage(L)) return;

  // 蛇身
  for (let i = 0; i < segPool.length; i++) {
    const m = segPool[i];
    if (i < S.snake.length) {
      const s = S.snake[i];
      m.visible = true;
      place(st, m, L.PAD + s.x * L.CELL + L.CELL / 2, L.PAD + s.y * L.CELL + L.CELL / 2, 8);
      const k = i / Math.max(1, S.snake.length);
      m.material.color.setHex(i === 0 ? 0x2f9e44 : (i % 2 ? 0x51cf66 : 0x69db7c));
      m.scale.setScalar(1 - k * 0.25);
    } else m.visible = false;
  }

  // 蛇头 + 眼睛朝向
  const h = S.snake[0];
  if (h) {
    place(st, headG, L.PAD + h.x * L.CELL + L.CELL / 2, L.PAD + h.y * L.CELL + L.CELL / 2, 14);
    headG.rotation.y = Math.atan2(-S.dir.x, -S.dir.y);
  }

  // 食物
  if (S.food && !S.over) {
    const fx0 = L.PAD + S.food.x * L.CELL + L.CELL / 2;
    const fy0 = L.PAD + S.food.y * L.CELL + L.CELL / 2;
    const bob = Math.sin(S.food.t * 5) * 4;
    if (S.food.star) {
      foodMesh.visible = false;
      foodSprite.visible = false;
      // 金色星星：用八面体表示
      place(st, foodMesh, fx0, fy0 + bob, 16);
      foodMesh.material.color.setHex(0xffd43b);
      foodMesh.visible = true;
      foodMesh.scale.setScalar(1.2);
      foodMesh.rotation.y += 0.06;
    } else {
      place(st, foodMesh, fx0, fy0 + bob, 16);
      foodMesh.visible = true;
      foodMesh.scale.setScalar(1);
      foodMesh.rotation.y += 0.03;
      foodMesh.material.color.setHex(FRUIT_COLORS[S.food.emo] || 0xe03131);
      foodSprite.visible = false;
    }
  } else {
    foodMesh.visible = false;
    foodSprite.visible = false;
  }

  st.render(1 / 60);
}
