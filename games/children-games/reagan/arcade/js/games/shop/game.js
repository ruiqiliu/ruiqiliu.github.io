/* =====================================================================
   games/shop/game.js — 购物小掌柜 · 逻辑层（17 号，键 R）
   小朋友当掌柜：客人买东西付了钱，从钱罐里点出正确的找零递过去。
   「10 元买 7 元的东西，找 3 元」——减法就藏在生活里。
   答错钱币抖一抖退回来，不惩罚。
   ===================================================================== */
import { ri, clamp, shuffle } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'shop',
  name: '购物小掌柜',
  icon: '🏪',
  accent: '#ffe8cc',
  desc: ['客人付了钱', '你来找零钱']
};

const BEST_KEY = 'hpy-shop-level';
const STARS_KEY = 'hpy-shop-stars';
export const L = { W: 800, H: 560 };

const GOODS = [
  { icon: '🍦', name: '冰淇淋' }, { icon: '🧸', name: '小熊' }, { icon: '🏀', name: '皮球' },
  { icon: '🍭', name: '棒棒糖' }, { icon: '🚗', name: '玩具车' }, { icon: '📖', name: '绘本' },
  { icon: '🎈', name: '气球' }, { icon: '🍪', name: '饼干' }, { icon: '✏️', name: '铅笔' }
];
const LEVELS = [
  { max: 5, pay: [5, 10], rounds: 3 },
  { max: 9, pay: [10], rounds: 4 },
  { max: 15, pay: [20], rounds: 4, two: true }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    round: 0,
    item: null, item2: null,
    price: 0, pay: 0, change: 0,
    tray: [],             // 已放入的找零硬币 {v}
    coins: [],            // 钱罐的硬币位置 {v}
    done: false, doneT: 0,
    stars: loadNumber(STARS_KEY, 0),
    T: 0
  };

  function buildRound() {
    const def = LEVELS[S.level - 1];
    S.item = GOODS[ri(0, GOODS.length - 1)];
    S.item.price = ri(2, def.max);
    if (def.two) {
      S.item2 = GOODS[ri(0, GOODS.length - 1)];
      S.item2.price = ri(1, Math.min(9, def.max - S.item.price));
      S.price = S.item.price + S.item2.price;
    } else {
      S.item2 = null;
      S.price = S.item.price;
    }
    S.pay = def.pay[ri(0, def.pay.length - 1)];
    if (S.pay <= S.price) S.pay = S.price + ri(1, 3);   // 保底有零可找
    S.change = S.pay - S.price;
    S.tray = [];
    S.done = false;
    S.coins = [];
    // 钱罐：正确找零所需的币 + 一些干扰币，打乱摆开
    const need = changeCoins(S.change);
    const decoys = [];
    while (decoys.length < Math.min(3, 8 - need.length)) {
      const v = [1, 2, 5, 10][ri(0, 3)];
      decoys.push(v);
    }
    S.coins = shuffle(need.concat(decoys)).map((v) => ({ v }));
    layout();
  }

  /** 找零 c 的最小硬币组合（5/2/1 贪心，2 元让 3=2+1 这种更好拿） */
  function changeCoins(c) {
    const out = [];
    for (const v of [10, 5, 2, 1]) {
      while (c >= v) { out.push(v); c -= v; }
    }
    return out;
  }

  function layout() {
    // 硬罐最多 10 枚：4 列 × 2 排，保证互不重叠
    S.coins.forEach((c, i) => {
      c.x = 110 + (i % 4) * 150;
      c.y = 462 + Math.floor(i / 4) * 78;
      c.r = 34;
    });
  }

  function traySum() {
    return S.tray.reduce((a, b) => a + b.v, 0);
  }

  function tapCoin(i) {
    if (S.done) return;
    const c = S.coins[i];
    if (c.used) return;
    S.tray.push(c);
    c.used = true;
    Snd.pop(2);
    check();
  }

  function tapTray(idx) {
    if (S.done) return;
    const c = S.tray.splice(idx, 1)[0];
    c.used = false;
    Snd.pop(1);
  }

  function check() {
    if (traySum() === S.change) {
      S.done = true;
      S.doneT = 1.6;
      Snd.win();
      FX.burst(L.W - 160, 190, ['#ffd43b', '#51cf66', '#ff8fb1'], 16, 1);
    } else if (traySum() > S.change) {
      // 找多了：全部退回重想
      S.tray.forEach((c) => { c.used = false; });
      S.tray = [];
      Snd.soft();
      FX.text(L.W / 2, 300, '找多啦，再想想', '#ff8787', 24, 1200);
    }
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: S.stars,

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      S.round = 0;
      S.stars = loadNumber(STARS_KEY, 0);
      buildRound();
    },
    resize() { layout(); },
    restart() { api.start(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      if (S.done) {
        S.doneT -= dt;
        if (S.doneT <= 0) {
          S.round++;
          if (S.round >= LEVELS[S.level - 1].rounds) {
            S.stars++;
            saveNumber(STARS_KEY, S.stars);
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
        // 💡 演示正确找零：清空托盘，按 5/2/1 摆好
        S.tray.forEach((c) => { c.used = false; });
        S.tray = [];
        for (const v of changeCoins(S.change)) {
          const c = S.coins.find((k) => !k.used && k.v === v);
          if (c) { c.used = true; S.tray.push(c); }
        }
        Snd.pop(3);
        check();
      }
    },

    tap(x, y) {
      // 先看托盘（退回），再看钱罐（放入）
      const ti = S.tray.findIndex((c) => Math.hypot(x - c.tx, y - c.ty) < c.r + 6);
      if (ti >= 0) { tapTray(ti); return; }
      const ci = S.coins.findIndex((c) => !c.used && Math.hypot(x - c.x, y - c.y) < c.r + 6);
      if (ci >= 0) tapCoin(ci);
    }
  };

  api.controls = createControls();
  return api;
}
