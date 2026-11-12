"""KarWand brand asset pipeline: canvas-rendered WebP -> production icon set.

Inputs: %TEMP%/karwand.webp (512x512 squircle, transparent corners),
        %TEMP%/hich.webp   (1200x360 transparent lockup).
Outputs:
  public/karwand-logo.png            (512 master)
  public/karwand-logo.ico            (16/32/48/64/128/256)
  src-tauri/icons/icon.ico           (same multi-size ICO -> installer + shortcuts)
  public/pwa-192x192.png, public/pwa-512x512.png          (purpose any)
  public/pwa-maskable-512x512.png    (full-bleed obsidian, safe-zone content)
  public/apple-touch-icon.png        (180, full-bleed)
  public/100hich-logo.png + public/tenants/100hich/logo.png (header lockup)
"""
import os
import sys
from PIL import Image

PUB = r'C:\Projects\KarWand-SmartOrders\public'
TAURI = r'C:\Projects\KarWand-SmartOrders\src-tauri\icons'
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

def main() -> None:
    tmp = os.environ['TEMP']

    # ---- KarWand app icon ----
    kw = Image.open(os.path.join(tmp, 'karwand.webp')).convert('RGBA')
    bbox = kw.getbbox()
    if bbox:
        kw = kw.crop(bbox)
    side = max(kw.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(kw, ((side - kw.width) // 2, (side - kw.height) // 2))
    kw512 = square.resize((512, 512), Image.LANCZOS)

    kw512.save(os.path.join(PUB, 'karwand-logo.png'))
    kw512.save(os.path.join(PUB, 'karwand-logo.ico'), format='ICO', sizes=ICO_SIZES)
    kw512.save(os.path.join(TAURI, 'icon.ico'), format='ICO', sizes=ICO_SIZES)

    kw512.resize((192, 192), Image.LANCZOS).save(os.path.join(PUB, 'pwa-192x192.png'))
    kw512.save(os.path.join(PUB, 'pwa-512x512.png'))

    # Maskable: full-bleed obsidian canvas, content inside the 80% safe zone
    mask = Image.new('RGBA', (512, 512), (10, 13, 17, 255))
    content = kw512.resize((400, 400), Image.LANCZOS)
    mask.paste(content, (56, 56), content)
    mask.convert('RGB').save(os.path.join(PUB, 'pwa-maskable-512x512.png'))

    # Apple touch icon: 180px full-bleed
    apple = Image.new('RGBA', (180, 180), (10, 13, 17, 255))
    apple_content = kw512.resize((144, 144), Image.LANCZOS)
    apple.paste(apple_content, (18, 18), apple_content)
    apple.convert('RGB').save(os.path.join(PUB, 'apple-touch-icon.png'))

    # ---- 100 HICH header lockup ----
    hich = Image.open(os.path.join(tmp, 'hich.webp')).convert('RGBA')
    hb = hich.getbbox()
    if hb:
        hich = hich.crop(hb)
    hich.save(os.path.join(PUB, '100hich-logo.png'))
    hich.save(os.path.join(PUB, 'tenants', '100hich', 'logo.png'))

    print('OK karwand:', kw512.size, '| hich:', hich.size)
    for f in ['karwand-logo.png', 'karwand-logo.ico', 'pwa-192x192.png', 'pwa-512x512.png',
              'pwa-maskable-512x512.png', 'apple-touch-icon.png', '100hich-logo.png',
              os.path.join('tenants', '100hich', 'logo.png')]:
        p = os.path.join(PUB, f)
        print(f'{f}: {os.path.getsize(p)} bytes')
    print('src-tauri icon.ico:', os.path.getsize(os.path.join(TAURI, 'icon.ico')), 'bytes')

if __name__ == '__main__':
    main()
