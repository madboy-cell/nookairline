import os, sys, glob
from PIL import Image
from collections import deque

BRAINS = [
    '/Users/thanapat/.gemini/antigravity-ide/brain/77818951-cd14-49ee-864e-8fa3280db5fd',
    '/Users/thanapat/.gemini/antigravity-ide/brain/81f87ca0-515d-41c2-acf5-e0c25787c61e'
]
OUT = '/Users/thanapat/Documents/nookairline/public/assets/s5'
os.makedirs(OUT, exist_ok=True)

NAMES = [
    # Mythic (⭐⭐⭐)
    's5_emperor_m', 's5_siren_f',
    's5_leviathan_m', 's5_jellyfish_f',
    # Epic (⭐⭐)
    's5_nautilus_m', 's5_nautilus_f',
    's5_manta_m', 's5_manta_f',
    's5_corsair_m', 's5_corsair_f',
    's5_coral_m', 's5_coral_f',
    # Rare (⭐)
    's5_diver_m', 's5_diver_f',
    's5_aquanaut_m', 's5_aquanaut_f',
    's5_angler_m', 's5_angler_f',
    's5_seahorse_m', 's5_seahorse_f',
    's5_triton_m', 's5_triton_f',
    's5_tide_m', 's5_tide_f',
]
THRESH = 232

def latest(name):
    all_files = []
    for brain in BRAINS:
        if os.path.exists(brain):
            all_files.extend(glob.glob(os.path.join(brain, f'{name}_*.jpg')))
            all_files.extend(glob.glob(os.path.join(brain, f'{name}.jpg')))
    if not all_files:
        return None
    return sorted(all_files, key=os.path.getmtime)[-1]

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
    # soften 1px halo
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a and r > 200 and g > 200 and b > 200:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    px[x, y] = (r, g, b, 90)
    bbox = img.getbbox()
    out = img.crop(bbox) if bbox else img
    if out.height > 900:
        ratio = 900 / out.height
        out = out.resize((max(1, int(out.width * ratio)), 900), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS)
    out.save(dest, 'PNG', optimize=True)
    print(os.path.basename(dest), img.size, '->', out.size)

for n in NAMES:
    src = latest(n)
    dest = os.path.join(OUT, n + '.png')
    if not src:
        print(f'WARNING: missing source for {n}')
        continue
    if not os.path.exists(dest) or os.path.getmtime(src) > os.path.getmtime(dest):
        process(src, dest)
print('Done processing all S5 sprites.')
