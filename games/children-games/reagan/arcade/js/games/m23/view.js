/* =====================================================================
   games/m23/view.js — 2和3 · UI 层
   两条数字链两种色系：2 链蓝 → 紫，3 链橙 → 红，一眼分得清
   「这个 4 是哪条链的」。右侧面板显示当前最大方块和链条示意。
   ===================================================================== */
import { TAU, rr, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';
import { avatar } from '../../core/avatar.js';

/* 五种棋盘模式（game.js 也用这份定义）：
   大方阵 → 天窗 → 经典 → 十字 → 小方阵，越往后格子越少越挤 */
export const MODES = [
  { name: '大方阵', size: 5 },                                        // 25 格
  { name: '天窗', size: 5, holes: [[0, 0], [4, 0], [0, 4], [4, 4]] }, // 21 格
  { name: '经典', size: 4 },                                          // 16 格
  { name: '十字', size: 5, cross: true },                             // 9 格
  { name: '小方阵', size: 3 }                                         // 9 格
];

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>' +
  '<div class="row">' +
    MODES.map((m, i) => '<button class="pad" data-act="m' + (i + 1) + '">' + m.name + '</button>').join('') +
  '</div>';

export const HINT =
  '方向键 / WASD 滑动，相同的 2 和 3 各自翻倍（2 撞 2、3 撞 3）· ' +
  '<kbd>1</kbd>~<kbd>5</kbd> 换棋盘 · 数字没有上限 · 卡住了有爱心救场';

export function hud(S) {
  return [
    ['模式', MODES[S.mode].name],
    ['得分', S.score],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—'],
    ['最佳', S.best]
  ];
}

/* 右侧小面板（静态底板和每帧绘制共用同一套坐标） */
const PANEL = { x: 546, y: 60, w: 204, h: 440 };

function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 两个 hex 颜色之间插值 */
function mix(a, b, k) {
  const ca = hex2rgb(a), cb = hex2rgb(b);
  return 'rgb(' + ca.map((c, i) => Math.round(c * (1 - k) + cb[i] * k)).join(',') + ')';
}

/** 数值 → [底色, 文字色]。2 链蓝→紫，3 链橙→红，越大越深 */
function colorsOf(val) {
  const is3 = val % 3 === 0;
  const e = Math.round(Math.log2(val / (is3 ? 3 : 1)));
  const k = Math.min(1, e / 9);
  return is3
    ? [mix('#ffedd9', '#ffd3d3', k), mix('#e8590c', '#c92a2a', k)]
    : [mix('#e7f2ff', '#e5dbff', k), mix('#4d94f0', '#7048e8', k)];
}

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
   ================================================================ */
export function makeBackground(L, mask, size) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const grad = g.createLinearGradient(0, 0, 0, L.H);
  grad.addColorStop(0, '#fbf9ff');
  grad.addColorStop(1, '#f1ecfb');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);

  // 棋盘外框
  rr(g, L.BX - 14, L.BY - 14, L.BOARD + 28, L.BOARD + 28, 26);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#ddd0f2';
  g.stroke();

  // 空格子（挖空的形状一目了然）
  const t = L.BOARD / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!mask[y][x]) continue;
      rr(g, L.BX + x * t + 3, L.BY + y * t + 3, t - 6, t - 6, t * 0.12);
      g.fillStyle = '#efe9f8';
      g.fill();
    }
  }

  // 右侧面板
  rr(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 26);
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fill();
  g.stroke();

  text(g, '当前最大', PANEL.x + PANEL.w / 2, PANEL.y + 30, '800', 18, '#7a4fc9');
  return canvas;
}

/* ================================================================
   每帧绘制
   ================================================================ */
export function draw(ctx, S, L) {
  ctx.drawImage(S.bg, 0, 0, L.W, L.H);

  drawPanel(ctx, S);
  drawGhosts(ctx, S, L);
  drawTiles(ctx, S, L);

  if (S.phase === 'over') drawOver(ctx, S, L);
}

function drawPanel(ctx, S) {
  const cx = PANEL.x + PANEL.w / 2;
  const max = S.tiles.reduce((m, t) => Math.max(m, t.val), 0);

  // 当前最大方块
  if (max > 0) {
    const [bg, fg] = colorsOf(max);
    rr(ctx, PANEL.x + 20, PANEL.y + 52, PANEL.w - 40, 104, 16);
    ctx.fillStyle = bg;
    ctx.fill();
    const digits = String(max).length;
    text(ctx, String(max), cx, PANEL.y + 104, '800',
      digits <= 2 ? 46 : digits === 3 ? 40 : digits === 4 ? 34 : 28, fg);
  } else {
    rr(ctx, PANEL.x + 20, PANEL.y + 52, PANEL.w - 40, 104, 16);
    ctx.fillStyle = '#efe9f8';
    ctx.fill();
  }

  text(ctx, '相同的数字撞在一起就翻倍', cx, PANEL.y + 190, '700', 15, '#7a4fc9');
  text(ctx, '数字没有上限，越大越难', cx, PANEL.y + 214, '400', 13, '#a794c8');

  // 两条数字链
  const chain = (y, dot, label, vals) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(PANEL.x + 30, y, 6, 0, TAU);
    ctx.fillStyle = dot;
    ctx.fill();
    ctx.font = '700 14px ' + FONT_UI;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5f4b8b';
    ctx.fillText(label, PANEL.x + 46, y);
    ctx.restore();
  };
  chain(PANEL.y + 262, '#4d94f0', '2 链：2 4 8 16 32 …');
  chain(PANEL.y + 292, '#e8590c', '3 链：3 6 12 24 48 …');

  text(ctx, '4 和 6 是邻居，', cx, PANEL.y + 340, '400', 13, '#a794c8');
  text(ctx, '但它们永远合不了哦', cx, PANEL.y + 360, '400', 13, '#a794c8');

  text(ctx, '卡住了会自动爱心救场', cx, PANEL.y + 404, '400', 13, '#b7a6d6');
}

function drawTiles(ctx, S, L) {
  const t = L.BOARD / S.size;
  for (const tile of S.tiles) drawTile(ctx, tile, t, false, 1);
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
  ctx.shadowColor = 'rgba(90,60,140,.25)';
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
  const size = t * (digits <= 2 ? 0.44 : digits === 3 ? 0.36 : digits === 4 ? 0.29 : 0.24);
  text(ctx, String(tile.val), 0, 1, '800', Math.round(size), fg);

  ctx.restore();
}

/** 被合并吸收的滑块：一边滑向合并点一边淡出 */
function drawGhosts(ctx, S, L) {
  const t = L.BOARD / S.size;
  for (const g of S.ghosts) {
    drawTile(ctx, g, t, true, Math.max(0, 1 - g.t / 0.22));
  }
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

  const max = S.tiles.reduce((m, t) => Math.max(m, t.val), 0);
  ctx.font = '700 20px ' + FONT_UI;
  ctx.fillStyle = '#7a849e';
  ctx.fillText('最大合到 ' + max + ' · 最好成绩 ' + S.best, L.W / 2, 372);

  ctx.font = '800 22px ' + FONT_UI;
  ctx.fillStyle = '#7048e8';
  ctx.fillText('点一下 / 按方向键，再来一局！', L.W / 2, 428);
  ctx.restore();
}
