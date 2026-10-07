/* =====================================================================
   games/garage/view.js — 车库大师 · UI 层
   车库场景：车停在改装平台上（侧视），右侧面板四个零件类别，
   预览全是画出来的图形 —— 五岁小朋友不识字也能玩。
   公路场景：俯视视角，赛道左右弯曲，油门刹车 + ◀ ▶ 左右躲雪糕筒；
   右上角环形小地图画出整条路线、进度和前方的雪糕筒。
   ===================================================================== */
import { TAU, rr, shade, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';
import { avatar } from '../../core/avatar.js';
import { ROAD, WHEELS, LIGHTS, SPOILERS, COLORS } from './parts.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad wide" data-act="gas">🛞 油门</button>' +
    '<button class="pad" data-act="brake">🛑 刹车</button>' +
    '<button class="pad" data-act="right">▶</button>' +
    '<button class="pad wide" data-act="garage">🏠 车库</button>' +
    '<button class="pad wide" data-act="start">🔧 出发！</button>' +
  '</div>';

export const HINT =
  '车库：点 ◀ ▶ 换零件，点绿色「出发」上路 · ' +
  '路上：油门前进、◀ ▶ 左右躲雪糕筒、刹车减速 · 绕完 10 公里到终点！';

export function hud(S) {
  if (S.phase === 'build') return [['阶段', '车库造车'], ['选好零件', '就出发！']];
  return [
    ['里程', (S.dist / 10 / 1000).toFixed(2) + ' / 10 km'],
    ['速度', Math.round(S.speed * 0.36) + ' km/h'],
    ['星星', S.starCount]
  ];
}

/* 右侧面板与点击热区（game.js 用同一份坐标做命中测试） */
const PANEL = { x: 546, y: 60, w: 204, h: 440 };
export const PART_ROWS = [0, 1, 2, 3].map((i) => ({
  y: 94 + i * 98, h: 88,
  leftX: PANEL.x + 6, arrowW: 46,
  midX: PANEL.x + 58, midW: 88,
  rightX: PANEL.x + 152
}));
export const START_BTN = { x: 250, y: 494, w: 190, h: 54 };

function text(g, t, x, y, weight, size, color) {
  g.save();
  g.font = weight + ' ' + size + 'px ' + FONT_UI;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(t, x, y);
  g.restore();
}

function emoji(g, ch, x, y, size, alpha) {
  g.save();
  g.font = size + 'px ' + FONT_EMOJI;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (alpha != null) g.globalAlpha = alpha;
  g.fillText(ch, x, y);
  g.restore();
}

/* ================================================================
   车库静态背景：墙、工具架、地板、改装平台、面板底板
   ================================================================ */
export function makeBackground(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);

  const wall = g.createLinearGradient(0, 0, 0, 430);
  wall.addColorStop(0, '#fdf7ef');
  wall.addColorStop(1, '#f4e7d6');
  g.fillStyle = wall;
  g.fillRect(0, 0, L.W, 430);

  // 地板
  g.fillStyle = '#e5d3b8';
  g.fillRect(0, 430, L.W, L.H - 430);
  g.fillStyle = 'rgba(120,90,50,.12)';
  for (let x = 20; x < L.W; x += 60) g.fillRect(x, 430, 3, L.H - 430);

  // 墙上的工具架
  g.fillStyle = '#d9c3a3';
  g.fillRect(60, 130, 300, 8);
  emoji(g, '🧰', 90, 108, 38);
  emoji(g, '🔧', 150, 110, 34);
  emoji(g, '🏁', 220, 108, 34);
  emoji(g, '🛞', 300, 110, 36);
  emoji(g, '🚗', 640, 110, 44);
  text(g, 'GARAGE', 500, 116, '800', 26, '#d9c3a3');

  // 改装平台
  rr(g, 120, 466, 340, 30, 10);
  g.fillStyle = '#cfc0aa';
  g.fill();
  g.strokeStyle = '#b3a288';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#f7d724';
  for (let x = 132; x < 440; x += 44) {
    g.save();
    rr(g, 120, 470, 340, 22, 8);
    g.clip();
    g.beginPath();
    g.moveTo(x, 492); g.lineTo(x + 20, 470); g.lineTo(x + 30, 470); g.lineTo(x + 10, 492);
    g.closePath();
    g.fill();
    g.restore();
  }

  // 右侧面板底板
  rr(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 26);
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = '#d8ecd9';
  g.lineWidth = 3;
  g.stroke();
  text(g, '改造汽车', PANEL.x + PANEL.w / 2, PANEL.y + 22, '800', 17, '#40916c');

  return canvas;
}

/* ================================================================
   每帧绘制
   ================================================================ */
export function draw(ctx, S, L) {
  if (S.phase === 'build') {
    ctx.drawImage(S.bg, 0, 0, L.W, L.H);
    drawCar(ctx, 280, 470, S.part, 0, Math.sin(S.T * 2) * 2, 1.3, false, 0);
    drawPanel(ctx, S);
    drawStartBtn(ctx, S.T);
  } else {
    drawDrive(ctx, S, L);
  }
}

/* ---------------- 车库 ---------------- */

function drawPanel(ctx, S) {
  const labels = ['轮子', '车灯', '尾翼', '颜色'];
  PART_ROWS.forEach((r, i) => {
    rr(ctx, PANEL.x + 2, r.y, PANEL.w - 4, r.h, 14);
    ctx.fillStyle = '#f8fbf8';
    ctx.fill();
    ctx.strokeStyle = '#d8ecd9';
    ctx.lineWidth = 2;
    ctx.stroke();

    text(ctx, labels[i], PANEL.x + PANEL.w / 2, r.y + 15, '700', 13, '#7c9c85');

    for (const [ax, ch] of [[r.leftX + 23, '◀'], [r.rightX + 23, '▶']]) {
      const cy = r.y + r.h / 2 + 8;
      ctx.beginPath();
      ctx.arc(ax, cy, 19, 0, TAU);
      ctx.fillStyle = '#40916c';
      ctx.fill();
      text(ctx, ch, ax, cy + 1, '800', 18, '#ffffff');
    }

    drawPreview(ctx, i, S.part, PANEL.x + 103, r.y + r.h / 2 + 9);
  });
}

/** 面板里的小预览图：全部画出来，不靠文字 */
function drawPreview(ctx, cat, part, cx, cy) {
  if (cat === 0) {
    drawWheel(ctx, cx, cy, 24, WHEELS[part.wheel].name === '越野轮', part.wheel === 1, 0.6);
  } else if (cat === 1) {
    drawLight(ctx, cx - 4, cy, part.light, 1.4, false);
  } else if (cat === 2) {
    if (part.spoiler === 0) {
      rr(ctx, cx - 26, cy - 10, 52, 20, 6);
      ctx.strokeStyle = '#ced4da';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, '无', cx, cy + 1, '700', 14, '#adb5bd');
    } else {
      const big = part.spoiler === 2;
      ctx.fillStyle = '#495057';
      rr(ctx, cx - 4, cy - 2, 8, big ? 22 : 14, 2);
      ctx.fill();
      rr(ctx, cx - 30, cy - (big ? 22 : 16), 60, big ? 12 : 9, 4);
      ctx.fill();
      rr(ctx, cx - 30, cy - (big ? 22 : 16), 6, big ? 20 : 16, 3);
      ctx.fill();
      rr(ctx, cx + 24, cy - (big ? 22 : 16), 6, big ? 20 : 16, 3);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx - 10, cy, 17, 0, TAU);
    ctx.fillStyle = COLORS[part.color];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 16, cy, 11, 0, TAU);
    ctx.fillStyle = shade(COLORS[part.color], -0.18);
    ctx.fill();
  }
}

function drawStartBtn(ctx, T) {
  const b = START_BTN;
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(1 + Math.sin(T * 3) * 0.03, 1 + Math.sin(T * 3) * 0.03);
  rr(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 18);
  ctx.shadowColor = 'rgba(47,158,68,.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#51cf66';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#37b24d';
  ctx.lineWidth = 3;
  rr(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 18);
  ctx.stroke();
  emoji(ctx, '🚗', -b.w / 2 + 34, 2, 26);
  text(ctx, '出 发 ！', 6, 1, '800', 27, '#ffffff');
  ctx.restore();
}

/* ---------------- 公路（俯视） ---------------- */

let grass = null;
function makeGrass(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);
  const grad = g.createLinearGradient(0, 0, 0, L.H);
  grad.addColorStop(0, '#a2dd94');
  grad.addColorStop(1, '#7ccb70');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.H);
  for (let i = 0; i < 60; i++) {
    const x = (i * 977) % L.W;
    const y = (i * 613) % L.H;
    g.fillStyle = 'rgba(60,140,50,.15)';
    g.beginPath();
    g.ellipse(x, y, 26, 14, 0, 0, TAU);
    g.fill();
  }
  return canvas;
}

function drawDrive(ctx, S, L) {
  if (!grass) grass = makeGrass(L);
  ctx.drawImage(grass, 0, 0, L.W, L.H);

  const CAR_Y = L.H - 130;

  // 路面：沿中心线描一条粗带（赛道左右弯曲）
  const pts = [];
  for (let sy = L.H + 60; sy >= -60; sy -= 14) {
    const p = S.dist + (CAR_Y - sy);
    pts.push([ROAD.center(p), sy]);
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = '#595c66';
  ctx.lineWidth = ROAD.width;
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = x + side * (ROAD.width / 2 - 3);
      return i ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
    });
    ctx.strokeStyle = '#f1f3f5';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // 中央黄虚线
  for (let wp = Math.floor(S.dist / 110) * 110 - 220; wp < S.dist + L.H; wp += 110) {
    if (wp < S.dist - 220) continue;
    ctx.beginPath();
    ctx.moveTo(ROAD.center(wp), CAR_Y - (wp - S.dist));
    ctx.lineTo(ROAD.center(wp + 55), CAR_Y - (wp + 55 - S.dist));
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.restore();

  // 雪糕筒（俯视：橙圆 + 白圈；撞倒的变灰）
  const c0 = Math.max(0, Math.floor((S.dist - 300) / L.CONE_GAP));
  for (let i = c0; i <= c0 + Math.ceil(L.H / L.CONE_GAP) + 3; i++) {
    const wx = i * L.CONE_GAP + 900;
    const sy = CAR_Y - (wx - S.dist);
    if (sy < -40 || sy > L.H + 40) continue;
    const lane = (((i * 2654435761) >>> 0) % 3 - 1) * 115;
    const x = ROAD.center(wx) + lane;
    const hit = S.coneHits.has(wx);
    ctx.save();
    ctx.globalAlpha = hit ? 0.5 : 1;
    ctx.beginPath();
    ctx.arc(x, sy, 13, 0, TAU);
    ctx.fillStyle = hit ? '#adb5bd' : '#ff922b';
    ctx.fill();
    if (!hit) {
      ctx.beginPath();
      ctx.arc(x, sy, 7, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  // 星星
  const s0 = Math.max(1, Math.floor((S.dist - 80) / L.STAR_GAP));
  for (let i = s0; i <= s0 + Math.ceil(L.H / L.STAR_GAP) + 2; i++) {
    const wx = i * L.STAR_GAP;
    if (S.got.has(wx)) continue;
    const sy = CAR_Y - (wx - S.dist);
    if (sy < -40 || sy > L.H + 40) continue;
    const lane = (((i * 2246822519) >>> 0) % 3 - 1) * 115;
    const x = ROAD.center(wx) + lane;
    emoji(ctx, '⭐', x, sy, 30 + Math.sin(S.T * 5 + i) * 4);
  }

  // 路边树和房子
  const o0 = Math.floor((S.dist - 200) / 240);
  for (let i = o0; i < o0 + Math.ceil(L.H / 240) + 3; i++) {
    if (i < 0) continue;
    const h = (i * 2654435761) >>> 0;
    const wx = i * 240 + (h % 120);
    const sy = CAR_Y - (wx - S.dist);
    if (sy < -50 || sy > L.H + 50) continue;
    const side = h % 2 ? 1 : -1;
    const x = ROAD.center(wx) + side * (ROAD.width / 2 + 55 + (h % 5) * 12);
    emoji(ctx, h % 3 === 0 ? '🏠' : h % 3 === 1 ? '🌲' : '🌳', x, sy, 36 + (h % 3) * 6);
  }

  // 车（俯视，会左右转）
  const bobAmp = WHEELS[S.part.wheel].bob * Math.min(1, S.speed / 120);
  const wobRot = Math.sin(S.T * 26) * S.wobble * 0.12;
  const steer = S.steer || S.touchSteer;
  drawCarTop(ctx, S.carX, CAR_Y, S.part, steer, wobRot, true);

  // 环形小地图
  drawMinimap(ctx, S, L);
}

/* ---------------- 俯视的车 ---------------- */

function drawCarTop(ctx, x, y, part, steer, wobRot, driving) {
  const color = COLORS[part.color];
  const wheel = WHEELS[part.wheel];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((steer || 0) * 0.06 + (wobRot || 0));

  // 影子
  ctx.beginPath();
  ctx.ellipse(0, 8, 30, 50, 0, 0, TAU);
  ctx.fillStyle = 'rgba(30,40,60,.2)';
  ctx.fill();

  // 车灯光锥
  if (driving) {
    const beam = ctx.createLinearGradient(0, -46, 0, -190);
    beam.addColorStop(0, 'rgba(255,244,190,.4)');
    beam.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-16, -44);
    ctx.lineTo(-36, -190);
    ctx.lineTo(36, -190);
    ctx.lineTo(16, -44);
    ctx.closePath();
    ctx.fill();
  }

  // 四个轮子（前轮随转向偏转）
  const ww = 13, wh = wheel.r + 10;
  for (const [wx, wy, front] of [[-25, -26, 1], [25, -26, 1], [-25, 32, 0], [25, 32, 0]]) {
    ctx.save();
    ctx.translate(wx, wy);
    if (front) ctx.rotate((steer || 0) * 0.25);
    rr(ctx, -ww / 2, -wh / 2, ww, wh, 4);
    ctx.fillStyle = '#343a40';
    ctx.fill();
    ctx.restore();
  }

  // 车身
  rr(ctx, -23, -46, 46, 92, 12);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 尾翼
  if (part.spoiler > 0) {
    const big = part.spoiler === 2;
    ctx.fillStyle = shade(color, -0.35);
    rr(ctx, big ? -27 : -22, big ? 40 : 38, big ? 54 : 44, big ? 11 : 8, 4);
    ctx.fill();
  }

  // 挡风玻璃
  rr(ctx, -17, -12, 34, 30, 8);
  ctx.fillStyle = '#dff3ff';
  ctx.fill();

  // 车头灯
  drawLight(ctx, -14, -44, part.light, 0.8, driving);
  drawLight(ctx, 14, -44, part.light, 0.8, driving);

  ctx.restore();
}

/* ---------------- 侧视的车（车库改装台上用） ---------------- */

function drawCar(ctx, cx, groundY, part, angle, bob, scale, driving, speed, wobRot) {
  const wheel = WHEELS[part.wheel];
  const color = COLORS[part.color];
  const r = wheel.r * scale;
  const bodyW = 170 * scale;
  const bodyH = 46 * scale;
  const bodyBottom = groundY - r + 12 * scale + bob;
  const bodyTop = bodyBottom - bodyH;

  ctx.save();
  if (wobRot) {
    ctx.translate(cx, groundY - r);
    ctx.rotate(wobRot);
    ctx.translate(-cx, -(groundY - r));
  }

  // 尾翼（画在车身后面）
  if (part.spoiler > 0) {
    const big = part.spoiler === 2;
    const wy = bodyTop - (big ? 30 : 18) * scale;
    ctx.fillStyle = shade(color, -0.35);
    rr(ctx, cx - 44 * scale, wy + 8 * scale, 9 * scale, (big ? 34 : 22) * scale, 3 * scale);
    ctx.fill();
    rr(ctx, cx - 92 * scale, wy, 56 * scale, (big ? 13 : 9) * scale, 4 * scale);
    ctx.fill();
  }

  // 影子
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 6, 100 * scale, 11 * scale, 0, 0, TAU);
  ctx.fillStyle = 'rgba(40,40,60,.18)';
  ctx.fill();

  // 车身
  rr(ctx, cx - 85 * scale, bodyTop, bodyW, bodyH, 16 * scale);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 车舱 + 车窗
  rr(ctx, cx - 46 * scale, bodyTop - 38 * scale, 92 * scale, 44 * scale, 14 * scale);
  ctx.fillStyle = shade(color, -0.08);
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.3);
  ctx.stroke();
  rr(ctx, cx - 35 * scale, bodyTop - 30 * scale, 70 * scale, 26 * scale, 8 * scale);
  ctx.fillStyle = '#dff3ff';
  ctx.fill();

  // 司机就是本局主角
  avatar.hero(ctx, cx + 6 * scale, bodyTop - 16 * scale, 10.5 * scale, { ringW: 2 });

  // 车头灯
  const lx = cx + 76 * scale, ly = bodyTop + 14 * scale;
  drawLight(ctx, lx, ly, part.light, scale, driving);
  // 尾灯
  rr(ctx, cx - 84 * scale, bodyTop + 12 * scale, 7 * scale, 12 * scale, 2 * scale);
  ctx.fillStyle = '#fa5252';
  ctx.fill();

  // 门把手
  rr(ctx, cx + 4 * scale, bodyTop + 16 * scale, 16 * scale, 4 * scale, 2 * scale);
  ctx.fillStyle = shade(color, -0.3);
  ctx.fill();

  // 轮子
  for (const wx of [cx - 52 * scale, cx + 52 * scale]) {
    drawWheel(ctx, wx, groundY - r + bob, r, part.wheel === 2, part.wheel === 1, angle);
  }

  ctx.restore();
}

function drawWheel(ctx, x, y, r, offroad, flower, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = '#343a40';
  ctx.fill();
  if (offroad) {
    ctx.fillStyle = '#495057';
    for (let i = 0; i < 10; i++) {
      const a = angle * 0.5 + (i * TAU) / 10;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, TAU);
  ctx.fillStyle = '#dee2e6';
  ctx.fill();
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  const spokes = flower ? 6 : 4;
  for (let i = 0; i < spokes; i++) {
    const a = angle + (i * TAU) / spokes;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46);
    ctx.stroke();
  }
  ctx.restore();
}

/** 车灯形状：0 圆圆灯 1 方方灯 2 星星灯。glow 时带光晕 */
function drawLight(ctx, x, y, type, scale, glow) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = 'rgba(255,244,190,.95)';
    ctx.shadowBlur = 12 * scale;
  }
  ctx.fillStyle = '#fff8d6';
  ctx.strokeStyle = '#f0a202';
  ctx.lineWidth = 2;
  if (type === 1) {
    rr(ctx, x - 9 * scale, y - 8 * scale, 18 * scale, 16 * scale, 3 * scale);
    ctx.fill();
    ctx.stroke();
  } else if (type === 2) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      const a2 = a + TAU / 10;
      ctx.lineTo(x + Math.cos(a) * 11 * scale, y + Math.sin(a) * 11 * scale);
      ctx.lineTo(x + Math.cos(a2) * 5 * scale, y + Math.sin(a2) * 5 * scale);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, 9 * scale, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- 环形小地图 ---------------- */

/** 路线图：整条环形赛道 + 车身色的车点 + 前方雪糕筒小橙点 */
function drawMinimap(ctx, S, L) {
  const cx = L.W - 76, cy = 104, r = 40;
  const prog = Math.min(1, S.dist / L.GOAL);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 7;
  ctx.stroke();
  if (prog > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 前方雪糕筒：路线图上一目了然
  const c0 = Math.max(0, Math.floor(S.dist / L.CONE_GAP));
  for (let i = c0; i < c0 + 6; i++) {
    const wx = i * L.CONE_GAP + 900;
    if (wx < S.dist) continue;
    const a = -Math.PI / 2 + TAU * ((wx % L.GOAL) / L.GOAL);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4, 0, TAU);
    ctx.fillStyle = '#ff922b';
    ctx.fill();
  }
  emoji(ctx, '🏁', cx, cy - r - 18, 20);
  const a = -Math.PI / 2 + TAU * prog;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 8, 0, TAU);
  ctx.fillStyle = COLORS[S.part.color];
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, Math.round(prog * 100) + '%', cx, cy + 2, '800', 15, '#ffffff');
  ctx.restore();
}

function drawFinish(ctx, S, L) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.86)';
  ctx.fillRect(0, 0, L.W, L.H);
  text(ctx, '到达终点！', L.W / 2, 140, '800', 52, '#7048e8');
  emoji(ctx, '🏆', L.W / 2 - 96, 250, 62);
  avatar.hero(ctx, L.W / 2, 250, 36, { ringW: 4 });
  emoji(ctx, '🎉', L.W / 2 + 96, 250, 56);
  const m = Math.floor(S.driveT / 60);
  const sec = Math.floor(S.driveT % 60);
  text(ctx, '10 公里环形赛道跑完啦！用时 ' + m + ' 分 ' + (sec < 10 ? '0' : '') + sec + ' 秒',
    L.W / 2, 344, '800', 25, '#2b3550');
  text(ctx, '捡到 ' + S.starCount + ' 颗星星', L.W / 2, 390, '700', 20, '#7a849e');
  text(ctx, '点一下回车库，改辆车再跑！', L.W / 2, 440, '800', 22, '#7048e8');
  ctx.restore();
}
