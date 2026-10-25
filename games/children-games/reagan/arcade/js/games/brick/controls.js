/* =====================================================================
   games/brick/controls.js — 积木救救队 · 控制层
   方向键移动光标、空格放 / X 拆 / 回车出发；
   点画布 = 射线拾取格子：点新格子移动光标，再点一下就放砖。
   ===================================================================== */
import { pickCell } from './view.js';

export function createControls() {
  return {
    keys: {
      arrowup: 'up', w: 'up',
      arrowdown: 'down', s: 'down',
      arrowleft: 'left', a: 'left',
      arrowright: 'right', d: 'right',
      ' ': 'place',
      x: 'remove',
      f: 'flip',
      enter: 'test',
      l: 'love',
      1: 'lv1', 2: 'lv2', 3: 'lv3', 4: 'lv4', 5: 'lv5', 6: 'lv6', 7: 'lv7'
    },

    pointer(game, p, type) {
      if (type !== 'down') return;
      const cell = pickCell(p, game.W, game.H);
      if (cell) game.tapCell(cell.x, cell.z);
    }
  };
}
