/* =====================================================================
   games/g1024/game.js — 1024 合并 · 逻辑层
   经典滑块合并玩法：整个棋盘往一个方向滑，相同数字撞在一起就合并
   成两倍，合出 1024 就赢（之后还能继续冲击 2048）。
   儿童版改动：难度 = 棋盘大小（3×3 / 4×4 / 5×5，越大越宽松）；
   棋盘卡死不判负 —— 用掉一颗爱心，把最小的四块变走救场，
   爱心用光才结束，结束时点一下就能重来。
   ===================================================================== */
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeBackground, PADS, HINT } from './view.js';

export const meta = {
  id: '1024',
  name: '1024',
  icon: '🔢',
  accent: '#ffe8cc',
  desc: ['同数相撞变两倍', '合出 1024 就赢啦']
};

/* ---------------- 版面与节奏 ---------------- */
export const L = {
  W: 800,
  H: 560,
  BX: 70,       // 棋盘左上角（和头像拼图同一套版面）
  BY: 60,
  BOARD: 440,
  TARGET: 1024,
  EASE: 18,     // 滑块的缓动速度
  HEARTS: 3,
  WIN_TIME: 2.2
};

const NS = [3, 4, 5];
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    n: 4,
    grid: [],        // grid[row][col] = 滑块引用 | null
    tiles: [],       // 活着的滑块 {id, val, col, row, x, y, pop, born, merged}
    ghosts: [],      // 刚被合并吸收的滑块：滑向合并点再消失
    score: 0,
    best: 0,
    hearts: L.HEARTS,
    won: false,      // 已合出过 1024（庆祝一次就不再触发）
    winT: 0,
    phase: 'play',   // play | win | over
    bg: null,
    T: 0
  };

  let nextId = 1;

  /* ---------------- 小工具 ---------------- */

  const tile = () => L.BOARD / S.n;

  function cellXY(col, row) {
    const t = tile();
    return { x: L.BX + col * t, y: L.BY + row * t };
  }

  function cellCenter(t) {
    const p = cellXY(t.col, t.row);
    return { x: p.x + tile() / 2, y: p.y + tile() / 2 };
  }

  const bestKey = () => 'hpy-1024-best-' + S.n;

  function addTile(col, row, val) {
    const p = cellXY(col, row);
    const t = {
      id: nextId++, val, col, row,
      x: p.x, y: p.y,
      pop: 0, born: 1, merged: false
    };
    S.grid[row][col] = t;
    S.tiles.push(t);
    return t;
  }

  function spawn() {
    const empties = [];
    for (let y = 0; y < S.n; y++) {
      for (let x = 0; x < S.n; x++) {
        if (!S.grid[y][x]) empties.push([x, y]);
      }
    }
    if (!empties.length) return;
    const [x, y] = empties[Math.floor(Math.random() * empties.length)];
    addTile(x, y, Math.random() < 0.9 ? 2 : 4);
  }

  /* ---------------- 开局 / 难度 ---------------- */

  function reset() {
    S.grid = Array.from({ length: S.n }, () => Array(S.n).fill(null));
    S.tiles = [];
    S.ghosts = [];
    S.score = 0;
    S.hearts = L.HEARTS;
    S.won = false;
    S.winT = 0;
    S.phase = 'play';
    spawn();
    spawn();
  }

  function setN(n) {
    if (NS.indexOf(n) < 0) return;
    S.n = n;
    saveNumber('hpy-1024-n', n);
    S.best = loadNumber(bestKey(), 0);
    S.bg = makeBackground(L, n);
    reset();
    Snd.soft();
  }

  /* ---------------- 合并 ---------------- */

  function winRound() {
    S.won = true;
    S.phase = 'win';
    S.winT = L.WIN_TIME;
    Snd.win();
    const c = { x: L.BX + L.BOARD / 2, y: L.BY + L.BOARD / 2 };
    for (let i = 0; i < 5; i++) {
      setTimeout(() => FX.burst(
        c.x + Math.random() * 260 - 130, c.y + Math.random() * 260 - 130,
        ['#ffd43b', '#ff8fb1', '#5b9dff', '#69db7c'], 18, 1.2
      ), i * 120);
    }
  }

  /** 棋盘是不是真的卡死了：没有空格，也没有相邻的同数滑块 */
  function isStuck() {
    for (let y = 0; y < S.n; y++) {
      for (let x = 0; x < S.n; x++) {
        const t = S.grid[y][x];
        if (!t) return false;
        const r = S.grid[y][x + 1];
        const d = y + 1 < S.n ? S.grid[y + 1][x] : null;
        if ((r && r.val === t.val) || (d && d.val === t.val)) return false;
      }
    }
    return true;
  }

  /** 爱心救场：把最小的四块变走，给孩子腾出喘息空间 */
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
    if (S.phase === 'over') { reset(); return; }   // 结束后随便滑一下就重来
    if (S.phase !== 'play') return;

    const n = S.n;
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    const xs = d.x === 1 ? idx.slice().reverse() : idx;
    const ys = d.y === 1 ? idx.slice().reverse() : idx;

    for (const t of S.tiles) t.merged = false;

    let steps = 0;
    let merges = 0;

    // 从滑向的那一侧先处理，同一次滑动里一块最多合并一次
    for (const y of ys) {
      for (const x of xs) {
        const t = S.grid[y][x];
        if (!t) continue;

        // 一路滑到头
        let nx = x, ny = y;
        for (;;) {
          const ax = nx + d.x, ay = ny + d.y;
          if (ax < 0 || ay < 0 || ax >= n || ay >= n || S.grid[ay][ax]) break;
          nx = ax; ny = ay;
        }

        const ax = nx + d.x, ay = ny + d.y;
        const nb = (ax < 0 || ay < 0 || ax >= n || ay >= n) ? null : S.grid[ay][ax];

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
          FX.text(c.x, c.y - 10, '+' + nb.val, '#e8590c', 20);
          if (nb.val >= 128) {
            FX.burst(c.x, c.y, ['#ffd43b', '#ffe8cc', '#ffffff'], 14, 1);
          }
          Snd.pop(merges);
          if (nb.val >= L.TARGET && !S.won) winRound();
        } else if (nx !== x || ny !== y) {
          S.grid[y][x] = null;
          S.grid[ny][nx] = t;
          t.col = nx; t.row = ny;
          steps++;
        }
      }
    }

    if (!steps && !merges) return;   // 这步没动

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

    // 被吸收的滑块滑向合并点，然后消失
    for (let i = S.ghosts.length - 1; i >= 0; i--) {
      const g = S.ghosts[i];
      g.t += dt;
      const k = Math.min(1, dt * L.EASE * 1.5);
      g.x += (g.tx - g.x) * k;
      g.y += (g.ty - g.y) * k;
      if (g.t > 0.22) S.ghosts.splice(i, 1);
    }

    // 活着的滑块滑向自己的格子，弹跳 / 出生动画衰减
    const k = Math.min(1, dt * L.EASE);
    for (const t of S.tiles) {
      const p = cellXY(t.col, t.row);
      t.x += (p.x - t.x) * k;
      t.y += (p.y - t.y) * k;
      t.pop = Math.max(0, t.pop - dt * 3.5);
      t.born = Math.max(0, t.born - dt * 6);
    }

    if (S.phase === 'win') {
      S.winT -= dt;
      if (S.winT <= 0) S.phase = 'play';   // 庆祝完继续，可以冲击 2048
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
      const saved = loadNumber('hpy-1024-n', 4);
      S.n = NS.indexOf(saved) >= 0 ? saved : 4;
      S.best = loadNumber(bestKey(), 0);
      S.bg = makeBackground(L, S.n);
      reset();
    },

    resize() { S.bg = makeBackground(L, S.n); },
    restart() { reset(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      if (name === 'confirm') { if (S.phase === 'over') reset(); return; }
      if (name === 'd3') { setN(3); return; }
      if (name === 'd4') { setN(4); return; }
      if (name === 'd5') { setN(5); return; }
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
