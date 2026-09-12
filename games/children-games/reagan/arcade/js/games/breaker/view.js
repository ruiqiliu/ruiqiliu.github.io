/* =====================================================================
   games/breaker/view.js — 打砖块 · UI 层
   只做两件事：把静态背景预渲染成离屏画布；把状态 S 画到 canvas 上。
   没有任何状态、不修改 S、不读输入。
   ===================================================================== */
import { TAU, rr, rgba, shade, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';

/** 触屏按键（桌面端玩家用键盘，这里给手机留空） */
export const PADS = '';

export const HINT =
  '<kbd>←</kbd> <kbd>→</kbd> 或 <kbd>A</kbd> <kbd>D</kbd> 移动彩虹板 · ' +
  '也可以直接用鼠标／手指拖动 · 球不会掉，放心打';

/** 预渲染：天空 + 太阳 + 云 + 底部弹力地板。每帧只 drawImage，省掉大量渐变计算 */
export function makeBackground(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const grad = g.createLinearGradient(0, 0, 0, L.H);
  grad.addColorStop(0, '#bfe3ff');
  grad.addColorStop(0.5, '#e6f3ff');
  grad.addColorStop(1, '#ffe9f3');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);

  // 太阳
  const sx = L.W - 92;
  const sy = 78;
  const sg = g.createRadialGradient(sx, sy, 10, sx, sy, 96);
  sg.addColorStop(0, 'rgba(255,236,150,.95)');
  sg.addColorStop(0.45, 'rgba(255,236,150,.30)');
  sg.addColorStop(1, 'rgba(255,236,150,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.arc(sx, sy, 96, 0, TAU);
  g.fill();

  // 云
  const cloud = (x, y, s, a, col) => {
    g.save();
    g.globalAlpha = a;
    g.fillStyle = col || '#ffffff';
    g.beginPath();
    g.arc(x, y, 34 * s, 0, TAU);
    g.arc(x + 40 * s, y + 6 * s, 26 * s, 0, TAU);
    g.arc(x - 40 * s, y + 8 * s, 24 * s, 0, TAU);
    g.arc(x + 8 * s, y - 20 * s, 26 * s, 0, TAU);
    g.fill();
    g.restore();
  };
  cloud(150, 116, 1.15, 0.92);
  cloud(590, 168, 0.85, 0.8);
  cloud(370, 74, 0.62, 0.7);
  cloud(730, 300, 0.7, 0.55);
  cloud(70, 300, 0.6, 0.5);

  // 底部弹力地板（球掉下来会被弹回去）
  g.fillStyle = '#ffe0ef';
  g.fillRect(0, L.H - 26, L.W, 26);
  g.fillStyle = '#ffd0e4';
  for (let x = -20; x < L.W + 40; x += 46) {
    g.beginPath();
    g.arc(x + 23, L.H - 26, 22, Math.PI, TAU);
    g.fill();
  }
  const fg = g.createLinearGradient(0, L.H - 40, 0, L.H);
  fg.addColorStop(0, 'rgba(255,255,255,0)');
  fg.addColorStop(1, 'rgba(255,180,215,.35)');
  g.fillStyle = fg;
  g.fillRect(0, L.H - 40, L.W, 40);

  return canvas;
}

export function hud(S) {
  return [['得分', S.score], ['关卡', S.level], ['星星', '⭐' + S.stars]];
}

export function draw(ctx, S, L) {
  ctx.drawImage(S.bg, 0, 0, L.W, L.H);

  drawBricks(ctx, S);
  drawTrail(ctx, S, L);
  drawBall(ctx, S, L);
  drawPaddle(ctx, S, L);
  drawServeHint(ctx, S, L);
  drawClearOverlay(ctx, S, L);
}

/* ---------------------------------------------------------------- */

function drawBricks(ctx, S) {
  for (const b of S.bricks) {
    if (!b.alive) continue;
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, shade(b.c, 0.55));
    g.addColorStop(0.55, b.c);
    g.addColorStop(1, shade(b.c, -0.22));

    ctx.save();
    ctx.shadowColor = rgba(b.c, 0.45);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    rr(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    rr(ctx, b.x + 7, b.y + 5, b.w - 14, 7, 4);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();
  }
}

function drawTrail(ctx, S, L) {
  const trail = S.ball.trail;
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    const a = (i + 1) / trail.length;
    ctx.beginPath();
    ctx.arc(t.x, t.y, L.BR * a * 0.9, 0, TAU);
    ctx.fillStyle = 'rgba(255,214,240,' + (a * 0.5).toFixed(3) + ')';
    ctx.fill();
  }
}

function drawBall(ctx, S, L) {
  const b = S.ball;
  ctx.save();
  ctx.shadowColor = 'rgba(255,120,180,.9)';
  ctx.shadowBlur = 22;
  const g = ctx.createRadialGradient(b.x - 4, b.y - 4, 1, b.x, b.y, L.BR);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#ffe1f0');
  g.addColorStop(1, '#ff9ec7');
  ctx.beginPath();
  ctx.arc(b.x, b.y, L.BR, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function drawPaddle(ctx, S, L) {
  const px = S.paddle.x - L.PADW / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(120,160,255,.55)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  const pg = ctx.createLinearGradient(0, L.PADY, 0, L.PADY + L.PADH);
  pg.addColorStop(0, '#a8d5ff');
  pg.addColorStop(0.45, '#6fb1ff');
  pg.addColorStop(1, '#3f83e8');
  rr(ctx, px, L.PADY, L.PADW, L.PADH, 11);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();

  rr(ctx, px + 10, L.PADY + 4, L.PADW - 20, 6, 3);
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fill();

  // 眼睛（可爱一点）
  for (const ex of [-26, 26]) {
    ctx.beginPath();
    ctx.arc(S.paddle.x + ex, L.PADY + 11, 3.6, 0, TAU);
    ctx.fillStyle = '#20304d';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(S.paddle.x + ex + 1.2, L.PADY + 10, 1.3, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

function drawServeHint(ctx, S, L) {
  if (S.served || S.phase !== 'play') return;
  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(S.T * 6) * 0.35;
  ctx.textAlign = 'center';
  ctx.font = '700 20px ' + FONT_UI;
  ctx.fillStyle = '#e0508f';
  ctx.fillText('准备……', L.W / 2, L.PADY - 64);
  ctx.restore();
}

function drawClearOverlay(ctx, S, L) {
  if (S.phase !== 'clear') return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.fillRect(0, 0, L.W, L.H);

  ctx.font = '800 56px ' + FONT_UI;
  ctx.fillStyle = '#ff7aa8';
  ctx.fillText('太棒了！', L.W / 2, L.H / 2 - 46);

  ctx.font = '60px ' + FONT_EMOJI;
  ctx.fillText('🌟 🎉 🌟', L.W / 2, L.H / 2 + 34);

  ctx.font = '700 22px ' + FONT_UI;
  ctx.fillStyle = '#4a5578';
  ctx.fillText('第 ' + (S.level + 1) + ' 关来啦', L.W / 2, L.H / 2 + 104);
  ctx.restore();
}
