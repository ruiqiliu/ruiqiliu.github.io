/* =====================================================================
   core/audio.js — 音效
   全部用 WebAudio 振荡器实时合成，不带任何音频文件。
   音色刻意做得柔和（音量小、sine/triangle 为主），避免吵到小朋友。
   ===================================================================== */

export const Snd = {
  ac: null,
  on: true,

  ensure() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ac = new AC();
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },

  /** 一个简单的包络音：f → f2，斜率由 exponentialRamp 控制 */
  tone(f, dur, type, vol, f2) {
    if (!this.on) return;
    this.ensure();
    const ac = this.ac;
    if (!ac) return;

    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(60, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol == null ? 0.07 : vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  },

  /** 上行音阶，用来表达「连击」，参数是连击数 */
  note(i) {
    const sc = [0, 2, 4, 7, 9, 12, 14, 16];
    this.tone(440 * Math.pow(2, sc[Math.min(i, sc.length - 1)] / 12), 0.22, 'sine', 0.07);
  },
  pop(i) { this.tone(520 + Math.min(i, 10) * 60, 0.14, 'triangle', 0.06); },
  eat() { this.tone(620, 0.12, 'sine', 0.07, 900); },
  star() { [0, 4, 7, 12].forEach((n, i) => setTimeout(() => this.tone(660 * Math.pow(2, n / 12), 0.16, 'sine', 0.06), i * 60)); },
  win() { [0, 4, 7, 12, 16].forEach((n, i) => setTimeout(() => this.tone(523 * Math.pow(2, n / 12), 0.28, 'sine', 0.07), i * 95)); },
  soft() { this.tone(300, 0.22, 'sine', 0.055, 220); },
  drop() { this.tone(180, 0.09, 'triangle', 0.05, 120); },
  turn() { this.tone(700, 0.07, 'sine', 0.045); },
  line(n) { [0, 4, 7].forEach((k, i) => setTimeout(() => this.tone((523 + n * 60) * Math.pow(2, k / 12), 0.22, 'sine', 0.065), i * 70)); },

  /* --- 小鸟飞飞 --- */
  flap() { this.tone(560, 0.09, 'sine', 0.05, 780); },
  pass() { this.tone(880, 0.12, 'triangle', 0.06, 1180); },
  bump() { this.tone(220, 0.18, 'triangle', 0.06, 130); },

  /* --- 迷宫探险 --- */
  step() { this.tone(360, 0.04, 'sine', 0.025); },
  hint() { this.tone(1040, 0.1, 'sine', 0.04, 1400); }
};
