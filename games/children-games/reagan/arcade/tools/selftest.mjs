#!/usr/bin/env node
/* =====================================================================
   tools/selftest.mjs — 无头 Chrome 快进自检

   思路：打包出 dist/arcade.html 之后，往里面追加一段「快进驱动」脚本，
   让它对每个游戏连续打几千帧（同时模拟按键），任何 update / render 里
   的异常都会被 window.onerror 捕获。整套逻辑不需要人工操作就能跑完，
   还会顺带覆盖「重来 / 改窗口尺寸 / 退出再进入」这几条容易出错的路径。

   logic 帧只调 update（不画），用来把游戏快速推进到远一点的状态，
   这样像「消行」「走出迷宫」这类低频分支也能被踩到。

   用法：
     node tools/build.mjs && node tools/selftest.mjs           # 逻辑自检
     node tools/build.mjs && node tools/selftest.mjs --shots   # 顺便截图
   ===================================================================== */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist/arcade.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WANT_SHOTS = process.argv.includes('--shots');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-selftest-'));

/* ---------------- 每个游戏跑多少帧、按键怎么打 ---------------- */

const SCRIPTS = {
  breaker: {
    frames: 6000,
    press: function (i, g) {
      if (i === 3) g.action('serve', true);
      if (i % 60 === 0) { g.action('left', true); g.action('right', false); }
      if (i % 60 === 30) { g.action('left', false); g.action('right', true); }
    }
  },

  snake: {
    logic: 150000,   // 纯逻辑快进：不吃不喝跑 ~3300 步，触发吃水果 / 撞自己 / 结束
    frames: 2500,
    press: function (i, g) {
      // 每帧换一个伪随机方向：蛇会不停拐弯、吃东西、撞自己
      const dirs = ['up', 'down', 'left', 'right'];
      g.action(dirs[rnd(i) & 3], true);
    }
  },

  tetris: {
    logic: 300000,   // 纯逻辑快进：随机挪列 + 随机旋转，撞出消行 / 顶死重开
    frames: 6000,
    press: function (i, g) {
      const cycle = 50;
      const n = Math.floor(i / cycle);
      const t = i % cycle;
      if (t === 2) {
        const shift = (rnd(n) % 13) - 6;               // -6 ~ +6 列
        const dir = shift < 0 ? 'left' : 'right';
        for (let k = 0; k < Math.abs(shift); k++) { g.action(dir, true); g.action(dir, false); }
        const turns = rnd(n * 31 + 7) % 4;
        for (let k = 0; k < turns; k++) g.action('rotate', true);
      }
      if (t === 10) g.action('drop', true);
      g.action('down', false);
    }
  },

  moto: {
    logic: 3500,     // 先乱拐一通：撞雪糕筒、摔车、掉爱心
    frames: 8000,    // 再贴右边草地一路跑到终点：覆盖冲线与进入下一场
    press: function (i, g) {
      if (i >= 100000) {
        // 草地边缘没有雪糕筒，保持右满舵就能顺利冲线
        g.action('right', true);
        if (i % 53 === 0) g.action('punch', true);
        return;
      }
      if (i % 70 === 0) { g.action('left', true); g.action('right', false); }
      if (i % 70 === 35) { g.action('left', false); g.action('right', true); }
      if (i % 70 === 60) g.action('right', false);
      if (i % 53 === 0) g.action('punch', true);
      if (i % 300 === 0) g.action('boost', true);
      if (i % 300 === 40) g.action('boost', false);
    }
  },

  flappy: {
    frames: 4500,
    // 每 36 帧扇一次 ≈ 在某个高度附近巡航（重力 1450 与拍翅 -430 配出来的节奏）。
    // 别用更密的节奏：那样小鸟会一路顶到天花板、贴着顶上的管子走，几乎过不了几根。
    press: function (i, g) {
      const p = i >= 100000 ? i - 100000 : i;   // 第二段整体偏移了 100000 帧，先归零再算节奏
      if (p % 36 === 0) g.action('flap', true);
    }
  },

  maze: {
    logic: 150000,   // 纯逻辑快进：随机走遍迷宫，直到摸到出口
    frames: 1500,    // 再带渲染跑一段，覆盖过关动画与新关卡
    press: function (i, g) {
      const dirs = ['up', 'down', 'left', 'right'];
      const d = dirs[rnd(i) & 3];
      g.action(d, true);
      g.action(d, false);
      if (i === 60 || i === 30000) g.action('hint', true);
    }
  }
};

/** 把上面这些函数原样搬进浏览器：连函数体一起序列化 */
const SCRIPTS_SRC =
  '{\n' +
  Object.entries(SCRIPTS)
    .map(
      ([id, s]) =>
        `${JSON.stringify(id)}: { frames: ${s.frames}, logic: ${s.logic || 0}, press: ${s.press.toString()} }`
    )
    .join(',\n') +
  '\n}';

/* ---------------- 追加到 dist 后面的驱动脚本 ---------------- */

const DRIVER = `
<script>
(function () {
  const ERR = [];
  window.onerror = function (m, s, l) { ERR.push('onerror: ' + m + ' @' + (s || '') + ':' + l); };
  window.addEventListener('unhandledrejection', function (e) { ERR.push('rejection: ' + e.reason); });

  /**
   * 固定 Math.random。游戏里的管口高度、方块序列等都用它生成，不固定的话
   * 每次自检结果都不一样，失败了也复现不出来。这里换成一个简单的可复现序列。
   */
  let __seed = 1234567;
  Math.random = function () {
    __seed = (Math.imul(__seed, 1103515245) + 12345) >>> 0;
    return __seed / 4294967296;
  };

  /**
   * 由帧号直接算出伪随机方向。必须是「按下标散列」而不是「线性同余」：
   * 线性写法在 i ≡ 0 (mod 8) 这些抽样点上会退化成固定 4 循环，
   * 游戏里的角色就会一直绕 2×2 的小方块打转（这个坑踩过）。
   */
  function rnd(i) {
    let x = Math.imul(i + 1, 2654435761) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 2246822519) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 3266489917) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
  }

  const SCRIPTS = ${SCRIPTS_SRC};
  const A = window.ARCADE;
  const lines = ['games=' + A.games.map(function (g) { return g.meta.id; }).join(',')];

  Object.keys(SCRIPTS).forEach(function (id) {
    const plan = SCRIPTS[id];
    try {
      A.shell.open(id);
      const g = A.shell.active;
      const seen = [];
      const peaks = {};
      const snap = function (label) { seen.push(label + '=' + JSON.stringify(g.hud())); };

      // 记录每个 HUD 指标出现过的最大值 —— 有些分支（比如消行）会被随后的
      // 重开清零，只看快照很容易漏掉
      const trackPeak = function () {
        g.hud().forEach(function (item) {
          const v = parseFloat(String(item[1]).replace(/[^0-9.\\-]/g, ''));
          if (!isFinite(v)) return;
          const k = item[0];
          if (peaks[k] === undefined || v > peaks[k]) peaks[k] = v;
        });
      };

      snap('t0');
      trackPeak();

      // 第一段：只推逻辑不画，用来把状态跑到很后面
      for (let i = 0; i < plan.logic; i++) {
        plan.press(i, g);
        g.update(1 / 60);
        trackPeak();
        if (i === Math.floor(plan.logic / 2)) snap('logicMid');
      }

      // 第二段：完整帧（更新 + 绘制 + HUD）。帧号偏移 100000，方便按阶段切换打法
      for (let i = 0; i < plan.frames; i++) {
        plan.press(i + 100000, g);
        A.shell.step(1 / 60);
        trackPeak();
        if (i === Math.floor(plan.frames / 2)) snap('mid');
      }
      snap('end');

      // 重来 / 改尺寸 / 再跑一小段
      A.shell.restart();
      g.resize();
      for (let i = 0; i < 150; i++) { plan.press(i + 200000, g); A.shell.step(1 / 60); }
      snap('restart');

      // 退出再进入，验证销毁与重复装配
      A.shell.goHome();
      A.shell.open(id);
      for (let i = 0; i < 120; i++) { plan.press(i, A.shell.active); A.shell.step(1 / 60); }
      A.shell.goHome();

      const peakStr = Object.keys(peaks).map(function (k) { return k + '≤' + peaks[k]; }).join(',');
      lines.push(id + ' OK   ' + seen.join('   ') + '   峰值[' + peakStr + ']');
    } catch (e) {
      lines.push(id + ' FAIL ' + (e && e.stack ? e.stack : String(e)));
    }
  });

  lines.push('ERRORS: ' + (ERR.length ? ERR.join(' | ') : 'none'));

  const pre = document.createElement('pre');
  pre.id = 'testout';
  pre.textContent = lines.join('\\n');
  document.body.appendChild(pre);
})();
</script>
`;

/* ---------------- 跑起来 ---------------- */

if (!fs.existsSync(DIST)) {
  console.error('找不到 ' + DIST + '，请先运行：node tools/build.mjs');
  process.exit(1);
}
if (!fs.existsSync(CHROME)) {
  console.error('找不到 Chrome：' + CHROME);
  process.exit(1);
}

const html = fs.readFileSync(DIST, 'utf8');
const page = path.join(TMP, 'run.html');
fs.writeFileSync(page, html.replace('</body>', DRIVER + '</body>'));

const BASE = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check'];

const started = Date.now();
const dom = execFileSync(
  CHROME,
  BASE.concat(['--virtual-time-budget=30000', '--dump-dom', 'file://' + page]),
  { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
);

const m = dom.match(/<pre id="testout">([\s\S]*?)<\/pre>/);
if (!m) {
  console.error('没能拿到自检输出。Chrome 返回的 DOM 片段：');
  console.error(dom.slice(0, 2000));
  process.exit(1);
}

const report = m[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&');

console.log(report);
console.log('\n耗时 ' + ((Date.now() - started) / 1000).toFixed(1) + 's');

/* ---------------- 截图（可选） ---------------- */

if (WANT_SHOTS) {
  const shotDir = path.join(TMP, 'shots');
  fs.mkdirSync(shotDir, { recursive: true });

  for (const [id, plan] of Object.entries(SCRIPTS)) {
    const logic = Math.min(plan.logic || 0, 4000);
    const frames = Math.min(plan.frames, 1200);

    const shot = `
<script>
(function () {
  function rnd(i) {
    let x = Math.imul(i + 1, 2654435761) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 2246822519) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 3266489917) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
  }
  const A = window.ARCADE;
  // 和主驱动用同一个固定种子，保证截图跟自检跑的是同一局
  let __seed = 1234567;
  Math.random = function () {
    __seed = (Math.imul(__seed, 1103515245) + 12345) >>> 0;
    return __seed / 4294967296;
  };
  A.shell.open(${JSON.stringify(id)});
  const g = A.shell.active;
  const press = ${plan.press.toString()};
  for (let i = 0; i < ${logic}; i++) { press(i, g); g.update(1 / 60); }
  for (let i = 0; i < ${frames}; i++) { press(i + 100000, g); A.shell.step(1 / 60); }
})();
</script>`;
    const p = path.join(TMP, 'shot-' + id + '.html');
    fs.writeFileSync(p, html.replace('</body>', shot + '</body>'));
    execFileSync(
      CHROME,
      BASE.concat([
        '--window-size=900,1000',
        '--virtual-time-budget=4000',
        '--screenshot=' + path.join(shotDir, id + '.png'),
        'file://' + p
      ]),
      { stdio: 'ignore' }
    );
  }
  console.log('\n截图目录：' + shotDir);
}

console.log('临时文件目录：' + TMP);
