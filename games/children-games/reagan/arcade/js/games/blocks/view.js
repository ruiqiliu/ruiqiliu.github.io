/* =====================================================================
   games/blocks/view.js — 数积木 · UI 层（2D 画布）
   等距投影的积木堆：从后往前画，被挡住的积木只露一角；
   教我之后每摞顶上标出这一摞的块数。
   ===================================================================== */
import { clamp } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
  '</div>';

export const HINT = '数一数一共有几块小积木 · 点下面的答案 · 💡 教我（每摞标数字）';

export function hud(S) {
  return [
    ['关卡', String(S.level)],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

const TW = 52, TH = 26, WALL = 30;   // 顶面菱形宽高 + 立方体高

/** 一块等距立方体：顶面菱形 + 左右两面 */
function cube(ctx, sx, sy) {
  ctx.fillStyle = '#66d9e8';
  ctx.beginPath();
  ctx.moveTo(sx, sy - WALL);
  ctx.lineTo(sx + TW / 2, sy - WALL + TH / 2);
  ctx.lineTo(sx, sy - WALL + TH);
  ctx.lineTo(sx - TW / 2, sy - WALL + TH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3bc9db';
  ctx.beginPath();
  ctx.moveTo(sx - TW / 2, sy - WALL + TH / 2);
  ctx.lineTo(sx, sy - WALL + TH);
  ctx.lineTo(sx, sy + TH);
  ctx.lineTo(sx - TW / 2, sy + TH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#15aabf';
  ctx.beginPath();
  ctx.moveTo(sx + TW / 2, sy - WALL + TH / 2);
  ctx.lineTo(sx, sy - WALL + TH);
  ctx.lineTo(sx, sy + TH);
  ctx.lineTo(sx + TW / 2, sy + TH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(11,84,94,.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx, sy - WALL);
  ctx.lineTo(sx + TW / 2, sy - WALL + TH / 2);
  ctx.lineTo(sx + TW / 2, sy + TH / 2);
  ctx.lineTo(sx, sy + TH);
  ctx.lineTo(sx - TW / 2, sy + TH / 2);
  ctx.lineTo(sx - TW / 2, sy - WALL + TH / 2);
  ctx.closePath();
  ctx.moveTo(sx, sy - WALL + TH);
  ctx.lineTo(sx, sy + TH);
  ctx.stroke();
}

export function draw(ctx, S, L) {
  ctx.fillStyle = '#e3fafc';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.fillStyle = '#0c8599';
  ctx.font = '800 32px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('数一数：一共有几块积木？', L.W / 2, 84);
  if (S.hintCol) {
    ctx.font = '700 19px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#e8590c';
    ctx.fillText('每摞顶上的数字 = 这一摞的块数，加起来试试！', L.W / 2, 120);
  }
  ctx.textAlign = 'left';

  const cols = S.heights[0] ? S.heights[0].length : 3;
  const rows = S.heights.length;
  const ox = L.W / 2, oy = 190;

  // 从后往前画：z 小的先画
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const h = S.heights[z][x];
      const bx = ox + (x - z) * TW / 2;
      const by = oy + (x + z) * TH / 2;
      for (let k = 0; k < h; k++) {
        cube(ctx, bx, by - k * WALL);
      }
      if (h > 0) {
        // 地面菱形影子
        ctx.fillStyle = 'rgba(12,133,153,.15)';
        ctx.beginPath();
        ctx.moveTo(bx, by + 4);
        ctx.lineTo(bx + TW / 2, by + 4 + TH / 2);
        ctx.lineTo(bx, by + 4 + TH);
        ctx.lineTo(bx - TW / 2, by + 4 + TH / 2);
        ctx.closePath();
        ctx.fill();
        if (S.hintCol) {
          ctx.fillStyle = '#e8590c';
          ctx.font = '800 24px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(h), bx, Math.max(132, by - h * WALL - WALL - 8));
          ctx.textAlign = 'left';
        }
      }
    }
  }

  // 答案按钮
  options(ctx, S);
}

function options(ctx, S) {
  S.options.forEach((o, i) => {
    const x = 170 + i * 155, y = 505;
    ctx.fillStyle = '#0c8599';
    rr(ctx, x - 45, y - 30, 90, 60, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 34px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(o), x, y + 12);
    ctx.textAlign = 'left';
  });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
