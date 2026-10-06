/* =====================================================================
   games/garage/view.js — 车库大师 · UI 层
   车库场景：车停在改装平台上，右侧面板四个零件类别（◀ ▶ 换），
   预览全是画出来的图形 —— 五岁小朋友不识字也能玩。
   公路场景：天空 / 远山 / 路边风景向后滚，车轮回转、车身颠簸、
   车灯发光，油门越深引擎声越高。
   ===================================================================== */
import { TAU, rr, shade, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';
import { avatar } from '../../core/avatar.js';
import { WHEELS, LIGHTS, SPOILERS, COLORS } from './parts.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad wide" data-act="start">🔧 出发！</button>' +
    '<button class="pad wide" data-act="gas">🛞 油门</button>' +
    '<button class="pad" data-act="brake">🛑 刹车</button>' +
    '<button class="pad" data-act="garage">🏠 车库</button>' +
  '</div>';

export const HINT =
  '车库：点 ◀ ▶ 换零件，点绿色「出发」上路 · ' +
  '路上：按住「油门」跑、「刹车」减速，撞到雪糕筒会慢下来 · ' +
  '绕完 20 公里环形赛道就到终点！';

export function hud(S) {
  if (S.phase === 'build') return [['阶段', '车库造车'], ['选好零件', '就出发！']];
  return [
    ['里程', (S.dist / 10 / 1000).toFixed(2) + ' / 20 km'],
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
    drawCar(ctx, 280, 470, S.part, 0, Math.sin(S.T * 2) * 2, 1.3, false);
    drawPanel(ctx, S);
    drawStartBtn(ctx, S.T);
  } else if (S.phase === 'finish') {
    drawDrive(ctx, S, L);
    drawFinish(ctx, S, L);
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

    // 圆形箭头
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

/* ---------------- 公路 ---------------- */

let sky = null;
function makeSky(L) {
  const { canvas, ctx: g } = surface.offscreen(L.W, L.H);
  const grad = g.createLinearGradient(0, 0, 0, L.GROUND);
  grad.addColorStop(0, '#7cc7f5');
  grad.addColorStop(0.7, '#c8ecff');
  grad.addColorStop(1, '#eef9ff');
  g.fillStyle = grad;
  g.fillRect(0, 0, L.W, L.GROUND);
  // 太阳
  const sun = g.createRadialGradient(640, 96, 10, 640, 96, 80);
  sun.addColorStop(0, 'rgba(255,244,190,1)');
  sun.addColorStop(0.4, 'rgba(255,240,160,.55)');
  sun.addColorStop(1, 'rgba(255,240,160,0)');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(640, 96, 80, 0, TAU);
  g.fill();
  return canvas;
}

function drawDrive(ctx, S, L) {
  if (!sky) sky = makeSky(L);
  ctx.drawImage(sky, 0, 0, L.W, L.GROUND);

  // 远山（慢速视差）
  const hillOff = (S.dist * 0.2) % 260;
  for (let x = -hillOff - 260; x < L.W + 260; x += 260) {
    ctx.fillStyle = '#bfe8c8';
    ctx.beginPath();
    ctx.arc(x, L.GROUND + 30, 150, Math.PI, 0);
    ctx.fill();
  }
  const hillOff2 = (S.dist * 0.35) % 200;
  for (let x = -hillOff2 - 200; x < L.W + 200; x += 200) {
    ctx.fillStyle = '#a5ddb4';
    ctx.beginPath();
    ctx.arc(x, L.GROUND + 40, 110, Math.PI, 0);
    ctx.fill();
  }

  // 路边风景（与路面同速）
  const i0 = Math.floor(S.dist / 240) - 1;
  for (let i = i0; i < i0 + Math.ceil(L.W / 240) + 2; i++) {
    if (i < 0) continue;
    const h = ((i * 2654435761) >>> 0);
    const x = i * 240 + (h % 140) - S.dist;
    if (x < -60 || x > L.W + 60) continue;
    const kind = h % 3;
    emoji(ctx, kind === 0 ? '🌲' : kind === 1 ? '🏠' : '🌳', x, L.GROUND - 34, 40 + (h % 3) * 6);
  }

  // 星星
  const s0 = Math.max(1, Math.floor((S.dist - 60) / 260));
  for (let i = s0; i <= s0 + Math.ceil(L.W / 260) + 2; i++) {
    const wx = i * 260;
    if (S.got.has(wx)) continue;
    const x = wx - S.dist + L.CAR_X;
    if (x < -40 || x > L.W + 40) continue;
    const y = L.GROUND - 120 + Math.sin(S.T * 3 + i) * 8;
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(S.T * 5 + i) * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, TAU);
    ctx.fillStyle = 'rgba(255,212,59,.6)';
    ctx.fill();
    ctx.restore();
    emoji(ctx, '⭐', x, y, 32);
  }

  // 路面
  ctx.fillStyle = '#595c66';
  ctx.fillRect(0, L.GROUND, L.W, 62);
  ctx.fillStyle = '#f1f3f5';
  ctx.fillRect(0, L.GROUND, L.W, 4);
  ctx.fillRect(0, L.GROUND + 58, L.W, 4);
  ctx.fillStyle = '#ffd43b';
  const dash = (S.dist % 90) - 90;
  for (let x = dash; x < L.W + 90; x += 90) ctx.fillRect(x, L.GROUND + 27, 46, 8);
  ctx.fillStyle = '#8fd96a';
  ctx.fillRect(0, L.GROUND + 62, L.W, L.H - L.GROUND - 62);

  // 雪糕筒路障（撞倒的画成倒地）
  const c0 = Math.max(0, Math.floor(S.dist / L.CONE_GAP) - 1);
  for (let i = c0; i <= c0 + Math.ceil(L.W / L.CONE_GAP) + 2; i++) {
    const wx = i * L.CONE_GAP + 900;
    const x = wx - S.dist + L.CAR_X;
    if (x < -40 || x > L.W + 40) continue;
    const hit = S.coneHits.has(wx);
    ctx.save();
    ctx.translate(x, L.GROUND + 24);
    if (hit) { ctx.rotate(Math.PI / 2.2); ctx.globalAlpha = 0.55; }
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(13, 0); ctx.lineTo(-13, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, -16, 16, 5);
    rr(ctx, -16, -2, 32, 6, 3);
    ctx.fill();
    ctx.restore();
  }

  // 车（撞过雪糕筒会晃一阵）
  const bobAmp = WHEELS[S.part.wheel].bob * Math.min(1, S.speed / 120);
  const bob = Math.sin(S.wheelAngle * 0.9) * bobAmp;
  const wobRot = Math.sin(S.T * 26) * S.wobble * 0.1;
  drawCar(ctx, L.CAR_X, L.GROUND, S.part, S.wheelAngle, bob, 1, true, S.speed, wobRot);

  // 环形赛道小地图
  drawMinimap(ctx, S, L);

  // 高速时的速度线
  if (S.speed > 240) {
    ctx.save();
    ctx.globalAlpha = (S.speed - 240) / 200;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const y = 120 + i * 70 + (i % 2) * 30;
      const len = 60 + (i * 37) % 60;
      const x = L.W - ((S.dist * 1.5 + i * 173) % (L.W + 200));
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }
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

/* ---------------- 画一辆车（两个场景共用） ---------------- */

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

  // 司机就是本局主角：车里的小朋友也是同一张脸
  avatar.hero(ctx, cx + 6 * scale, bodyTop - 16 * scale, 10.5 * scale, { ringW: 2 });

  // 车头灯（驾驶时带光锥）
  const lx = cx + 76 * scale, ly = bodyTop + 14 * scale;
  if (driving) {
    const beam = ctx.createLinearGradient(lx, ly, lx + 190 * scale, ly);
    beam.addColorStop(0, 'rgba(255,244,190,.4)');
    beam.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx, ly - 10 * scale);
    ctx.lineTo(lx + 200 * scale, ly - 40 * scale);
    ctx.lineTo(lx + 200 * scale, ly + 46 * scale);
    ctx.lineTo(lx, ly + 12 * scale);
    ctx.closePath();
    ctx.fill();
  }
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

/** 环形赛道小地图：车身颜色的点绕圈，亮黄弧是已跑进度 */
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
  text(ctx, '20 公里环形赛道跑完啦！用时 ' + m + ' 分 ' + (sec < 10 ? '0' : '') + sec + ' 秒',
    L.W / 2, 344, '800', 25, '#2b3550');
  text(ctx, '捡到 ' + S.starCount + ' 颗星星', L.W / 2, 390, '700', 20, '#7a849e');
  text(ctx, '点一下回车库，改辆车再跑！', L.W / 2, 440, '800', 22, '#7048e8');
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

