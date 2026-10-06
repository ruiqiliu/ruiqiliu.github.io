/* =====================================================================
   games/g1024/controls.js — 1024 合并 · 控制层
   方向键 / WASD / 画布上滑动 → up·down·left·right；
   数字键换棋盘大小，空格在结束后重来
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
      ' ': 'confirm',
      enter: 'confirm',
      '1': 'd3',
      '2': 'd4',
      '3': 'd5'
    },

    /** 画布上滑动 → 方向（和迷宫探险同一种手感） */
    pointer(game, p, type) {
      if (type === 'down') { swipe = { x: p.x, y: p.y }; return; }
      if (type === 'up') { swipe = null; return; }
      if (type !== 'move' || !swipe) return;

      const dx = p.x - swipe.x;
      const dy = p.y - swipe.y;
      if (Math.hypot(dx, dy) < 30) return;

      game.action(
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'),
        true
      );
      swipe = null;
    }
  };
}
