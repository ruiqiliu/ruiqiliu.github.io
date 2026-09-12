/* =====================================================================
   games/flappy/game.js — 小鸟飞飞（Flappy Bird）· 逻辑层
   儿童版改动：撞管子只掉一颗爱心（共 3 颗），掉光才结束；
   被撞后有 1.5 秒无敌时间，还会自动往上弹一下，不会立刻连撞。
   ===================================================================== */
import { rand, circleRect } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, makeBackground, PADS, HINT } from './view.js';

export const meta = {
  id: 'flappy',
  name: '小鸟飞飞',
  icon: '🐤',
  accent: '#ffe08a',
  desc: ['点一下拍翅膀', '穿过管子别撞到']
};

const BEST_KEY = 'hpy-flappy-best';

/* ---------------- 版面与手感参数 ---------------- */
export const L = {
  W: 800,
  H: 560,
  GROUND: 92,
  BIRD_X: 210,
  BIRD_R: 19,
  GRAVITY: 1450,
  FLAP: -430,          // 拍一下翅膀给的向上的速度
  MAX_FALL: 780,
  PIPE_W: 94,
  GAP0: 215,           // 初始缝宽（很宽，方便小朋友）
  GAP_MIN: 168,
  SPACING: 330,        // 两根管子的水平间距
  SPEED0: 186,
  SPEED_ADD: 3.2,      // 每得 1 分快一点
  SPEED_MAX: 300,
  HEARTS: 3,
  INVUL: 1.5
};
L.GROUND_Y = L.H - L.GROUND;

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    phase: 'ready',      // ready | play | over
    bird: { y: 0, vy: 0, wing: 0 },
    pipes: [],
    hearts: L.HEARTS,
    score: 0,
    best: loadNumber(BEST_KEY),
    invul: 0,
    pos: 0,              // 世界滚动距离（地面 / 云的视差用）
    bg: null,
    T: 0
  };

  /* ---------------- 关卡元素 ---------------- */

  const speed = () => Math.min(L.SPEED_MAX, L.SPEED0 + S.score * L.SPEED_ADD);
  const gapOf = () => Math.max(L.GAP_MIN, L.GAP0 - S.score * 2);

  function makePipe(x, index) {
    const gap = gapOf();
    const margin = 56;
    const gapY = rand(margin, L.GROUND_Y - gap - margin);
    return {
      x,
      gapY,
      gap,
      passed: false,
      hasCoin: index % 3 === 2,   // 每三根管子中间挂一颗星星
      coinTaken: false
    };
  }

  function ensurePipes() {
    const last = S.pipes[S.pipes.length - 1];
    if (!last) {
      S.pipes.push(makePipe(L.W + 140, 0));
      return;
    }
    if (last.x <= L.W - L.SPACING) {
      S.pipes.push(makePipe(last.x + L.SPACING, S.pipes.length));
    }
  }

  /* ---------------- 动作 ---------------- */

  function reset() {
    S.phase = 'ready';
    S.bird = { y: L.GROUND_Y * 0.45, vy: 0, wing: 0 };
    S.pipes = [];
    S.hearts = L.HEARTS;
    S.score = 0;
    S.invul = 0;
    S.pos = 0;
    ensurePipes();
  }

  function flap() {
    if (S.phase === 'over') return;
    if (S.phase === 'ready') S.phase = 'play';
    S.bird.vy = L.FLAP;
    S.bird.wing = 0.25;
    Snd.flap();
  }

  function hurt() {
    if (S.invul > 0) return;
    S.hearts--;
    Snd.bump();

    const px = L.BIRD_X;
    const py = S.bird.y;
    FX.burst(px, py, ['#ffd43b', '#ff922b', '#ffffff'], 18, 1.1);

    if (S.hearts <= 0) {
      S.hearts = 0;
      S.phase = 'over';
      if (S.score > S.best) {
        S.best = S.score;
        saveNumber(BEST_KEY, S.best);
      }
      Snd.soft();
      return;
    }

    S.invul = L.INVUL;
    S.bird.vy = -300;      // 弹起来，给小朋友一次补救的机会
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;
    if (S.invul > 0) S.invul = Math.max(0, S.invul - dt);
    if (S.bird.wing > 0) S.bird.wing = Math.max(0, S.bird.wing - dt);

    // 准备阶段：原地上下浮动，等着被拍一下
    if (S.phase === 'ready') {
      S.bird.y = L.GROUND_Y * 0.45 + Math.sin(S.T * 4) * 11;
      return;
    }

    if (S.phase === 'over') return;

    // 重力
    S.bird.vy = Math.min(L.MAX_FALL, S.bird.vy + L.GRAVITY * dt);
    S.bird.y += S.bird.vy * dt;

    const sp = speed();
    S.pos += sp * dt;

    // 管子左移
    for (const p of S.pipes) p.x -= sp * dt;
    while (S.pipes.length && S.pipes[0].x + L.PIPE_W < -20) S.pipes.shift();
    ensurePipes();

    collideAndScore();
  }

  function collideAndScore() {
    const bx = L.BIRD_X;
    const by = S.bird.y;
    const r = L.BIRD_R;

    // 天花板
    if (by - r < 0) {
      S.bird.y = r;
      S.bird.vy = Math.max(0, S.bird.vy);
    }

    // 地面
    if (by + r > L.GROUND_Y) {
      S.bird.y = L.GROUND_Y - r;
      if (S.invul > 0) {
        S.bird.vy = -320;
      } else {
        hurt();
        S.bird.vy = -320;
      }
      return;
    }

    for (const p of S.pipes) {
      // 通过管子：得分
      if (!p.passed && p.x + L.PIPE_W < bx - r) {
        p.passed = true;
        S.score++;
        Snd.pass();
      }

      // 吃星星
      if (p.hasCoin && !p.coinTaken) {
        const cx = p.x + L.PIPE_W / 2;
        const cy = p.gapY + p.gap / 2;
        if (Math.hypot(cx - bx, cy - by) < 26 + r) {
          p.coinTaken = true;
          S.score += 5;
          FX.burst(cx, cy, ['#ffd43b', '#fff3bf', '#ffffff'], 16, 1);
          FX.text(cx, cy - 20, '+5', '#f08c00', 20);
          Snd.star();
        }
      }

      if (p.x > bx + r || p.x + L.PIPE_W < bx - r) continue;

      // 撞管子
      const hitTop = circleRect(bx, by, r, p.x, -40, L.PIPE_W, p.gapY + 40);
      const hitBottom = circleRect(bx, by, r, p.x, p.gapY + p.gap, L.PIPE_W, L.GROUND_Y - (p.gapY + p.gap) + 10);
      if (hitTop || hitBottom) hurt();
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
      reset();
    },

    resize() {
      S.bg = makeBackground(L);
    },

    restart() { reset(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },
    isOver() { return S.phase === 'over'; },

    action(name, down) {
      if (!down) return;
      if (name === 'flap') {
        if (S.phase === 'over') { reset(); return; }
        flap();
      } else if (name === 'confirm') {
        if (S.phase === 'over') reset();
      }
    }
  };

  api.controls = createControls();
  return api;
}
