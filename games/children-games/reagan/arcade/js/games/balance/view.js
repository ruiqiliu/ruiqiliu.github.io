/* =====================================================================
   games/balance/view.js — 天平称重 · UI 层（2D 画布）
   天平梁会随两边重量差歪斜，正好平衡就摆平 + 撒花。
   ===================================================================== */
import { clamp } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
  '</div>';

export const HINT = '点下面的砝码放到右盘，加起来正好 = 西瓜的斤数 · 点盘里的砝码可以拿回来 · 💡 教我';

export function hud(S) {
  return [
    ['关卡', String(S.level)],
    ['第几题', `${S.round + 1}/${[3, 4, 4][S.level - 1] || 3}`],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

export function draw(ctx, S, L) {
  ctx.fillStyle = '#e6fcf5';
  ctx.fillRect(0, 0, L.W, L.H);

  ctx.fillStyle = '#0c8599';
  ctx.font = '800 32px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`西瓜重 ${S.target} 斤，放砝码让它平衡！`, L.W / 2, 90);

  // 天平：支点 + 梁的倾角随两边重量差变化（整座画在旋转坐标系里）
  const px = L.W / 2, py = 330;

  // 底座支柱
  ctx.fillStyle = '#868e96';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - 26, py + 130);
  ctx.lineTo(px + 26, py + 130);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#495057';
  rr(ctx, px - 60, py + 126, 120, 14, 6);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(S.tilt);
  ctx.fillStyle = '#845ef7';
  rr(ctx, -260, -10, 520, 16, 8);
  ctx.fill();

  // 左盘（西瓜）
  drawPan(ctx, -220, 10);
  ctx.font = '56px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🍉', -220, 32);
  ctx.font = '800 22px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#0c8599';
  ctx.fillText(`${S.target} 斤`, -220, 66);

  // 右盘（砝码，梁局部坐标，位置由 game 提供）
  drawPan(ctx, 220, 10);
  (S.panLocs || []).forEach(([wx, wy], i) => {
    drawWeight(ctx, wx, wy, S.pan[i].v);
  });
  ctx.restore();
  ctx.textAlign = 'left';

  // 砝码架
  ctx.fillStyle = '#adb5bd';
  rr(ctx, 90, 516, 560, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#4a3b28';
  ctx.font = '700 16px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('砝码架（点一下放上右盘）', L.W / 2, 548);
  [1, 2, 5, 10].forEach((v, i) => drawWeight(ctx, 150 + i * 170, 505, v));
  ctx.textAlign = 'left';

  // 平衡状态
  if (S.done) {
    ctx.fillStyle = '#40c057';
    ctx.font = '800 30px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('平衡啦！', L.W / 2, 160);
    ctx.textAlign = 'left';
  }
}

function drawPan(ctx, lx, ly) {
  ctx.strokeStyle = '#845ef7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx, ly + 44);
  ctx.stroke();
  ctx.fillStyle = '#9775fa';
  ctx.beginPath();
  ctx.ellipse(lx, ly + 52, 74, 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWeight(ctx, x, y, v) {
  ctx.fillStyle = '#fcc419';
  ctx.beginPath();
  ctx.moveTo(x - 22, y + 20);
  ctx.lineTo(x + 22, y + 20);
  ctx.lineTo(x + 14, y - 16);
  ctx.lineTo(x - 14, y - 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e6a711';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#5c4400';
  ctx.font = '800 20px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(v), x, y + 12);
  ctx.textAlign = 'left';
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
