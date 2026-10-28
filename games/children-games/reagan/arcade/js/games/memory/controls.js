/* =====================================================================
   games/memory/controls.js — 翻牌记忆 · 控制层：点牌即翻
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.tap(p.x, p.y);
    }
  };
}
