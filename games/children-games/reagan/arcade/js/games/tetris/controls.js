/* =====================================================================
   games/tetris/controls.js — 俄罗斯方块 · 控制层
   ===================================================================== */

export function createControls() {
  return {
    keys: {
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      arrowdown: 'down',
      s: 'down',
      arrowup: 'rotate',
      w: 'rotate',
      ' ': 'drop',
      enter: 'drop'
    },

    pointer(game, p, type) {
      // 结束后点一下屏幕 = 重开
      if (type === 'down') game.action('confirm', true);
    }
  };
}
