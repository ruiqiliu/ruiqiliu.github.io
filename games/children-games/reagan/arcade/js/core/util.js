/* =====================================================================
   core/util.js — 纯工具函数
   只放不依赖 DOM、不保存状态的数学 / 颜色 / 几何 / 字体常量。
   ===================================================================== */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a, b, k) => a + (b - a) * k;

/** 圆角矩形路径（只建路径，填充/描边由调用方决定） */
export function rr(g, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
}

function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** '#ff0000' + 0.5 → 'rgba(255,0,0,0.5)' */
export function rgba(hex, a) {
  const c = hex2rgb(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}

/** 提亮 / 压暗一个颜色。amt > 0 提亮，amt < 0 压暗 */
export function shade(hex, amt) {
  const c = hex2rgb(hex);
  const f = (x) =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? x + (255 - x) * amt : x * (1 + amt))));
  return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
}

/**
 * 圆 vs 矩形碰撞检测。
 * 返回 null 表示没碰上；否则返回 { nx, ny, pen }：
 * 法线方向 + 穿透深度（把圆心沿法线推 pen 距离即可分离）。
 */
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const px = clamp(cx, rx, rx + rw);
  const py = clamp(cy, ry, ry + rh);
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;

  let nx, ny, pen;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
    pen = r - d;
  } else {
    // 圆心正好在矩形内部：朝最近的那条边推出去
    const l = cx - rx;
    const right = rx + rw - cx;
    const t = cy - ry;
    const b = ry + rh - cy;
    const m = Math.min(l, right, t, b);
    if (m === l) { nx = -1; ny = 0; pen = l + r; }
    else if (m === right) { nx = 1; ny = 0; pen = right + r; }
    else if (m === t) { nx = 0; ny = -1; pen = t + r; }
    else { nx = 0; ny = 1; pen = b + r; }
  }
  return { nx, ny, pen };
}

/** Canvas 字体栈：界面文字 / 表情符号 / 等宽数字 */
export const FONT_UI = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
export const FONT_EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
export const FONT_MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
