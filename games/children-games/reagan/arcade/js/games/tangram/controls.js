/* =====================================================================
   games/tangram/controls.js — 七巧板 · 控制层：拖动 / 点按旋转
   ===================================================================== */

export function createControls() {
  return {
    keys: {},
    pointer(game, p, type) {
      if (type === 'down') game.down(p.x, p.y);
      else if (type === 'move') game.move(p.x, p.y);
      else if (type === 'up') game.up(p.x, p.y);
    }
  };
}
