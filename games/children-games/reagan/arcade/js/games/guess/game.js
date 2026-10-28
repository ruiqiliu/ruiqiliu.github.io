/* =====================================================================
   games/guess/game.js — 猜数字 · 逻辑层（14 号，键 N）
   电脑想一个数，小朋友在数字表上点着猜：每猜一次提示「大了/小了」，
   范围外的数字会自动变淡——玩几局就悟出「每次都猜中间」的二分思路。
   猜中 = 🎉；连续答对 3 局升一级（范围更大）。
   ===================================================================== */
import { ri, clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'guess',
  name: '猜数字',
  icon: '🔍',
  accent: '#d0bfff',
  desc: ['大了还是小了？', '几次能猜中？']
};

const BEST_KEY = 'hpy-guess-best';
export const L = { W: 800, H: 560 };

const LEVELS = [
  { lo: 1, hi: 20, cols: 5, win: 2 },
  { lo: 1, hi: 50, cols: 10, win: 3 },
  { lo: 1, hi: 100, cols: 10, win: 4 }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    wins: 0,
    ans: 0,
    lo: 1, hi: 20,
    tries: 0,
    def: LEVELS[0],
    cells: [],
    best: [99, 99, 99].map((v, i) => loadNumber(`${BEST_KEY}-${i}`, v)),
    done: false,
    doneT: 0,
    lastTip: '',
    T: 0
  };

  function newRound() {
    const def = LEVELS[S.level - 1];
    S.def = def;
    S.ans = ri(def.lo, def.hi);
    S.lo = def.lo; S.hi = def.hi;
    S.tries = 0;
    S.done = false;
    S.lastTip = '';
    layout();
  }

  /** 数字格布局（tap 命中用，view 只读绘制） */
  function layout() {
    const def = LEVELS[S.level - 1];
    const n = def.hi - def.lo + 1;
    const cols = def.cols;
    const cw = Math.min(86, (L.W - 80) / cols);
    const chh = Math.min(64, (L.H - 260) / Math.ceil(n / cols));
    const ox = (L.W - (cols * cw + (cols - 1) * 8)) / 2;
    const oy = 190;
    S.cells = [];
    for (let i = 0; i < n; i++) {
      S.cells.push({
        v: def.lo + i,
        x: ox + (i % cols) * (cw + 8),
        y: oy + Math.floor(i / cols) * (chh + 8),
        w: cw, h: chh
      });
    }
  }

  /** 点中数值 v：更新范围与提示；猜中结算 */
  function guess(v) {
    if (S.done || v < S.lo || v > S.hi) return;
    S.tries++;
    if (v === S.ans) {
      S.done = true;
      S.doneT = 1.8;
      Snd.win();
      FX.text(L.W / 2, 150, `${S.tries} 步猜中！`, '#40c057', 30, 1600);
      if (S.tries < S.best[S.level - 1]) {
        S.best[S.level - 1] = S.tries;
        saveNumber(`${BEST_KEY}-${S.level - 1}`, S.tries);
      }
      return;
    }
    if (v < S.ans) {
      S.lo = v + 1;
      S.lastTip = v < Math.floor((S.lo + S.hi) / 2) ? '小了！往大猜 ↑' : '小了一点点 ↑';
      Snd.pop(1);
    } else {
      S.hi = v - 1;
      S.lastTip = v > Math.ceil((S.lo + S.hi) / 2) ? '大了！往小猜 ↓' : '大了一点点 ↓';
      Snd.pop(1);
    }
    if (S.lo === S.hi) S.lastTip = `只剩 ${S.lo} 啦！`;
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',

    start() {
      S.level = clamp(loadNumber(`${BEST_KEY}-level`, 1), 1, LEVELS.length);
      S.wins = 0;
      newRound();
    },
    resize() {},
    restart() { api.start(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      if (S.done) {
        S.doneT -= dt;
        if (S.doneT <= 0) {
          S.wins++;
          if (S.wins >= LEVELS[S.level - 1].win && S.level < LEVELS.length) {
            S.level++;
            saveNumber(`${BEST_KEY}-level`, S.level);
            Snd.star();
          }
          newRound();
        }
      }
    },
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      if (name === 'auto') {   // 💡 试一试：猜正中间（教二分思路）
        guess(Math.floor((S.lo + S.hi) / 2));
        return;
      }
      const v = parseInt(name.slice(1), 10);
      if (!isNaN(v)) guess(v);
    },

    tap(x, y) {
      const hit = S.cells.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (hit) guess(hit.v);
    }
  };

  api.controls = createControls();
  return api;
}
