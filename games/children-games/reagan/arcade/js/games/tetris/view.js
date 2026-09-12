/* =====================================================================
   games/tetris/view.js — 俄罗斯方块 · UI 层
   棋盘、落点虚影、右侧「下一个 / 最好成绩」面板、结束遮罩。
   ===================================================================== */
import { rr, shade, FONT_UI, FONT_EMOJI, FONT_MONO } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="rotate">↻</button>' +
    '<button class="pad" data-act="right">▶</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad wide" data-act="drop">落下</button>' +
  '</div>';

export const HINT =
  '<kbd>←</kbd><kbd>→</kbd> 左右移动 · <kbd>↑</kbd> 旋转 · <kbd>↓</kbd> 加速下落 · ' +
  '<kbd>空格</kbd> 直接落下 · 淡淡的小方块是落点提示';

export function hud(S) {
  return [['得分', S.score], ['等级', S.level], ['消行', S.lines]];
}

export function draw(ctx, S, L) {
  drawBoard(ctx, S, L);
  drawFixedBlocks(ctx, S, L);
  drawCurrentPiece(ctx, S, L);
  drawSidePanel(ctx, S, L);
  drawGameOver(ctx, S, L);
}

/* ---------------------------------------------------------------- */

/** 一个方块：渐变填充 + 高光；ghost = true 时画成虚线描边（落点提示） */
function drawBlock(g, x, y, size, color, alpha, ghost) {
  g.save();
  if (alpha != null) g.globalAlpha = alpha;

  rr(g, x + 1.5, y + 1.5, size - 3, size - 3, size * 0.24);
  if (ghost) {
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.setLineDash([5, 4]);
    g.stroke();
  } else {
    const grd = g.createLinearGradient(x, y, x, y + size);
    grd.addColorStop(0, shade(color, 0.45));
    grd.addColorStop(0.5, color);
    grd.addColorStop(1, shade(color, -0.2));
    g.fillStyle = grd;
    g.fill();

    rr(g, x + size * 0.22, y + size * 0.16, size * 0.56, size * 0.18, size * 0.1);
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.fill();
  }
  g.restore();
}

function drawBoard(ctx, S, L) {
  ctx.clearRect(0, 0, L.W, L.H);

  rr(ctx, L.BX - 3, L.BY - 3, L.BW + 6, L.BH + 6, 18);
  ctx.fillStyle = '#2b3350';
  ctx.fill();

  rr(ctx, L.BX, L.BY, L.BW, L.BH, 15);
  ctx.fillStyle = '#242b45';
  ctx.fill();

  // 淡淡的网格线
  ctx.save();
  rr(ctx, L.BX, L.BY, L.BW, L.BH, 15);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  for (let x = 1; x < L.COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(L.BX + x * L.CELL, L.BY);
    ctx.lineTo(L.BX + x * L.CELL, L.BY + L.BH);
    ctx.stroke();
  }
  for (let y = 1; y < L.ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(L.BX, L.BY + y * L.CELL);
    ctx.lineTo(L.BX + L.BW, L.BY + y * L.CELL);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFixedBlocks(ctx, S, L) {
  for (let y = 0; y < L.ROWS; y++) {
    for (let x = 0; x < L.COLS; x++) {
      const color = S.grid[y][x];
      if (!color) continue;
      const flashing = S.clearRows.indexOf(y) >= 0;
      drawBlock(
        ctx,
        L.BX + x * L.CELL,
        L.BY + y * L.CELL,
        L.CELL,
        flashing ? '#ffffff' : color,
        flashing ? 0.5 + Math.abs(Math.sin(S.T * 26)) * 0.5 : 1,
        false
      );
    }
  }
}

function drawCurrentPiece(ctx, S, L) {
  const cur = S.cur;
  if (!cur || S.clearRows.length) return;

  // 落点竖线：让小朋友一眼看出会掉到哪一列
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  for (let x = 0; x < cur.m[0].length; x++) {
    let hasBlock = false;
    for (let y = 0; y < cur.m.length; y++) if (cur.m[y][x]) hasBlock = true;
    if (!hasBlock) continue;
    const lx = L.BX + (cur.x + x) * L.CELL + L.CELL / 2;
    ctx.beginPath();
    ctx.moveTo(lx, L.BY);
    ctx.lineTo(lx, L.BY + L.BH);
    ctx.stroke();
  }
  ctx.restore();

  // 落点虚影
  for (let y = 0; y < cur.m.length; y++) {
    for (let x = 0; x < cur.m[y].length; x++) {
      if (!cur.m[y][x]) continue;
      drawBlock(ctx, L.BX + (cur.x + x) * L.CELL, L.BY + (S.ghost + y) * L.CELL, L.CELL, cur.c, 1, true);
    }
  }

  // 当前方块
  for (let y = 0; y < cur.m.length; y++) {
    for (let x = 0; x < cur.m[y].length; x++) {
      if (!cur.m[y][x]) continue;
      drawBlock(ctx, L.BX + (cur.x + x) * L.CELL, L.BY + (cur.y + y) * L.CELL, L.CELL, cur.c, 1, false);
    }
  }
}

function drawSidePanel(ctx, S, L) {
  const PX = L.BX + L.BW + 18;
  const PW = L.W - PX - L.BY;

  // 「下一个」
  rr(ctx, PX, L.BY, PW, 130, 16);
  ctx.fillStyle = '#eef3ff';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px ' + FONT_UI;
  ctx.fillStyle = '#7a849e';
  ctx.fillText('下一个', PX + PW / 2, L.BY + 20);

  const next = S.next;
  if (next) {
    const m = next.m;
    const cs = 19;
    let minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const w = (maxX - minX + 1) * cs;
    const h = (maxY - minY + 1) * cs;
    const ox = PX + (PW - w) / 2;
    const oy = L.BY + 62 + (46 - h) / 2;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (m[y][x]) drawBlock(ctx, ox + (x - minX) * cs, oy + (y - minY) * cs, cs, next.c, 1, false);
      }
    }
  }

  // 「最好成绩」
  rr(ctx, PX, L.BY + 144, PW, 72, 16);
  ctx.fillStyle = '#fff7e6';
  ctx.fill();
  ctx.font = '700 12.5px ' + FONT_UI;
  ctx.fillStyle = '#a07835';
  ctx.fillText('最好成绩', PX + PW / 2, L.BY + 166);
  ctx.font = '800 24px ' + FONT_MONO;
  ctx.fillStyle = '#e8590c';
  ctx.fillText(String(Math.max(S.best, S.score)), PX + PW / 2, L.BY + 194);
}

function drawGameOver(ctx, S, L) {
  if (!S.over) return;
  ctx.save();
  ctx.fillStyle = 'rgba(36,43,69,.88)';
  rr(ctx, L.BX, L.BY, L.BW, L.BH, 15);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = L.BX + L.BW / 2;
  const cy = L.BY + L.BH / 2;

  ctx.font = '800 34px ' + FONT_UI;
  ctx.fillStyle = '#ffd43b';
  ctx.fillText('好厉害！', cx, cy - 96);

  ctx.font = '56px ' + FONT_EMOJI;
  ctx.fillText('🧩', cx, cy - 30);

  ctx.font = '800 26px ' + FONT_MONO;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('得分 ' + S.score, cx, cy + 40);

  ctx.font = '700 17px ' + FONT_UI;
  ctx.fillStyle = '#a9b4d0';
  ctx.fillText('消除 ' + S.lines + ' 行', cx, cy + 76);

  ctx.font = '800 19px ' + FONT_UI;
  ctx.fillStyle = '#69db7c';
  ctx.fillText('按 空格 或点击屏幕再来一次', cx, cy + 124);
  ctx.restore();
}
