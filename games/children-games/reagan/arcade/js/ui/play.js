/* =====================================================================
   ui/play.js — 游戏页（顶栏 / HUD / 触屏按键 / 底部提示）
   只负责「把游戏给的数据画到 DOM 上」，不含任何游戏规则。
   ===================================================================== */
import { avatar } from '../core/avatar.js';

export function createPlayView(root) {
  const tIco = document.getElementById('tIco');
  const tName = document.getElementById('tName');
  const hudEl = document.getElementById('hud');
  const padsEl = document.getElementById('pads');
  const hintEl = document.getElementById('hint');
  const btnSound = document.getElementById('btnSound');

  // HUD 每帧都会重算一次，内容没变就不动 DOM（省掉无谓的重排）
  let lastHUD = '';
  // 顶栏图标跟着本局主角换：换游戏时才换 DOM
  let lastIco = -1;

  function hudHTML(items) {
    return items
      .map((it) => '<div class="hud-item"><span class="k">' + it[0] + '</span><b>' + it[1] + '</b></div>')
      .join('');
  }

  return {
    root,

    setTitle(name, icon) {
      tName.textContent = name;
      // 用头像替代 emoji 图标：直接用本局主角那一张，
      // 和首页卡片、游戏里的角色是同一张脸。
      const idx = avatar.heroIndex();
      if (idx !== lastIco) {
        lastIco = idx;
        tIco.innerHTML = avatar.imgHTML(idx, name);
      }
    },

    setHUD(items) {
      const html = hudHTML(items);
      if (html === lastHUD) return;
      lastHUD = html;
      hudEl.innerHTML = html;
    },

    setPads(html) {
      padsEl.innerHTML = html || '';
      padsEl.classList.toggle('on', !!html);
    },

    setHint(html) {
      hintEl.innerHTML = html || '';
    },

    setCursor(style) {
      document.getElementById('cv').style.cursor = style || 'default';
    },

    /** 声音按钮的图标跟着 Snd.on 走 */
    setSoundOn(on) {
      btnSound.textContent = on ? '🔊' : '🔇';
      btnSound.classList.toggle('off', !on);
    },

    show() { root.classList.add('on'); },
    hide() { root.classList.remove('on'); lastHUD = ''; }
  };
}
