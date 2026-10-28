/* =====================================================================
   games/guess/controls.js — 猜数字 · 控制层：点数字格即可
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.tap(p.x, p.y);
    }
  };
}
