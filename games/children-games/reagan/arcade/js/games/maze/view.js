/* =====================================================================
   games/maze/view.js — 迷宫探险 · UI 层（3D 版）
   迷宫是一块平躺的立体模型：墙真的立起来，斜俯正交相机整体俯瞰。
   可以拖着转（松手吸附到 90°），方向键 / 滑动始终跟着「眼前的方向」走：
   屏幕上的上 = 走屏幕上方那格，转了视角也不乱。
   ===================================================================== */
import { clamp, lerp } from '../../core/util.js';
import { createStage } from '../../core/render3d.js';
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
    '<button class="pad wide" data-act="turn">↻ 转一转</button>' +
    '<button class="pad wide" data-act="hint">💡 提示</button>' +
  '</div>';

export const HINT =
  '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走路 · ' +
  '在画面上左右拖动（或点「转一转」）可以旋转迷宫 · ' +
  '<kbd>H</kbd> 看提示路线（每关 3 次）· 走到小旗子就过关';

export function hud(S) {
  return [
    ['关卡', S.level],
    ['星星', S.starCount],
    ['提示', S.hints + ' 次']
  ];
}

export function makeBackground() { return null; }

/* ---------------- 视角旋转 ---------------- */

const QUARTER = Math.PI / 2;
let yaw = 0;            // 当前视角（弧度，绕竖轴）
let yawTarget = 0;      // 松手后吸附的目标角
let orbiting = false;
let orbitAnchor = 0;    // 开始拖动时的视角，拖动位移以它为基准

/** 拖动中：直接跟随手指 */
export function beginOrbit() {
  orbiting = true;
  orbitAnchor = yaw;
  yawTarget = yaw;
}
export function orbitTo(dx) {
  if (!orbiting) return;
  yaw = yawTarget = orbitAnchor - dx * 0.012;   // 往右拖 → 板子顺时针转（抓着近边拖的手感）
}
/** 松手：吸附到最近的 90° */
export function endOrbit() {
  orbiting = false;
  yawTarget = Math.round(yaw / QUARTER) * QUARTER;
}
/** 「转一转」按钮：转 90° */
export function rotate90() {
  orbiting = false;
  yawTarget += QUARTER;
}

/** 屏幕方向 → 棋盘方向。视角转过 q 个 90° 后，屏幕的「上」对应的棋盘方向会换。
    q=1（板子逆时针转了 90°）时，屏幕上方显示的是棋盘的右方，依此类推。 */
const DIR_MAP = [
  { up: 'up', down: 'down', left: 'left', right: 'right' },
  { up: 'right', down: 'left', left: 'up', right: 'down' },
  { up: 'down', down: 'up', left: 'right', right: 'left' },
  { up: 'left', down: 'right', left: 'down', right: 'up' }
];

export function boardAction(name) {
  const q = ((Math.round(yaw / QUARTER) % 4) + 4) % 4;
  return DIR_MAP[q][name] || name;
}

/* ---------------- 3D 舞台 ---------------- */

let st = null, fx = null;
let levelGroup = null, builtMaze = null;
let starMeshes = [], exitFlag = null, playerSp = null, playerShadow = null, pathDots = [];

function ensureStage(L) {
  st = createStage({
    W: L.W, H: L.H,
    ortho: { w: L.W, h: L.H, margin: 1.45 },   // 转到 45° 时对角线最长，留足余量
    cam: [0, 880, 620], look: [0, 0, 0],
    bg: 0x101828
  });
  if (!st) return false;
  // 粒子组挂到 levelGroup 里（跟着板子一起转）；逻辑 y → 板面 z
  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, z || 24, y - L.H / 2]);
  const T = st.T;

  // 玩家：头像 billboard + 脚下一片假接触阴影
  const img = new Image();
  img.src = avatar.heroURL();
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace;
  playerSp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
  playerSp.scale.set(52, 52, 1);
  img.onload = () => { tex.needsUpdate = true; };

  playerShadow = new T.Mesh(
    new T.CircleGeometry(20, 20),
    new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  playerShadow.rotation.x = -Math.PI / 2;

  // 终点旗（杆沿竖直方向立在板面上）
  exitFlag = new T.Group();
  const pole = new T.Mesh(new T.BoxGeometry(5, 66, 5), new T.MeshBasicMaterial({ color: 0xe9ecef }));
  pole.position.y = 33;
  exitFlag.add(pole);
  const flag = new T.Mesh(new T.BoxGeometry(34, 20, 4), new T.MeshBasicMaterial({ color: 0xff6b6b }));
  flag.position.set(17, 56, 0);
  exitFlag.add(flag);

  st.onFrame = (dt) => {
    if (fx) fx.update(dt);
    // 松手 / 点按钮后的吸附回弹
    if (!orbiting && yaw !== yawTarget) {
      yaw += (yawTarget - yaw) * Math.min(1, dt * 9);
      if (Math.abs(yawTarget - yaw) < 0.004) yaw = yawTarget;
    }
    if (levelGroup) levelGroup.rotation.y = yaw;
  };
  return true;
}

/** 逻辑像素点 → levelGroup 本地坐标（板中心 = 原点，逻辑 y → z） */
function ptPos(px, py, L) {
  return [px - L.W / 2, py - L.H / 2];
}

/** 棋盘格中心 → 本地坐标 */
function boardPos(maze, x, y, L) {
  return ptPos(maze.ox + (x + 0.5) * maze.cell, maze.oy + (y + 0.5) * maze.cell, L);
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
  if (fx) levelGroup.add(fx.group);   // 粒子跟着本关的板子转

  // 底板（顶面就是 y=0 的地面）
  const floor = new T.Mesh(
    new T.BoxGeometry(maze.cols * maze.cell + 30, 12, maze.rows * maze.cell + 30),
    new T.MeshLambertMaterial({ color: 0x2e3f63 })
  );
  floor.position.y = -6;
  levelGroup.add(floor);

  // 墙：只画每格的 n / w 两面 + 最后一行 / 列的外沿，真正立在板面上
  const wallMat = new T.MeshLambertMaterial({ color: 0xffd98a });
  const WT = 11, WH = 42;
  const addWall = (x1, y1, x2, y2) => {
    const [ax, az] = ptPos(x1, y1, L);
    const [bx, bz] = ptPos(x2, y2, L);
    const horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
    const m = new T.Mesh(
      new T.BoxGeometry(horiz ? bx - ax + WT : WT, WH, horiz ? WT : bz - az + WT),
      wallMat
    );
    m.position.set((ax + bx) / 2, WH / 2, (az + bz) / 2);
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
    const [wx, wz] = boardPos(maze, coin.x, coin.y, L);
    m.position.set(wx, 22, wz);
    levelGroup.add(m);
    starMeshes.push({ mesh: m, coin });
  }

  // 提示路线圆点（贴地）
  pathDots = [];
  const dotGeo = new T.SphereGeometry(maze.cell * 0.09, 8, 6);
  const dotMat = new T.MeshBasicMaterial({ color: 0x74c0fc });
  for (const c of maze.path) {
    const [wx, wz] = boardPos(maze, c.x, c.y, L);
    const d = new T.Mesh(dotGeo, dotMat);
    d.position.set(wx, 4, wz);
    levelGroup.add(d);
    pathDots.push(d);
  }

  // 终点旗位置
  const [ex, ez] = boardPos(maze, maze.cols - 1, maze.rows - 1, L);
  exitFlag.position.set(ex, 0, ez);
  levelGroup.add(exitFlag);

  // 玩家 + 阴影放进板子坐标系
  levelGroup.add(playerSp);
  levelGroup.add(playerShadow);

  levelGroup.rotation.y = yaw;
  st.world.add(levelGroup);
}

/* ---------------- 每帧绘制 ---------------- */

export function draw(ctx, S, L) {
  if (!st && !ensureStage(L)) return;
  if (builtMaze !== S.maze) rebuildLevel(S, L);

  const maze = S.maze;
  const t = clamp(S.prog, 0, 1);

  // 玩家位置：from → player 之间平滑插值（板面本地坐标）
  const px = lerp(S.from.x, S.player.x, t);
  const py = lerp(S.from.y, S.player.y, t);
  const [wx, wz] = boardPos(maze, px, py, L);
  playerSp.position.set(wx, 34, wz);
  playerSp.material.rotation = Math.sin(S.T * 6) * 0.08;
  playerShadow.position.set(wx, 1.5, wz);

  // 星星旋转 / 收集后隐藏
  for (const s of starMeshes) {
    s.mesh.visible = !s.coin.taken;
    s.mesh.rotation.y += 0.05;
    s.mesh.position.y = 22 + Math.sin(S.T * 3 + s.coin.x) * 3;
  }

  // 提示路线闪烁
  const showPath = S.hintT > 0;
  for (const d of pathDots) d.visible = showPath;

  // 终点旗轻微浮动
  exitFlag.children[0].position.y = 33 + Math.sin(S.T * 3) * 3;

  st.render(1 / 60);
}
