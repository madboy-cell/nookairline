#!/usr/bin/env python3
import os
import glob
import subprocess
from PIL import Image
from collections import deque

BASE_DIR = '/Users/thanapat/Documents/nookairline'
BRAIN = '/Users/thanapat/.gemini/antigravity-ide/brain/9479a3d2-68d4-4045-bd5c-27c7781093f2'
S10_DIR = os.path.join(BASE_DIR, 'public', 'assets', 's10')
S11_DIR = os.path.join(BASE_DIR, 'public', 'assets', 's11')

PAIRS = [
    # Season 10 (Masquerade)
    ('s10_gondolier_pair', S10_DIR, 's10_gondolier_m', 's10_gondolier_f'),
    ('s10_bauta_pair',     S10_DIR, 's10_bauta_m',     's10_bauta_f'),
    ('s10_harlequin_pair', S10_DIR, 's10_harlequin_m', 's10_harlequin_f'),
    ('s10_doctor_pair',    S10_DIR, 's10_doctor_m',    's10_doctor_f'),
    ('s10_tarot_pair',     S10_DIR, 's10_tarot_m',     's10_tarot_f'),
    ('s10_opera_pair',     S10_DIR, 's10_opera_m',     's10_opera_f'),
    ('s10_clockwork_pair', S10_DIR, 's10_clockwork_m', 's10_clockwork_f'),

    # Season 11 (Olympus)
    ('s11_hoplite_pair',   S11_DIR, 's11_hoplite_m',   's11_hoplite_f'),
    ('s11_oracle_pair',    S11_DIR, 's11_oracle_m',    's11_oracle_f'),
    ('s11_bacchus_pair',   S11_DIR, 's11_bacchus_m',   's11_bacchus_f'),
    ('s11_gladiator_pair', S11_DIR, 's11_gladiator_m', 's11_gladiator_f'),
    ('s11_pegasus_pair',   S11_DIR, 's11_pegasus_m',   's11_pegasus_f'),
    ('s11_hades_pair',     S11_DIR, 's11_hades_m',     's11_persephone_f'),
    ('s11_forge_pair',     S11_DIR, 's11_forge_m',     's11_forge_f'),
]

def find_pair_file(prefix):
    matches = glob.glob(os.path.join(BRAIN, f'{prefix}*.jpg'))
    if not matches:
        matches = glob.glob(os.path.join(BRAIN, f'{prefix}*.png'))
    if matches:
        return sorted(matches, key=os.path.getmtime)[-1]
    return None

def find_split_x(im, thresh=230):
    w, h = im.size
    px = im.load()
    mid_start = int(w * 0.35)
    mid_end = int(w * 0.65)
    
    col_counts = {}
    for x in range(mid_start, mid_end):
        nw = sum(1 for y in range(h) if not (px[x, y][0] >= thresh and px[x, y][1] >= thresh and px[x, y][2] >= thresh))
        col_counts[x] = nw
    
    min_nw = min(col_counts.values())
    min_cols = sorted([x for x, nw in col_counts.items() if nw == min_nw])
    
    # Longest contiguous run of min_nw
    runs = []
    curr = [min_cols[0]]
    for x in min_cols[1:]:
        if x == curr[-1] + 1:
            curr.append(x)
        else:
            runs.append(curr)
            curr = [x]
    runs.append(curr)
    longest = max(runs, key=len)
    return longest[len(longest) // 2]

def clear_outer_borders(im, thresh=232):
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r >= thresh and g >= thresh and b >= thresh

    for x in range(w):
        for y in (0, h - 1):
            idx = y * w + x
            if not seen[idx] and is_bg(x, y):
                seen[idx] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            idx = y * w + x
            if not seen[idx] and is_bg(x, y):
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
                    if is_bg(nx, ny):
                        q.append((nx, ny))
    return cleared

def soften_edges(im, thresh=195, alpha_factor=0.35):
    w, h = im.size
    px = im.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a > 0 and r > thresh and g > thresh and b > thresh:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1))):
                    px[x, y] = (r, g, b, int(a * alpha_factor))

def process_half(cropped_im, dest_path, max_h=900, thresh=232):
    im = cropped_im.convert('RGBA')
    clear_outer_borders(im, thresh=thresh)
    soften_edges(im)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if h > max_h:
        new_w = max(1, int(w * max_h / h))
        im = im.resize((new_w, max_h), Image.Resampling.LANCZOS)
    im.save(dest_path, 'PNG', optimize=True)
    print(f"  -> Saved {os.path.basename(dest_path)} ({im.size[0]}x{im.size[1]})")

def main():
    print("=== Processing S10 & S11 Epics & Rares Cutouts ===")
    os.makedirs(S10_DIR, exist_ok=True)
    os.makedirs(S11_DIR, exist_ok=True)

    for prefix, out_dir, id_m, id_f in PAIRS:
        src = find_pair_file(prefix)
        if not src:
            print(f"❌ Pair file not found for: {prefix}")
            continue
        print(f"\nProcessing {prefix} from {os.path.basename(src)}:")
        im = Image.open(src).convert('RGB')
        w, h = im.size
        split_x = find_split_x(im)
        print(f"  Canvas {w}x{h}, split at x={split_x}")

        # Crop Left (_m) and Right (_f)
        im_m = im.crop((0, 0, split_x, h))
        im_f = im.crop((split_x, 0, w, h))

        path_m = os.path.join(out_dir, f"{id_m}.png")
        path_f = os.path.join(out_dir, f"{id_f}.png")

        process_half(im_m, path_m)
        process_half(im_f, path_f)

    # Rebuild thumbnails using scripts/make_thumbs.js
    thumbs_script = os.path.join(BASE_DIR, 'scripts', 'make_thumbs.js')
    if os.path.exists(thumbs_script):
        print("\n=== Rebuilding synchronized 300px thumbnails ===")
        res = subprocess.run(['node', thumbs_script], capture_output=True, text=True)
        print(res.stdout.strip())
        if res.stderr:
            print("Errors:", res.stderr.strip())

    print("\n✓ Finished all 28 unique S10 & S11 Epic & Rare costume assets!")

if __name__ == '__main__':
    main()
