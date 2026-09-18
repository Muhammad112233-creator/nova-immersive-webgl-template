import * as THREE from "three";

/**
 * Instanced sprite field used for petals (stage 1), shards (stage 2),
 * embers (stage 3) and clouds (stage 4). One shader, four presets — keeps the
 * draw-call count at one per field.
 *
 * The particles_atlas.webp is a 4x1 sheet: petal | coin | spark | shard.
 */

const VERT = /* glsl */ `
  attribute vec3  aOffset;
  attribute vec3  aVelocity;
  attribute float aPhase;
  attribute float aScale;
  attribute float aRotSpeed;
  attribute float aCell;
  attribute float aSeed;

  uniform float uTime;
  uniform float uProgress;
  uniform float uSpread;
  uniform float uRise;
  uniform float uSwirl;
  uniform float uCells;

  varying vec2  vUv;
  varying float vAlpha;
  varying float vCell;

  void main(){
    vUv = uv;
    vCell = aCell;

    float t = uTime * 0.35 + aPhase;
    vec3 pos = aOffset * uSpread;

    pos += aVelocity * (uProgress * 6.0);
    pos.y += sin(t * 0.9) * 0.24 + uRise * uProgress * 3.2;
    pos.x += sin(t * 0.7 + aSeed * 6.28) * uSwirl;
    pos.z += cos(t * 0.55 + aSeed * 3.14) * uSwirl * 0.6;

    float ang = t * aRotSpeed;
    float c = cos(ang), s = sin(ang);
    vec2 corner = position.xy * aScale;
    corner = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv.xy += corner;

    float fade = smoothstep(0.0, 0.12, uProgress) * smoothstep(1.0, 0.72, uProgress);
    vAlpha = fade * (0.55 + 0.45 * sin(t * 1.3 + aSeed * 9.0));

    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform sampler2D uAtlas;
  uniform float uCells;
  uniform vec3  uTint;
  uniform float uTintAmount;
  varying vec2  vUv;
  varying float vAlpha;
  varying float vCell;
  void main(){
    vec2 uv = vec2((vUv.x + vCell) / uCells, vUv.y);
    vec4 t = texture2D(uAtlas, uv);
    if(t.a < 0.02) discard;
    vec3 col = mix(t.rgb, uTint, uTintAmount);
    gl_FragColor = vec4(col, t.a * vAlpha);
  }
`;

const PRESETS = {
  petals: {
    cells: [0],
    spread: 7.0,
    rise: 0.4,
    swirl: 0.55,
    scale: [0.09, 0.26],
    tint: [0.88, 0.91, 1.0],
    tintAmount: 0.25,
    blending: THREE.NormalBlending,
  },
  shards: {
    cells: [3],
    spread: 6.0,
    rise: -0.2,
    swirl: 0.3,
    scale: [0.08, 0.34],
    tint: [0.9, 0.94, 1.0],
    tintAmount: 0.4,
    blending: THREE.NormalBlending,
  },
  embers: {
    cells: [1, 2],
    spread: 5.5,
    rise: 1.0,
    swirl: 0.7,
    scale: [0.05, 0.19],
    tint: [1.0, 0.78, 0.47],
    tintAmount: 0.55,
    blending: THREE.AdditiveBlending,
  },
  clouds: {
    cells: [4],
    spread: 9.0,
    rise: 0.15,
    swirl: 0.9,
    scale: [0.6, 2.2],
    tint: [0.85, 0.9, 1.0],
    tintAmount: 0.3,
    blending: THREE.NormalBlending,
  },
};

export default class ParticleField {
  constructor(atlas, { preset = "petals", count = 220 } = {}) {
    const P = PRESETS[preset] || PRESETS.petals;
    this.preset = P;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    geo.instanceCount = count;

    const off = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const pha = new Float32Array(count);
    const scl = new Float32Array(count);
    const rot = new Float32Array(count);
    const cel = new Float32Array(count);
    const sed = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      off[i * 3 + 0] = (Math.random() - 0.5) * 2;
      off[i * 3 + 1] = (Math.random() - 0.5) * 2;
      off[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      vel[i * 3 + 0] = (Math.random() - 0.5) * 0.35;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      pha[i] = Math.random() * 100;
      scl[i] = P.scale[0] + Math.random() * (P.scale[1] - P.scale[0]);
      rot[i] = (Math.random() - 0.5) * 1.6;
      cel[i] = P.cells[(Math.random() * P.cells.length) | 0];
      sed[i] = Math.random();
    }

    const IA = THREE.InstancedBufferAttribute;
    geo.setAttribute("aOffset", new IA(off, 3));
    geo.setAttribute("aVelocity", new IA(vel, 3));
    geo.setAttribute("aPhase", new IA(pha, 1));
    geo.setAttribute("aScale", new IA(scl, 1));
    geo.setAttribute("aRotSpeed", new IA(rot, 1));
    geo.setAttribute("aCell", new IA(cel, 1));
    geo.setAttribute("aSeed", new IA(sed, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: P.blending,
      uniforms: {
        uAtlas: { value: atlas },
        uCells: { value: 5 },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uSpread: { value: P.spread },
        uRise: { value: P.rise },
        uSwirl: { value: P.swirl },
        uTint: { value: new THREE.Vector3(...P.tint) },
        uTintAmount: { value: P.tintAmount },
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    base.dispose();
  }

  update(t, progress) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uProgress.value = progress;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
