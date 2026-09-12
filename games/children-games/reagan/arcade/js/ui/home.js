/* =====================================================================
   ui/home.js — 首页（游戏选择卡片）
   卡片内容完全由游戏清单渲染出来，新增游戏不用手改 HTML。
   ===================================================================== */

export function createHomeView({ root, cardsEl }) {
  /** 记录每张卡片的回调，避免反复重建 DOM 时重复绑定 */
  let onPick = null;

  function render(games) {
    cardsEl.innerHTML = games
      .map((g, i) => {
        const m = g.meta;
        return (
          '<button class="card" data-game="' + m.id + '" style="--accent:' + m.accent + '">' +
            '<span class="emo">' + m.icon + '</span>' +
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
