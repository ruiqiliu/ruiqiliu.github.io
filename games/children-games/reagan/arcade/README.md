# 快乐小游戏 · 街机

一个零依赖的浏览器小游戏合集，六个游戏：打砖块、贪吃蛇、俄罗斯方块、暴力摩托、小鸟飞飞、迷宫探险。

## 怎么玩

- **直接玩**：双击 `dist/arcade.html`（自包含单文件，不需要服务器）。
- **首页**：点卡片，或按数字键 `1`~`6` 选游戏。
- **游戏里**：`Esc` 返回首页，`R` 重来，`🔊` 开关音效。
- **手机**：每个游戏底部都有触屏按键，画布上还可以用鼠标拖 / 手指滑。

## 目录结构

```
arcade/
├── index.html              开发入口（引用下面的 css/js，需要本地服务器）
├── css/
│   ├── tokens.css          颜色 / 字体变量，换主题只改这里
│   ├── base.css            重置 + 页面外壳
│   ├── home.css            首页卡片
│   └── play.css            游戏页：顶栏 / HUD / 画布 / 触屏按键
├── js/
│   ├── main.js             入口：把 core / ui / games 接起来
│   ├── shell.js            街机外壳：首页↔游戏页切换、每帧驱动
│   ├── core/               与具体游戏无关的基础设施
│   │   ├── util.js         纯工具：数学、颜色、圆角矩形、圆-矩形碰撞
│   │   ├── audio.js        音效（WebAudio 实时合成，零音频文件）
│   │   ├── fx.js           粒子 / 飘字特效
│   │   ├── surface.js      画布：逻辑分辨率 → 物理像素、坐标换算
│   │   ├── input.js        输入路由：键盘/鼠标/触屏 → 语义动作
│   │   ├── loop.js         requestAnimationFrame 主循环
│   │   └── storage.js      最高分持久化
│   ├── ui/                 DOM 界面
│   │   ├── home.js         首页卡片
│   │   └── play.js         HUD / 触屏按键 / 底部提示
│   └── games/
│       ├── registry.js     ★ 游戏清单，新增游戏只改这里
│       ├── breaker/        打砖块
│       ├── snake/          贪吃蛇
│       ├── tetris/         俄罗斯方块
│       ├── moto/           暴力摩托
│       ├── flappy/         小鸟飞飞
│       └── maze/           迷宫探险
└── tools/
    ├── build.mjs           打包成单文件 dist/arcade.html
    └── selftest.mjs        无头 Chrome 快进自检
```

**注意**：`index.html` 用的是 ES module，直接双击会因为浏览器的 CORS 策略加载不了 JS；
想跑源码版需要一个本地服务器。只是想玩的话用 `dist/arcade.html`。

## 三层分层：逻辑 / 界面 / 控制

每个游戏都由三个文件组成，阅读和改动时各看各的：

| 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `game.js` | **逻辑层**：状态 `S` + 规则 `update(dt)` + 对外接口 | 不碰 canvas，不读 DOM |
| `view.js` | **界面层**：把 `S` 画到 canvas、给出 HUD 与提示文案 | 不修改 `S`，不读输入 |
| `controls.js` | **控制层**：把键盘 / 鼠标 / 滑动翻译成**语义动作** | 不含游戏规则 |

逻辑层允许调用注入的 `Snd` / `FX` 做音效和特效反馈 —— 这相当于「事件通知」，
所以 `view.js` 永远不需要知道「刚才发生了什么」，只管把当前状态画出来。

游戏对象和外壳之间的约定（见 `js/shell.js` 顶部注释）：

```js
{
  W, H,                      // 逻辑分辨率
  pads, hint, cursor,        // 界面文案与光标
  start() resize() restart() destroy(),
  update(dt) render() hud(),
  action(名字, 是否按下)      // 语义动作，来自 controls 的翻译
  controls: { keys, pointer(game, p, type, e) }
}
```

## 新增一个游戏

1. 建 `js/games/<名字>/`，写 `game.js` / `view.js` / `controls.js`；
   `game.js` 导出 `meta`（`{id, name, icon, accent, desc}`）和 `create(env)`。
2. 在 `js/games/registry.js` 的 `games` 数组里加一行。
3. 首页卡片、数字快捷键会自动更新，不需要改 HTML。

## 开发与验证

```bash
# 跑源码版
python3 -m http.server 8765     # 然后打开 http://127.0.0.1:8765/index.html

# 打包成单文件（改完源码记得重新打包）
node tools/build.mjs

# 无头 Chrome 快进自检：六个游戏各打几千帧，模拟按键，捕获任何异常
node tools/selftest.mjs
node tools/selftest.mjs --shots  # 顺便给每个游戏截一张图
```

自检里有两个坑值得记一下：

1. **用「帧号 × 线性同余」生成伪随机方向是不行的**。在 `i ≡ 0 (mod 8)` 这类抽样点上
   它会退化成固定 4 循环，角色就会一直绕 2×2 的小方块打转（贪吃蛇不吃东西、迷宫
   永远走不到出口）。`tools/selftest.mjs` 里的 `rnd()` 改成了按帧号做哈希散列。
2. **驱动里的 `Math.random` 被换成了固定种子的可复现序列**。游戏里的管口高度、
   方块序列都靠它生成；不固定的话每次自检数字都不同，失败了也复现不出来。
   所以现在连跑两次的输出应当逐字节一致 —— 改了源码如果结果没变，先想想是不是
   随机数没接上。

「假玩家」的打法也直接影响覆盖到的分支，最典型的是小鸟飞飞：每 17 帧扇一次翅膀，
小鸟会一路顶到天花板、贴着顶上的管子走，20 秒只能过 2 根；改成**每 36 帧一次**
（大致等于在某个高度巡航）就能连过 27 根，得分分支才算真正被验证到。

## 设计约定

- 中文界面，浅色页面外壳 + 明亮糖果色游戏区。
- 面向小朋友：没有失败惩罚。打砖块的球不会丢、贪吃蛇撞自己有爱心、
  小鸟撞管子掉一颗心还有两次机会、摩托被撞只是晃悠冒星星。
- 所有画面都是 Canvas 绘制或 Emoji，没有任何图片 / 音频资源文件。
