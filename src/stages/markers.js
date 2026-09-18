import * as THREE from "three";

/**
 * Stage 5 map pins.
 *
 * Each marker is a small additive sprite parented to the globe, plus a DOM
 * card that is positioned by projecting the marker's world position to screen
 * space every frame. Markers on the far side of the globe fade out and stop
 * receiving hits.
 */

const HALO_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uOpacity;
  uniform float uPulse;
  void main(){
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    float core = smoothstep(0.26, 0.20, d);
    float halo = smoothstep(0.62, 0.30, d) * 0.35 * (0.6 + 0.4 * uPulse);
    float a = (core + halo) * uOpacity;
    if(a < 0.01) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, a);
  }
`;

const HALO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Convert the config's normalised x/y into a point on the sphere. */
function latLonToVec3(x, y, radius) {
  const lon = x * Math.PI * 2;
  const lat = y * Math.PI;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

export function createMarkerLayer(ctx, globe, data) {
  const radius = 2.6;
  const group = new THREE.Group();
  globe.group.add(group);

  const geo = new THREE.PlaneGeometry(0.42, 0.42);
  const entries = [];

  // One shared DOM card, re-populated on hover — cheaper than four nodes.
  const card = document.createElement("div");
  card.className = "marker-card";
  document.body.appendChild(card);

  let activeId = null;

  const showCard = (d, sx, sy) => {
    if (activeId !== d.id) {
      activeId = d.id;
      card.innerHTML =
        `<div class="marker-card-head">` +
        `<img class="marker-card-logo" src="assets/ui/card_${d.logo}.webp" alt="">` +
        `<div><div class="marker-card-org">${d.org}</div>` +
        `<div class="marker-card-role">${d.role}</div></div></div>` +
        `<div class="marker-card-scenario">${d.scenario}</div>` +
        `<div class="marker-card-desc">${d.description}</div>` +
        `<div class="marker-card-tools">` +
        d.tools.map((t) => `<span class="marker-chip">${t}</span>`).join("") +
        `</div>`;
      ctx.audio && ctx.audio.play("click", { volume: 0.35, fadeIn: 0.01 });
      if (!ctx._markerXP) {
        ctx._markerXP = new Set();
      }
      if (!ctx._markerXP.has(d.id)) {
        ctx._markerXP.add(d.id);
        ctx.ui.addXP(25);
      }
    }
    const w = 300,
      pad = 16;
    card.style.left = `${Math.min(window.innerWidth - w - pad, Math.max(pad, sx + 18))}px`;
    card.style.top = `${Math.min(window.innerHeight - 220, Math.max(pad, sy - 40))}px`;
    card.classList.add("is-open");
  };

  const hideCard = () => {
    activeId = null;
    card.classList.remove("is-open");
  };

  for (const d of data) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 1 }, uPulse: { value: 0 } },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(latLonToVec3(d.x, d.y, radius * 1.02));
    group.add(mesh);
    entries.push({
      data: d,
      mesh,
      mat,
      world: new THREE.Vector3(),
      screen: { x: 0, y: 0 },
      facing: 1,
    });
  }

  const onMove = (e) => {
    let best = null,
      bestDist = 60;
    for (const en of entries) {
      if (en.facing < 0.1) continue;
      const dx = e.clientX - en.screen.x,
        dy = e.clientY - en.screen.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = en;
      }
    }
    if (best) {
      showCard(best.data, best.screen.x, best.screen.y);
      ctx.renderer.domElement.style.cursor = "pointer";
    } else if (!card.matches(":hover")) {
      hideCard();
      ctx.renderer.domElement.style.cursor = "";
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const camDir = new THREE.Vector3();

  return {
    group,
    update() {
      const cam = ctx.camera;
      cam.getWorldDirection(camDir);
      for (const en of entries) {
        en.mesh.getWorldPosition(en.world);
        en.mesh.quaternion.copy(cam.quaternion); // billboard

        // Facing test: dot of surface normal against the view direction.
        const n = en.world.clone().sub(globe.group.position).normalize();
        const toCam = cam.position.clone().sub(en.world).normalize();
        const f = THREE.MathUtils.clamp(n.dot(toCam) * 2.2, 0, 1);
        en.facing = f;
        en.mat.uniforms.uOpacity.value = f;
        en.mat.uniforms.uPulse.value =
          0.5 + 0.5 * Math.sin(ctx.time * 2 + en.data.x * 9);

        const p = en.world.clone().project(cam);
        en.screen.x = (p.x * 0.5 + 0.5) * window.innerWidth;
        en.screen.y = (-p.y * 0.5 + 0.5) * window.innerHeight;
      }
      if (activeId) {
        const en = entries.find((e) => e.data.id === activeId);
        if (en && en.facing < 0.1) hideCard();
      }
    },
    dispose() {
      window.removeEventListener("pointermove", onMove);
      card.remove();
      entries.forEach((e) => {
        group.remove(e.mesh);
        e.mat.dispose();
      });
      geo.dispose();
      globe.group.remove(group);
    },
  };
}

/* ================================================= stage-5 pad controls === */
export function createStage5Controls(container, { audio } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "s5-controls";

  /* joystick */
  const joy = document.createElement("div");
  joy.className = "s5-joystick";
  const knob = document.createElement("div");
  knob.className = "s5-joystick-knob";
  joy.appendChild(knob);

  /* d-pad */
  const pad = document.createElement("div");
  pad.className = "s5-pad";
  const ICONS = {
    up: "M12 6l5 6H7z",
    down: "M12 18l-5-6h10z",
    left: "M6 12l6-5v10z",
    right: "M18 12l-6 5V7z",
  };
  const LABELS = {
    up: "Zoom in",
    down: "Zoom out",
    left: "Previous",
    right: "Next",
  };
  const padButtons = {};
  for (const dir of ["up", "down", "left", "right"]) {
    const b = document.createElement("button");
    b.className = "s5-pad-btn";
    b.type = "button";
    b.dataset.pad = dir;
    b.setAttribute("aria-label", LABELS[dir]);
    b.innerHTML =
      `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="${ICONS[dir]}" fill="currentColor"/></svg>`;
    pad.appendChild(b);
    padButtons[dir] = b;
  }

  wrap.append(joy, pad);
  container.appendChild(wrap);

  const state = { x: 0, y: 0, zoom: 0 };
  const MAX = 30;
  let dragging = false;

  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.x = dx / MAX;
    state.y = dy / MAX;
  };

  joy.addEventListener("pointerdown", (e) => {
    dragging = true;
    joy.classList.add("is-active");
    joy.setPointerCapture(e.pointerId);
    audio && audio.play("click", { volume: 0.3, fadeIn: 0.01 });
  });
  joy.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > MAX) {
      dx = (dx / d) * MAX;
      dy = (dy / d) * MAX;
    }
    setKnob(dx, dy);
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    joy.classList.remove("is-active");
    knob.style.transition = "transform .35s cubic-bezier(.34,1.56,.64,1)";
    setKnob(0, 0);
    setTimeout(() => {
      knob.style.transition = "";
    }, 360);
  };
  joy.addEventListener("pointerup", release);
  joy.addEventListener("pointercancel", release);

  const held = new Set();
  const applyPad = () => {
    state.zoom = (held.has("up") ? 1 : 0) - (held.has("down") ? 1 : 0);
    const lr = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    if (!dragging) state.x = lr * 0.8;
  };
  for (const [dir, b] of Object.entries(padButtons)) {
    const down = () => {
      held.add(dir);
      b.classList.add("is-pressed");
      applyPad();
      audio && audio.play("click", { volume: 0.3, fadeIn: 0.01 });
    };
    const up = () => {
      held.delete(dir);
      b.classList.remove("is-pressed");
      applyPad();
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointerleave", up);
    b.addEventListener("pointercancel", up);
  }

  const KEYMAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const onKeyDown = (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const dir = KEYMAP[e.key];
    if (!dir) return;
    e.preventDefault();
    held.add(dir);
    padButtons[dir].classList.add("is-pressed");
    applyPad();
  };
  const onKeyUp = (e) => {
    const dir = KEYMAP[e.key];
    if (!dir) return;
    held.delete(dir);
    padButtons[dir].classList.remove("is-pressed");
    applyPad();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    held.clear();
    applyPad();
  });

  return {
    el: wrap,
    state,
    show() {
      wrap.style.opacity = "1";
    },
    hide() {
      wrap.style.opacity = "0";
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}
