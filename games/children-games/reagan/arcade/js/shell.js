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
import { currentFX3D } from './core/fx3d.js';
import { Snd } from './core/audio.js';
import { avatar } from './core/avatar.js';
import { findById, games } from './games/registry.js';
import { removeStage } from './core/render3d.js';

/** 逻辑层的 FX 路由：当前有 3D 舞台就走到 3D 粒子（画在 2D 画布上的粒子
    会被不透明的 3D 画布挡住，等于白画），没有 3D 舞台就走原来的 2D 特效。 */
const FXRouter = {
  burst(...args) {
    const f = currentFX3D();
    if (f) f.burst(...args);
    else FX.burst(...args);
  },
  text(...args) {
    const f = currentFX3D();
    if (f) f.text(...args);
    else FX.text(...args);
  },
  clear() { FX.clear(); },
  update(dt) { FX.update(dt); },
  draw(ctx) { FX.draw(ctx); }   // 3D 游戏时 2D 粒子列表恒空，等于 no-op
};

export function createShell({ homeView, playView, homeTitle }) {
  let active = null;

  function open(id) {
    const mod = findById(id);
    if (!mod) return;
    removeStage();                     // 任何切换都先拆 3D 舞台（3D 游戏的视图会自建）

    if (active && active.destroy) active.destroy();
    FX.clear();
    Snd.ensure();

    // 按游戏在清单里的序号定下本局主角的脸。
    // 首页卡片是同一个序号算出来的，所以「卡片上的小朋友」=
    // 「顶栏的小朋友」=「游戏里的小朋友」，一路都能认出来。
    const slot = Math.max(0, games.indexOf(mod));
    avatar.setHero(slot);

    active = mod.create({ ctx: surface.ctx, cv: surface.cv, Snd, FX: FXRouter });

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
    removeStage();
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
