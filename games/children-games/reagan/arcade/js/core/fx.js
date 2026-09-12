/* =====================================================================
   core/fx.js — 粒子 / 飘字特效（所有游戏共用）
   游戏逻辑只需调 FX.burst() / FX.text()，真正的绘制由主循环统一负责。
   ===================================================================== */
import { TAU, rand, pick, FONT_MONO } from './util.js';

const MAX_PARTS = 420;

export const FX = {
  parts: [],
  texts: [],

  /** 在 (x,y) 炸开一簇粒子。colors 可以是单色或颜色数组 */
  burst(x, y, colors, n, scale) {
    if (this.parts.length > MAX_PARTS) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(50, 300) * (scale || 1);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life: rand(0.45, 0.95),
        max: 0.95,
        r: rand(2, 5.5) * (scale || 1),
        c: Array.isArray(colors) ? pick(colors) : colors,
        star: Math.random() < 0.35
      });
    }
  },

  /** 向上飘的文字，比如 "+300" */
  text(x, y, t, color, size) {
    this.texts.push({ x, y, t, c: color || '#fff', s: size || 20, life: 1, max: 1 });
  },

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
      p.vx *= 1 - 1.8 * dt;
      p.vy *= 1 - 0.7 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt * 0.85;
      t.y -= 46 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  },

  draw(g) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = a;
      g.fillStyle = p.c;
      if (p.star) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(a * 6);
        g.scale(a, a);
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const a1 = -Math.PI / 2 + (k * TAU) / 5;
          const a2 = a1 + TAU / 10;
          g.lineTo(Math.cos(a1) * p.r * 1.9, Math.sin(a1) * p.r * 1.9);
          g.lineTo(Math.cos(a2) * p.r * 0.85, Math.sin(a2) * p.r * 0.85);
        }
        g.closePath();
        g.fill();
        g.restore();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, p.r * a, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = Math.min(1, t.life * 1.6);
      g.globalAlpha = a;
      g.font = '800 ' + t.s + 'px ' + FONT_MONO;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.strokeText(t.t, t.x, t.y);
      g.fillStyle = t.c;
      g.fillText(t.t, t.x, t.y);
    }
    g.globalAlpha = 1;
  },

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
  }
};
