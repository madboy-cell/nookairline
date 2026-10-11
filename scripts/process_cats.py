"""Cut the Purrst Class cat sprites out of their flat mint backgrounds.

    python3 scripts/process_cats.py            # all cats + UI pieces
    python3 scripts/process_cats.py c_mochi    # just one id

Source images are generated on a flat pastel mint (#A8E6C8-ish) background. We sample the
corner colour, flood-fill from the borders (also following soft glows / halos that fade out
of the background), then feather the 1–2px rim and un-mix the mint from it so white cats keep
clean edges. Output is cropped + resized to 512px on the long side (cats render at ≤180px).
"""
import os, sys, glob
from collections import deque
from PIL import Image
import numpy as np

BRAINS = [
    '/Users/thanapat/.gemini/antigravity-ide/brain/7eadcd4b-bb11-46b6-a5e3-0c1ef98a7b05',
    '/Users/thanapat/.gemini/antigravity-ide/brain/81f87ca0-515d-41c2-acf5-e0c25787c61e',
]
ROOT = '/Users/thanapat/Documents/nookairline/public/assets'
CATS = os.path.join(ROOT, 'cats')
UI = os.path.join(ROOT, 'ui')
os.makedirs(CATS, exist_ok=True)
os.makedirs(UI, exist_ok=True)

IDS = [
    'c_mochi', 'c_kumo', 'c_patch', 'c_tux', 'c_noir', 'c_yuki', 'c_moo', 'c_toffee',
    'r_siam', 'r_korat', 'r_blue', 'r_persian', 'r_brit', 'r_sphynx', 'r_munch', 'r_birman',
    'e_khao', 'e_mau', 'e_fold', 'e_ragdoll', 'e_coon', 'e_bengal',
    'm_maneki', 'm_moon', 'm_sakura', 'm_nebula', 'm_captain',
]

BG_TOL = 58      # distance to bg colour that is always background
STEP_TOL = 9     # gradient-follow: neighbour this close to an already-bg pixel is bg too
GLOW_MIN_LUM = 150


def latest(prefix):
    files = []
    for b in BRAINS:
        files += glob.glob(os.path.join(b, f'{prefix}_[0-9]*.jpg'))
    files.sort(key=os.path.getmtime)
    return files[-1] if files else None


def cut(src, dest, max_side=512):
    img = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
    h, w, _ = img.shape
    corners = np.array([img[2, 2], img[2, w - 3], img[h - 3, 2], img[h - 3, w - 3]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((img - bg) ** 2).sum(axis=2))
    lum = img.mean(axis=2)
    isbg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dist[y, x] < BG_TOL and not isbg[y, x]:
                isbg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dist[y, x] < BG_TOL and not isbg[y, x]:
                isbg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        cy = img[y, x]
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not isbg[ny, nx]:
                if dist[ny, nx] < BG_TOL or (
                    lum[ny, nx] > GLOW_MIN_LUM and np.abs(img[ny, nx] - cy).max() < STEP_TOL
                ):
                    isbg[ny, nx] = True
                    q.append((ny, nx))

    alpha = np.where(isbg, 0, 255).astype(np.float32)
    # Feather: rim pixels (touching bg) get alpha by how far they are from the bg colour,
    # and have the mint un-mixed from them so no green fringe survives.
    nb = np.zeros_like(isbg)
    nb[1:, :] |= isbg[:-1, :]; nb[:-1, :] |= isbg[1:, :]
    nb[:, 1:] |= isbg[:, :-1]; nb[:, :-1] |= isbg[:, 1:]
    rim = nb & ~isbg
    a = np.clip((dist - 18) / 70.0, 0.25, 1.0)
    alpha[rim] = (a[rim] * 255)
    out = img.astype(np.float32)
    ar = a[..., None]
    unmixed = (out - bg * (1 - ar)) / np.maximum(ar, 1e-3)
    out[rim] = np.clip(unmixed[rim], 0, 255)
    rgba = np.dstack([out, alpha]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    bbox = im.getbbox()
    if bbox:
        pad = 6
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        im = im.crop(bbox)
    s = max_side / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(dest, 'PNG', optimize=True)
    print(os.path.basename(dest), im.size)


def main():
    only = set(sys.argv[1:])
    for cid in IDS:
        if only and cid not in only:
            continue
        for suffix in ('', '_sleep'):
            src = latest(f'cat_{cid}{suffix}')
            if not src:
                if not suffix:
                    print('MISSING', cid)
                continue
            cut(src, os.path.join(CATS, f'{cid}{suffix}.png'))
    if not only:
        for name, out, side in (('kitty_capsule_machine', 'kitty_machine.png', 640),
                                ('icon_cats', 'icon_cats.png', 256)):
            src = latest(name)
            if src:
                cut(src, os.path.join(UI, out), side)
        bg = latest('cat_lounge_bg')
        if bg:
            Image.open(bg).convert('RGB').save(os.path.join(UI, 'cat_lounge_bg.jpg'), 'JPEG', quality=86)
            print('cat_lounge_bg.jpg')


if __name__ == '__main__':
    main()
