/* =====================================================================
   games/make10/view.js — 凑十点 · UI 层（2D 画布）
   亮蓝底 + 大数字块：选中的块会高亮，凑成 10 的两块「啵」地消掉。
   ===================================================================== */
import { rr } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
    '<button class="pad" data-act="lv4">4</button>' +
  '</div>';

export const HINT = '点两块数字，加起来等于 <kbd>10</kbd> 就消掉 · <kbd>1</kbd>~<kbd>4</kbd> 选关 · 💡 教我';

export function hud(S) {
  return [
    ['关卡', String(S.level)],
    ['剩块', String(S.left)],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

const COL = { 1: '#ff6b6b', 2: '#ffa94d', 3: '#ffd43b', 4: '#a9e34b', 5: '#69db7c', 6: '#38d9a9', 7: '#4dabf7', 8: '#9775fa', 9: '#f783ac' };

export function draw(ctx, S, L) {
  ctx.fillStyle = '#e7f5ff';
  ctx.fillRect(0, 0, L.W, L.H);

  ctx.fillStyle = '#1864ab';
  ctx.font = '800 34px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`挑两块加起来 = ${10}`, L.W / 2, 96);
  ctx.font = '700 20px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#4a3b28';
  ctx.fillText('1+9 · 2+8 · 3+7 · 4+6 · 5+5 都是好搭档', L.W / 2, 132);
  ctx.textAlign = 'left';

  for (const c of S.cards) {
    if (c.gone) continue;
    ctx.save();
    if (c.shake > 0) ctx.translate(Math.sin(c.shake * 40) * 6, 0);
    if (c.pop > 0) {
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.scale(1 + c.pop, 1 + c.pop);
      ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
    }
    const sel = S.cards[S.sel] === c;
    ctx.fillStyle = sel ? '#fff3bf' : COL[c.v] || '#dee2e6';
    rr(ctx, c.x, c.y, c.w, c.h, 16);
    ctx.fill();
    ctx.strokeStyle = sel ? '#f59f00' : 'rgba(24,100,171,.35)';
    ctx.lineWidth = 4;
    rr(ctx, c.x, c.y, c.w, c.h, 16);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(c.w * 0.5)}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(c.v), c.x + c.w / 2, c.y + c.h / 2 + c.w * 0.17);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
