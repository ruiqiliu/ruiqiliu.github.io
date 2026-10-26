/* =====================================================================
   games/numtrain/game.js — 数字小列车 · 逻辑层（12 号游戏，键 L）
   面向正在学 10 以内数的小朋友：排序 / 数的组成 / 接龙，三类玩法
   从易到难排成 9 关通关模式。答错只是车厢抖一抖，绝不惩罚；
   卡住了点「💡 教我」，小火车自己示范一块。

   三类题型：
   - sort 排车厢：把乱序数字块按从小到大（进阶关从大到小）点进车尾；
   - bond 挂车厢：车头是 N，选两块数字让它们加起来正好 = N
     （块上画着圆点，可以数）；
   - seq 接龙：1,2,_,4 → 从候选块里挑对的补上空车厢。

   过关流程：答对一道 → 小火车欢呼一声进下一道；一关的题目全做完
   → 星星 +1、自动开进下一关。进度（打到第几关）会记住。
   ===================================================================== */
import { clamp, ri, shuffle } from '../../core/util.js';
import { loadNumber, saveNumber } from '../../core/storage.js';
import { createControls } from './controls.js';
import { draw, hud as hudOf, PADS, HINT } from './view.js';

export const meta = {
  id: 'numtrain',
  name: '数字小列车',
  icon: '🚂',
  accent: '#ffe8b3',
  desc: ['10 以内排一排、拼一拼', '开着小火车过关']
};

const BEST_KEY = 'hpy-numtrain-level';
const STARS_KEY = 'hpy-numtrain-stars';

export const L = { W: 800, H: 560 };

/* ---------------- 关卡表 ---------------- */

const LEVELS = [
  { name: '小小列车员', kind: 'sort', rounds: 3, size: 3, lo: 1, hi: 4 },
  { name: '车厢排排队', kind: 'sort', rounds: 4, size: 4, lo: 1, hi: 6 },
  { name: '挂车厢', kind: 'bond', rounds: 4, max: 5 },
  { name: '数字接龙', kind: 'seq', rounds: 4, len: 4, holes: 1, lo: 1, hi: 7 },
  { name: '长长列车', kind: 'sort', rounds: 4, size: 5, lo: 1, hi: 9 },
  { name: '大车头', kind: 'bond', rounds: 5, max: 9 },
  { name: '接龙高手', kind: 'seq', rounds: 5, len: 5, holes: 2, lo: 1, hi: 9 },
  { name: '倒着开', kind: 'sort', rounds: 4, size: 5, lo: 2, hi: 10, desc: true },
  { name: '列车长考验', mixed: true, rounds: 6 }
];

const MIXED = [
  { kind: 'sort', size: 5, lo: 2, hi: 10 },
  { kind: 'bond', max: 10 },
  { kind: 'seq', len: 5, holes: 2, lo: 1, hi: 10 },
  { kind: 'sort', size: 4, lo: 1, hi: 9, desc: true },
  { kind: 'bond', max: 9 },
  { kind: 'seq', len: 4, holes: 2, lo: 1, hi: 8 }
];

/* ---------------- 出题 ---------------- */

function distinct(lo, hi, n) {
  const out = [];
  while (out.length < n) {
    const v = ri(lo, hi);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function genRound(def) {
  if (def.kind === 'sort') {
    const nums = distinct(def.lo, def.hi, def.size);
    return {
      kind: 'sort',
      nums: shuffle(nums.slice()),
      target: def.desc ? nums.slice().sort((a, b) => b - a) : nums.slice().sort((a, b) => a - b),
      desc: !!def.desc
    };
  }
  if (def.kind === 'bond') {
    const n = ri(3, def.max);
    const a = ri(1, n - 1);
    const b = n - a;
    const cand = [a, b];
    // 干扰项从 1..max+1 里挑，且不能互相凑出 n；空间不够就少放几个（guard 防死循环）
    let guard = 0;
    while (cand.length < 5 && guard++ < 60) {
      const v = ri(1, def.max + 1);
      if (cand.includes(v)) continue;
      let bad = false;
      for (const c of cand) if (c + v === n) bad = true;
      if (!bad) cand.push(v);
    }
    return { kind: 'bond', n, answer: [a, b], cand: shuffle(cand) };
  }
  // seq：从 lo..hi 里挑一段连续数列，挖 holes 个空
  const start = ri(def.lo, def.hi - def.len + 1);
  const seq = [];
  for (let i = 0; i < def.len; i++) seq.push(start + i);
  const holeIdx = distinct(0, def.len - 1, def.holes);
  const missing = holeIdx.map((i) => seq[i]);
  const cand = missing.slice();
  let guard = 0;
  while (cand.length < missing.length + 2 && guard++ < 60) {
    const v = ri(Math.max(1, start - 1), def.hi + 1);
    if (!cand.includes(v) && !missing.includes(v)) cand.push(v);
  }
  return { kind: 'seq', seq, holes: holeIdx, missing, cand: shuffle(cand) };
}

export function create(env) {
  const { ctx, Snd, FX } = env;

  const S = {
    level: 1,
    stars: loadNumber(STARS_KEY),
    phase: 'play',          // play | cheer | win
    cheerT: 0,
    rounds: [],
    roundIdx: 0,
    round: null,
    pool: [],               // 候选块 {v, x, y, w, h, shake}
    slots: [],              // 车厢位 {v, pop}
    sel: -1,                // bond 模式里已选中的候选下标
    msg: '',
    msgT: 0,
    T: 0
  };

  /* ---------------- 关卡与题目装配 ---------------- */

  function buildLevel() {
    const def = LEVELS[S.level - 1];
    S.rounds = [];
    for (let i = 0; i < def.rounds; i++) {
      S.rounds.push(genRound(def.mixed ? MIXED[i % MIXED.length] : def));
    }
    S.roundIdx = 0;
    S.phase = 'play';
    S.cheerT = 0;
    S.msg = `第 ${S.level} 关 · ${def.name}`;
    S.msgT = 3.5;
    buildRound();
  }

  function buildRound() {
    const r = S.rounds[S.roundIdx];
    S.round = r;
    S.sel = -1;
    if (r.kind === 'sort') {
      S.slots = r.nums.map(() => ({ v: null, pop: 0 }));
      S.pool = r.nums.map((v) => ({ v, shake: 0 }));
    } else if (r.kind === 'bond') {
      S.slots = [{ v: null, pop: 0 }, { v: null, pop: 0 }];
      S.pool = r.cand.map((v) => ({ v, shake: 0 }));
    } else {
      S.slots = r.seq.map((v) => ({ v: v == null ? null : v, pop: 0, hole: v == null }));
      S.pool = r.cand.map((v) => ({ v, shake: 0 }));
    }
    layout();
  }

  /* ---------------- 布局（车尾槽位 + 候选块） ---------------- */

  const SLOT = 96, GAP = 14;

  function layout() {
    const n = Math.max(S.slots.length, 1);
    const totalW = n * SLOT + (n - 1) * GAP;
    const sx = 250 + (560 - totalW) / 2;      // 车道从 250 到 810
    S.slots.forEach((s, i) => {
      s.x = sx + i * (SLOT + GAP);
      s.y = 292;
      s.w = SLOT; s.h = SLOT;
    });
    // 候选块：一排最多 3 块，多的排第二排
    const m = S.pool.length;
    const cols = Math.min(3, m);
    const rows = Math.ceil(m / cols);
    const px = 400 - (cols * SLOT + (cols - 1) * GAP) / 2;
    S.pool.forEach((p, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      p.x = px + col * (SLOT + GAP);
      p.y = 420 + row * (SLOT + 16);
      p.w = SLOT; p.h = SLOT;
    });
  }

  /** 当前应该接的数字（从左往右的第一个空位） */
  function expected() {
    const r = S.round;
    if (r.kind === 'sort') {
      const i = S.slots.findIndex((s) => s.v === null);
      return i === -1 ? null : r.target[i];
    }
    if (r.kind === 'seq') {
      for (const i of r.holes) if (S.slots[i].v === null) return r.seq[i];
      return null;
    }
    return null;   // bond 不用「下一个」概念
  }

  function roundDone() {
    return S.slots.every((s) => s.v !== null);
  }

  /* ---------------- 作答 ---------------- */

  function correctPick(v) {
    const r = S.round;
    const exp = expected();
    if (r.kind === 'sort' || r.kind === 'seq') return v === exp;
    // bond：sel < 0 时任何块都可以先挂第一节（另一块补成 n 就行）
    return true;
  }

  function tapPool(idx) {
    if (S.phase !== 'play') return;
    const p = S.pool[idx];
    if (!p || p.v === null) return;
    const r = S.round;

    if (r.kind === 'bond') {
      tapBond(idx, p);
      return;
    }

    if (!correctPick(p.v)) {
      p.shake = 0.45;
      Snd.soft();
      return;
    }
    // 放进第一个空槽
    const slot = S.slots.find((s) => s.v === null);
    slot.v = p.v;
    slot.pop = 0.35;
    p.v = null;
    Snd.pop(2);
    afterMove();
  }

  function tapBond(idx, p) {
    const r = S.round;
    if (S.sel === -1) {
      S.sel = idx;
      Snd.pop(1);
      return;
    }
    if (S.sel === idx) { S.sel = -1; return; }   // 点自己 = 取消
    const a = S.pool[S.sel].v, b = p.v;
    if (a + b !== r.n) {
      S.pool[S.sel].shake = 0.45;
      p.shake = 0.45;
      S.sel = -1;
      Snd.soft();
      return;
    }
    const empty = S.slots.filter((s) => s.v === null);
    empty[0].v = a; empty[0].pop = 0.35;
    empty[1].v = b; empty[1].pop = 0.35;
    S.pool[S.sel].v = null;
    p.v = null;
    S.sel = -1;
    Snd.pop(4);
    afterMove();
  }

  function afterMove() {
    if (!roundDone()) return;
    // 一道题完成 → 欢呼
    S.phase = 'cheer';
    S.cheerT = 1.1;
    Snd.note(S.roundIdx + 1);
    const slot = S.slots[Math.floor(S.slots.length / 2)];
    FX.burst(slot.x + slot.w / 2, slot.y - 20, ['#ffd43b', '#51cf66', '#ff8fb1'], 14, 0.9);
  }

  /* ---------------- 每帧推进 ---------------- */

  function update(dt) {
    S.T += dt;
    S.msgT = Math.max(0, S.msgT - dt);

    for (const p of S.pool) p.shake = Math.max(0, p.shake - dt);
    for (const s of S.slots) s.pop = Math.max(0, s.pop - dt);

    if (S.phase === 'cheer') {
      S.cheerT -= dt;
      if (S.cheerT <= 0) {
        S.roundIdx++;
        if (S.roundIdx >= S.rounds.length) {
          // 一关全部完成 → 星星 +1、记住进度、开进下一关
          S.phase = 'win';
          S.cheerT = 2.2;
          S.stars++;
          saveNumber(STARS_KEY, S.stars);
          if (S.level < LEVELS.length) {
            saveNumber(BEST_KEY, Math.max(loadNumber(BEST_KEY, 1), S.level + 1));
          }
          Snd.win();
        } else {
          S.phase = 'play';
          buildRound();
        }
      }
      return;
    }

    if (S.phase === 'win') {
      S.cheerT -= dt;
      if (S.cheerT <= 0) {
        S.level = Math.min(S.level + 1, LEVELS.length);
        buildLevel();
      }
    }
  }

  /** 💡 教我：自动把下一块正确的放上（bond 补齐一对） */
  function hint() {
    if (S.phase !== 'play') return;
    const r = S.round;
    if (r.kind === 'bond') {
      if (S.sel !== -1) { S.sel = -1; }
      // 找一对和为 n 的候选
      for (let i = 0; i < S.pool.length; i++) {
        for (let j = i + 1; j < S.pool.length; j++) {
          if (S.pool[i].v !== null && S.pool[j].v !== null && S.pool[i].v + S.pool[j].v === r.n) {
            tapBond(i, S.pool[i]);
            if (S.sel === i) tapBond(j, S.pool[j]);
            return;
          }
        }
      }
      return;
    }
    const exp = expected();
    const idx = S.pool.findIndex((p) => p.v === exp);
    if (idx >= 0) tapPool(idx);
  }

  /** 🔀 候选块换个顺序（纯视觉，不影响答案） */
  function shufflePool() {
    if (S.phase !== 'play') return;
    const kept = S.pool.map((p) => p.v);
    const order = shuffle(kept.map((_, i) => i));
    kept.forEach((v, i) => { S.pool[i].v = order[i] === undefined ? null : kept[order[i]]; });
    S.sel = -1;
    Snd.pop(1);
  }

  /** bond：第二个空位该配几（教我/幽灵提示用） */
  /* ---------------- 对外接口 ---------------- */

  const api = {
    W: L.W,
    H: L.H,
    pads: PADS,
    hint: HINT,
    cursor: 'pointer',

    start() {
      S.level = clamp(loadNumber(BEST_KEY, 1), 1, LEVELS.length);
      buildLevel();
    },
    resize() { layout(); },
    restart() { buildLevel(); },
    destroy() {},

    update,
    render() { draw(ctx, S, L); },
    hud() { return hudOf(S); },

    action(name, down) {
      if (!down) return;
      const m = name.match(/^p(\d)$/);
      if (m) { tapPool(+m[1] - 1); return; }
      if (name === 'hint') return hint();
      if (name === 'shuffle') return shufflePool();
      const lv = name.match(/^lv(\d+)$/);
      if (lv) {
        const n = +lv[1];
        if (n >= 1 && n <= LEVELS.length) { S.level = n; buildLevel(); }
      }
    },

    /** 控制层把画布点击递进来 */
    tap(x, y) {
      if (S.phase !== 'play') return;
      const hit = (o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
      const idx = S.pool.findIndex((p) => p.v !== null && hit(p));
      if (idx >= 0) tapPool(idx);
    }
  };

  api.controls = createControls();
  return api;
}
