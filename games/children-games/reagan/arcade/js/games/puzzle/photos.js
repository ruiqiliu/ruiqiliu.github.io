/* =====================================================================
   games/puzzle/photos.js — 拼图的原图照片池
   前 5 张是五个小朋友头像（与 avatar-data.js 同序 —— 「头像拼图」
   进游戏时默认用本局主角那张脸，和首页卡片对得上），后面是家长
   追加的家庭照片（裁图在 assets/puzzle/，见 tools/gen-puzzle-photos.py）。
   全部内联成 data URL，dist 单文件双击也能玩。

   图片在模块加载时就开跑解码；哪张慢了也只是先画一帧占位色块，
   不会白屏或报错。
   ===================================================================== */
import { PUZZLE_URLS } from '../../core/puzzle-data.js';

export const photos = PUZZLE_URLS.map((src) => {
  const im = new Image();
  im.src = src;
  if (im.decode) im.decode().catch(() => {});
  return im;
});

/** 第 i 张照片（越界自动取模，负数也安全） */
export function photoAt(i) {
  return photos[((i % photos.length) + photos.length) % photos.length];
}
