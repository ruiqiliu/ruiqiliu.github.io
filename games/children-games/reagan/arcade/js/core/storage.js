/* =====================================================================
   core/storage.js — 最高分持久化（localStorage 在隐私模式下可能抛错，全部吞掉）
   ===================================================================== */

export function loadNumber(key, fallback = 0) {
  try {
    const v = parseInt(localStorage.getItem(key) || '', 10);
    return Number.isFinite(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

export function saveNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    /* 忽略：存不下也不影响玩 */
  }
}

/** 只在刷新纪录时写入，返回最终的最高分 */
export function keepBest(key, score, currentBest) {
  if (score > currentBest) {
    saveNumber(key, score);
    return score;
  }
  return currentBest;
}
