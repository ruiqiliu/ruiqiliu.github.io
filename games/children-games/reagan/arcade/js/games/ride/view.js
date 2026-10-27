/* =====================================================================
   games/ride/view.js — 环国骑行 · UI 层（2D 画布）
   镜头跟着骑手走（32 倍经纬度缩放）：海面 → 中国版图 → 骑过的路
   橙色、没骑的淡虚线；印章点画小旗；右上角小地图显示全程进度；
   左上角的风土人情卡片靠近自动弹出。
   ===================================================================== */
import { clamp, FONT_EMOJI } from '../../core/util.js';
import { pointAt } from './route.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad wide" data-act="togglepedal">🚴 骑 / 停</button>' +
    '<button class="pad wide" data-act="auto">🛋️ 自动骑</button>' +
    '<button class="pad wide" data-act="nextmark">🏁 找景点</button>' +
  '</div>';

export const HINT =
  '<kbd>▶</kbd> / <kbd>空格</kbd> / 按住画面 = 踩踏板（点「骑 / 停」切换自动踩） · ' +
  '<kbd>A</kbd> 自动骑 · <kbd>M</kbd> 找景点 · 靠近景点会自动慢下来盖章';

export function hud(S) {
  const got = S.marks.filter((m) => m.taken).length;
  return [
    ['里程', Math.round(S.kmLap) + ' km'],
    ['印章', `🎴${got}/${S.marks.length}`],
    ['地形', S.terrain],
    ['圈数', String(S.lap)]
  ];
}

/* ---------------- 画布常量 ---------------- */

const C = {
  sea: '#dfeadf',          // 境外（邻国）用安静的浅灰绿，像地图集的底
  land: '#f7e3ae',         // 中国版图：暖黄突出
  landEdge: '#b45309',
  routeOld: '#e8590c',
  routeNew: 'rgba(255,255,255,.75)',
  stamp: '#f5b301',
  ink: '#4a3b28'
};

const ZOOM = 32;
const CCX = 400, CCY = 268;   // 骑手在屏幕上的落点

function w2s(wx, wy, rx, ry) {
  return [(wx - rx) * ZOOM + CCX, (wy - ry) * ZOOM + CCY];
}

/* ---------------- 主绘制 ---------------- */

export function draw(ctx, S, L) {
  const rx = posOf(S).x, ry = posOf(S).y;

  // 境外底色（邻国留白，地图集风格）
  ctx.fillStyle = C.sea;
  ctx.fillRect(0, 0, L.W, L.H);
  // 淡淡的经纬网格，增加「地图」感
  ctx.strokeStyle = 'rgba(74,59,40,.07)';
  ctx.lineWidth = 1;
  const span = 6;
  const gx0 = Math.floor((rx - CCX / ZOOM) / span) * span;
  const gy0 = Math.floor((ry - CCY / ZOOM) / span) * span;
  for (let gy = gy0; gy < ry + (L.H - CCY) / ZOOM; gy += span) {
    const [, sy] = w2s(0, gy, rx, ry);
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(L.W, sy); ctx.stroke();
  }
  for (let gx = gx0; gx < rx + (L.W - CCX) / ZOOM; gx += span) {
    const [sx] = w2s(gx, 0, rx, ry);
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, L.H); ctx.stroke();
  }

  // 版图（含岛屿）
  drawPoly(ctx, S.route.pts, rx, ry, C.land, C.landEdge, 2.2);
  for (const poly of S.islands) drawPoly(ctx, poly, rx, ry, C.land, C.landEdge, 2.2);

  // 骑行路线：全程淡虚线 + 已骑部分橙色实线
  drawRouteLine(ctx, S, rx, ry);

  // 印章点
  drawMarks(ctx, S, rx, ry, L);

  // 骑手
  drawRider(ctx, S, rx, ry);

  // UI：卡片 / 小地图 / 进度条
  card(ctx, S, L);
  minimap(ctx, S, L);
  progress(ctx, S, L);

  // 庆祝横幅
  if (S.celebrate > 0) {
    ctx.fillStyle = 'rgba(255,249,236,.55)';
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.fillStyle = C.ink;
    ctx.font = '800 42px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏅 环国一圈完成！', L.W / 2, L.H / 2 - 10);
    ctx.font = '700 24px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#e8590c';
    ctx.fillText(`已骑 ${Math.round(S.kmAll)} km`, L.W / 2, L.H / 2 + 34);
    ctx.textAlign = 'left';
  }
}

function posOf(S) {
  return pointAt(S.route, S.d);
}

/* ---------------- 海面 / 版图 / 路线 ---------------- */

function drawPoly(ctx, pts, rx, ry, fill, stroke, lw) {
  ctx.beginPath();
  pts.forEach(([wx, wy], i) => {
    const [sx, sy] = w2s(wx, wy, rx, ry);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function drawRouteLine(ctx, S, rx, ry) {
  const { pts, total } = S.route;
  // 全程：淡虚线
  ctx.setLineDash([6, 7]);
  ctx.strokeStyle = C.routeNew;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([wx, wy], i) => {
    const [sx, sy] = w2s(wx, wy, rx, ry);
    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // 已骑：橙色实线（从起点到当前位置）
  const pos = posOf(S);
  ctx.strokeStyle = C.routeOld;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < pts.length; i++) {
    if (S.route.cum[i] <= S.d) {
      const [sx, sy] = w2s(pts[i][0], pts[i][1], rx, ry);
      started ? ctx.lineTo(sx, sy) : (ctx.moveTo(sx, sy), (started = true));
    } else break;
  }
  // 最后一段到当前位置
  const [ex, ey] = w2s(pos.x, pos.y, rx, ry);
  ctx.lineTo(ex, ey);
  ctx.stroke();
}

/* ---------------- 印章点 ---------------- */

function drawMarks(ctx, S, rx, ry, L) {
  for (const m of S.marks) {
    const p = pointAt(S.route, m.d);
    const [sx, sy] = w2s(p.x, p.y, rx, ry);
    if (sx < -30 || sx > L.W + 30 || sy < -30 || sy > L.H + 30) continue;

    if (m.taken) {
      // 已盖章：小旗
      ctx.fillStyle = C.stamp;
      ctx.fillRect(sx - 1, sy - 16, 2, 16);
      ctx.beginPath();
      ctx.moveTo(sx + 1, sy - 16);
      ctx.lineTo(sx + 14, sy - 11);
      ctx.lineTo(sx + 1, sy - 6);
      ctx.closePath();
      ctx.fill();
    } else {
      // 未盖章：呼吸的金圈 + 图标
      const pulse = 10 + Math.sin(S.T * 3 + m.d) * 2.5;
      ctx.strokeStyle = C.stamp;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `14px ${FONT_EMOJI}`;
      ctx.textAlign = 'center';
      ctx.fillText(m.icon, sx, sy + 5);
      ctx.textAlign = 'left';
    }
  }
}

/* ---------------- 骑手 ---------------- */

function drawRider(ctx, S, rx, ry) {
  const pos = posOf(S);
  const [sx, sy] = w2s(pos.x, pos.y, rx, ry);
  const ang = Math.atan2(pos.dy, pos.dx);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  const bob = S.speed > 0.05 ? Math.sin(S.T * 14) * 1.6 : Math.sin(S.T * 2) * 0.8;

  // 车轮
  ctx.strokeStyle = '#343a40';
  ctx.lineWidth = 2.4;
  for (const wx of [-8, 8]) {
    ctx.beginPath();
    ctx.arc(wx, 5, 4.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 车架
  ctx.beginPath();
  ctx.moveTo(-8, 5); ctx.lineTo(0, -2); ctx.lineTo(8, 5); ctx.lineTo(0, 0); ctx.closePath();
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(2, -8); ctx.stroke();  // 车把杆
  // 人：身体 + 踩动的腿
  ctx.strokeStyle = '#343a40';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-1, -6);
  ctx.lineTo(-3, -13 + bob);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1, -6); ctx.lineTo(3 + Math.sin(S.T * 8) * 2, 2); ctx.stroke();
  // 头像头
  avatar.hero(ctx, -3, -19 + bob, 8.5);
  ctx.restore();
}

/* ---------------- UI：卡片 / 小地图 / 进度条 ---------------- */

function card(ctx, S, L) {
  if (S.cardT <= 0 || !S.card) return;
  const a = Math.min(1, S.cardT / 0.6);
  ctx.save();
  ctx.globalAlpha = a;
  const x = 14, y = 64, w = 320, h = 96;
  ctx.fillStyle = 'rgba(255,249,236,.95)';
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = C.stamp;
  ctx.lineWidth = 3;
  rr(ctx, x, y, w, h, 18);
  ctx.stroke();
  ctx.font = `38px ${FONT_EMOJI}`;
  ctx.fillText(S.card.icon, x + 18, y + 56);
  ctx.fillStyle = C.ink;
  ctx.font = '800 22px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(S.card.name, x + 70, y + 38);
  ctx.font = '600 16px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#6b5a3e';
  // 文案手动折行（约 15 字一行）
  const note = S.card.note;
  for (let i = 0; i * 15 < note.length; i++) {
    ctx.fillText(note.slice(i * 15, i * 15 + 15), x + 70, y + 64 + i * 20);
  }
  ctx.restore();
}

function minimap(ctx, S, L) {
  const mw = 176, mh = 132, mx = L.W - mw - 14, my = 12;
  ctx.fillStyle = 'rgba(255,249,236,.9)';
  rr(ctx, mx, my, mw, mh, 12);
  ctx.fill();
  const k = Math.min((mw - 16) / 50.5, (mh - 16) / 36);
  const ox = mx + (mw - 50.5 * k) / 2, oy = my + (mh - 36 * k) / 2;

  const map = ([wx, wy]) => [ox + wx * k, oy + wy * k];

  ctx.beginPath();
  S.route.pts.forEach(([wx, wy], i) => {
    const [px, py] = map([wx, wy]);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = C.land;
  ctx.fill();
  ctx.strokeStyle = '#9e8752';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const poly of S.islands) {
    ctx.beginPath();
    poly.forEach(([wx, wy], i) => {
      const [px, py] = map([wx, wy]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // 印章：盖过的金点、没盖的灰点
  for (const m of S.marks) {
    const p = pointAt(S.route, m.d);
    const [px, py] = map([p.x, p.y]);
    ctx.fillStyle = m.taken ? C.stamp : 'rgba(74,59,40,.3)';
    circle(ctx, px, py, 2.4);
  }
  // 骑手
  const pos = posOf(S);
  const [px, py] = map([pos.x, pos.y]);
  ctx.fillStyle = '#e8590c';
  circle(ctx, px, py, 3.6);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.stroke();
}

function progress(ctx, S, L) {
  const x = 50, y = L.H - 26, w = L.W - 100, h = 8;
  ctx.fillStyle = 'rgba(74,59,40,.18)';
  rr(ctx, x, y, w, h, 4);
  ctx.fill();
  const t = clamp(S.d / S.route.total, 0, 1);
  ctx.fillStyle = C.routeOld;
  rr(ctx, x, y, w * t, h, 4);
  ctx.fill();
  for (const m of S.marks) {
    const mt = m.d / S.route.total;
    ctx.fillStyle = m.taken ? C.stamp : 'rgba(74,59,40,.35)';
    circle(ctx, x + w * mt, y + h / 2, 3);
  }
  // 骑手小标记
  ctx.fillStyle = '#e8590c';
  circle(ctx, x + w * t, y + h / 2, 5);
  ctx.fillStyle = '#fff';
  circle(ctx, x + w * t, y + h / 2, 2);
  // 起终点标注
  ctx.fillStyle = C.ink;
  ctx.font = '700 13px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('丹东出发', x, y - 8);
  ctx.textAlign = 'right';
  ctx.fillText('回到丹东', x + w, y - 8);
  ctx.textAlign = 'left';
}

/* ---------------- 小工具 ---------------- */

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
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
