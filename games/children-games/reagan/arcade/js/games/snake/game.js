/* =====================================================================
   games/snake/game.js — 贪吃蛇 · 逻辑层
   撞墙从另一边穿出来；撞到自己掉一颗爱心，爱心用完才结束。
   ===================================================================== */
import { pick } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud, makeBackground, PADS, HINT } from './view.js';

export const meta = {
  id: 'snake',
  name: '贪吃蛇',
  icon: '🐍',
  accent: '#a9ecc0',
  desc: ['吃水果，蛇变长啦', '撞墙会穿到另一边']
};

const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍒', '🥝'];
const BEST_KEY = 'hpy-snake-best';

/* ---------------- 版面尺寸表 ---------------- */
export const L = { N: 15, CELL: 38, PAD: 15 };
L.W = L.N * L.CELL + L.PAD * 2;
L.H = L.W;

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    snake: [],
    dir: { x: 1, y: 0 },
    queue: [],        // 转向缓冲：快速连按两个方向也不会丢
    food: null,
    foods: 0,
    hearts: 3,
    score: 0,
    tick: 0.34,       // 每一格的间隔秒数
    acc: 0,
    grow: 0,          // 待生长的节数
    over: false,
    best: loadNumber(BEST_KEY),
    tiles: null,
    T: 0
  };

  /* ---------------- 一局的生命周期 ---------------- */

  function reset() {
    S.snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
    S.dir = { x: 1, y: 0 };
    S.queue = [];
    S.foods = 0;
    S.hearts = 3;
    S.score = 0;
    S.grow = 0;
    S.over = false;
    S.tick = 0.34;
    S.acc = 0;
    placeFood();
  }

  function freeCells() {
    const used = new Set(S.snake.map((s) => s.x + ',' + s.y));
    const out = [];
    for (let y = 0; y < L.N; y++) {
      for (let x = 0; x < L.N; x++) {
        if (!used.has(x + ',' + y)) out.push({ x, y });
      }
    }
    return out;
  }

  function placeFood() {
    const free = freeCells();
    if (!free.length) { S.food = null; return; }

    // 每吃满 5 个水果，下一次刷新出金色星星（+3 分、长 2 节）
    const star = S.foods > 0 && S.foods % 5 === 0;
    S.food = Object.assign(pick(free), { star, emo: star ? '⭐' : pick(FRUITS), t: 0 });
    if (star) Snd.star();
  }

  /** 走一格 */
  function step() {
    if (S.queue.length) {
      const nd = S.queue.shift();
      if (!(nd.x === -S.dir.x && nd.y === -S.dir.y)) S.dir = nd;
    }

    const head = {
      x: (S.snake[0].x + S.dir.x + L.N) % L.N,
      y: (S.snake[0].y + S.dir.y + L.N) % L.N
    };

    // 撞到自己（尾巴这一格马上会让出来，所以不算）
    const bodyHit = S.snake.some(
      (s, i) => i < S.snake.length - (S.grow > 0 ? 0 : 1) && s.x === head.x && s.y === head.y
    );
    if (bodyHit) { hurt(); return; }

    S.snake.unshift(head);

    if (S.food && head.x === S.food.x && head.y === S.food.y) {
      const gain = S.food.star ? 3 : 1;
      const px = L.PAD + head.x * L.CELL + L.CELL / 2;
      const py = L.PAD + head.y * L.CELL + L.CELL / 2;

      S.score += gain;
      S.foods++;
      S.grow += S.food.star ? 2 : 1;

      FX.burst(px, py, S.food.star ? ['#ffd43b', '#fff3bf', '#ffffff'] : ['#ff8787', '#ffd43b', '#69db7c'], 12, 0.9);
      FX.text(px, py - 18, '+' + gain, '#ff922b', 18);
      Snd.eat();
      if (S.food.star) Snd.star();

      S.tick = Math.max(0.155, 0.34 - S.foods * 0.0075);
      placeFood();
    }

    if (S.grow > 0) S.grow--;
    else S.snake.pop();
  }

  /** 撞到自己：掉一颗爱心，蛇缩短回 3 节 */
  function hurt() {
    S.hearts--;
    FX.burst(
      L.PAD + S.snake[0].x * L.CELL + L.CELL / 2,
      L.PAD + S.snake[0].y * L.CELL + L.CELL / 2,
      ['#ff8787', '#ffc9c9'], 20, 1.1
    );
    Snd.soft();

    if (S.hearts <= 0) {
      S.over = true;
      S.best = saveIfBest(S.score, S.best);
      return;
    }

    S.queue = [];
    while (S.snake.length > 3) S.snake.pop();
    FX.text(L.W / 2, L.H / 2, '哎呀！蛇变短啦', '#e8590c', 22);
  }

  function saveIfBest(score, best) {
    if (score > best) {
      saveNumber(BEST_KEY, score);
      return score;
    }
    return best;
  }

  function setDir(nx, ny) {
    if (S.over) return;
    const last = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
    if (nx === -last.x && ny === -last.y) return;   // 不能 180° 掉头
    if (nx === last.x && ny === last.y) return;     // 重复方向忽略
    if (S.queue.length < 2) S.queue.push({ x: nx, y: ny });
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;
    if (S.food) S.food.t += dt;
    if (S.over || !S.food) return;

    S.acc += dt;
    while (S.acc >= S.tick) {
      S.acc -= S.tick;
      step();
      if (S.over) break;
    }
  }

  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'default',

    start() {
      S.tiles = makeBackground(L);
      reset();
    },

    resize() {
      S.tiles = makeBackground(L);
    },

    restart() {
      reset();
    },

    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hud(S); },

    action(name, down) {
      if (name === 'confirm') {
        if (down && S.over) reset();
        return;
      }
      if (!down || S.over) return;
      if (name === 'up') setDir(0, -1);
      else if (name === 'down') setDir(0, 1);
      else if (name === 'left') setDir(-1, 0);
      else if (name === 'right') setDir(1, 0);
    }
  };

  api.controls = createControls();
  return api;
}
