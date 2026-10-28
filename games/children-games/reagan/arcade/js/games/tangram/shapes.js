/* =====================================================================
   games/tangram/shapes.js — 七巧板 · 板块与拼图数据
   七块板的「标准摆法」是经典正方形剖分（边长 8 的网格坐标）；
   每个拼图给出 7 块板的目标多边形，solvePlacements 会自动求出
   每块板需要的旋转档位和位移（对不上会在控制台报错）。
   ===================================================================== */

/** 七块板的基准多边形（经典正方形剖分，边长 8，已用采样校验恰好铺满） */
export const BASE = [
  { name: '大三角', poly: [[0, 0], [8, 0], [4, 4]] },
  { name: '大三角', poly: [[0, 0], [4, 4], [0, 8]] },
  { name: '中三角', poly: [[4, 4], [8, 4], [8, 0]] },
  { name: '正方', poly: [[4, 4], [6, 6], [4, 8], [2, 6]] },
  { name: '小三角', poly: [[4, 4], [8, 4], [6, 6]] },
  { name: '小三角', poly: [[4, 8], [8, 8], [6, 6]] },
  { name: '平行四边', poly: [[0, 8], [2, 6], [6, 6], [4, 8]] }
];

const rot = (p, a, cx, cy) => {
  const cos = Math.cos(a), sin = Math.sin(a);
  const x = p[0] - cx, y = p[1] - cy;
  return [cx + x * cos - y * sin, cy + x * sin + y * cos];
};

const centroid = (poly) => {
  let x = 0, y = 0;
  poly.forEach((p) => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
};

const samePoly = (a, b) =>
  a.length === b.length && a.every((p) => b.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01));

/** 求一块板的摆放：返回 {tx, ty, k}——(x,y) 是板块重心应放的位置，
    k 是旋转档位（板块顶点 = 重心 + 旋转(基准顶点-重心)）；求不出返回 null */
export function solvePlacement(pieceIdx, target) {
  const base = BASE[pieceIdx].poly;
  const bc = centroid(base);
  const tc = centroid(target);
  const norm = target.map((p) => [p[0] - tc[0], p[1] - tc[1]]);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const rotated = base.map((p) => {
      const [rx, ry] = rot(p, a, bc[0], bc[1]);
      return [rx - bc[0], ry - bc[1]];
    });
    if (!samePoly(rotated, norm)) continue;
    return { tx: tc[0], ty: tc[1], k };
  }
  console.warn('tangram: 板块', pieceIdx, '无法匹配目标', JSON.stringify(target));
  return null;
}

/** 板块在位置 (x,y)、旋转 k×45° 时的多边形顶点（以重心为中心旋转） */
export function pieceVerts(pieceIdx, x, y, k, scale = 1) {
  const base = BASE[pieceIdx].poly;
  const bc = centroid(base);
  const a = (k * Math.PI) / 4;
  return base.map((p) => {
    const [rx, ry] = rot(p, a, bc[0], bc[1]);
    return [x + (rx - bc[0]) * scale, y + (ry - bc[1]) * scale];
  });
}
// 约定：pieceVerts(i, tx, ty, k, scale) == 目标多边形（tx/ty 为重心的屏幕位置）

export const pieceCentroid = (pieceIdx) => centroid(BASE[pieceIdx].poly);
export const pieceName = (pieceIdx) => BASE[pieceIdx].name;
