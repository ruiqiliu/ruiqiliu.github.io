/* =====================================================================
   games/sudoku/view.js — 图画数独 · UI 层（2D 画布）
   格子里的动物用 emoji；选中的格子高亮，冲突的格子泛红。
   ===================================================================== */
import { rr, FONT_EMOJI } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
    '<button class="pad" data-act="lv4">4</button>' +
    '<button class="pad" data-act="lv5">5</button>' +
    '<button class="pad" data-act="lv6">6</button>' +
  '</div>';

export const HINT = '点格子 → 点下面的动物放进去 · 每行每列每个宫不重复 · 💡 教我';

export function hud(S) {
  return [
    ['关卡', String(S.level)],
    ['空格', String(S.board.flat().filter((v) => !v).length)],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

const ICONS4 = ['🐼', '🦊', '🐸', '🐰'];
const ICONS6 = ['🐼', '🦊', '🐸', '🐰', '🐯', '🐮'];

export function draw(ctx, S, L) {
  ctx.fillStyle = '#f4fce3';
  ctx.fillRect(0, 0, L.W, L.H);
  const size = S.size;
  const cs = Math.min(78, (L.H - 330) / size);
  const ox = (L.W - size * cs) / 2;
  const oy = 150;
  const icons = size === 4 ? ICONS4 : ICONS6;
  const boxR = size === 4 ? 2 : 2, boxC = size === 4 ? 2 : 3;

  ctx.fillStyle = '#4a3b28';
  ctx.font = '800 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${size}×${size} 图画数独：每行每列每宫不重复`, L.W / 2, 84);
  ctx.textAlign = 'left';

  // 格子
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const x = ox + c * cs, y = oy + r * cs;
      const sel = S.sel && S.sel.r === r && S.sel.c === c;
      const bad = S.conflict.includes(r + ',' + c);
      ctx.fillStyle = bad ? '#ffc9c9' : sel ? '#fff3bf' : '#fff';
      rr(ctx, x + 2, y + 2, cs - 4, cs - 4, 10);
      ctx.fill();
      ctx.strokeStyle = sel ? '#f59f00' : '#adb58a';
      ctx.lineWidth = sel ? 4 : 2;
      rr(ctx, x + 2, y + 2, cs - 4, cs - 4, 10);
      ctx.stroke();
      const v = S.board[r][c];
      if (v) {
        ctx.globalAlpha = S.fixed[r][c] ? 1 : 0.85;
        ctx.font = `${Math.round(cs * 0.55)}px ${FONT_EMOJI}`;
        ctx.textAlign = 'center';
        ctx.fillText(icons[v - 1], x + cs / 2, y + cs * 0.68);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
  }

  // 宫分隔粗线
  ctx.strokeStyle = '#82c91e';
  ctx.lineWidth = 4;
  for (let b = 1; b * boxR < size; b++) {
    ctx.beginPath();
    ctx.moveTo(ox + b * boxR * cs, oy);
    ctx.lineTo(ox + b * boxR * cs, oy + size * cs);
    ctx.stroke();
  }
  for (let b = 1; b * boxC < size; b++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + b * boxC * cs);
    ctx.lineTo(ox + size * cs, oy + b * boxC * cs);
    ctx.stroke();
  }

  // 动物托盘（位置来自 game.layout）
  const py = S.palRects ? S.palRects[0].y + 34 : 0;
  icons.forEach((icon, i) => {
    const x = S.palRects ? S.palRects[i].x + 34 : 0;
    ctx.fillStyle = '#fff';
    rr(ctx, x - 34, py - 34, 68, 68, 14);
    ctx.fill();
    ctx.strokeStyle = '#82c91e';
    ctx.lineWidth = 3;
    rr(ctx, x - 34, py - 34, 68, 68, 14);
    ctx.stroke();
    ctx.font = `38px ${FONT_EMOJI}`;
    ctx.textAlign = 'center';
    ctx.fillText(icon, x, py + 14);
    ctx.textAlign = 'left';
  });

  // 完成
  if (S.done) {
    ctx.fillStyle = 'rgba(244,252,227,.7)';
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.fillStyle = '#40c057';
    ctx.font = '800 44px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('数独完成！', L.W / 2, L.H / 2);
    ctx.textAlign = 'left';
  }
}
