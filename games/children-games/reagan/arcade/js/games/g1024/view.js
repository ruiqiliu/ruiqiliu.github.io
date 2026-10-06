/* =====================================================================
   games/g1024/view.js — 1024 合并 · UI 层
   滑块 = 糖果色圆角方块，数字越大颜色越艳；右侧面板画出
   2 → 1024 的合成路线，已经合出过的数字是亮色，给孩子一个目标感。
   ===================================================================== */
import { TAU, rr, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>' +
  '<div class="row">' +
    '<button class="pad" data-act="d3">3×3</button>' +
    '<button class="pad" data-act="d4">4×4</button>' +
    '<button class="pad" data-act="d5">5×5</button>' +
  '</div>';

export const HINT =
  '方向键 / WASD 滑动，相同数字撞在一起就合并 · ' +
  '<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 换棋盘大小 · ' +
  '合出 1024 就赢啦 · 卡住了会有爱心帮你救场';

export function hud(S) {
  return [
    ['难度', S.n + '×' + S.n],
    ['得分', S.score],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—'],
    ['最佳', S.best]
  ];
}

/* 右侧小面板（静态底板和每帧绘制共用同一套坐标） */
const PANEL = { x: 546, y: 60, w: 204, h: 440 };

/** 数值 → [底色, 文字色]，数字越大越艳 */
const COLORS = {
  2:    ['#eef5ff', '#5b9dff'],
  4:    ['#e5faee', '#2fa96c'],
  8:    ['#fff6dc', '#f0a202'],
  16:   ['#ffe7ec', '#f06595'],
  32:   ['#f1e7ff', '#9a4fd0'],
  64:   ['#dff3fe', '#1c8ed6'],
  128:  ['#ffeed9', '#e97212'],
  256:  ['#fdf7c9', '#c9a103'],
  512:  ['#fce4f1', '#d6338f'],
  1024: ['#e9e4ff', '#7048e8']
};
const colorsOf = (val) => COLORS[val] || ['#ffe3e3', '#e03131'];

function text(g, t, x, y, weight, size, color) {
  g.save();
  g.font = weight + ' ' + size + 'px ' + FONT_UI;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(t, x, y);
  g.restore();
}

/* ================================================================
   预渲染：底色 + 棋盘外框 + 空格子 + 右侧面板底板
   （空格子的数量随难度变，换难度会重画一次）
   ================================================================ */
export function makeBackground(L, n) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const grad = g.createLinearGradient(0, 0, 0, L.H);
  grad.addColorStop(0, '#fff9f0');
  grad.addColorStop(1, '#fff1e2');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);

  // 棋盘外框
  rr(g, L.BX - 14, L.BY - 14, L.BOARD + 28, L.BOARD + 28, 26);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#f5dfc4';
  g.stroke();

  // 空格子
  const t = L.BOARD / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      rr(g, L.BX + x * t + 3, L.BY + y * t + 3, t - 6, t - 6, t * 0.12);
      g.fillStyle = '#f7efe2';
      g.fill();
    }
  }

  // 右侧面板
  rr(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 26);
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fill();
  g.stroke();

  text(g, '合成路线', PANEL.x + PANEL.w / 2, PANEL.y + 30, '800', 18, '#c77b2a');
  return canvas;
}

/* ================================================================
   每帧绘制
   ================================================================ */
export function draw(ctx, S, L) {
  ctx.drawImage(S.bg, 0, 0, L.W, L.H);

  drawChain(ctx, S);
  drawGhosts(ctx, S, L);
  drawTiles(ctx, S, L);

  if (S.phase === 'win') drawWin(ctx, S, L);
  if (S.phase === 'over') drawOver(ctx, S, L);
}

/** 右侧合成路线：合出过的数字点亮 */
function drawChain(ctx, S) {
  let max = 0;
  for (const t of S.tiles) max = Math.max(max, t.val);

  const cx = PANEL.x + PANEL.w / 2;
  const w = PANEL.w - 48;
  let y = PANEL.y + 52;

  for (let val = 2; val <= 1024; val *= 2) {
    const [bg, fg] = colorsOf(val);
    const lit = val <= max;

    ctx.save();
    ctx.globalAlpha = lit ? 1 : 0.35;
    rr(ctx, cx - w / 2, y, w, 28, 9);
    ctx.fillStyle = bg;
    ctx.fill();
    text(ctx, String(val), cx, y + 15, '800', 16, fg);
    ctx.restore();

    y += 35;
  }
}

function drawTiles(ctx, S, L) {
  const t = L.BOARD / S.n;
  for (const tile of S.tiles) drawTile(ctx, tile, t, false);
}

function drawTile(ctx, tile, t, ghost, alpha) {
  const [bg, fg] = colorsOf(tile.val);
  const r = Math.max(6, t * 0.12);
  const scale = ghost ? 1 : (1 + tile.pop * 0.12) * (1 - tile.born * 0.55);
  const gap = Math.max(2, Math.round(t * 0.03));

  ctx.save();
  if (ghost) ctx.globalAlpha = alpha;
  ctx.translate(tile.x + t / 2, tile.y + t / 2);
  ctx.scale(scale, scale);

  const w = t - gap;
  rr(ctx, -w / 2, -w / 2, w, w, r);
  ctx.shadowColor = 'rgba(160,100,40,.25)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = 'rgba(0,0,0,.05)';
  ctx.lineWidth = 1.5;
  rr(ctx, -w / 2, -w / 2, w, w, r);
  ctx.stroke();

  const digits = String(tile.val).length;
  const size = t * (digits <= 2 ? 0.44 : digits === 3 ? 0.36 : 0.29);
  text(ctx, String(tile.val), 0, 1, '800', Math.round(size), fg);

  ctx.restore();
}

/** 被合并吸收的滑块：一边滑向合并点一边淡出 */
function drawGhosts(ctx, S, L) {
  const t = L.BOARD / S.n;
  for (const g of S.ghosts) {
    drawTile(ctx, g, t, true, Math.max(0, 1 - g.t / 0.22));
  }
}

function drawWin(ctx, S, L) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '800 50px ' + FONT_UI;
  ctx.fillStyle = '#e8590c';
  ctx.fillText('合出 1024 啦！', L.W / 2, 168);

  avatar.hero(ctx, L.W / 2 - 62, 244, 30, { ringW: 4 });
  ctx.font = '46px ' + FONT_EMOJI;
  ctx.fillText('🎉', L.W / 2, 246);
  avatar.hero(ctx, L.W / 2 + 62, 244, 30, { ringW: 4 });

  ctx.font = '800 25px ' + FONT_UI;
  ctx.fillStyle = '#2b3550';
  ctx.fillText('得分 ' + S.score, L.W / 2, 322);

  ctx.font = '700 20px ' + FONT_UI;
  ctx.fillStyle = '#8b7f95';
  ctx.fillText('还能继续合，冲一冲 2048！', L.W / 2, 366);
  ctx.restore();
}

function drawOver(ctx, S, L) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.86)';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '800 46px ' + FONT_UI;
  ctx.fillStyle = '#f08c00';
  ctx.fillText('棋盘满啦！', L.W / 2, 158);

  avatar.hero(ctx, L.W / 2, 244, 34, { ringW: 4 });

  ctx.font = '800 30px ' + FONT_UI;
  ctx.fillStyle = '#2b3550';
  ctx.fillText('得分 ' + S.score, L.W / 2, 330);

  ctx.font = '700 20px ' + FONT_UI;
  ctx.fillStyle = '#7a849e';
  ctx.fillText('最大合到 ' + S.tiles.reduce((m, t) => Math.max(m, t.val), 0) + ' · 最好成绩 ' + S.best, L.W / 2, 372);

  ctx.font = '800 22px ' + FONT_UI;
  ctx.fillStyle = '#e8590c';
  ctx.fillText('点一下 / 按方向键，再来一局！', L.W / 2, 428);
  ctx.restore();
}
