"""KarWand — EXTRACT-BASED icon deployment (mission: use image_7.png exactly).

Source: .zwork/attachments/.../4fdcff68-...webp (1024x765 RGB) — the definitive
multilayered K/کاروند monogram with gold lip on a textured squircle.

No synthesis: the tile is located by luminance delta from the canvas background,
square-cropped, its outside-canvas corners made transparent via border-connected
flood fill, and every system target is produced by lossless (LANCZOS) scaling.

Targets:
  public/karwand-logo.png            512x512 master
  public/karwand-logo.ico            16,24,32,48,64,128,256
  src-tauri/icons/icon.ico           same sizes (Tauri/back-compat)
  public/pwa-192x192.png             192 (purpose any)
  public/pwa-512x512.png             512 (purpose any)
  public/pwa-maskable-512x512.png    full-bleed obsidian + tile at 76% safe zone
  public/apple-touch-icon.png        180 full-bleed
"""
import os
from PIL import Image, ImageChops, ImageDraw

SRC = r'C:\Projects\KarWand-SmartOrders\.zwork\attachments\9970ec7a-d4c5-4702-b09c-a7a7c51a335c\4fdcff68-e41e-4c09-972e-793e9220e1cd.webp'
PUB = r'C:\Projects\KarWand-SmartOrders\public'
TAURI = r'C:\Projects\KarWand-SmartOrders\src-tauri\icons'
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
OBSIDIAN = (10, 13, 17, 255)

def corner_bg_color(im: Image.Image) -> tuple:
    px = im.load()
    w, h = im.size
    samples = []
    for (cx, cy) in [(3, 3), (w - 4, 3), (3, h - 4), (w - 4, h - 4)]:
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                samples.append(px[cx + dx, cy + dy])
    rs = sorted(s[0] for s in samples)
    gs = sorted(s[1] for s in samples)
    bs = sorted(s[2] for s in samples)
    mid = len(samples) // 2
    return (rs[mid], gs[mid], bs[mid])

def main() -> None:
    im = Image.open(SRC).convert('RGB')
    bg = corner_bg_color(im)

    # 1. Locate the squircle tile: luminance delta from the flat canvas color
    diff = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L')
    bbox = diff.point(lambda p: 255 if p > 16 else 0).getbbox()
    if not bbox:
        raise SystemExit('Tile bbox not found')

    # 2. Square crop centered on the tile (canvas margin retained for flood-fill)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    side = max(bw, bh) + 12
    cx, cy = (bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2
    left = max(0, min(cx - side // 2, im.width - side))
    top = max(0, min(cy - side // 2, im.height - side))
    crop = im.crop((left, top, left + side, top + side))

    # 3. Border-connected flood fill from the 4 corners -> outside-canvas only
    sentinel = (255, 0, 255)
    ff = crop.copy()
    for seed in [(0, 0), (side - 1, 0), (0, side - 1), (side - 1, side - 1)]:
        ImageDraw.floodfill(ff, seed, sentinel, thresh=14)

    # 4. Sentinel -> transparent alpha
    rgba = ff.convert('RGBA')
    data = list(rgba.getdata())
    cleared = 0
    out = []
    for (r, g, b, a) in data:
        if (r, g, b) == sentinel:
            out.append((0, 0, 0, 0))
            cleared += 1
        else:
            out.append((r, g, b, 255))
    rgba.putdata(out)
    tile_bbox = rgba.getbbox()
    rgba = rgba.crop(tile_bbox)

    # 5. Square master 512
    side = max(rgba.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))
    master = square.resize((512, 512), Image.LANCZOS)

    master.save(os.path.join(PUB, 'karwand-logo.png'))
    master.save(os.path.join(PUB, 'karwand-logo.ico'), format='ICO', sizes=ICO_SIZES)
    master.save(os.path.join(TAURI, 'icon.ico'), format='ICO', sizes=ICO_SIZES)
    master.resize((192, 192), Image.LANCZOS).save(os.path.join(PUB, 'pwa-192x192.png'))
    master.save(os.path.join(PUB, 'pwa-512x512.png'))

    # Maskable: full-bleed obsidian, tile inside the 80% safe zone
    mask = Image.new('RGBA', (512, 512), OBSIDIAN)
    content = master.resize((388, 388), Image.LANCZOS)
    mask.paste(content, (62, 62), content)
    mask.convert('RGB').save(os.path.join(PUB, 'pwa-maskable-512x512.png'))

    # Apple touch: 180 full-bleed
    apple = Image.new('RGBA', (180, 180), OBSIDIAN)
    ac = master.resize((140, 140), Image.LANCZOS)
    apple.paste(ac, (20, 20), ac)
    apple.convert('RGB').save(os.path.join(PUB, 'apple-touch-icon.png'))

    print('tile bbox:', bbox, '| cleared corners px:', cleared)
    for f in ['karwand-logo.png', 'karwand-logo.ico', 'pwa-192x192.png', 'pwa-512x512.png',
              'pwa-maskable-512x512.png', 'apple-touch-icon.png']:
        p = os.path.join(PUB, f)
        print(f'{f}: {os.path.getsize(p)} bytes')
    print('src-tauri icon.ico:', os.path.getsize(os.path.join(TAURI, 'icon.ico')), 'bytes')

if __name__ == '__main__':
    main()
