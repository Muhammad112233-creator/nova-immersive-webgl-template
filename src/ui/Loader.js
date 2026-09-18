import gsap from "gsap";

/**
 * Loader counter drawn to its own 2D canvas so it can sit *inside* the WebGL
 * frame (under the transparent canvas) and animate independently of the DOM.
 *
 * It counts 99 → 0 while assets stream in, then morphs into the wordmark and
 * slides off to the left. Mirrors the reference's LoaderTextOverlay.
 */
export default class LoaderCounter {
  constructor(container) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;";
    this.ctx = this.canvas.getContext("2d");
    container.appendChild(this.canvas);

    this.number = 99;
    this._transitionT = 0; // 0 = number, 1 = wordmark
    this._offsetX = 0;
    this._opacity = 1;
    this.logo = null;
    this.resize(window.innerWidth, window.innerHeight);
  }

  loadLogo(src) {
    const img = new Image();
    img.onload = () => {
      this.logo = img;
      this.redraw();
    };
    img.src = src;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  setNumber(n) {
    if (n === this.number) return;
    this.number = n;
    this.redraw();
  }

  redraw() {
    const { ctx, w, h } = this;
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (this._opacity <= 0.001) return;

    const phone = w < 768;
    const fontPx = phone ? h * (110 / 1080) : h * (180 / 1080);
    const marginX = phone ? w * (80 / 1920) : w * (40 / 1920);
    const baseline = h - h * (40 / 1080);

    ctx.save();
    ctx.globalAlpha = this._opacity;
    ctx.translate(this._offsetX, 0);

    const t = this._transitionT;

    // Number fades/scales down as the wordmark fades in.
    if (t < 1) {
      ctx.save();
      ctx.globalAlpha = this._opacity * (1 - t);
      ctx.font = `700 ${fontPx}px "Space Mono", "Supply Sans", monospace`;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "alphabetic";
      const scale = 1 - t * 0.12;
      ctx.translate(marginX, baseline);
      ctx.scale(scale, scale);
      ctx.fillText(String(this.number), 0, 0);
      ctx.restore();
    }

    if (t > 0 && this.logo) {
      ctx.save();
      ctx.globalAlpha = this._opacity * t;
      const targetH = fontPx * 0.52;
      const ratio = this.logo.width / this.logo.height;
      const targetW = targetH * ratio;
      ctx.drawImage(this.logo, marginX, baseline - targetH, targetW, targetH);
      ctx.restore();
    }

    ctx.restore();
  }

  /** Animate number → wordmark, then slide the whole thing off-screen. */
  finish(onMorphComplete) {
    const tl = gsap.timeline();
    tl.to(this, {
      _transitionT: 1,
      duration: 1,
      ease: "power2.inOut",
      onUpdate: () => this.redraw(),
      onComplete: () => onMorphComplete && onMorphComplete(),
    });
    tl.to(this, {
      _offsetX: -750,
      _opacity: 0,
      duration: 0.8,
      delay: 1.2,
      ease: "power3.in",
      onUpdate: () => this.redraw(),
      onComplete: () => {
        this.canvas.style.display = "none";
      },
    });
    return tl;
  }

  dispose() {
    this.canvas.remove();
  }
}
