import gsap from "gsap";
import { SEGMENTS, AUDIO_BEDS } from "./config.js";

/**
 * Drives the whole experience.
 *
 * The virtual scroll produces one global 0..1 value. This class maps that
 * value onto the SEGMENTS list, activates/deactivates segments as the play
 * head crosses their bounds, and hands each active segment its own local
 * 0..1 progress.
 *
 * Gates are different: when the play head enters one, the scroll is held and
 * the gate plays on a timer, then releases the scroll on the other side. That
 * is what makes the transitions feel authored rather than scrubbed.
 */
export default class MasterTimeline {
  constructor(ctx, segmentImpls) {
    this.ctx = ctx;
    this.defs = SEGMENTS;
    this.impls = new Map(segmentImpls.map((s) => [s.id, s]));
    this.isActive = false;
    this._activeIndex = -1;
    this._entering = false;
    this._gateTime = 0;
    this._isTransitioning = false;
    this._recomputeBounds();
  }

  _recomputeBounds() {
    const total = this.defs.reduce((a, s) => a + s.scrollVh, 0);
    this.total = total;
    this.bounds = [];
    let acc = 0;
    for (const s of this.defs) {
      this.bounds.push({
        id: s.id,
        start: acc / total,
        end: (acc + s.scrollVh) / total,
        def: s,
      });
      acc += s.scrollVh;
    }
  }

  get activeDef() {
    return this.defs[this._activeIndex] || null;
  }
  get activeImpl() {
    return this.activeDef ? this.impls.get(this.activeDef.id) : null;
  }

  start() {
    this.isActive = true;
    this._activate(0);
  }

  _indexForProgress(p) {
    for (let i = 0; i < this.bounds.length; i++) {
      const b = this.bounds[i];
      if (p >= b.start && p < b.end) return i;
    }
    return this.bounds.length - 1;
  }

  _activate(i) {
    if (i === this._activeIndex) return;
    const prev = this.activeImpl;
    if (prev && prev.teardown) prev.teardown(this.ctx);

    this._activeIndex = i;
    const def = this.defs[i];
    const impl = this.impls.get(def.id);
    this._gateTime = 0;

    // Swap the audio bed for this segment.
    const beds = AUDIO_BEDS[def.id] || [];
    const wanted = new Set(beds.map((b) => b.name));
    for (const k of [...this.ctx.audio.playing.keys()]) {
      if (!wanted.has(k)) this.ctx.audio.stop(k);
    }
    for (const b of beds) this.ctx.audio.play(b.name, { volume: b.volume });

    this._entering = true;
    try {
      if (impl && impl.enter) impl.enter(this.ctx);
    } finally {
      this._entering = false;
    }

    // Gates hold the scroll while they play themselves.
    if (def.autoScroll) {
      this.ctx.scrollManager.setHeld(true);
      this._gateDuration = def.duration || 3;
    } else {
      this.ctx.scrollManager.setHeld(false);
    }

    this.ctx.ui.ruler.setActive(def.id);
    this.ctx.onSegmentChange && this.ctx.onSegmentChange(def);
  }

  /** Called every frame with the global 0..1 scroll progress. */
  update(globalProgress, time, dt) {
    if (!this.isActive || this._isTransitioning) return;
    this.ctx.time = time;

    const def = this.activeDef;
    const impl = this.activeImpl;
    if (!def) return;

    if (def.autoScroll) {
      // Gate: advance on the clock, then push the scroll past its bounds.
      this._gateTime += dt;
      const t = Math.min(1, this._gateTime / this._gateDuration);
      if (impl && impl.scrub) impl.scrub(this.ctx, t);
      if (impl && impl.update) impl.update(this.ctx, time, dt);
      if (t >= 1) {
        const b = this.bounds[this._activeIndex];
        const sm = this.ctx.scrollManager;
        sm.setHeld(false);
        const target = (b.end + 0.0005) * sm.max;
        sm.scrollPos = sm.targetScrollPos = target;
        this._activate(Math.min(this._activeIndex + 1, this.defs.length - 1));
      }
      return;
    }

    // Interactive stage.
    const idx = this._indexForProgress(globalProgress);
    if (idx !== this._activeIndex) {
      this._activate(idx);
      return;
    }

    const b = this.bounds[this._activeIndex];
    const local = Math.max(
      0,
      Math.min(1, (globalProgress - b.start) / (b.end - b.start)),
    );
    this.ctx.stageProgress = local;
    if (impl && impl.scrub) impl.scrub(this.ctx, local);
    if (impl && impl.update) impl.update(this.ctx, time, dt);
  }

  /**
   * Ruler navigation. Replays every earlier segment headlessly so the scene
   * ends up in exactly the state it would have been in had you scrolled.
   */
  async skipTo(id) {
    const target = this.defs.findIndex((s) => s.id === id);
    if (target < 0 || this._isTransitioning) return;
    this._isTransitioning = true;
    this.ctx.ui.ruler.setLoading(id, true);

    const overlay = document.createElement("div");
    overlay.className = "stage-nav-overlay";
    overlay.innerHTML =
      '<div class="stage-nav-overlay-loader">' +
      '<span class="stage-nav-overlay-spinner" aria-hidden="true"></span>' +
      '<div class="stage-nav-overlay-logo" aria-hidden="true">' +
      '<img src="assets/ui/app_icon.jpg" alt=""></div></div>';
    document.body.appendChild(overlay);
    void overlay.offsetHeight;
    overlay.style.opacity = "1";
    await new Promise((r) => setTimeout(r, 620));

    const audioWas = this.ctx.audio.enabled;
    this.ctx.audio.setEnabled(false);

    // Tear the current segment down, then fast-forward through every
    // preceding one so cumulative state (XP, camera, materials) is correct.
    const cur = this.activeImpl;
    if (cur && cur.teardown) cur.teardown(this.ctx);
    this._activeIndex = -1;

    for (let i = 0; i < target; i++) {
      const d = this.defs[i];
      const im = this.impls.get(d.id);
      if (!im) continue;
      if (im.enter) im.enter(this.ctx);
      if (im.scrub) im.scrub(this.ctx, 1);
      if (im.update) im.update(this.ctx, this.ctx.time || 0, 0.016);
      if (im.teardown) im.teardown(this.ctx);
    }

    this._activeIndex = -1;
    this._activate(target);

    const b = this.bounds[target];
    const sm = this.ctx.scrollManager;
    sm.jumpTo(b.start * sm.max + 1);

    this.ctx.audio.setEnabled(audioWas);
    const beds = AUDIO_BEDS[id] || [];
    for (const bd of beds) this.ctx.audio.play(bd.name, { volume: bd.volume });

    overlay.style.opacity = "0";
    await new Promise((r) => setTimeout(r, 620));
    overlay.remove();

    this.ctx.ui.ruler.setLoading(id, false);
    this._isTransitioning = false;
  }

  dispose() {
    const impl = this.activeImpl;
    if (impl && impl.teardown) impl.teardown(this.ctx);
    this.isActive = false;
  }
}
