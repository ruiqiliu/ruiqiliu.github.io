/* =====================================================================
   games/brick/game.js — 积木救救队 · 逻辑层（8 岁版）
   在网格上放/拆积木，帮小人收齐星星、走到小旗子。按「出发」小人
   BFS 寻路自动验收：星星没收齐不算过关（停在旗上提示，可以继续搭），
   没路也只是摇头提示，绝不惩罚。

   面向 8 岁的挑战点（比上一版深一层）：
   - 星星收集：每关若干颗，全收齐才算过关 → 出发前要先规划路线；
   - 长板砖（1×2）：可以横放/竖放，能一头悬空（悬挑），跨越深水沟——
     深水（-2）连砖都放不了，普通砖一次只能填一格，跨不过去；
   - 地形：浅水（-1，可放砖当浮桥）、深水（-2，只能长板跨）、
     高台（爬台阶 ≤1）、悬崖边悬挑跳板；
   - 砖块预算收紧，倒逼用长板和悬挑。

   世界模型（无物理引擎）：
   - ground[z][x]：-2 深水 / -1 浅水 / ≥0 地面高度；
   - stacks[z][x]：叠上去的积木对象（{c:颜色, l:1|2, ox,oz,x2,z2}），
     长板同一对象存两格，拆时成对 pop；
   - 表面 surface：深水不可走；浅水没砖=-1、有砖=砖顶；地面=高度+砖数；
   - 走路：向上最多爬 1（Δ≤1），向下随便跳；
   - 长板放置：两端落面高度相等 + 至少一端有真支撑（地面或砖）。
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
  desc: ['搭积木收星星', '长板跨深水，送小人回家']
};

const BEST_LEVEL_KEY = 'hpy-brick-level';
const STARS_KEY = 'hpy-brick-stars';

export const L = { W: 560, H: 440, CELL: 52, BRICK_H: 30, MAX_STACK: 6, STEP_TIME: 0.2 };

/* ---------------- 关卡表 ----------------
   ground(x,z) 返回：-2 深水 / -1 浅水 / ≥0 地面高度
   stars: [[x,z],...] 全收齐才过关；goal null = 沙盒 */

const LEVELS = [
  {
    name: '搭桥过河', tip: '在水上放积木搭桥，顺路捡星星', bricks: 4,
    ground: (x) => (x === 4 ? -1 : 0),
    start: [1, 3], goal: [7, 3],
    stars: [[4, 3], [6, 3]]
  },
  {
    name: '规划路线', tip: '星星要全收齐！有的在死胡同里，想好再出发', bricks: 5,
    ground: (x) => (x === 4 ? -1 : 0),
    start: [1, 3], goal: [7, 3],
    stars: [[1, 1], [6, 1], [6, 5]]
  },
  {
    name: '长板跨深水', tip: '深水放不了砖！按 F 换长板，一下跨两格', bricks: 5,
    ground: (x) => (x === 4 || x === 5 ? -2 : 0),
    start: [1, 3], goal: [7, 3],
    stars: [[4, 3], [5, 3], [7, 5]]
  },
  {
    name: '悬挑跳板', tip: '长板一头搭住就行！上高台要叠台阶', bricks: 6,
    ground: (x) => (x === 4 ? -2 : (x >= 6 ? 2 : 0)),
    start: [1, 3], goal: [7, 5],
    stars: [[4, 3], [5, 3], [7, 3]]
  },
  {
    name: '小岛中转', tip: '河中央有个小岛，分两段搭桥，岛上也有星星', bricks: 6,
    ground: (x) => (x === 4 || x === 6 ? -1 : (x === 5 ? 0 : (x >= 7 ? 1 : 0))),
    start: [1, 3], goal: [7, 3],
    stars: [[4, 3], [5, 3], [6, 3]]
  },
  {
    name: '大工程', tip: '深水加高台，全部星星一颗都不能少', bricks: 8,
    ground: (x) => (x === 4 || x === 5 ? -2 : (x >= 7 ? 2 : 0)),
    start: [1, 3], goal: [7, 3],
    stars: [[2, 5], [4, 2], [6, 4], [7, 1]]
  },
  {
    name: '自由搭建', tip: '砖块管够！长板也能用，搭一个你自己的世界', bricks: 999,
    ground: () => 0,
    start: [2, 3], goal: null,
    stars: []
  }
];

/* ---------------- 世界工具 ---------------- */

function inWorld(w, x, z) {
  return x >= 0 && z >= 0 && x < w.W && z < w.D;
}

/** 格子表面高度（小人脚踩的高度）。
    深水=-2 不可走；浅水没砖=-1；地面=地面高度+砖数 */
function surface(w, x, z) {
  if (!inWorld(w, x, z)) return -2;
  const g = w.ground[z][x];
  const n = w.stacks[z][x].length;
  if (g === -2) return -2;
  return (g < 0 ? 0 : g) + n;
}

/** 长板落面的基底高度（深水 = null 不可落） */
function baseOf(w, x, z) {
  if (!inWorld(w, x, z)) return null;
  const g = w.ground[z][x];
  if (g === -2) return null;
  return (g < 0 ? 0 : g) + w.stacks[z][x].length;
}

/** 格子是不是「真支撑」（地面或已有砖）——长板至少一端要搭住 */
function isSolid(w, x, z) {
  const g = w.ground[z][x];
  return g >= 0 || w.stacks[z][x].length > 0;
}

/** BFS：从 走到（向上最多爬 1 格，向下随便跳） */
function findPath(w, sx, sz, tx, tz) {
  if (surface(w, sx, sz) < 0 || surface(w, tx, tz) < 0) return null;
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
    path: [],
    stepIdx: 0,
    brickLen: 1,           // 当前砖型：1 单砖 / 2 长板
    brickDir: 0,           // 长板方向：0 横(沿x) / 1 竖(沿z)
    colorSeq: 0,
    ghostOk: true,         // 光标处能不能放（幽灵砖变红用）
    T: 0
  };

  /* ---------------- 关卡装配 ---------------- */

  function buildLevel() {
    const def = LEVELS[S.level - 1];
    const w = { W: 9, D: 7, ground: [], stacks: [], stars: [], goal: def.goal ? { x: def.goal[0], z: def.goal[1] } : null };
    for (let z = 0; z < w.D; z++) {
      w.ground.push([]);
      w.stacks.push([]);
      for (let x = 0; x < w.W; x++) {
        w.ground[z].push(def.ground(x, z));
        w.stacks[z].push([]);
      }
    }
    for (const [sx, sz] of def.stars || []) w.stars.push({ x: sx, z: sz, taken: false });

    S.world = w;
    S.bricksLeft = def.bricks;
    S.cursor = { x: def.start[0] + 1, z: def.start[1] };
    S.fig = { x: def.start[0], z: def.start[1] };
    S.from = { x: S.fig.x, z: S.fig.z };
    S.prog = 1;
    S.path = [];
    S.phase = 'build';
    S.winT = 0;
    updateGhost();
  }

  /** 逻辑格中心 → 2D 逻辑坐标（给 FX 飘字 / 粒子用） */
  function logicCenter(x, z) {
    const ox = (L.W - S.world.W * L.CELL) / 2;
    const oz = (L.H - S.world.D * L.CELL) / 2;
    return [ox + x * L.CELL + L.CELL / 2, oz + z * L.CELL + L.CELL / 2];
  }

  /* ---------------- 放置规则 ---------------- */

  /** 当前光标 + 砖型能不能放。单砖：非深水且没超限；
      长板：两格基底相等 + 至少一端真支撑 + 没超限 */
  function canPlaceAt(x, z, len, dir) {
    const w = S.world;
    if (!inWorld(w, x, z)) return false;
    if (surface(w, x, z) === -2) return false;

    if (len === 1) return surface(w, x, z) < L.MAX_STACK;

    const dx = dir === 0 ? 1 : 0, dz = dir === 0 ? 0 : 1;
    const x2 = x + dx, z2 = z + dz;
    const b1 = baseOf(w, x, z), b2 = baseOf(w, x2, z2);
    if (b1 === null || b2 === null || b1 !== b2) return false;
    if (b1 >= L.MAX_STACK) return false;
    return isSolid(w, x, z) || isSolid(w, x2, z2);
  }

  function updateGhost() {
    S.ghostOk = canPlaceAt(S.cursor.x, S.cursor.z, S.brickLen, S.brickDir);
  }

  /* ---------------- 搭与拆 ---------------- */

  function placeBrick() {
    if (S.phase !== 'build') return;
    const w = S.world;
    const { x, z } = S.cursor;
    if (!canPlaceAt(x, z, S.brickLen, S.brickDir)) {
      FX.text(...logicCenter(x, z), S.brickLen === 2 ? '两头要一样高，一头要搭住' : '这里放不了', '#ff8787', 16);
      Snd.soft();
      return;
    }
    if (S.bricksLeft <= 0) {
      FX.text(...logicCenter(x, z), '砖不够啦，按 ❤️', '#ff8787', 18);
      Snd.soft();
      return;
    }
    S.bricksLeft--;
    const brick = { c: S.colorSeq++, l: S.brickLen };
    if (S.brickLen === 2) {
      const dx = S.brickDir === 0 ? 1 : 0, dz = S.brickDir === 0 ? 0 : 1;
      brick.ox = x; brick.oz = z;
      brick.x2 = x + dx; brick.z2 = z + dz;
      w.stacks[z][x].push(brick);
      w.stacks[brick.z2][brick.x2].push(brick);   // 同一对象存两格，拆时成对 pop
    } else {
      w.stacks[z][x].push(brick);
    }
    Snd.brickPut();
    FX.burst(...logicCenter(x, z), ['#ffd8a8', '#ffffff'], 5, 0.55);
    updateGhost();
  }

  function removeBrick() {
    if (S.phase !== 'build') return;
    const w = S.world;
    const { x, z } = S.cursor;
    if (!inWorld(w, x, z) || !w.stacks[z][x].length) return;
    const top = w.stacks[z][x][w.stacks[z][x].length - 1];
    if (top.l === 2) {
      const peer = w.stacks[top.z2][top.x2];
      if (peer[peer.length - 1] === top) peer.pop();   // 长板成对拆
    }
    w.stacks[z][x].pop();
    S.bricksLeft++;
    Snd.brickTake();
    updateGhost();
  }

  /** 爱心救场：砖块不够就送一撮（街机的老约定） */
  function love() {
    if (S.phase !== 'build') return;
    S.bricksLeft += 10;
    Snd.star();
    FX.text(...logicCenter(S.cursor.x, S.cursor.z), '❤️ +10', '#ff6b81', 20);
  }

  /** 切换砖型（单砖 ↔ 长板）与长板方向 */
  function flipBrick() {
    if (S.phase !== 'build') return;
    if (S.brickLen === 1) S.brickLen = 2;
    else if (S.brickDir === 0) S.brickDir = 1;
    else { S.brickLen = 1; S.brickDir = 0; }
    Snd.pop(5);
    updateGhost();
  }

  /* ---------------- 出发验收 ---------------- */

  function starsLeft() {
    return S.world.stars.filter((s) => !s.taken).length;
  }

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
    const left = starsLeft();
    if (left > 0) {
      // 到了旗子但星星没收齐：不算过关，停在原地继续搭
      FX.text(...logicCenter(S.fig.x, S.fig.z), `还有 ${left} 颗星星！`, '#f08c00', 20);
      Snd.soft();
      S.phase = 'build';
      S.path = [];
      return;
    }
    S.phase = 'win';
    S.winT = 2.4;
    S.stars += 2;   // 全星过关记 2 分
    saveNumber(STARS_KEY, S.stars);
    if (S.level < LEVELS.length) saveNumber(BEST_LEVEL_KEY, Math.max(loadNumber(BEST_LEVEL_KEY, 1), S.level + 1));
    Snd.win();
    const [fx0, fy0] = logicCenter(S.fig.x, S.fig.z);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => FX.burst(fx0 + (i - 1.5) * 34, fy0, ['#ffd43b', '#fff3bf', '#f1f3f5'], 14, 1.1, 'stud'), i * 130);
    }
    FX.text(fx0, fy0 - 26, '太棒了！', '#ffd43b', 26);
  }

  /** 走到一格：捡星星 */
  function arriveCell() {
    const w = S.world;
    for (const s of w.stars) {
      if (!s.taken && s.x === S.fig.x && s.z === S.fig.z) {
        s.taken = true;
        const [fx0, fy0] = logicCenter(S.fig.x, S.fig.z);
        FX.burst(fx0, fy0, ['#ffd43b', '#fff3bf'], 12, 0.9, 'stud');
        FX.text(fx0, fy0 - 22, '★', '#f08c00', 24);
        Snd.eat();
      }
    }
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
        arriveCell();
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
          updateGhost();
        }
        return;
      }
      if (name === 'place') return placeBrick();
      if (name === 'remove') return removeBrick();
      if (name === 'test') return startWalk();
      if (name === 'love') return love();
      if (name === 'flip') return flipBrick();
    },

    /** 视图层把画布点击翻译成格子（controls 里做射线拾取后回调） */
    tapCell(x, z) {
      if (S.phase !== 'build') return;
      if (!inWorld(S.world, x, z)) return;
      if (x === S.cursor.x && z === S.cursor.z) placeBrick();
      else { S.cursor.x = x; S.cursor.z = z; Snd.pop(3); updateGhost(); }
    },

    /** 长板砖占的第二格（幽灵预览用） */
    ghostPeer() {
      if (S.brickLen !== 2) return null;
      const dx = S.brickDir === 0 ? 1 : 0, dz = S.brickDir === 0 ? 0 : 1;
      return { x: S.cursor.x + dx, z: S.cursor.z + dz };
    }
  };

  api.controls = createControls();
  return api;
}
