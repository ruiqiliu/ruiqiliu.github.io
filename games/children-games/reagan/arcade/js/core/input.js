/* =====================================================================
   core/input.js — 控制层（输入路由）
   把「键盘 / 鼠标 / 触屏按键」三种输入统一翻译成【语义动作】，
   再交给当前游戏。游戏只知道 left / right / flap / drop 这类动作，
   完全不需要认识 ArrowLeft 或手指。

   翻译规则只有一张表：游戏自己的 controls.keys（按键 → 动作）。
   ===================================================================== */
import { surface } from './surface.js';
import { Snd } from './audio.js';

/** 这些键会把页面滚起来，必须挡掉 */
const PREVENT_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '];

export function installInput({ shell, canvas, pads, onNumberKey }) {
  /** 触屏按键当前按下的动作，用来在全局 pointerup 时补一次「抬起」 */
  let heldPadAction = null;

  /* ---------------- 键盘 ---------------- */

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (PREVENT_KEYS.indexOf(k) >= 0) e.preventDefault();

    const game = shell.active;
    if (!game) { onNumberKey(k); return; }   // 首页：数字键选游戏
    if (k === 'escape') { shell.goHome(); return; }
    if (k === 'r') { shell.restart(); return; }

    const act = game.controls.keys[k];
    if (act) game.action(act, true, e);
  }

  function onKeyUp(e) {
    const game = shell.active;
    if (!game) return;
    const act = game.controls.keys[e.key.toLowerCase()];
    if (act) game.action(act, false, e);
  }

  /* ---------------- 画布上的指针 ---------------- */

  function onCanvasPointerDown(e) {
    Snd.ensure();
    shell.pointer(surface.toLocal(e), 'down', e);
  }

  function onCanvasPointerMove(e) {
    if (!shell.active) return;
    shell.pointer(surface.toLocal(e), 'move', e);
  }

  function onWindowPointerUp(e) {
    const game = shell.active;
    if (!game) return;
    // 手指在按键外面松开时，也要把按键的「按下」状态收回来
    if (heldPadAction) {
      game.action(heldPadAction, false, e);
      heldPadAction = null;
    }
    shell.pointer(surface.toLocal(e), 'up', e);
  }

  /* ---------------- 触屏按键 ---------------- */

  function onPadsPointerDown(e) {
    const btn = e.target.closest('.pad');
    if (!btn) return;
    e.preventDefault();
    Snd.ensure();

    heldPadAction = btn.dataset.act;
    btn.classList.add('hold');

    const game = shell.active;
    if (game) game.action(heldPadAction, true, e);
  }

  function onPadsRelease(e) {
    const btn = e.target.closest('.pad');
    if (btn) btn.classList.remove('hold');
  }

  /* ---------------- 安装 ---------------- */

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  window.addEventListener('pointerup', onWindowPointerUp);
  pads.addEventListener('pointerdown', onPadsPointerDown);
  pads.addEventListener('pointerup', onPadsRelease);
  pads.addEventListener('pointerleave', onPadsRelease);
}
