/* =====================================================================
   games/blocks/controls.js — 数积木 · 控制层：点答案
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.tap(p.x, p.y);
    }
  };
}
