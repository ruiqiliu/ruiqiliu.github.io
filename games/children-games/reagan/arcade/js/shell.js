/* =====================================================================
   shell.js — 街机外壳
   负责「首页 ↔ 游戏页」的切换、当前游戏的装配与每帧驱动。
   它不认识任何具体游戏，只按下面这份约定和游戏打交道：

     游戏对象 api：
       W / H            逻辑分辨率
       pads / hint      触屏按键 HTML、底部提示文字（UI 文案）
       cursor           画布光标样式
       start()          进入游戏（此时画布已经按 W×H 建好）
       resize()         窗口变化时重画静态背景
       restart()        重来一局
       destroy()        离开时清理
       update(dt)       推进一帧（逻辑）
       render()         画一帧（UI）
       hud()            返回 [['标签', 值], ...]
       action(名, 按下)  语义动作（来自 controls 的翻译结果）
       controls         { keys, pointer(game, p, type, e) }

   本文件里唯一需要按帧运行的是 step()：更新 → 画 → 同步 HUD。
   ===================================================================== */
import { surface } from './core/surface.js';
import { FX } from './core/fx.js';
import { Snd } from './core/audio.js';
import { findById } from './games/registry.js';

export function createShell({ homeView, playView, homeTitle }) {
  let active = null;

  function open(id) {
    const mod = findById(id);
    if (!mod) return;

    if (active && active.destroy) active.destroy();
    FX.clear();
    Snd.ensure();

    active = mod.create({ ctx: surface.ctx, cv: surface.cv, Snd, FX });

    // 先按这个游戏的逻辑分辨率建画布，再让它准备静态背景
    surface.setup(active.W, active.H);
    playView.setTitle(mod.meta.name, mod.meta.icon);
    playView.setPads(active.pads);
    playView.setHint(active.hint);
    playView.setCursor(active.cursor);
    homeView.hide();
    playView.show();
    document.title = mod.meta.name + ' · 快乐小游戏';

    active.start();
    step(0);   // 立刻出一帧，避免看到上一局的残影
  }

  function goHome() {
    if (active && active.destroy) active.destroy();
    active = null;
    FX.clear();
    playView.setPads('');
    playView.hide();
    playView.setCursor('default');
    homeView.show();
    document.title = homeTitle;
  }

  function restart() {
    if (!active) return;
    Snd.ensure();
    if (active.restart) active.restart();
    else active.start();
  }

  /** 把指针事件转交给当前游戏的控制层 */
  function pointer(p, type, e) {
    if (!active) return;
    const controls = active.controls;
    if (controls && controls.pointer) controls.pointer(active, p, type, e);
  }

  /** 一帧：逻辑 → 特效 → 绘制 → HUD */
  function step(dt) {
    if (!active) return;
    active.update(dt);
    FX.update(dt);
    active.render();
    FX.draw(surface.ctx);
    playView.setHUD(active.hud());
  }

  return {
    open,
    goHome,
    restart,
    pointer,
    step,
    get active() { return active; }
  };
}
