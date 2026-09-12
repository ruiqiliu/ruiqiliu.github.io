/* =====================================================================
   games/flappy/controls.js — 小鸟飞飞 · 控制层
   只有一个动作：拍翅膀。空格 / ↑ / W / 点击屏幕都算。
   ===================================================================== */

export function createControls() {
  return {
    keys: {
      ' ': 'flap',
      arrowup: 'flap',
      w: 'flap',
      enter: 'flap'
    },

    pointer(game, p, type) {
      if (type !== 'down') return;
      if (game.isOver()) {
        game.action('confirm', true);   // 撞完了先点一下重开，别立刻又飞起来
        return;
      }
      game.action('flap', true);
    }
  };
}
