/* =====================================================================
   games/moto/controls.js — 暴力摩托 · 控制层
   键盘负责变道 / 加速 / 刹车 / 出拳；
   触屏把画布按左中右分成三块：左半变道左、右半变道右、中间出拳。
   ===================================================================== */

export function createControls() {
  return {
    keys: {
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      arrowdown: 'brake',
      s: 'brake',
      arrowup: 'boost',
      w: 'boost',
      ' ': 'punch'
    },

    pointer(game, p, type) {
      const W = game.W;

      if (type === 'up') { game.action('release', true); return; }

      // 冲线后按一下可以跳过庆祝动画
      if (type === 'down') game.action('skip', true);

      // 画布中间那一条 = 出拳
      if (type === 'down' && p.x >= W * 0.36 && p.x <= W * 0.64) {
        game.action('punch', true);
        return;
      }

      if (p.x < W * 0.42) game.action('left', true);
      else if (p.x > W * 0.58) game.action('right', true);
      else game.action('center', true);
    }
  };
}
