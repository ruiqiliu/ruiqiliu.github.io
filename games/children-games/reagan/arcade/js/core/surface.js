/* =====================================================================
   core/surface.js — 画布表面
   负责：逻辑分辨率 → 物理像素（DPR）的缩放、宽高比登记、屏幕坐标换算。
   游戏只关心自己那套逻辑坐标（比如 800×560），不用理设备像素。
   ===================================================================== */

export const surface = {
  cv: null,
  ctx: null,

  /** 当前逻辑分辨率，setup() 会原地改写它，因此可以安全地被长期持有 */
  VIEW: { W: 800, H: 560, dpr: 1 },

  mount(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
  },

  /**
   * 按逻辑尺寸 W×H 建立画布。
   * DPR 上限取 2：再高对卡通画面没有收益，只会拖慢描边。
   */
  setup(W, H) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = this.cv;

    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.setProperty('--ar', (W / H).toFixed(4));
    cv.style.aspectRatio = W + ' / ' + H;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.VIEW.W = W;
    this.VIEW.H = H;
    this.VIEW.dpr = dpr;
  },

  /** 浏览器指针事件坐标 → 画布逻辑坐标 */
  toLocal(e) {
    const r = this.cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.VIEW.W,
      y: ((e.clientY - r.top) / r.height) * this.VIEW.H
    };
  },

  /**
   * 开一块离屏画布并按同样规则缩放，用于预渲染静态背景。
   * 注意返回的 canvas 是物理像素尺寸，绘制时要 drawImage(c, 0, 0, W, H) 铺回逻辑尺寸。
   */
  offscreen(W, H) {
    const dpr = this.VIEW.dpr;
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas: c, ctx: g };
  }
};
