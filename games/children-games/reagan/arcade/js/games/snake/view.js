/* =====================================================================
   games/snake/view.js — 贪吃蛇 · UI 层
   ===================================================================== */
import { TAU, rr, shade, FONT_UI, FONT_EMOJI, FONT_MONO } from '../../core/util.js';
import { surface } from '../../core/surface.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>';

export const HINT =
  '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 控制方向 · ' +
  '也可以在屏幕上滑动 · 撞墙会从另一边穿出来';

export function hud(S) {
  return [
    ['得分', S.score],
    ['长度', S.snake.length],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—']
  ];
}

/** 预渲染棋盘：薄荷绿背景 + 白色圆角棋盘 + 浅格子 */
export function makeBackground(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const grad = g.createLinearGradient(0, 0, L.W, L.H);
  grad.addColorStop(0, '#eafff2');
  grad.addColorStop(1, '#d8f6e6');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);

  rr(g, L.PAD - 6, L.PAD - 6, L.N * L.CELL + 12, L.N * L.CELL + 12, 20);
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = '#b7ebcb';
  g.lineWidth = 4;
  g.stroke();

  g.save();
  rr(g, L.PAD, L.PAD, L.N * L.CELL, L.N * L.CELL, 14);
  g.clip();
  for (let y = 0; y < L.N; y++) {
    for (let x = 0; x < L.N; x++) {
      if ((x + y) % 2 === 0) continue;
      g.fillStyle = 'rgba(140,220,175,.16)';
      g.fillRect(L.PAD + x * L.CELL, L.PAD + y * L.CELL, L.CELL, L.CELL);
    }
  }
  g.restore();

  return canvas;
}

export function draw(ctx, S, L) {
  ctx.drawImage(S.tiles, 0, 0, L.W, L.H);
  drawFood(ctx, S, L);
  drawSnake(ctx, S, L);
  drawGameOver(ctx, S, L);
}

/* ---------------------------------------------------------------- */

function drawFood(ctx, S, L) {
  const f = S.food;
  if (!f) return;

  const cx = L.PAD + f.x * L.CELL + L.CELL / 2;
  const cy = L.PAD + f.y * L.CELL + L.CELL / 2;
  const s = 1 + Math.sin(S.T * 5) * 0.09;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '30px ' + FONT_EMOJI;
  ctx.fillText(f.emo, 0, 2);
  ctx.restore();

  // 金色星星食物：加一圈会呼吸的光晕，让孩子一眼看出是「大奖」
  if (f.star) {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(S.T * 7) * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, L.CELL * 0.46, 0, TAU);
    ctx.fillStyle = 'rgba(255,212,59,.55)';
    ctx.fill();
    ctx.restore();
  }
}

function drawSnake(ctx, S, L) {
  for (let i = S.snake.length - 1; i >= 0; i--) {
    const s = S.snake[i];
    const x = L.PAD + s.x * L.CELL;
    const y = L.PAD + s.y * L.CELL;
    const head = i === 0;
    const t = 1 - i / Math.max(1, S.snake.length);
    const col = head
      ? '#2f9e44'
      : i % 2
        ? shade('#40c057', t * 0.35)
        : shade('#37b24d', t * 0.35);

    ctx.save();
    if (head) {
      ctx.shadowColor = 'rgba(47,158,68,.5)';
      ctx.shadowBlur = 14;
    }
    rr(ctx, x + 2, y + 2, L.CELL - 4, L.CELL - 4, head ? 14 : 11);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();

    rr(ctx, x + 7, y + 6, L.CELL - 14, 7, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fill();

    if (head) drawHeadFace(ctx, L, x, y, S.dir);
  }
}

/** 蛇头的眼睛和信子，朝向跟随移动方向 */
function drawHeadFace(ctx, L, x, y, dir) {
  const ex = dir.x;
  const ey = dir.y;
  const cx = x + L.CELL / 2;
  const cy = y + L.CELL / 2;

  const eyes = [
    { x: cx + (ey !== 0 ? -8 : ex * 5), y: cy + (ex !== 0 ? -8 : ey * 5) },
    { x: cx + (ey !== 0 ? 8 : ex * 5), y: cy + (ex !== 0 ? 8 : ey * 5) }
  ];
  for (const p of eyes) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x + ex * 1.7, p.y + ey * 1.7, 2.6, 0, TAU);
    ctx.fillStyle = '#1b2733';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(cx + ex * 12, cy + ey * 12);
  ctx.lineTo(cx + ex * 20, cy + ey * 20);
  ctx.strokeStyle = '#ff6b81';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawGameOver(ctx, S, L) {
  if (!S.over) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '800 42px ' + FONT_UI;
  ctx.fillStyle = '#2f9e44';
  ctx.fillText('玩得真棒！', L.W / 2, L.H / 2 - 100);

  ctx.font = '64px ' + FONT_EMOJI;
  ctx.fillText('🐍', L.W / 2, L.H / 2 - 24);

  ctx.font = '800 30px ' + FONT_MONO;
  ctx.fillStyle = '#2b3550';
  ctx.fillText('吃到 ' + S.score + ' 个水果', L.W / 2, L.H / 2 + 52);

  ctx.font = '700 20px ' + FONT_UI;
  ctx.fillStyle = '#7a849e';
  ctx.fillText('最好成绩 ' + Math.max(S.best, S.score), L.W / 2, L.H / 2 + 92);

  ctx.font = '800 22px ' + FONT_UI;
  ctx.fillStyle = '#e8590c';
  ctx.fillText('按 空格 或点击屏幕，再玩一次！', L.W / 2, L.H / 2 + 146);
  ctx.restore();
}
