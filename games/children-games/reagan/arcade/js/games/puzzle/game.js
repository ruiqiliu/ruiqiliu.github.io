/* =====================================================================
   games/puzzle/game.js — 头像拼图 · 逻辑层
   把本局主角的照片切成 n×n 块打乱，两两交换拼回原样。
   难度 = 块数：3×3(9) / 4×4(16) / 5×5(25)，键盘 1/2/3 或底部按键切换。
   玩法刻意做成「交换式」而不是滑块式：点两块就换，不用理解空格的
   走法，25 块对小朋友来说也只是耐心的差别。
   ===================================================================== */
import { clamp, rand } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { avatar } from '../../core/avatar.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeBackground, PADS, HINT, THUMB } from './view.js';

export const meta = {
  id: 'puzzle',
  name: '头像拼图',
  icon: '🧩',
  accent: '#ffd9e8',
  desc: ['把自己的照片拼回去', '9 / 16 / 25 块随便挑']
};

/* ---------------- 版面与节奏 ---------------- */
export const L = {
  W: 800,
  H: 560,
  BX: 70,      // 拼图板左上角
  BY: 60,
  BOARD: 440,  // 拼图板边长（正方形，难度只改每块的尺寸）
  EASE: 14,    // 拼图块滑向目标格子的缓动速度
  WIN_TIME: 2.4
};

const NS = [3, 4, 5];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    n: 3,
    imgIdx: 0,      // 当前用第几张照片做原图（进游戏默认本局主角那张）
    cells: [],      // cells[格子下标] = 这块拼图的「家」（正确的格子下标）
    pos: [],        // pos[家] = 现在在哪个格子（cells 的反表）
    anim: [],       // anim[家] = 画在哪里 {x, y, pop}（逻辑坐标，左上角）
    moves: 0,
    correct: 0,
    best: 0,        // 当前难度的最少步数
    record: false,
    phase: 'play',  // play | win
    winT: 0,
    peek: 0,        // 0→1 看原图的透明度（按住才看）
    peekHold: false,
    sel: -1,        // 点选等待交换的格子，-1 = 没选
    press: null,    // 正按着的一块 {home, cell, px, py, grabX, grabY, moved}
    bg: null,
    T: 0
  };

  /* ---------------- 小工具 ---------------- */

  const tile = () => L.BOARD / S.n;

  function cellXY(k) {
    const t = tile();
    return { x: L.BX + (k % S.n) * t, y: L.BY + Math.floor(k / S.n) * t };
  }

  function cellAt(p) {
    if (!p) return -1;
    const t = tile();
    const cx = Math.floor((p.x - L.BX) / t);
    const cy = Math.floor((p.y - L.BY) / t);
    if (cx < 0 || cy < 0 || cx >= S.n || cy >= S.n) return -1;
    return cy * S.n + cx;
  }

  const solvedCount = (cells) => cells.reduce((s, h, k) => s + (h === k ? 1 : 0), 0);

  const bestKey = () => 'puzzle-best-' + S.n * S.n;

  /* ---------------- 开一局 ---------------- */

  /** Fisher–Yates 洗牌，洗到「开局就已经拼对的块 ≤ 总数 1/4」为止 */
  function shuffle() {
    const total = S.n * S.n;
    let cells;
    do {
      cells = Array.from({ length: total }, (_, k) => k);
      for (let i = total - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
    } while (solvedCount(cells) > Math.floor(total / 4));
    return cells;
  }

  function newRound() {
    S.cells = shuffle();
    S.pos = [];
    // anim 按「家」下标存：anim[home] = 这块现在画在哪个格子的左上角。
    // 不能用 cells.map —— map 产出的数组是按格子下标排的，跟 home 对不上。
    S.anim = [];
    S.cells.forEach((home, cell) => {
      S.pos[home] = cell;
      const p = cellXY(cell);
      S.anim[home] = { x: p.x, y: p.y, pop: 0 };
    });
    S.moves = 0;
    S.correct = solvedCount(S.cells);
    S.best = loadNumber(bestKey(), 0);
    S.record = false;
    S.sel = -1;
    S.press = null;
    S.phase = 'play';
    S.winT = 0;
  }

  function setN(n) {
    if (NS.indexOf(n) < 0) return;
    S.n = n;
    saveNumber('puzzle-n', n);
    newRound();
    Snd.soft();
  }

  /** 换一张照片做原图：轮到下一张头像，重洗一局 */
  function switchPhoto() {
    S.imgIdx = (S.imgIdx + 1) % avatar.count;
    newRound();
    Snd.pop(2);
  }

  /* ---------------- 交换 ---------------- */

  function doSwap(a, b) {
    if (a < 0 || b < 0 || a === b) return;
    const ha = S.cells[a], hb = S.cells[b];
    S.cells[a] = hb; S.cells[b] = ha;
    S.pos[ha] = b; S.pos[hb] = a;
    S.moves++;
    S.anim[ha].pop = 1;
    S.anim[hb].pop = 1;
    Snd.turn();

    // 刚好回家的块给个小庆祝
    let fixed = 0;
    for (const k of [a, b]) {
      if (S.cells[k] === k) {
        fixed++;
        const p = cellXY(k);
        const c = tile() / 2;
        FX.burst(p.x + c, p.y + c, ['#69db7c', '#b2f2bb', '#fff3bf'], 10, 0.8);
        FX.text(p.x + c, p.y + tile() * 0.3, '✓', '#2f9e44', 24);
      }
    }
    if (fixed) Snd.star();
    S.correct = solvedCount(S.cells);

    if (S.correct === S.cells.length) {
      S.phase = 'win';
      S.winT = L.WIN_TIME;
      S.record = !S.best || S.moves < S.best;
      if (S.record) {
        S.best = S.moves;
        saveNumber(bestKey(), S.moves);
      }
      Snd.win();
      for (let i = 0; i < 5; i++) {
        setTimeout(() => FX.burst(
          L.BX + rand(0, L.BOARD), L.BY + rand(0, L.BOARD),
          ['#ffd43b', '#ff8fb1', '#5b9dff', '#69db7c'], 18, 1.2
        ), i * 120);
      }
    }
  }

  /* ---------------- 指针：点选 / 拖拽 ---------------- */

  function press(p) {
    if (S.phase !== 'play') return;

    // 点右侧「原图」缩略图 = 换一张照片
    if (p &&
        p.x >= THUMB.x - 10 && p.x <= THUMB.x + THUMB.w + 10 &&
        p.y >= THUMB.y - 10 && p.y <= THUMB.y + THUMB.h + 10) {
      switchPhoto();
      return;
    }

    const cell = cellAt(p);
    if (cell < 0) return;
    const xy = cellXY(cell);
    S.press = {
      home: S.cells[cell],
      cell,
      px: p.x, py: p.y,
      grabX: p.x - xy.x, grabY: p.y - xy.y,
      moved: false
    };
    Snd.pop(0);
  }

  function move(p) {
    if (!S.press) return;
    const pr = S.press;
    if (!pr.moved && Math.hypot(p.x - pr.px, p.y - pr.py) > 10) {
      pr.moved = true;
      S.sel = -1;   // 拖动优先于点选
    }
    if (!pr.moved) return;

    pr.px = p.x; pr.py = p.y;
    const t = tile();
    // 块跟着手指走，但不出拼图板
    S.anim[pr.home].x = clamp(p.x - pr.grabX, L.BX, L.BX + L.BOARD - t);
    S.anim[pr.home].y = clamp(p.y - pr.grabY, L.BY, L.BY + L.BOARD - t);
  }

  function release(p) {
    if (!S.press) return;
    const pr = S.press;
    S.press = null;
    const cell = cellAt(p);

    if (pr.moved) {
      // 拖到别的格子上就交换；拖到板外 / 原地松手则滑回原格，不算一步
      if (cell >= 0 && cell !== pr.cell) doSwap(pr.cell, cell);
      return;
    }

    // 点选：再点自己 = 取消；点别块 = 交换
    if (S.sel === pr.cell) { S.sel = -1; Snd.soft(); return; }
    if (S.sel >= 0) {
      const a = S.sel;
      S.sel = -1;
      doSwap(a, pr.cell);
      return;
    }
    S.sel = pr.cell;
    Snd.pop(1);
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;

    // 看原图的透明度：按住 👀 / P 淡入；赢了直接展示整张
    const target = (S.phase === 'win' || S.peekHold) ? 1 : 0;
    S.peek += (target - S.peek) * Math.min(1, dt * 9);
    if (S.peek < 0.005) S.peek = 0;

    if (S.phase === 'win') {
      S.winT -= dt;
      if (S.winT <= 0) newRound();
      return;
    }

    // 每块滑向自己的格子（正拖着的这块除外，它跟手指）
    const k = Math.min(1, dt * L.EASE);
    const drag = S.press && S.press.moved ? S.press.home : -1;
    for (let home = 0; home < S.anim.length; home++) {
      if (home === drag) continue;
      const a = S.anim[home];
      const p = cellXY(S.pos[home]);
      a.x += (p.x - a.x) * k;
      a.y += (p.y - a.y) * k;
      if (Math.abs(p.x - a.x) < 0.3) a.x = p.x;
      if (Math.abs(p.y - a.y) < 0.3) a.y = p.y;
      a.pop = Math.max(0, a.pop - dt * 3.5);
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
      const saved = loadNumber('puzzle-n', 3);
      S.n = NS.indexOf(saved) >= 0 ? saved : 3;
      S.imgIdx = avatar.heroIndex();   // 进来先用本局主角那张，和首页卡片一致
      newRound();
      S.bg = makeBackground(L);
    },

    resize() { S.bg = makeBackground(L); },
    restart() { newRound(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (name === 'peek') { S.peekHold = !!down; return; }
      if (name === 'photo') { if (down) switchPhoto(); return; }
      if (!down) return;
      if (name === 'd3') setN(3);
      else if (name === 'd4') setN(4);
      else if (name === 'd5') setN(5);
    },

    /* 控制层的指针入口 */
    press, move, release,

    /* 只读视图：selftest 用它来「看见」棋盘并贪心解局 */
    grid() { return S.cells.slice(); },
    layout() { return { x: L.BX, y: L.BY, size: L.BOARD, n: S.n }; }
  };

  api.controls = createControls();
  return api;
}
