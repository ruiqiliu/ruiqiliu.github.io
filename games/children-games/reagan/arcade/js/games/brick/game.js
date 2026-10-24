/* =====================================================================
   games/brick/game.js — 积木救救队 · 逻辑层
   在网格上放/拆积木，帮小人走到小旗子。孩子搭好路之后按「出发」，
   小人自动走一遍验收：到了就金粒雨庆祝，没路就摇头提示，绝不惩罚。

   世界模型（刻意保持极简，不需要物理引擎）：
   - 每格 ground：-1 是水面，≥0 是地面高度（高台 / 高墙）；
   - 每格 stacks：叠上去的积木（只能放在该格当前表面高度，天然有支撑）；
   - 水面上放砖 = 浮桥（小朋友语义里的「船板」，不较真浮力）；
   - 走路规则：上一格最多爬 1（Δ≤1），往下跳多高都行（小人会跳下来）。
   ===================================================================== */
import { clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'brick',
  name: '积木救救队',
  icon: '🧱',
  accent: '#ffd8a8',
  desc: ['搭积木帮小人过河', '按出发，小人自己走']
};

const BEST_LEVEL_KEY = 'hpy-brick-level';
const STARS_KEY = 'hpy-brick-stars';

export const L = { W: 560, H: 440, CELL: 52, BRICK_H: 26, MAX_STACK: 6, STEP_TIME: 0.22 };

/* ---------------- 关卡表 ---------------- */

const LEVELS = [
  {
    name: '搭桥过河', tip: '在水上放一块积木，小人就能走过去', bricks: 6,
    ground: (x) => (x === 4 ? -1 : 0),
    start: [1, 3], goal: [7, 3]
  },
  {
    name: '桥加台阶', tip: '先过小河，再搭一级台阶爬上高台', bricks: 8,
    ground: (x) => (x === 2 ? -1 : (x >= 5 ? 2 : 0)),
    start: [1, 3], goal: [6, 3]
  },
  {
    name: '宽河与高台', tip: '宽河要两块积木，对岸的台子高一格', bricks: 8,
    ground: (x) => (x === 4 || x === 5 ? -1 : (x >= 6 ? 1 : 0)),
    start: [1, 3], goal: [7, 3]
  },
  {
    name: '翻过大墙', tip: '墙太高爬不上，叠两层积木再爬', bricks: 8,
    ground: (x) => (x === 5 ? 3 : 0),
    start: [1, 3], goal: [7, 3]
  },
  {
    name: '自由搭建', tip: '砖块管够！搭一个你自己的世界吧', bricks: 999,
    ground: () => 0,
    start: [2, 3], goal: null
  }
];

/* ---------------- 世界工具 ---------------- */

/** 格子表面高度（小人脚踩的高度）。水面没有砖 = -1 不可走 */
function surface(w, x, z) {
  if (x < 0 || z < 0 || x >= w.W || z >= w.D) return -1;
  const g = w.ground[z][x];
  const n = w.stacks[z][x].length;
  return g < 0 ? (n ? n : -1) : g + n;
}

function inWorld(w, x, z) {
  return x >= 0 && z >= 0 && x < w.W && z < w.D;
}

/** BFS：小人能不能从 走到（向上最多爬 1 格，向下随便跳） */
function findPath(w, sx, sz, tx, tz) {
  if (surface(w, sx, sz) < 0) return null;
  if (surface(w, tx, tz) < 0) return null;
  const prev = new Map();
  const seen = new Set([sx + ',' + sz]);
  const queue = [[sx, sz]];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length) {
    const [x, z] = queue.shift();
    if (x === tx && z === tz) {
      const path = [];
      let cur = x + ',' + z;
      while (cur) {
        const [cx, cz] = cur.split(',').map(Number);
        path.push({ x: cx, z: cz });
        cur = prev.get(cur);
      }
      return path.reverse();
    }
    const sa = surface(w, x, z);
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      const key = nx + ',' + nz;
      if (seen.has(key)) continue;
      const sb = surface(w, nx, nz);
      if (sb < 0 || sb - sa > 1) continue;
      seen.add(key);
      prev.set(key, x + ',' + z);
      queue.push([nx, nz]);
    }
  }
  return null;
}

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    stars: loadNumber(STARS_KEY),
    phase: 'build',        // build | walk | win
    winT: 0,
    world: null,
    bricksLeft: 0,
    cursor: { x: 2, z: 3 },
    fig: { x: 1, z: 3 },   // 小人所在的格
    from: { x: 1, z: 3 },
    prog: 1,
    path: [],              // 待走的路（test 之后逐格走）
    colorSeq: 0,
    T: 0
  };

  /* ---------------- 关卡装配 ---------------- */

  function buildLevel() {
    const def = LEVELS[S.level - 1];
    const w = { W: 9, D: 7, ground: [], stacks: [] };
    for (let z = 0; z < w.D; z++) {
      w.ground.push([]);
      w.stacks.push([]);
      for (let x = 0; x < w.W; x++) {
        w.ground[z].push(def.ground(x, z));
        w.stacks[z].push([]);
      }
    }
    S.world = w;
    S.bricksLeft = def.bricks;
    S.cursor = { x: def.start[0] + 1, z: def.start[1] };
    S.fig = { x: def.start[0], z: def.start[1] };
    S.from = { x: S.fig.x, z: S.fig.z };
    S.prog = 1;
    S.path = [];
    S.phase = 'build';
    S.winT = 0;
  }

  /* ---------------- 搭与拆 ---------------- */

  function placeBrick() {
    if (S.phase !== 'build') return;
    const w = S.world;
    const { x, z } = S.cursor;
    if (!inWorld(w, x, z)) return;
    if (surface(w, x, z) >= L.MAX_STACK) return;
    if (S.bricksLeft <= 0) {
      FX.text(...logicCenter(x, z), '砖不够啦，按 ❤️', '#ff8787', 18);
      Snd.soft();
      return;
    }
    w.stacks[z][x].push(S.colorSeq++);
    S.bricksLeft--;
    Snd.brickPut();
    FX.burst(...logicCenter(x, z), ['#ffd8a8', '#ffffff'], 5, 0.55);
  }

  function removeBrick() {
    if (S.phase !== 'build') return;
    const w = S.world;
    const { x, z } = S.cursor;
    if (!inWorld(w, x, z) || !w.stacks[z][x].length) return;
    w.stacks[z][x].pop();
    S.bricksLeft++;
    Snd.brickTake();
  }

  /** 爱心救场：砖块不够就送一撮（街机的老约定） */
  function love() {
    if (S.phase !== 'build') return;
    S.bricksLeft += 10;
    Snd.star();
    FX.text(...logicCenter(S.cursor.x, S.cursor.z), '❤️ +10', '#ff6b81', 20);
  }

  /** 逻辑格中心 → 2D 逻辑坐标（给 FX 飘字 / 粒子用） */
  function logicCenter(x, z) {
    const ox = (L.W - w_pxs()) / 2, oz = (L.H - w_pzs()) / 2;
    return [ox + x * L.CELL + L.CELL / 2, oz + z * L.CELL + L.CELL / 2];
  }
  const w_pxs = () => S.world.W * L.CELL;
  const w_pzs = () => S.world.D * L.CELL;

  /* ---------------- 出发验收 ---------------- */

  function startWalk() {
    if (S.phase !== 'build') return;
    const def = LEVELS[S.level - 1];
    const target = def.goal ? { x: def.goal[0], z: def.goal[1] } : { ...S.cursor };

    if (S.fig.x === target.x && S.fig.z === target.z) {
      arriveGoal();
      return;
    }
    const path = findPath(S.world, S.fig.x, S.fig.z, target.x, target.z);
    if (!path) {
      FX.text(...logicCenter(S.fig.x, S.fig.z), '过不去，再搭搭看', '#74c0fc', 18);
      Snd.soft();
      return;
    }
    S.path = path;
    S.stepIdx = 0;
    S.phase = 'walk';
    S.prog = 1;
  }

  function arriveGoal() {
    S.phase = 'win';
    S.winT = 2.4;
    S.stars++;
    saveNumber(STARS_KEY, S.stars);
    if (S.level < LEVELS.length) saveNumber(BEST_LEVEL_KEY, Math.max(loadNumber(BEST_LEVEL_KEY, 1), S.level + 1));
    Snd.win();
    const [fx0, fy0] = logicCenter(S.fig.x, S.fig.z);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => FX.burst(fx0 + (i - 1.5) * 34, fy0, ['#ffd43b', '#fff3bf', '#f1f3f5'], 14, 1.1, 'stud'), i * 130);
    }
    FX.text(fx0, fy0 - 26, '太棒了！', '#ffd43b', 26);
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;

    if (S.phase === 'win') {
      S.winT -= dt;
      if (S.winT <= 0) {
        S.level = Math.min(S.level + 1, LEVELS.length);
        buildLevel();
      }
      return;
    }

    if (S.phase === 'walk') {
      if (S.prog >= 1) {
        if (S.stepIdx >= S.path.length - 1) {
          // 走到了终点：关卡里有旗子就庆祝，沙盒里走到光标处就收工
          const def = LEVELS[S.level - 1];
          if (def.goal && S.fig.x === def.goal[0] && S.fig.z === def.goal[1]) arriveGoal();
          else { S.phase = 'build'; S.path = []; }
          return;
        }
        S.stepIdx++;
        S.from = { x: S.fig.x, z: S.fig.z };
        S.fig = { x: S.path[S.stepIdx].x, z: S.path[S.stepIdx].z };
        S.prog = 0;
        Snd.step();
      }
      S.prog = Math.min(1, S.prog + dt / L.STEP_TIME);
    }
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'pointer',

    start() {
      S.level = clamp(loadNumber(BEST_LEVEL_KEY, 1), 1, LEVELS.length);
      buildLevel();
    },
    resize() {},
    restart() { buildLevel(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
        if (S.phase !== 'build') return;
        const dx = name === 'left' ? -1 : name === 'right' ? 1 : 0;
        const dz = name === 'up' ? -1 : name === 'down' ? 1 : 0;
        if (inWorld(S.world, S.cursor.x + dx, S.cursor.z + dz)) {
          S.cursor.x += dx;
          S.cursor.z += dz;
          Snd.pop(3);
        }
        return;
      }
      if (name === 'place') return placeBrick();
      if (name === 'remove') return removeBrick();
      if (name === 'test') return startWalk();
      if (name === 'love') return love();
    },

    /** 视图层把画布点击翻译成格子（controls 里做射线拾取后回调） */
    tapCell(x, z) {
      if (S.phase !== 'build') return;
      if (!inWorld(S.world, x, z)) return;
      if (x === S.cursor.x && z === S.cursor.z) placeBrick();
      else { S.cursor.x = x; S.cursor.z = z; Snd.pop(3); }
    },
  };

  api.controls = createControls();
  return api;
}
