/* =====================================================================
   games/snake/controls.js — 贪吃蛇 · 控制层
   方向键 / WASD → up·down·left·right；空格与点击 → confirm（重开一局）
   ===================================================================== */

export function createControls() {
  /** 滑动手势的起点，手指离开后清空 */
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
      ' ': 'confirm'
    },

    pointer(game, p, type) {
      if (type === 'down') {
        game.action('confirm', true);   // 结束状态下点击 = 再来一局
        swipe = { x: p.x, y: p.y };
        return;
      }
      if (type === 'up') { swipe = null; return; }
      if (type !== 'move' || !swipe) return;

      const dx = p.x - swipe.x;
      const dy = p.y - swipe.y;
      if (Math.hypot(dx, dy) < 26) return;   // 太小幅度的抖动忽略掉

      game.action(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), true);
      swipe = null;
    }
  };
}
