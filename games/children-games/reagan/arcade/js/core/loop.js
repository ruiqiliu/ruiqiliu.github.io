/* =====================================================================
   core/loop.js — 主循环
   只有一个固定节拍的 requestAnimationFrame 循环：
     dt → shell.step(dt) → 下一帧
   dt 上限 1/30 秒，防止切后台回来时一步跳出画面。
   ===================================================================== */

export function startLoop(step) {
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    step(dt);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
