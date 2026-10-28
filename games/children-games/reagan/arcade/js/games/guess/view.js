/* =====================================================================
   games/guess/view.js — 猜数字 · UI 层（2D 画布）
   数字格子铺满画布：可猜范围明亮、猜过的范围变淡，
   一眼看出「还能猜哪里」——提示箭头在上方。
   ===================================================================== */
import { rr } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad wide" data-act="auto">💡 试一试（猜中间）</button>' +
  '</div>';

export const HINT =
  '<kbd>点数字</kbd> 猜一次 · 上面的箭头告诉你大了还是小了 · ' +
  '变淡的数字已经排除啦 · 试试每次都猜中间，最快！';

export function hud(S) {
  const def = S.def;
  return [
    ['范围', `${def.lo}~${def.hi}`],
    ['已猜', String(S.tries)],
    ['最佳', String(S.best[S.level - 1])]
  ];
}

/* 每局重建数字格子（布局算好存在模块里，tap 用） */
let cells = [];

export function draw(ctx, S, L) {
  const def = S.def;
  const cw = Math.min(86, (L.W - 80) / def.cols);
  const ch = Math.min(64, (L.H - 260) / Math.ceil((def.hi - def.lo + 1) / def.cols));

  ctx.fillStyle = '#fdf3dd';
  ctx.fillRect(0, 0, L.W, L.H);

  // 提示
  ctx.fillStyle = '#4a3b28';
  ctx.font = '800 34px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(S.lastTip || '点一个数字猜猜看！', L.W / 2, 108);
  if (S.lo < S.hi) {
    ctx.font = '700 22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#e8590c';
    ctx.fillText(`范围 ${S.lo} ~ ${S.hi}`, L.W / 2, 148);
  } else {
    ctx.font = '800 26px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#40c057';
    ctx.fillText(`就是 ${S.lo}！`, L.W / 2, 148);
  }

  // 数字格（位置由 game.js 的 layout 算好）
  for (const c of S.cells) {
    const v = c.v;
    const cx = c.x, cy = c.y, cw2 = c.w, ch = c.h;
    const alive = v >= S.lo && v <= S.hi;
    const isAns = S.done && v === S.ans;
    ctx.globalAlpha = alive ? 1 : 0.25;
    ctx.fillStyle = isAns ? '#40c057' : alive ? '#fff9ec' : '#d9cdb4';
    rr(ctx, cx, cy, cw, ch, 10);
    ctx.fill();
    if (alive && !S.done) {
      ctx.strokeStyle = '#d9c896';
      ctx.lineWidth = 2;
      rr(ctx, cx, cy, cw, ch, 10);
      ctx.stroke();
    }
    ctx.fillStyle = isAns ? '#fff' : '#4a3b28';
    ctx.font = `800 ${Math.round(cw2 * 0.42)}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillText(String(v), cx + cw2 / 2, cy + ch / 2 + cw2 * 0.15);
    ctx.globalAlpha = 1;
  }
  void cw;
  ctx.textAlign = 'left';
}
