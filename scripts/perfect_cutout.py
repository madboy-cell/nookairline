#!/usr/bin/env python3
"""
Nook Airline — Universal Sprite Cutout & Pocket Removal Pipeline
================================================================
Processes character sprites and monuments to guarantee 100% transparent cutouts:
1. Outer 4-border flood fill (removes exterior white canvas).
2. Interior pocket flood fill (clears enclosed negative spaces in closed pose loops:
   between separated legs/sandals, inside weapon/staff/lightning curves, between ribbons/capes/tails).
3. 1px anti-aliased edge softening (removes harsh white pixelated contours).
4. Tight bounding box auto-crop (img.getbbox()) and clamped scaling to max-height 900px.
5. Automatic invocation of scripts/make_thumbs.js to build 300px transparent card thumbnails.

Usage:
  python3 scripts/perfect_cutout.py --file public/assets/s10/s10_phantom_m.png --seeds 124,473 117,280
  python3 scripts/perfect_cutout.py --season s10
  python3 scripts/perfect_cutout.py --season s11
  python3 scripts/perfect_cutout.py --all-recent
"""

import os
import sys
import argparse
import subprocess
from PIL import Image
from collections import deque

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, 'public', 'assets')

def clear_outer_borders(im, thresh=234):
    """
    Flood fills from all 4 image borders to remove outer white/near-white canvas.
    """
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r >= thresh and g >= thresh and b >= thresh

    # Seed all 4 outer borders
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

def clear_pockets(im, seeds, thresh=234):
    """
    Given an already bordered-cleared RGBA image, flood fills specific enclosed white/near-white
    background pockets without touching character clothing, eyes, or hair.
    """
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    for x, y in seeds:
        if 0 <= x < w and 0 <= y < h:
            r, g, b, a = px[x, y]
            if a > 0 and r >= thresh and g >= thresh and b >= thresh:
                idx = y * w + x
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
                    r, g, b, a = px[nx, ny]
                    if a > 0 and r >= thresh and g >= thresh and b >= thresh:
                        q.append((nx, ny))
    return cleared

def soften_edges(im, thresh=195, alpha_factor=0.35):
    """
    Applies 1px anti-aliased edge softening on remaining boundary pixels to eliminate
    harsh white pixelation or jagged halos.
    """
    w, h = im.size
    px = im.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a > 0 and r > thresh and g > thresh and b > thresh:
                # If adjacent to transparent pixel, soften alpha
                if any(px[nx, ny][3] == 0 for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1))):
                    px[x, y] = (r, g, b, int(a * alpha_factor))

def crop_and_clamp(im, max_h=900):
    """
    Tightly auto-crops to bounding box and clamps height to max_h.
    """
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if h > max_h:
        new_w = max(1, int(w * max_h / h))
        im = im.resize((new_w, max_h), Image.Resampling.LANCZOS)
    return im

def rebuild_thumbnails():
    """
    Invokes scripts/make_thumbs.js to keep public/assets/thumbs/ synchronized.
    """
    script_path = os.path.join(BASE_DIR, 'scripts', 'make_thumbs.js')
    if os.path.exists(script_path):
        print("\n🔄 Rebuilding 300px transparent thumbnails with scripts/make_thumbs.js...")
        res = subprocess.run(['node', script_path], capture_output=True, text=True)
        print(res.stdout.strip())
        if res.stderr:
            print(f"Warnings: {res.stderr.strip()}")

def process_file(file_path, seeds=None, thresh=234, max_h=900):
    """
    Executes the full 4-stage cutout pipeline on a single file.
    """
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return 0, 0
    im = Image.open(file_path).convert('RGBA')
    c_outer = clear_outer_borders(im, thresh=thresh)
    c_pockets = 0
    if seeds:
        c_pockets = clear_pockets(im, seeds, thresh=thresh)
    soften_edges(im)
    im = crop_and_clamp(im, max_h=max_h)
    im.save(file_path, 'PNG', optimize=True)
    print(f"✓ {os.path.basename(file_path)}: outer cleared {c_outer} px, pockets cleared {c_pockets} px, final size {im.size}")
    return c_outer, c_pockets

def run_s10_pipeline():
    s10_dir = os.path.join(ASSETS_DIR, 's10')
    print("=== Running Season 10 Pocket-Clearing Cutout Pipeline ===")
    
    # Mythics
    process_file(os.path.join(s10_dir, 's10_phantom_m.png'), seeds=[(504, 313), (146, 339)])
    process_file(os.path.join(s10_dir, 's10_phantom_f.png'), seeds=[(335, 450), (201, 429), (244, 353)])
    process_file(os.path.join(s10_dir, 'venetian_mask.png'), seeds=[(675, 560), (425, 110)])

    # Unique Epics & Rares
    s10_seeds = {
        's10_bauta_f.png': [(67, 329), (104, 361)],
        's10_bauta_m.png': [(318, 289), (346, 307)],
        's10_clockwork_f.png': [(264, 409), (270, 345), (245, 295), (299, 340), (316, 407), (313, 239)],
        's10_clockwork_m.png': [(202, 444)],
        's10_doctor_f.png': [(283, 281), (83, 288)],
        's10_doctor_m.png': [],
        's10_gondolier_f.png': [(264, 514), (211, 527), (184, 476), (214, 454), (87, 585), (167, 444), (350, 302), (43, 312)],
        's10_gondolier_m.png': [(259, 421), (276, 393), (191, 448), (131, 386), (140, 365), (214, 281), (150, 347), (181, 397)],
        's10_harlequin_f.png': [(217, 308), (298, 391), (319, 285), (463, 237), (72, 225)],
        's10_harlequin_m.png': [(229, 282), (174, 429), (382, 358), (175, 313), (198, 319), (281, 325), (257, 328)],
        's10_opera_f.png': [(279, 439)],
        's10_opera_m.png': [(186, 432), (317, 456)],
        's10_tarot_f.png': [(119, 337), (409, 577), (403, 331)],
        's10_tarot_m.png': [(312, 498), (251, 399), (372, 396), (377, 89)],
    }
    for fname, seeds in s10_seeds.items():
        th = 228 if 'tarot' in fname else 232
        process_file(os.path.join(s10_dir, fname), seeds=seeds, thresh=th)

def run_s11_pipeline():
    s11_dir = os.path.join(ASSETS_DIR, 's11')
    print("=== Running Season 11 Pocket-Clearing Cutout Pipeline ===")

    # Mythics
    process_file(os.path.join(s11_dir, 's11_zeus_m.png'), seeds=[(378, 147), (366, 185), (429, 501)])
    process_file(os.path.join(s11_dir, 's11_athena_f.png'), seeds=[(196, 327)])
    process_file(os.path.join(s11_dir, 'olympus_temple.png'), seeds=[(185, 530), (760, 120)])

    # Unique Epics & Rares
    s11_seeds = {
        's11_bacchus_f.png': [(120, 406), (396, 301), (346, 458), (78, 262), (145, 322)],
        's11_bacchus_m.png': [(218, 255)],
        's11_forge_f.png': [(302, 426)],
        's11_forge_m.png': [(252, 289), (271, 408), (406, 399)],
        's11_gladiator_f.png': [(243, 601), (330, 613), (455, 233), (307, 451), (180, 507)],
        's11_gladiator_m.png': [(154, 451), (133, 546), (170, 256), (215, 311), (302, 265)],
        's11_hades_m.png': [(382, 483)],
        's11_hoplite_f.png': [(252, 405), (229, 602), (275, 565), (221, 363), (224, 476), (205, 493), (207, 567)],
        's11_hoplite_m.png': [(357, 345)],
        's11_oracle_f.png': [(346, 573)],
        's11_oracle_m.png': [(210, 545)],
        's11_pegasus_f.png': [(291, 604), (190, 342), (436, 610)],
        's11_pegasus_m.png': [(431, 141), (428, 178), (274, 365)],
        's11_persephone_f.png': [(294, 554), (366, 322)],
    }
    for fname, seeds in s11_seeds.items():
        process_file(os.path.join(s11_dir, fname), seeds=seeds, thresh=232)

def main():
    parser = argparse.ArgumentParser(description="Nook Airline — Universal Sprite Cutout & Pocket Removal Pipeline")
    parser.add_argument('--file', type=str, help="Path to single sprite PNG to process")
    parser.add_argument('--seeds', type=str, nargs='*', help="Internal pocket seed coordinates (e.g. 124,473 117,280)")
    parser.add_argument('--season', type=str, choices=['s10', 's11', 'all'], help="Preset season to run full pocket pipeline on")
    parser.add_argument('--all-recent', action='store_true', help="Run pocket pipeline on both Season 10 and 11")
    parser.add_argument('--thresh', type=int, default=234, help="Background white color threshold (default: 234)")
    args = parser.parse_args()

    if args.file:
        seeds = []
        if args.seeds:
            for s in args.seeds:
                parts = s.split(',')
                if len(parts) == 2:
                    seeds.append((int(parts[0]), int(parts[1])))
        process_file(args.file, seeds=seeds, thresh=args.thresh)
        rebuild_thumbnails()
    elif args.season == 's10':
        run_s10_pipeline()
        rebuild_thumbnails()
    elif args.season == 's11':
        run_s11_pipeline()
        rebuild_thumbnails()
    elif args.season == 'all' or args.all_recent:
        run_s10_pipeline()
        run_s11_pipeline()
        rebuild_thumbnails()
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
