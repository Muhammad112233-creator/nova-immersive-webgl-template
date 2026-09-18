/**
 * Single source of truth for the whole experience.
 *
 * Structure mirrors the reference architecture: a master timeline made of
 * SEGMENTS. Segments are either interactive stages (the user scrolls through
 * them) or auto-playing gates (short cinematic transitions between stages).
 *
 * scrollVh  — how much virtual scroll (in viewport heights) the segment owns.
 * autoScroll— gate segments play themselves on a timer instead of scrub.
 */

export const BRAND = {
  name: "NOVA",
  tagline: "An immersive scroll-driven WebGL template",
  url: "https://example.github.io/nova-immersive-webgl-template/",
  menu: [
    { label: "Overview", href: "#overview" },
    { label: "Docs", href: "#docs" },
    { label: "Source", href: "#source" },
  ],
};

/** Master radial gradient — every background pass reads these stops. */
export const GRADIENT = {
  center: [0.5, 1.3],
  radius: [1.267, 1.434],
  stops: [
    { offset: 0.15855, color: [226, 232, 255] },
    { offset: 0.26169, color: [196, 206, 246] },
    { offset: 0.36483, color: [163, 176, 234] },
    { offset: 0.46797, color: [128, 143, 219] },
    { offset: 0.57111, color: [96, 111, 198] },
    { offset: 0.78555, color: [52, 62, 126] },
    { offset: 1.0, color: [18, 22, 54] },
  ],
};

export const COLORS = {
  deep: "#121636",
  mid: "#606fc6",
  light: "#e2e8ff",
  accent: "#8ea2ff",
  warm: "#ffc678",
  ink: "#1f1d1e",
};

/**
 * The five chapters + four gates. Total scroll length is deliberately the
 * same shape as the reference: a short intro gate, a long stage 1, and an
 * increasingly long middle before a short finale.
 */
export const SEGMENTS = [
  {
    id: "gate0to1",
    kind: "gate",
    scrollVh: 50,
    autoScroll: true,
    duration: 3.5,
  },
  {
    id: "stage1",
    kind: "stage",
    scrollVh: 175,
    label: "ORIGIN",
    ruler: "-100 NV",
  },
  {
    id: "gate1to2",
    kind: "gate",
    scrollVh: 50,
    autoScroll: true,
    duration: 3.0,
  },
  {
    id: "stage2",
    kind: "stage",
    scrollVh: 250,
    label: "FRACTURE",
    ruler: "-75 NV",
  },
  {
    id: "stage3",
    kind: "stage",
    scrollVh: 325,
    label: "DESCENT",
    ruler: "-50 NV",
  },
  {
    id: "gate3to4",
    kind: "gate",
    scrollVh: 50,
    autoScroll: true,
    duration: 3.0,
  },
  {
    id: "stage4",
    kind: "stage",
    scrollVh: 368,
    label: "ASCENT",
    ruler: "-25 NV",
  },
  {
    id: "gate4to5",
    kind: "gate",
    scrollVh: 50,
    autoScroll: true,
    duration: 0.6,
  },
  {
    id: "stage5",
    kind: "stage",
    scrollVh: 50,
    label: "HORIZON",
    ruler: "0 NV",
  },
];

/** Ruler nav buttons (top centre, revealed on hover). */
export const RULER_STAGES = [
  { id: "stage1", label: "-100 NV" },
  { id: "stage2", label: "-75 NV" },
  { id: "stage3", label: "-50 NV" },
  { id: "stage4", label: "-25 NV" },
  { id: "stage5", label: "0 NV" },
];

/** Per-stage narrative copy drawn into the WebGL text layer. */
export const STAGE_TEXT = {
  stage1: [
    {
      text: "every big thing",
      at: 0.12,
      until: 0.42,
      anchor: "bottom-left",
      size: 0.085,
    },
    {
      text: "starts at zero",
      at: 0.3,
      until: 0.62,
      anchor: "center-center",
      size: 0.095,
    },
    {
      text: "so we started here",
      at: 0.55,
      until: 0.92,
      anchor: "top-right",
      size: 0.062,
    },
  ],
  stage2: [
    {
      text: "the old shape breaks",
      at: 0.1,
      until: 0.45,
      anchor: "top-left",
      size: 0.072,
    },
    {
      text: "on purpose",
      at: 0.34,
      until: 0.66,
      anchor: "center-center",
      size: 0.11,
    },
    {
      text: "nothing worth keeping shatters",
      at: 0.58,
      until: 0.94,
      anchor: "bottom-right",
      size: 0.05,
    },
  ],
  stage3: [
    {
      text: "you fall for a while",
      at: 0.08,
      until: 0.4,
      anchor: "center-center",
      size: 0.078,
    },
    {
      text: "that part is the work",
      at: 0.36,
      until: 0.7,
      anchor: "bottom-left",
      size: 0.062,
    },
    {
      text: "keep going",
      at: 0.66,
      until: 0.96,
      anchor: "center-center",
      size: 0.13,
    },
  ],
  stage4: [
    {
      text: "then the floor turns",
      at: 0.1,
      until: 0.44,
      anchor: "top-left",
      size: 0.068,
    },
    {
      text: "into a runway",
      at: 0.34,
      until: 0.72,
      anchor: "center-center",
      size: 0.1,
    },
    {
      text: "and the map gets wide",
      at: 0.62,
      until: 0.95,
      anchor: "bottom-right",
      size: 0.055,
    },
  ],
  stage5: [],
};

/** Status line pinned under / over the canvas per stage. */
export const STAGE_STATUS = {
  stage1: "SCROLL TO BEGIN",
  stage2: "KEEP SCROLLING",
  stage3: "HOLD ON",
  stage4: "ALMOST THERE",
  stage5: "PICK A DESTINATION",
};

/** Stage 5 map markers — invented organisations, original artwork. */
export const MARKERS = [
  {
    id: "m0",
    x: 0.317,
    y: 0.042,
    org: "Northwind",
    logo: "nw",
    role: "Systems Designer",
    scenario: "Route planning for the Northwind freight grid",
    description:
      "Model a week of freight movements and find the three routes that cost the most to run.",
    tools: ["Python", "Pandas", "Notebook", "Mapbox"],
  },
  {
    id: "m1",
    x: -0.089,
    y: -0.154,
    org: "Lumen Labs",
    logo: "ll",
    role: "Research Analyst",
    scenario: "Why Lumen trial users stop at day nine",
    description:
      "Find the drop-off in the Lumen trial funnel and propose one change worth shipping.",
    tools: ["Sheets", "Notebook", "Figma"],
  },
  {
    id: "m2",
    x: -0.115,
    y: 0.186,
    org: "Corvus",
    logo: "cv",
    role: "Product Engineer",
    scenario: "A drafting assistant inside Corvus Mail",
    description:
      "Prototype an assistant that finishes long drafts without changing the writer’s voice.",
    tools: ["Next.js", "Vercel", "Postgres", "LLM API"],
  },
  {
    id: "m3",
    x: 0.134,
    y: -0.08,
    org: "Halcyon",
    logo: "ha",
    role: "Growth Analyst",
    scenario: "Restoring free-to-paid conversion at Halcyon",
    description:
      "Rebuild the upgrade path for a music service whose conversion fell for four quarters.",
    tools: ["Sheets", "Slides", "SQL"],
  },
];

/** Audio bed per segment. */
export const AUDIO_BEDS = {
  gate0to1: [{ name: "amb_stage1", volume: 0.45 }],
  stage1: [{ name: "amb_stage1", volume: 0.55 }],
  gate1to2: [{ name: "amb_stage1", volume: 0.3 }],
  stage2: [{ name: "amb_stage2", volume: 0.55 }],
  stage3: [{ name: "amb_stage3", volume: 0.55 }],
  gate3to4: [{ name: "amb_stage3", volume: 0.3 }],
  stage4: [{ name: "amb_stage4", volume: 0.55 }],
  gate4to5: [{ name: "amb_stage4", volume: 0.4 }],
  stage5: [{ name: "amb_stage5", volume: 0.5 }],
};

/** Page theme per segment — flips the HUD between light-on-dark and dark-on-light. */
export const STAGE_THEME = {
  gate0to1: "white",
  stage1: "black",
  gate1to2: "white",
  stage2: "white",
  stage3: "white",
  gate3to4: "white",
  stage4: "black",
  gate4to5: "black",
  stage5: "black",
};

export const QUALITY = {
  HIGH: { pixelRatio: 2, particles: 1.0, blurIterations: 3, noise: true },
  MEDIUM: { pixelRatio: 1.5, particles: 0.6, blurIterations: 2, noise: true },
  LOW: { pixelRatio: 1, particles: 0.35, blurIterations: 1, noise: false },
};

export const totalScrollVh = () => SEGMENTS.reduce((a, s) => a + s.scrollVh, 0);
