/* =====================================================================
   games/puzzle/controls.js — 头像拼图 · 控制层
   画布上的点 / 拖 → press·move·release；
   数字键换难度，P 看原图，H 换一张照片
   ===================================================================== */

export function createControls() {
  return {
    /** 按键 → 动作 */
    keys: {
      '1': 'd3',
      '2': 'd4',
      '3': 'd5',
      p: 'peek',
      h: 'photo'
    },

    /**
     * 画布上的指针。p 已经是画布逻辑坐标。
     * 按下选块、按住拖动、松手交换，具体规则在 game 的 press/move/release 里。
     */
    pointer(game, p, type) {
      if (type === 'down') game.press(p);
      else if (type === 'move') game.move(p);
      else if (type === 'up') game.release(p);
    }
  };
}
