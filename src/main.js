import * as THREE from "three";
import gsap from "gsap";

import "./style.css";
import {
  SEGMENTS,
  STAGE_THEME,
  QUALITY,
  BRAND,
  totalScrollVh,
} from "./core/config.js";
import ScrollManager from "./core/ScrollManager.js";
import AudioEngine from "./core/AudioEngine.js";
import MasterTimeline from "./core/MasterTimeline.js";
import Composer, {
  BackgroundPass,
  ScenePass,
  ForegroundPass,
  FrostPass,
  LensBlurPass,
} from "./passes/Composer.js";
import TextLayer from "./passes/TextLayer.js";
import { CursorOrb } from "./passes/Objects.js";
import GlobalUI from "./ui/GlobalUI.js";
import LoaderCounter from "./ui/Loader.js";
import DrawGate from "./ui/DrawGate.js";
import { installCursor } from "./ui/cursor.js";
import {
  openSignupForm,
  openSharePanel,
  createBottomTrack,
} from "./ui/modals.js";
import { ALL_SEGMENTS } from "./stages/stages.js";
import { createStage5Controls } from "./stages/markers.js";

/* ------------------------------------------------------------ boot ------- */
const canvas = document.getElementById("webgl");
const uiContainer = document.getElementById("ui-container");

/** Pick a quality tier from the device's capabilities. */
function detectTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (coarse || mem <= 2 || cores <= 2) return "LOW";
  if (mem <= 4 || cores <= 4) return "MEDIUM";
  return "HIGH";
}
const tier = detectTier();
const quality = QUALITY[tier];

let vw = window.innerWidth,
  vh = window.innerHeight;
const dpr = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: true,
  powerPreference: "high-performance",
  stencil: false,
});
renderer.setPixelRatio(dpr);
renderer.setSize(vw, vh, false);
renderer.setClearAlpha(0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// The composer controls clearing explicitly. Without this the ScenePass would
// wipe the background pass's gradient before drawing the scene over it.
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, vw / vh, 0.1, 200);
camera.position.set(0, 0, 8);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(-3, 5, 6);
scene.add(key);

/* ----------------------------------------------------------- passes ------ */
const bufW = Math.floor(vw * dpr),
  bufH = Math.floor(vh * dpr);
const composer = new Composer(renderer, bufW, bufH);
const bgPass = new BackgroundPass(bufW, bufH);
const scenePass = new ScenePass(scene, camera);
const frostPass = new FrostPass(bufW, bufH);
const fgPass = new ForegroundPass();
const lensBlurPass = new LensBlurPass(bufW, bufH, quality.blurIterations);

fgPass.uniforms.uEnableNoise.value = quality.noise ? 1 : 0;

composer.addPass(bgPass);
composer.addPass(scenePass);
composer.addPass(frostPass);
composer.addPass(lensBlurPass);
composer.addPass(fgPass);

const textLayer = new TextLayer(camera);
const textPass = new ScenePass(textLayer.scene, camera);
composer.insertPass(textPass, 2);

/* ------------------------------------------------------------ audio ------ */
const audio = new AudioEngine("assets/audio/");
audio.init();

/* -------------------------------------------------------------- UI ------- */
const scrollManager = new ScrollManager({
  getTotalHeight: () => (totalScrollVh() / 100) * window.innerHeight,
});

const ui = new GlobalUI(uiContainer, {
  audio,
  segments: SEGMENTS,
  onNavigate: (id) => timeline.skipTo(id),
  onCta: () => openSignupForm({ audio }),
});

const bottomTrack = createBottomTrack(document.body, {
  audio,
  onCta: () => openSharePanel({ audio }),
});
const stage5Controls = createStage5Controls(document.body, { audio });

installCursor();

/* --------------------------------------------------------- loader -------- */
const loader = new LoaderCounter(document.body);
loader.loadLogo("assets/brand/logo_white.svg");
document.body.classList.add("webgl-loader-overlay");

/* ------------------------------------------------------- asset loading --- */
const texLoader = new THREE.TextureLoader();
const assets = new Map();

const MANIFEST = [
  ["frost", "assets/textures/frost.webp"],
  ["frostNormal", "assets/textures/frost_normal.webp"],
  ["matcapOrb", "assets/textures/matcap_orb.webp"],
  ["matcapShard", "assets/textures/matcap_shard.webp"],
  ["particles", "assets/textures/particles_atlas.webp"],
  ["clouds", "assets/textures/clouds_atlas.webp"],
  ["stage2bg", "assets/textures/stage2_backdrop.webp"],
  ["stage3bg", "assets/textures/stage3_backdrop.webp"],
  ["worldMap", "assets/textures/world_map.webp"],
];

function loadTexture(key, url) {
  return new Promise((resolve) => {
    texLoader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        assets.set(key, t);
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

/* ------------------------------------------------------------ context ---- */
const ctx = {
  renderer,
  scene,
  camera,
  composer,
  bgPass,
  fgPass,
  frostPass,
  lensBlurPass,
  textLayer,
  audio,
  ui,
  scrollManager,
  assets,
  quality,
  bottomTrack,
  stage5Controls,
  components: {},
  time: 0,
  stageProgress: 0,
  onSegmentChange(def) {
    ui.setPageTheme(STAGE_THEME[def.id] || "white");
  },
};

const timeline = new MasterTimeline(ctx, ALL_SEGMENTS);

/* ------------------------------------------------------------ orb -------- */
const hasPointer = !matchMedia("(hover: none) and (pointer: coarse)").matches;
const orb = new CursorOrb(camera, {
  scale: 0.42,
  distance: 5.0,
  enabled: hasPointer,
});
scene.add(orb.group);
ctx.orb = orb;

let pointerNX = 0,
  pointerNY = 0;
if (hasPointer) {
  window.addEventListener(
    "pointermove",
    (e) => {
      pointerNX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerNY = -(e.clientY / window.innerHeight) * 2 + 1;
      orb.setCursor(pointerNX, pointerNY);
      frostPass.setPointer(
        e.clientX / window.innerWidth,
        1 - e.clientY / window.innerHeight,
      );
    },
    { passive: true },
  );
} else {
  /* Touch: drive the frost highlight from the active touch instead. */
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t)
        frostPass.setPointer(
          t.clientX / window.innerWidth,
          1 - t.clientY / window.innerHeight,
        );
    },
    { passive: true },
  );
}

/* ---------------------------------------------------------- draw gate ---- */
const drawGate = new DrawGate(ui, {
  audio,
  canvas,
  onProgress: (p) => {
    frostPass.uniforms.uSpread.value = p * 0.5;
  },
  onComplete: () => {
    ui.unpin("drawCircle");
    document.body.classList.remove("webgl-loader-overlay");
    ui.revealChrome();
    ui.setAudioPlaying(true);
    audio.play("amb_stage1", { volume: 0.5 });
    ui.addXP(25);
    scrollManager.attach(window);
    timeline.start();
  },
});

/* ------------------------------------------------------------- resize --- */
function onResize() {
  vw = window.innerWidth;
  vh = window.innerHeight;
  const r = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
  renderer.setPixelRatio(r);
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  camera.updateProjectionMatrix();
  const w = Math.floor(vw * r),
    h = Math.floor(vh * r);
  composer.setSize(w, h);
  bgPass.setSize(w, h);
  frostPass.setSize(w, h);
  lensBlurPass.setSize(w, h);
  textLayer.resize(vw, vh);
  loader.resize(vw, vh);
}
window.addEventListener("resize", onResize);

/* ------------------------------------------------------------ modals ---- */
// Pause the virtual scroll whenever an overlay is open.
window.addEventListener("nova:modalOpen", () =>
  scrollManager.setEnabled(false),
);
window.addEventListener("nova:modalClose", () =>
  scrollManager.setEnabled(true),
);

/* --------------------------------------------------------- render loop -- */
const clock = new THREE.Clock();
let rafId = 0;

function tick() {
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  ctx.time = t;

  bgPass.uniforms.uTime.value = t;
  fgPass.uniforms.uTime.value = t;
  frostPass.uniforms.uTime.value = t;

  const progress = scrollManager.update();

  if (timeline.isActive) {
    timeline.update(progress, t, dt);
    ui.ruler.update(progress);
    const def = timeline.activeDef;
    const idx = SEGMENTS.filter((s) => s.ruler).findIndex(
      (s) => s.id === def?.id,
    );
    ui.mobileTimeline.update(
      progress,
      Math.max(0, idx),
      ctx.stageProgress,
      def?.ruler,
    );
  } else {
    orb.update(t, dt);
  }

  ui.updateHold(dt);
  composer.render();
}

/* -------------------------------------------------------------- start --- */
async function boot() {
  // Phase 1: count down while textures stream in.
  const state = { value: 0 };
  const setProgress = (p) => {
    state.value = p;
    ui.updateLoader(p);
    frostPass.uniforms.uLoadProgress.value = p;
    // 99 → 0 in steps of three, exactly like the reference counter.
    loader.setNumber(Math.max(99 - Math.floor(p * 33) * 3, 0));
  };

  frostPass.active = true;
  tick();

  let done = 0;
  await Promise.all(
    MANIFEST.map(async ([k, u]) => {
      await loadTexture(k, u);
      done++;
      setProgress((done / MANIFEST.length) * 0.85);
    }),
  );

  frostPass.setFrostTexture(assets.get("frost"));
  frostPass.setNormalTexture(assets.get("frostNormal"));
  orb.material.uniforms.uMatcap.value = assets.get("matcapOrb");
  orb.material.uniforms.uHasMatcap.value = assets.get("matcapOrb") ? 1 : 0;

  await audio.preload();
  setProgress(1);
  await new Promise((r) => setTimeout(r, 300));

  // Phase 2: morph the counter into the wordmark, then invite the gesture.
  loader.finish(() => {
    ui.pin("drawCircle", "DRAW A CIRCLE", { chevron: false });
    drawGate.setReady();
    orb.enter();
  });
}

boot();

console.info(
  `%c${BRAND.name}%c — immersive WebGL template · quality tier: ${tier}`,
  "font-weight:700",
  "color:#8ea2ff",
);

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(rafId);
  audio.stopAllLoops();
});
