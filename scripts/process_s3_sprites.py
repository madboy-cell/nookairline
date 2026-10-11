import os, sys, glob
from PIL import Image
from collections import deque

BRAIN = '/Users/thanapat/.gemini/antigravity-ide/brain/81f87ca0-515d-41c2-acf5-e0c25787c61e'
OUT = '/Users/thanapat/Documents/nookairline/public/assets/s3'
os.makedirs(OUT, exist_ok=True)

NAMES = [
    # Mythic (⭐⭐⭐)
    's3_djinn_m', 's3_djinn_f',
    's3_phoenix_m', 's3_phoenix_f',
    # Epic (⭐⭐)
    's3_falcon_m', 's3_falcon_f',
    's3_hypercar_m', 's3_hypercar_f',
    's3_burj_m', 's3_burj_f',
    's3_cyber_m', 's3_cyber_f',
    # Rare (⭐)
    's3_souk_m', 's3_souk_f',
    's3_safari_m', 's3_safari_f',
    's3_gahwa_m', 's3_gahwa_f',
    's3_gold_m', 's3_gold_f',
    's3_marina_m', 's3_marina_f',
    's3_abra_m', 's3_abra_f',
]
THRESH = 232

def latest(name):
    files = sorted(glob.glob(os.path.join(BRAIN, f'{name}_*.jpg')), key=os.path.getmtime)
    return files[-1] if files else None

def process(src, dest):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()
    def bg(x, y):
        r, g, b, _ = px[x, y]
        return r >= THRESH and g >= THRESH and b >= THRESH
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and bg(x, y):
                seen[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and bg(x, y):
                seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                seen[ny * w + nx] = 1
                if bg(nx, ny):
                    q.append((nx, ny))
    # soften 1px halo: near-white pixels touching transparency become semi-transparent
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a and r > 200 and g > 200 and b > 200:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    px[x, y] = (r, g, b, 90)
    bbox = img.getbbox()
    out = img.crop(bbox) if bbox else img
    # downscale to ~900px tall like existing sprites
    if out.height > 900:
        ratio = 900 / out.height
        out = out.resize((max(1, int(out.width * ratio)), 900), Image.NEAREST)
    out.save(dest, 'PNG', optimize=True)
    print(os.path.basename(dest), img.size, '->', out.size)

for n in NAMES:
    src = latest(n)
    if not src:
        print('MISSING', n); continue
    process(src, os.path.join(OUT, n + '.png'))
print('All S3 sprites processed successfully!')
