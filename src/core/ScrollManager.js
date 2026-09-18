/**
 * Virtual scroll. The document never actually scrolls — the page is
 * `overflow:hidden` and a single float ("scrollPos", measured in virtual
 * pixels) is advanced by wheel / touch / keyboard, then eased toward its
 * target every frame. Stages subscribe and receive a 0..1 progress value.
 *
 * This is how the reference keeps a fixed full-screen canvas while still
 * feeling like a long scrolling page.
 */
export default class ScrollManager {
  constructor({ getTotalHeight }) {
    this.getTotalHeight = getTotalHeight;
    this.scrollPos = 0;
    this.targetScrollPos = 0;
    this.velocity = 0;
    this.ease = 0.085;
    this._held = false;
    this._enabled = true;
    this._subs = new Set();
    this._activeStage = null;

    this._onWheel = this._onWheel.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onKey = this._onKey.bind(this);
    this._touchY = 0;
  }

  attach(el = window) {
    this._el = el;
    el.addEventListener("wheel", this._onWheel, { passive: false });
    el.addEventListener("touchstart", this._onTouchStart, { passive: true });
    el.addEventListener("touchmove", this._onTouchMove, { passive: false });
    window.addEventListener("keydown", this._onKey);
  }

  detach() {
    if (!this._el) return;
    this._el.removeEventListener("wheel", this._onWheel);
    this._el.removeEventListener("touchstart", this._onTouchStart);
    this._el.removeEventListener("touchmove", this._onTouchMove);
    window.removeEventListener("keydown", this._onKey);
  }

  setEnabled(v) {
    this._enabled = v;
  }
  setHeld(v) {
    this._held = v;
  }
  setActiveStage(s) {
    this._activeStage = s;
  }
  onScrub(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  get max() {
    return Math.max(1, this.getTotalHeight() - window.innerHeight);
  }

  _canScroll() {
    if (!this._enabled || this._held) return false;
    // Any open modal/overlay blocks the virtual scroll.
    return !document.body.classList.contains("modal-open");
  }

  _onWheel(e) {
    if (!this._canScroll()) return;
    e.preventDefault();
    const d = Math.max(-120, Math.min(120, e.deltaY));
    this.targetScrollPos += d * 1.05;
    this._clamp();
  }

  _onTouchStart(e) {
    this._touchY = e.touches[0].clientY;
  }

  _onTouchMove(e) {
    if (!this._canScroll()) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    this.targetScrollPos += (this._touchY - y) * 2.1;
    this._touchY = y;
    this._clamp();
  }

  _onKey(e) {
    if (!this._canScroll()) return;
    const h = window.innerHeight;
    const map = {
      ArrowDown: h * 0.12,
      PageDown: h * 0.85,
      " ": h * 0.85,
      ArrowUp: -h * 0.12,
      PageUp: -h * 0.85,
      Home: -this.max,
      End: this.max,
    };
    if (e.key in map) {
      e.preventDefault();
      if (e.key === "Home") this.targetScrollPos = 0;
      else if (e.key === "End") this.targetScrollPos = this.max;
      else this.targetScrollPos += map[e.key];
      this._clamp();
    }
  }

  _clamp() {
    this.targetScrollPos = Math.max(
      0,
      Math.min(this.max, this.targetScrollPos),
    );
  }

  /** Programmatic jump (used by ruler nav). */
  jumpTo(pos) {
    this.scrollPos = this.targetScrollPos = Math.max(
      0,
      Math.min(this.max, pos),
    );
  }

  update() {
    const prev = this.scrollPos;
    this.scrollPos += (this.targetScrollPos - this.scrollPos) * this.ease;
    if (Math.abs(this.targetScrollPos - this.scrollPos) < 0.01) {
      this.scrollPos = this.targetScrollPos;
    }
    this.velocity = this.scrollPos - prev;
    const p = this.scrollPos / this.max;
    for (const fn of this._subs) fn(p, this.scrollPos, this.velocity);
    return p;
  }
}
