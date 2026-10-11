/* =====================================================================
   games/breaker/view.js — 打砖块 · UI 层（3D 版）
   立体竞技场：彩色 3D 砖块、发光球拖尾、低机位透视。
   ===================================================================== */
import { clamp, shade } from '../../core/util.js';
import { createStage, place, shake as stageShake } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';

export const PADS = '';

export const HINT =
  '<kbd>←</kbd> <kbd>→</kbd> 或 <kbd>A</kbd> <kbd>D</kbd> 移动彩虹板 · ' +
  '也可以直接用鼠标／手指拖动 · 球不会掉，放心打';

export function hud(S) {
  return [['得分', S.score], ['关卡', S.level], ['星星', '⭐' + S.stars]];
}

export function makeBackground() { return null; }

/* ---------------- 3D 舞台与元素 ---------------- */

let st = null, fx = null;
let brickPool = [], paddleMesh = null, ballMesh = null, trailPool = [];
let lastBrickCount = -1;

function ensureStage(L) {
  st = createStage({
    W: L.W, H: L.H,
    fov: 50,
    cam: [0, -170, 700], look: [0, -40, 0],
    bg: 0x1b2440
  });
  if (!st) return false;
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, L.H / 2 - y, z || 0]);
  const T = st.T;

  // 竞技场：左右墙 / 顶墙 / 弹力地板
  const wallMat = new T.MeshLambertMaterial({ color: 0x3b4a78 });
  const mk = (w, h, x, y) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, 170), wallMat);
    m.position.set(x - L.W / 2, L.H / 2 - y, 0);
    st.scene.add(m);
    return m;
  };
  mk(L.WALL + 20, L.H + 120, L.WALL / 2, L.H / 2);
  mk(L.WALL + 20, L.H + 120, L.W - L.WALL / 2, L.H / 2);
  mk(L.W, L.TOP + 20, L.W / 2, L.TOP / 2);
  const floor = mk(L.W, 18, L.W / 2, L.FLOOR + 9);
  floor.material = new T.MeshLambertMaterial({ color: 0xffd6e8 });

  // 砖块池
  for (let i = 0; i < L.ROWS * L.COLS; i++) {
    const m = new T.Mesh(new T.BoxGeometry(L.BW, L.BH, 34), new T.MeshLambertMaterial({ color: 0xffffff }));
    st.world.add(m);
    brickPool.push(m);
  }

  // 挡板 + 球 + 拖尾
  paddleMesh = new T.Mesh(new T.BoxGeometry(L.PADW, L.PADH, 36), new T.MeshLambertMaterial({ color: 0xf1f3f5 }));
  st.world.add(paddleMesh);
  ballMesh = new T.Mesh(new T.SphereGeometry(L.BR, 24, 18), new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x554466 }));
  st.world.add(ballMesh);
  for (let i = 0; i < 8; i++) {
    const t = new T.Mesh(
      new T.SphereGeometry(L.BR * (1 - i * 0.09), 10, 8),
      new T.MeshBasicMaterial({ color: 0xffd6e8, transparent: true, opacity: 0.55 - i * 0.06 })
    );
    st.world.add(t);
    trailPool.push(t);
  }

  st.onFrame = (dt) => { if (fx) fx.update(dt); };
  return true;
}

/* ---------------- 每帧绘制 ---------------- */

export function draw(ctx, S, L) {
  if (!st && !ensureStage(L)) return;

  // 砖块：按存活顺序复用池里的网格
  const alive = S.bricks.filter((b) => b.alive);
  for (let i = 0; i < brickPool.length; i++) {
    const m = brickPool[i];
    if (i < alive.length) {
      const b = alive[i];
      m.visible = true;
      place(st, m, b.x + b.w / 2, b.y + b.h / 2, 0);
      m.material.color.set(b.c);
    } else m.visible = false;
  }
  lastBrickCount = alive.length;

  // 挡板 / 球 / 拖尾
  place(st, paddleMesh, S.paddle.x, L.PADY + L.PADH / 2, 80);
  place(st, ballMesh, S.ball.x, S.ball.y, 80);
  ballMesh.rotation.y += 0.08;
  for (let i = 0; i < trailPool.length; i++) {
    const t = trailPool[i], p = S.ball.trail[i];
    if (p && S.served) { t.visible = true; place(st, t, p.x, p.y, 80 - (i + 1) * 3); }
    else t.visible = false;
  }

  st.render(1 / 60);
}
