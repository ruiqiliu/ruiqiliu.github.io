/* =====================================================================
   games/registry.js — 游戏清单
   这里是唯一需要改动的地方：新增一个游戏，只要在数组里加一行。
   首页卡片、数字快捷键（按 1~9）都会跟着自动更新。
   ===================================================================== */
import * as breaker from './breaker/game.js';
import * as snake from './snake/game.js';
import * as tetris from './tetris/game.js';
import * as moto from './moto/game.js';
import * as flappy from './flappy/game.js';
import * as maze from './maze/game.js';
import * as puzzle from './puzzle/game.js';
import * as g1024 from './g1024/game.js';
import * as m23 from './m23/game.js';

export const games = [breaker, snake, tetris, moto, flappy, maze, puzzle, g1024, m23];

export function findById(id) {
  return games.find((g) => g.meta.id === id) || null;
}
