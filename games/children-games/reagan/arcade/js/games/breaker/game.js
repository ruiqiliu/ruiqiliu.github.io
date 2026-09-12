/* =====================================================================
   games/breaker/game.js — 打砖块 · 逻辑层
   状态 S + 规则 update()。不碰 canvas、不读 DOM —— 绘制在 view.js。
   （允许调用注入的 Snd / FX 做音效与特效反馈，这属于「事件通知」。）

   儿童版设定：球不会丢。底部是弹力地板，漏掉的球会自己飞回来继续打。
   ===================================================================== */
import { clamp, rand, circleRect, shade } from '../../core/util.js';
import { createControls } from './controls.js';
import { draw, hud, makeBackground, PADS, HINT } from './view.js';

export const meta = {
  id: 'breaker',
  name: '打砖块',
  icon: '🧱',
  accent: '#ffc4d6',
  desc: ['把彩色砖块全部打掉', '球不会掉，放心玩']
};

/** 糖果色砖块 */
const CANDY = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#f783ac', '#38d9a9'];

/* ---------------- 版面尺寸表（只读，view.js 也用它） ---------------- */
export const L = {
  W: 800,
  H: 560,
  WALL: 12,      // 左右墙厚度
  TOP: 12,       // 顶部墙厚度
  COLS: 7,
  ROWS: 5,
  GL: 44,        // 砖块区左边距
  PADW: 190,     // 挡板宽
  PADH: 22,
  BASE: 262,     // 球的基础速度
  ADD: 8,        // 每过一关提速
  CAP: 340       // 速度上限
};
L.CELLW = (L.W - 2 * L.GL) / L.COLS;
L.BW = L.CELLW - 10;
L.BH = 32;
L.RSTEP = 40;          // 行间距
L.GT = 112;            // 砖块区顶
L.PADY = L.H - 96;     // 挡板 y
L.FLOOR = L.H - 16;    // 弹力地板 y
L.BR = 13;             // 球半径

/** 第 0~5 关的砖块图案（7 × 5 的字符画） */
const PATTERNS = [
  null,
  null,
  null,
  ['0110110', '1111111', '1111111', '0111110', '0011100'], // 爱心
  ['0111110', '1111111', '1101011', '1111111', '0111110'], // 笑脸
  ['0001000', '0011100', '1111111', '0011100', '0001000']  // 菱形
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    bricks: [],
    left: 0,
    level: 1,
    score: 0,
    stars: 0,
    ball: { x: L.W / 2, y: L.PADY - L.BR - 4, dx: 0, dy: -1, trail: [] },
    paddle: { x: L.W / 2, target: L.W / 2, bot: false },
    served: false,
    serveT: 1.2,
    phase: 'play',   // play | clear
    clearT: 0,
    keys: { left: false, right: false },
    bg: null,
    T: 0
  };

  /* ---------------- 关卡生成 ---------------- */

  function cellOn(p, r, c) {
    switch (p) {
      case 0: return r >= 1 && r <= 3;                       // 三条大横排
      case 1: return (r + c) % 2 === 0 && r < 4;             // 棋盘格
      case 2: return c >= r && c < L.COLS - r && r < 4;      // 金字塔
      default: return PATTERNS[p][r][c] === '1';             // 爱心 / 笑脸 / 菱形
    }
  }

  function build() {
    S.bricks = [];
    S.left = 0;
    const p = (S.level - 1) % 6;
    for (let r = 0; r < L.ROWS; r++) {
      for (let c = 0; c < L.COLS; c++) {
        if (!cellOn(p, r, c)) continue;
        S.bricks.push({
          x: L.GL + c * L.CELLW + 5,
          y: L.GT + r * L.RSTEP,
          w: L.BW,
          h: L.BH,
          c: CANDY[(r * L.COLS + c) % CANDY.length],
          alive: true
        });
        S.left++;
      }
    }
  }

  /* ---------------- 球 ---------------- */

  function newBall() {
    S.ball = { x: S.paddle.x, y: L.PADY - L.BR - 6, dx: 0, dy: -1, trail: [] };
    S.served = false;
    S.serveT = 1.2;
  }

  function launch() {
    if (S.served) return;
    S.served = true;
    const a = rand(-0.4, 0.4);
    S.ball.dx = Math.sin(a);
    S.ball.dy = -Math.cos(a);
    normalize(S.ball);
    Snd.pop(0);
  }

  /** 归一化方向，并强制 |dy| / |dx| 有下限，防止球卡成水平或垂直来回弹 */
  function normalize(b) {
    const m = Math.hypot(b.dx, b.dy) || 1;
    b.dx /= m;
    b.dy /= m;
    if (Math.abs(b.dy) < 0.30) {
      b.dy = (b.dy < 0 ? -1 : 1) * 0.30;
      b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - 0.09);
    }
    if (Math.abs(b.dx) < 0.14) {
      b.dx = (b.dx < 0 ? -1 : 1) * 0.14;
      b.dy = (b.dy < 0 ? -1 : 1) * Math.sqrt(1 - 0.0196);
    }
  }

  const speed = () => Math.min(L.CAP, L.BASE + (S.level - 1) * L.ADD);

  /* ---------------- 砖块被击碎 ---------------- */

  function killBrick(b) {
    b.alive = false;
    S.left--;
    S.stars++;
    S.score += 10;
    FX.burst(b.x + b.w / 2, b.y + b.h / 2, [b.c, shade(b.c, 0.5), '#ffffff'], 18, 1);
    Snd.note(Math.min(S.stars, 7));

    if (S.left <= 0) {
      S.phase = 'clear';
      S.clearT = 2.1;
      S.score += 100;
      Snd.win();
      for (let i = 0; i < 5; i++) {
        setTimeout(() => FX.burst(rand(140, L.W - 140), rand(140, L.H - 220), CANDY, 20, 1.2), i * 110);
      }
    }
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;

    // 过关庆祝中：等倒计时结束就进入下一关
    if (S.phase === 'clear') {
      S.clearT -= dt;
      if (S.clearT <= 0) {
        S.level++;
        build();
        S.paddle.x = S.paddle.target = L.W / 2;
        newBall();
        S.phase = 'play';
      }
      return;
    }

    // 挡板
    if (S.keys.left) S.paddle.x -= 700 * dt;
    if (S.keys.right) S.paddle.x += 700 * dt;
    if (S.paddle.bot) S.paddle.x += (S.paddle.target - S.paddle.x) * Math.min(1, dt * 22);
    S.paddle.x = clamp(S.paddle.x, L.PADW / 2 + L.WALL, L.W - L.PADW / 2 - L.WALL);

    // 发球倒计时
    if (!S.served) {
      S.serveT -= dt;
      if (S.serveT <= 0) launch();
    }
    if (!S.served) {
      S.ball.x = S.paddle.x;
      S.ball.y = L.PADY - L.BR - 6;
      return;
    }

    // 移动：按速度分步，防止高速穿透
    const sp = speed();
    S.ball.trail.push({ x: S.ball.x, y: S.ball.y });
    if (S.ball.trail.length > 10) S.ball.trail.shift();

    const steps = Math.max(1, Math.ceil((sp * dt) / 7));
    for (let s = 0; s < steps; s++) {
      const sdt = dt / steps;
      S.ball.x += S.ball.dx * sp * sdt;
      S.ball.y += S.ball.dy * sp * sdt;

      // 左右墙 / 顶墙
      if (S.ball.x - L.BR < L.WALL) { S.ball.x = L.WALL + L.BR; S.ball.dx = Math.abs(S.ball.dx); Snd.soft(); }
      if (S.ball.x + L.BR > L.W - L.WALL) { S.ball.x = L.W - L.WALL - L.BR; S.ball.dx = -Math.abs(S.ball.dx); Snd.soft(); }
      if (S.ball.y - L.BR < L.TOP) { S.ball.y = L.TOP + L.BR; S.ball.dy = Math.abs(S.ball.dy); Snd.soft(); }

      // 底部弹力地板：球不会丢
      if (S.ball.y + L.BR > L.FLOOR) {
        S.ball.y = L.FLOOR - L.BR;
        S.ball.dy = -Math.abs(S.ball.dy);
        normalize(S.ball);
        Snd.soft();
        FX.burst(S.ball.x, L.FLOOR, ['#ffd0e4', '#ffffff'], 6, 0.7);
      }

      // 砖块（列表按 y 升序，碰到球下方的行就可以提前跳出）
      for (const br of S.bricks) {
        if (!br.alive) continue;
        if (br.y > S.ball.y + L.BR) break;
        const col = circleRect(S.ball.x, S.ball.y, L.BR, br.x, br.y, br.w, br.h);
        if (!col) continue;
        S.ball.x += col.nx * col.pen;
        S.ball.y += col.ny * col.pen;
        const dot = S.ball.dx * col.nx + S.ball.dy * col.ny;
        if (dot < 0) {
          S.ball.dx -= 2 * dot * col.nx;
          S.ball.dy -= 2 * dot * col.ny;
        }
        normalize(S.ball);
        killBrick(br);
        break;
      }

      // 挡板：只在下落时接球（从下方回弹的球可以穿过去，自动救回）
      if (S.ball.dy > 0 && S.ball.y < L.PADY + L.PADH) {
        const col = circleRect(S.ball.x, S.ball.y, L.BR, S.paddle.x - L.PADW / 2, L.PADY, L.PADW, L.PADH);
        if (col) {
          S.ball.y = L.PADY - L.BR - 0.5;
          const off = clamp((S.ball.x - S.paddle.x) / (L.PADW / 2), -1, 1);
          const ang = off * 1.05;
          S.ball.dx = Math.sin(ang);
          S.ball.dy = -Math.cos(ang);
          normalize(S.ball);
          Snd.pop(1);
          FX.burst(S.ball.x, L.PADY, '#ffd6e8', 6, 0.6);
        }
      }
    }
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'none',

    start() {
      S.level = 1;
      S.score = 0;
      S.stars = 0;
      S.phase = 'play';
      S.paddle.x = S.paddle.target = L.W / 2;
      S.paddle.bot = false;
      S.bg = makeBackground(L);
      build();
      newBall();
    },

    resize() {
      S.bg = makeBackground(L);
    },

    restart() {
      api.start();
    },

    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hud(S, L); },

    /* --- 语义动作 --- */
    action(name, down) {
      if (name === 'left') { S.keys.left = down; S.paddle.bot = false; }
      else if (name === 'right') { S.keys.right = down; S.paddle.bot = false; }
      else if (down && S.phase === 'clear' && S.clearT < 1.6) { S.clearT = 0.05; }
      else if (down && name === 'serve') { launch(); }
    },

    /* --- 供控制层调用的意图方法 --- */
    aim(x) {
      S.paddle.target = x;
      S.paddle.bot = true;
    },
    serve() {
      if (S.phase === 'play') launch();
    }
  };

  api.controls = createControls();
  return api;
}
