import gsap from "gsap";
import { BRAND, RULER_STAGES } from "../core/config.js";

/**
 * Every persistent piece of interface: the XP pill, audio toggle, menu,
 * status line, scroll indicator, the hold-to-continue button, the ruler and
 * the mobile timeline.
 *
 * The HUD is a pointer-events:none layer; individual controls opt back in.
 * `setPageTheme('black'|'white')` flips the whole chrome between the dark and
 * light treatments via a single body class.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/* Builds the seven-layer specular "liquid glass" overlay used on each pill. */
const GLASS_LAYERS = [
  "fill",
  "fill-burn",
  "highlight-soft",
  "highlight-strong",
  "edge-light",
  "edge-dark",
  "inner-glow",
];

export function addGlass(el) {
  if (!el || el.querySelector(":scope > .glass-effect")) return;
  const g = document.createElement("div");
  g.className = "glass-effect";
  g.setAttribute("aria-hidden", "true");
  for (const k of GLASS_LAYERS) {
    const d = document.createElement("div");
    d.className = `glass-effect__${k}`;
    g.appendChild(d);
  }
  el.prepend(g);
  el.classList.add("has-glass");
}

/** Animated waveform for the audio button. */
function audioIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "hud-audio-icon");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "13");
  svg.setAttribute("viewBox", "0 0 20 12");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "hud-audio-wave-wrap");
  const poly = document.createElementNS(SVG_NS, "polyline");
  poly.setAttribute("class", "hud-audio-wave");
  poly.setAttribute("vector-effect", "non-scaling-stroke");

  const N = 11,
    X0 = 1.6,
    DX = 1.68;
  const flat = Array.from(
    { length: N },
    (_, i) => `${(X0 + i * DX).toFixed(2)},6.00`,
  ).join(" ");
  poly.setAttribute("points", flat);

  // 13 keyframes of a travelling sine — the reference animates `points`.
  const frames = [];
  for (let f = 0; f < 13; f++) {
    const ph = (f / 12) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const y = 6 + Math.sin(ph + i * 0.55) * 3;
      pts.push(`${(X0 + i * DX).toFixed(2)},${y.toFixed(2)}`);
    }
    frames.push(pts.join(" "));
  }
  const anim = document.createElementNS(SVG_NS, "animate");
  anim.setAttribute("attributeName", "points");
  anim.setAttribute("dur", "1.2s");
  anim.setAttribute("begin", "indefinite");
  anim.setAttribute("repeatCount", "indefinite");
  anim.setAttribute("calcMode", "linear");
  anim.setAttribute("values", frames.join("; "));
  poly.appendChild(anim);
  g.appendChild(poly);
  svg.appendChild(g);
  return { svg, anim };
}

function menuIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "hud-menu-icon");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 18 12");
  svg.setAttribute("aria-hidden", "true");
  for (const y of [1, 6, 11]) {
    const l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("x1", "1");
    l.setAttribute("x2", "17");
    l.setAttribute("y1", String(y));
    l.setAttribute("y2", String(y));
    l.setAttribute("stroke", "currentColor");
    l.setAttribute("stroke-width", "1.5");
    l.setAttribute("stroke-linecap", "round");
    svg.appendChild(l);
  }
  return svg;
}

/* ========================================================== scroll ruler == */
const TICK_SPACING = 12,
  MINOR_EVERY_VH = 10;

class ScrollRuler {
  constructor(segments, onNavigate) {
    this.onNavigate = onNavigate;
    const total = segments.reduce((a, s) => a + s.scrollVh, 0);

    // Build tick list: a major tick at each labelled stage + minors between.
    const ticks = [];
    let acc = 0,
      started = false;
    for (const seg of segments) {
      if (seg.ruler) started = true;
      if (started) {
        ticks.push(
          seg.ruler
            ? { type: "major", label: seg.ruler, progress: acc / total }
            : { type: "minor", progress: acc / total },
        );
        const n = Math.max(Math.round(seg.scrollVh / MINOR_EVERY_VH) - 1, 0);
        for (let i = 1; i <= n; i++) {
          ticks.push({
            type: "minor",
            progress: (acc + (seg.scrollVh * i) / (n + 1)) / total,
          });
        }
      }
      acc += seg.scrollVh;
    }

    this._span = (ticks.length - 1) * TICK_SPACING;
    this.el = document.createElement("div");
    this.el.className = "scroll-ruler";

    this._track = document.createElement("div");
    this._track.className = "scroll-ruler-track";
    this._track.setAttribute("aria-hidden", "true");
    this._track.style.width = `${this._span + TICK_SPACING}px`;

    this._minor = [];
    this._major = [];
    for (const t of ticks) {
      const d = document.createElement("div");
      d.className = `ruler-tick ${t.type}`;
      d.style.left = `${t.progress * this._span - TICK_SPACING / 2}px`;
      const line = document.createElement("span");
      line.className = "ruler-line";
      d.appendChild(line);
      if (t.type === "major" && t.label) {
        const lab = document.createElement("span");
        lab.className = "ruler-label";
        lab.textContent = t.label;
        d.appendChild(lab);
        this._major.push({ line, label: lab, progress: t.progress });
      } else {
        this._minor.push({ line, progress: t.progress });
      }
      this._track.appendChild(d);
    }
    this.el.appendChild(this._track);

    this._indicator = document.createElement("div");
    this._indicator.className = "scroll-ruler-indicator";
    this._indicator.setAttribute("aria-hidden", "true");
    this.el.appendChild(this._indicator);

    // Hover reveals a stage-jump nav in place of the ticks.
    this._nav = document.createElement("div");
    this._nav.className = "scroll-ruler-nav";
    this.buttons = new Map();
    for (const { id, label } of RULER_STAGES) {
      const b = document.createElement("button");
      b.className = "scroll-ruler-nav-btn";
      b.type = "button";
      b.dataset.segment = id;
      b.setAttribute("aria-label", `Go to ${label}`);
      const l = document.createElement("span");
      l.className = "scroll-ruler-nav-label";
      l.textContent = label;
      const ln = document.createElement("span");
      ln.className = "scroll-ruler-nav-line";
      const sp = document.createElement("span");
      sp.className = "scroll-ruler-nav-spinner";
      sp.setAttribute("aria-hidden", "true");
      b.append(l, ln, sp);
      b.addEventListener(
        "click",
        () => this.onNavigate && this.onNavigate(id, b),
      );
      this._nav.appendChild(b);
      this.buttons.set(id, b);
    }
    this.el.appendChild(this._nav);

    this.el.addEventListener("pointerenter", () =>
      this.el.classList.add("is-hover-nav"),
    );
    this.el.addEventListener("pointerleave", () =>
      this.el.classList.remove("is-hover-nav"),
    );
  }

  /** Scrub: slide the track so the current position sits under the indicator. */
  update(progress) {
    const half = this.el.clientWidth / 2 || 150;
    this._track.style.transform = `translateX(${half - progress * this._span}px)`;
    // Ticks near the indicator grow — a subtle magnifier effect.
    const radius = 0.045;
    for (const t of this._minor) {
      const d = Math.abs(t.progress - progress);
      const k = Math.max(0, 1 - d / radius);
      t.line.style.transform = `scaleY(${1 + k * 0.85})`;
    }
  }

  setActive(id) {
    for (const [k, b] of this.buttons)
      b.classList.toggle("is-active", k === id);
  }
  setLoading(id, on) {
    const b = this.buttons.get(id);
    if (b) b.classList.toggle("is-loading", on);
  }
  dispose() {
    this.el.remove();
  }
}

/* ======================================================= mobile timeline == */
class MobileTimeline {
  constructor(segments, onNavigate) {
    this.stages = segments.filter((s) => s.ruler);
    this.el = document.createElement("div");
    this.el.className = "mobile-timeline";

    this._bars = document.createElement("div");
    this._bars.className = "mtl-bars";
    this.fills = this.stages.map(() => {
      const bar = document.createElement("div");
      bar.className = "mtl-bar";
      const fill = document.createElement("span");
      fill.className = "mtl-fill";
      bar.appendChild(fill);
      this._bars.appendChild(bar);
      return fill;
    });

    this._count = document.createElement("span");
    this._count.className = "mtl-count";
    this._count.textContent = this.stages[0]?.ruler || "";

    this.el.append(this._bars, this._count);
    this.el.addEventListener("click", () => onNavigate && onNavigate());
  }
  update(globalProgress, activeIndex, stageProgress, label) {
    this.fills.forEach((f, i) => {
      const v = i < activeIndex ? 1 : i === activeIndex ? stageProgress : 0;
      f.style.transform = `scaleX(${v})`;
    });
    if (label) this._count.textContent = label;
  }
  dispose() {
    this.el.remove();
  }
}

/* ================================================================ HUD ===== */
export default class GlobalUI {
  constructor(container, { audio, segments, onNavigate, onCta } = {}) {
    this.container = container;
    this.audio = audio;
    this.onCta = onCta;
    this.xp = 0;
    this._pins = new Map();

    /* ---- loader stub (bottom-left wordmark once counting finishes) ---- */
    this.loaderContainer = document.createElement("div");
    this.loaderContainer.className = "loader-container";
    this.loaderContainer.setAttribute("role", "progressbar");
    this.loaderContainer.setAttribute("aria-valuemin", "0");
    this.loaderContainer.setAttribute("aria-valuemax", "99");
    this.loaderContainer.setAttribute("aria-valuenow", "0");
    this.loaderContainer.setAttribute("aria-label", "Loading progress");
    const lt = document.createElement("div");
    lt.className = "loader-text";
    const logo = document.createElement("img");
    logo.src = "assets/brand/logo_white.svg";
    logo.alt = BRAND.name;
    logo.className = "loader-logo";
    lt.appendChild(logo);
    this.loaderContainer.appendChild(lt);
    container.appendChild(this.loaderContainer);

    /* ---- left group: audio toggle ---- */
    this.leftGroup = document.createElement("div");
    this.leftGroup.className = "hud-left-group";
    this.audioBtn = document.createElement("button");
    this.audioBtn.className = "hud-audio-btn";
    this.audioBtn.setAttribute("aria-label", "Toggle audio");
    this.audioBtn.setAttribute("aria-pressed", "true");
    const { svg, anim } = audioIcon();
    this._waveAnim = anim;
    this.audioBtn.appendChild(svg);
    this.audioBtn.addEventListener("click", () => this.toggleAudio());
    this.leftGroup.appendChild(this.audioBtn);
    container.appendChild(this.leftGroup);

    /* ---- right group: XP + CTA + menu ---- */
    this.rightGroup = document.createElement("div");
    this.rightGroup.className = "hud-right-group";

    this.xpEl = document.createElement("div");
    this.xpEl.className = "hud-xp";
    const xpIcon = document.createElement("img");
    xpIcon.src = "assets/ui/xp.webp";
    xpIcon.className = "hud-xp-icon";
    xpIcon.alt = "XP";
    this.xpValue = document.createElement("span");
    this.xpValue.className = "hud-xp-value";
    this.xpValue.textContent = "0";
    const xpLabel = document.createElement("span");
    xpLabel.className = "hud-xp-label";
    xpLabel.textContent = "XP";
    this.xpEl.append(xpIcon, this.xpValue, xpLabel);

    this.ctaBtn = document.createElement("button");
    this.ctaBtn.className = "hud-cta-btn";
    this.ctaBtn.textContent = "Get the template";
    this.ctaBtn.addEventListener("click", () => this.onCta && this.onCta());

    this.menuWrap = document.createElement("div");
    this.menuWrap.className = "hud-menu";
    this.menuBtn = document.createElement("button");
    this.menuBtn.className = "hud-menu-btn";
    this.menuBtn.setAttribute("aria-label", "Menu");
    this.menuBtn.setAttribute("aria-haspopup", "menu");
    this.menuBtn.setAttribute("aria-expanded", "false");
    this.menuBtn.appendChild(menuIcon());
    this.menuDropdown = document.createElement("div");
    this.menuDropdown.className = "hud-menu-dropdown";
    this.menuDropdown.setAttribute("role", "menu");
    for (const item of BRAND.menu) {
      const a = document.createElement("a");
      a.className = "hud-menu-item";
      a.setAttribute("role", "menuitem");
      a.textContent = item.label;
      a.href = item.href;
      this.menuDropdown.appendChild(a);
    }
    this.menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });
    document.addEventListener("click", () => this.closeMenu());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeMenu();
    });
    this.menuWrap.append(this.menuBtn, this.menuDropdown);

    this.rightGroup.append(this.xpEl, this.ctaBtn, this.menuWrap);
    container.appendChild(this.rightGroup);

    /* ---- status line ---- */
    this.status = document.createElement("div");
    this.status.className = "hud-status";
    this.status.setAttribute("aria-live", "polite");
    this.statusLabel = document.createElement("span");
    this.statusLabel.className = "hud-status-label";
    const chev = document.createElement("span");
    chev.className = "hud-status-chevron";
    chev.innerHTML =
      '<svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">' +
      '<path d="M1 1L7 7L13 1" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    this.status.append(this.statusLabel, chev);
    container.appendChild(this.status);

    /* ---- scroll indicator ---- */
    this.scrollIndicator = document.createElement("div");
    this.scrollIndicator.className = "scroll-indicator";
    this.scrollIndicator.setAttribute("aria-hidden", "true");
    const dot = document.createElement("span");
    dot.className = "scroll-indicator-dot";
    const sl = document.createElement("span");
    sl.className = "scroll-indicator-label";
    sl.textContent = "SCROLL";
    this.scrollIndicator.append(dot, sl);
    container.appendChild(this.scrollIndicator);

    /* ---- hold-to-continue ---- */
    this.nextTrigger = document.createElement("div");
    this.nextTrigger.className = "next-stage-trigger";
    this.nextTrigger.innerHTML =
      '<div class="next-stage-btn-stroke"></div>' +
      '<svg class="next-stage-btn-progress" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="46"></circle></svg>' +
      '<button class="next-stage-btn" aria-label="Continue to next stage">' +
      '<span class="next-stage-hit" aria-hidden="true"></span></button>' +
      '<div class="next-stage-label"></div>';
    container.appendChild(this.nextTrigger);
    this._initHoldButton();

    /* ---- ruler + mobile timeline ---- */
    this.ruler = new ScrollRuler(segments, onNavigate);
    this.ruler.el.style.opacity = "0";
    container.appendChild(this.ruler.el);

    this.mobileTimeline = new MobileTimeline(segments, () => {});
    this.rightGroup.prepend(this.mobileTimeline.el);
    this.mobileTimeline.el.style.display = "none";

    /* ---- circle-draw hint (loader interaction) ---- */
    this.circleHint = document.createElement("div");
    this.circleHint.className = "loader-circle-hint";
    this.circleHint.innerHTML =
      '<div class="loader-circle-stage">' +
      '<div class="loader-circle-ring"></div>' +
      '<div class="loader-circle-handle"></div></div>';
    container.appendChild(this.circleHint);
    this.circleRing = this.circleHint.querySelector(".loader-circle-ring");
    this.circleHandle = this.circleHint.querySelector(".loader-circle-handle");

    // Apply the glass overlay to everything that needs it, now and later.
    this._observeGlass();
  }

  _observeGlass() {
    const sel = [
      ".hud-xp",
      ".hud-audio-btn",
      ".hud-cta-btn",
      ".hud-menu-btn",
      ".hud-menu-dropdown",
      ".scroll-indicator",
      ".eg-track",
    ].join(",");
    const apply = (n) => {
      if (!n || n.nodeType !== 1) return;
      if (n.matches && n.matches(sel)) addGlass(n);
      if (n.querySelectorAll) n.querySelectorAll(sel).forEach(addGlass);
    };
    apply(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) apply(n);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* --------------------------------------------------------- hold btn --- */
  _initHoldButton() {
    const btn = this.nextTrigger.querySelector(".next-stage-btn");
    const hit = this.nextTrigger.querySelector(".next-stage-hit");
    const circle = this.nextTrigger.querySelector(
      ".next-stage-btn-progress circle",
    );
    const R = 46,
      C = 2 * Math.PI * R;
    circle.style.strokeDasharray = C.toFixed(3);
    circle.style.strokeDashoffset = C.toFixed(3);

    this._hold = {
      active: false,
      t: 0,
      circle,
      C,
      duration: 1.4,
      onComplete: null,
    };

    const start = (e) => {
      e.preventDefault();
      if (this._hold.active) return;
      this._hold.active = true;
      this._hold.t = 0;
      this.audio && this.audio.play("hold", { volume: 0.5, fadeIn: 0.05 });
    };
    const end = () => {
      if (!this._hold.active) return;
      this._hold.active = false;
      this._hold.t = 0;
      circle.style.strokeDashoffset = C.toFixed(3);
    };
    for (const el of [btn, hit]) {
      el.addEventListener("pointerdown", start);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("pointerleave", end);
    }
  }

  updateHold(dt) {
    const h = this._hold;
    if (!h || !h.active) return;
    h.t += dt;
    const p = Math.min(1, h.t / h.duration);
    h.circle.style.strokeDashoffset = (h.C * (1 - p)).toFixed(3);
    if (p >= 1) {
      h.active = false;
      h.t = 0;
      h.circle.style.strokeDashoffset = h.C.toFixed(3);
      this.audio && this.audio.play("chime", { volume: 0.5, fadeIn: 0.01 });
      h.onComplete && h.onComplete();
    }
  }

  showHoldButton(label, onComplete) {
    this._hold.onComplete = onComplete;
    this.nextTrigger.style.display = "block";
    this.nextTrigger.querySelector(".next-stage-label").textContent =
      label || "";
    gsap.to(this.nextTrigger.querySelector(".next-stage-btn"), {
      opacity: 1,
      duration: 0.6,
      ease: "power2.out",
    });
  }

  hideHoldButton() {
    gsap.to(this.nextTrigger.querySelector(".next-stage-btn"), {
      opacity: 0,
      duration: 0.4,
      onComplete: () => {
        this.nextTrigger.style.display = "none";
      },
    });
  }

  /* ---------------------------------------------------------- reveals --- */
  revealChrome() {
    // The loader wordmark has done its job — the bottom track carries the
    // brand from here, so retire it rather than letting it sit over the art.
    gsap.to(this.loaderContainer, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        this.loaderContainer.style.display = "none";
      },
    });
    this.leftGroup.style.display = "flex";
    this.rightGroup.style.display = "flex";
    const items = [this.leftGroup, this.rightGroup];
    gsap.fromTo(
      items,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power2.out" },
    );
    gsap.to(this.ruler.el, { opacity: 1, duration: 0.7, delay: 0.2 });
    if (window.innerWidth <= 768) {
      this.mobileTimeline.el.style.display = "inline-flex";
      this.ctaBtn.style.display = "none";
    }
  }

  setPageTheme(theme) {
    document.body.classList.toggle("nav-black", theme === "black");
  }

  setFrameOpen(open) {
    document.body.classList.toggle("frame-open", open);
  }

  /* ----------------------------------------------------------- status --- */
  pin(key, text, { chevron = false } = {}) {
    this._pins.set(key, { text, chevron });
    this._renderStatus();
  }
  unpin(key) {
    this._pins.delete(key);
    this._renderStatus();
  }

  setStatus(text, { chevron = false } = {}) {
    this._transient = text ? { text, chevron } : null;
    this._renderStatus();
  }

  _renderStatus() {
    const last = [...this._pins.values()].pop() || this._transient;
    if (!last) {
      gsap.to(this.status, { opacity: 0, duration: 0.35 });
      return;
    }
    this.statusLabel.textContent = last.text;
    this.status.classList.toggle("has-chevron", !!last.chevron);
    gsap.to(this.status, { opacity: 1, duration: 0.45 });
  }

  showScrollIndicator(show) {
    gsap.to(this.scrollIndicator, { opacity: show ? 1 : 0, duration: 0.5 });
  }

  /* --------------------------------------------------------------- XP --- */
  addXP(amount) {
    this.xp += amount;
    this.xpValue.textContent = String(this.xp);
    this.xpEl.classList.remove("xp-ripple");
    void this.xpEl.offsetWidth;
    this.xpEl.classList.add("xp-ripple");
    this.audio && this.audio.play("xp", { volume: 0.4, fadeIn: 0.01 });
    this.xpEl.addEventListener(
      "animationend",
      () => this.xpEl.classList.remove("xp-ripple"),
      { once: true },
    );
  }

  /* ------------------------------------------------------------ audio --- */
  toggleAudio() {
    const on = !this.audioBtn.classList.contains("is-playing");
    this.setAudioPlaying(on);
    this.audio && this.audio.setMuted(!on);
    this.audio && this.audio.play("click", { volume: 0.5, fadeIn: 0.01 });
  }
  setAudioPlaying(on) {
    this.audioBtn.classList.toggle("is-playing", on);
    this.audioBtn.setAttribute("aria-pressed", String(on));
    try {
      on ? this._waveAnim.beginElement() : this._waveAnim.endElement();
    } catch {}
  }

  /* ------------------------------------------------------------- menu --- */
  toggleMenu() {
    const open = !this.menuDropdown.classList.contains("is-open");
    this.menuDropdown.classList.toggle("is-open", open);
    this.menuBtn.setAttribute("aria-expanded", String(open));
  }
  closeMenu() {
    this.menuDropdown.classList.remove("is-open");
    this.menuBtn.setAttribute("aria-expanded", "false");
  }

  /* ------------------------------------------------------ circle hint --- */
  showCircleHint(show) {
    this.circleHint.classList.toggle("is-visible", show);
  }
  setCircleDemo(on) {
    this.circleHint.classList.toggle("is-demo", on);
  }
  setCircleDragging(on) {
    this.circleHint.classList.toggle("is-dragging", on);
  }
  setCircleAngle(deg) {
    if (this.circleRing) this.circleRing.style.transform = `rotate(${deg}deg)`;
    // Handle rides the ring's radius, so it traces the gesture path.
    if (this.circleHandle) {
      this.circleHandle.style.transform = `rotate(${deg}deg) translateX(20vh)`;
    }
  }

  updateLoader(p) {
    this.loaderContainer.setAttribute(
      "aria-valuenow",
      String(Math.round(p * 99)),
    );
  }

  dispose() {
    this.ruler.dispose();
    this.mobileTimeline.dispose();
  }
}
