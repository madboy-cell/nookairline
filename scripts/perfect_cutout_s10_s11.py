import os, shutil
from PIL import Image
from collections import deque

BRAIN = '/Users/thanapat/.gemini/antigravity-ide/brain/9479a3d2-68d4-4045-bd5c-27c7781093f2'
S10_DIR = '/Users/thanapat/Documents/nookairline/public/assets/s10'
S11_DIR = '/Users/thanapat/Documents/nookairline/public/assets/s11'

def clear_pockets(src_img_path, seeds, thresh=234):
    """
    Given an already bordered-cleared RGBA image, flood fills specific enclosed white/near-white
    background pockets without touching character clothing, eyes, or hair.
    """
    im = Image.open(src_img_path).convert('RGBA')
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
                    nr, ng, nb, na = px[nx, ny]
                    if na > 0 and nr >= thresh and ng >= thresh and nb >= thresh:
                        q.append((nx, ny))

    # Soften 1px boundary halos on newly cleared edges
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a > 0 and r > 195 and g > 195 and b > 195:
                if any(px[nx, ny][3] == 0 for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1))):
                    px[x, y] = (r, g, b, int(a * 0.35))

    return im, cleared

def main():
    print("=== Processing S10 and S11 Sprite Enclosed Backgrounds ===")

    # 1. S10 Phantom Wolf Maestro
    phantom_m_path = os.path.join(S10_DIR, 's10_phantom_m.png')
    im_phantom_m, c1 = clear_pockets(
        phantom_m_path,
        seeds=[(124, 473), (117, 280), (120, 255)],
        thresh=234
    )
    im_phantom_m.save(phantom_m_path, 'PNG', optimize=True)
    print(f"✓ s10_phantom_m.png: cleared {c1} trapped background pixels")

    # Copy to male peers in S10
    for peer in ['s10_bauta_m.png', 's10_doctor_m.png', 's10_opera_m.png']:
        shutil.copy2(phantom_m_path, os.path.join(S10_DIR, peer))
        print(f"  -> Synced to {peer}")

    # 2. S10 Clockwork & Tarot Maestro
    clockwork_m_path = os.path.join(S10_DIR, 's10_clockwork_m.png')
    im_clockwork_m, c2 = clear_pockets(
        clockwork_m_path,
        seeds=[
            (120, 433), (244, 310), (577, 356), (209, 418),
            (450, 381), (437, 408), (235, 388), (50, 440), (600, 380)
        ],
        thresh=234
    )
    im_clockwork_m.save(clockwork_m_path, 'PNG', optimize=True)
    print(f"✓ s10_clockwork_m.png: cleared {c2} trapped background pixels")

    # Copy to tarot and peers in S10
    for peer in ['s10_gondolier_m.png', 's10_harlequin_m.png', 's10_tarot_m.png']:
        shutil.copy2(clockwork_m_path, os.path.join(S10_DIR, peer))
        print(f"  -> Synced to {peer}")

    # 3. S10 Black Swan Dragon Empress (all females)
    phantom_f_path = os.path.join(S10_DIR, 's10_phantom_f.png')
    for peer in ['s10_bauta_f.png', 's10_clockwork_f.png', 's10_doctor_f.png',
                 's10_gondolier_f.png', 's10_harlequin_f.png', 's10_opera_f.png', 's10_tarot_f.png']:
        shutil.copy2(phantom_f_path, os.path.join(S10_DIR, peer))
        print(f"  -> Synced to {peer}")

    # 4. S10 Venetian Harlequin Mask
    mask_path = os.path.join(S10_DIR, 'venetian_mask.png')
    im_mask, c_mask = clear_pockets(
        mask_path,
        seeds=[(675, 560), (425, 110)],
        thresh=234
    )
    im_mask.save(mask_path, 'PNG', optimize=True)
    print(f"✓ venetian_mask.png: cleared {c_mask} trapped background pixels")

    # 5. S11 Thunder Wolf Sovereign Zeus
    zeus_m_path = os.path.join(S11_DIR, 's11_zeus_m.png')
    im_zeus_m, c3 = clear_pockets(
        zeus_m_path,
        seeds=[(352, 657), (95, 405)],
        thresh=234
    )
    im_zeus_m.save(zeus_m_path, 'PNG', optimize=True)
    print(f"✓ s11_zeus_m.png: cleared {c3} trapped background pixels (between legs & inside lightning)")

    # Copy to male peers in S11
    for peer in ['s11_bacchus_m.png', 's11_forge_m.png', 's11_hades_m.png']:
        shutil.copy2(zeus_m_path, os.path.join(S11_DIR, peer))
        print(f"  -> Synced to {peer}")

    # 6. S11 Aegis Goddess Athena (all females)
    athena_f_path = os.path.join(S11_DIR, 's11_athena_f.png')
    im_athena_f, c4 = clear_pockets(
        athena_f_path,
        seeds=[(483, 745), (361, 746), (225, 716)],
        thresh=234
    )
    im_athena_f.save(athena_f_path, 'PNG', optimize=True)
    print(f"✓ s11_athena_f.png: cleared {c4} trapped background pixels (dress gap & foot gap)")

    for peer in ['s11_bacchus_f.png', 's11_forge_f.png', 's11_gladiator_f.png',
                 's11_hoplite_f.png', 's11_oracle_f.png', 's11_pegasus_f.png', 's11_persephone_f.png']:
        shutil.copy2(athena_f_path, os.path.join(S11_DIR, peer))
        print(f"  -> Synced to {peer}")

    # 7. S11 Pegasus Aviator / Gladiator
    gladiator_m_path = os.path.join(S11_DIR, 's11_gladiator_m.png')
    for peer in ['s11_hoplite_m.png', 's11_oracle_m.png', 's11_pegasus_m.png']:
        shutil.copy2(gladiator_m_path, os.path.join(S11_DIR, peer))
        print(f"  -> Synced to {peer}")

    # 8. S11 Mount Olympus Temple
    temple_path = os.path.join(S11_DIR, 'olympus_temple.png')
    im_temple, c_temple = clear_pockets(
        temple_path,
        seeds=[(185, 530), (760, 120)],
        thresh=234
    )
    im_temple.save(temple_path, 'PNG', optimize=True)
    print(f"✓ olympus_temple.png: cleared {c_temple} trapped background pixels (between pillars)")

    print("\nAll sprites and monuments cleaned successfully!")

if __name__ == '__main__':
    main()
