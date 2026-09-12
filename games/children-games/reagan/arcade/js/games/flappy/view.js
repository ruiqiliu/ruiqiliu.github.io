/* =====================================================================
   games/flappy/view.js — 小鸟飞飞 · UI 层
   ===================================================================== */
import { TAU, clamp, rr, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad wide" data-act="flap">🪽 拍翅膀</button>' +
  '</div>';

export const HINT =
  '<kbd>空格</kbd> 或 <kbd>↑</kbd> 拍翅膀 · 也可以直接点屏幕 · ' +
  '撞到管子会掉一颗爱心，还有两次机会';

export function hud(S) {
  return [
    ['得分', S.score],
    ['最好', S.best],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—']
  ];
}

/** 预渲染：天空 + 太阳 + 远山（地面和云是动的，每帧现画） */
export function makeBackground(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const grad = g.createLinearGradient(0, 0, 0, L.GROUND_Y);
  grad.addColorStop(0, '#6ec6ff');
  grad.addColorStop(0.55, '#a8ddff');
  grad.addColorStop(1, '#e8f7ff');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.GROUND_Y);

  // 太阳
  const sg = g.createRadialGradient(120, 84, 8, 120, 84, 92);
  sg.addColorStop(0, 'rgba(255,246,190,1)');
  sg.addColorStop(0.4, 'rgba(255,236,150,.5)');
  sg.addColorStop(1, 'rgba(255,236,150,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.arc(120, 84, 92, 0, TAU);
  g.fill();

  // 远山
  const hill = (x, w, h, col) => {
    g.beginPath();
    g.moveTo(x - w, L.GROUND_Y);
    g.quadraticCurveTo(x - w * 0.3, L.GROUND_Y - h * 1.3, x, L.GROUND_Y - h);
    g.quadraticCurveTo(x + w * 0.3, L.GROUND_Y - h * 1.3, x + w, L.GROUND_Y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  };
  hill(180, 230, 120, '#a7e0b4');
  hill(470, 300, 160, '#8fd6a2');
  hill(760, 220, 100, '#b6e8c0');
  hill(330, 170, 78, '#c3edd0');

  return canvas;
}

export function draw(ctx, S, L) {
  ctx.drawImage(S.bg, 0, 0, L.W, L.H);

  drawClouds(ctx, S, L);
  drawPipes(ctx, S, L);
  drawCoins(ctx, S, L);
  drawGround(ctx, S, L);
  drawBird(ctx, S, L);
  drawOverlay(ctx, S, L);
}

/* ---------------------------------------------------------------- */

function drawClouds(ctx, S, L) {
  const clouds = [
    { x: 120, y: 96, s: 1.0, a: 0.9 },
    { x: 430, y: 60, s: 0.7, a: 0.75 },
    { x: 660, y: 140, s: 0.85, a: 0.8 },
    { x: 900, y: 80, s: 0.6, a: 0.6 }
  ];
  const span = L.W + 320;

  for (const c of clouds) {
    let x = c.x - ((S.pos * 0.22) % span);
    if (x < -160) x += span;

    ctx.save();
    ctx.globalAlpha = c.a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, c.y, 34 * c.s, 0, TAU);
    ctx.arc(x + 40 * c.s, c.y + 6 * c.s, 26 * c.s, 0, TAU);
    ctx.arc(x - 40 * c.s, c.y + 8 * c.s, 24 * c.s, 0, TAU);
    ctx.arc(x + 8 * c.s, c.y - 20 * c.s, 26 * c.s, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** 一根管子（含管口那圈加厚的边缘） */
function drawPipe(ctx, x, y, w, h) {
  if (h <= 0) return;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#4fae4f');
  g.addColorStop(0.26, '#a5eb9f');
  g.addColorStop(0.55, '#54bd54');
  g.addColorStop(1, '#2c7a31');

  ctx.save();
  ctx.shadowColor = 'rgba(30,80,30,.28)';
  ctx.shadowBlur = 10;
  rr(ctx, x, y, w, h, 12);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(20,60,25,.18)';
  ctx.lineWidth = 2.5;
  rr(ctx, x, y, w, h, 12);
  ctx.stroke();
}

function drawPipes(ctx, S, L) {
  for (const p of S.pipes) {
    if (p.x > L.W || p.x + L.PIPE_W < 0) continue;

    const capH = 26;
    const capOver = 7;

    // 上管
    drawPipe(ctx, p.x, 0, L.PIPE_W, p.gapY - capH);
    drawPipe(ctx, p.x - capOver, p.gapY - capH, L.PIPE_W + capOver * 2, capH);

    // 下管
    const below = L.GROUND_Y - (p.gapY + p.gap);
    drawPipe(ctx, p.x, p.gapY + p.gap, L.PIPE_W, below - capH);
    drawPipe(ctx, p.x - capOver, p.gapY + p.gap, L.PIPE_W + capOver * 2, capH);
  }
}

function drawCoins(ctx, S, L) {
  for (const p of S.pipes) {
    if (!p.hasCoin || p.coinTaken) continue;
    const x = p.x + L.PIPE_W / 2;
    const y = p.gapY + p.gap / 2 + Math.sin(S.T * 4 + p.x * 0.01) * 8;

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(S.T * 6) * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, TAU);
    ctx.fillStyle = 'rgba(255,212,59,.55)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '30px ' + FONT_EMOJI;
    ctx.fillText('⭐', x, y + 2);
    ctx.restore();
  }
}

function drawGround(ctx, S, L) {
  const y = L.GROUND_Y;

  const g = ctx.createLinearGradient(0, y, 0, L.H);
  g.addColorStop(0, '#8fd96a');
  g.addColorStop(0.22, '#75c94f');
  g.addColorStop(1, '#5aab3c');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, L.W, L.H - y);

  // 草叶：跟着 world 滚动
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#a7e77f';
  const off = S.pos % 44;
  for (let x = -44; x < L.W + 44; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x - off, y + 6);
    ctx.lineTo(x - off + 8, y - 8);
    ctx.lineTo(x - off + 16, y + 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 泥土上的一点斑纹
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#2f5c1f';
  const off2 = S.pos % 60;
  for (let x = -60; x < L.W + 60; x += 60) {
    ctx.beginPath();
    ctx.ellipse(x - off2 + 20, y + 52, 15, 5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBird(ctx, S, L) {
  const b = S.bird;

  // 无敌时间闪烁（看不见的时候也不完全消失，避免小朋友找不到鸟）
  if (S.invul > 0 && Math.floor(S.invul * 12) % 2 === 0) ctx.globalAlpha = 0.35;

  ctx.save();
  ctx.translate(L.BIRD_X, b.y);
  ctx.rotate(clamp(b.vy / 900, -0.55, 1.0));

  // 身体
  const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, L.BIRD_R * 1.5);
  g.addColorStop(0, '#fffdf0');
  g.addColorStop(0.45, '#ffdf4d');
  g.addColorStop(1, '#f0a022');
  ctx.beginPath();
  ctx.ellipse(0, 0, L.BIRD_R * 1.28, L.BIRD_R, 0, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();

  // 尾巴
  ctx.beginPath();
  ctx.moveTo(-L.BIRD_R * 1.1, -2);
  ctx.lineTo(-L.BIRD_R * 1.9, -10);
  ctx.lineTo(-L.BIRD_R * 1.85, 6);
  ctx.closePath();
  ctx.fillStyle = '#f0a022';
  ctx.fill();

  // 翅膀：刚拍完时抬得最高
  const wingT = 1 - clamp(b.wing / 0.25, 0, 1);
  ctx.save();
  ctx.translate(-3, 3);
  ctx.rotate(-0.9 + wingT * 1.7);
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 7, 0, 0, TAU);
  ctx.fillStyle = '#ffb703';
  ctx.fill();
  ctx.restore();

  // 眼睛
  ctx.beginPath();
  ctx.arc(8, -6, 5.4, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9.6, -6, 2.6, 0, TAU);
  ctx.fillStyle = '#20304d';
  ctx.fill();

  // 嘴
  ctx.beginPath();
  ctx.moveTo(13, -1);
  ctx.lineTo(26, 2.5);
  ctx.lineTo(13, 7);
  ctx.closePath();
  ctx.fillStyle = '#ff8c42';
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawOverlay(ctx, S, L) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (S.phase === 'ready') {
    ctx.globalAlpha = 0.75 + Math.sin(S.T * 4) * 0.25;
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    rr(ctx, L.W / 2 - 210, L.GROUND_Y / 2 - 96, 420, 88, 22);
    ctx.fill();

    ctx.font = '800 30px ' + FONT_UI;
    ctx.fillStyle = '#1b6ea8';
    ctx.fillText('点一下 / 按空格 起飞', L.W / 2, L.GROUND_Y / 2 - 64);

    ctx.font = '700 17px ' + FONT_UI;
    ctx.fillStyle = '#3d6b8a';
    ctx.fillText('穿过管子得分，撞到只掉一颗爱心', L.W / 2, L.GROUND_Y / 2 - 26);
  }

  if (S.phase === 'over') {
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.fillRect(0, 0, L.W, L.H);

    ctx.font = '800 46px ' + FONT_UI;
    ctx.fillStyle = '#f08c00';
    ctx.fillText('飞得真棒！', L.W / 2, L.H / 2 - 96);

    ctx.font = '64px ' + FONT_EMOJI;
    ctx.fillText('🐤', L.W / 2, L.H / 2 - 20);

    ctx.font = '800 30px ' + FONT_UI;
    ctx.fillStyle = '#2b3550';
    ctx.fillText('穿过 ' + S.score + ' 根管子', L.W / 2, L.H / 2 + 56);

    ctx.font = '700 20px ' + FONT_UI;
    ctx.fillStyle = '#7a849e';
    ctx.fillText('最好成绩 ' + S.best, L.W / 2, L.H / 2 + 96);

    ctx.font = '800 22px ' + FONT_UI;
    ctx.fillStyle = '#e8590c';
    ctx.fillText('按 空格 或点击屏幕，再飞一次！', L.W / 2, L.H / 2 + 150);
  }

  ctx.restore();
}
