/* =====================================================================
   games/tangram/game.js — 七巧板 · 逻辑层（16 号，键 P）
   两关拼板任务（都可以严格验证拼法）+ 自由拼搭沙盒：
   - 两块小板拼一个小正方形；
   - 两块大板拼一个大三角形；
   - 自由模式：七块板随便摆，不设目标。
   拖动板块摆放，点一下（没拖动）旋转 45°；靠近目标位置自动吸上。
   ===================================================================== */
import { clamp } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';
import { solvePlacement, pieceVerts, pieceCentroid } from './shapes.js';

export const meta = {
  id: 'tangram',
  name: '七巧板',
  icon: '🔷',
  accent: '#d0bfff',
  desc: ['拖一拖、转一转', '七块板拼出图形']
};

const BEST_KEY = 'hpy-tangram-level';
export const L = { W: 800, H: 560 };

/* 拼板任务：pieces = 用哪几块板，target = 每块板的目标多边形（可严格验证） */
const LEVELS = [
  { mode: 'free', name: '自由拼搭', pieces: [0, 1, 2, 3, 4, 5, 6] },
  {
    mode: 'puzzle', name: '小板拼方', pieces: [4, 5],
    targets: { 4: [[4, 4], [6, 6], [2, 6]], 5: [[2, 6], [6, 6], [4, 8]] }, scale: 110
  },
  {
    mode: 'puzzle', name: '大板拼三角', pieces: [0, 1],
    targets: { 0: [[0, 0], [8, 0], [4, 4]], 1: [[0, 0], [4, 4], [0, 8]] }, scale: 36
  }
];

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    pieces: [],            // {i, x, y, r, locked}——x/y 一律是屏幕像素
    targets: new Map(),    // pieceIdx -> {tx, ty, r}（屏幕像素，仅拼板关）
    scale: 34, offX: 400, offY: 250,
    drag: null,            // {idx, dx, dy, sx, sy, moved}
    winT: 0,
    stars: loadNumber('hpy-tangram-stars', 0),
    def: LEVELS[0],
    T: 0
  };

  function buildLevel() {
    const def = LEVELS[S.level - 1];
    S.def = def;
    S.targets = new Map();
    S.scale = def.scale || 34;
    S.pieces = def.pieces.map((i) => {
      const bc = pieceCentroid(i);
      const p = { i, x: 0, y: 0, r: 0, locked: false };
      if (def.mode === 'puzzle') {
        const t = def.targets[i];
        const pl = solvePlacement(i, t);
        if (!pl) console.warn('tangram: 摆位求解失败', S.level, i);
        // 目标位置换算成屏幕像素（和板块同一坐标系）
        S.targets.set(i, { tx: pl.tx * S.scale + S.offX, ty: pl.ty * S.scale + S.offY, r: pl.k });
      }
      return p;
    });
    // 打散摆到托盘区（两排，屏幕像素）
    S.pieces.forEach((p, k) => {
      p.x = 140 + (k % 4) * 180;
      p.y = k < 4 ? 462 : 540;
      p.r = def.mode === 'puzzle' ? Math.floor(Math.random() * 8) : 0;
      if (def.mode === 'puzzle') {
        const t = S.targets.get(p.i);
        if (t) p.r = (t.r + 1 + Math.floor(Math.random() * 7)) % 8;   // 保证不是正确朝向
      }
    });
    S.winT = 0;
  }

  function pieceAt(x, y) {
    // 从上层板块往下找（后画的先命中）
    for (let k = S.pieces.length - 1; k >= 0; k--) {
      const p = S.pieces[k];
      const verts = pieceVerts(p.i, p.x, p.y, p.r, S.scale);
      if (inPoly(x, y, verts)) return p;
    }
    return null;
  }

  function trySnap(p) {
    const t = S.targets.get(p.i);
    if (!t || p.locked) return false;
    if (Math.hypot(p.x - t.tx, p.y - t.ty) < 36 && p.r % 8 === t.r % 8) {
      p.x = t.tx;
      p.y = t.ty;
      p.r = t.r % 8;
      p.locked = true;
      Snd.pop(4);
      FX.burst(p.x, p.y, ['#ffd43b', '#b197fc'], 10, 0.8);
      if (S.pieces.every((q) => q.locked)) {
        S.winT = 2.2;
        S.stars = (S.stars || 0) + 1;
        saveNumber('hpy-tangram-stars', S.stars);
        Snd.win();
      }
      return true;
    }
    return false;
  }

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  const api = {
    W: L.W, H: L.H,
    pads: PADS, hint: HINT, cursor: 'pointer',
    stars: S.stars,

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      buildLevel();
    },
    resize() {},
    restart() { buildLevel(); },
    destroy() {},

    update(dt) {
      S.T += dt;
      if (S.winT > 0) {
        S.winT -= dt;
        if (S.winT <= 0) {
          S.level = clamp(S.level + 1, 1, LEVELS.length);
          saveNumber(BEST_KEY, S.level);
          buildLevel();
        }
      }
    },
    render() {
      S.pieceVerts = (i, x, y, r) => pieceVerts(i, x, y, r, S.scale);   // view 用（屏幕像素）
      draw(ctx, S, L);
    },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      const m = name.match(/^lv(\d+)$/);
      if (m) {
        const n = +m[1];
        if (n >= 1 && n <= LEVELS.length) { S.level = n; saveNumber(BEST_KEY, n); buildLevel(); }
        return;
      }
      if (name === 'hint') {
        // 💡 教我：把一块未锁定的板块吸到它的目标位置
        const p = S.pieces.find((q) => !q.locked);
        const t = p && S.targets.get(p.i);
        if (p && t) {
          p.x = t.tx; p.y = t.ty; p.r = t.r;
          p.locked = true;
          Snd.pop(4);
          FX.burst(p.x, p.y, ['#ffd43b', '#b197fc'], 10, 0.8);
          if (S.pieces.every((q) => q.locked)) {
            S.winT = 2.2;
            S.stars = (S.stars || 0) + 1;
            saveNumber('hpy-tangram-stars', S.stars);
            Snd.win();
          }
        }
      }
    },

    down(x, y) {
      const p = pieceAt(x, y);
      if (!p || p.locked) return;
      S.drag = { idx: S.pieces.indexOf(p), dx: p.x - x, dy: p.y - y, sx: x, sy: y, moved: false };
    },
    move(x, y) {
      if (!S.drag) return;
      const p = S.pieces[S.drag.idx];
      p.x = x + S.drag.dx;
      p.y = y + S.drag.dy;
      if (Math.hypot(x - S.drag.sx, y - S.drag.sy) > 10) S.drag.moved = true;
    },
    up(x, y) {
      if (!S.drag) return;
      const p = S.pieces[S.drag.idx];
      // 没怎么动 = 点按旋转 45°；拖动了 = 尝试吸附
      if (!S.drag.moved) {
        p.r = (p.r + 1) % 8;
        Snd.pop(1);
      } else {
        trySnap(p);
      }
      S.drag = null;
    }
  };

  api.controls = createControls();
  return api;
}
