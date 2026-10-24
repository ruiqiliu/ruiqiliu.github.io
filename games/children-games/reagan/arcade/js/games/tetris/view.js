/* =====================================================================
   games/tetris/view.js — 俄罗斯方块 · UI 层（3D 版）
   正交相机正对棋盘（判定零畸变），3D 只负责质感与远景：
   立体砖块、落点虚影、锁定弹跳、消行闪烁、右侧 3D 预览。
   ===================================================================== */
import { createStage, place } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="rotate">↻</button>' +
    '<button class="pad" data-act="right">▶</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad wide" data-act="drop">落下</button>' +
  '</div>';

export const HINT =
  '<kbd>←</kbd><kbd>→</kbd> 左右移动 · <kbd>↑</kbd> 旋转 · <kbd>↓</kbd> 加速下落 · ' +
  '<kbd>空格</kbd> 直接落下 · 淡淡的小方块是落点提示';

export function hud(S) {
  return [['得分', S.score], ['等级', S.level], ['消行', S.lines]];
}

/* ---------------- 3D 舞台 ---------------- */

let st = null, fx = null;
let gridPool = [], curPool = [], ghostPool = [], nextPool = [];
let backWall = null, bgBlocks = [];
let prevFilled = null;        // 上一帧已固定格子的集合，用来检测「刚锁定」
let bounceCells = [], bounceT = 0;

const CX = 240;   // 逻辑坐标里井的中心（井 20..500）

function ensureStage(L) {
  st = createStage({
    W: L.W, H: L.H,
    ortho: { w: L.W, h: L.H },
    cam: [0, 0, 620], look: [0, 0, 0],
    bg: 0x0d1120
  });
  if (!st) return false;
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, L.H / 2 - y, z || 0]);
  const T = st.T;

  // 远景：几块大积木慢慢漂，给画面纵深感（不参与任何判定）
  for (let i = 0; i < 7; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(70 + (i % 3) * 46, 70 + (i % 4) * 30, 40),
      new T.MeshLambertMaterial({ color: [0x1d2742, 0x223052, 0x1a2340][i % 3] })
    );
    m.position.set(-420 + i * 140, -220 + (i % 3) * 190, -520 - (i % 2) * 130);
    m.rotation.set((i % 3) * 0.5, i * 0.8, (i % 2) * 0.4);
    m.userData.spin = 0.1 + (i % 3) * 0.06;
    st.scene.add(m);
    bgBlocks.push(m);
  }

  // 井的背板与边框
  backWall = new T.Mesh(new T.BoxGeometry(L.BW + 16, L.BH + 16, 14), new T.MeshLambertMaterial({ color: 0x151b30 }));
  place(st, backWall, CX, L.BY + L.BH / 2, -30);
  st.scene.add(backWall);
  const frameMat = new T.MeshLambertMaterial({ color: 0x2b3a66 });
  for (const [w, h, x, y] of [
    [14, L.BH + 26, L.BX - 7, L.BY + L.BH / 2],
    [14, L.BH + 26, L.BX + L.BW + 7, L.BY + L.BH / 2],
    [L.BW + 28, 14, CX, L.BY - 7]
  ]) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, 30), frameMat);
    place(st, m, x, y, 6);
    st.scene.add(m);
  }

  // 已固定格子池
  for (let i = 0; i < L.COLS * L.ROWS; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(L.CELL - 3, L.CELL - 3, L.CELL - 3),
      new T.MeshLambertMaterial({ color: 0x888888 })
    );
    st.world.add(m);
    gridPool.push(m);
  }
  // 当前块 4 格
  for (let i = 0; i < 4; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(L.CELL - 3, L.CELL - 3, L.CELL - 3),
      new T.MeshLambertMaterial({ color: 0xffffff })
    );
    st.world.add(m);
    curPool.push(m);
  }
  // 虚影 4 格
  for (let i = 0; i < 4; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(L.CELL - 12, L.CELL - 12, L.CELL - 12),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 })
    );
    st.world.add(m);
    ghostPool.push(m);
  }
  // 预览 4 格
  for (let i = 0; i < 4; i++) {
    const m = new T.Mesh(
      new T.BoxGeometry(L.CELL - 6, L.CELL - 6, L.CELL - 6),
      new T.MeshLambertMaterial({ color: 0xffffff })
    );
    st.world.add(m);
    nextPool.push(m);
  }

  st.onFrame = (dt) => {
    if (fx) fx.update(dt);
    bounceT = Math.max(0, bounceT - dt);
    for (const b of bgBlocks) b.rotation.y += b.userData.spin * dt;
  };
  return true;
}

/* ---------------- 坐标 ---------------- */

function gridXY(L, col, row) {
  // 井左上角在逻辑 (BX, BY)；世界 x 相对 CX 居中
  return [L.BX + col * L.CELL + L.CELL / 2, L.BY + row * L.CELL + L.CELL / 2];
}

/* ---------------- 每帧绘制 ---------------- */

export function draw(ctx, S, L) {
  if (!st && !ensureStage(L)) return;
  const T = st.T;

  // 检测「刚锁定」：本帧新出现的固定格 → 记下来做弹跳动画
  const nowFilled = new Set();
  for (let y = 0; y < L.ROWS; y++)
    for (let x = 0; x < L.COLS; x++)
      if (S.grid[y] && S.grid[y][x]) nowFilled.add(x + ',' + y);
  if (prevFilled) {
    let added = 0;
    for (const k of nowFilled) if (!prevFilled.has(k)) added++;
    if (added > 0 && !S.clearRows.length) { bounceCells = [...nowFilled]; bounceT = 0.26; }
  }
  prevFilled = nowFilled;

  // 已固定的格子
  let k = 0;
  for (let y = 0; y < L.ROWS; y++) {
    for (let x = 0; x < L.COLS; x++) {
      const m = gridPool[k++];
      const c = S.grid[y] && S.grid[y][x];
      if (!c) { m.visible = false; continue; }
      m.visible = true;
      const [gx, gy] = gridXY(L, x, y);
      place(st, m, gx, gy, 0);
      m.material.color.set(c);
      // 消行闪烁
      if (S.clearRows.includes(y)) {
        const p = 1 + Math.sin(S.clearT * 40) * 0.18;
        m.scale.setScalar(p);
        m.material.color.set(0xffffff);
      } else {
        // 锁定弹跳：刚固定的那批格子按时间衰减鼓一下
        let p = 1;
        if (bounceT > 0 && bounceCells.includes(x + ',' + y)) {
          p = 1 + Math.sin((1 - bounceT / 0.26) * Math.PI) * 0.22;
        }
        m.scale.setScalar(p);
      }
    }
  }

  // 当前方块
  const showCur = S.cur && !S.clearRows.length;
  for (const m of curPool) m.visible = false;
  if (showCur) {
    const cells = [];
    for (let y = 0; y < S.cur.m.length; y++)
      for (let x = 0; x < S.cur.m[y].length; x++)
        if (S.cur.m[y][x]) cells.push([S.cur.x + x, S.cur.y + y]);
    cells.forEach(([gx, gy], i) => {
      const m = curPool[i];
      m.visible = true;
      const [px, py] = gridXY(L, gx, gy);
      place(st, m, px, py, 26);
      m.material.color.set(S.cur.c);
    });
    for (let i = cells.length; i < 4; i++) curPool[i].visible = false;
  }

  // 落点虚影
  const showGhost = showCur && S.ghost > S.cur.y;
  if (showGhost) {
    const cells = [];
    for (let y = 0; y < S.cur.m.length; y++)
      for (let x = 0; x < S.cur.m[y].length; x++)
        if (S.cur.m[y][x]) cells.push([S.cur.x + x, S.ghost + y]);
    cells.forEach(([gx, gy], i) => {
      const m = ghostPool[i];
      m.visible = true;
      const [px, py] = gridXY(L, gx, gy);
      place(st, m, px, py, -12);
      m.material.color.set(S.cur.c);
    });
    for (let i = cells.length; i < 4; i++) ghostPool[i].visible = false;
  } else for (const m of ghostPool) m.visible = false;

  // 下一块预览（井右侧）
  const pn = S.next;
  if (pn) {
    const cells = [];
    for (let y = 0; y < pn.m.length; y++)
      for (let x = 0; x < pn.m[y].length; x++)
        if (pn.m[y][x]) cells.push([x, y]);
    const ox = L.BX + L.BW + 90 - (pn.m.length * L.CELL) / 2 + L.CELL / 2;
    const oy = L.BY + 90;
    cells.forEach(([gx, gy], i) => {
      const m = nextPool[i];
      m.visible = true;
      place(st, m, ox + gx * L.CELL, oy + gy * L.CELL, 0);
      m.material.color.set(pn.c);
      m.rotation.y = Math.sin(S.T * 2 + i) * 0.25;
    });
    for (let i = cells.length; i < 4; i++) nextPool[i].visible = false;
  } else for (const m of nextPool) m.visible = false;

  st.render(1 / 60);
}
