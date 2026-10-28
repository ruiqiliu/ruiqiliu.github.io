/* =====================================================================
   games/make10/game.js — 凑十点 · 逻辑层（16 号，键 P）
   一堆数字块里挑两张「加起来等于 10」，全消掉过关。
   1+9、2+8、3+7、4+6、5+5 —— 凑十好朋友配对背下来。
   ===================================================================== */
import { shuffle, clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'make10',
  name: '凑十点',
  icon: '🎯',
  accent: '#a5d8ff',
  desc: ['挑两张加起来是 10', '把数字块全消光']
};

const BEST_KEY = 'hpy-make10-level';
export const L = { W: 800, H: 560 };
const PAIRS = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]];
const LEVELS = [6, 8, 10, 12];   // 每关的块数

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    cards: [],             // {v, gone, pop, shake}
    sel: -1,
    left: 0,
    winT: 0,
    T: 0
  };

  function buildLevel() {
    const n = LEVELS[S.level - 1];
    const vals = [];
    for (let i = 0; i < n / 2; i++) {
      const pair = PAIRS[i % PAIRS.length];
      vals.push(pair[0], pair[1]);
    }
    S.cards = shuffle(vals).map((v) => ({ v, gone: false, pop: 0, shake: 0 }));
    S.sel = -1;
    S.left = n;
    S.winT = 0;
    layout();
  }

  function layout() {
    const n = S.cards.length;
    const cols = Math.min(4, n);
    const rows = Math.ceil(n / cols);
    const bs = Math.min(150, (L.W - 110) / cols - 12, (L.H - 230) / rows - 14);
    const ox = (L.W - (cols * bs + (cols - 1) * 12)) / 2;
    const oy = 170 + (L.H - 260 - rows * bs - (rows - 1) * 12) / 2;
    S.cards.forEach((c, i) => {
      c.x = ox + (i % cols) * (bs + 12);
      c.y = oy + Math.floor(i / cols) * (bs + 12);
      c.w = bs; c.h = bs;
    });
  }

  function tapCard(i) {
    const c = S.cards[i];
    if (c.gone) return;
    if (S.sel === -1) {
      S.sel = i;
      Snd.pop(1);
      return;
    }
    if (S.sel === i) { S.sel = -1; return; }
    const a = S.cards[S.sel];
    if (a.v + c.v === 10) {
      a.gone = c.gone = true;
      a.pop = c.pop = 0.4;
      S.left -= 2;
      S.sel = -1;
      Snd.note(S.level + Math.floor((S.cards.length - S.left) / 4));
      FX.burst(c.x + c.w / 2, c.y + c.h / 2, ['#ffd43b', '#4dabf7'], 12, 0.9);
      if (S.left === 0) {
        S.winT = 1.6;
        S.stars = (S.stars || 0) + 1;
        saveNumber('hpy-make10-stars', S.stars);
        Snd.win();
        FX.text(L.W / 2, 140, '全部凑成 10！', '#40c057', 32, 1400);
      }
    } else {
      a.shake = 0.45; c.shake = 0.45;
      S.sel = -1;
      Snd.soft();
    }
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: loadNumber('hpy-make10-stars', 0),

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      buildLevel();
    },
    resize() { layout(); },
    restart() { api.start(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      for (const c of S.cards) {
        c.pop = Math.max(0, c.pop - dt);
        c.shake = Math.max(0, c.shake - dt);
      }
      if (S.winT > 0) {
        S.winT -= dt;
        if (S.winT <= 0) {
          S.level = clamp(S.level + 1, 1, LEVELS.length);
          saveNumber(BEST_KEY, S.level);
          buildLevel();
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
        if (n >= 1 && n <= LEVELS.length) { S.level = n; saveNumber(BEST_KEY, n); buildLevel(); }
        return;
      }
      if (name === 'hint') {
        // 💡 演示一对：找两个没消的凑 10（先清掉玩家的半选状态）
        S.sel = -1;
        for (let i = 0; i < S.cards.length; i++) {
          for (let j = i + 1; j < S.cards.length; j++) {
            if (!S.cards[i].gone && !S.cards[j].gone && S.cards[i].v + S.cards[j].v === 10) {
              tapCard(i);
              tapCard(j);
              return;
            }
          }
        }
      }
    },

    tap(x, y) {
      const i = S.cards.findIndex((c) => !c.gone && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (i >= 0) tapCard(i);
    }
  };

  api.controls = createControls();
  return api;
}
