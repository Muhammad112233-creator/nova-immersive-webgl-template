/** Shared GLSL for the fullscreen passes. */

export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Value noise + fbm, used for grain, frost spread and cloud drift. */
export const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for(int i = 0; i < 5; i++){
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

/**
 * BACKGROUND PASS
 * Cross-fades between two textures (A -> B) over uProgress while overlaying
 * the master radial gradient. Every stage swaps its own A/B pair in.
 */
export const BG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tA;
  uniform sampler2D tB;
  uniform float uHasA;
  uniform float uHasB;
  uniform float uProgress;
  uniform float uOpacity;
  uniform vec2  uResolution;
  uniform vec2  uCenter;
  uniform vec2  uRadius;
  uniform float uTime;
  uniform vec3  uStop0; uniform vec3 uStop1; uniform vec3 uStop2; uniform vec3 uStop3;
  uniform vec3  uStop4; uniform vec3 uStop5; uniform vec3 uStop6;
  ${NOISE_GLSL}

  vec3 gradientAt(float t){
    vec3 c = uStop0;
    c = mix(c, uStop1, smoothstep(0.15855, 0.26169, t));
    c = mix(c, uStop2, smoothstep(0.26169, 0.36483, t));
    c = mix(c, uStop3, smoothstep(0.36483, 0.46797, t));
    c = mix(c, uStop4, smoothstep(0.46797, 0.57111, t));
    c = mix(c, uStop5, smoothstep(0.57111, 0.78555, t));
    c = mix(c, uStop6, smoothstep(0.78555, 1.0, t));
    return c;
  }

  void main(){
    vec2 uv = vUv;
    // GL UV origin is bottom-left; the gradient stops are authored in CSS
    // space (top-left), so flip Y before measuring the radial distance.
    vec2 cssUv = vec2(uv.x, 1.0 - uv.y);
    vec2 d = (cssUv - uCenter) / uRadius;
    float r = length(d);
    vec3 grad = gradientAt(clamp(r, 0.0, 1.0));

    // uHasA / uHasB are blend WEIGHTS (0 = gradient only, 1 = full texture),
    // so a stage can lay a backdrop over the brand gradient at any strength
    // instead of replacing it outright.
    vec3 col = grad;
    if(uHasA > 0.001){
      vec4 a = texture2D(tA, uv);
      col = mix(col, a.rgb, a.a * uHasA);
    }
    if(uHasB > 0.001 && uProgress > 0.0){
      vec4 b = texture2D(tB, uv);
      col = mix(col, b.rgb, b.a * uHasB * uProgress);
    }
    gl_FragColor = vec4(col, uOpacity);
  }
`;

/**
 * FOREGROUND PASS
 * A vignette / colour-pull layer that sits over the scene. Same idea as the
 * reference "radialPull" procedural: darkens (or lightens) the corners and
 * pulls the centre toward a tint, with optional film grain.
 */
export const FG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec3  uColor;
  uniform float uProgress;
  uniform float uOpacity;
  uniform float uCenterAlpha;
  uniform float uSigma;
  uniform float uContrast;
  uniform float uExposure;
  uniform vec3  uTint;
  uniform float uTintAmount;
  uniform float uNoiseStrength;
  uniform float uEnableNoise;
  uniform float uTime;
  ${NOISE_GLSL}

  void main(){
    vec4 src = texture2D(tDiffuse, vUv);
    vec3 col = src.rgb;

    col = (col - 0.5) * uContrast + 0.5;
    col *= uExposure;
    col = mix(col, uTint, uTintAmount);

    vec2 p = vUv - 0.5;
    float d = length(p * vec2(1.05, 1.0));
    float pull = smoothstep(uSigma, 0.86, d);
    float a = mix(uCenterAlpha, 1.0, pull) * uProgress * uOpacity;
    col = mix(col, uColor, clamp(a, 0.0, 1.0));

    if(uEnableNoise > 0.5){
      float g = vnoise(vUv * vec2(1100.0, 640.0) + uTime * 9.0);
      col += (g - 0.5) * uNoiseStrength;
    }

    gl_FragColor = vec4(col, src.a);
  }
`;

/**
 * FROST PASS
 * Crystalline spread from the pointer, used during the loader and gate 0→1.
 * uSpread grows 0→1 over the gate; uWhiteout blows the frame to white at the
 * very end so the next stage can cut in cleanly.
 */
export const FROST_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform sampler2D uFrostTex;
  uniform sampler2D uFrostNormal;
  uniform float uHasFrost;
  uniform float uSpread;
  uniform float uWhiteout;
  uniform float uTrailWhite;
  uniform float uMelt;
  uniform float uCenterWhite;
  uniform float uLoadProgress;
  uniform vec2  uPointer;
  uniform vec2  uResolution;
  uniform float uTime;
  ${NOISE_GLSL}

  void main(){
    vec2 uv = vUv;
    float aspect = uResolution.x / max(1.0, uResolution.y);
    vec2 pa = vec2((uv.x - uPointer.x) * aspect, uv.y - uPointer.y);
    float dist = length(pa);

    float n = fbm(uv * 7.0 + uTime * 0.03);
    float crystal = uHasFrost > 0.5 ? texture2D(uFrostTex, uv * 1.6).r : n;

    float reach = uSpread * 1.55;
    float edge = smoothstep(reach, reach - 0.28, dist + (crystal - 0.5) * 0.22);
    float ice = clamp(edge * uSpread, 0.0, 1.0) * (1.0 - uMelt);

    vec2 nrm = vec2(0.0);
    if(uHasFrost > 0.5){
      nrm = (texture2D(uFrostNormal, uv * 1.6).rg - 0.5) * 0.012 * ice;
    }
    vec3 col = texture2D(tDiffuse, uv + nrm).rgb;

    vec3 icy = mix(col, vec3(0.92, 0.95, 1.0), 0.72);
    icy += (crystal - 0.5) * 0.22 * ice;
    col = mix(col, icy, ice);

    float trail = smoothstep(0.16, 0.0, dist) * uTrailWhite;
    col = mix(col, vec3(1.0), clamp(trail, 0.0, 1.0));

    float cw = smoothstep(0.9, 0.0, dist) * uCenterWhite;
    col = mix(col, vec3(1.0), clamp(cw, 0.0, 1.0));
    col = mix(col, vec3(1.0), clamp(uWhiteout, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Dual-filter blur (down/up sample) — cheap, wide, and GPU friendly. */
export const DOWN_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uHalfPixel;
  void main(){
    vec4 sum = texture2D(tDiffuse, vUv) * 4.0;
    sum += texture2D(tDiffuse, vUv - uHalfPixel.xy);
    sum += texture2D(tDiffuse, vUv + uHalfPixel.xy);
    sum += texture2D(tDiffuse, vUv + vec2(uHalfPixel.x, -uHalfPixel.y));
    sum += texture2D(tDiffuse, vUv - vec2(uHalfPixel.x, -uHalfPixel.y));
    gl_FragColor = sum / 8.0;
  }
`;

export const UP_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uHalfPixel;
  void main(){
    vec4 sum = texture2D(tDiffuse, vUv + vec2(-uHalfPixel.x * 2.0, 0.0));
    sum += texture2D(tDiffuse, vUv + vec2(-uHalfPixel.x, uHalfPixel.y)) * 2.0;
    sum += texture2D(tDiffuse, vUv + vec2(0.0, uHalfPixel.y * 2.0));
    sum += texture2D(tDiffuse, vUv + vec2(uHalfPixel.x, uHalfPixel.y)) * 2.0;
    sum += texture2D(tDiffuse, vUv + vec2(uHalfPixel.x * 2.0, 0.0));
    sum += texture2D(tDiffuse, vUv + vec2(uHalfPixel.x, -uHalfPixel.y)) * 2.0;
    sum += texture2D(tDiffuse, vUv + vec2(0.0, -uHalfPixel.y * 2.0));
    sum += texture2D(tDiffuse, vUv + vec2(-uHalfPixel.x, -uHalfPixel.y)) * 2.0;
    gl_FragColor = sum / 12.0;
  }
`;

/** Composite: sharp centre, blurred edges (lens blur / depth-of-field feel). */
export const LENS_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tOriginal;
  uniform sampler2D tBlurred;
  uniform vec2  uFocalPoint;
  uniform float uFocalRadius;
  uniform float uFalloff;
  uniform float uMaxBlur;
  uniform float uEnabled;
  void main(){
    vec4 o = texture2D(tOriginal, vUv);
    if(uEnabled < 0.5 || uMaxBlur < 0.01){ gl_FragColor = o; return; }
    vec4 b = texture2D(tBlurred, vUv);
    float d = distance(vUv, uFocalPoint);
    float k = smoothstep(uFocalRadius, uFocalRadius + uFalloff, d) * uMaxBlur;
    gl_FragColor = mix(o, b, clamp(k, 0.0, 1.0));
  }
`;

/** Final copy to screen. */
export const COPY_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform float uOpacity;
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  }
`;
