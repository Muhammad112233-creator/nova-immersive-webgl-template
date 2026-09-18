import * as THREE from "three";

/**
 * Hero geometry for the experience. All procedural — no .glb downloads, so the
 * template stays small and has nothing to license.
 *
 *  CursorOrb   — matcap blob that trails the pointer (loader + stage 1)
 *  ShatterForm — icosahedron that explodes into shards (stage 2)
 *  Tunnel      — ribbed corridor the camera flies through (stage 3 / gate 3→4)
 *  WorldGlobe  — dotted sphere with markers (stage 4 / 5)
 */

/* ------------------------------------------------------------------ orb -- */
export class CursorOrb {
  constructor(
    camera,
    { matcap = null, scale = 1, distance = 3.2, enabled = true } = {},
  ) {
    this.camera = camera;
    this.distance = distance;
    /* Disabled on touch devices: with no hovering pointer the orb would
       otherwise sit frozen in the middle of the screen. */
    this.enabled = enabled;
    this.group = new THREE.Group();
    this.group.visible = false;

    const geo = new THREE.IcosahedronGeometry(0.55, 6);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMatcap: { value: matcap },
        uHasMatcap: { value: matcap ? 1 : 0 },
        uTime: { value: 0 },
        uWobble: { value: 0.11 },
        uColor: { value: new THREE.Color("#aebcff") },
        uOpacity: { value: 1 },
      },
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uWobble;
        varying vec3 vN; varying vec3 vView;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        void main(){
          vec3 p = position;
          float w = sin(p.x * 3.1 + uTime * 1.3) * sin(p.y * 2.7 - uTime) * sin(p.z * 3.4 + uTime * 0.7);
          p += normal * w * uWobble;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMatcap; uniform float uHasMatcap;
        uniform vec3 uColor; uniform float uOpacity;
        varying vec3 vN; varying vec3 vView;
        void main(){
          vec3 n = normalize(vN);
          vec2 muv = n.xy * 0.5 + 0.5;
          vec3 col = uHasMatcap > 0.5 ? texture2D(uMatcap, muv).rgb : uColor;
          float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.4);
          col += rim * 0.55;
          gl_FragColor = vec4(col, uOpacity);
        }`,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.group.scale.setScalar(scale);

    this._target = new THREE.Vector3();
    this._current = new THREE.Vector3();
    this._init = false;
    this._entered = false;
    this._yOff = -3;
  }

  enter() {
    if (!this.enabled) return;
    if (this._entered) return;
    this._entered = true;
    this.group.visible = true;
  }

  exit() {
    this._entered = false;
  }

  setCursor(nx, ny) {
    this._nx = nx;
    this._ny = ny;
  }

  update(t, dt) {
    if (!this._entered) {
      this._yOff += (-3 - this._yOff) * Math.min(1, dt * 3);
      if (this._yOff < -2.9) this.group.visible = false;
    } else {
      this._yOff += (0 - this._yOff) * Math.min(1, dt * 3);
    }
    this.material.uniforms.uTime.value = t;

    const nx = this._nx ?? 0,
      ny = this._ny ?? 0;
    this._target.set(nx, ny, 0.5).unproject(this.camera);
    this._target
      .sub(this.camera.position)
      .normalize()
      .multiplyScalar(this.distance)
      .add(this.camera.position);
    if (!this._init) {
      this._current.copy(this._target);
      this._init = true;
    }
    this._current.lerp(this._target, Math.min(1, dt * 5.5));
    this.group.position.copy(this._current);
    this.group.position.y += this._yOff;
    this.mesh.rotation.y += dt * 0.25;
    this.mesh.rotation.x += dt * 0.12;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/* -------------------------------------------------------------- shatter -- */
export class ShatterForm {
  constructor({ matcap = null, pieces = 120 } = {}) {
    this.group = new THREE.Group();
    const src = new THREE.IcosahedronGeometry(1.1, 3);
    const pos = src.attributes.position;
    const triCount = pos.count / 3;
    const use = Math.min(pieces, triCount);

    const g = new THREE.BufferGeometry();
    const verts = new Float32Array(use * 9);
    const cent = new Float32Array(use * 9);
    const seed = new Float32Array(use * 3);
    const nrm = new Float32Array(use * 9);

    const step = Math.max(1, Math.floor(triCount / use));
    let w = 0;
    for (let i = 0; i < triCount && w < use; i += step, w++) {
      const cx =
        (pos.getX(i * 3) + pos.getX(i * 3 + 1) + pos.getX(i * 3 + 2)) / 3;
      const cy =
        (pos.getY(i * 3) + pos.getY(i * 3 + 1) + pos.getY(i * 3 + 2)) / 3;
      const cz =
        (pos.getZ(i * 3) + pos.getZ(i * 3 + 1) + pos.getZ(i * 3 + 2)) / 3;
      const s = Math.random();
      const n = new THREE.Vector3(cx, cy, cz).normalize();
      for (let k = 0; k < 3; k++) {
        const vi = w * 3 + k;
        verts[vi * 3 + 0] = pos.getX(i * 3 + k);
        verts[vi * 3 + 1] = pos.getY(i * 3 + k);
        verts[vi * 3 + 2] = pos.getZ(i * 3 + k);
        cent[vi * 3 + 0] = cx;
        cent[vi * 3 + 1] = cy;
        cent[vi * 3 + 2] = cz;
        nrm[vi * 3 + 0] = n.x;
        nrm[vi * 3 + 1] = n.y;
        nrm[vi * 3 + 2] = n.z;
        seed[vi] = s;
      }
    }
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.setAttribute("aCentroid", new THREE.BufferAttribute(cent, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    src.dispose();

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uMatcap: { value: matcap },
        uHasMatcap: { value: matcap ? 1 : 0 },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aCentroid; attribute float aSeed;
        uniform float uProgress; uniform float uTime;
        varying vec3 vN; varying float vSeed; varying float vEdge;
        void main(){
          vSeed = aSeed;
          vec3 p = position;
          vec3 dir = normalize(aCentroid + vec3(0.001));
          float k = uProgress;
          float burst = k * (1.2 + aSeed * 3.4);
          p += dir * burst;
          float sp = k * (2.0 + aSeed * 8.0);
          float c = cos(sp), s = sin(sp);
          vec3 rel = p - aCentroid - dir * burst;
          rel = vec3(rel.x * c - rel.z * s, rel.y, rel.x * s + rel.z * c);
          p = aCentroid + dir * burst + rel;
          p.y -= k * k * (1.4 + aSeed * 2.0);
          vEdge = length(position - aCentroid);
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMatcap; uniform float uHasMatcap;
        uniform float uProgress; uniform float uOpacity;
        varying vec3 vN; varying float vSeed; varying float vEdge;
        void main(){
          vec3 n = normalize(vN);
          vec2 muv = n.xy * 0.5 + 0.5;
          vec3 col = uHasMatcap > 0.5 ? texture2D(uMatcap, muv).rgb : vec3(0.85, 0.89, 1.0);
          col += vEdge * 0.35;
          float a = uOpacity * (1.0 - smoothstep(0.65, 1.0, uProgress) * (0.4 + vSeed * 0.6));
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        }`,
    });

    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }
  setProgress(p) {
    this.material.uniforms.uProgress.value = p;
  }
  update(t) {
    this.material.uniforms.uTime.value = t;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/* --------------------------------------------------------------- tunnel -- */
export class Tunnel {
  constructor({ length = 60, radius = 3.2, segments = 220 } = {}) {
    this.group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      48,
      segments,
      true,
    );
    geo.rotateX(Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uColorA: { value: new THREE.Color("#121636") },
        uColorB: { value: new THREE.Color("#8ea2ff") },
        uGlow: { value: new THREE.Color("#ffc678") },
        uLength: { value: length },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying float vZ;
        void main(){
          vUv = uv; vZ = position.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime; uniform float uProgress; uniform float uOpacity;
        uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uGlow;
        uniform float uLength;
        varying vec2 vUv; varying float vZ;
        void main(){
          float ribs = sin(vUv.y * uLength * 2.6 - uTime * 2.4);
          ribs = smoothstep(0.55, 1.0, ribs);
          float spiral = sin(vUv.x * 18.0 + vUv.y * 40.0 - uTime * 3.0) * 0.5 + 0.5;
          vec3 col = mix(uColorA, uColorB, vUv.y);
          col += ribs * 0.55 * uColorB;
          col += spiral * 0.12 * uGlow;
          float vign = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
          gl_FragColor = vec4(col, uOpacity * (0.35 + vign * 0.85));
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }
  update(t) {
    this.material.uniforms.uTime.value = t;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/* --------------------------------------------------------------- globe -- */
export class WorldGlobe {
  constructor(mapTexture, { radius = 2.4 } = {}) {
    this.group = new THREE.Group();
    const geo = new THREE.SphereGeometry(radius, 96, 64);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uMap: { value: mapTexture },
        uHasMap: { value: mapTexture ? 1 : 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uReveal: { value: 1 },
        uLand: { value: new THREE.Color("#e2e8ff") },
        uOcean: { value: new THREE.Color("#2b3778") },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main(){
          vUv = uv; vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMap; uniform float uHasMap;
        uniform float uOpacity; uniform float uReveal;
        uniform vec3 uLand; uniform vec3 uOcean;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main(){
          float land = uHasMap > 0.5 ? texture2D(uMap, vUv).a : 0.0;
          land *= step(1.0 - uReveal, vUv.y);
          vec3 col = mix(uOcean, uLand, land);
          // Simple key light so the sphere reads as a volume, not a flat disc.
          vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
          float ndl = max(dot(normalize(vN), L), 0.0);
          col *= 0.45 + 0.75 * ndl;
          float rim = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.0);
          col += rim * 0.55;
          gl_FragColor = vec4(col, uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.group.add(this.mesh);

    // Soft atmosphere shell
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.12, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color("#8ea2ff") },
          uOpacity: { value: 0.55 },
        },
        vertexShader: `varying vec3 vN; varying vec3 vView;
          void main(){ vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `precision mediump float; uniform vec3 uColor; uniform float uOpacity;
          varying vec3 vN; varying vec3 vView;
          void main(){ float r = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.6);
            gl_FragColor = vec4(uColor, r * uOpacity); }`,
      }),
    );
    this.atmo = atmo;
    this.group.add(atmo);
  }
  update(t) {
    this.material.uniforms.uTime.value = t;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.atmo.geometry.dispose();
    this.atmo.material.dispose();
  }
}
