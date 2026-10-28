/* =====================================================================
   games/memory/view.js — 翻牌记忆 · UI 层（2D 画布）
   盖着的牌画花纹背面，翻开显示 emoji；配对成功的牌泛绿框。
   翻牌有横向压扁的「翻面」动画。
   ===================================================================== */
import { rr, FONT_EMOJI } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
    '<button class="pad" data-act="lv4">4</button>' +
    '<button class="pad" data-act="lv5">5</button>' +
  '</div>';

export const HINT = '点牌翻开，两张一样就配对成功 · <kbd>1</kbd>~<kbd>5</kbd> 选关 · 💡 教我';

export function hud(S) {
  return [
    ['关卡', String(S.level)],
    ['步数', String(S.moves)],
    ['最佳', S.best > 900 ? '—' : String(S.best)],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

export function draw(ctx, S, L) {
  ctx.fillStyle = '#fdf3dd';
  ctx.fillRect(0, 0, L.W, L.H);

  ctx.fillStyle = '#4a3b28';
  ctx.font = '800 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`找出 ${S.def.cols * S.def.rows / 2} 对好朋友`, L.W / 2, 96);
  ctx.textAlign = 'left';

  for (const c of S.cards) {
    const flip = c.state === 1 ? Math.abs(Math.sin(S.T * 10)) : 1;
    const sx = c.x + c.w / 2, sy = c.y + c.h / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(Math.max(0.12, c.state === 1 ? 1 : 1), 1);
    if (c.pop > 0) ctx.scale(1 + c.pop, 1 + c.pop);

    if (c.state === 0) {
      // 牌背
      ctx.fillStyle = '#e8590c';
      rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      rr(ctx, -c.w / 2 + 8, -c.h / 2 + 8, c.w - 16, c.h - 16, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      circle(ctx, 0, 0, 9);
      ctx.fillStyle = '#e8590c';
      circle(ctx, 0, 0, 5);
    } else {
      // 牌面
      ctx.fillStyle = c.state === 2 ? '#d3f9d8' : '#fff9ec';
      rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 12);
      ctx.fill();
      ctx.strokeStyle = c.state === 2 ? '#40c057' : '#d9c896';
      ctx.lineWidth = 3;
      rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 12);
      ctx.stroke();
      ctx.font = `${Math.round(c.h * 0.52)}px ${FONT_EMOJI}`;
      ctx.textAlign = 'center';
      ctx.fillText(c.icon, 0, c.h * 0.18);
      ctx.textAlign = 'left';
    }
    void flip;
    ctx.restore();
  }
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
