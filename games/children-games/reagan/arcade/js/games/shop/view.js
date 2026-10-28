/* =====================================================================
   games/shop/view.js — 购物小掌柜 · UI 层（2D 画布）
   柜台场景：客人（本局小朋友的脸）在右边，商品和价签在柜台上，
   付的钱挂在上方的绳子上；下面一排是钱罐硬币，点进托盘找零。
   ===================================================================== */
import { rr, FONT_EMOJI } from '../../core/util.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
  '</div>';

export const HINT = '点下面的硬币放进托盘，凑出正确的找零 · 点托盘里的硬币可以拿回来 · 💡 教我';

export function hud(S) {
  return [
    ['关卡', String(S.level)],
    ['客人', `${S.round + 1}/${[3, 4, 4][S.level - 1] || 3}`],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

function coin(ctx, x, y, r, v) {
  ctx.fillStyle = '#ffd43b';
  circle(ctx, x, y, r);
  ctx.strokeStyle = '#e6a711';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8a6100';
  ctx.font = `800 ${Math.round(r * 0.9)}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(v), x, y + r * 0.32);
  ctx.textAlign = 'left';
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function draw(ctx, S, L) {
  // 店铺背景
  ctx.fillStyle = '#fff4e0';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.fillStyle = '#f4d8a8';
  ctx.fillRect(0, 300, L.W, L.H - 300);       // 柜台
  ctx.fillStyle = '#e8b478';
  ctx.fillRect(0, 292, L.W, 12);

  // 客人（右边，本局小朋友的脸）
  avatar.hero(ctx, L.W - 120, 200, 42);
  ctx.fillStyle = '#4a3b28';
  ctx.font = '700 18px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('客人', L.W - 120, 262);

  // 客人想说的话
  const want = S.item2
    ? `${S.item.name}${S.item.price} 元 + ${S.item2.name}${S.item2.price} 元`
    : `${S.item.name} ${S.item.price} 元`;
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  rr(ctx, L.W - 460, 60, 300, 62, 16);
  ctx.fill();
  ctx.fillStyle = '#4a3b28';
  ctx.font = '700 19px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(want, L.W - 310, 86);
  ctx.font = '800 20px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#e8590c';
  ctx.fillText(`付了 ${S.pay} 元`, L.W - 310, 112);
  ctx.textAlign = 'left';

  // 商品 + 价签（柜台上）
  ctx.font = `52px ${FONT_EMOJI}`;
  ctx.fillText(S.item.icon, 120, 272);
  ctx.font = '800 18px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(`${S.item.price} 元`, 120, 296);
  if (S.item2) {
    ctx.font = `52px ${FONT_EMOJI}`;
    ctx.fillText(S.item2.icon, 230, 272);
    ctx.font = '800 18px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`${S.item2.price} 元`, 230, 296);
  }

  // 付的钱（挂在绳上）
  coin(ctx, L.W / 2 - 40, 60, 26, S.pay);
  ctx.fillStyle = '#4a3b28';
  ctx.font = '700 16px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('客人付的', L.W / 2 - 40, 104);

  // 找零目标提示
  ctx.font = '800 26px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#1864ab';
  ctx.textAlign = 'center';
  ctx.fillText(`要找：${S.change} 元`, L.W / 2, 210);
  ctx.textAlign = 'left';
  // 托盘
  ctx.fillStyle = '#d9c896';
  rr(ctx, L.W / 2 - 160, 340, 320, 90, 16);
  ctx.fill();
  ctx.strokeStyle = '#b09a6a';
  ctx.lineWidth = 3;
  rr(ctx, L.W / 2 - 160, 340, 320, 90, 16);
  ctx.stroke();
  ctx.fillStyle = '#8a7550';
  ctx.font = '700 15px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('找零托盘（点硬币放进来）', L.W / 2, 336);

  // 托盘里的硬币
  S.tray.forEach((c, i) => {
    c.tx = L.W / 2 - 120 + i * 80;
    c.ty = 385;
    coin(ctx, c.tx, c.ty, 34, c.v);
  });

  // 钱罐硬币
  ctx.fillStyle = '#4a3b28';
  ctx.font = '700 16px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('钱罐（点硬币找零）', 105, 436);
  for (const c of S.coins) {
    ctx.globalAlpha = c.used ? 0.18 : 1;
    coin(ctx, c.x, c.y, c.r, c.v);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}
