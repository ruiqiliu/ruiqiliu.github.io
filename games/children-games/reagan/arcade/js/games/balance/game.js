/* =====================================================================
   games/balance/game.js — 天平称重 · 逻辑层（18 号，键 T）
   左盘放着一个重 N 斤的西瓜，从架子上点砝码（1/2/5/10）放到右盘，
   让天平正好平衡。放多了会歪下去，拿掉重来，不惩罚。
   ===================================================================== */
import { ri, clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'balance',
  name: '天平称重',
  icon: '⚖️',
  accent: '#c3fae8',
  desc: ['放砝码让天平平衡', '加法就藏在天平上']
};

const BEST_KEY = 'hpy-balance-level';
export const L = { W: 800, H: 560 };
const WEIGHTS = [1, 2, 5, 10];
const LEVELS = [
  { lo: 2, hi: 6, rounds: 3 },
  { lo: 4, hi: 10, rounds: 4 },
  { lo: 6, hi: 16, rounds: 4 }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    round: 0,
    target: 0,
    pan: [],               // 右盘砝码 {v}
    tilt: 0,
    done: false,
    doneT: 0,
    stars: loadNumber('hpy-balance-stars', 0),
    T: 0
  };

  function buildRound() {
    S.target = ri(LEVELS[S.level - 1].lo, LEVELS[S.level - 1].hi);
    S.pan = [];
    S.panLocs = [];
    S.done = false;
  }

  function panSum() {
    return S.pan.reduce((a, b) => a + b.v, 0);
  }

  function addWeight(v) {
    if (S.done) return;
    S.pan.push({ v });
    Snd.pop(2);
    check();
  }

  function removeWeight(i) {
    if (S.done) return;
    S.pan.splice(i, 1);
    Snd.pop(1);
  }

  const PIVOT = { x: 400, y: 330 };

  function updateTilt(dt) {
    const t = S.done ? 0 : clamp((panSum() - S.target) / 10, -0.12, 0.12);
    S.tilt += (t - S.tilt) * Math.min(1, dt * 8);
  }

  function check() {
    const s = panSum();
    if (s === S.target) {
      S.done = true;
      S.doneT = 1.8;
      Snd.win();
      FX.burst(L.W / 2, 210, ['#63e6be', '#ffd43b'], 14, 1);
      S.stars = (S.stars || 0) + 1;
      saveNumber('hpy-balance-stars', S.stars);
    }
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: S.stars,

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      S.round = 0;
      S.stars = loadNumber('hpy-balance-stars', 0);
      buildRound();
    },
    resize() {},
    restart() { api.start(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      updateTilt(dt);
      S.panLocs = S.pan.map((w, i) => api.panPos(i));
      if (S.done) {
        S.doneT -= dt;
        if (S.doneT <= 0) {
          S.round++;
          if (S.round >= LEVELS[S.level - 1].rounds) {
            S.level = clamp(S.level + 1, 1, LEVELS.length);
            saveNumber(BEST_KEY, S.level);
            S.round = 0;
            Snd.star();
          }
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
        if (n >= 1 && n <= LEVELS.length) { S.level = n; saveNumber(BEST_KEY, n); S.round = 0; buildRound(); }
        return;
      }
      if (name === 'hint') {
        // 💡 演示：从大到小放，刚好配平
        let left = S.target - panSum();
        for (const v of [10, 5, 2, 1]) {
          while (left >= v) { addWeight(v); left -= v; }
          if (left === 0) return;
        }
      }
    },

    tap(x, y) {
      // 点右盘砝码 = 拿走（屏幕坐标 → 逆旋转 → 梁上局部坐标）
      const cos = Math.cos(-S.tilt), sin = Math.sin(-S.tilt);
      const lx = cos * (x - PIVOT.x) - sin * (y - PIVOT.y);
      const ly = sin * (x - PIVOT.x) + cos * (y - PIVOT.y);
      for (let i = 0; i < S.pan.length; i++) {
        const [px, py] = api.panPos(i);
        if (Math.hypot(lx - px, ly - py) < 30) { removeWeight(i); return; }
      }
      // 点架子上的砝码 = 放入
      WEIGHTS.forEach((v, i) => {
        const wx = 150 + i * 170;
        if (Math.hypot(x - wx, y - 505) < 40) addWeight(v);
      });
    }
  };

  /** 右盘第 i 个砝码的位置（梁局部坐标，view 在旋转后的坐标系里画） */
  api.panPos = (i) => [150 + (i % 4) * 34, -22 - Math.floor(i / 4) * 26];

  api.controls = createControls();
  return api;
}
