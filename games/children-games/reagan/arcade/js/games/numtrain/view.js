/* =====================================================================
   games/numtrain/view.js — 数字小列车 · UI 层（2D 画布）
   暖色奶油底 + 彩色积木块：车道在中间，车头（司机是本局小朋友）
   在左边，答对的车厢一节节挂上去；候选块停在下面的站台上。
   数字块上的圆点帮还不识数的小朋友「数出来」。
   ===================================================================== */
import { avatar } from '../../core/avatar.js';
import { rr } from '../../core/util.js';

export const PADS =
  '<div class="row">' +
    '<button class="pad wide" data-act="hint">💡 教我</button>' +
    '<button class="pad wide" data-act="shuffle">🔀 换一换</button>' +
  '</div>';

export const HINT =
  '<kbd>1</kbd>~<kbd>6</kbd> 或直接点下面的数字块 · ' +
  '挂车厢那关要先点一块、再点一块，加起来等于车头 · 卡住了点「教我」';

export function hud(S) {
  const lvName = ['小小列车员', '车厢排排队', '挂车厢', '数字接龙', '长长列车', '大车头', '接龙高手', '倒着开', '列车长考验'][S.level - 1] || '';
  return [
    ['关卡', `${S.level}·${lvName}`],
    ['题目', `${Math.min(S.roundIdx + 1, S.rounds.length)}/${S.rounds.length}`],
    ['星星', '⭐' + S.stars]
  ];
}

/* ---------------- 配色 ---------------- */

const C = {
  bg: '#fdf3dd',
  track: '#c8a468',
  sleeper: '#a97f45',
  engine: '#ff8787',
  engineDark: '#e8590c',
  slotEmpty: '#efe2c2',
  slotLine: '#d9c896',
  block: ['#ff6b6b', '#ffa94d', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc', '#f783ac'],
  ink: '#4a3b28',
  cream: '#fff9ec',
  good: '#40c057'
};

const BLOCK_COLORS = {};   // 数值 → 颜色（同一局里同数同色，帮孩子建立对应感）

function colorOf(v) {
  if (!BLOCK_COLORS[v]) BLOCK_COLORS[v] = C.block[Object.keys(BLOCK_COLORS).length % C.block.length];
  return BLOCK_COLORS[v];
}

/* ---------------- 绘制 ---------------- */

export function draw(ctx, S, L) {
  // 背景
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, L.W, L.H);

  // 顶部横幅：关卡名 / 任务提示
  banner(ctx, S, L);

  const r = S.round;
  if (!r) return;

  // 车头 + 车道 + 车厢槽位
  engine(ctx, S, r);
  track(ctx, S);
  slots(ctx, S, r);

  // 候选块（站台上的数字块）
  pool(ctx, S, r, L);

  // 欢呼 / 过关 覆盖层
  if (S.phase === 'cheer' || S.phase === 'win') {
    ctx.fillStyle = 'rgba(255,249,236,.55)';
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.fillStyle = C.ink;
    ctx.font = '800 40px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.phase === 'win' ? '这一关通过啦！' : '答对啦！', L.W / 2, L.H / 2 - 60);
    if (S.phase === 'win') {
      ctx.font = '800 26px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#e8590c';
      ctx.fillText('下一关马上发车…', L.W / 2, L.H / 2);
    }
    ctx.textAlign = 'left';
  }
}

function banner(ctx, S, L) {
  // 提示条
  if (S.msgT > 0 && S.msg) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, S.msgT);
    ctx.fillStyle = 'rgba(74,59,40,.88)';
    rr(ctx, L.W / 2 - 300, 16, 600, 46, 23);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.msg, L.W / 2, 47);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  const r = S.round;
  if (!r) return;
  ctx.fillStyle = C.ink;
  ctx.font = '700 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  const task =
    r.kind === 'sort'
      ? (r.desc ? '从大到小，把车厢排好' : '从小到大，把车厢排好')
      : r.kind === 'bond'
        ? `选两节车厢，加起来 = ${r.n}`
        : '接龙：挑出空位上的数字';
  ctx.fillText(task, L.W / 2, 118);
  ctx.textAlign = 'left';
}

/** 车头：司机是本局小朋友（和首页卡片同一张脸） */
function engine(ctx, S, r) {
  const x = 118, y = 292, w = 118, h = 96;

  // 车身
  ctx.fillStyle = C.engine;
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.fillStyle = C.engineDark;
  rr(ctx, x + 10, y - 26, 44, 30, 8);      // 烟囱座
  ctx.fill();
  ctx.fillStyle = '#adb5bd';
  rr(ctx, x + 18, y - 52, 28, 28, 6);      // 烟囱
  ctx.fill();

  // 司机（圆脸 = 本局头像）
  avatar.hero(ctx, x + w - 40, y + 34, 26);

  // 车头数字（bond 题显示目标数，其它题显示 ▶）
  ctx.fillStyle = '#fff';
  ctx.font = '800 44px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(r.kind === 'bond' ? String(r.n) : '▶', x + 34, y + 66);
  ctx.textAlign = 'left';

  // 车轮（转起来）
  const spin = S.phase === 'cheer' || S.phase === 'win' ? S.T * 9 : S.T * 2;
  for (const [wx, wy] of [[x + 30, y + h + 4], [x + 82, y + h + 4]]) {
    ctx.fillStyle = '#495057';
    circle(ctx, wx, wy, 15);
    ctx.fillStyle = '#ced4da';
    circle(ctx, wx + Math.cos(spin) * 4, wy + Math.sin(spin) * 4, 4);
  }

  // 烟（答对时冒得多）
  ctx.fillStyle = `rgba(180,180,180,${0.35 + Math.sin(S.T * 3) * 0.1})`;
  circle(ctx, x + 32, y - 62 - Math.sin(S.T * 2) * 6, 10 + Math.sin(S.T * 2.7) * 3);
  ctx.fillStyle = 'rgba(200,200,200,.25)';
  circle(ctx, x + 46, y - 80 - Math.sin(S.T * 1.6) * 8, 7);
}

function track(ctx, S) {
  // 车道底
  ctx.fillStyle = C.track;
  rr(ctx, 100, 396, 700, 14, 7);
  ctx.fill();
  // 枕木
  ctx.fillStyle = C.sleeper;
  for (let x = 120; x < 780; x += 46) ctx.fillRect(x, 398, 10, 10);
}

function slots(ctx, S, r) {
  S.slots.forEach((s, i) => {
    const x = s.x, y = s.y, w = s.w, h = s.h;
    if (s.v === null) {
      ctx.fillStyle = C.slotEmpty;
      rr(ctx, x, y, w, h, 16);
      ctx.fill();
      ctx.strokeStyle = C.slotLine;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 7]);
      rr(ctx, x + 4, y + 4, w - 8, h - 8, 12);
      ctx.stroke();
      ctx.setLineDash([]);
      // 第一个空位给个呼吸提示
      if (s === S.slots.find((k) => k.v === null) && S.phase === 'play') {
        ctx.strokeStyle = 'rgba(232,89,12,.6)';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -S.T * 30;
        rr(ctx, x + 2, y + 2, w - 4, h - 4, 14);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    } else {
      drawCar(ctx, x, y, w, h, s.v, s.pop, r);
    }
  });
}

function pool(ctx, S, r, L) {
  S.pool.forEach((p) => {
    if (p.v === null) return;
    ctx.save();
    if (p.shake > 0) {
      ctx.translate(Math.sin(p.shake * 40) * 6, 0);
    }
    const selected = S.sel >= 0 && S.pool[S.sel] === p;
    drawBlock(ctx, p.x, p.y, p.w, p.h, p.v, selected ? 1.06 : 1, selected);
    ctx.restore();
  });
  // bond 题在候选区上方画算式进度：5 = a + ?
  if (r.kind === 'bond') {
    const a = S.sel >= 0 ? S.pool[S.sel].v : (S.slots[0].v !== null ? S.slots[0].v : null);
    const filled = S.slots.filter((s) => s.v !== null);
    ctx.fillStyle = C.ink;
    ctx.font = '800 34px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    const t = `${r.n} = ${filled[0] ? filled[0].v : a != null ? a : '?'} + ${filled[1] ? filled[1].v : filled[0] ? '?' : '?'}`;
    ctx.fillText(t, L.W / 2, 276);
    ctx.textAlign = 'left';
  }
}

/* ---------------- 块与车厢 ---------------- */

function drawBlock(ctx, x, y, w, h, v, scale, selected) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  const col = colorOf(v);
  ctx.fillStyle = selected ? '#fff3bf' : col;
  rr(ctx, 0, 0, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(74,59,40,.25)';
  ctx.lineWidth = 3;
  rr(ctx, 0, 0, w, h, 16);
  ctx.stroke();
  // 数字
  ctx.fillStyle = '#fff';
  ctx.font = '800 44px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(v), w / 2, h / 2 + 10);
  // 圆点（帮小朋友数数；>6 个画两排）
  const dots = Math.min(v, 6);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < dots; i++) {
    const dx = w / 2 + (i % 3) * 12 - (Math.min(dots, 3) - 1) * 6;
    const dy = h - 14 - Math.floor(i / 3) * 11;
    circle(ctx, dx, dy, 3.4);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawCar(ctx, x, y, w, h, v, pop, r) {
  const k = pop > 0 ? 1 + Math.sin((1 - pop / 0.35) * Math.PI) * 0.14 : 1;
  // 挂钩杆
  ctx.strokeStyle = '#8d7355';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + h - 10);
  ctx.lineTo(x, y + h - 10);
  ctx.stroke();
  // 车轮
  for (const wx of [x + 22, x + w - 22]) {
    ctx.fillStyle = '#495057';
    circle(ctx, wx, y + h + 4, 13);
    ctx.fillStyle = '#ced4da';
    circle(ctx, wx, y + h + 4, 4);
  }
  drawBlock(ctx, x, y - (k - 1) * h, w, h, v, k, false);
}

/* ---------------- 小工具 ---------------- */

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
