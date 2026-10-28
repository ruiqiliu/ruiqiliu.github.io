/* =====================================================================
   games/make10/controls.js — 凑十点 · 控制层：点数字块
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.tap(p.x, p.y);
    }
  };
}
