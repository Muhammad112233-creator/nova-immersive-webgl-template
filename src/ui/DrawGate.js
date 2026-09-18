import gsap from "gsap";

/**
 * "DRAW A CIRCLE" — the gesture that starts the experience.
 *
 * We accumulate the signed angle swept around the screen centre while the
 * pointer is down. One full turn (2π, in either direction) completes the
 * gate. A ghost ring demos the gesture if the user hesitates.
 *
 * Touch and mouse share the same pointer-event path; keyboard users get an
 * Enter/Space fallback so the site is never a dead end.
 */
export default class DrawGate {
  constructor(ui, { onComplete, onProgress, audio, canvas } = {}) {
    this.ui = ui;
    this.audio = audio;
    this.canvas = canvas || window;
    this.onComplete = onComplete;
    this.onProgress = onProgress;
    this.isComplete = false;
    this.ready = false;

    this._dragging = false;
    this._accum = 0;
    this._lastAngle = 0;
    this._demoTimer = null;
    this._demoTween = null;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKey = this._onKey.bind(this);
  }

  setReady() {
    if (this.ready) return;
    this.ready = true;
    this.ui.showCircleHint(true);
    this._bind();
    this._scheduleDemo();
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener("pointerdown", this._onDown);
    window.addEventListener("pointermove", this._onMove, { passive: true });
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onUp);
    window.addEventListener("keydown", this._onKey);
  }

  _unbind() {
    const el = this.canvas;
    el.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    window.removeEventListener("keydown", this._onKey);
  }

  /* --------------------------------------------------------- ghost demo -- */
  _scheduleDemo() {
    clearTimeout(this._demoTimer);
    this._demoTimer = setTimeout(() => this._playDemo(), 2600);
  }

  _playDemo() {
    if (this.isComplete || this._dragging) return;
    this.ui.setCircleDemo(true);
    const o = { a: 0 };
    this._demoTween = gsap.to(o, {
      a: 360,
      duration: 2.2,
      ease: "power1.inOut",
      repeat: -1,
      repeatDelay: 0.7,
      onUpdate: () => this.ui.setCircleAngle(o.a),
    });
  }

  _stopDemo() {
    clearTimeout(this._demoTimer);
    if (this._demoTween) {
      this._demoTween.kill();
      this._demoTween = null;
    }
    this.ui.setCircleDemo(false);
  }

  /* ------------------------------------------------------------- input -- */
  _angleOf(e) {
    const cx = window.innerWidth / 2,
      cy = window.innerHeight / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  _onDown(e) {
    if (!this.ready || this.isComplete) return;
    this._dragging = true;
    this._accum = 0;
    this._lastAngle = this._angleOf(e);
    this._stopDemo();
    this.ui.setCircleDragging(true);
    this.audio && this.audio.play("drag", { volume: 0.4, fadeIn: 0.05 });
  }

  _onMove(e) {
    if (!this._dragging || this.isComplete) return;
    const a = this._angleOf(e);
    let d = a - this._lastAngle;
    // Unwrap across the ±π seam.
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this._lastAngle = a;
    this._accum += d;

    const p = Math.min(1, Math.abs(this._accum) / (Math.PI * 2));
    this.ui.setCircleAngle((this._accum * 180) / Math.PI);
    this.onProgress && this.onProgress(p);
    if (p >= 1) this._complete();
  }

  _onUp() {
    if (!this._dragging) return;
    this._dragging = false;
    this.ui.setCircleDragging(false);
    if (!this.isComplete) {
      this._accum = 0;
      this.onProgress && this.onProgress(0);
      this._scheduleDemo();
    }
  }

  _onKey(e) {
    if (this.isComplete || !this.ready) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._complete();
    }
  }

  _complete() {
    if (this.isComplete) return;
    this.isComplete = true;
    this._stopDemo();
    this._unbind();
    this.ui.showCircleHint(false);
    this.ui.setCircleDragging(false);
    this.audio && this.audio.play("chime", { volume: 0.55, fadeIn: 0.01 });
    this.onComplete && this.onComplete();
  }

  dispose() {
    this._stopDemo();
    this._unbind();
  }
}
