/* =====================================================================
   main.js — 入口
   只做一件事：把 core（引擎）、ui（界面）、games（游戏）三部分接起来。
   想了解整个项目怎么跑，从这份文件开始读就够了。
   ===================================================================== */
import { surface } from './core/surface.js';
import { Snd } from './core/audio.js';
import { installInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { games } from './games/registry.js';
import { createHomeView } from './ui/home.js';
import { createPlayView } from './ui/play.js';
import { createShell } from './shell.js';

const HOME_TITLE = '快乐小游戏 · 打砖块 / 贪吃蛇 / 俄罗斯方块 / 暴力摩托 / 小鸟飞飞 / 迷宫探险';

/* ---------------- 画布 ---------------- */
const canvas = document.getElementById('cv');
const padsEl = document.getElementById('pads');
surface.mount(canvas);

/* ---------------- 界面 ---------------- */
const homeView = createHomeView({
  root: document.getElementById('home'),
  cardsEl: document.getElementById('cards')
});
homeView.render(games);

const playView = createPlayView(document.getElementById('play'));

const shell = createShell({ homeView, playView, homeTitle: HOME_TITLE });
homeView.setPickHandler((id) => shell.open(id));

/* ---------------- 输入 ---------------- */
installInput({
  shell,
  canvas,
  pads: padsEl,
  onNumberKey(k) {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= games.length) shell.open(games[n - 1].meta.id);
  }
});

/* ---------------- 顶栏按钮 ---------------- */
document.getElementById('btnBack').addEventListener('click', () => shell.goHome());
document.getElementById('btnRestart').addEventListener('click', () => shell.restart());

const btnSound = document.getElementById('btnSound');
btnSound.addEventListener('click', () => {
  Snd.on = !Snd.on;
  if (Snd.on) Snd.ensure();
  playView.setSoundOn(Snd.on);
});

window.addEventListener('resize', () => {
  const game = shell.active;
  if (game && game.resize) game.resize();
});

/* ---------------- 出发 ---------------- */
document.title = HOME_TITLE;
startLoop((dt) => shell.step(dt));

/* 调试 / 自动化测试用：可以在控制台里 ARCADE.shell.open('maze') 直接进游戏 */
window.ARCADE = { games, shell, surface, Snd };
