import * as THREE from "three";
import gsap from "gsap";
import { STAGE_TEXT, STAGE_STATUS, MARKERS } from "../core/config.js";
import ParticleField from "../passes/Particles.js";
import { ShatterForm, Tunnel, WorldGlobe } from "../passes/Objects.js";
import { createMarkerLayer } from "./markers.js";

/**
 * Each segment is a plain object with lifecycle hooks:
 *
 *   enter(ctx)          — build what this segment needs
 *   scrub(ctx, t)       — called with 0..1 progress every frame
 *   update(ctx, t, dt)  — per-frame work independent of scroll
 *   teardown(ctx)       — dispose
 *
 * Gates are the same shape but advance on a timer instead of the scroll
 * position, which is what makes the transitions feel cinematic rather than
 * scrubbed.
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** Remap v from [a,b] to [0,1]. */
const range = (v, a, b) => clamp01((v - a) / Math.max(1e-6, b - a));

function setBgTextures(ctx, aKey, bKey, mix = 1) {
  const u = ctx.bgPass.uniforms;
  const a = aKey ? ctx.assets.get(aKey) : null;
  const b = bKey ? ctx.assets.get(bKey) : null;
  u.tA.value = a || null;
  u.uHasA.value = a ? mix : 0;
  u.tB.value = b || null;
  u.uHasB.value = b ? mix : 0;
  u.uProgress.value = 0;
}

function showText(ctx, stageId, color = "#ffffff") {
  ctx.textLayer.setLayout(STAGE_TEXT[stageId] || [], color);
}

/* ======================================================== GATE 0 → 1 ====== */
export const gate0to1 = {
  id: "gate0to1",
  enter(ctx) {
    ctx.frostPass.active = true;
    ctx.frostPass.uniforms.uSpread.value = 0;
    ctx.ui.showScrollIndicator(false);
    ctx.audio.play("enter", { volume: 0.5, fadeIn: 0.1 });
    setBgTextures(ctx, null, null);
  },
  scrub(ctx, t) {
    ctx.bgPass.uniforms.uProgress.value = range(t, 0, 0.67);
    const f = ctx.frostPass.uniforms;
    f.uSpread.value = range(t, 0, 0.85);
    f.uWhiteout.value = range(t, 0.83, 1);
    if (ctx.fgPass) ctx.fgPass.uniforms.uProgress.value = range(t, 0.5, 1);
    if (t > 0.85) gsap.killTweensOf(f.uTrailWhite);
  },
  teardown(ctx) {
    const f = ctx.frostPass.uniforms;
    ctx.frostPass.active = false;
    f.uWhiteout.value = 0;
    f.uTrailWhite.value = 0;
    f.uMelt.value = 0;
    f.uCenterWhite.value = 0;
    // Fade the foreground vignette back out as stage 1 takes over.
    if (ctx.fgPass) {
      ctx.fgPass.uniforms.uProgress.value = 1;
      gsap.to(ctx.fgPass.uniforms.uProgress, {
        value: 0,
        duration: 1,
        delay: 1.4,
        ease: "power2.inOut",
      });
    }
  },
};

/* ============================================================= STAGE 1 ==== */
export const stage1 = {
  id: "stage1",
  enter(ctx) {
    ctx.ui.setPageTheme("black");
    ctx.ui.pin("stage1", STAGE_STATUS.stage1, { chevron: true });
    ctx.ui.showScrollIndicator(true);
    ctx.audio.play("amb_stage1", { volume: 0.55 });
    setBgTextures(ctx, null, "frost", 0.35);

    const petals = new ParticleField(ctx.assets.get("particles"), {
      preset: "petals",
      count: Math.round(260 * ctx.quality.particles),
    });
    ctx.scene.add(petals.mesh);

    ctx.orb.enter();
    showText(ctx, "stage1", "#ffffff");
    ctx.components = { petals };
    ctx._camBaseZ = ctx.camera.position.z;
  },
  scrub(ctx, t) {
    ctx.bgPass.uniforms.uProgress.value = range(t, 0.1, 0.9);
    ctx.textLayer.scrub(t);
    ctx.components.petals && ctx.components.petals.update(ctx.time, t);
    // Slow dolly-in across the whole stage.
    ctx.camera.position.z = ctx._camBaseZ - t * 1.2;
    ctx.lensBlurPass.uniforms.uMaxBlur.value = range(t, 0.85, 1) * 0.6;
    if (t > 0.06) ctx.ui.showScrollIndicator(false);
    if (t > 0.5 && !ctx._xp1) {
      ctx._xp1 = true;
      ctx.ui.addXP(25);
    }
  },
  update(ctx, t, dt) {
    ctx.orb.update(t, dt);
  },
  teardown(ctx) {
    ctx.ui.unpin("stage1");
    ctx.orb.exit();
    if (ctx.components.petals) {
      ctx.scene.remove(ctx.components.petals.mesh);
      ctx.components.petals.dispose();
    }
    ctx.camera.position.z = ctx._camBaseZ;
    ctx.lensBlurPass.uniforms.uMaxBlur.value = 0;
    ctx.components = {};
  },
};

/* ======================================================== GATE 1 → 2 ====== */
export const gate1to2 = {
  id: "gate1to2",
  enter(ctx) {
    ctx.audio.stop("amb_stage1");
    ctx.audio.play("shatter", { volume: 0.55, fadeIn: 0.01 });
    ctx.textLayer.clear();

    const shatter = new ShatterForm({
      matcap: ctx.assets.get("matcapShard"),
      pieces: Math.round(160 * ctx.quality.particles),
    });
    shatter.group.position.z = -1;
    ctx.scene.add(shatter.group);
    ctx.components = { shatter };
  },
  scrub(ctx, t) {
    const s = ctx.components.shatter;
    if (s) {
      s.setProgress(t);
      s.update(ctx.time);
      s.group.rotation.y = t * 1.2;
    }
    ctx.fgPass.uniforms.uProgress.value = range(t, 0.55, 1);
    ctx.fgPass.uniforms.uColor.value.set(0.02, 0.02, 0.06);
    ctx.lensBlurPass.uniforms.uMaxBlur.value = range(t, 0.6, 1) * 0.8;
  },
  teardown(ctx) {
    if (ctx.components.shatter) {
      ctx.scene.remove(ctx.components.shatter.group);
      ctx.components.shatter.dispose();
    }
    ctx.fgPass.uniforms.uProgress.value = 0;
    ctx.lensBlurPass.uniforms.uMaxBlur.value = 0;
    ctx.components = {};
  },
};

/* ============================================================= STAGE 2 ==== */
export const stage2 = {
  id: "stage2",
  enter(ctx) {
    ctx.ui.setPageTheme("white");
    ctx.ui.pin("stage2", STAGE_STATUS.stage2);
    ctx.audio.play("amb_stage2", { volume: 0.55 });
    setBgTextures(ctx, "stage2bg", "stage3bg", 0.8);

    const shards = new ParticleField(ctx.assets.get("particles"), {
      preset: "shards",
      count: Math.round(220 * ctx.quality.particles),
    });
    ctx.scene.add(shards.mesh);
    showText(ctx, "stage2", "#ffffff");
    ctx.components = { shards };
  },
  scrub(ctx, t) {
    ctx.bgPass.uniforms.uProgress.value = range(t, 0.35, 1);
    ctx.textLayer.scrub(t);
    ctx.components.shards && ctx.components.shards.update(ctx.time, t);
    ctx.fgPass.uniforms.uContrast.value = 1 + range(t, 0.5, 1) * 0.18;
    ctx.camera.position.x = Math.sin(t * Math.PI * 2) * 0.35;
    if (t > 0.5 && !ctx._xp2) {
      ctx._xp2 = true;
      ctx.ui.addXP(25);
    }
  },
  teardown(ctx) {
    ctx.ui.unpin("stage2");
    if (ctx.components.shards) {
      ctx.scene.remove(ctx.components.shards.mesh);
      ctx.components.shards.dispose();
    }
    ctx.fgPass.uniforms.uContrast.value = 1;
    ctx.camera.position.x = 0;
    ctx.components = {};
  },
};

/* ============================================================= STAGE 3 ==== */
export const stage3 = {
  id: "stage3",
  enter(ctx) {
    ctx.ui.setPageTheme("white");
    ctx.ui.pin("stage3", STAGE_STATUS.stage3);
    ctx.audio.stop("amb_stage2");
    ctx.audio.play("amb_stage3", { volume: 0.55 });
    setBgTextures(ctx, "stage3bg", null, 0.55);

    const tunnel = new Tunnel({ length: 70, radius: 3.4 });
    tunnel.group.position.z = -30;
    ctx.scene.add(tunnel.group);

    const embers = new ParticleField(ctx.assets.get("particles"), {
      preset: "embers",
      count: Math.round(200 * ctx.quality.particles),
    });
    ctx.scene.add(embers.mesh);

    showText(ctx, "stage3", "#ffffff");
    ctx.components = { tunnel, embers };
    ctx._camBaseZ3 = ctx.camera.position.z;
  },
  scrub(ctx, t) {
    ctx.textLayer.scrub(t);
    ctx.components.embers && ctx.components.embers.update(ctx.time, t);
    // Fly forward down the corridor.
    ctx.camera.position.z = ctx._camBaseZ3 - t * 26;
    ctx.camera.rotation.z = Math.sin(t * Math.PI * 3) * 0.05;
    ctx.lensBlurPass.uniforms.uMaxBlur.value = 0.15 + range(t, 0.7, 1) * 0.7;
    ctx.fgPass.uniforms.uTintAmount.value = range(t, 0.6, 1) * 0.25;
    ctx.fgPass.uniforms.uTint.value.set(0.55, 0.45, 0.95);
    if (t > 0.5 && !ctx._xp3) {
      ctx._xp3 = true;
      ctx.ui.addXP(25);
    }
  },
  update(ctx, t) {
    ctx.components.tunnel && ctx.components.tunnel.update(t);
  },
  teardown(ctx) {
    ctx.ui.unpin("stage3");
    for (const k of ["tunnel", "embers"]) {
      const c = ctx.components[k];
      if (!c) continue;
      ctx.scene.remove(c.group || c.mesh);
      c.dispose();
    }
    ctx.camera.position.z = ctx._camBaseZ3;
    ctx.camera.rotation.z = 0;
    ctx.lensBlurPass.uniforms.uMaxBlur.value = 0;
    ctx.fgPass.uniforms.uTintAmount.value = 0;
    ctx.components = {};
  },
};

/* ======================================================== GATE 3 → 4 ====== */
export const gate3to4 = {
  id: "gate3to4",
  enter(ctx) {
    ctx.audio.play("tunnel", { volume: 0.5, fadeIn: 0.2, rate: 1 });
    ctx.textLayer.clear();
    const tunnel = new Tunnel({ length: 90, radius: 3.0 });
    tunnel.group.position.z = -40;
    ctx.scene.add(tunnel.group);
    ctx.components = { tunnel };
    ctx._z = ctx.camera.position.z;
  },
  scrub(ctx, t) {
    ctx.camera.position.z = ctx._z - t * 42;
    ctx.fgPass.uniforms.uProgress.value = range(t, 0.7, 1);
    ctx.fgPass.uniforms.uColor.value.set(1, 1, 1);
    ctx.lensBlurPass.uniforms.uMaxBlur.value = range(t, 0.1, 0.8) * 1.0;
  },
  update(ctx, t) {
    ctx.components.tunnel && ctx.components.tunnel.update(t * 2.2);
  },
  teardown(ctx) {
    if (ctx.components.tunnel) {
      ctx.scene.remove(ctx.components.tunnel.group);
      ctx.components.tunnel.dispose();
    }
    ctx.camera.position.z = ctx._z;
    ctx.fgPass.uniforms.uProgress.value = 0;
    ctx.lensBlurPass.uniforms.uMaxBlur.value = 0;
    ctx.audio.stop("tunnel", { fadeOut: 0.8 });
    ctx.components = {};
  },
};

/* ============================================================= STAGE 4 ==== */
export const stage4 = {
  id: "stage4",
  enter(ctx) {
    ctx.ui.setPageTheme("black");
    ctx.ui.pin("stage4", STAGE_STATUS.stage4);
    ctx.audio.stop("amb_stage3");
    ctx.audio.play("amb_stage4", { volume: 0.55 });
    setBgTextures(ctx, null, null);

    const clouds = new ParticleField(ctx.assets.get("particles"), {
      preset: "clouds",
      count: Math.round(90 * ctx.quality.particles),
    });
    clouds.mesh.position.z = -6;
    ctx.scene.add(clouds.mesh);

    const globe = new WorldGlobe(ctx.assets.get("worldMap"), { radius: 2.5 });
    globe.group.position.set(0, -3.2, -2);
    globe.material.uniforms.uReveal.value = 0;
    ctx.scene.add(globe.group);

    showText(ctx, "stage4", "#ffffff");
    ctx.components = { clouds, globe };
  },
  scrub(ctx, t) {
    ctx.textLayer.scrub(t);
    ctx.components.clouds && ctx.components.clouds.update(ctx.time, t);
    const g = ctx.components.globe;
    if (g) {
      // Globe rises into frame over the back half of the stage.
      const rise = range(t, 0.45, 1);
      g.group.position.y = -3.2 + rise * 3.2;
      g.group.rotation.y = t * 1.4;
      g.material.uniforms.uReveal.value = rise;
      g.atmo.material.uniforms.uOpacity.value = rise * 0.55;
    }
    ctx.camera.position.y = range(t, 0, 1) * 0.8;
    if (t > 0.5 && !ctx._xp4) {
      ctx._xp4 = true;
      ctx.ui.addXP(25);
    }
  },
  update(ctx, t) {
    ctx.components.globe && ctx.components.globe.update(t);
  },
  teardown(ctx) {
    ctx.ui.unpin("stage4");
    for (const k of ["clouds", "globe"]) {
      const c = ctx.components[k];
      if (!c) continue;
      ctx.scene.remove(c.group || c.mesh);
      c.dispose();
    }
    ctx.camera.position.y = 0;
    ctx.components = {};
  },
};

/* ======================================================== GATE 4 → 5 ====== */
export const gate4to5 = {
  id: "gate4to5",
  enter(ctx) {
    ctx.audio.play("whoosh", { volume: 0.45, fadeIn: 0.01 });
  },
  scrub(ctx, t) {
    ctx.fgPass.uniforms.uProgress.value = range(t, 0, 0.5) * 0.4;
  },
  teardown(ctx) {
    ctx.fgPass.uniforms.uProgress.value = 0;
  },
};

/* ============================================================= STAGE 5 ==== */
export const stage5 = {
  id: "stage5",
  enter(ctx) {
    ctx.ui.setPageTheme("black");
    ctx.ui.pin("stage5", STAGE_STATUS.stage5);
    ctx.ui.setFrameOpen(true);
    ctx.audio.stop("amb_stage4");
    ctx.audio.play("amb_stage5", { volume: 0.5 });
    setBgTextures(ctx, null, null);

    const globe = new WorldGlobe(ctx.assets.get("worldMap"), { radius: 2.6 });
    globe.group.position.set(0, 0, 0);
    ctx.scene.add(globe.group);

    const markers = createMarkerLayer(ctx, globe, MARKERS);
    ctx.bottomTrack && ctx.bottomTrack.show();
    ctx.stage5Controls && ctx.stage5Controls.show();

    ctx.components = { globe, markers };
    ctx.camera.position.set(0, 0, 10.5);
  },
  scrub(ctx, t) {
    const g = ctx.components.globe;
    if (g) g.group.rotation.y += 0;
  },
  update(ctx, t, dt) {
    const g = ctx.components.globe;
    const nav = ctx.stage5Controls ? ctx.stage5Controls.state : null;
    if (g) {
      g.update(t);
      // Joystick / D-pad orbit the globe; idle spin when untouched.
      const ax = nav ? nav.x : 0,
        ay = nav ? nav.y : 0;
      g.group.rotation.y += (ax * 1.4 + 0.06) * dt;
      g.group.rotation.x = THREE.MathUtils.clamp(
        g.group.rotation.x + ay * 0.9 * dt,
        -0.7,
        0.7,
      );
      if (nav && nav.zoom) {
        ctx.camera.position.z = THREE.MathUtils.clamp(
          ctx.camera.position.z - nav.zoom * 4 * dt,
          7.0,
          15,
        );
      }
    }
    ctx.components.markers && ctx.components.markers.update();
  },
  teardown(ctx) {
    ctx.ui.unpin("stage5");
    ctx.ui.setFrameOpen(false);
    ctx.bottomTrack && ctx.bottomTrack.hide();
    ctx.stage5Controls && ctx.stage5Controls.hide();
    if (ctx.components.markers) ctx.components.markers.dispose();
    if (ctx.components.globe) {
      ctx.scene.remove(ctx.components.globe.group);
      ctx.components.globe.dispose();
    }
    ctx.components = {};
  },
};

export const ALL_SEGMENTS = [
  gate0to1,
  stage1,
  gate1to2,
  stage2,
  stage3,
  gate3to4,
  stage4,
  gate4to5,
  stage5,
];
