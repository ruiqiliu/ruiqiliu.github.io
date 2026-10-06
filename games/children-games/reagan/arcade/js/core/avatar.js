/* =====================================================================
   core/avatar.js — 儿童头像系统
   统一负责「用真实照片头像替换卡通形象」这件事，游戏层只管调用：

     avatar.load()                  启动时调一次，等图片解码完
     avatar.setHero(n)              进入第 n 个游戏时指定「本局主角」用哪张脸
     avatar.hero(ctx, x, y, r)      画本局主角（= 首页卡片 = 顶栏，同一个人）
     avatar.of(key)                 按用途取一张头像（同一个 key 永远同一张）
     avatar.draw(ctx, key, x, y, r) 圆形裁切画到画布
     avatar.imgHTML(key, alt, w)    给 DOM（首页卡片 / 顶栏）用的 <img>

   为什么主角要「按序号轮转」而不是纯散列：
   散列在 6 个游戏 / 5 张脸的组合下会撞脸 —— 首页出现两张一样的脸，
   小朋友会以为是同一个人。而小朋友认人靠脸，所以同一个游戏在
   首页卡片、顶栏、游戏里必须是同一张。序号 % 张数 恰好能做到这点，
   相邻游戏也不会撞。主角以外的位置（摩托对手等）继续用散列，
   再避开主角那张脸。

   图片是异步解码的。load() 之前 draw() 会画一个占位色块，
   所以就算加载慢了一帧，画面也不会出现空白或报错。
   ===================================================================== */
import { AVATAR_URLS } from './avatar-data.js';

const imgs = AVATAR_URLS.map((src) => {
  const im = new Image();
  im.src = src;
  return im;
});

/** key → 头像下标。用字符串散列，保证同一个 key 落在同一张脸上 */
const assigned = new Map();

/** 本局主角的头像下标，由 shell.open() 按游戏序号设定 */
let heroIdx = 0;

/** 稳定的字符串散列（FNV-1a 变体），返回 0~n-1 */
function hash(key, n) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % n;
}

export const avatar = {
  count: imgs.length,

  /** 等所有头像解码完。失败不阻塞 —— 画不出来时走占位色块。 */
  load() {
    return Promise.all(
      imgs.map((im) =>
        im.decode ? im.decode().catch(() => {}) : new Promise((r) => { im.onload = im.onerror = r; })
      )
    );
  },

  /** 进入第 n 个游戏：定下这一局主角的脸（n 取游戏在清单里的序号，从 0 开始） */
  setHero(n) {
    heroIdx = ((n % imgs.length) + imgs.length) % imgs.length;
  },

  /** 本局主角的下标 */
  heroIndex() {
    return heroIdx;
  },

  /**
   * 取某个用途对应的头像下标（惰性分配，之后固定不变）。
   * 避开主角那张脸：主角之外的「人」不该跟主角长得一样。
   */
  index(key) {
    if (!assigned.has(key)) {
      let i = hash(key, imgs.length);
      if (i === heroIdx && imgs.length > 1) i = (i + 1) % imgs.length;
      assigned.set(key, i);
    }
    return assigned.get(key);
  },

  url(key) {
    return AVATAR_URLS[this.index(key)];
  },

  /** 主角用的 data URL（首页卡片 / 顶栏 / 游戏内三处共用同一张） */
  heroURL() {
    return AVATAR_URLS[heroIdx];
  },

  /**
   * 本局主角的原图 Image（未裁圆、未缩放）。
   * 「头像拼图」这类要把整张照片切块来画的游戏用这个，
   * 圆形裁切的 draw() / hero() 满足不了它们。
   */
  heroImg() {
    return imgs[heroIdx];
  },

  /**
   * 画一个圆形头像。
   * key 传数字则直接当头像下标用（画主角就走这条）。
   * opt.alpha   整体透明度（默认 1）
   * opt.rot     额外旋转弧度（默认 0）
   * opt.ring    外圈描边颜色，默认白色；传 null 就不描边
   * opt.ringW   描边宽度，默认 max(2, r * 0.09)
   * 图片没解码好时画一个柔和的圆形占位，绝不留白。
   */
  draw(ctx, key, x, y, r, opt) {
    const o = opt || {};
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.01) return;

    const im = imgs[typeof key === 'number' ? key : this.index(key)];
    const ready = im.complete && im.naturalWidth > 0;

    ctx.save();
    ctx.globalAlpha *= a;

    // 圆形裁切：所有头像都是圆的，游戏里也保持一致
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    if (ready) {
      if (o.rot) {
        ctx.translate(x, y);
        ctx.rotate(o.rot);
        ctx.drawImage(im, -r, -r, r * 2, r * 2);
      } else {
        ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
      }
    } else {
      ctx.fillStyle = '#ffd9c0';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();

    // 描边放在裁切之外：白色细边能让照片在任何背景上都看得清
    if (o.ring !== null) {
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
      ctx.lineWidth = o.ringW || Math.max(2, r * 0.09);
      ctx.strokeStyle = o.ring || '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
  },

  /** 画本局主角：首页卡片、顶栏、游戏内角色三处共用同一张脸 */
  hero(ctx, x, y, r, opt) {
    this.draw(ctx, heroIdx, x, y, r, opt);
  },

  /**
   * 给 DOM 用的 <img>。size 省略尺寸时用 CSS 控制。
   * 这样首页卡片和顶栏不需要 canvas 也能显示照片脸。
   */
  imgHTML(key, alt, size) {
    const src = typeof key === 'number' ? AVATAR_URLS[key] : this.url(key);
    return (
      '<img class="face" src="' + src + '" alt="' + (alt || '') + '"' +
      (size ? ' width="' + size + '" height="' + size + '"' : '') +
      ' draggable="false">'
    );
  }
};