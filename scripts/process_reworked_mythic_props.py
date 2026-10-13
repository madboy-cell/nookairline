#!/usr/bin/env python3
import os
import sys
from PIL import Image
from collections import deque

BRAIN_DIR = '/Users/thanapat/.gemini/antigravity-ide/brain/229ec348-f740-4db5-90d3-83f250fd3cbd'
ASSETS_DIR = '/Users/thanapat/Documents/nookairline/public/assets'

ITEMS = [
    # S1
    ('naga_emerald_crest_1791886076195.jpg', 's1', 'naga_emerald_crest.png', 238),
    ('mekong_water_surge_1791886095406.jpg', 's1', 'mekong_water_surge.png', 238),
    # S2
    ('inari_torii_gate_1791886114535.jpg', 's2', 'inari_torii_gate.png', 235),
    ('foxfire_crests_1791886134041.jpg', 's2', 'foxfire_crests.png', 238),
    ('eclipse_moon_disk_1791886157539.jpg', 's2', 'eclipse_moon_disk.png', 238),
    ('eclipse_void_rift_1791886181730.jpg', 's2', 'eclipse_void_rift.png', 238),
    # S3
    ('djinn_cosmic_lamp_1791886204089.jpg', 's3', 'djinn_cosmic_lamp.png', 238),
    ('mirage_oasis_portal_1791886268465.jpg', 's3', 'mirage_oasis_portal.png', 238),
    ('phoenix_sunfire_crest_1791886295820.jpg', 's3', 'phoenix_sunfire_crest.png', 238),
    ('phoenix_molten_crater_1791886321562.jpg', 's3', 'phoenix_molten_crater.png', 238),
    # S5
    ('atlantis_trident_prop_1791886347098.jpg', 's5', 'atlantis_trident_prop.png', 238),
    ('abyssal_coral_reef_1791886367630.jpg', 's5', 'abyssal_coral_reef.png', 238),
]

def cutout_image(src_path, dst_path, thresh=236):
    im = Image.open(src_path).convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    def is_white(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r >= thresh and g >= thresh and b >= thresh

    # Seed outer border
    for x in range(w):
        for y in (0, h - 1):
            idx = y * w + x
            if not seen[idx] and is_white(x, y):
                seen[idx] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            idx = y * w + x
            if not seen[idx] and is_white(x, y):
                seen[idx] = 1
                q.append((x, y))

    cleared = 0
    while q:
        cx, cy = q.popleft()
        px[cx, cy] = (0, 0, 0, 0)
        cleared += 1
        for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not seen[nidx]:
                    seen[nidx] = 1
                    if is_white(nx, ny):
                        q.append((nx, ny))

    # Anti-alias 1px outer fringe
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a > 0 and r > 200 and g > 200 and b > 200:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1))):
                    dist_to_white = min(255 - r, 255 - g, 255 - b)
                    new_a = int(a * (dist_to_white / 55.0))
                    px[x, y] = (r, g, b, max(0, min(a, new_a)))

    # Auto crop to bounding box
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    # Resize if too large (max 720px for high-res crispness)
    max_dim = 720
    if im.width > max_dim or im.height > max_dim:
        im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    im.save(dst_path, format='PNG', optimize=True)
    print(f"Processed: {os.path.basename(dst_path)} -> {im.size} (cleared {cleared} bg px)")

def main():
    print("=== Processing 12 Reworked Mythic Props and Tile Effects ===")
    for src_name, season, dst_name, thresh in ITEMS:
        src = os.path.join(BRAIN_DIR, src_name)
        dst = os.path.join(ASSETS_DIR, season, dst_name)
        cutout_image(src, dst, thresh=thresh)
    print("=== Done Processing All Assets ===")

if __name__ == '__main__':
    main()
