import * as THREE from "three";
import {
  QUAD_VERT,
  BG_FRAG,
  FG_FRAG,
  FROST_FRAG,
  DOWN_FRAG,
  UP_FRAG,
  LENS_FRAG,
  COPY_FRAG,
} from "./shaders.js";
import { GRADIENT } from "../core/config.js";

/** A fullscreen triangle-pair quad rendered with an ortho camera. */
class FullScreenQuad {
  constructor(material) {
    this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._geo = new THREE.PlaneGeometry(2, 2);
    this._mesh = new THREE.Mesh(this._geo, material);
    this._scene = new THREE.Scene();
    this._scene.add(this._mesh);
  }
  get material() {
    return this._mesh.material;
  }
  set material(m) {
    this._mesh.material = m;
  }
  render(renderer) {
    renderer.render(this._scene, this._cam);
  }
  dispose() {
    this._geo.dispose();
  }
}

class Pass {
  constructor() {
    this.enabled = true;
    this.needsSwap = true;
    this.renderToScreen = false;
  }
  setSize() {}
  render() {}
  dispose() {}
}

/** Background: gradient + two cross-faded textures. Always writes, never reads. */
export class BackgroundPass extends Pass {
  constructor(w, h) {
    super();
    const s = GRADIENT.stops.map(
      (x) => new THREE.Vector3(...x.color.map((c) => c / 255)),
    );
    this.material = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BG_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tA: { value: null },
        tB: { value: null },
        uHasA: { value: 0 },
        uHasB: { value: 0 },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uCenter: { value: new THREE.Vector2(...GRADIENT.center) },
        uRadius: { value: new THREE.Vector2(...GRADIENT.radius) },
        uTime: { value: 0 },
        uStop0: { value: s[0] },
        uStop1: { value: s[1] },
        uStop2: { value: s[2] },
        uStop3: { value: s[3] },
        uStop4: { value: s[4] },
        uStop5: { value: s[5] },
        uStop6: { value: s[6] },
      },
    });
    this.quad = new FullScreenQuad(this.material);
    this.needsSwap = true;
  }
  get uniforms() {
    return this.material.uniforms;
  }
  setSize(w, h) {
    this.uniforms.uResolution.value.set(w, h);
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.clear(true, true, true);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

/** Renders the 3D scene on top of whatever is already in the buffer. */
export class ScenePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    // Draw ON TOP of whatever the previous pass left in readBuffer, so the
    // gradient shows through. Only depth is cleared.
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}

export class ForegroundPass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FG_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        uColor: { value: new THREE.Vector3(0.06, 0.07, 0.17) },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uCenterAlpha: { value: 0 },
        uSigma: { value: 0.25 },
        uContrast: { value: 1 },
        uExposure: { value: 1 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uTintAmount: { value: 0 },
        uNoiseStrength: { value: 0.035 },
        uEnableNoise: { value: 1 },
        uTime: { value: 0 },
      },
    });
    this.quad = new FullScreenQuad(this.material);
  }
  get uniforms() {
    return this.material.uniforms;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export class FrostPass extends Pass {
  constructor(w, h) {
    super();
    this.active = false;
    this._spreadTween = null;
    this.material = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FROST_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        uFrostTex: { value: null },
        uFrostNormal: { value: null },
        uHasFrost: { value: 0 },
        uSpread: { value: 0 },
        uWhiteout: { value: 0 },
        uTrailWhite: { value: 0 },
        uMelt: { value: 0 },
        uCenterWhite: { value: 0 },
        uLoadProgress: { value: 0 },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(w, h) },
        uTime: { value: 0 },
      },
    });
    this.quad = new FullScreenQuad(this.material);
  }
  get uniforms() {
    return this.material.uniforms;
  }
  setFrostTexture(t) {
    if (!t) return;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    this.uniforms.uFrostTex.value = t;
    this.uniforms.uHasFrost.value = 1;
  }
  setNormalTexture(t) {
    if (!t) return;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    this.uniforms.uFrostNormal.value = t;
  }
  setPointer(x, y) {
    this.uniforms.uPointer.value.set(x, y);
  }
  setSize(w, h) {
    this.uniforms.uResolution.value.set(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (!this.active) {
      this.needsSwap = false;
      return;
    }
    this.needsSwap = true;
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export class LensBlurPass extends Pass {
  constructor(w, h, iterations = 3) {
    super();
    this._iters = iterations;
    this._rts = [];
    let iw = w,
      ih = h;
    for (let i = 0; i < this._iters; i++) {
      iw = Math.max(1, iw >> 1);
      ih = Math.max(1, ih >> 1);
      this._rts.push(
        new THREE.WebGLRenderTarget(iw, ih, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
        }),
      );
    }
    const mk = (frag) =>
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: frag,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tDiffuse: { value: null },
          uHalfPixel: { value: new THREE.Vector2() },
        },
      });
    this._downMat = mk(DOWN_FRAG);
    this._downQuad = new FullScreenQuad(this._downMat);
    this._upMat = mk(UP_FRAG);
    this._upQuad = new FullScreenQuad(this._upMat);
    this._compMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: LENS_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tOriginal: { value: null },
        tBlurred: { value: null },
        uFocalPoint: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalRadius: { value: 0.22 },
        uFalloff: { value: 0.45 },
        uMaxBlur: { value: 0 },
        uEnabled: { value: 1 },
      },
    });
    this._compQuad = new FullScreenQuad(this._compMat);
  }
  get uniforms() {
    return this._compMat.uniforms;
  }
  setSize(w, h) {
    let iw = w,
      ih = h;
    for (let i = 0; i < this._iters; i++) {
      iw = Math.max(1, iw >> 1);
      ih = Math.max(1, ih >> 1);
      this._rts[i].setSize(iw, ih);
    }
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.uniforms;
    const on = u.uEnabled.value >= 0.5 && u.uMaxBlur.value >= 0.01;
    this.needsSwap = on;
    if (!on) return;
    let tex = readBuffer.texture,
      w = readBuffer.width,
      h = readBuffer.height;
    for (let i = 0; i < this._iters; i++) {
      const rt = this._rts[i];
      this._downMat.uniforms.tDiffuse.value = tex;
      this._downMat.uniforms.uHalfPixel.value.set(0.5 / w, 0.5 / h);
      renderer.setRenderTarget(rt);
      this._downQuad.render(renderer);
      tex = rt.texture;
      w = rt.width;
      h = rt.height;
    }
    for (let i = this._iters - 1; i > 0; i--) {
      const dst = this._rts[i - 1],
        src = this._rts[i];
      this._upMat.uniforms.tDiffuse.value = src.texture;
      this._upMat.uniforms.uHalfPixel.value.set(
        0.5 / src.width,
        0.5 / src.height,
      );
      renderer.setRenderTarget(dst);
      this._upQuad.render(renderer);
    }
    u.tOriginal.value = readBuffer.texture;
    u.tBlurred.value = this._rts[0].texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this._compQuad.render(renderer);
  }
  dispose() {
    this._rts.forEach((r) => r.dispose());
    this._downMat.dispose();
    this._upMat.dispose();
    this._compMat.dispose();
    this._downQuad.dispose();
    this._upQuad.dispose();
    this._compQuad.dispose();
  }
}

export class CopyPass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: COPY_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: { tDiffuse: { value: null }, uOpacity: { value: 1 } },
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

/** Minimal ping-pong composer (no three/examples dependency). */
export default class Composer {
  constructor(renderer, w, h) {
    this.renderer = renderer;
    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    };
    this.rt1 = new THREE.WebGLRenderTarget(w, h, opts);
    this.rt2 = this.rt1.clone();
    this.readBuffer = this.rt1;
    this.writeBuffer = this.rt2;
    this.passes = [];
    this.copy = new CopyPass();
  }
  addPass(p) {
    this.passes.push(p);
  }
  insertPass(p, i) {
    this.passes.splice(i, 0, p);
  }
  setSize(w, h) {
    this.rt1.setSize(w, h);
    this.rt2.setSize(w, h);
    this.passes.forEach((p) => p.setSize && p.setSize(w, h));
  }
  swap() {
    const t = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = t;
  }
  render() {
    const active = this.passes.filter((p) => p.enabled !== false);
    let last = -1;
    active.forEach((p, i) => {
      if (p.needsSwap !== false) last = i;
    });
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      p.renderToScreen = false;
      p.render(this.renderer, this.writeBuffer, this.readBuffer);
      if (p.needsSwap) this.swap();
    }
    this.copy.renderToScreen = true;
    this.copy.render(this.renderer, null, this.readBuffer);
    this.renderer.setRenderTarget(null);
  }
  dispose() {
    this.rt1.dispose();
    this.rt2.dispose();
    this.passes.forEach((p) => p.dispose && p.dispose());
    this.copy.dispose();
  }
}
