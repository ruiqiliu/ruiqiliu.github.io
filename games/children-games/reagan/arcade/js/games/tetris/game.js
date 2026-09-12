/* =====================================================================
   games/tetris/game.js — 俄罗斯方块 · 逻辑层
   7-bag 随机、落地锁定延迟 0.62s（给小玩家更长的反应时间）、左右自动连发。
   ===================================================================== */
import { ri } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'tetris',
  name: '俄罗斯方块',
  icon: '🧩',
  accent: '#c3d8ff',
  desc: ['方块落下来拼整齐', '拼满一行就消掉']
};

const BEST_KEY = 'hpy-tetris-best';

/* ---------------- 版面尺寸表 ---------------- */
export const L = { COLS: 10, ROWS: 18, CELL: 32, BX: 20, BY: 20 };
L.BW = L.COLS * L.CELL;
L.BH = L.ROWS * L.CELL;
L.W = 480;
L.H = L.BY * 2 + L.BH;

const SHAPES = {
  I: { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: '#22c3e6' },
  J: { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], c: '#5b9dff' },
  L: { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: '#ffa94d' },
  O: { m: [[1, 1], [1, 1]], c: '#ffd43b' },
  S: { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: '#51cf66' },
  T: { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: '#9b7bff' },
  Z: { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], c: '#ff6b6b' }
};
const KEYS = Object.keys(SHAPES);

const LOCK_DELAY = 0.62;
const DAS_DELAY = 0.18;   // 首次横向连发前的等待
const DAS_REPEAT = 0.055; // 连发间隔

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    grid: [],
    cur: null,
    next: null,
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    acc: 0,
    lockT: 0,
    lockResets: 0,
    landed: false,
    clearRows: [],
    clearT: 0,
    ghost: 0,
    best: loadNumber(BEST_KEY),
    held: { left: false, right: false, down: false },
    das: { t: 0, dir: 0 },
    T: 0
  };

  /* ---------------- 出块 ---------------- */

  /** 7-bag：每一轮把 7 种形状洗牌后依次发出，不会长时间不出某一种 */
  function refillBag() {
    S.bag = KEYS.slice();
    for (let i = S.bag.length - 1; i > 0; i--) {
      const j = ri(0, i);
      const t = S.bag[i];
      S.bag[i] = S.bag[j];
      S.bag[j] = t;
    }
  }

  function nextPiece() {
    if (!S.bag.length) refillBag();
    const key = S.bag.pop();
    const shape = SHAPES[key];
    const m = shape.m.map((row) => row.slice());
    return { k: key, m, c: shape.c, x: Math.floor((L.COLS - m[0].length) / 2), y: 0 };
  }

  function rotateCW(m) {
    const n = m.length;
    const out = [];
    for (let y = 0; y < n; y++) {
      out.push([]);
      for (let x = 0; x < n; x++) out[y].push(m[n - 1 - x][y]);
    }
    return out;
  }

  /** 方块 p 偏移 (ox,oy) 后是否与墙/地面/已固定方块冲突 */
  function collide(p, ox, oy, mm) {
    const m = mm || p.m;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = p.x + x + (ox || 0);
        const gy = p.y + y + (oy || 0);
        if (gx < 0 || gx >= L.COLS || gy >= L.ROWS) return true;
        if (gy >= 0 && S.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function spawn() {
    S.cur = S.next || nextPiece();
    S.next = nextPiece();
    S.cur.x = Math.floor((L.COLS - S.cur.m[0].length) / 2);
    S.cur.y = 0;
    S.landed = false;
    S.lockT = 0;
    S.lockResets = 0;
    S.ghost = ghostY();

    // 新方块一出来就撞上了 → 结束
    if (collide(S.cur, 0, 0)) {
      S.over = true;
      if (S.score > S.best) {
        S.best = S.score;
        saveNumber(BEST_KEY, S.best);
      }
      Snd.soft();
    }
  }

  function reset() {
    S.grid = [];
    for (let y = 0; y < L.ROWS; y++) S.grid.push(new Array(L.COLS).fill(null));
    S.score = 0;
    S.lines = 0;
    S.level = 1;
    S.over = false;
    S.acc = 0;
    S.clearRows = [];
    S.bag = [];
    S.next = null;
    spawn();
  }

  const dropInterval = () => Math.max(0.34, 0.9 - (S.level - 1) * 0.075);

  /* ---------------- 落子与消行 ---------------- */

  function lockPiece() {
    for (let y = 0; y < S.cur.m.length; y++) {
      for (let x = 0; x < S.cur.m[y].length; x++) {
        if (!S.cur.m[y][x]) continue;
        const gy = S.cur.y + y;
        const gx = S.cur.x + x;
        if (gy < 0) continue;
        S.grid[gy][gx] = S.cur.c;
      }
    }

    const full = [];
    for (let y = 0; y < L.ROWS; y++) if (S.grid[y].every((v) => v)) full.push(y);

    if (full.length) {
      S.clearRows = full;
      S.clearT = 0.36;

      const pts = [0, 100, 300, 600, 1000][Math.min(full.length, 4)] * S.level;
      S.score += pts;
      S.lines += full.length;

      const newLevel = Math.floor(S.lines / 10) + 1;
      if (newLevel > S.level) {
        S.level = newLevel;
        Snd.star();
      }

      const cx = L.BX + L.BW / 2;
      const cy = L.BY + full[0] * L.CELL + L.CELL / 2;
      FX.text(cx, cy, '+' + pts, '#ffd43b', 26);
      FX.burst(cx, cy, ['#ffd43b', '#ffffff', '#9b7bff'], 22, 1.2);
      Snd.line(full.length);

      S.cur = null;
    } else {
      Snd.drop();
      spawn();
    }
  }

  /** 闪烁结束后真正删除行。必须从下往上删，否则索引会错位 */
  function finishClear() {
    const rows = S.clearRows.slice().sort((a, b) => b - a);
    for (const y of rows) S.grid.splice(y, 1);
    while (S.grid.length < L.ROWS) S.grid.unshift(new Array(L.COLS).fill(null));
    S.clearRows = [];
    S.cur = null;
    spawn();
  }

  function tryMove(dx, dy) {
    if (!S.cur || S.over) return false;
    if (collide(S.cur, dx, dy)) return false;

    S.cur.x += dx;
    S.cur.y += dy;
    // 横向微调时把落地计时器清零，给玩家一点「反悔」的时间
    if (dy === 0 && S.landed && S.lockResets < 8) {
      S.lockT = 0;
      S.lockResets++;
    }
    return true;
  }

  /** 旋转 + 踢墙：依次尝试左右偏移，最远 ±2 格 */
  function tryRotate() {
    if (!S.cur || S.over) return;
    const m = rotateCW(S.cur.m);
    for (const ox of [0, -1, 1, -2, 2]) {
      if (collide(S.cur, ox, 0, m)) continue;
      S.cur.m = m;
      S.cur.x += ox;
      if (S.landed && S.lockResets < 8) {
        S.lockT = 0;
        S.lockResets++;
      }
      Snd.turn();
      return;
    }
  }

  function hardDrop() {
    if (!S.cur || S.over) return;
    let n = 0;
    while (!collide(S.cur, 0, 1)) { S.cur.y++; n++; }
    S.score += n * 2;
    Snd.drop();
    lockPiece();
  }

  /** 当前方块的落点行（画虚影用） */
  function ghostY() {
    if (!S.cur) return 0;
    let y = S.cur.y;
    while (!collide({ x: S.cur.x, y, m: S.cur.m }, 0, 1)) y++;
    return y;
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;
    if (S.over) return;

    if (S.clearRows.length) {
      S.clearT -= dt;
      if (S.clearT <= 0) finishClear();
      return;
    }
    if (!S.cur) return;

    // 左右自动连发
    if (S.held.left || S.held.right) {
      S.das.t -= dt;
      if (S.das.t <= 0) {
        tryMove(S.das.dir, 0);
        S.das.t = DAS_REPEAT;
      }
    }

    // 自然下落（按住 ↓ 时快 10 倍）
    const iv = S.held.down ? Math.max(0.045, dropInterval() * 0.09) : dropInterval();
    S.acc += dt;
    while (S.acc >= iv) {
      S.acc -= iv;
      if (!tryMove(0, 1)) break;
    }

    // 落地锁定延迟
    if (collide(S.cur, 0, 1)) {
      if (!S.landed) { S.landed = true; S.lockT = 0; }
      S.lockT += dt;
      if (S.lockT > LOCK_DELAY) lockPiece();
    } else {
      S.landed = false;
    }

    S.ghost = ghostY();
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'default',

    start() { reset(); },
    resize() {},
    restart() { reset(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      // 结束后任何一个动作都等于「再来一次」
      if (S.over) {
        if (down) reset();
        return;
      }
      if (name === 'confirm') return;

      if (name === 'left') {
        S.held.left = down;
        if (down) { tryMove(-1, 0); S.das.t = DAS_DELAY; S.das.dir = -1; }
      } else if (name === 'right') {
        S.held.right = down;
        if (down) { tryMove(1, 0); S.das.t = DAS_DELAY; S.das.dir = 1; }
      } else if (name === 'down') {
        S.held.down = down;
      } else if (down && name === 'rotate') {
        tryRotate();
      } else if (down && name === 'drop') {
        hardDrop();
      }
    }
  };

  api.controls = createControls();
  return api;
}
