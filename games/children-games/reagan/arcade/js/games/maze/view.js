/* =====================================================================
   games/maze/view.js — 迷宫探险 · UI 层（3D 版）
   迷宫以「浮雕地图」呈现：墙体立体凸出、头像小人 + 终点旗都在版面上，
   相机正对版面，整个迷宫一览无余（与贪吃蛇同一套已验证的映射）。
   ===================================================================== */
import { clamp, lerp } from '../../core/util.js';
import { createStage, place } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>' +
  '<button class="pad wide" data-act="hint">💡 提示</button>';

export const HINT =
  '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走路 · ' +
  '<kbd>H</kbd> 看提示路线（每关 3 次）· 走到小旗子就过关';

export function hud(S) {
  return [
    ['关卡', S.level],
    ['星星', S.starCount],
    ['提示', S.hints + ' 次']
  ];
}

export function makeBackground() { return null; }

/* ---------------- 3D 舞台 ---------------- */

let st = null, fx = null;
let levelGroup = null, builtMaze = null;
let starMeshes = [], exitFlag = null, playerSp = null, pathDots = [];

function cellCenter(maze, x, y) {
  return [maze.ox + (x + 0.5) * maze.cell, maze.oy + (y + 0.5) * maze.cell];
}

function ensureStage(L) {
  st = createStage({
    W: L.W, H: L.H,
    fov: 46,
    cam: [0, 0, 640], look: [0, 0, 0],
    bg: 0x101828
  });
  if (!st) return false;
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, L.H / 2 - y, z || 0]);
  const T = st.T;

  // 玩家：头像 billboard
  const img = new Image();
  img.src = avatar.heroURL();
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace;
  playerSp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
  playerSp.scale.set(52, 52, 1);
  st.world.add(playerSp);
  img.onload = () => { tex.needsUpdate = true; };

  // 终点旗（版面内，杆沿版面竖直方向）
  exitFlag = new T.Group();
  const pole = new T.Mesh(new T.BoxGeometry(5, 66, 5), new T.MeshBasicMaterial({ color: 0xe9ecef }));
  pole.position.y = -40;
  exitFlag.add(pole);
  const flag = new T.Mesh(new T.BoxGeometry(34, 20, 4), new T.MeshBasicMaterial({ color: 0xff6b6b }));
  flag.position.set(17, -58, 0);
  exitFlag.add(flag);
  st.world.add(exitFlag);

  st.onFrame = (dt) => { if (fx) fx.update(dt); };
  return true;
}

/** 每一关重建墙体与物件 */
function rebuildLevel(S, L) {
  if (levelGroup) {
    st.world.remove(levelGroup);
    levelGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    levelGroup = null;
  }
  const maze = S.maze;
  if (!maze) return;

  const T = st.T;
  levelGroup = new T.Group();
  builtMaze = maze;

  // 底板（浮雕的背板）
  const floor = new T.Mesh(
    new T.BoxGeometry(maze.cols * maze.cell + 30, maze.rows * maze.cell + 30, 12),
    new T.MeshBasicMaterial({ color: 0x24304d })
  );
  place(st, floor, L.W / 2, L.H / 2, -16);
  levelGroup.add(floor);

  // 墙：只画每格的 n / w 两面 + 最后一行 / 列的外沿
  const wallMat = new T.MeshBasicMaterial({ color: 0xffd98a });
  const WT = 14, DEPTH = 34;
  const addWall = (x1, y1, x2, y2) => {
    const cxm = (x1 + x2) / 2, cym = (y1 + y2) / 2;
    const horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
    const m = new T.Mesh(
      new T.BoxGeometry(horiz ? maze.cell + WT : WT, DEPTH, horiz ? WT : maze.cell + WT),
      wallMat
    );
    place(st, m, cxm, cym, DEPTH / 2);
    levelGroup.add(m);
  };

  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      const c = maze.cells[y * maze.cols + x];
      const x0 = maze.ox + x * maze.cell, y0 = maze.oy + y * maze.cell;
      if (c.n) addWall(x0, y0, x0 + maze.cell, y0);
      if (c.w) addWall(x0, y0, x0, y0 + maze.cell);
      if (y === maze.rows - 1 && c.s) addWall(x0, y0 + maze.cell, x0 + maze.cell, y0 + maze.cell);
      if (x === maze.cols - 1 && c.e) addWall(x0 + maze.cell, y0, x0 + maze.cell, y0 + maze.cell);
    }
  }

  // 星星
  starMeshes = [];
  for (const coin of S.coins) {
    const m = new T.Mesh(new T.OctahedronGeometry(maze.cell * 0.22), new T.MeshBasicMaterial({ color: 0xffd43b }));
    const [cxm, cym] = cellCenter(maze, coin.x, coin.y);
    place(st, m, cxm, cym, 26);
    levelGroup.add(m);
    starMeshes.push({ mesh: m, coin });
  }

  // 提示路线圆点
  pathDots = [];
  const dotGeo = new T.SphereGeometry(maze.cell * 0.09, 8, 6);
  const dotMat = new T.MeshBasicMaterial({ color: 0x74c0fc });
  for (const c of maze.path) {
    const [cxm, cym] = cellCenter(maze, c.x, c.y);
    const d = new T.Mesh(dotGeo, dotMat);
    place(st, d, cxm, cym, 24);
    levelGroup.add(d);
    pathDots.push(d);
  }

  // 终点旗位置
  const [ex, ey] = cellCenter(maze, maze.cols - 1, maze.rows - 1);
  place(st, exitFlag, ex, ey, 20);

  st.world.add(levelGroup);
}

/* ---------------- 每帧绘制 ---------------- */

export function draw(ctx, S, L) {
  if (!st && !ensureStage(L)) return;
  if (builtMaze !== S.maze) rebuildLevel(S, L);

  const maze = S.maze;
  const t = clamp(S.prog, 0, 1);

  // 玩家位置：from → player 之间平滑插值
  const px = lerp(S.from.x, S.player.x, t);
  const py = lerp(S.from.y, S.player.y, t);
  const [wx, wy] = cellCenter(maze, px, py);
  place(st, playerSp, wx, wy, 42);
  playerSp.material.rotation = Math.sin(S.T * 6) * 0.08;

  // 星星旋转 / 收集后隐藏
  for (const s of starMeshes) {
    s.mesh.visible = !s.coin.taken;
    s.mesh.rotation.y += 0.05;
    s.mesh.rotation.x = 0.4;
  }

  // 提示路线闪烁
  const showPath = S.hintT > 0;
  for (const d of pathDots) d.visible = showPath;

  // 终点旗轻微浮动
  exitFlag.position.z = 20 + Math.sin(S.T * 3) * 3;

  st.render(1 / 60);
}
