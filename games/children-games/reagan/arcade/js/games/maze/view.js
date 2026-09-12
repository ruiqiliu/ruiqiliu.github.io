/* =====================================================================
   games/maze/view.js — 迷宫探险 · UI 层
   墙体用「把所有存在的边连成一条路径，再描两遍」的办法画：
   粗一点的一遍当描边，细一点的一遍当墙身，拐角天然是圆的。
   ===================================================================== */
import { TAU, rr, lerp, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>' +
  '<button class="pad wide" data-act="hint">💡 提示</button>';

export const HINT =
  '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走路 · ' +
  '<kbd>H</kbd> 看提示路线（每关 3 次）· 走到小旗子就过关';

export function hud(S) {
  return [
    ['关卡', S.level],
    ['星星', S.starCount],
    ['提示', S.hints + ' 次']
  ];
}

const cellCX = (maze, x) => maze.ox + (x + 0.5) * maze.cell;
const cellCY = (maze, y) => maze.oy + (y + 0.5) * maze.cell;

/* ================================================================
   预渲染：地板 + 墙体
   ================================================================ */
export function makeBackground(maze, L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);
  const { cols, rows, cell, ox, oy, cells } = maze;
  const w = cols * cell;
  const h = rows * cell;

  const grad = g.createLinearGradient(0, 0, 0, L.H);
  grad.addColorStop(0, '#f3f9ff');
  grad.addColorStop(1, '#e4eeff');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);

  // 迷宫底板
  rr(g, ox - 10, oy - 10, w + 20, h + 20, 20);
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = '#dbe7ff';
  g.lineWidth = 3;
  g.stroke();

  // 交替格子，让空间层次更清楚
  g.save();
  rr(g, ox, oy, w, h, 12);
  g.clip();
  for (const c of cells) {
    if ((c.x + c.y) % 2) continue;
    g.fillStyle = 'rgba(120,170,255,.07)';
    g.fillRect(ox + c.x * cell, oy + c.y * cell, cell, cell);
  }
  g.restore();

  // 墙体
  g.beginPath();
  for (const c of cells) {
    const x0 = ox + c.x * cell;
    const y0 = oy + c.y * cell;
    const x1 = x0 + cell;
    const y1 = y0 + cell;

    if (c.n) { g.moveTo(x0, y0); g.lineTo(x1, y0); }
    if (c.w) { g.moveTo(x0, y0); g.lineTo(x0, y1); }
    if (c.y === rows - 1 && c.s) { g.moveTo(x0, y1); g.lineTo(x1, y1); }
    if (c.x === cols - 1 && c.e) { g.moveTo(x1, y0); g.lineTo(x1, y1); }
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const wallW = Math.max(4, Math.min(L.WALL, cell * 0.16));

  g.lineWidth = wallW + 3;
  g.strokeStyle = '#a9c2f2';
  g.stroke();

  g.lineWidth = wallW;
  g.strokeStyle = '#4f74c9';
  g.stroke();

  return canvas;
}

/* ================================================================
   每帧绘制
   ================================================================ */
export function draw(ctx, S, L) {
  const maze = S.maze;
  ctx.drawImage(S.bg, 0, 0, L.W, L.H);

  drawWalked(ctx, S, maze);
  drawHint(ctx, S, maze);
  drawCoins(ctx, S, maze);
  drawStartAndGoal(ctx, maze);
  drawPlayer(ctx, S, maze);

  if (S.phase === 'win') drawWin(ctx, S, L);
}

/** 走过的格子染成淡蓝色，小朋友不会一直在原地绕圈 */
function drawWalked(ctx, S, maze) {
  const pad = maze.cell * 0.18;
  ctx.fillStyle = 'rgba(91,157,255,.20)';
  for (const c of maze.cells) {
    if (!c.walked) continue;
    rr(ctx, maze.ox + c.x * maze.cell + pad, maze.oy + c.y * maze.cell + pad,
       maze.cell - pad * 2, maze.cell - pad * 2, maze.cell * 0.22);
    ctx.fill();
  }
}

function drawHint(ctx, S, maze) {
  if (S.hintT <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, S.hintT) * 0.9;
  ctx.strokeStyle = '#ff9f43';
  ctx.lineWidth = Math.max(4, maze.cell * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([maze.cell * 0.24, maze.cell * 0.22]);

  ctx.beginPath();
  S.maze.path.forEach((c, i) => {
    const x = cellCX(maze, c.x);
    const y = cellCY(maze, c.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawCoins(ctx, S, maze) {
  for (const k of S.coins) {
    if (k.taken) continue;
    const x = cellCX(maze, k.x);
    const y = cellCY(maze, k.y) + Math.sin(S.T * 4 + k.x) * maze.cell * 0.06;

    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(S.T * 6) * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, maze.cell * 0.32, 0, TAU);
    ctx.fillStyle = 'rgba(255,212,59,.6)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = Math.round(maze.cell * 0.5) + 'px ' + FONT_EMOJI;
    ctx.fillText('⭐', x, y + 1);
    ctx.restore();
  }
}

function drawStartAndGoal(ctx, maze) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.globalAlpha = 0.42;
  ctx.font = Math.round(maze.cell * 0.46) + 'px ' + FONT_EMOJI;
  ctx.fillText('🏠', cellCX(maze, 0), cellCY(maze, 0));

  ctx.globalAlpha = 1;
  ctx.font = Math.round(maze.cell * 0.62) + 'px ' + FONT_EMOJI;
  ctx.fillText('🏁', cellCX(maze, maze.cols - 1), cellCY(maze, maze.rows - 1) + 1);
  ctx.restore();
}

function drawPlayer(ctx, S, maze) {
  // 两格之间做一段平滑位移，不是瞬移
  const e = 1 - (1 - S.prog) * (1 - S.prog);
  const x = lerp(cellCX(maze, S.from.x), cellCX(maze, S.player.x), e);
  const y = lerp(cellCY(maze, S.from.y), cellCY(maze, S.player.y), e);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.ellipse(x, y + maze.cell * 0.24, maze.cell * 0.3, maze.cell * 0.12, 0, 0, TAU);
  ctx.fillStyle = '#22315a';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = Math.round(maze.cell * 0.68) + 'px ' + FONT_EMOJI;
  ctx.fillText('🐱', x, y + 1);
  ctx.restore();
}

function drawWin(ctx, S, L) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.78)';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '800 50px ' + FONT_UI;
  ctx.fillStyle = '#5b9dff';
  ctx.fillText('走出迷宫啦！', L.W / 2, L.H / 2 - 70);

  ctx.font = '60px ' + FONT_EMOJI;
  ctx.fillText('🎉 🐱 🏁', L.W / 2, L.H / 2 + 6);

  ctx.font = '800 26px ' + FONT_UI;
  ctx.fillStyle = '#2b3550';
  ctx.fillText('第 ' + (S.level + 1) + ' 关，迷宫更大哦', L.W / 2, L.H / 2 + 78);
  ctx.restore();
}
