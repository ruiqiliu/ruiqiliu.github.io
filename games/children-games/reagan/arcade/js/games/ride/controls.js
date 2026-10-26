/* =====================================================================
   games/ride/controls.js — 环国骑行 · 控制层
   按住 ▶ / 空格 / 画面任意位置 = 踩踏板；A = 自动骑开关；M = 直达下一个景点
   ===================================================================== */

export function createControls() {
  return {
    keys: {
      arrowright: 'pedal',
      d: 'pedal',
      ' ': 'pedal',
      a: 'auto',
      m: 'lv1'
    },

    pointer(game, p, type) {
      if (type === 'down') game.action('pedal', true);
      else if (type === 'up') game.action('pedal', false);
    }
  };
}
