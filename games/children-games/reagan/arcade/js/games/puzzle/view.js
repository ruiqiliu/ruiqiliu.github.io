/* =====================================================================
   games/puzzle/view.js — 头像拼图 · UI 层
   拼图块 = 圆角裁切 + 按「家」的位置从原图上取对应那一小块；
   右侧小面板常驻一张原图参照，按住 👀 还能把原图放大铺满棋盘。
   ===================================================================== */
import { rr, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="d3">3×3</button>' +
    '<button class="pad" data-act="d4">4×4</button>' +
    '<button class="pad" data-act="d5">5×5</button>' +
    '<button class="pad wide" data-act="peek">👀 看原图</button>' +
  '</div>';

export const HINT =
  '点一块，再点另一块，两块就交换（拖着走也行）· ' +
  '<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 换难度 · ' +
  '按住 <kbd>P</kbd> 看原图 · 拼完整张照片就赢啦';

export function hud(S) {
  return [
    ['难度', S.n + '×' + S.n],
    ['步数', S.moves],
    ['拼对', S.correct + '/' + S.n * S.n],
    ['最佳', S.best ? S.best + ' 步' : '—']
  ];
}

/* 右侧小面板（静态底板和每帧绘制共用同一套坐标） */
const PANEL = { x: 546, y: 60, w: 204, h: 440 };
const THUMB = { x: PANEL.x + 22, y: 232, w: 160, h: 160 };

function text(g, t, x, y, weight, size, color) {
  g.save();
  g.font = weight + ' ' + size + 'px ' + FONT_UI;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(t, x, y);
  g.restore();
}

/** 本局主角的原图（方形照片）。没解码好时 ok=false，画占位色块 */
function heroImage() {
  const im = avatar.heroImg();
  return { im, ok: !!(im && im.complete && im.naturalWidth > 0) };
}

/* ================================================================
   预渲染：底色 + 拼图板外框 + 右侧面板底板
   ================================================================ */
export function makeBackground(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const grad = g.createLinearGradient(0, 0, 0, L.H);
  grad.addColorStop(0, '#fdf2f8');
  grad.addColorStop(1, '#f3edff');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);

  // 拼图板外框
  rr(g, L.BX - 14, L.BY - 14, L.BOARD + 28, L.BOARD + 28, 26);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#f3d7e6';
  g.stroke();

  // 右侧小面板
  rr(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 26);
  g.fillStyle = 'rgba(255,255,255,.78)';
  g.fill();
  g.stroke();

  return canvas;
}

/* ================================================================
   每帧绘制
   ================================================================ */
export function draw(ctx, S, L) {
  ctx.drawImage(S.bg, 0, 0, L.W, L.H);

  drawPanel(ctx);
  drawTiles(ctx, S, L);
  drawPeek(ctx, S, L);

  if (S.phase === 'win') drawWin(ctx, S, L);
}

/** 右侧小面板：主角头像 + 常驻原图参照 */
function drawPanel(ctx) {
  const cx = PANEL.x + PANEL.w / 2;
  const { im, ok } = heroImage();

  avatar.hero(ctx, cx, 134, 44, { ringW: 4 });
  text(ctx, '拼一拼自己', cx, 198, '700', 16, '#b06a92');

  rr(ctx, THUMB.x - 5, THUMB.y - 5, THUMB.w + 10, THUMB.h + 10, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#f3d7e6';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  rr(ctx, THUMB.x, THUMB.y, THUMB.w, THUMB.h, 12);
  ctx.clip();
  if (ok) ctx.drawImage(im, THUMB.x, THUMB.y, THUMB.w, THUMB.h);
  else {
    ctx.fillStyle = '#ffd9c0';
    ctx.fillRect(THUMB.x, THUMB.y, THUMB.w, THUMB.h);
  }
  ctx.restore();

  text(ctx, '原图', cx, THUMB.y + THUMB.h + 26, '700', 15, '#b06a92');
  text(ctx, '长按 👀 看大图', cx, THUMB.y + THUMB.h + 52, '400', 13, '#c29aab');
}

function drawTiles(ctx, S, L) {
  const { im, ok } = heroImage();
  const t = L.BOARD / S.n;
  const gap = Math.max(2, Math.round(t * 0.035));
  const drag = S.press && S.press.moved ? S.press.home : -1;

  for (let k = 0; k < S.cells.length; k++) {
    const home = S.cells[k];
    if (home === drag) continue;   // 拖着的那块最后画，压在其他块上面
    drawTile(ctx, S, im, ok, home, t, gap, false);
  }
  if (drag >= 0) drawTile(ctx, S, im, ok, drag, t, gap, true);
}

function drawTile(ctx, S, im, ok, home, t, gap, dragging) {
  const a = S.anim[home];
  const cell = S.pos[home];
  const correct = cell === home;
  const selected = S.sel === cell;
  const w = t - gap;
  const r = Math.max(6, t * 0.1);
  const s = 1 + a.pop * 0.06 + (dragging ? 0.05 : 0);

  ctx.save();
  ctx.translate(a.x + t / 2, a.y + t / 2);
  ctx.scale(s, s);

  // 白底 + 阴影：拖动 / 选中时浮起来
  ctx.save();
  rr(ctx, -w / 2, -w / 2, w, w, r);
  ctx.shadowColor = dragging || selected ? 'rgba(170,80,120,.38)' : 'rgba(170,80,120,.22)';
  ctx.shadowBlur = dragging ? 22 : selected ? 14 : 9;
  ctx.shadowOffsetY = dragging ? 8 : selected ? 5 : 3;
  ctx.fillStyle = ok ? '#ffffff' : '#ffd9c0';
  ctx.fill();
  ctx.restore();

  if (ok) {
    ctx.save();
    rr(ctx, -w / 2, -w / 2, w, w, r);
    ctx.clip();
    const side = Math.min(im.naturalWidth, im.naturalHeight);
    const ox = (im.naturalWidth - side) / 2;
    const oy = (im.naturalHeight - side) / 2;
    const sx = ox + (home % S.n) * (side / S.n);
    const sy = oy + Math.floor(home / S.n) * (side / S.n);
    ctx.drawImage(im, sx, sy, side / S.n, side / S.n, -w / 2, -w / 2, w, w);
    ctx.restore();
  }

  if (selected) {
    rr(ctx, -w / 2 + 2, -w / 2 + 2, w - 4, w - 4, Math.max(4, r - 2));
    ctx.strokeStyle = '#ff6fa5';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // 已经回家的块打个绿勾，小朋友一眼能看出进度
  if (correct && S.phase === 'play' && S.peek < 0.4) {
    const br = Math.max(8, t * 0.13);
    ctx.beginPath();
    ctx.arc(w / 2 - br, w / 2 - br, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(105,219,124,.95)';
    ctx.fill();
    ctx.font = '800 ' + Math.round(br * 1.4) + 'px ' + FONT_UI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('✓', w / 2 - br, w / 2 - br + 1);
  }

  ctx.restore();
}

/** 按住 👀 时把原图铺满棋盘 */
function drawPeek(ctx, S, L) {
  if (S.peek <= 0.01 || S.phase === 'win') return;
  const { im, ok } = heroImage();

  ctx.save();
  ctx.globalAlpha = S.peek;
  rr(ctx, L.BX, L.BY, L.BOARD, L.BOARD, 16);
  ctx.clip();
  if (ok) ctx.drawImage(im, L.BX, L.BY, L.BOARD, L.BOARD);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(L.BX, L.BY, L.BOARD, L.BOARD);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = S.peek;
  rr(ctx, L.BX + 14, L.BY + 14, 92, 38, 19);
  ctx.fillStyle = 'rgba(230,73,128,.85)';
  ctx.fill();
  text(ctx, '原图', L.BX + 60, L.BY + 34, '800', 19, '#ffffff');
  ctx.restore();
}

function drawWin(ctx, S, L) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '800 52px ' + FONT_UI;
  ctx.fillStyle = '#e64980';
  ctx.fillText('拼好啦！', L.W / 2, 168);

  avatar.hero(ctx, L.W / 2 - 62, 244, 30, { ringW: 4 });
  ctx.font = '46px ' + FONT_EMOJI;
  ctx.fillText('🎉', L.W / 2, 246);
  avatar.hero(ctx, L.W / 2 + 62, 244, 30, { ringW: 4 });

  ctx.font = '800 25px ' + FONT_UI;
  ctx.fillStyle = '#2b3550';
  ctx.fillText('用了 ' + S.moves + ' 步拼好 ' + S.n + '×' + S.n, L.W / 2, 322);

  ctx.font = '700 20px ' + FONT_UI;
  ctx.fillStyle = S.record ? '#f08c00' : '#8b7f95';
  ctx.fillText(S.record ? '🏆 新纪录！' : '（最佳 ' + S.best + ' 步）', L.W / 2, 366);

  ctx.font = '400 16px ' + FONT_UI;
  ctx.fillStyle = '#a08aa8';
  ctx.fillText('马上再来一张…', L.W / 2, 412);
  ctx.restore();
}
