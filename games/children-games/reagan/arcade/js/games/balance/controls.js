/* =====================================================================
   games/balance/controls.js — 天平称重 · 控制层：点砝码放上/取下
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.tap(p.x, p.y);
    }
  };
}
