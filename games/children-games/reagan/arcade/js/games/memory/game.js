/* =====================================================================
   games/memory/game.js — 翻牌记忆 · 逻辑层（15 号，键 O）
   一对对翻牌配对：翻开两张一样的就消掉，全部配对过关。
   关卡越大牌越多；步数越少越好（最佳步数会记住）。
   ===================================================================== */
import { shuffle, clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'memory',
  name: '翻牌记忆',
  icon: '🃏',
  accent: '#ffec99',
  desc: ['翻开两张一样的', '几步能全配对？']
};

const BEST_KEY = 'hpy-memory-best';
export const L = { W: 800, H: 560 };

const ICONS = ['🐶', '🐱', '🐼', '🦊', '🐸', '🐷', '🐰', '🦁', '🐮', '🐵', '🐔', '🐧', '🦉', '🐝', '🌈', '🚗', '🍎', '🍓', '🌟', '🎈'];
const LEVELS = [
  { cols: 3, rows: 2 }, { cols: 4, rows: 2 }, { cols: 4, rows: 3 },
  { cols: 4, rows: 4 }, { cols: 6, rows: 3 }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    cards: [],             // {icon, state: 0 盖|1 开|2 配对, pop}
    first: -1,
    lockT: 0,
    moves: 0,
    matched: 0,
    best: 0,
    def: LEVELS[0],
    winT: 0,
    T: 0
  };

  function buildLevel() {
    const def = LEVELS[S.level - 1];
    S.def = def;
    const pairs = def.cols * def.rows / 2;
    const icons = shuffle(ICONS.slice()).slice(0, pairs);
    const deck = shuffle(icons.concat(icons).map((icon) => ({ icon, state: 0, pop: 0 })));
    S.cards = deck;
    S.first = -1;
    S.lockT = 0;
    S.moves = 0;
    S.matched = 0;
    S.best = loadNumber(`${BEST_KEY}-${S.level}`, 999);
    layout();
  }

  /* 布局（view 只读坐标） */
  function layout() {
    const def = LEVELS[S.level - 1];
    const cw = Math.min(110, (L.W - 80) / def.cols - 8);
    const ch = Math.min(130, (L.H - 190) / def.rows - 8);
    const ox = (L.W - (def.cols * cw + (def.cols - 1) * 10)) / 2;
    const oy = 150 + (L.H - 220 - def.rows * ch - (def.rows - 1) * 10) / 2;
    S.cards.forEach((c, i) => {
      c.x = ox + (i % def.cols) * (cw + 10);
      c.y = oy + Math.floor(i / def.cols) * (ch + 10);
      c.w = cw; c.h = ch;
    });
  }

  function flipUp(i) {
    S.cards[i].state = 1;
    S.cards[i].pop = 0.3;
  }

  function tapCard(i) {
    const c = S.cards[i];
    if (S.lockT > 0 || c.state !== 0) return;
    flipUp(i);
    Snd.pop(1);
    if (S.first === -1) { S.first = i; return; }
    S.moves++;
    const a = S.cards[S.first], b = c;
    if (a.icon === b.icon) {
      a.state = b.state = 2;
      S.matched++;
      S.first = -1;
      Snd.eat();
      FX.burst(b.x + b.w / 2, b.y + b.h / 2, ['#ffd43b', '#51cf66'], 10, 0.8);
      if (S.matched === S.cards.length / 2) {
        S.winT = 2.0;
        Snd.win();
        if (S.moves < S.best) { S.best = S.moves; saveNumber(`${BEST_KEY}-${S.level}`, S.moves); }
        S.stars = (S.stars || 0) + 1;
        saveNumber('hpy-memory-stars', S.stars);
      }
    } else {
      S.lockT = 0.8;
      Snd.soft();
    }
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: loadNumber('hpy-memory-stars', 0),

    start() {
      S.level = clamp(loadNumber('hpy-memory-level', 1), 1, LEVELS.length);
      buildLevel();
    },
    resize() { layout(); },
    restart() { api.start(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      for (const c of S.cards) c.pop = Math.max(0, c.pop - dt);
      if (S.lockT > 0) {
        S.lockT -= dt;
        if (S.lockT <= 0) {
          S.cards.forEach((c) => { if (c.state === 1) c.state = 0; });
          S.first = -1;
        }
      }
      if (S.winT > 0) {
        S.winT -= dt;
        if (S.winT <= 0) {
          S.level = clamp(S.level + 1, 1, LEVELS.length);
          saveNumber('hpy-memory-level', S.level);
          buildLevel();
        }
      }
    },
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      const m = name.match(/^lv(\d+)$/);
      if (m) {
        const n = +m[1];
        if (n >= 1 && n <= LEVELS.length) { S.level = n; saveNumber('hpy-memory-level', n); buildLevel(); }
        return;
      }
      if (name === 'hint') {
        // 💡 已翻开一张 → 翻开它的配对；没有 → 翻开一对盖着的
        if (S.lockT > 0) return;
        if (S.first >= 0) {
          const icon = S.cards[S.first].icon;
          const j = S.cards.findIndex((c) => c.state === 0 && c.icon === icon);
          if (j >= 0) tapCard(j);
          return;
        }
        const i = S.cards.findIndex((c) => c.state === 0);
        for (let j = i + 1; j < S.cards.length; j++) {
          if (S.cards[j].state === 0 && S.cards[j].icon === S.cards[i].icon) {
            tapCard(i);
            tapCard(j);
            return;
          }
        }
      }
    },

    tap(x, y) {
      const i = S.cards.findIndex((c) => c.state === 0 && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (i >= 0) tapCard(i);
    }
  };

  api.controls = createControls();
  return api;
}
