/* =====================================================================
   games/registry.js — 游戏清单
   这里是唯一需要改动的地方：新增一个游戏，只要在数组里加一行。
   首页卡片、字母快捷键（按 a~z）都会跟着自动更新。
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
import * as garage from './garage/game.js';
import * as brick from './brick/game.js';
import * as numtrain from './numtrain/game.js';
import * as ride from './ride/game.js';
import * as guess from './guess/game.js';
import * as sudoku from './sudoku/game.js';
import * as tangram from './tangram/game.js';
import * as memory from './memory/game.js';
import * as shop from './shop/game.js';
import * as make10 from './make10/game.js';
import * as balance from './balance/game.js';
import * as blocks from './blocks/game.js';

export const games = [
  guess, sudoku, tangram, memory, shop, make10, balance, blocks,
  numtrain, ride,
  breaker, snake, tetris, moto, flappy, maze, puzzle, g1024, m23,
  garage, brick
];

export function findById(id) {
  return games.find((g) => g.meta.id === id) || null;
}
