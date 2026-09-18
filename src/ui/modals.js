import gsap from "gsap";
import { BRAND } from "../core/config.js";

/**
 * Two overlays: the sign-up sheet and the share card.
 *
 * Both dim + muffle the experience behind them (body.modal-open stops the
 * virtual scroll; AudioEngine.setMuffle lowpasses the bed) and animate in
 * with the same spring the reference uses.
 */

function backdrop() {
  const b = document.createElement("div");
  b.className = "modal-backdrop";
  document.body.appendChild(b);
  return b;
}

function openAnim(bd, panel) {
  document.body.classList.add("modal-open");
  gsap.to(bd, { opacity: 1, duration: 0.3, ease: "power2.out" });
  gsap.to(panel, {
    opacity: 1,
    y: 0,
    duration: 0.55,
    ease: "power3.out",
    delay: 0.05,
  });
}

function closeAnim(bd, panel, done) {
  gsap.to(panel, { opacity: 0, y: 18, duration: 0.3, ease: "power2.in" });
  gsap.to(bd, {
    opacity: 0,
    duration: 0.3,
    delay: 0.05,
    onComplete: () => {
      document.body.classList.remove("modal-open");
      bd.remove();
      done && done();
    },
  });
}

/* ============================================================= sign-up ==== */
const FIELDS = [
  {
    name: "name",
    label: "your name",
    type: "text",
    autocomplete: "name",
    error: "Please enter your name.",
  },
  {
    name: "email",
    label: "your email",
    type: "email",
    autocomplete: "email",
    error: "Please enter a valid email.",
  },
  {
    name: "role",
    label: "what you build",
    type: "text",
    autocomplete: "organization-title",
    error: "Please tell us what you build.",
  },
  {
    name: "notes",
    label: "anything else we should know?",
    type: "text",
    optional: true,
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function openSignupForm({ audio, onClose, onSubmit } = {}) {
  const bd = backdrop();
  const panel = document.createElement("div");
  panel.className = "jf-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `Join the ${BRAND.name} list`);

  const left = document.createElement("div");
  left.className = "jf-left";
  left.innerHTML =
    `<img class="jf-logo" src="assets/brand/logo.svg" alt="${BRAND.name}">` +
    `<div><h2 class="jf-title">Start from zero,<br>ship something real.</h2>` +
    `<p class="jf-sub">Drop your details and we will send the template, the build notes and every asset source file.</p></div>`;

  const right = document.createElement("div");
  right.className = "jf-right";

  const inputs = {};
  for (const f of FIELDS) {
    const wrap = document.createElement("div");
    wrap.className = "jf-field";
    const input = document.createElement("input");
    input.className = "jf-input";
    input.type = f.type;
    input.name = f.name;
    input.placeholder = f.label;
    if (f.autocomplete) input.autocomplete = f.autocomplete;
    const ul = document.createElement("div");
    ul.className = "jf-underline";
    wrap.append(input, ul);
    right.appendChild(wrap);
    inputs[f.name] = { input, underline: ul, meta: f };
    input.addEventListener("input", () => ul.classList.remove("is-invalid"));
  }

  const status = document.createElement("div");
  status.className = "jf-status";
  const submit = document.createElement("button");
  submit.className = "jf-submit-btn";
  submit.type = "button";
  submit.textContent = "Send it to me";
  right.append(status, submit);

  const close = document.createElement("button");
  close.className = "jf-close";
  close.setAttribute("aria-label", "Close");
  close.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' +
    '<path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  panel.append(left, right, close);
  bd.appendChild(panel);
  openAnim(bd, panel);
  audio && audio.setMuffle(1);
  window.dispatchEvent(new CustomEvent("nova:modalOpen"));

  const dismiss = () => {
    audio && audio.setMuffle(0);
    window.dispatchEvent(new CustomEvent("nova:modalClose"));
    closeAnim(bd, panel, onClose);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") dismiss();
  };
  document.addEventListener("keydown", onKey);
  close.addEventListener("click", dismiss);
  bd.addEventListener("click", (e) => {
    if (e.target === bd) dismiss();
  });

  submit.addEventListener("click", () => {
    for (const f of FIELDS) {
      if (f.optional) continue;
      const { input, underline } = inputs[f.name];
      const v = input.value.trim();
      const bad = !v || (f.type === "email" && !EMAIL_RE.test(v));
      if (bad) {
        underline.classList.remove("is-invalid");
        void underline.offsetWidth;
        underline.classList.add("is-invalid");
        status.textContent = f.error;
        input.focus();
        return;
      }
    }
    const data = Object.fromEntries(
      Object.entries(inputs).map(([k, v]) => [k, v.input.value.trim()]),
    );
    submit.classList.add("is-success");
    submit.textContent = "Done — check your inbox";
    status.textContent =
      "This demo does not send anything. Wire it to your own endpoint.";
    audio && audio.play("chime", { volume: 0.45, fadeIn: 0.01 });
    onSubmit && onSubmit(data);
    setTimeout(dismiss, 1800);
  });

  setTimeout(() => inputs.name.input.focus(), 400);
  return dismiss;
}

/* =============================================================== share ==== */
const NETWORKS = [
  {
    id: "x",
    label: "Share on X",
    icon: '<path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.3 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z" fill="currentColor"/>',
    url: (u, t) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    id: "li",
    label: "Share on LinkedIn",
    icon: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.5 4.7 5.8V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21h-4V9Z" fill="currentColor"/>',
    url: (u) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  },
  {
    id: "wa",
    label: "Share on WhatsApp",
    icon: '<path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.6 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.2c.1.2.1.4 0 .6l-.4.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.8-1c.2-.2.4-.2.6-.1l2.1 1c.3.1.5.2.5.4.1.1.1.7-.2 1.4Z" fill="currentColor"/>',
    url: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
  },
  {
    id: "copy",
    label: "Copy link",
    icon: '<path d="M9 9h10v10H9V9Zm-4 6V5h10v2H7v8H5Z" fill="currentColor"/>',
  },
];

export function openSharePanel({ audio, url = BRAND.url, onClose } = {}) {
  const bd = backdrop();
  const panel = document.createElement("div");
  panel.className = "sp-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Share");

  const poster = document.createElement("img");
  poster.className = "sp-poster";
  poster.src = "assets/ui/share_poster.webp";
  poster.alt = `${BRAND.name} share card`;

  const socials = document.createElement("div");
  socials.className = "sp-socials";

  const text = `built something with the ${BRAND.name} WebGL template —`;
  const canNativeShare = !!navigator.share;

  const toast = document.createElement("div");
  toast.className = "sp-toast";
  document.body.appendChild(toast);
  const say = (m) => {
    toast.textContent = m;
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 1600);
  };

  for (const n of NETWORKS) {
    const b = document.createElement("button");
    b.className = "sp-social-btn";
    b.type = "button";
    b.setAttribute("aria-label", n.label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${n.icon}</svg>`;
    b.addEventListener("click", async () => {
      audio && audio.play("click", { volume: 0.5, fadeIn: 0.01 });
      if (n.id === "copy") {
        try {
          await navigator.clipboard.writeText(url);
          say("Link copied");
        } catch {
          say("Could not copy the link.");
        }
        return;
      }
      if (canNativeShare && n.id === "x") {
        try {
          await navigator.share({ title: BRAND.name, text, url });
          return;
        } catch {}
      }
      window.open(n.url(url, text), "_blank", "noopener");
    });
    socials.appendChild(b);
  }

  panel.append(poster, socials);
  bd.appendChild(panel);
  openAnim(bd, panel);
  audio && audio.setMuffle(1);
  window.dispatchEvent(new CustomEvent("nova:modalOpen"));

  const dismiss = () => {
    audio && audio.setMuffle(0);
    window.dispatchEvent(new CustomEvent("nova:modalClose"));
    toast.remove();
    closeAnim(bd, panel, onClose);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") dismiss();
  };
  document.addEventListener("keydown", onKey);
  bd.addEventListener("click", (e) => {
    if (e.target === bd) dismiss();
  });
  return dismiss;
}

/* ======================================================== bottom track ==== */
/**
 * The expanding bottom bar: logo circle + CTA pill + burger that morphs the
 * whole track open into a small menu (the "Osmo nav" morph in the reference).
 */
export function createBottomTrack(container, { onCta, audio } = {}) {
  const track = document.createElement("div");
  track.className = "eg-track";

  const panel = document.createElement("div");
  panel.className = "eg-menu-panel";
  for (const item of BRAND.menu) {
    const a = document.createElement("a");
    a.className = "eg-menu-line";
    a.textContent = item.label;
    a.href = item.href;
    panel.appendChild(a);
  }

  const cluster = document.createElement("div");
  cluster.className = "eg-cluster";

  const circle = document.createElement("div");
  circle.className = "eg-circle";
  circle.innerHTML = `<img src="assets/brand/logo_white.svg" alt="${BRAND.name}">`;

  const pill = document.createElement("button");
  pill.className = "eg-pill";
  pill.type = "button";
  pill.textContent = "Get the template";
  pill.addEventListener("click", () => onCta && onCta());

  const burger = document.createElement("button");
  burger.className = "eg-menu";
  burger.type = "button";
  burger.setAttribute("aria-label", "Open menu");
  burger.setAttribute("aria-expanded", "false");
  burger.innerHTML =
    '<span class="eg-burger">' +
    '<span class="eg-burger-bar is--top"></span>' +
    '<span class="eg-burger-bar is--btm"></span></span>';

  cluster.append(circle, pill, burger);
  track.append(panel, cluster);
  container.appendChild(track);

  // Measure the closed and open sizes so the morph animates real pixels.
  let open = false;
  const closedH = () => cluster.offsetHeight + 20;
  const openH = () => cluster.offsetHeight + panel.scrollHeight + 36;

  track.style.height = `${closedH()}px`;

  burger.addEventListener("click", () => {
    open = !open;
    track.classList.toggle("eg-open", open);
    burger.setAttribute("aria-expanded", String(open));
    audio && audio.play("click", { volume: 0.5, fadeIn: 0.01 });
    gsap.to(track, {
      height: open ? openH() : closedH(),
      duration: 0.5,
      ease: open ? "power3.out" : "power3.inOut",
    });
  });

  return {
    el: track,
    show() {
      gsap.to(track, { opacity: 1, duration: 0.6, ease: "power2.out" });
    },
    hide() {
      gsap.to(track, { opacity: 0, duration: 0.4 });
    },
    destroy() {
      track.remove();
    },
  };
}
