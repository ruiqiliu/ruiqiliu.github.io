/* =====================================================================
   main.js — 入口
   只做一件事：把 core（引擎）、ui（界面）、games（游戏）三部分接起来。
   想了解整个项目怎么跑，从这份文件开始读就够了。
   ===================================================================== */
import { surface } from './core/surface.js';
import { Snd } from './core/audio.js';
import { installInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { avatar } from './core/avatar.js';
import { games } from './games/registry.js';
import { createHomeView } from './ui/home.js';
import { createPlayView } from './ui/play.js';
import { createShell } from './shell.js';

const HOME_TITLE = '快乐小游戏 · 打砖块 / 贪吃蛇 / 俄罗斯方块 / 暴力摩托 / 小鸟飞飞 / 迷宫探险 / 头像拼图 / 1024 / 2和3 / 车库大师';

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
/* 首页用字母键选游戏：第 1 个 = a，第 2 个 = b …… 支持到 26 个。
   只在首页生效（进游戏后字母键还给方向键），不会和操作冲突。 */
installInput({
  shell,
  canvas,
  pads: padsEl,
  onLetterKey(k) {
    if (!/^[a-z]$/.test(k)) return;
    const i = k.charCodeAt(0) - 97;
    if (i < games.length) shell.open(games[i].meta.id);
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

// 头像先解码完再开跑，免得第一帧画出来是空白色块。
// 不 await 也行：avatar.draw 在图片没就绪时会画占位色块，不会报错。
avatar.load();

startLoop((dt) => shell.step(dt));

/* 调试 / 自动化测试用：可以在控制台里 ARCADE.shell.open('maze') 直接进游戏 */
window.ARCADE = { games, shell, surface, Snd, avatar };
