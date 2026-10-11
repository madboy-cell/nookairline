import os
from PIL import Image
from collections import deque

DIRS = [
    '/Users/thanapat/Documents/nookairline/public/assets/s10',
    '/Users/thanapat/Documents/nookairline/public/assets/s11'
]

THRESH = 238

def process_file(filepath):
    print(f"Processing: {filepath}")
    img = Image.open(filepath).convert('RGBA')
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()

    def is_white_bg(x, y):
        r, g, b, _ = px[x, y]
        return r >= THRESH and g >= THRESH and b >= THRESH

    # Edge seeds from all four borders
    for x in range(w):
        for y in (0, h - 1):
            idx = y * w + x
            if not seen[idx] and is_white_bg(x, y):
                seen[idx] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            idx = y * w + x
            if not seen[idx] and is_white_bg(x, y):
                seen[idx] = 1
                q.append((x, y))

    # Flood fill outer white area
    cleared = 0
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        cleared += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not seen[nidx]:
                    seen[nidx] = 1
                    if is_white_bg(nx, ny):
                        q.append((nx, ny))

    # Soften 1px boundary halos
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a > 0 and r > 200 and g > 200 and b > 200:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    px[x, y] = (r, g, b, int(a * 0.35))

    bbox = img.getbbox()
    out = img.crop(bbox) if bbox else img
    if out.height > 900:
        ratio = 900 / out.height
        out = out.resize((max(1, int(out.width * ratio)), 900), Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS)

    out.save(filepath, 'PNG', optimize=True)
    print(f"  ✓ Saved {os.path.basename(filepath)}: cleared {cleared}px ({cleared/(w*h)*100:.1f}%), size {out.size}")

def main():
    total = 0
    for d in DIRS:
        if not os.path.exists(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'):
                p = os.path.join(d, f)
                process_file(p)
                total += 1
    print(f"\nDone! Processed {total} files across Season 10 and Season 11.")

if __name__ == '__main__':
    main()
