/* =====================================================================
   games/maze/game.js — 迷宫探险 · 逻辑层
   递归回溯生成迷宫，再随机打通少量额外的墙形成环路 —— 小朋友不容易
   走进死胡同就出不来。提示路线用 BFS 求最短路。
   ===================================================================== */
import { pick, rand } from '../../core/util.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeBackground, PADS, HINT } from './view.js';

export const meta = {
  id: 'maze',
  name: '迷宫探险',
  icon: '🗺️',
  accent: '#c0e8ff',
  desc: ['找到出口的小门', '路上还有星星哦']
};

/* ---------------- 版面与节奏 ---------------- */
export const L = {
  W: 800,
  H: 560,
  PAD: 26,
  WALL: 6,
  STEP_TIME: 0.13,     // 走一格需要多久
  HINTS_PER_LEVEL: 3,
  HINT_SHOW_TIME: 2.2
};

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

/* ================================================================
   迷宫小工具（都是纯函数，传入 maze = {cells, cols, rows}）
   ================================================================ */

function cellAt(maze, x, y) {
  if (x < 0 || y < 0 || x >= maze.cols || y >= maze.rows) return null;
  return maze.cells[y * maze.cols + x];
}

/** 一个格子在某个方向上能不能走（该方向没有墙） */
function canGo(c, dir) {
  if (dir.x === 1) return !c.e;
  if (dir.x === -1) return !c.w;
  if (dir.y === 1) return !c.s;
  return !c.n;
}

/** 相邻且相通的格子 */
function passages(maze, c) {
  const out = [];
  for (const key of ['up', 'down', 'left', 'right']) {
    const dir = DIRS[key];
    if (!canGo(c, dir)) continue;
    const nb = cellAt(maze, c.x + dir.x, c.y + dir.y);
    if (nb) out.push(nb);
  }
  return out;
}

/** 递归回溯法生成迷宫：从起点一路挖，挖不动了就退回上一个岔路口 */
function generateMaze(cols, rows) {
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({ x, y, n: true, e: true, s: true, w: true, seen: false, walked: false });
    }
  }

  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? null : cells[y * cols + x]);
  const start = at(0, 0);
  start.seen = true;
  const stack = [start];

  while (stack.length) {
    const c = stack[stack.length - 1];
    const options = [];

    const n = at(c.x, c.y - 1);
    if (n && !n.seen) options.push([n, 'n', 's']);
    const e = at(c.x + 1, c.y);
    if (e && !e.seen) options.push([e, 'e', 'w']);
    const s = at(c.x, c.y + 1);
    if (s && !s.seen) options.push([s, 's', 'n']);
    const w = at(c.x - 1, c.y);
    if (w && !w.seen) options.push([w, 'w', 'e']);

    if (!options.length) { stack.pop(); continue; }

    const [next, forward, backward] = pick(options);
    c[forward] = false;
    next[backward] = false;
    next.seen = true;
    stack.push(next);
  }

  // 打通少量额外的墙 → 产生环路，死胡同变少
  const extra = Math.floor(cols * rows * 0.05);
  for (let i = 0; i < extra; i++) {
    const c = pick(cells);
    if (c.x < cols - 1 && c.e) {
      c.e = false;
      at(c.x + 1, c.y).w = false;
    } else if (c.y < rows - 1 && c.s) {
      c.s = false;
      at(c.x, c.y + 1).n = false;
    }
  }

  return cells;
}

/** BFS 求起点到终点的最短路线（用来放星星和给提示） */
function solve(maze) {
  const start = maze.cells[0];
  const goal = maze.cells[maze.cells.length - 1];
  const prev = new Map();
  const seen = new Set([0]);
  const queue = [start];

  while (queue.length) {
    const c = queue.shift();
    if (c === goal) break;
    for (const nb of passages(maze, c)) {
      const idx = nb.y * maze.cols + nb.x;
      if (seen.has(idx)) continue;
      seen.add(idx);
      prev.set(idx, c);
      queue.push(nb);
    }
  }

  const path = [];
  let cur = goal;
  path.push(cur);
  while (cur !== start) {
    cur = prev.get(cur.y * maze.cols + cur.x);
    if (!cur) break;
    path.push(cur);
  }
  return path.reverse();
}

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    starCount: 0,
    hints: L.HINTS_PER_LEVEL,
    phase: 'play',        // play | win
    winT: 0,
    maze: null,
    coins: [],
    player: { x: 0, y: 0 },
    from: { x: 0, y: 0 },
    prog: 1,              // 0→1 表示正在从 from 走向 player
    dir: { x: 0, y: 1 },
    hold: null,           // 当前按住的方向
    hintT: 0,
    bg: null,
    T: 0
  };

  /* ---------------- 关卡尺寸：越往后迷宫越大 ---------------- */

  function levelSize(level) {
    return {
      cols: 9 + Math.min(6, level - 1) * 2,
      rows: 7 + Math.min(4, level - 1) * 2
    };
  }

  function buildLevel() {
    const { cols, rows } = levelSize(S.level);
    const cell = Math.min((L.W - 2 * L.PAD) / cols, (L.H - 2 * L.PAD) / rows);

    const maze = {
      cols,
      rows,
      cell,
      ox: (L.W - cols * cell) / 2,
      oy: (L.H - rows * cell) / 2,
      cells: generateMaze(cols, rows),
      path: []
    };
    maze.path = solve(maze);

    S.maze = maze;
    S.coins = placeCoins(maze);
    S.player = { x: 0, y: 0 };
    S.from = { x: 0, y: 0 };
    S.prog = 1;
    S.dir = { x: 0, y: 1 };
    S.hold = null;
    S.hintT = 0;
    S.winT = 0;
    S.phase = 'play';
    S.bg = makeBackground(maze, L);
  }

  /** 沿着正确路线均匀撒 3 颗星星 */
  function placeCoins(maze) {
    const path = maze.path;
    const coins = [];
    const n = 3;
    for (let i = 1; i <= n; i++) {
      const c = path[Math.floor(((path.length - 1) * i) / (n + 1))];
      if (!c) continue;
      coins.push({ x: c.x, y: c.y, taken: false });
    }
    return coins;
  }

  /* ---------------- 走路 ---------------- */

  function tryStep(dir) {
    const c = cellAt(S.maze, S.player.x, S.player.y);
    if (!c || !canGo(c, dir)) return false;

    S.from = { x: S.player.x, y: S.player.y };
    S.player = { x: S.player.x + dir.x, y: S.player.y + dir.y };
    S.dir = dir;
    S.prog = 0;
    Snd.step();
    return true;
  }

  /** 走到一格之后结算：捡星星 / 到终点 */
  function arrive() {
    const maze = S.maze;
    const c = cellAt(maze, S.player.x, S.player.y);
    if (c) c.walked = true;

    const coin = S.coins.find((k) => !k.taken && k.x === S.player.x && k.y === S.player.y);
    if (coin) {
      coin.taken = true;
      S.starCount++;
      const x = maze.ox + (S.player.x + 0.5) * maze.cell;
      const y = maze.oy + (S.player.y + 0.5) * maze.cell;
      FX.burst(x, y, ['#ffd43b', '#fff3bf', '#ffffff'], 16, 1);
      FX.text(x, y - 20, '+1', '#f08c00', 20);
      Snd.eat();
    }

    if (S.player.x === maze.cols - 1 && S.player.y === maze.rows - 1) {
      S.phase = 'win';
      S.winT = 2.0;
      Snd.win();
      const x = maze.ox + (S.player.x + 0.5) * maze.cell;
      const y = maze.oy + (S.player.y + 0.5) * maze.cell;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => FX.burst(x + rand(-50, 50), y + rand(-50, 50), ['#ffd43b', '#ff8fb1', '#5b9dff', '#69db7c'], 16, 1.1), i * 110);
      }
    }
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;
    if (S.hintT > 0) S.hintT = Math.max(0, S.hintT - dt);

    if (S.phase === 'win') {
      S.winT -= dt;
      if (S.winT <= 0) {
        S.level++;
        S.hints = L.HINTS_PER_LEVEL;
        buildLevel();
      }
      return;
    }

    if (S.prog < 1) {
      S.prog = Math.min(1, S.prog + dt / L.STEP_TIME);
      if (S.prog >= 1) arrive();
    }

    // 按住方向键就会一直走
    if (S.phase === 'play' && S.prog >= 1 && S.hold) tryStep(S.hold);
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'default',

    start() {
      S.level = 1;
      S.starCount = 0;
      S.hints = L.HINTS_PER_LEVEL;
      buildLevel();
    },

    resize() {
      if (S.maze) S.bg = makeBackground(S.maze, L);
    },

    restart() { buildLevel(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (name === 'hint') {
        if (down && S.phase === 'play' && S.hints > 0 && S.hintT <= 0) {
          S.hints--;
          S.hintT = L.HINT_SHOW_TIME;
          Snd.hint();
        }
        return;
      }

      const dir = DIRS[name];
      if (!dir) return;

      if (down) {
        S.hold = dir;
        if (S.phase === 'play' && S.prog >= 1) tryStep(dir);
      } else if (S.hold === dir) {
        S.hold = null;
      }
    }
  };

  api.controls = createControls();
  return api;
}
