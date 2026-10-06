/* =====================================================================
   games/garage/parts.js — 零件清单与手感参数
   轮子越大越颠但抓地快，尾翼加极速，车身颜色纯好看。
   game.js 用物理参数，view.js 用外观，两边共用这一份。
   ===================================================================== */

export const WHEELS = [
  { name: '小圆轮', r: 17, bob: 1.4, grip: 0 },
  { name: '大花轮', r: 22, bob: 2.4, grip: 0.06 },
  { name: '越野轮', r: 26, bob: 3.6, grip: 0.14 }
];

export const LIGHTS = ['圆圆灯', '方方灯', '星星灯'];

export const SPOILERS = [
  { name: '没有尾翼', boost: 0 },
  { name: '小尾翼', boost: 45 },
  { name: '大赛翼', boost: 90 }
];

export const COLORS = ['#ff8787', '#74c0fc', '#69db7c', '#ffd43b', '#b197fc', '#ffa94d'];
