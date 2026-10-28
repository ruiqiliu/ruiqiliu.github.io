/* =====================================================================
   games/tangram/view.js — 七巧板 · UI 层（2D 画布）
   拼板关：中间画目标剪影（浅色），板块拖上去吸住变色；
   自由关：整块画板随便摆。
   ===================================================================== */
import { rr, FONT_EMOJI } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="lv1">自由</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
    '<button class="pad" data-act="lv4">4</button>' +
    '<button class="pad" data-act="lv5">5</button>' +
  '</div>';

export const HINT = '拖动板块摆放 · 点一下板块 = 旋转 45° · 靠近正确位置会自动吸住';

export function hud(S) {
  const names = ['自由拼搭', '小板拼方', '大板拼三角'];
  return [
    ['关卡', `${S.level}·${names[S.level - 1] || ''}`],
    ['板块', `${S.pieces.filter((p) => p.locked).length}/${S.pieces.length}`],
    ['星星', '⭐' + (S.stars || 0)]
  ];
}

const NAMES = ['大三角', '大三角', '中三角', '正方', '小三角', '小三角', '平行四边'];

export function draw(ctx, S, L) {
  ctx.fillStyle = '#f8f4e3';
  ctx.fillRect(0, 0, L.W, L.H);
  const def = S.def;
  ctx.fillStyle = '#4a3b28';
  ctx.font = '800 28px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(def.mode === 'free' ? '自由拼搭：想拼什么拼什么！' : `拼出 ${def.name}！`, L.W / 2, 84);
  ctx.textAlign = 'left';

  // 目标剪影（拼板关）
  if (def.mode === 'puzzle') {
    ctx.fillStyle = 'rgba(177,151,252,.25)';
    for (const [i, poly] of Object.entries(def.targets)) {
      ctx.beginPath();
      poly.forEach(([ux, uy], k) => {
        const x = ux * S.scale + S.offX, y = uy * S.scale + S.offY;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(177,151,252,.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 托盘线
  ctx.strokeStyle = '#d9cfc0';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(40, 418);
  ctx.lineTo(L.W - 40, 418);
  ctx.stroke();
  ctx.setLineDash([]);

  // 板块（锁定的先画在剪影里，自由的画在托盘）
  const order = S.pieces.slice().sort((a, b) => (a.locked === b.locked ? 0 : a.locked ? -1 : 1));
  for (const p of order) {
    const verts = pieceVertsOf(S, p);
    ctx.beginPath();
    verts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    const cols = ['#ff8787', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#f783ac'];
    ctx.fillStyle = cols[p.i];
    ctx.globalAlpha = p.locked ? 1 : 0.92;
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,59,40,.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 名字标签（自由关不画，太吵）
    if (def.mode !== 'free') {
      ctx.fillStyle = 'rgba(74,59,40,.65)';
      ctx.font = '11px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(NAMES[p.i], p.x, p.y + 4);
      ctx.textAlign = 'left';
    }
  }

  if (S.winT > 0) {
    ctx.fillStyle = 'rgba(255,249,236,.6)';
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.fillStyle = '#40c057';
    ctx.font = '800 40px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('拼好啦！', L.W / 2, L.H / 2);
    ctx.textAlign = 'left';
  }
  void FONT_EMOJI; void rr;
}

function pieceVertsOf(S, p) {
  return S.pieceVerts(p.i, p.x, p.y, p.r);   // 屏幕像素顶点（game 已按 scale 换算）
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
