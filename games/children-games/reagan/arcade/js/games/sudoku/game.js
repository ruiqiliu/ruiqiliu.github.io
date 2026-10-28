/* =====================================================================
   games/sudoku/game.js — 图画数独 · 逻辑层（20 号游戏）
   4×4 / 6×6 图画数独：每行、每列、每个宫里的小动物都不重复。
   点格子选中，再点下面的动物放进去；有冲突的格子会变红。
   ===================================================================== */
import { shuffle, ri, clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'sudoku',
  name: '图画数独',
  icon: '🔢',
  accent: '#d8f5a2',
  desc: ['每行每列不重复', '小动物数独']
};

const BEST_KEY = 'hpy-sudoku-level';
export const L = { W: 800, H: 560 };

const LEVELS = [
  { size: 4, holes: 4 }, { size: 4, holes: 6 }, { size: 4, holes: 8 },
  { size: 6, holes: 8 }, { size: 6, holes: 12 }, { size: 6, holes: 16 }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    size: 4,
    board: [],       // board[r][c] = 0 空 或 1..size
    fixed: [],       // 题目给定的格子
    solution: [],
    sel: null,       // {r, c}
    conflict: [],    // 冲突格 "r,c"
    done: false,
    doneT: 0,
    stars: loadNumber('hpy-sudoku-stars', 0),
    T: 0
  };

  /** 回溯生成一个完整解 */
  function solve(board, size, boxR, boxC) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c]) continue;
        for (let v = 1; v <= size; v++) {
          if (fits(board, size, boxR, boxC, r, c, v)) {
            board[r][c] = v;
            if (solve(board, size, boxR, boxC)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }

  function fits(board, size, boxR, boxC, r, c, v) {
    for (let i = 0; i < size; i++) {
      if (board[r][i] === v || board[i][c] === v) return false;
    }
    const r0 = Math.floor(r / boxR) * boxR, c0 = Math.floor(c / boxC) * boxC;
    for (let rr2 = r0; rr2 < r0 + boxR; rr2++) {
      for (let cc = c0; cc < c0 + boxC; cc++) {
        if (board[rr2][cc] === v) return false;
      }
    }
    return true;
  }

  function buildLevel() {
    const def = LEVELS[S.level - 1];
    const size = def.size;
    const boxR = size === 4 ? 2 : 2;
    const boxC = size === 4 ? 2 : 3;
    // 随机预填对角宫后回溯求解；个别预填组合会无解，失败就重来
    let board = null;
    for (let tries = 0; tries < 80 && !board; tries++) {
      board = Array.from({ length: size }, () => new Array(size).fill(0));
      for (let b = 0; b < size / boxR; b++) {
        const vals = shuffle(Array.from({ length: size }, (_, i) => i + 1));
        let k = 0;
        for (let r = b * boxR; r < b * boxR + boxR; r++) {
          for (let c = b * boxC; c < b * boxC + boxC; c++) board[r][c] = vals[k++];
        }
      }
      if (!solve(board, size, boxR, boxC)) board = null;
    }
    if (!board) {
      // 兜底：循环移位拉丁方（行内错位 boxC，保证宫内也不重复）
      board = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => ((r % boxR) * boxC + Math.floor(r / boxR) + c) % size + 1)
      );
    }
    S.solution = board.map((row) => row.slice());

    // 按难度挖空（保证仍有解即可——小朋友看冲突自查）
    S.board = board.map((row) => row.slice());
    S.fixed = board.map((row) => row.map(() => true));
    let holes = 0, guard = 0;
    while (holes < def.holes && guard++ < 200) {
      const r = ri(0, size - 1), c = ri(0, size - 1);
      if (S.board[r][c] !== 0) {
        S.board[r][c] = 0;
        S.fixed[r][c] = false;
        holes++;
      }
    }
    S.size = size;
    S.sel = null;
    S.conflict = [];
    S.done = false;
    layout();
  }

  function layout() {
    const cs = Math.min(112, (L.H - 250) / S.size);
    const ox = (L.W - S.size * cs) / 2;
    const oy = 150;
    S.cellRects = [];
    for (let r = 0; r < S.size; r++) {
      for (let c = 0; c < S.size; c++) {
        S.cellRects.push({ r, c, x: ox + c * cs, y: oy + r * cs, w: cs, h: cs });
      }
    }
    const icons = S.size === 4 ? 4 : 6;
    S.palRects = [];
    for (let i = 0; i < icons; i++) {
      S.palRects.push({ v: i + 1, x: L.W / 2 + (i - (icons - 1) / 2) * 84 - 34, y: oy + S.size * cs - 4, w: 68, h: 68 });
    }
  }

  function conflicts() {
    const size = S.size;
    const boxR = size === 4 ? 2 : 2;
    const boxC = size === 4 ? 2 : 3;
    const set = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = S.board[r][c];
        if (!v) continue;
        for (let i = 0; i < size; i++) {
          if (i !== c && S.board[r][i] === v) { set.push(r + ',' + c); break; }
          if (i !== r && S.board[i][c] === v) { set.push(r + ',' + c); break; }
        }
        const r0 = Math.floor(r / boxR) * boxR, c0 = Math.floor(c / boxC) * boxC;
        for (let rr2 = r0; rr2 < r0 + boxR && !set.includes(r + ',' + c); rr2++) {
          for (let cc = c0; cc < c0 + boxC; cc++) {
            if ((rr2 !== r || cc !== c) && S.board[rr2][cc] === v) { set.push(r + ',' + c); break; }
          }
        }
      }
    }
    return set;
  }

  function boardDone() {
    return S.board.every((row) => row.every((v) => v > 0)) && conflicts().length === 0;
  }

  function place(v) {
    if (!S.sel || S.done) return;
    const { r, c } = S.sel;
    if (S.fixed[r][c]) return;
    S.board[r][c] = v;
    Snd.pop(2);
    S.conflict = conflicts();
    if (boardDone()) {
      S.done = true;
      S.doneT = 2.0;
      S.stars = (S.stars || 0) + 1;
      saveNumber('hpy-sudoku-stars', S.stars);
      Snd.win();
    }
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: S.stars,

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      buildLevel();
    },
    resize() {},
    restart() { buildLevel(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      if (S.done) {
        S.doneT -= dt;
        if (S.doneT <= 0) {
          S.level = clamp(S.level + 1, 1, LEVELS.length);
          saveNumber(BEST_KEY, S.level);
          buildLevel();
        }
      }
    },
    debug() { return { level: S.level, size: S.size, holes: S.board.flat().filter((v) => !v).length, done: S.done }; },
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      if (name === 'hint') {
        // 💡 找一个空格/错格，放上正确答案
        for (let r = 0; r < S.size; r++) {
          for (let c = 0; c < S.size; c++) {
            if (!S.fixed[r][c] && S.board[r][c] !== S.solution[r][c]) {
              S.sel = { r, c };
              place(S.solution[r][c]);
              return;
            }
          }
        }
        return;
      }
      const v = parseInt(name.slice(1), 10);
      if (!isNaN(v)) place(v);
    },

    tap(x, y) {
      const cell = S.cellRects.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
      if (cell) { S.sel = { r: cell.r, c: cell.c }; Snd.pop(1); return; }
      const pal = S.palRects.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
      if (pal) place(pal.v);
    }
  };

  api.controls = createControls();
  return api;
}
