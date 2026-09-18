import * as THREE from "three";
import { QUAD_VERT } from "./shaders.js";

/**
 * Narrative type rendered INSIDE the WebGL scene (not DOM), so it is affected
 * by the blur/grain/colour passes exactly like the rest of the frame.
 *
 * Each line is drawn once to a canvas texture, then shown on a plane whose
 * opacity/offset is scrubbed by the owning stage. A rough "eroded" mask is
 * baked in so the type reads as printed onto the scene rather than pasted on.
 */

const TEXT_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tMap;
  uniform float uOpacity;
  uniform float uErode;
  uniform vec3  uColor;
  void main(){
    vec4 t = texture2D(tMap, vUv);
    float a = t.a * uOpacity;
    a *= smoothstep(0.0, 0.35, t.r + (1.0 - uErode));
    if(a < 0.003) discard;
    gl_FragColor = vec4(uColor * t.rgb, a);
  }
`;

function makeTextTexture(
  text,
  { font = "Supply Sans", weight = 700, color = "#ffffff", eroded = true } = {},
) {
  const pad = 40;
  const fontSize = 180;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  ctx.font = `${weight} ${fontSize}px "${font}", "Arial Black", sans-serif`;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width + pad * 2);
  const h = Math.ceil(fontSize * 1.42 + pad * 2);
  c.width = w;
  c.height = h;

  const g = c.getContext("2d");
  g.font = `${weight} ${fontSize}px "${font}", "Arial Black", sans-serif`;
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(text, pad, h / 2);

  if (eroded) {
    // Punch irregular holes so the type looks weathered / printed.
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 16 + 2;
      g.beginPath();
      g.ellipse(
        x,
        y,
        r,
        r * (0.4 + Math.random()),
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return { tex, aspect: w / h };
}

const ANCHORS = {
  "top-left": [-1, 1],
  "top-center": [0, 1],
  "top-right": [1, 1],
  "center-center": [0, 0],
  "bottom-left": [-1, -1],
  "bottom-center": [0, -1],
  "bottom-right": [1, -1],
};

export default class TextLayer {
  constructor(camera) {
    this.camera = camera;
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.items = [];
    this._geo = new THREE.PlaneGeometry(1, 1);
  }

  /** items: [{text, at, until, anchor, size}] from config.STAGE_TEXT */
  setLayout(items, color = "#ffffff") {
    this.clear();
    for (const it of items) {
      const { tex, aspect } = makeTextTexture(it.text, { color });
      const mat = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT.replace(
          "gl_Position = vec4(position.xy, 0.0, 1.0);",
          "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        ),
        fragmentShader: TEXT_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tMap: { value: tex },
          uOpacity: { value: 0 },
          uErode: { value: 1 },
          uColor: { value: new THREE.Color(color) },
        },
      });
      const mesh = new THREE.Mesh(this._geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.items.push({ ...it, mesh, mat, aspect, tex });
    }
    this.resize(this._w || window.innerWidth, this._h || window.innerHeight);
  }

  clear() {
    for (const i of this.items) {
      this.group.remove(i.mesh);
      i.mat.dispose();
      i.tex.dispose();
    }
    this.items.length = 0;
  }

  resize(w, h) {
    this._w = w;
    this._h = h;
    const cam = this.camera;
    const dist = cam.position.z;
    const vh = 2 * Math.tan((cam.fov * Math.PI) / 360) * dist;
    const vw = vh * (w / h);
    this._vw = vw;
    this._vh = vh;
    for (const it of this.items) {
      const hgt = vh * (it.size || 0.08);
      const wid = hgt * it.aspect;
      it.mesh.scale.set(wid, hgt, 1);
      const [ax, ay] = ANCHORS[it.anchor] || [0, 0];
      const marginX = vw * 0.055,
        marginY = vh * 0.075;
      it.mesh.position.x = ax * (vw / 2 - wid / 2 - marginX);
      it.mesh.position.y = ay * (vh / 2 - hgt / 2 - marginY);
      it.mesh.position.z = 0;
      it._baseY = it.mesh.position.y;
    }
  }

  /** progress: 0..1 within the owning stage. */
  scrub(progress) {
    for (const it of this.items) {
      const inT = (progress - it.at) / Math.max(0.001, it.until - it.at);
      let a = 0;
      if (inT > 0 && inT < 1) {
        a = Math.min(1, inT / 0.25) * Math.min(1, (1 - inT) / 0.25);
      }
      it.mat.uniforms.uOpacity.value = a;
      it.mat.uniforms.uErode.value = 1 - a * 0.92;
      it.mesh.position.y = it._baseY + (1 - a) * this._vh * 0.035;
    }
  }

  dispose() {
    this.clear();
    this._geo.dispose();
  }
}
