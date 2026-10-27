/* =====================================================================
   games/ride/game.js — 环国骑行 · 逻辑层（13 号游戏，键 M）
   沿国境线 + 海岸线骑一圈中国：按住 ▶ 踩踏板（或开「自动骑」），
   沿途经过 24 个风土人情印章点——靠近时自动减速，盖章看介绍；
   集齐印章骑完全程 = 环国一圈完成（🏅），可以再来一圈。

   无失败、无惩罚：想慢慢看风景就松开踏板。
   ===================================================================== */
import { clamp, lerp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';
import { buildRoute, buildIslands, LANDMARKS, GEARS } from './route.js';

export const meta = {
  id: 'ride',
  name: '环国骑行',
  icon: '🚴',
  accent: '#b2f2bb',
  desc: ['沿国境线骑一圈中国', '盖章看遍各地风土人情']
};

const BEST_KEY = 'hpy-ride-laps';
const STARS_KEY = 'hpy-ride-stars';

export const L = { W: 800, H: 560 };

const TOTAL_KM = 22800;        // 现实里陆境+海岸一圈约 2.28 万公里
const COAST = 46;              // 松开踏板时的减速（单位/秒²）
const NEAR = 2.2;              // 接近印章点的减速半径
const GEAR_KEY = 'hpy-ride-gear';

/* 地形带：[起点比例, 结束比例, 名称, 速度倍率]——顺路认识大地貌 */
const TERRAIN = [
  [0.00, 0.07, '东北平原', 1.15],
  [0.07, 0.20, '长白林海', 1.0],
  [0.20, 0.28, '呼伦贝尔草原', 1.2],
  [0.28, 0.38, '大漠戈壁', 0.9],
  [0.38, 0.48, '天山脚下', 0.85],
  [0.48, 0.60, '帕米尔高原', 0.7],
  [0.60, 0.70, '青藏高原', 0.7],
  [0.70, 0.78, '横断山区', 0.8],
  [0.78, 1.00, '万里海岸线', 1.3]
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    route: buildRoute(),
    islands: buildIslands(),
    marks: LANDMARKS.map((m) => ({ ...m, taken: false })),
    d: 0,                  // 沿路径的里程（世界单位）
    speed: 0,
    pedaling: false,
    pedalLatch: false,     // 「骑 / 停」按钮的锁定状态：开着时松开踏板也会继续骑
    gear: clamp(loadNumber(GEAR_KEY, 1), 0, GEARS.length - 1),   // 30/50/80 三档
    auto: false,           // 自动骑（小乘客模式）
    lap: 0,
    laps: loadNumber(BEST_KEY),
    stars: loadNumber(STARS_KEY),
    kmLap: 0,              // 本圈里程
    kmAll: 0,              // 总里程
    card: null,            // 当前展示的风土人情卡 {icon,name,note}
    cardT: 0,
    celebrate: 0,          // 过关/盖圈庆祝计时
    terrain: TERRAIN[0][2],
    T: 0
  };

  const kmPerUnit = TOTAL_KM / S.route.total;

  function terrainAt(t) {
    for (const [a, b, name] of TERRAIN) if (t >= a && t < b) return name;
    return TERRAIN[TERRAIN.length - 1][2];
  }

  function multAt(t) {
    for (const [a, b, , m] of TERRAIN) if (t >= a && t < b) return m;
    return 1;
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;
    S.cardT = Math.max(0, S.cardT - dt);
    S.celebrate = Math.max(0, S.celebrate - dt);

    const t = S.d / S.route.total;
    S.terrain = terrainAt(t);
    let mult = multAt(t);

    // 快到印章点 → 自动减速看风景（把速度压到 1/3，约最后 12 秒）
    const next = nextMarkDist();
    if (next !== null && next < 1.5 && S.cardT <= 0) mult *= 0.35;

    if (S.pedaling || S.auto) {
      // 档位 km/h → 世界单位/秒；上坡/逆风再乘地形倍率
      const target = GEARS[S.gear] / kmPerUnit * mult;
      S.speed = lerp(S.speed, target, Math.min(1, dt * 2.6));
    } else {
      S.speed = Math.max(0, S.speed - COAST * dt);
    }

    if (S.speed > 0.01) {
      S.d += S.speed * dt;
      S.kmLap += S.speed * dt * kmPerUnit;
      S.kmAll += S.speed * dt * kmPerUnit;
      checkLandmarks();
      // 骑完一圈（回到起点）→ 庆祝 + 重置印章
      if (S.d >= S.route.total) {
        S.d -= S.route.total;
        S.lap++;
        S.laps++;
        saveNumber(BEST_KEY, S.laps);
        S.stars++;
        saveNumber(STARS_KEY, S.stars);
        S.kmLap = 0;
        S.celebrate = 3.0;
        S.card = { icon: '🏅', name: `环国一圈完成 × ${S.lap}`, note: '下一圈，换个方向再看看？' };
        S.cardT = 4.5;
        for (const m of S.marks) m.taken = false;
        Snd.win();
      }
      // 踩踏板的哒哒声（轻）
      if (S.pedaling && Math.floor(S.T * 2.2) !== Math.floor((S.T - dt) * 2.2)) Snd.step();
    }
  }

  /** 前向环程距离：从 d 出发沿骑行方向到 target 还有多远 */
  function fwdDist(d, target) {
    return ((target - d) % S.route.total + S.route.total) % S.route.total;
  }

  /** 距离下一个未盖印章还有多远（世界单位）；都盖完返回 null */
  function nextMarkDist() {
    let best = null;
    for (const m of S.marks) {
      if (m.taken) continue;
      const fwd = fwdDist(S.d, m.d);
      if (best === null || fwd < best) best = fwd;
    }
    return best;
  }

  function checkLandmarks() {
    for (const m of S.marks) {
      if (m.taken) continue;
      if (fwdDist(S.d, m.d) < 0.8) {
        m.taken = true;
        S.card = { icon: m.icon, name: m.name, note: m.note };
        S.cardT = 4.6;
        Snd.star();
        const all = S.marks.every((k) => k.taken);
        if (all) {
          FX.text(L.W / 2, 120, '印章集齐啦！', '#40c057', 30, 2600);
        }
        break;
      }
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
      S.d = 0;
      S.speed = 0;
      S.pedalLatch = false;
      S.kmLap = 0;
      S.lap = 0;
      S.card = { icon: '🚴', name: '环国骑行出发！', note: '按住 ▶ 踩踏板，看到景点会自动慢下来' };
      S.cardT = 5;
      for (const m of S.marks) m.taken = false;
    },
    resize() {},
    restart() { api.start(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },
    debug() { return { d: Math.round(S.d * 10) / 10, total: Math.round(S.route.total), speed: S.speed.toFixed(2), auto: S.auto, pedaling: S.pedaling, lap: S.lap, kmLap: Math.round(S.kmLap), cardT: Math.round(S.cardT) }; },

    action(name, down) {
      // 按住 = 踩；松开 = 回到「骑 / 停」开关的状态（点按切换不被松手抵消）
      if (name === 'pedal') { S.pedaling = down ? true : S.pedalLatch; return; }
      if (!down) return;
      if (name === 'togglepedal') {
        S.pedalLatch = !S.pedalLatch;
        S.pedaling = S.pedalLatch;
        Snd.pop(S.pedalLatch ? 4 : 1);
        return;
      }
      if (name === 'auto') {
        S.auto = !S.auto;
        Snd.pop(S.auto ? 4 : 1);
        if (S.auto) {
          S.card = { icon: '🛋️', name: '自动骑开启', note: '小马会自己踩踏板，专心看风景吧' };
          S.cardT = 3.5;
        }
        return;
      }
      if (name === 'nextmark') {   // 跳到下一个未盖章的印章附近（找景点直达）
        const best = nextMarkDist();
        if (best !== null) { S.d = (S.d + best - NEAR * 2 + S.route.total) % S.route.total; S.speed = 0; }
      }
      if (name === 'gear') {
        S.gear = (S.gear + 1) % GEARS.length;
        saveNumber(GEAR_KEY, S.gear);
        Snd.pop(5);
        S.card = { icon: '⚙️', name: `速度：${GEARS[S.gear]} km/h`, note: '上坡会慢一点，海岸线顺风更快' };
        S.cardT = 2.6;
      }
    }
  };

  // 预计算每个印章的路径里程
  for (const m of S.marks) m.d = S.route.cum[m.i];

  api.controls = createControls();
  return api;
}
