/**
 * Tiny WebAudio engine — no external audio library.
 *
 * Handles: browser autoplay unlock on first gesture, looping ambient beds
 * with cross-faded volume, one-shot FX, a global mute toggle and a lowpass
 * "muffle" used when a modal opens (same trick the reference uses).
 */
const FILES = {
  amb_stage1: "amb_stage1.wav",
  amb_stage2: "amb_stage2.wav",
  amb_stage3: "amb_stage3.wav",
  amb_stage4: "amb_stage4.wav",
  amb_stage5: "amb_stage5.wav",
  click: "fx_click.wav",
  whoosh: "fx_whoosh.wav",
  shatter: "fx_shatter.wav",
  chime: "fx_chime.wav",
  hold: "fx_hold.wav",
  tunnel: "fx_tunnel.wav",
  drag: "fx_drag.wav",
  xp: "fx_xp.wav",
  loader: "fx_loader.wav",
  enter: "fx_enter.wav",
};

const LOOPS = new Set([
  "amb_stage1",
  "amb_stage2",
  "amb_stage3",
  "amb_stage4",
  "amb_stage5",
]);

export default class AudioEngine {
  constructor(base = "assets/audio/") {
    this.base = base;
    this.ctx = null;
    this.buffers = new Map();
    this.playing = new Map();
    this.enabled = true;
    this.muted = false;
    this._unlocked = false;
    this._pending = [];
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle);
    this.muffle.connect(this.ctx.destination);

    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      this.ctx.resume();
      const q = this._pending.slice();
      this._pending.length = 0;
      q.forEach(([n, o]) => this.play(n, o));
    };
    ["pointerdown", "touchstart", "keydown", "wheel"].forEach((ev) =>
      window.addEventListener(ev, unlock, { once: true, passive: true }),
    );
  }

  isUnlocked() {
    return this._unlocked;
  }

  async preload(names = Object.keys(FILES)) {
    this.init();
    if (!this.ctx) return;
    await Promise.all(
      names.map(async (n) => {
        if (this.buffers.has(n) || !FILES[n]) return;
        try {
          const r = await fetch(this.base + FILES[n]);
          const ab = await r.arrayBuffer();
          this.buffers.set(n, await this.ctx.decodeAudioData(ab));
        } catch {
          /* audio is decorative — never block the experience */
        }
      }),
    );
  }

  play(name, { volume = 0.6, fadeIn = 0.6, rate = 1 } = {}) {
    if (!this.enabled || this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (!this._unlocked) {
      this._pending.push([name, { volume, fadeIn, rate }]);
      return;
    }
    const buf = this.buffers.get(name);
    if (!buf) return;
    if (LOOPS.has(name) && this.playing.has(name)) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = LOOPS.has(name);
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      t + Math.max(0.01, fadeIn),
    );
    src.connect(g);
    g.connect(this.master);
    src.start();
    if (src.loop) this.playing.set(name, { src, g });
    else
      src.onended = () => {
        try {
          src.disconnect();
          g.disconnect();
        } catch {}
      };
  }

  stop(name, { fadeOut = 1.2 } = {}) {
    const e = this.playing.get(name);
    if (!e) return;
    this.playing.delete(name);
    const t = this.ctx.currentTime;
    try {
      e.g.gain.cancelScheduledValues(t);
      e.g.gain.setValueAtTime(Math.max(0.0002, e.g.gain.value), t);
      e.g.gain.exponentialRampToValueAtTime(
        0.0001,
        t + Math.max(0.01, fadeOut),
      );
      e.src.stop(t + fadeOut + 0.05);
    } catch {}
  }

  stopAllLoops() {
    [...this.playing.keys()].forEach((k) => this.stop(k));
  }

  /** 0 = clear, 1 = fully muffled (modal open). */
  setMuffle(amount) {
    if (!this.muffle) return;
    const f = 20000 - amount * 19400;
    this.muffle.frequency.setTargetAtTime(
      Math.max(400, f),
      this.ctx.currentTime,
      0.12,
    );
  }

  setMuted(m) {
    this.muted = m;
    if (!this.master) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.15);
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this.stopAllLoops();
  }
}
