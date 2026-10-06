/* =====================================================================
   games/garage/game.js — 车库大师 · 逻辑层
   两个阶段：
     build  车库里造车 —— 轮子 / 车灯 / 尾翼 / 车身颜色，点 ◀ ▶ 换着试
     drive  开上路 —— 油门加速、刹车减速，带惯性；路上有星星捡，
            没有失败也不会坏，随时回车库重新改造
   零件不只好看，还影响手感：越野轮抓地更快但颠簸、尾翼加极速。
   ===================================================================== */
import { clamp } from '../../core/util.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeBackground, PADS, HINT, PART_ROWS, START_BTN } from './view.js';

export const meta = {
  id: 'garage',
  name: '车库大师',
  icon: '🚗',
  accent: '#c8f7dc',
  desc: ['自己拼一辆小汽车', '踩油门出发喽']
};

/* ---------------- 版面与手感 ---------------- */
export const L = {
  W: 800,
  H: 560,
  GROUND: 480,     // 路面
  CAR_X: 170,      // 行驶时车的中心（画在偏左，看得清前方）
  ACCEL: 300,      // 油门加速度 px/s²
  BRAKE: 520,      // 刹车减速度
  DRAG: 60,        // 松油门的自然阻力
  VMAX_BASE: 320,
  STAR_GAP: 260,   // 星星间距 px
  CONE_GAP: 2200,  // 雪糕筒间距 px
  MILE: 500,       // 每跑 500 米庆祝一次
  GOAL: 200000     // 环形赛程一圈 20 公里（10px = 1 米）
};

export const WHEELS = [
  { name: '小圆轮', r: 17, bob: 1.4, grip: 0 },
  { name: '大花轮', r: 22, bob: 2.4, grip: 0.06 },
  { name: '越野轮', r: 26, bob: 3.6, grip: 0.14 }
];
export const LIGHTS = ['圆圆灯', '方方灯', '星星灯'];
export const SPOILERS = [
  { name: '没有尾翼', boost: 0 },
  { name: '小尾翼', boost: 45 },
  { name: '大赛翼', boost: 90 }
];
export const COLORS = ['#ff8787', '#74c0fc', '#69db7c', '#ffd43b', '#b197fc', '#ffa94d'];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    part: { wheel: 0, light: 0, spoiler: 0, color: 0 },
    selCat: 0,            // 键盘 ← → 换零件时作用的分类
    speed: 0,
    dist: 0,              // 行驶距离 px（≈ 米）
    got: new Set(),       // 已捡走的星星（按世界坐标记）
    starCount: 0,
    gas: false,
    brake: false,
    wheelAngle: 0,
    puffT: 0,
    wobble: 0,        // 撞雪糕筒后的晃动（0~1）
    driveT: 0,        // 本圈用时
    coneHits: new Set(),
    finishT: 0,
    phase: 'build',   // build | drive | finish
    bg: null,
    T: 0
  };

  /* ---------------- 造车 ---------------- */

  function cycle(cat, dir) {
    const counts = [WHEELS.length, LIGHTS.length, SPOILERS.length, COLORS.length];
    const keys = ['wheel', 'light', 'spoiler', 'color'];
    const key = keys[cat];
    S.part[key] = ((S.part[key] + dir) % counts[cat] + counts[cat]) % counts[cat];
    Snd.pop(S.part[key]);
  }

  function startDrive() {
    S.phase = 'drive';
    S.speed = 0;
    S.dist = 0;
    S.got = new Set();
    S.starCount = 0;
    S.gas = false;
    S.brake = false;
    S.wobble = 0;
    S.driveT = 0;
    S.coneHits = new Set();
    Snd.star();
    Snd.engine(true);
  }

  function backToGarage() {
    S.phase = 'build';
    S.gas = false;
    S.brake = false;
    Snd.engine(false);
    Snd.soft();
  }

  /* ---------------- 驾驶 ---------------- */

  const vmax = () => L.VMAX_BASE + SPOILERS[S.part.spoiler].boost * (1 + WHEELS[S.part.wheel].grip);

  function update(dt) {
    S.T += dt;
    if (S.phase === 'finish') {
      S.finishT -= dt;
      if (S.finishT <= 0) backToGarage();
      return;
    }
    if (S.phase !== 'drive') return;

    S.driveT += dt;
    if (S.wobble > 0) S.wobble = Math.max(0, S.wobble - dt);

    if (S.gas && !S.brake) S.speed += L.ACCEL * dt;
    if (S.brake) S.speed -= L.BRAKE * dt;
    if (!S.gas && !S.brake) S.speed -= L.DRAG * dt;
    S.speed = clamp(S.speed, 0, vmax());

    S.dist += S.speed * dt;
    S.wheelAngle += S.speed * dt / WHEELS[S.part.wheel].r;

    // 引擎音随速度（隐藏页会先被停掉，这里再拉起来）
    Snd.engine(true);
    Snd.engineRev(S.speed / vmax());

    // 尾气
    S.puffT -= dt;
    if (S.gas && S.speed > 40 && S.puffT <= 0) {
      S.puffT = 0.12;
      FX.burst(L.CAR_X - 95, L.GROUND - 40, ['#cfcfcf', '#ececec'], 3, 0.7);
    }

    // 捡星星：星星按世界坐标摆在路上，车开近就吸走
    const i0 = Math.max(1, Math.floor((S.dist - 60) / L.STAR_GAP));
    for (let i = i0; i <= i0 + 3; i++) {
      const wx = i * L.STAR_GAP;
      if (S.got.has(wx) || Math.abs(wx - S.dist) > 46) continue;
      S.got.add(wx);
      S.starCount++;
      FX.burst(L.CAR_X, L.GROUND - 120, ['#ffd43b', '#fff3bf', '#ffffff'], 14, 1);
      FX.text(L.CAR_X, L.GROUND - 145, '+1', '#f08c00', 22);
      Snd.star();
    }

    // 雪糕筒路障：撞上速度掉到四分之一，提前刹车能少掉速
    const c0 = Math.max(0, Math.floor((S.dist - 80) / L.CONE_GAP));
    for (let i = c0; i <= c0 + 2; i++) {
      const wx = i * L.CONE_GAP + 900;
      if (S.coneHits.has(wx) || Math.abs(wx - S.dist) > 34) continue;
      S.coneHits.add(wx);
      S.speed *= 0.25;
      S.wobble = 0.8;
      FX.burst(L.CAR_X + 40, L.GROUND - 26, ['#ff922b', '#ffd43b', '#ffffff'], 16, 1);
      FX.text(L.CAR_X + 40, L.GROUND - 80, '哎哟！', '#e8590c', 22);
      Snd.bump();
    }

    // 到达终点：跑完环形赛道的 20 公里
    if (S.dist >= L.GOAL) {
      S.phase = 'finish';
      S.finishT = 5;
      S.gas = false;
      S.brake = false;
      Snd.engine(false);
      Snd.win();
      return;
    }

    // 里程碑庆祝
    const mile0 = Math.floor((S.dist - S.speed * dt) / L.MILE);
    const mile1 = Math.floor(S.dist / L.MILE);
    if (mile1 > mile0) {
      FX.text(L.W / 2, 190, '开了 ' + mile1 * L.MILE + ' 米，好棒！', '#2f9e44', 26);
      FX.burst(L.W / 2, 215, ['#69db7c', '#b2f2bb', '#ffffff'], 16, 1);
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
      S.bg = makeBackground(L);
    },
    resize() {},
    restart() { backToGarage(); },
    destroy() {
      Snd.engine(false);
      document.removeEventListener('visibilitychange', onHide);
    },

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (name === 'gas') { S.gas = !!down; return; }
      if (name === 'brake') { S.brake = !!down; return; }
      if (!down) return;
      if (name === 'start') { if (S.phase === 'build') startDrive(); return; }
      if (name === 'garage') { if (S.phase !== 'build') backToGarage(); return; }
      if (name === 'cat1') { S.selCat = 0; cycle(0, 1); return; }
      if (name === 'cat2') { S.selCat = 1; cycle(1, 1); return; }
      if (name === 'cat3') { S.selCat = 2; cycle(2, 1); return; }
      if (name === 'cat4') { S.selCat = 3; cycle(3, 1); return; }
      if (name === 'left') { if (S.phase === 'build') cycle(S.selCat, -1); return; }
      if (name === 'right') { if (S.phase === 'build') cycle(S.selCat, 1); return; }
    },

    /* 控制层的指针入口 */
    press(p) {
      if (!p) return;
      if (S.phase === 'finish') { backToGarage(); return; }
      if (S.phase === 'build') {
        // 出发按钮
        if (p.x >= START_BTN.x && p.x <= START_BTN.x + START_BTN.w &&
            p.y >= START_BTN.y && p.y <= START_BTN.y + START_BTN.h) {
          startDrive();
          return;
        }
        // 零件面板：◀ 往左换，▶ / 点整行往右换
        for (let i = 0; i < PART_ROWS.length; i++) {
          const r = PART_ROWS[i];
          if (p.y < r.y || p.y > r.y + r.h) continue;
          if (p.x >= r.leftX && p.x <= r.leftX + r.arrowW) { cycle(i, -1); return; }
          if (p.x >= r.rightX && p.x <= r.rightX + r.arrowW) { cycle(i, 1); return; }
          if (p.x >= r.midX && p.x <= r.midX + r.midW) { cycle(i, 1); return; }
        }
      } else {
        // 开车时按住屏幕：右半边油门，左半边刹车
        if (p.x > L.W / 2) S.gas = true;
        else S.brake = true;
      }
    },
    release() {
      S.gas = false;
      S.brake = false;
    },

    /* 供 selftest 使用 */
    cycle,
    snapshot() {
      return {
        phase: S.phase,
        speed: Math.round(S.speed),
        dist: Math.round(S.dist),
        stars: S.starCount
      };
    }
  };

  // 切到后台时引擎必须停（rAF 冻结后没人改音量），回来 update 会再拉起
  const onHide = () => { if (document.hidden) Snd.engine(false); };
  document.addEventListener('visibilitychange', onHide);

  api.controls = createControls();
  return api;
}
