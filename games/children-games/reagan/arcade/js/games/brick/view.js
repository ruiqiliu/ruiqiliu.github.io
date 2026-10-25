/* =====================================================================
   games/brick/view.js — 积木救救队 · UI 层（3D 版 · 8 岁版）
   42° 斜俯正交相机 + 真实阴影（shadowMap）：砖块的影子落在板面和
   水面上，悬挑结构一眼可见。长板（1×2）带两颗 stud，深水是深蓝色
   的沟。幽灵光标按能否放置变白/红，星星是会转的金色乐高粒。
   ===================================================================== */
import { lerp } from '../../core/util.js';
import { createStage, stageAlive } from '../../core/render3d.js';
import { createFX3D } from '../../core/fx3d.js';
import { avatar } from '../../core/avatar.js';

export const PADS =
  '<div class="dpad">' +
    '<span class="sp"></span><button class="pad" data-act="up">▲</button><span class="sp"></span>' +
    '<button class="pad" data-act="left">◀</button>' +
    '<button class="pad" data-act="down">▼</button>' +
    '<button class="pad" data-act="right">▶</button>' +
  '</div>' +
  '<div class="row">' +
    '<button class="pad" data-act="flip">▤ 砖型/方向</button>' +
    '<button class="pad" data-act="remove">▢ 拆一块</button>' +
    '<button class="pad" data-act="test">🚩 出发</button>' +
    '<button class="pad" data-act="love">❤️ +10</button>' +
  '</div>' +
  '<div class="row">' +
    '<button class="pad" data-act="lv1">1</button>' +
    '<button class="pad" data-act="lv2">2</button>' +
    '<button class="pad" data-act="lv3">3</button>' +
    '<button class="pad" data-act="lv4">4</button>' +
    '<button class="pad" data-act="lv5">5</button>' +
    '<button class="pad" data-act="lv6">6</button>' +
    '<button class="pad" data-act="lv7">自由</button>' +
  '</div>';

export const HINT =
  '<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 移动光标 · <kbd>空格</kbd> 放积木 · ' +
  '<kbd>F</kbd> 换砖型/方向（长板能一头悬空跨深水）· <kbd>X</kbd> 拆 · <kbd>回车</kbd> 出发 · ' +
  '<kbd>1</kbd>~<kbd>7</kbd> 选关 · 也可以直接点画面试试';

export function hud(S) {
  const lvName = ['搭桥过河', '规划路线', '长板跨深水', '悬挑跳板', '小岛中转', '大工程', '自由搭建'][S.level - 1] || '';
  const total = S.world ? S.world.stars.length : 0;
  const got = S.world ? S.world.stars.filter((s) => s.taken).length : 0;
  return [
    ['关卡', `${S.level}·${lvName}`],
    ['砖块', S.bricksLeft > 900 ? '管够' : S.bricksLeft],
    ['星星', total ? `⭐${got}/${total}` : '⭐' + S.stars],
    ['目标', total ? '收齐星星→旗子' : '随便搭']
  ];
}

export function makeBackground() { return null; }

/* ---------------- 常量与工具 ---------------- */

const PALETTE = [0xe03131, 0xffd43b, 0x4dabf7, 0x51cf66, 0xff922b, 0xf1f3f5, 0x9b7bff, 0xff8fb1];
const GRID_COLS = 9, GRID_ROWS = 7;   // 与 game.js 的世界尺寸对应（避免循环引用不 import）

/** 逻辑格 → 3D 世界（板面平躺，逻辑 y → z；网格在画布里居中） */
function cellWorld(L, x, z) {
  const ox = (L.W - GRID_COLS * L.CELL) / 2;
  const oz = (L.H - GRID_ROWS * L.CELL) / 2;
  return [ox + x * L.CELL - L.W / 2 + L.CELL / 2, oz + z * L.CELL - L.H / 2 + L.CELL / 2];
}

/* ---------------- 3D 舞台 ---------------- */

let st = null, fx = null;
let cellGroup = null, brickPool = [], brickUsed = 0;
let ghostA = null, ghostB = null, figG = null, goalFlag = null, waterTiles = [], starCoins = [];
let tipEl = null;
let builtKey = '';

function ensureStage(L) {
  // 重进游戏时旧舞台已被拆除：清空视图模块的旧状态再重建
  brickPool = []; brickUsed = 0; builtKey = ''; waterTiles = []; starCoins = [];

  st = createStage({
    W: L.W, H: L.H,
    ortho: { w: L.W, h: L.H, margin: 1.12 },
    cam: [0, 700, 780], look: [0, 0, 0],       // 42° 斜俯：砖块的侧面和影子都看得见
    bg: 0x87ceeb
  });
  if (!st) return false;
  st.cellSize = L.CELL;   // pickCell 射线拾取要用

  // 真阴影：立体感的最大来源
  const T = st.T;
  st.renderer.shadowMap.enabled = true;
  st.renderer.shadowMap.type = T.PCFSoftShadowMap;
  st.dl.castShadow = true;
  st.dl.shadow.mapSize.set(2048, 2048);
  const sc = st.dl.shadow.camera;
  sc.left = -700; sc.right = 700; sc.top = 700; sc.bottom = -700;
  sc.near = 100; sc.far = 2600;
  st.dl.shadow.bias = -0.0004;

  fx = createFX3D(st, (x, y, z) => [x - L.W / 2, z || 24, y - L.H / 2]);

  // 底板（乐高底板的绿色厚板）
  const plate = new T.Mesh(
    new T.BoxGeometry(L.W - 40, 18, L.H - 40),
    new T.MeshLambertMaterial({ color: 0x6fbf5f })
  );
  plate.position.y = -9;
  plate.receiveShadow = true;
  st.scene.add(plate);

  // 底板 stud：绿色小圆柱阵列（真·乐高底板的样子）
  const studGeo = new T.CylinderGeometry(7, 7, 5, 10);
  const studMat = new T.MeshLambertMaterial({ color: 0x7fce6f });
  for (let z = 0; z < GRID_ROWS; z++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const s = new T.Mesh(studGeo, studMat);
      const [wx, wz] = cellWorld(L, x, z);
      s.position.set(wx, 2.5, wz);
      st.scene.add(s);
    }
  }

  // 单元格内容（水 / 深水 / 高台）每关重建
  cellGroup = new T.Group();
  st.scene.add(cellGroup);

  // 幽灵光标：主格 + 长板的第二格；能不能放用白/红区分
  const mkGhost = (op) => {
    const g = new T.Group();
    const gb = new T.Mesh(
      new T.BoxGeometry(L.CELL * 0.94, L.BRICK_H, L.CELL * 0.94),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op })
    );
    gb.position.y = L.BRICK_H / 2;
    g.add(gb);
    const gring = new T.Mesh(
      new T.BoxGeometry(L.CELL * 1.04, 3, L.CELL * 1.04),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op + 0.2 })
    );
    gring.position.y = -L.BRICK_H / 2 - 1;
    g.add(gring);
    g.userData = { body: gb, ring: gring };
    st.scene.add(g);
    return g;
  };
  ghostA = mkGhost(0.38);
  ghostB = mkGhost(0.3);

  // 终点小旗
  goalFlag = new T.Group();
  const pole = new T.Mesh(new T.BoxGeometry(5, 64, 5), new T.MeshBasicMaterial({ color: 0xe9ecef }));
  pole.position.y = 32;
  pole.castShadow = true;
  goalFlag.add(pole);
  const flag = new T.Mesh(new T.BoxGeometry(32, 19, 4), new T.MeshBasicMaterial({ color: 0xff6b6b }));
  flag.position.set(16, 54, 0);
  goalFlag.add(flag);
  st.scene.add(goalFlag);

  // 小人：腿 + 身体 + 圆手 + 头像头
  figG = new T.Group();
  const legMat = new T.MeshLambertMaterial({ color: 0x4dabf7 });
  for (const lx of [-8, 8]) {
    const leg = new T.Mesh(new T.BoxGeometry(11, 20, 11), legMat);
    leg.position.set(lx, 10, 0);
    leg.castShadow = true;
    figG.add(leg);
  }
  const torso = new T.Mesh(new T.BoxGeometry(30, 26, 16), new T.MeshLambertMaterial({ color: 0xff6b6b }));
  torso.position.y = 33;
  torso.castShadow = true;
  figG.add(torso);
  for (const hx of [-19, 19]) {
    const hand = new T.Mesh(new T.CylinderGeometry(5, 5, 14, 10), new T.MeshLambertMaterial({ color: 0xffd43b }));
    hand.position.set(hx, 32, 0);
    figG.add(hand);
  }
  const img = new Image();
  img.src = avatar.heroURL();
  const tex = new T.Texture(img);
  tex.colorSpace = T.SRGBColorSpace;
  const head = new T.Mesh(new T.CylinderGeometry(13, 13, 18, 16), new T.MeshLambertMaterial({ color: 0xffe066 }));
  head.position.y = 55;
  head.castShadow = true;
  figG.add(head);
  const face = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
  face.scale.set(24, 24, 1);
  face.position.set(0, 56, 13.5);
  figG.add(face);
  img.onload = () => { tex.needsUpdate = true; };
  st.scene.add(figG);

  // 目标提示条：挂在 fx3d 的飘字层里，随舞台一起创建/拆除
  tipEl = document.createElement('div');
  tipEl.style.cssText =
    'position:absolute;top:12px;left:50%;transform:translateX(-50%);' +
    'background:rgba(33,37,66,.86);color:#fff;padding:10px 18px;border-radius:14px;' +
    'font-weight:700;font-size:17px;white-space:nowrap;pointer-events:none;';
  tipEl.style.display = 'none';
  fx.layer.appendChild(tipEl);

  st.onFrame = (dt) => { if (fx) fx.update(dt); };
  return true;
}

/** 一块积木 = 盒子 + 顶面 stud（长板两格两颗），从池子里取 */
function takeBrick(L, colorHex, len) {
  const T = st.T;
  let g = brickPool[brickUsed];
  if (!g) {
    g = new T.Group();
    const body = new T.Mesh(
      new T.BoxGeometry(1, L.BRICK_H, 1),
      new T.MeshLambertMaterial({ color: 0xffffff })
    );
    body.position.y = L.BRICK_H / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const studs = [];
    for (let i = 0; i < 2; i++) {
      const stud = new T.Mesh(
        new T.CylinderGeometry(L.CELL * 0.2, L.CELL * 0.2, 8, 12),
        new T.MeshLambertMaterial({ color: 0xffffff })
      );
      stud.position.y = L.BRICK_H + 4;
      stud.castShadow = true;
      g.add(stud);
      studs.push(stud);
    }
    g.userData = { body, studs };
    st.scene.add(g);
    brickPool.push(g);
  }
  g.visible = true;
  const b = g.userData.body;
  b.scale.set(len === 2 ? L.CELL * 1.88 : L.CELL * 0.94, 1, L.CELL * 0.94);
  b.material.color.setHex(colorHex);
  // 单砖只留中间一颗 stud，长板两颗
  g.userData.studs[0].visible = true;
  g.userData.studs[0].scale.set(1, 1, 1);
  g.userData.studs[1].visible = len === 2;
  if (len === 2) {
    g.userData.studs[0].position.x = -L.CELL / 2;
    g.userData.studs[1].position.x = L.CELL / 2;
  } else {
    g.userData.studs[0].position.x = 0;
  }
  brickUsed++;
  return g;
}

/** 格子表面离板面的高度（渲染用） */
function topY(w, x, z, L) {
  const g = w.ground[z][x];
  const n = w.stacks[z][x].length;
  return (g < 0 ? 0 : g * L.BRICK_H) + n * L.BRICK_H;
}

/** 每关 / 每次搭拆后重建整个板面（格子少，重建比 diff 简单可靠） */
function rebuild(S, L) {
  const T = st.T;
  const w = S.world;
  cellGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  st.scene.remove(cellGroup);
  cellGroup = new T.Group();
  st.scene.add(cellGroup);
  waterTiles = [];
  starCoins = [];
  brickUsed = 0;

  for (let z = 0; z < w.D; z++) {
    for (let x = 0; x < w.W; x++) {
      const g = w.ground[z][x];
      const [wx, wz] = cellWorld(L, x, z);

      // 水：浅水亮蓝、深水又暗又凹（长板才能跨）
      if (g < 0) {
        const deep = g === -2;
        const water = new T.Mesh(
          new T.BoxGeometry(L.CELL - 2, 8, L.CELL - 2),
          new T.MeshLambertMaterial({ color: deep ? 0x1864ab : 0x4dabf7, transparent: true, opacity: 0.9 })
        );
        water.position.set(wx, deep ? -8 : -4, wz);
        water.receiveShadow = true;
        cellGroup.add(water);
        waterTiles.push(water);
        continue;
      }
      // 高台：从底板立起来的柱子
      if (g > 0) {
        const col = new T.Mesh(
          new T.BoxGeometry(L.CELL - 2, g * L.BRICK_H, L.CELL - 2),
          new T.MeshLambertMaterial({ color: 0x8fce7f })
        );
        col.position.set(wx, (g * L.BRICK_H) / 2, wz);
        col.castShadow = true;
        col.receiveShadow = true;
        cellGroup.add(col);
      }
      // 该格叠着的积木（长板在原点格渲染一次）
      const stack = w.stacks[z][x];
      for (const brick of stack) {
        if (brick.l === 2 && (x !== brick.ox || z !== brick.oz)) continue;
        const m = takeBrick(L, PALETTE[brick.c % PALETTE.length], brick.l);
        if (brick.l === 2) {
          const [ax, az] = cellWorld(L, brick.ox, brick.oz);
          const [bx, bz] = cellWorld(L, brick.x2, brick.z2);
          const horiz = brick.x2 !== brick.ox;
          m.position.set((ax + bx) / 2, (g < 0 ? 0 : g * L.BRICK_H) + stack.indexOf(brick) * L.BRICK_H, (az + bz) / 2);
          m.rotation.y = horiz ? 0 : Math.PI / 2;
          // 长板的两颗 stud 也要跟着转向
          m.userData.studs.forEach((s) => { s.rotation.y = 0; });
        } else {
          m.position.set(wx, (g < 0 ? 0 : g * L.BRICK_H) + stack.indexOf(brick) * L.BRICK_H, wz);
          m.rotation.y = 0;
        }
      }
    }
  }

  // 星星：金色乐高粒，浮在格子上方
  for (const s of w.stars) {
    const coin = new T.Mesh(
      new T.CylinderGeometry(L.CELL * 0.2, L.CELL * 0.2, 10, 14),
      new T.MeshLambertMaterial({ color: 0xffd43b, emissive: 0x6b4c00 })
    );
    const [sx, sz] = cellWorld(L, s.x, s.z);
    coin.position.set(sx, topY(w, s.x, s.z, L) + 26, sz);
    coin.castShadow = true;
    coin.visible = !s.taken;
    cellGroup.add(coin);
    starCoins.push({ mesh: coin, star: s });
  }

  // 终点旗
  if (w.goal) {
    const [gx, gz] = cellWorld(L, w.goal.x, w.goal.z);
    goalFlag.visible = true;
    goalFlag.position.set(gx, topY(w, w.goal.x, w.goal.z, L), gz);
  } else goalFlag.visible = false;
  builtKey = levelKey(S);
}

function levelKey(S) {
  return S.level + ':' + S.world.stacks.map((r) => r.map((c) => c.length).join('')).join('|');
}

/* ---------------- 每帧绘制 ---------------- */

export function draw(ctx, S, L) {
  if (st && !stageAlive(st)) st = null;   // 3D 舞台被拆除过（重玩 / 切游戏）→ 重建
  if (!st && !ensureStage(L)) return;
  if (!S.world) return;
  if (builtKey !== levelKey(S)) rebuild(S, L);

  const w = S.world;

  // 关卡开场的目标提示（带一点淡出尾巴）
  if (tipEl) {
    const on = S.tipT > 0;
    tipEl.style.display = on ? 'block' : 'none';
    tipEl.style.opacity = Math.min(1, S.tipT / 1.2);
    tipEl.textContent = S.tip || '';
  }

  // 幽灵光标：主格 + 长板第二格；可放白、不可放红
  {
    const { x, z } = S.cursor;
    const [wx, wz] = cellWorld(L, x, z);
    const ok = S.ghostOk;
    const col = ok ? 0xffffff : 0xff6b6b;
    const show = S.phase === 'build';

    ghostA.visible = show;
    ghostA.position.set(wx, topY(w, x, z, L) + L.BRICK_H / 2, wz);
    ghostA.userData.body.material.color.setHex(col);
    ghostA.userData.ring.material.color.setHex(col);
    ghostA.userData.body.material.opacity = 0.28 + Math.sin(S.T * 5) * 0.1;

    const peer = S.brickLen === 2 ? peerOf(S) : null;
    ghostB.visible = show && !!peer;
    if (peer && show) {
      const [px, pz] = cellWorld(L, peer.x, peer.z);
      ghostB.position.set(px, topY(w, peer.x, peer.z, L) + L.BRICK_H / 2, pz);
      ghostB.userData.body.material.color.setHex(col);
      ghostB.userData.ring.material.color.setHex(col);
    }
  }

  // 水面轻微起伏
  for (let i = 0; i < waterTiles.length; i++) {
    waterTiles[i].position.y = (waterTiles[i].position.y > -6 ? -4 : -8) + Math.sin(S.T * 2.4 + i) * 1.2;
  }

  // 星星旋转 / 收集后隐藏
  for (const s of starCoins) {
    s.mesh.visible = !s.star.taken;
    s.mesh.rotation.y += 0.04;
    s.mesh.rotation.z = Math.sin(S.T * 2) * 0.18;
  }

  // 小人：格子间插值 + 走路小跳 + 面朝前进方向
  {
    const t = Math.min(1, S.prog);
    const fx0 = lerp(S.from.x, S.fig.x, t);
    const fz0 = lerp(S.from.z, S.fig.z, t);
    const gA = w.ground[S.from.z] ? w.ground[S.from.z][S.from.x] : 0;
    const gB = w.ground[S.fig.z] ? w.ground[S.fig.z][S.fig.x] : 0;
    const nA = w.stacks[S.from.z][S.from.x].length;
    const nB = w.stacks[S.fig.z][S.fig.x].length;
    const yA = (gA < 0 ? 0 : gA * L.BRICK_H) + nA * L.BRICK_H;
    const yB = (gB < 0 ? 0 : gB * L.BRICK_H) + nB * L.BRICK_H;
    const y = lerp(yA, yB, t) + Math.abs(Math.sin(t * Math.PI)) * (S.phase === 'walk' ? 9 : 0);
    const [wx, wz] = cellWorld(L, fx0, fz0);
    figG.position.set(wx, y, wz);
    if (S.phase === 'walk') {
      const dx = S.fig.x - S.from.x, dz = S.fig.z - S.from.z;
      if (dx || dz) figG.rotation.y = Math.atan2(dx, dz);
      figG.rotation.z = Math.sin(S.T * 18) * 0.06;
    } else {
      figG.rotation.z = Math.sin(S.T * 2) * 0.03;
    }
  }

  // 终点旗飘动
  if (goalFlag.visible) goalFlag.rotation.y = Math.sin(S.T * 2.6) * 0.14;

  st.render(1 / 60);
}

/** 长板砖占的第二格（跟 game.js 的 ghostPeer 一样的算法，只读一份） */
function peerOf(S) {
  const dx = S.brickDir === 0 ? 1 : 0, dz = S.brickDir === 0 ? 0 : 1;
  const x = S.cursor.x + dx, z = S.cursor.z + dz;
  if (x < 0 || z < 0 || x >= GRID_COLS || z >= GRID_ROWS) return null;
  return { x, z };
}

/* ---------------- 射线拾取 ---------------- */

/** 画布点击 → 板面格子：把 2D 画布上的点还原成 3D 射线，与板面 y=0 求交 */
export function pickCell(p, LW, LH) {
  if (!st || !st.cellSize) return null;
  const T = st.T;
  // 2D 画布在舞台元素里按宽高比居中 letterbox，先换算成元素内的相对位置
  const rect2 = st.two.getBoundingClientRect();
  const rectE = st.stageEl.getBoundingClientRect();
  const relX = rect2.left - rectE.left + (p.x / LW) * rect2.width;
  const relY = rect2.top - rectE.top + (p.y / LH) * rect2.height;
  const ndc = new T.Vector2((relX / rectE.width) * 2 - 1, -(relY / rectE.height) * 2 + 1);
  const ray = new T.Raycaster();
  ray.setFromCamera(ndc, st.camera);

  if (Math.abs(ray.ray.direction.y) < 1e-6) return null;
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  if (t < 0) return null;
  const wx = ray.ray.origin.x + ray.ray.direction.x * t;
  const wz = ray.ray.origin.z + ray.ray.direction.z * t;

  const cs = st.cellSize;
  const ox = (LW - GRID_COLS * cs) / 2;
  const oz = (LH - GRID_ROWS * cs) / 2;
  const x = Math.floor((wx + LW / 2 - ox) / cs);
  const z = Math.floor((wz + LH / 2 - oz) / cs);
  if (x < 0 || z < 0 || x >= GRID_COLS || z >= GRID_ROWS) return null;
  return { x, z };
}
