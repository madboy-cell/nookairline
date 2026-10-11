import os, sys, glob
from PIL import Image
from collections import deque

BRAIN = '/Users/thanapat/.gemini/antigravity-ide/brain/7eadcd4b-bb11-46b6-a5e3-0c1ef98a7b05'
OUT = '/Users/thanapat/Documents/nookairline/public/assets/s2'
os.makedirs(OUT, exist_ok=True)

NAMES = [
    # Mythic (⭐⭐⭐)
    's2_inari_m', 's2_inari_f',
    's2_celestial_m', 's2_celestial_f',
    # Epic (⭐⭐)
    's2_matsuri_m', 's2_matsuri_f',
    's2_lofi_m', 's2_lofi_f',
    's2_taisho_m', 's2_taisho_f',
    's2_cyber_m', 's2_cyber_f',
    # Rare (⭐)
    's2_matcha_m', 's2_matcha_f',
    's2_harajuku_m', 's2_harajuku_f',
    's2_arcade_m', 's2_arcade_f',
    's2_ramen_m', 's2_ramen_f',
    's2_onsen_m', 's2_onsen_f',
    's2_shinkansen_m', 's2_shinkansen_f',
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
print('All S2 sprites processed successfully!')
