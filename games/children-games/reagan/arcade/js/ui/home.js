/* =====================================================================
   ui/home.js — 首页（游戏选择卡片）
   卡片内容完全由游戏清单渲染出来，新增游戏不用手改 HTML。
   卡片图标不再用 emoji，换成小朋友的真实头像。
   ===================================================================== */
import { avatar } from '../core/avatar.js';

export function createHomeView({ root, cardsEl }) {
  /** 记录每张卡片的回调，避免反复重建 DOM 时重复绑定 */
  let onPick = null;

  function render(games) {
    // 卡片头像按游戏序号取（序号 % 头像数），和 shell.open() 里算主角用的是同一个公式，
    // 所以点进去之后顶栏和游戏里是同一张脸。相邻卡片不会撞脸。
    cardsEl.innerHTML = games
      .map((g, i) => {
        const m = g.meta;
        return (
          '<button class="card" data-game="' + m.id + '" style="--accent:' + m.accent + '">' +
            '<span class="emo">' + avatar.imgHTML(i % avatar.count, m.name) + '</span>' +
            '<span class="nm">' + m.name + '</span>' +
            '<span class="ds">' + m.desc.join('<br>') + '</span>' +
            '<span class="key">按 ' + (i + 1) + ' 开始</span>' +
          '</button>'
        );
      })
      .join('');

    cardsEl.querySelectorAll('.card').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (onPick) onPick(btn.dataset.game);
      });
    });
  }

  return {
    render,
    setPickHandler(fn) { onPick = fn; },
    show() { root.classList.remove('off'); },
    hide() { root.classList.add('off'); }
  };
}
