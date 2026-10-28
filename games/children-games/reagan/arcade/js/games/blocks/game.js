/* =====================================================================
   games/blocks/game.js — 数积木 · 逻辑层（19 号，键 U）
   立体积木堆数一数有几个小方块（藏在后面的也要算！）。
   四个答案里点对的；💡 教我会在每摞顶上标数字。
   ===================================================================== */
import { ri, clamp, shuffle } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'blocks',
  name: '数积木',
  icon: '🧊',
  accent: '#c5f6fa',
  desc: ['数一数有几块积木', '藏在后面的也要算哦']
};

const BEST_KEY = 'hpy-blocks-level';
export const L = { W: 800, H: 560 };
const LEVELS = [
  { cols: 3, rows: 3, maxH: 2, hid: false },
  { cols: 3, rows: 3, maxH: 3, hid: true },
  { cols: 4, rows: 3, maxH: 3, hid: true }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    heights: [],           // heights[z][x]：每摞的高度（0 = 没有）
    count: 0,
    options: [],
    done: false,
    doneT: 0,
    hintCol: false,        // 教我：每摞标数字
    stars: loadNumber('hpy-blocks-stars', 0),
    T: 0
  };

  function buildRound() {
    const def = LEVELS[S.level - 1];
    const lo = def.hid ? 2 : 1;
    let total = 0;
    do {
      S.heights = [];
      total = 0;
      for (let z = 0; z < def.rows; z++) {
        const row = [];
        for (let x = 0; x < def.cols; x++) {
          row.push(ri(def.hid ? 1 : 0, def.maxH));
        }
        total += row.reduce((a, b) => a + b, 0);
        S.heights.push(row);
      }
    } while (total < lo || total > def.maxH * def.cols * def.rows * 0.8 || total < 4);
    S.count = total;
    S.hintCol = false;

    // 四个选项：正确 + 干扰（±1/±2 的邻近数，去重）
    const opts = new Set([total]);
    while (opts.size < 4) {
      const v = total + ri(-3, 3);
      if (v > 0 && v !== total) opts.add(v);
    }
    S.options = shuffle([...opts]);
    S.done = false;
  }

  function pick(v) {
    if (S.done) return;
    if (v === S.count) {
      S.done = true;
      S.doneT = 1.8;
      S.stars = (S.stars || 0) + 1;
      saveNumber('hpy-blocks-stars', S.stars);
      Snd.win();
      FX.burst(L.W / 2, 200, ['#66d9e8', '#ffd43b'], 14, 1);
    } else {
      Snd.soft();
      S.hintCol = true;   // 答错不惩罚：自动打开每摞标数帮着数
      FX.text(L.W / 2, 140, '再数一数（看每摞顶上的数字）', '#ff8787', 20, 1600);
    }
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: S.stars,

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      buildRound();
    },
    resize() {},
    restart() { buildRound(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      if (S.done) {
        S.doneT -= dt;
        if (S.doneT <= 0) {
          S.level = clamp(S.level + 1, 1, LEVELS.length);
          saveNumber(BEST_KEY, S.level);
          buildRound();
        }
      }
    },
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      const m = name.match(/^lv(\d)$/);
      if (m) {
        const n = +m[1];
        if (n >= 1 && n <= LEVELS.length) { S.level = n; saveNumber(BEST_KEY, n); buildRound(); }
        return;
      }
      if (name === 'hint') {
        if (S.hintCol) pick(S.count);   // 再按一次 = 直接答
        else S.hintCol = true;
      }
    },

    tap(x, y) {
      S.options.forEach((o, i) => {
        const [ox, oy] = api.optPos(i);
        if (Math.hypot(x - ox, y - oy) < 42) pick(o);
      });
    }
  };

  /** 答案按钮位置（view 同步使用） */
  api.optPos = (i) => [170 + i * 155, 505];

  api.controls = createControls();
  return api;
}
