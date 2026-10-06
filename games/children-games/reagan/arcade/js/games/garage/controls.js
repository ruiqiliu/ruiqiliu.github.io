/* =====================================================================
   games/garage/controls.js — 车库大师 · 控制层
   车库：点画布上的 ◀ ▶ / 出发按钮；键盘 ← → 换零件，1~4 直接选类别
   开车：按住 ↑ / W / 右半屏 = 油门，↓ / S / 左半屏 = 刹车
   ===================================================================== */

export function createControls() {
  return {
    keys: {
      arrowup: 'gas',
      w: 'gas',
      arrowdown: 'brake',
      s: 'brake',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      ' ': 'start',
      enter: 'start',
      '1': 'cat1',
      '2': 'cat2',
      '3': 'cat3',
      '4': 'cat4'
    },

    pointer(game, p, type) {
      if (type === 'down') game.press(p);
      else if (type === 'up') game.release(p);
    }
  };
}
