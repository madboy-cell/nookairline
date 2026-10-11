import os, glob
from PIL import Image
from collections import deque

BRAINS = [
    '/Users/thanapat/.gemini/antigravity-ide/brain/9479a3d2-68d4-4045-bd5c-27c7781093f2',
    '/Users/thanapat/.gemini/antigravity-ide/brain/0f4569d2-3a42-4fa5-9e6d-c7565c3d1778'
]
OUT = '/Users/thanapat/Documents/nookairline/public/assets/s8'
os.makedirs(OUT, exist_ok=True)

# Map target filename to possible source prefixes/patterns
SPRITE_MAP = {
    's8_empress_f': ['s8_frost_empress'],
    's8_warden_m': ['s8_frost_m_v2'],
    's8_aurora_f': ['s8_aurora_f'],
    's8_aurora_m': ['s8_aurora_m'],
    's8_sorceress_f': ['s8_frost_sorceress'],
    's8_sentinel_m': ['s8_warden_m_raw'],
    's8_aviator_f': ['s8_aviator_f_raw', 's8_aviator_f_chibi'],
    's8_aviator_m': ['s8_aviator_m_raw']
}

THRESH = 230

def find_source(patterns):
    for pattern in patterns:
        for brain in BRAINS:
            if not os.path.exists(brain):
                continue
            matches = glob.glob(os.path.join(brain, f'{pattern}*.jpg'))
            if matches:
                return sorted(matches, key=os.path.getmtime)[-1]
    return None

def process(src, dest):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()

    def bg(x, y):
        r, g, b, _ = px[x, y]
        return r >= THRESH and g >= THRESH and b >= THRESH

    # Edge seeds
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and bg(x, y):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and bg(x, y):
                seen[y * w + x] = 1
                q.append((x, y))

    # Flood fill
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                seen[ny * w + nx] = 1
                if bg(nx, ny):
                    q.append((nx, ny))

    # Soften 1px edge halo
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a and r > 195 and g > 195 and b > 195:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    px[x, y] = (r, g, b, int(a * 0.35))

    bbox = img.getbbox()
    out = img.crop(bbox) if bbox else img
    if out.height > 900:
        ratio = 900 / out.height
        out = out.resize((max(1, int(out.width * ratio)), 900), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS)
    
    out.save(dest, 'PNG', optimize=True)
    print(f"Generated {os.path.basename(dest)}: {img.size} -> {out.size}")

for name, patterns in SPRITE_MAP.items():
    src = find_source(patterns)
    dest = os.path.join(OUT, f'{name}.png')
    if not src:
        print(f"WARNING: Source missing for {name}")
        continue
    process(src, dest)

print("Done processing Season 8 sprites.")
