/* =====================================================================
   games/moto/game.js — 暴力摩托 · 逻辑层
   伪 3D 公路（追尾视角）：赛道向地平线收敛，超车 / 别车 / 出手。
   卡通风格：被别到的对手只是晃悠减速、冒小星星，没有流血受伤。
   ===================================================================== */
import { TAU, clamp, rand } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeSky, PADS, HINT } from './view.js';

export const meta = {
  id: 'moto',
  name: '暴力摩托',
  icon: '🏍️',
  accent: '#ffd8a8',
  desc: ['一路超车冲第一', '按空格出拳把对手别开']
};

const BEST_KEY = 'hpy-moto-best';

/* ---------------- 版面与手感参数 ---------------- */
export const L = {
  W: 800,
  H: 560,
  SEGLEN: 200,       // 每段赛段的长度
  ROADW: 2000,       // 路面半宽（世界单位）
  LANES: 3,
  RUMBLE_R: 0.18,    // 路肩宽度 = 路面宽 × 这个比例
  CAM_H: 1000,
  FOV: 100,
  DRAW_DIST: 150,    // 一帧最多画多少段
  TRACK_SEGS: 1400,
  FINISH_SEG: 1150,
  BIKE_W: 520,       // 车宽（世界单位）
  FINISH_GRACE: 3,
  RIVAL_COLORS: ['#ff6b6b', '#4dabf7', '#b197fc', '#ffd43b', '#38d9a9', '#ff922b']
};
L.HORIZON = L.H / 2;
L.CAM_DEPTH = 1 / Math.tan(((L.FOV / 2) * Math.PI) / 180);
L.PLAYER_Z = L.CAM_H * L.CAM_DEPTH;
L.FINISH_Z = L.FINISH_SEG * L.SEGLEN;

// 手感
L.MAX_SPEED = 12000;
L.ACCEL = L.MAX_SPEED / 5.0;
L.BRAKE = -L.MAX_SPEED / 1.5;
L.DECEL = -L.MAX_SPEED / 6.5;
L.OFF_DECEL = -L.MAX_SPEED / 1.1;   // 开出草地后的减速
L.OFF_LIMIT = L.MAX_SPEED / 3.2;
L.CENTRIFUGAL = 0.40;               // 弯道把你往外甩的力度
L.STEER = 2.1;

/** 赛道形状：[曲率, 长度] 依次拼接 */
const TRACK_SEQ = [
  [0, 70], [2, 55], [0, 40], [-3, 65], [0, 45], [4, 75], [-2, 40], [0, 55],
  [3, 55], [-4, 65], [-2, 45], [0, 70], [5, 65], [-5, 65], [0, 50], [2, 60], [0, 50]
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    segs: [], rivals: [], cones: [], props: [],
    coneMap: {}, propMap: {},
    position: 0, playerX: 0, speed: 0,
    hearts: 3, score: 0, level: 1,
    phase: 'play',        // play | finish
    rank: 1, finishRank: 1,
    t: 0,
    wobble: 0, shake: 0, redFlash: 0,
    hitCd: 0, atkCd: 0, atkAnim: 0,
    finishT: 0, crashed: false,
    steer: 0,
    held: { left: false, right: false, brake: false, boost: false },
    best: loadNumber(BEST_KEY),
    sky: null, skyH: 0
  };

  /* ---------------- 赛道 ---------------- */

  const findSeg = (z) => S.segs[clamp(Math.floor(z / L.SEGLEN), 0, S.segs.length - 1)];

  function buildTrack() {
    S.segs = [];
    const add = (curve, len) => {
      for (let i = 0; i < len; i++) {
        const n = S.segs.length;
        S.segs.push({
          index: n,
          curve,
          alt: Math.floor(n / 3) % 2 === 1,   // 交替色，跑起来才有速度感
          p1: { world: { y: 0, z: n * L.SEGLEN }, camera: {}, screen: {} },
          p2: { world: { y: 0, z: (n + 1) * L.SEGLEN }, camera: {}, screen: {} }
        });
      }
    };
    for (const q of TRACK_SEQ) add(q[0], q[1]);
    while (S.segs.length < L.TRACK_SEGS) add(0, 40);
  }

  function buildScenery() {
    S.cones = [];
    S.props = [];
    S.coneMap = {};
    S.propMap = {};

    for (let i = 30; i < L.FINISH_SEG - 20; i++) {
      const seg = S.segs[i];
      if (i % 97 === 0 && i > 60) {
        const cone = { z: seg.index * L.SEGLEN + 100, off: rand(-0.75, 0.75) };
        S.cones.push(cone);
        if (i % 194 === 0) {
          S.cones.push({ z: cone.z + 160, off: clamp(cone.off + 0.35, -0.8, 0.8) });
        }
      }
      if (i % 9 === 0) {
        const side = i % 18 === 0 ? -1 : 1;
        S.props.push({
          z: seg.index * L.SEGLEN,
          off: side * rand(1.35, 2.4),
          kind: i % 36 === 0 ? 'sign' : i % 27 === 0 ? 'bush' : 'tree',
          c: L.RIVAL_COLORS[((i / 9) | 0) % L.RIVAL_COLORS.length]
        });
      }
    }

    // 按赛段建索引，渲染时 O(1) 取用
    for (const c of S.cones) {
      const k = Math.floor(c.z / L.SEGLEN);
      (S.coneMap[k] || (S.coneMap[k] = [])).push(c);
    }
    for (const p of S.props) {
      const k = Math.floor(p.z / L.SEGLEN);
      (S.propMap[k] || (S.propMap[k] = [])).push(p);
    }
  }

  function spawnRivals() {
    S.rivals = [];
    const n = 4 + Math.min(S.level - 1, 3);
    for (let i = 0; i < n; i++) {
      S.rivals.push({
        z: L.PLAYER_Z + 2600 + i * 1500 + rand(0, 700),
        off: rand(-0.72, 0.72),
        speed: L.MAX_SPEED * (0.56 + Math.random() * 0.2 + (S.level - 1) * 0.035),
        color: L.RIVAL_COLORS[i % L.RIVAL_COLORS.length],
        state: 'ride',        // ride | wobble | gone
        t: rand(0, 4),
        wob: 0,
        sway: rand(0, TAU),
        prevOff: null
      });
    }
  }

  function resetLevel(keepScore) {
    S.position = 0;
    S.playerX = 0;
    S.speed = L.MAX_SPEED * 0.28;
    S.hearts = 3;
    S.atkCd = 0;
    S.atkAnim = 0;
    S.wobble = 0;
    S.shake = 0;
    S.redFlash = 0;
    S.steer = 0;
    S.crashed = false;
    S.rank = 1;
    S.finishRank = 1;
    if (!keepScore) { S.score = 0; S.level = 1; }
    S.held.left = false;
    S.held.right = false;

    buildTrack();
    buildScenery();
    spawnRivals();

    S.phase = 'play';
    S.finishT = 0;
  }

  /* ---------------- 事件 ---------------- */

  /** 名次 = 排在我前面的对手数 + 1 */
  function updateRank() {
    let ahead = 0;
    for (const r of S.rivals) {
      if (r.state !== 'down' && r.z > S.position + L.PLAYER_Z) ahead++;
    }
    S.rank = 1 + ahead;
    S.finishRank = S.rank;
  }

  /** 撞到雪糕筒（或别车失误）掉一颗心 */
  function hit() {
    if (S.hitCd > 0) return;
    S.hitCd = 0.75;
    S.wobble = 1;
    S.shake = 1;
    S.redFlash = 1;
    S.speed = Math.max(L.MAX_SPEED * 0.12, S.speed * 0.35);
    S.hearts--;
    FX.burst(L.W / 2, L.H - 140, ['#ffd43b', '#ff922b', '#ffffff'], 22, 1.2);
    Snd.soft();

    if (S.hearts <= 0) {
      S.hearts = 0;
      FX.text(L.W / 2, L.H / 2 - 40, '摔车啦！', '#e03131', 30);
      S.phase = 'finish';
      S.finishT = 2.6;
      S.crashed = true;
      saveBest();
    }
  }

  function punch() {
    if (S.phase !== 'play' || S.atkCd > 0) return;
    S.atkCd = 0.42;
    S.atkAnim = 0.22;
    Snd.pop(3);

    const pz = S.position + L.PLAYER_Z;
    let target = null;
    let bestDz = Infinity;

    for (const r of S.rivals) {
      if (r.state === 'gone') continue;
      const dz = r.z - pz;
      if (dz < -120 || dz > 480) continue;                        // 太远够不着
      if (Math.abs((r.off - S.playerX) * L.ROADW) > 460) continue; // 横向太远
      if (dz < bestDz) { bestDz = dz; target = r; }
    }

    if (!target) {
      FX.burst(L.W / 2 - 150, L.H - 200, ['#dee2e6', '#ffffff'], 6, 0.6);
      return;
    }

    const side = target.off < S.playerX ? -1 : 1;
    target.state = 'wobble';
    target.wob = 1.1;
    target.speed *= 0.52;
    target.off = clamp(target.off + side * 0.42, -0.98, 0.98);
    S.score += 300;

    FX.burst(L.W / 2 + side * 140, L.H - 220, ['#ffd43b', '#ff922b', '#ffffff', '#4dabf7'], 26, 1.3);
    FX.text(L.W / 2 + side * 140, L.H - 300, '漂亮！ +300', '#f59f00', 22);
    Snd.star();
  }

  function saveBest() {
    if (S.score > S.best) {
      S.best = S.score;
      saveNumber(BEST_KEY, S.best);
    }
  }

  /* ---------------- 世界推进 ---------------- */

  function moveWorld(dt, coasting) {
    const playerSeg = findSeg(S.position + L.PLAYER_Z);
    const spdPct = S.speed / L.MAX_SPEED;

    // 加速 / 滑行 / 刹车
    if (coasting || S.held.brake) {
      S.speed = Math.max(0, S.speed + (S.held.brake ? L.BRAKE : L.DECEL * 0.5) * dt);
    } else {
      S.speed += L.ACCEL * dt;
      if (S.held.boost) S.speed += L.ACCEL * 0.7 * dt;
      if (S.speed > L.MAX_SPEED) S.speed = L.MAX_SPEED;
    }

    // 前进 + 转向 + 离心力
    S.position += S.speed * dt;
    S.playerX += S.steer * dt * L.STEER * Math.max(0.35, spdPct);
    S.playerX -= dt * spdPct * playerSeg.curve * L.CENTRIFUGAL * 0.55;

    // 开出草地
    if (Math.abs(S.playerX) > 1) {
      if (S.speed > L.OFF_LIMIT) S.speed += L.OFF_DECEL * dt;
      S.playerX = clamp(S.playerX, -1.9, 1.9);
      if (S.speed > L.MAX_SPEED * 0.25 && Math.random() < 0.5) {
        FX.burst(L.W / 2 + rand(-120, 120), L.H - 40, ['#8ce99a', '#69db7c'], 3, 0.5);
      }
    }
    S.playerX = clamp(S.playerX, -1.9, 1.9);

    // 对手
    for (const r of S.rivals) {
      r.prevOff = r.off;

      if (r.state === 'wobble') {
        r.wob -= dt;
        r.off = clamp(r.off + Math.sign(r.off || 1) * 0.5 * dt, -1.25, 1.25);
        if (r.wob <= 0) {
          r.state = Math.abs(r.off) > 1 ? 'gone' : 'ride';
          if (r.state === 'gone') continue;
        }
      }
      if (r.state === 'ride') {
        r.t += dt;
        const want = Math.sin(r.t * 0.55 + r.sway) * 0.55;
        r.off += clamp(want - r.off, -1, 1) * dt * 0.55;
        r.off = clamp(r.off, -0.85, 0.85);
      }
      if (Math.abs(r.off) > 1) r.speed = Math.max(L.MAX_SPEED * 0.2, r.speed - L.OFF_DECEL * 0.5 * dt);
      r.z += r.speed * dt;

      // 车与车接触：互相推开、减速，冒一点小火花
      if (r.state === 'ride' || r.state === 'wobble') {
        const dz = r.z - (S.position + L.PLAYER_Z);
        const dxx = Math.abs((r.off - S.playerX) * L.ROADW);
        if (Math.abs(dz) < 250 && dxx < 265) {
          const push = S.playerX < r.off ? -1 : 1;
          S.playerX = clamp(S.playerX + push * 0.055, -1.9, 1.9);
          r.off = clamp(r.off - push * 0.03, -0.95, 0.95);
          S.speed *= 0.965;
          r.speed *= 0.975;
          if (S.hitCd <= 0) {
            S.hitCd = 0.16;
            S.shake = 0.5;
            S.wobble = Math.max(S.wobble, 0.45);
            FX.burst(L.W / 2 + push * 90, L.H - 200, ['#ffd43b', '#ffffff', '#adb5bd'], 10, 0.9);
            Snd.pop(2);
          }
        }
      }
    }

    // 雪糕筒
    for (let i = S.cones.length - 1; i >= 0; i--) {
      const c = S.cones[i];
      const dz = c.z - (S.position + L.PLAYER_Z);
      if (dz < -200) continue;
      if (dz > 400) break;
      if (Math.abs(dz) < 300 && Math.abs((c.off - S.playerX) * L.ROADW) < 230) {
        S.cones.splice(i, 1);
        hit();
        FX.burst(L.W / 2, L.H - 160, ['#ff922b', '#ffffff', '#f08c00'], 20, 1.1);
      }
    }

    // 冲线
    if (S.phase === 'play' && S.position + L.PLAYER_Z >= L.FINISH_Z) {
      S.phase = 'finish';
      S.finishT = 2.6;
      S.score += S.finishRank === 1 ? 2000 : S.finishRank <= 3 ? 1200 : 600;
      Snd.win();
      for (let i = 0; i < 6; i++) {
        setTimeout(
          () => FX.burst(rand(120, L.W - 120), rand(120, L.H - 200), L.RIVAL_COLORS, 18, 1.2),
          i * 110
        );
      }
    }
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.t += dt;
    if (S.hitCd > 0) S.hitCd -= dt;
    if (S.atkCd > 0) S.atkCd -= dt;
    if (S.atkAnim > 0) S.atkAnim -= dt;
    if (S.wobble > 0) S.wobble = Math.max(0, S.wobble - dt * 2.2);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 2.6);
    if (S.redFlash > 0) S.redFlash = Math.max(0, S.redFlash - dt * 2.4);

    // 冲线后滑行庆祝，倒计时结束进入下一场
    if (S.phase === 'finish') {
      S.finishT -= dt;
      S.speed = Math.max(0, S.speed + L.DECEL * dt);
      S.position += S.speed * dt;
      for (const r of S.rivals) r.z += r.speed * dt;
      if (S.finishT <= 0) {
        S.level++;
        saveBest();
        resetLevel(true);
      }
      return;
    }

    // 转向输入平滑（不是瞬间到位，手感更柔和）
    if (S.held.left) S.steer = Math.max(-1, S.steer - dt * 5.0);
    else if (S.held.right) S.steer = Math.min(1, S.steer + dt * 5.0);
    else S.steer *= 1 - Math.min(1, dt * 6);

    moveWorld(dt, false);
    updateRank();
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'default',

    start() {
      const sky = makeSky(L);
      S.sky = sky.canvas;
      S.skyH = sky.height;
      resetLevel(false);
      updateRank();
    },

    resize() {
      const sky = makeSky(L);
      S.sky = sky.canvas;
      S.skyH = sky.height;
    },

    restart() { resetLevel(false); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      switch (name) {
        case 'release':
          S.held.left = false;
          S.held.right = false;
          break;
        case 'center':
          S.held.left = false;
          S.held.right = false;
          break;
        case 'left':
          if (S.phase === 'finish') break;
          S.held.left = down;
          S.held.right = false;
          break;
        case 'right':
          if (S.phase === 'finish') break;
          S.held.right = down;
          S.held.left = false;
          break;
        case 'brake':
          S.held.brake = down;
          break;
        case 'boost':
          S.held.boost = down;
          break;
        case 'punch':
          if (down) punch();
          break;
        case 'skip':
          if (S.phase === 'finish' && S.finishT < 1.9) S.finishT = 0.05;
          break;
      }
    }
  };

  api.controls = createControls();
  return api;
}
