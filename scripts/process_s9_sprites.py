import os, glob
from PIL import Image
from collections import deque

BRAIN = '/Users/thanapat/.gemini/antigravity-ide/brain/9479a3d2-68d4-4045-bd5c-27c7781093f2'
OUT = '/Users/thanapat/Documents/nookairline/public/assets/s9'
os.makedirs(OUT, exist_ok=True)

SPRITE_MAP = {
    's9_cleopatra_f': 's9_cleopatra_chibi',
    's9_pharaoh_m': 's9_pharaoh_m_chibi',
    's9_ra_m': 's9_ra_m_chibi',
    's9_sekhmet_f': 's9_sekhmet_chibi',
    's9_anubis_m': 's9_anubis_m_chibi',
    's9_anubis_f': 's9_anubis_f_chibi',
    's9_explorer_m': 's9_explorer_m_chibi',
    's9_explorer_f': 's9_explorer_f_chibi'
}

THRESH = 230

def find_source(pattern):
    matches = glob.glob(os.path.join(BRAIN, f'{pattern}*.jpg'))
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
        out = out.resize((max(1, int(out.width * ratio)), 900), Image.Resampling.LANCZOS)
    
    out.save(dest, 'PNG', optimize=True)
    print(f"Generated {os.path.basename(dest)}: {img.size} -> {out.size}")

for name, pattern in SPRITE_MAP.items():
    src = find_source(pattern)
    dest = os.path.join(OUT, f'{name}.png')
    if not src:
        print(f"WARNING: Source missing for {name}")
        continue
    process(src, dest)

print("Done processing all Season 9 chibi sprites.")
