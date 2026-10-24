/* =====================================================================
   games/maze/controls.js — 迷宫探险 · 控制层
   方向键 / WASD / 竖向滑动 → up·down·left·right；
   横向拖动 → 旋转视角（松手吸附 90°）；H 或提示键 → hint
   ===================================================================== */
import { beginOrbit, orbitTo, endOrbit } from './view.js';

export function createControls() {
  let swipe = null;

  return {
    keys: {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      h: 'hint'
    },

    pointer(game, p, type) {
      if (type === 'down') { swipe = { x: p.x, y: p.y, mode: null }; return; }
      if (type === 'up') {
        if (swipe && swipe.mode === 'orbit') endOrbit();
        swipe = null;
        return;
      }
      if (type !== 'move' || !swipe) return;

      const dx = p.x - swipe.x;
      const dy = p.y - swipe.y;

      // 已经进入旋转模式：持续跟手
      if (swipe.mode === 'orbit') { orbitTo(p.x - swipe.x); return; }

      if (Math.hypot(dx, dy) < 26) return;

      // 明显横向的拖动 = 转视角（走一步的滑动阈值更低，转视角要更横更远）
      if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 44) {
        swipe.mode = 'orbit';
        beginOrbit();
        return;
      }

      game.action(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), true);
      swipe = null;
    }
  };
}
