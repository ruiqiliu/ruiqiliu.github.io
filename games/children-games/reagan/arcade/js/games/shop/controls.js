/* =====================================================================
   games/shop/controls.js — 购物小掌柜 · 控制层：点硬币入托盘/点托盘退回
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.tap(p.x, p.y);
    }
  };
}
