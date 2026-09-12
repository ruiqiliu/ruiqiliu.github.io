/* =====================================================================
   games/maze/controls.js — 迷宫探险 · 控制层
   方向键 / WASD / 滑动 → up·down·left·right；H 或提示键 → hint
   ===================================================================== */

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
      if (type === 'down') { swipe = { x: p.x, y: p.y }; return; }
      if (type === 'up') { swipe = null; return; }
      if (type !== 'move' || !swipe) return;

      const dx = p.x - swipe.x;
      const dy = p.y - swipe.y;
      if (Math.hypot(dx, dy) < 30) return;

      game.action(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), true);
      swipe = null;
    }
  };
}
