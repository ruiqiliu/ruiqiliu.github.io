/* =====================================================================
   games/m23/game.js — 2和3 · 逻辑层
   玩法类似 2048：整体往一个方向滑动，相同数字撞在一起翻倍。
   区别：场上同时出现 2 和 3，两条数字链各自翻倍
   （2→4→8… 和 3→6→12…），4 和 6 永远合不了 —— 棋盘更容易堵死。
   数字没有上限，纯拼得分。
   五种模式 = 五种棋盘：大方阵 5×5 → 天窗（四角挖空）→
   经典 4×4 → 十字 → 小方阵 3×3，越往后越挤。
   儿童版约定不变：卡住用爱心救场（变走最小的四块），
   爱心用光才结束，点一下 / 再滑一下就重来。
   ===================================================================== */
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeBackground, PADS, HINT, MODES } from './view.js';

export const meta = {
  id: '23',
  name: '2和3',
  icon: '🟪',
  accent: '#e5dbff',
  desc: ['2 和 3 各自翻倍', '五种棋盘没有上限']
};

/* ---------------- 版面与节奏 ---------------- */
export const L = {
  W: 800,
  H: 560,
  BX: 70,
  BY: 60,
  BOARD: 440,
  EASE: 18,
  HEARTS: 3
};

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    mode: 0,
    size: 5,
    mask: [],        // mask[row][col] = 这个格子存不存在
    grid: [],
    tiles: [],
    ghosts: [],
    score: 0,
    best: 0,
    hearts: L.HEARTS,
    phase: 'play',   // play | over
    bg: null,
    T: 0
  };

  let nextId = 1;

  /* ---------------- 小工具 ---------------- */

  const tile = () => L.BOARD / S.size;

  function cellXY(col, row) {
    const t = tile();
    return { x: L.BX + col * t, y: L.BY + row * t };
  }

  function cellCenter(t) {
    const p = cellXY(t.col, t.row);
    return { x: p.x + tile() / 2, y: p.y + tile() / 2 };
  }

  const valid = (x, y) => x >= 0 && y >= 0 && x < S.size && y < S.size && !!S.mask[y][x];

  const bestKey = () => 'hpy-23-best-' + S.mode;

  function addTile(col, row, val) {
    const p = cellXY(col, row);
    const t = { id: nextId++, val, col, row, x: p.x, y: p.y, pop: 0, born: 1, merged: false };
    S.grid[row][col] = t;
    S.tiles.push(t);
  }

  function spawn() {
    const empties = [];
    for (let y = 0; y < S.size; y++) {
      for (let x = 0; x < S.size; x++) {
        if (S.mask[y][x] && !S.grid[y][x]) empties.push([x, y]);
      }
    }
    if (!empties.length) return;
    const [x, y] = empties[Math.floor(Math.random() * empties.length)];
    addTile(x, y, Math.random() < 0.5 ? 2 : 3);
  }

  /* ---------------- 开局 / 模式 ---------------- */

  function reset() {
    S.grid = Array.from({ length: S.size }, () => Array(S.size).fill(null));
    S.tiles = [];
    S.ghosts = [];
    S.score = 0;
    S.hearts = L.HEARTS;
    S.phase = 'play';
    spawn();
    spawn();
  }

  function setMode(m) {
    if (m < 0 || m >= MODES.length) return;
    S.mode = m;
    const { size, holes, cross } = MODES[m];
    S.size = size;
    const mid = Math.floor(size / 2);
    S.mask = Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => {
        if (cross && x !== mid && y !== mid) return false;
        if (holes && holes.some(([hx, hy]) => hx === x && hy === y)) return false;
        return true;
      })
    );
    saveNumber('hpy-23-mode', m);
    S.best = loadNumber(bestKey(), 0);
    S.bg = makeBackground(L, S.mask, size);
    reset();
    Snd.soft();
  }

  /* ---------------- 合并 / 救场 / 结束 ---------------- */

  function isStuck() {
    for (let y = 0; y < S.size; y++) {
      for (let x = 0; x < S.size; x++) {
        if (!S.mask[y][x]) continue;
        const t = S.grid[y][x];
        if (!t) return false;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => (valid(x + dx, y + dy) ? S.grid[y + dy][x + dx] : null))
          .find((n) => n);
        if (nb && nb.val === t.val) return false;
      }
    }
    return true;
  }

  function rescue() {
    S.hearts--;
    const doomed = S.tiles.slice().sort((a, b) => a.val - b.val).slice(0, 4);
    for (const t of doomed) {
      S.grid[t.row][t.col] = null;
      S.tiles.splice(S.tiles.indexOf(t), 1);
      const c = cellCenter(t);
      FX.burst(c.x, c.y, ['#ffdeeb', '#fcc2d7', '#ffffff'], 12, 0.9);
    }
    FX.text(L.BX + L.BOARD / 2, L.BY + L.BOARD / 2 - 40, '爱心救援！', '#e64980', 26);
    Snd.star();
  }

  function gameOver() {
    S.phase = 'over';
    if (S.score > S.best) {
      S.best = S.score;
      saveNumber(bestKey(), S.best);
    }
    Snd.soft();
  }

  /* ---------------- 滑动 ---------------- */

  function move(dir) {
    const d = DIRS[dir];
    if (!d) return;
    if (S.phase === 'over') { reset(); return; }
    if (S.phase !== 'play') return;

    const idx = [];
    for (let i = 0; i < S.size; i++) idx.push(i);
    const xs = d.x === 1 ? idx.slice().reverse() : idx;
    const ys = d.y === 1 ? idx.slice().reverse() : idx;

    for (const t of S.tiles) t.merged = false;

    let steps = 0;
    let merges = 0;

    for (const y of ys) {
      for (const x of xs) {
        if (!S.mask[y][x]) continue;
        const t = S.grid[y][x];
        if (!t) continue;

        // 沿方向一路滑到头（不能滑出棋盘形状）
        let nx = x, ny = y;
        for (;;) {
          const ax = nx + d.x, ay = ny + d.y;
          if (!valid(ax, ay) || S.grid[ay][ax]) break;
          nx = ax; ny = ay;
        }

        const ax = nx + d.x, ay = ny + d.y;
        const nb = valid(ax, ay) ? S.grid[ay][ax] : null;

        if (nb && nb.val === t.val && !nb.merged) {
          S.grid[y][x] = null;
          S.tiles.splice(S.tiles.indexOf(t), 1);
          S.ghosts.push({
            val: t.val, x: t.x, y: t.y,
            tx: cellXY(nb.col, nb.row).x, ty: cellXY(nb.col, nb.row).y, t: 0
          });
          nb.val *= 2;
          nb.merged = true;
          nb.pop = 1;
          S.score += nb.val;
          merges++;

          const c = cellCenter(nb);
          FX.text(c.x, c.y - 10, '+' + nb.val, '#7048e8', 20);
          if (nb.val >= 96) {
            FX.burst(c.x, c.y, ['#d0bfff', '#e5dbff', '#ffffff'], 14, 1);
          }
          Snd.pop(merges);
        } else if (nx !== x || ny !== y) {
          S.grid[y][x] = null;
          S.grid[ny][nx] = t;
          t.col = nx; t.row = ny;
          steps++;
        }
      }
    }

    if (!steps && !merges) return;

    if (!merges) Snd.turn();
    if (S.score > S.best) {
      S.best = S.score;
      saveNumber(bestKey(), S.best);
    }

    spawn();
    if (isStuck()) {
      if (S.hearts > 0) rescue();
      else gameOver();
    }
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;

    for (let i = S.ghosts.length - 1; i >= 0; i--) {
      const g = S.ghosts[i];
      g.t += dt;
      const k = Math.min(1, dt * L.EASE * 1.5);
      g.x += (g.tx - g.x) * k;
      g.y += (g.ty - g.y) * k;
      if (g.t > 0.22) S.ghosts.splice(i, 1);
    }

    const k = Math.min(1, dt * L.EASE);
    for (const t of S.tiles) {
      const p = cellXY(t.col, t.row);
      t.x += (p.x - t.x) * k;
      t.y += (p.y - t.y) * k;
      t.pop = Math.max(0, t.pop - dt * 3.5);
      t.born = Math.max(0, t.born - dt * 6);
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
      const saved = loadNumber('hpy-23-mode', 0);
      setMode(saved >= 0 && saved < MODES.length ? saved : 0);
      reset();
    },

    resize() { S.bg = makeBackground(L, S.mask, S.size); },
    restart() { reset(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      if (name === 'confirm') { if (S.phase === 'over') reset(); return; }
      if (name[0] === 'm') { setMode(parseInt(name.slice(1), 10) - 1); return; }
      move(name);
    },

    /* 只读视图：selftest 用来确认棋盘在动 */
    snapshot() {
      return {
        phase: S.phase,
        score: S.score,
        hearts: S.hearts,
        tiles: S.tiles.length,
        max: S.tiles.reduce((m, t) => Math.max(m, t.val), 0)
      };
    }
  };

  api.controls = createControls();
  return api;
}
