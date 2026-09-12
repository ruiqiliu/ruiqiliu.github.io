/* =====================================================================
   games/moto/view.js — 暴力摩托 · UI 层
   伪 3D（Outrun 式）公路渲染：把赛段投影成梯形，由远及近铺满屏幕。
   投影用的 p1/p2 是每段赛段上的暂存字段（camera / screen），
   它们只是渲染用的草稿纸，不参与游戏规则。
   ===================================================================== */
import { TAU, clamp, rand, lerp, rr, FONT_UI, FONT_EMOJI } from '../../core/util.js';
import { surface } from '../../core/surface.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="right">▶</button>' +
    '<button class="pad wide" data-act="punch">👊 出拳</button>' +
    '<button class="pad" data-act="brake">刹车</button>' +
  '</div>';

export const HINT =
  '<kbd>←</kbd><kbd>→</kbd> 变道 · <kbd>↑</kbd> 加速 · <kbd>↓</kbd> 刹车 · <kbd>空格</kbd> 出拳别车 · ' +
  '会自动往前开，专心超车和躲雪糕筒就行';

export function hud(S) {
  return [
    ['得分', S.score],
    ['名次', '第 ' + S.rank + ' 名'],
    ['爱心', '❤️'.repeat(Math.max(0, S.hearts)) || '—']
  ];
}

/** 预渲染天空 + 云 + 远山，只覆盖地平线以上那一条 */
export function makeSky(L) {
  const skyH = Math.round(L.HORIZON + 10);
  const { canvas: c, ctx: g } = surface.offscreen(L.W, skyH);

  const grd = g.createLinearGradient(0, 0, 0, skyH);
  grd.addColorStop(0, '#5db9f5');
  grd.addColorStop(0.55, '#a8ddff');
  grd.addColorStop(1, '#e7f6ff');
  g.fillStyle = grd;
  g.fillRect(0, 0, L.W, skyH);

  // 太阳
  const sx = L.W - 120;
  const sy = 76;
  const sg = g.createRadialGradient(sx, sy, 8, sx, sy, 90);
  sg.addColorStop(0, 'rgba(255,245,180,1)');
  sg.addColorStop(0.4, 'rgba(255,232,140,.55)');
  sg.addColorStop(1, 'rgba(255,232,140,0)');
  g.fillStyle = sg;
  g.beginPath();
  g.arc(sx, sy, 90, 0, TAU);
  g.fill();

  // 云
  const cloud = (x, y, s, a) => {
    g.save();
    g.globalAlpha = a;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x, y, 30 * s, 0, TAU);
    g.arc(x + 34 * s, y + 5 * s, 22 * s, 0, TAU);
    g.arc(x - 34 * s, y + 7 * s, 20 * s, 0, TAU);
    g.arc(x + 6 * s, y - 16 * s, 23 * s, 0, TAU);
    g.fill();
    g.restore();
  };
  cloud(140, 86, 1.1, 0.9);
  cloud(560, 58, 0.8, 0.75);
  cloud(330, 120, 0.55, 0.6);

  // 远山
  const hill = (x, w, h, col) => {
    g.beginPath();
    g.moveTo(x - w, skyH);
    g.quadraticCurveTo(x - w * 0.35, skyH - h * 1.25, x, skyH - h);
    g.quadraticCurveTo(x + w * 0.35, skyH - h * 1.25, x + w, skyH);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  };
  hill(120, 200, 74, '#9ad9a8');
  hill(430, 260, 96, '#87cf98');
  hill(690, 180, 64, '#a6dfb2');
  hill(300, 150, 52, '#b2e7bd');

  g.fillStyle = '#8ed49b';
  g.fillRect(0, skyH - 16, L.W, 16);

  return { canvas: c, height: skyH };
}

/* ================================================================
   渲染
   ================================================================ */

/** 找出 z 所在的赛段 */
function segAt(z, segs, L) {
  const i = clamp(Math.floor(z / L.SEGLEN), 0, segs.length - 1);
  return segs[i];
}

/** 世界坐标 → 屏幕坐标（透视投影） */
function project(p, camX, camY, camZ, L) {
  p.camera.x = -camX;
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;

  const s = L.CAM_DEPTH / Math.max(1, p.camera.z);
  p.screen.scale = s;
  p.screen.x = L.W / 2 + s * p.camera.x * (L.W / 2);
  p.screen.y = L.HORIZON - s * p.camera.y * (L.H / 2);
  p.screen.w = s * L.ROADW * (L.W / 2);
}

function poly(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** 一段路面：路肩 + 路面 + 车道线 */
function renderSegment(ctx, seg, L) {
  const p1 = seg.p1.screen;
  const p2 = seg.p2.screen;
  const isFinish = Math.abs(seg.index - L.FINISH_SEG) <= 3;
  const r1 = p1.w * L.RUMBLE_R;
  const r2 = p2.w * L.RUMBLE_R;
  const rum = isFinish ? (seg.index % 2 ? '#ffffff' : '#2b2f3a') : seg.alt ? '#ff6b6b' : '#ffffff';
  const road = seg.alt ? '#59616e' : '#525a66';

  poly(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rum);
  poly(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rum);
  poly(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, road);

  if (!isFinish && seg.alt) {
    const l1 = p1.w * 0.018;
    const l2 = p2.w * 0.018;
    for (let i = 1; i < L.LANES; i++) {
      const q = i / L.LANES;
      const ax1 = p1.x - p1.w + p1.w * 2 * q;
      const ax2 = p2.x - p2.w + p2.w * 2 * q;
      poly(ctx, ax1 - l1, p1.y, ax1 + l1, p1.y, ax2 + l2, p2.y, ax2 - l2, p2.y, 'rgba(255,255,255,.92)');
    }
  }
}

/** 一辆摩托（后方视角）。lean 是倾斜，punch 是出拳，ghost 半透明 */
export function drawBike(g, cx, by, bw, col, lean, punch, ghost) {
  const h = bw * 1.15;
  g.save();
  g.translate(cx, by);
  g.rotate(lean * 0.15);
  if (ghost) g.globalAlpha = 0.55;

  // 影子
  g.beginPath();
  g.ellipse(0, -1, bw * 0.5, bw * 0.13, 0, 0, TAU);
  g.fillStyle = 'rgba(20,30,20,.28)';
  g.fill();

  // 后轮
  rr(g, -bw * 0.145, -h * 0.40, bw * 0.29, h * 0.40, bw * 0.10); g.fillStyle = '#2c313d'; g.fill();
  rr(g, -bw * 0.095, -h * 0.33, bw * 0.19, h * 0.21, bw * 0.07); g.fillStyle = '#535a6b'; g.fill();

  // 排气筒
  rr(g, bw * 0.15, -h * 0.32, bw * 0.13, h * 0.27, bw * 0.05); g.fillStyle = '#ccd2de'; g.fill();
  rr(g, -bw * 0.28, -h * 0.32, bw * 0.13, h * 0.27, bw * 0.05); g.fillStyle = '#ccd2de'; g.fill();

  // 车身
  rr(g, -bw * 0.30, -h * 0.66, bw * 0.60, h * 0.36, bw * 0.13); g.fillStyle = col; g.fill();
  rr(g, -bw * 0.24, -h * 0.62, bw * 0.48, h * 0.09, bw * 0.04);
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();

  // 座
  rr(g, -bw * 0.22, -h * 0.76, bw * 0.44, h * 0.13, bw * 0.06); g.fillStyle = '#343a4d'; g.fill();

  // 腿
  rr(g, -bw * 0.30, -h * 0.60, bw * 0.14, h * 0.27, bw * 0.06); g.fillStyle = '#3d4c66'; g.fill();
  rr(g, bw * 0.16, -h * 0.60, bw * 0.14, h * 0.27, bw * 0.06); g.fillStyle = '#3d4c66'; g.fill();

  // 身体
  rr(g, -bw * 0.24, -h * 1.00, bw * 0.48, h * 0.36, bw * 0.12); g.fillStyle = '#f08c00'; g.fill();
  rr(g, -bw * 0.20, -h * 0.96, bw * 0.40, h * 0.10, bw * 0.05);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();

  // 手把
  rr(g, -bw * 0.46, -h * 0.86, bw * 0.92, h * 0.05, bw * 0.03); g.fillStyle = '#2c313d'; g.fill();

  // 手臂
  const p = punch ? 1 : 0;
  rr(g, -bw * 0.24, -h * 0.90, bw * 0.16 + p * bw * 0.10, h * 0.10, bw * 0.05); g.fillStyle = '#f08c00'; g.fill();
  rr(g, bw * 0.08, -h * 0.90, bw * 0.16, h * 0.10, bw * 0.05); g.fillStyle = '#f08c00'; g.fill();
  if (punch) {
    g.beginPath();
    g.arc(-bw * 0.46 - p * bw * 0.10, -h * 0.86, bw * 0.10, 0, TAU);
    g.fillStyle = '#ffd8a8';
    g.fill();
  }

  // 头盔
  g.beginPath(); g.arc(0, -h * 1.03, bw * 0.185, 0, TAU); g.fillStyle = '#f1f3f5'; g.fill();
  g.beginPath(); g.arc(0, -h * 1.03, bw * 0.185, Math.PI * 0.15, Math.PI * 0.85); g.fillStyle = '#343a4d'; g.fill();
  rr(g, -bw * 0.185, -h * 1.09, bw * 0.37, h * 0.05, bw * 0.025); g.fillStyle = col; g.fill();

  g.restore();
}

function drawTree(g, x, y, s, col, kind) {
  if (kind === 'bush') {
    g.beginPath();
    g.arc(x, y - s * 0.5, s * 0.75, 0, TAU);
    g.arc(x - s * 0.6, y - s * 0.25, s * 0.55, 0, TAU);
    g.arc(x + s * 0.6, y - s * 0.25, s * 0.55, 0, TAU);
    g.fillStyle = '#57c26a';
    g.fill();
    return;
  }
  if (kind === 'sign') {
    g.fillStyle = '#9aa3b5';
    g.fillRect(x - s * 0.07, y - s * 1.9, s * 0.14, s * 1.9);
    rr(g, x - s * 0.75, y - s * 2.75, s * 1.5, s * 1.0, s * 0.14);
    g.fillStyle = col;
    g.fill();
    rr(g, x - s * 0.55, y - s * 2.5, s * 1.1, s * 0.16, s * 0.06);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fill();
    return;
  }
  g.fillStyle = '#8b6b4a';
  g.fillRect(x - s * 0.09, y - s * 1.0, s * 0.18, s * 1.0);
  g.beginPath(); g.arc(x, y - s * 1.55, s * 0.85, 0, TAU); g.fillStyle = '#3fa85c'; g.fill();
  g.beginPath(); g.arc(x - s * 0.45, y - s * 1.15, s * 0.52, 0, TAU); g.fillStyle = '#4bbc69'; g.fill();
  g.beginPath(); g.arc(x + s * 0.45, y - s * 1.15, s * 0.52, 0, TAU); g.fillStyle = '#4bbc69'; g.fill();
  g.beginPath(); g.arc(x - s * 0.2, y - s * 2.05, s * 0.5, 0, TAU); g.fillStyle = '#57cd75'; g.fill();
}

function drawCone(g, x, y, s) {
  g.beginPath();
  g.ellipse(x, y, s * 0.5, s * 0.13, 0, 0, TAU);
  g.fillStyle = 'rgba(20,30,20,.25)';
  g.fill();

  g.beginPath();
  g.moveTo(x - s * 0.34, y);
  g.lineTo(x - s * 0.10, y - s * 1.1);
  g.lineTo(x + s * 0.10, y - s * 1.1);
  g.lineTo(x + s * 0.34, y);
  g.closePath();
  g.fillStyle = '#ff922b';
  g.fill();

  g.fillStyle = '#fff';
  g.fillRect(x - s * 0.25, y - s * 0.62, s * 0.5, s * 0.18);
  rr(g, x - s * 0.44, y - s * 0.14, s * 0.88, s * 0.16, s * 0.06);
  g.fillStyle = '#f08c00';
  g.fill();
}

/* ---------------------------------------------------------------- */

export function draw(ctx, S, L) {
  ctx.save();
  if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake * 9, rand(-1, 1) * S.shake * 9);
  if (S.wobble > 0) ctx.translate(Math.sin(S.t * 34) * S.wobble * 16, 0);

  // 天空 + 草地
  ctx.drawImage(S.sky, 0, 0, L.W, S.skyH);
  const gg = ctx.createLinearGradient(0, L.HORIZON, 0, L.H);
  gg.addColorStop(0, '#7ed957');
  gg.addColorStop(1, '#63c842');
  ctx.fillStyle = gg;
  ctx.fillRect(0, L.HORIZON, L.W, L.H - L.HORIZON);

  const drawn = drawRoad(ctx, S, L);
  drawEntities(ctx, S, L, drawn);
  drawPlayer(ctx, S, L);
  drawSpeedLines(ctx, S, L);

  ctx.restore();

  drawSpeedometer(ctx, S, L);
  if (S.redFlash > 0) {
    ctx.fillStyle = 'rgba(255,60,60,' + (S.redFlash * 0.35).toFixed(3) + ')';
    ctx.fillRect(0, 0, L.W, L.H);
  }
  drawFinishOverlay(ctx, S, L);
}

/** 由远及近铺路，返回这一帧真正画出来的赛段（给实体排序用） */
function drawRoad(ctx, S, L) {
  const base = segAt(S.position, S.segs, L);
  const basePct = (S.position % L.SEGLEN) / L.SEGLEN;

  let x = 0;
  let dx = -(base.curve * basePct);
  let maxy = L.H;
  const drawn = [];

  for (let n = 0; n < L.DRAW_DIST; n++) {
    const seg = S.segs[(base.index + n) % S.segs.length];
    project(seg.p1, S.playerX * L.ROADW - x, L.CAM_H, S.position, L);
    project(seg.p2, S.playerX * L.ROADW - x - dx, L.CAM_H, S.position, L);
    x += dx;
    dx += seg.curve;
    drawn.push(seg);

    if (seg.p1.camera.z <= L.CAM_DEPTH) continue;
    if (seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
    renderSegment(ctx, seg, L);
    maxy = seg.p2.screen.y;
  }
  return drawn;
}

/** 雪糕筒 / 树 / 对手：统一按 z 从远到近画，保证遮挡关系正确 */
function drawEntities(ctx, S, L, drawn) {
  const ents = [];
  const rivalBySeg = {};
  for (const r of S.rivals) {
    if (r.state === 'gone') continue;
    const k = Math.floor(r.z / L.SEGLEN);
    (rivalBySeg[k] || (rivalBySeg[k] = [])).push(r);
  }

  // 赛段内的某个物体 → 屏幕坐标（按段落内的比例插值）
  const place = (seg, z, off) => {
    const i = clamp((z % L.SEGLEN) / L.SEGLEN, 0, 1);
    const s = lerp(seg.p1.screen.scale, seg.p2.screen.scale, i);
    return {
      s,
      x: lerp(seg.p1.screen.x, seg.p2.screen.x, i) + s * off * L.ROADW * (L.W / 2),
      y: lerp(seg.p1.screen.y, seg.p2.screen.y, i)
    };
  };

  for (const seg of drawn) {
    const cones = S.coneMap[seg.index];
    const props = S.propMap[seg.index];
    const rivals = rivalBySeg[seg.index];

    if (cones) {
      for (const c of cones) {
        ents.push({ z: c.z, f: () => {
          const p = place(seg, c.z, c.off);
          if (p.y > L.H + 60) return;
          drawCone(ctx, p.x, p.y, p.s * 420 * (L.W / 2));
        } });
      }
    }
    if (props) {
      for (const pr of props) {
        ents.push({ z: pr.z, f: () => {
          const p = place(seg, pr.z, pr.off);
          if (p.y > L.H + 60) return;
          drawTree(ctx, p.x, p.y, p.s * 1200 * (L.W / 2), pr.c, pr.kind);
        } });
      }
    }
    if (rivals) {
      for (const r of rivals) {
        ents.push({ z: r.z, f: () => {
          const p = place(seg, r.z, r.off);
          if (p.y > L.H + 70) return;
          const bw = clamp(
            L.BIKE_W * p.s * (L.W / 2),
            7,
            L.BIKE_W * (L.CAM_DEPTH / L.PLAYER_Z) * (L.W / 2) * 1.05
          );
          const lean = clamp((r.off - (r.prevOff == null ? r.off : r.prevOff)) * 40, -1, 1);
          drawBike(ctx, p.x, p.y, bw, r.color, r.state === 'wobble' ? Math.sin(S.t * 22) * 0.9 : lean, false, false);

          // 被别到的对手头顶冒小星星
          if (r.state === 'wobble') {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = Math.max(12, bw * 0.55) + 'px ' + FONT_EMOJI;
            ctx.fillText('💫', p.x, p.y - bw * 1.85);
            ctx.restore();
          }
        } });
      }
    }
  }

  ents.sort((a, b) => b.z - a.z);
  for (const e of ents) e.f();
}

function drawPlayer(ctx, S, L) {
  const bw = L.BIKE_W * (L.CAM_DEPTH / L.PLAYER_Z) * (L.W / 2);
  const speedPct = S.speed / L.MAX_SPEED;
  const bob = Math.sin(S.t * (12 + speedPct * 16)) * 2.4 * (0.3 + speedPct);
  drawBike(
    ctx,
    L.W / 2 + S.steer * bw * 0.10,
    L.H - 6 + bob,
    bw,
    '#f03e3e',
    S.steer + S.wobble * Math.sin(S.t * 30),
    S.atkAnim > 0,
    false
  );
}

/** 高速时的放射状速度线 */
function drawSpeedLines(ctx, S, L) {
  const pct = S.speed / L.MAX_SPEED;
  if (pct <= 0.72) return;

  const a = (pct - 0.72) / 0.28;
  ctx.save();
  ctx.globalAlpha = a * 0.35;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * TAU + S.t * 2;
    const r1 = 140 + ((S.t * 700 + i * 90) % 260);
    const r2 = r1 + 70;
    ctx.beginPath();
    ctx.moveTo(L.W / 2 + Math.cos(ang) * r1, L.HORIZON + 40 + Math.sin(ang) * r1 * 0.55);
    ctx.lineTo(L.W / 2 + Math.cos(ang) * r2, L.HORIZON + 40 + Math.sin(ang) * r2 * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpeedometer(ctx, S, L) {
  const prog = clamp((S.position + L.PLAYER_Z) / L.FINISH_Z, 0, 1);

  rr(ctx, 36, 14, L.W - 72, 12, 6);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fill();

  rr(ctx, 36, 14, (L.W - 72) * prog, 12, 6);
  const pgr = ctx.createLinearGradient(36, 0, L.W - 36, 0);
  pgr.addColorStop(0, '#4dabf7');
  pgr.addColorStop(1, '#f06595');
  ctx.fillStyle = pgr;
  ctx.fill();

  ctx.font = '16px ' + FONT_EMOJI;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏁', L.W - 30, 20);

  ctx.font = '700 13px ' + FONT_UI;
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.fillText(Math.round(S.speed / 100) + ' km/h', 40, 46);
}

function drawFinishOverlay(ctx, S, L) {
  if (S.phase !== 'finish') return;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.84)';
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (S.crashed) {
    ctx.font = '800 46px ' + FONT_UI;
    ctx.fillStyle = '#e03131';
    ctx.fillText('摔车啦！', L.W / 2, L.H / 2 - 70);

    ctx.font = '60px ' + FONT_EMOJI;
    ctx.fillText('🏍️💥', L.W / 2, L.H / 2 + 4);

    ctx.font = '800 26px ' + FONT_UI;
    ctx.fillStyle = '#3b4a63';
    ctx.fillText('得分 ' + S.score, L.W / 2, L.H / 2 + 74);

    ctx.font = '700 19px ' + FONT_UI;
    ctx.fillStyle = '#7a849e';
    ctx.fillText('再来一次，这次躲开雪糕筒！', L.W / 2, L.H / 2 + 116);
  } else {
    ctx.font = '800 50px ' + FONT_UI;
    ctx.fillStyle = '#f06595';
    ctx.fillText(S.finishRank === 1 ? '冠军！🏆' : '第 ' + S.finishRank + ' 名！', L.W / 2, L.H / 2 - 70);

    ctx.font = '60px ' + FONT_EMOJI;
    ctx.fillText(S.finishRank === 1 ? '🥇 🎉 🥇' : '🎉', L.W / 2, L.H / 2 + 4);

    ctx.font = '800 26px ' + FONT_UI;
    ctx.fillStyle = '#3b4a63';
    ctx.fillText('得分 ' + S.score, L.W / 2, L.H / 2 + 74);

    ctx.font = '700 19px ' + FONT_UI;
    ctx.fillStyle = '#7a849e';
    ctx.fillText('第 ' + (S.level + 1) + ' 场，对手更快了！', L.W / 2, L.H / 2 + 116);
  }
  ctx.restore();
}
