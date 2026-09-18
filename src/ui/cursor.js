/**
 * Custom sprite cursor.
 *
 * One 3x2 atlas holds six states (arrow / pointer / grab / grabbed / text /
 * move). We hide the native cursor globally and move a single fixed <div>
 * whose background-position selects the cell. Touch devices keep the native
 * behaviour — the element is never created.
 */
const ATLAS = "assets/ui/cursors_atlas.webp";
const CELL = 56,
  COLS = 3,
  ROWS = 2;

const CELLS = {
  arrow: { col: 0, row: 0 },
  pointer: { col: 1, row: 0 },
  grab: { col: 2, row: 0 },
  grabbed: { col: 0, row: 1 },
  text: { col: 1, row: 1 },
  move: { col: 2, row: 1 },
};

const POINTER_SEL = [
  "button",
  "a",
  '[role="button"]',
  '[role="link"]',
  "label",
  'input[type="submit"]',
  'input[type="button"]',
  "select",
  ".hud-audio-btn",
  ".hud-cta-btn",
  ".next-stage-btn",
  ".eg-pill",
  ".eg-menu",
  ".s5-pad-btn",
  ".jf-submit-btn",
  ".jf-close",
  ".sp-social-btn",
  '[style*="cursor: pointer"]',
  '[style*="cursor:pointer"]',
].join(",");

const TEXT_SEL = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="number"]',
  'input[type="tel"]',
  'input[type="search"]',
  "textarea",
].join(",");

const ALIAS = {
  default: "arrow",
  arrow: "arrow",
  text: "text",
  pointer: "pointer",
  grab: "grab",
  grabbing: "grabbed",
  grabbed: "grabbed",
  move: "move",
};

let installed = false,
  el = null,
  state = "arrow",
  px = -9999,
  py = -9999;

function inlineCursor(node) {
  let t = node;
  while (t && t.nodeType === 1) {
    const c = t.style?.cursor || "";
    if (c) {
      if (c.includes("grabbing")) return "grabbing";
      if (c.includes("pointer")) return "pointer";
      if (c.includes("grab")) return "grab";
      if (c.includes("move")) return "move";
    }
    t = t.parentElement;
  }
  return null;
}

function resolve(node) {
  if (!node) return "arrow";
  try {
    const d = node.closest && node.closest("[data-cursor]");
    if (d) {
      const k = ALIAS[d.dataset.cursor];
      if (k) return k;
    }
  } catch {}
  const inline = inlineCursor(node);
  if (inline === "grabbing") return "grabbed";
  if (node.tagName === "CANVAS") {
    return inline === "pointer"
      ? "pointer"
      : inline === "grab"
        ? "grab"
        : inline === "move"
          ? "move"
          : "arrow";
  }
  try {
    if (node.closest && node.closest(TEXT_SEL)) return "text";
  } catch {}
  try {
    if (node.closest && node.closest(POINTER_SEL)) return "pointer";
  } catch {}
  return inline === "grab" ? "grab" : inline === "move" ? "move" : "arrow";
}

function setState(next) {
  if (next === state || !el) return;
  state = next;
  const c = CELLS[next] || CELLS.arrow;
  el.style.backgroundPosition = `${-c.col * CELL}px ${-c.row * CELL}px`;
}

function place() {
  if (!el) return;
  el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
}

function onMove(e) {
  px = e.clientX;
  py = e.clientY;
  setState(resolve(document.elementFromPoint(e.clientX, e.clientY)));
  place();
  if (el.style.opacity === "0") el.style.opacity = "1";
}

export function installCursor() {
  if (installed) return;
  const coarse = window.matchMedia
    ? window.matchMedia("(hover: none) and (pointer: coarse)").matches
    : "ontouchstart" in window;
  if (coarse) return;
  installed = true;

  new Image().src = ATLAS;

  el = document.createElement("div");
  el.dataset.customCursor = "1";
  el.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: ${CELL}px; height: ${CELL}px;
    pointer-events: none; z-index: 999999;
    background-image: url("${ATLAS}");
    background-size: ${COLS * CELL}px ${ROWS * CELL}px;
    background-position: 0 0; background-repeat: no-repeat;
    image-rendering: -webkit-optimize-contrast;
    transform: translate3d(-9999px, -9999px, 0);
    will-change: transform; opacity: 0; transition: opacity .15s ease;`;
  document.body.appendChild(el);

  const style = document.createElement("style");
  style.dataset.customCursors = "1";
  style.textContent = "*, *::before, *::after { cursor: none !important; }";
  document.head.appendChild(style);

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerdown", onMove, { passive: true });
  document.addEventListener("pointerup", onMove, { passive: true });
  document.addEventListener("pointerleave", () => {
    if (el) el.style.opacity = "0";
  });
  document.addEventListener(
    "touchstart",
    () => {
      if (el) el.style.display = "none";
    },
    { passive: true, once: true },
  );
}
