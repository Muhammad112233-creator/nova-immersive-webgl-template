#!/usr/bin/env python3
"""
NOVA template - original asset generator.
Every image/audio file shipped in public/assets is produced by this script.
Nothing is copied from any third party.

    python3 tools/gen_assets.py
"""
import math, os, random, struct, wave
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
A = os.path.join(ROOT, "public", "assets")
for d in ("brand", "ui", "textures", "audio"):
    os.makedirs(os.path.join(A, d), exist_ok=True)

random.seed(7)
np.random.seed(7)

# ----------------------------------------------------------------- palette --
DEEP   = (18, 22, 54)
MID    = (96, 111, 198)
LIGHT  = (226, 232, 255)
ACCENT = (142, 162, 255)
WARM   = (255, 198, 120)

STOPS = [
    (0.15855, (226, 232, 255)),
    (0.26169, (196, 206, 246)),
    (0.36483, (163, 176, 234)),
    (0.46797, (128, 143, 219)),
    (0.57111, (96, 111, 198)),
    (0.78555, (52, 62, 126)),
    (1.00000, (18, 22, 54)),
]


def lerp(a, b, t):
    return a + (b - a) * t


def ramp(t):
    """Sample the master radial ramp at 0..1."""
    t = max(0.0, min(1.0, t))
    prev = (0.0, STOPS[0][1])
    for off, col in STOPS:
        if t <= off:
            span = max(1e-6, off - prev[0])
            k = (t - prev[0]) / span
            return tuple(int(round(lerp(prev[1][i], col[i], k))) for i in range(3))
        prev = (off, col)
    return STOPS[-1][1]


# ------------------------------------------------------------------ noise ---
def value_noise(w, h, freq, octaves=5, seed=0):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    f = freq
    for _ in range(octaves):
        gw, gh = max(2, int(f)), max(2, int(f))
        g = rng.random((gh, gw)).astype(np.float32)
        g = np.vstack([g, g[:1]])
        g = np.hstack([g, g[:, :1]])
        ys = np.linspace(0, gh, h, endpoint=False)
        xs = np.linspace(0, gw, w, endpoint=False)
        y0 = ys.astype(int); x0 = xs.astype(int)
        fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]
        c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
        tot += amp
        amp *= 0.5
        f *= 2
    return out / tot


def norm(a):
    lo, hi = float(a.min()), float(a.max())
    return (a - lo) / max(1e-6, hi - lo)


# --------------------------------------------------------------- brand svg --
LOGO_PATHS = """
  <path d="M6 44V8h7.6l14.9 22.1V8h7.3v36h-7.4L13.3 21.6V44H6Z"/>
  <path d="M60.4 44.8c-10.4 0-17.6-7.6-17.6-18.8S50 7.2 60.4 7.2 78 14.8 78 26s-7.2 18.8-17.6 18.8Zm0-7c6 0 9.9-4.6 9.9-11.8S66.4 14.2 60.4 14.2s-9.9 4.6-9.9 11.8 3.9 11.8 9.9 11.8Z"/>
  <path d="M93.6 44 81.3 8h8.2l8.4 26.8L106.3 8h8.1l-12.3 36h-8.5Z"/>
  <path d="M112.9 44 125.2 8h8.7L146.2 44h-8.1l-2.4-7.6h-12.4L120.9 44h-8Zm12.4-14.2h8.4l-4.2-13.2-4.2 13.2Z"/>
"""


def write_svg(path, fill):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 152 52" '
        'width="152" height="52" role="img" aria-label="NOVA">'
        f'<g fill="{fill}">{LOGO_PATHS}</g></svg>'
    )
    open(path, "w").write(svg)


write_svg(os.path.join(A, "brand", "logo.svg"), "#121636")
write_svg(os.path.join(A, "brand", "logo_white.svg"), "#ffffff")


def mark(size, bg, fg, ring=True):
    s = size * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([0, 0, s - 1, s - 1], fill=bg + (255,))
    if ring:
        d.ellipse([s * 0.09] * 2 + [s * 0.91] * 2, outline=fg + (70,), width=max(2, s // 90))
    # star / nova burst
    cx = cy = s / 2
    for i in range(4):
        a = i * math.pi / 4
        ln = s * (0.36 if i % 2 == 0 else 0.25)
        wdt = max(2, int(s * (0.035 if i % 2 == 0 else 0.022)))
        d.line([cx - math.cos(a) * ln, cy - math.sin(a) * ln,
                cx + math.cos(a) * ln, cy + math.sin(a) * ln],
               fill=fg + (255,), width=wdt)
    d.ellipse([cx - s * 0.085, cy - s * 0.085, cx + s * 0.085, cy + s * 0.085], fill=fg + (255,))
    return im.resize((size, size), Image.LANCZOS)


mark(512, DEEP, LIGHT).save(os.path.join(A, "brand", "favicon.png"))
mark(180, DEEP, LIGHT).save(os.path.join(A, "brand", "apple-touch-icon.png"))
mark(256, DEEP, LIGHT).save(os.path.join(A, "ui", "app_icon.jpg").replace(".jpg", ".png"))
mark(256, DEEP, LIGHT).convert("RGB").save(os.path.join(A, "ui", "app_icon.jpg"), quality=92)

open(os.path.join(A, "brand", "favicon.svg"), "w").write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
    '<circle cx="32" cy="32" r="32" fill="#121636"/>'
    '<g stroke="#e2e8ff" stroke-linecap="round">'
    '<line x1="32" y1="9" x2="32" y2="55" stroke-width="5"/>'
    '<line x1="9" y1="32" x2="55" y2="32" stroke-width="5"/>'
    '<line x1="16" y1="16" x2="48" y2="48" stroke-width="3"/>'
    '<line x1="48" y1="16" x2="16" y2="48" stroke-width="3"/></g>'
    '<circle cx="32" cy="32" r="6" fill="#e2e8ff"/></svg>'
)


# ------------------------------------------------------------- og / social --
def gradient_bg(w, h, cx=0.5, cy=1.30, rx=1.267, ry=1.434):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xx / w; v = yy / h
    d = np.sqrt(((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2)
    lut = np.array([ramp(i / 255.0) for i in range(256)], np.float32)
    idx = np.clip(d * 255.0, 0, 255).astype(np.uint8)
    return lut[idx].astype(np.uint8)


og = Image.fromarray(gradient_bg(1920, 1080))
g = ImageDraw.Draw(og)
try:
    f1 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 132)
    f2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)
except Exception:
    f1 = f2 = ImageFont.load_default()
g.text((120, 760), "NOVA", font=f1, fill=(255, 255, 255))
g.text((128, 925), "An immersive scroll-driven WebGL template", font=f2, fill=(255, 255, 255, 220))
og.filter(ImageFilter.GaussianBlur(0)).save(os.path.join(A, "brand", "og_image.jpg"), quality=88)


# ----------------------------------------------------------- cursor atlas ---
CELL, COLS, ROWS = 56, 3, 2
SS = 4  # supersample


def cursor_cell(kind):
    s = CELL * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    W = (255, 255, 255, 255)
    K = (16, 18, 40, 255)
    lw = max(2, int(s * 0.055))

    def poly(pts, fill=W, outline=K):
        d.polygon([(x * s, y * s) for x, y in pts], fill=fill, outline=outline, width=lw)

    if kind == "arrow":
        poly([(0.16, 0.08), (0.16, 0.80), (0.34, 0.63), (0.45, 0.88),
              (0.58, 0.82), (0.47, 0.58), (0.70, 0.55)])
    elif kind == "pointer":
        poly([(0.30, 0.10), (0.42, 0.10), (0.42, 0.44), (0.49, 0.38), (0.60, 0.40),
              (0.72, 0.48), (0.74, 0.74), (0.66, 0.90), (0.40, 0.90), (0.30, 0.72)])
        for x in (0.50, 0.58, 0.66):
            d.line([(x * s, 0.52 * s), (x * s, 0.72 * s)], fill=K, width=max(1, lw // 2))
    elif kind == "grab":
        poly([(0.22, 0.52), (0.26, 0.30), (0.34, 0.28), (0.36, 0.44), (0.40, 0.24),
              (0.48, 0.23), (0.50, 0.44), (0.55, 0.26), (0.63, 0.27), (0.63, 0.46),
              (0.70, 0.34), (0.77, 0.38), (0.74, 0.72), (0.60, 0.90), (0.34, 0.88),
              (0.22, 0.70)])
    elif kind == "grabbed":
        poly([(0.24, 0.56), (0.26, 0.40), (0.36, 0.34), (0.52, 0.32), (0.66, 0.36),
              (0.76, 0.46), (0.75, 0.72), (0.60, 0.89), (0.36, 0.87), (0.24, 0.72)])
        for x in (0.38, 0.50, 0.62):
            d.line([(x * s, 0.44 * s), (x * s, 0.56 * s)], fill=K, width=max(1, lw // 2))
    elif kind == "text":
        d.line([(0.50 * s, 0.14 * s), (0.50 * s, 0.86 * s)], fill=W, width=lw * 2)
        d.line([(0.50 * s, 0.14 * s), (0.50 * s, 0.86 * s)], fill=K, width=lw)
        for y in (0.15, 0.85):
            d.line([(0.36 * s, y * s), (0.64 * s, y * s)], fill=K, width=lw)
    elif kind == "move":
        d.line([(0.5 * s, 0.10 * s), (0.5 * s, 0.90 * s)], fill=W, width=lw * 2)
        d.line([(0.10 * s, 0.5 * s), (0.90 * s, 0.5 * s)], fill=W, width=lw * 2)
        d.line([(0.5 * s, 0.10 * s), (0.5 * s, 0.90 * s)], fill=K, width=lw)
        d.line([(0.10 * s, 0.5 * s), (0.90 * s, 0.5 * s)], fill=K, width=lw)
        for a, b, c in [((0.5, 0.06), (0.42, 0.20), (0.58, 0.20)),
                        ((0.5, 0.94), (0.42, 0.80), (0.58, 0.80)),
                        ((0.06, 0.5), (0.20, 0.42), (0.20, 0.58)),
                        ((0.94, 0.5), (0.80, 0.42), (0.80, 0.58))]:
            d.polygon([(a[0] * s, a[1] * s), (b[0] * s, b[1] * s), (c[0] * s, c[1] * s)],
                      fill=W, outline=K, width=max(1, lw // 2))
    return im.resize((CELL, CELL), Image.LANCZOS)


atlas = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
order = [("arrow", 0, 0), ("pointer", 1, 0), ("grab", 2, 0),
         ("grabbed", 0, 1), ("text", 1, 1), ("move", 2, 1)]
for k, c, r in order:
    atlas.paste(cursor_cell(k), (c * CELL, r * CELL))
atlas.save(os.path.join(A, "ui", "cursors_atlas.webp"), lossless=True)


# ---------------------------------------------------------------- xp badge --
def xp_badge(size=96):
    s = size * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = s * (0.47 if i % 2 == 0 else 0.20)
        pts.append((s / 2 + math.cos(a) * r, s / 2 + math.sin(a) * r))
    d.polygon(pts, fill=WARM + (255,))
    d.ellipse([s * 0.36] * 2 + [s * 0.64] * 2, fill=(255, 248, 232, 255))
    return im.resize((size, size), Image.LANCZOS)


xp_badge().save(os.path.join(A, "ui", "xp.webp"), lossless=True)


# ------------------------------------------------------- frost / textures ---
def frost(w=1024, h=1024, seed=3):
    n1 = value_noise(w, h, 5, 6, seed)
    n2 = value_noise(w, h, 17, 5, seed + 1)
    n3 = value_noise(w, h, 41, 4, seed + 2)
    crystal = np.abs(n2 - 0.5) * 2.0
    crystal = 1.0 - np.clip(crystal * 2.4, 0, 1)
    v = norm(n1 * 0.55 + crystal * 0.35 + n3 * 0.22)
    v = np.clip(v ** 1.25, 0, 1)
    rgb = np.stack([v * 235 + 20, v * 240 + 15, v * 255 + 0], -1).astype(np.uint8)
    return Image.fromarray(rgb)


frost().save(os.path.join(A, "textures", "frost.webp"), quality=88)


def normal_map(img, strength=2.6):
    g = np.asarray(img.convert("L"), np.float32) / 255.0
    gy, gx = np.gradient(g)
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(g)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    out = np.stack([(nx / l * 0.5 + 0.5), (ny / l * 0.5 + 0.5), (nz / l * 0.5 + 0.5)], -1)
    return Image.fromarray((out * 255).astype(np.uint8))


normal_map(frost()).save(os.path.join(A, "textures", "frost_normal.webp"), quality=88)


def matcap(size=256, base=(150, 168, 236), spec=(255, 255, 255), rim=(96, 120, 220)):
    s = size
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    u = (xx / s) * 2 - 1; v = (yy / s) * 2 - 1
    r2 = u * u + v * v
    mask = r2 <= 1.0
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    L = np.array([-0.45, 0.62, 0.65]); L /= np.linalg.norm(L)
    ndl = np.clip(u * L[0] + (-v) * L[1] + z * L[2], 0, 1)
    h = np.array([-0.30, 0.45, 1.0]); h /= np.linalg.norm(h)
    ndh = np.clip(u * h[0] + (-v) * h[1] + z * h[2], 0, 1)
    fres = np.clip(1 - z, 0, 1) ** 2.2
    col = (np.array(base)[None, None] * (0.28 + 0.78 * ndl[..., None])
           + np.array(spec)[None, None] * (ndh[..., None] ** 46) * 1.15
           + np.array(rim)[None, None] * fres[..., None] * 0.85)
    col = np.clip(col, 0, 255).astype(np.uint8)
    out = np.zeros((s, s, 4), np.uint8)
    out[..., :3] = col
    out[..., 3] = (mask * 255).astype(np.uint8)
    return Image.fromarray(out)


matcap().save(os.path.join(A, "textures", "matcap_orb.webp"), lossless=True)
matcap(base=(232, 236, 250), spec=(255, 255, 255), rim=(150, 165, 230)).save(
    os.path.join(A, "textures", "matcap_shard.webp"), lossless=True)


def cloud_atlas(cells=4, cell=256):
    im = Image.new("RGBA", (cell * cells, cell), (0, 0, 0, 0))
    for i in range(cells):
        n = value_noise(cell, cell, 4 + i * 2, 6, 40 + i)
        n = norm(n)
        yy, xx = np.mgrid[0:cell, 0:cell].astype(np.float32)
        u = (xx / cell) * 2 - 1; v = (yy / cell) * 2 - 1
        fall = np.clip(1 - np.sqrt(u * u + v * v * 1.7), 0, 1) ** 1.5
        a = np.clip((n * 1.35 - 0.35) * fall, 0, 1) ** 1.1
        rgbv = 210 + 45 * n
        arr = np.zeros((cell, cell, 4), np.uint8)
        arr[..., 0] = np.clip(rgbv - 6, 0, 255)
        arr[..., 1] = np.clip(rgbv, 0, 255)
        arr[..., 2] = 255
        arr[..., 3] = (a * 255).astype(np.uint8)
        im.paste(Image.fromarray(arr), (i * cell, 0))
    return im


cloud_atlas().save(os.path.join(A, "textures", "clouds_atlas.webp"), lossless=True)


def petal_atlas(cell=128):
    """5 sprites: petal | coin | spark | shard | soft cloud blob."""
    im = Image.new("RGBA", (cell * 5, cell), (0, 0, 0, 0))
    # petal
    p = Image.new("RGBA", (cell, cell), (0, 0, 0, 0)); d = ImageDraw.Draw(p)
    d.polygon([(64, 6), (104, 48), (78, 118), (50, 118), (24, 48)], fill=(198, 212, 255, 255))
    d.polygon([(64, 14), (94, 50), (74, 108), (64, 108)], fill=(232, 238, 255, 255))
    im.paste(p, (0, 0))
    # coin
    c = Image.new("RGBA", (cell, cell), (0, 0, 0, 0)); d = ImageDraw.Draw(c)
    d.ellipse([10, 22, 118, 106], fill=WARM + (255,))
    d.ellipse([22, 32, 106, 96], fill=(255, 226, 170, 255))
    d.ellipse([48, 52, 80, 76], fill=WARM + (255,))
    im.paste(c, (cell, 0))
    # spark
    sp = Image.new("RGBA", (cell, cell), (0, 0, 0, 0)); d = ImageDraw.Draw(sp)
    for i in range(4):
        a = i * math.pi / 4
        d.line([64 - math.cos(a) * 58, 64 - math.sin(a) * 58,
                64 + math.cos(a) * 58, 64 + math.sin(a) * 58],
               fill=(255, 255, 255, 255), width=6 if i % 2 == 0 else 3)
    sp = sp.filter(ImageFilter.GaussianBlur(2))
    im.paste(sp, (cell * 2, 0))
    # shard
    sh = Image.new("RGBA", (cell, cell), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.polygon([(64, 4), (112, 70), (74, 124), (30, 92), (20, 40)],
              fill=(226, 234, 255, 230), outline=(255, 255, 255, 255), width=3)
    im.paste(sh, (cell * 3, 0))

    # soft volumetric blob for the cloud field
    n = value_noise(cell, cell, 4, 5, 77)
    n = norm(n)
    yy, xx = np.mgrid[0:cell, 0:cell].astype(np.float32)
    u = (xx / cell) * 2 - 1
    v = (yy / cell) * 2 - 1
    fall = np.clip(1 - np.sqrt(u * u + v * v), 0, 1) ** 1.6
    a = np.clip((n * 0.75 + 0.45) * fall, 0, 1)
    arr = np.zeros((cell, cell, 4), np.uint8)
    arr[..., 0] = np.clip(214 + 40 * n, 0, 255)
    arr[..., 1] = np.clip(224 + 30 * n, 0, 255)
    arr[..., 2] = 255
    arr[..., 3] = (a * 235).astype(np.uint8)
    im.paste(Image.fromarray(arr), (cell * 4, 0))
    return im


petal_atlas().save(os.path.join(A, "textures", "particles_atlas.webp"), lossless=True)


# ---------------------------------------------------------------- backdrops --
def stage_backdrop(w, h, top, bottom, grain=0.06, seed=11):
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    base = (np.array(top, np.float32)[None, None] * (1 - yy[..., None])
            + np.array(bottom, np.float32)[None, None] * yy[..., None])
    base = np.repeat(base, w, axis=1)
    n = value_noise(w, h, 6, 5, seed)[..., None]
    out = np.clip(base * (1 - grain) + n * 255 * grain, 0, 255).astype(np.uint8)
    return Image.fromarray(out)


stage_backdrop(1280, 720, (9, 12, 34), (58, 70, 150), 0.05, 21).save(
    os.path.join(A, "textures", "stage2_backdrop.webp"), quality=86)
stage_backdrop(1280, 720, (22, 16, 52), (96, 86, 190), 0.05, 22).save(
    os.path.join(A, "textures", "stage3_backdrop.webp"), quality=86)


def world_map(w=2048, h=1024):
    """Procedural dotted 'continent' map — invented landmasses, not real geography."""
    n = value_noise(w, h, 7, 6, 99)
    yy = np.linspace(-1, 1, h, dtype=np.float32)[:, None]
    n = n - np.abs(yy) * 0.42
    land = n > 0.34
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    step = 8
    for y in range(0, h, step):
        for x in range(0, w, step):
            if land[y, x]:
                r = 2.1
                d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 212, 255, 235))
    return im


world_map().save(os.path.join(A, "textures", "world_map.webp"), lossless=True)


def card_logo(name, initials, tint):
    s = 512
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=110, fill=tint + (255,))
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 210)
    except Exception:
        f = ImageFont.load_default()
    bb = d.textbbox((0, 0), initials, font=f)
    d.text(((s - bb[2] + bb[0]) / 2, (s - bb[3] + bb[1]) / 2 - 14), initials,
           font=f, fill=(255, 255, 255, 240))
    return im


CARDS = [("Northwind", "NW", (58, 74, 168)),
         ("Lumen Labs", "LL", (34, 116, 132)),
         ("Corvus", "CV", (122, 62, 148)),
         ("Halcyon", "HA", (176, 108, 48))]
for nm, ini, tint in CARDS:
    card_logo(nm, ini, tint).save(
        os.path.join(A, "ui", f"card_{ini.lower()}.webp"), lossless=True)


def poster_card(w=1080, h=1576):
    im = Image.fromarray(gradient_bg(w, h, 0.5, 1.15, 1.1, 1.25)).convert("RGBA")
    d = ImageDraw.Draw(im)
    try:
        fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 96)
        fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    except Exception:
        fb = fs = ImageFont.load_default()
    d.text((80, h - 340), "NOVA", font=fb, fill=(255, 255, 255))
    d.text((84, h - 210), "your curiosity, finally useful", font=fs, fill=(255, 255, 255, 215))
    return im


poster_card().save(os.path.join(A, "ui", "share_poster.webp"), quality=90)


# ------------------------------------------------------------------ audio ---
SR = 22050


def write_wav(path, samples):
    a = np.clip(np.asarray(samples, np.float32), -1, 1)
    pcm = (a * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm)


def env(n, atk, rel, sustain=1.0):
    e = np.ones(n, np.float32) * sustain
    a = max(1, int(atk * SR)); r = max(1, int(rel * SR))
    e[:a] *= np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def pad(dur, freqs, detune=0.4, seed=1):
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for f in freqs:
        for k in (-1, 0, 1):
            ph = rng.random() * 6.28
            lfo = 1 + 0.004 * np.sin(2 * np.pi * (0.07 + rng.random() * 0.1) * t)
            out += np.sin(2 * np.pi * (f + k * detune) * t * lfo + ph) / len(freqs) / 3
    # loop-safe crossfade
    xf = int(0.5 * SR)
    out[:xf] *= np.linspace(0, 1, xf)
    out[-xf:] *= np.linspace(1, 0, xf)
    head = out[:xf].copy()
    out[-xf:] += head
    return out * 0.42


def airy(dur, seed=5, lp=0.02):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, int(dur * SR)).astype(np.float32)
    # simple one-pole lowpass
    y = np.zeros_like(n); acc = 0.0
    for i in range(0, len(n), 1):
        acc += lp * (n[i] - acc)
        y[i] = acc
    return y / (np.abs(y).max() + 1e-6)


AMB = {
    "amb_stage1": [110, 164.8, 220, 329.6],
    "amb_stage2": [98, 146.8, 196, 293.6],
    "amb_stage3": [87.3, 130.8, 174.6, 261.6],
    "amb_stage4": [130.8, 196, 261.6, 392],
    "amb_stage5": [146.8, 220, 293.6, 440],
}
for i, (k, fr) in enumerate(AMB.items()):
    sig = pad(8.0, fr, seed=i + 1) + airy(8.0, seed=i + 20) * 0.05
    write_wav(os.path.join(A, "audio", f"{k}.wav"), sig * 0.8)


def fx_click():
    t = np.arange(int(0.09 * SR)) / SR
    s = np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 60)
    s += np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 90) * 0.5
    return s * 0.5


def fx_whoosh(dur=1.1, seed=9):
    n = airy(dur, seed, lp=0.05)
    t = np.arange(len(n)) / SR
    return n * np.sin(np.pi * t / dur) ** 2 * 0.45


def fx_shatter():
    out = np.zeros(int(1.4 * SR), np.float32)
    rng = np.random.default_rng(3)
    for _ in range(46):
        st = int(rng.random() * 0.55 * SR)
        d = int((0.04 + rng.random() * 0.12) * SR)
        t = np.arange(d) / SR
        f = 1800 + rng.random() * 4200
        g = np.sin(2 * np.pi * f * t) * np.exp(-t * 45) * (0.06 + rng.random() * 0.1)
        out[st:st + d] += g
    return np.clip(out, -1, 1)


def fx_chime(f0=660, dur=1.3):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f0 * m * t) * np.exp(-t * (4 + m * 2)) / (m * 1.4)
            for m in (1, 2, 3, 4.2))
    return s * 0.42


def fx_hold(dur=1.6):
    t = np.arange(int(dur * SR)) / SR
    f = 180 + 520 * (t / dur) ** 1.5
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.05, 0.25) * 0.3


def fx_tunnel(dur=3.0):
    t = np.arange(int(dur * SR)) / SR
    n = airy(dur, 12, lp=0.012)
    sweep = np.sin(2 * np.pi * (60 + 90 * t / dur) * t) * 0.35
    return (n * 0.55 + sweep) * env(len(t), 0.4, 0.8) * 0.7


def fx_drag(dur=0.9):
    t = np.arange(int(dur * SR)) / SR
    return (airy(dur, 31, lp=0.03) * 0.5
            * np.sin(np.pi * t / dur)) * 0.35


FX = {
    "fx_click": fx_click(),
    "fx_whoosh": fx_whoosh(),
    "fx_shatter": fx_shatter(),
    "fx_chime": fx_chime(),
    "fx_hold": fx_hold(),
    "fx_tunnel": fx_tunnel(),
    "fx_drag": fx_drag(),
    "fx_xp": fx_chime(880, 0.8),
    "fx_loader": fx_chime(330, 1.6) * 0.7,
    "fx_enter": fx_whoosh(1.6, 44),
}
for k, v in FX.items():
    write_wav(os.path.join(A, "audio", f"{k}.wav"), v)

print("assets written to", A)
for root, _, files in os.walk(A):
    for f in sorted(files):
        p = os.path.join(root, f)
        print(f"  {os.path.relpath(p, A):42s} {os.path.getsize(p)/1024:8.1f} KB")
