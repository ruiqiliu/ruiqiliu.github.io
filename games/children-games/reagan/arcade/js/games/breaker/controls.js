/* =====================================================================
   games/breaker/controls.js — 打砖块 · 控制层
   键盘与指针 → 语义动作。游戏逻辑只认 left / right / serve 三种动作。
   ===================================================================== */

export function createControls() {
  return {
    /** 按键 → 动作 */
    keys: {
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      ' ': 'serve',
      enter: 'serve'
    },

    /**
     * 画布上的指针。p 已经是画布逻辑坐标。
     * 鼠标随便移动即可跟随；触屏 / 手写笔只在按住拖动时跟随，
     * 否则手指一碰屏幕，板子就会瞬间跳到手指位置，反而不好控制。
     */
    pointer(game, p, type, e) {
      if (type === 'move' && e.pointerType !== 'mouse' && !(e.buttons & 1)) return;
      game.aim(p.x);
      if (type === 'down') game.serve();
    }
  };
}
