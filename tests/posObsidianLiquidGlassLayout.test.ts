/**
 * POS Obsidian Liquid Glass Layout & Catalog Hierarchy Test Suite
 * Directives: KW-DIR-ALPHA-2026-11-10-023 & KW-DIR-ALPHA-2026-11-10-024
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { getItemPriorityRank } from '../src/components/PosView';
import { MenuItem } from '../src/types/domain';
import { getProductWallpaper, WALLPAPER_PRESETS } from '../src/utils/productWallpapers';

describe('POS Obsidian Liquid Glass Layout & Wallpapers (KW-DIR-ALPHA-2026-11-10-023 & 024)', () => {
  const rootDir = process.cwd();
  const posMainLayoutPath = path.join(rootDir, 'src', 'components', 'pos', 'PosMainLayout.tsx');
  const posCartPanelPath = path.join(rootDir, 'src', 'components', 'pos', 'PosCartPanel.tsx');
  const posViewPath = path.join(rootDir, 'src', 'components', 'PosView.tsx');
  const catalogCardPath = path.join(rootDir, 'src', 'components', 'CatalogCard.tsx');
  const wallpaperUtilPath = path.join(rootDir, 'src', 'utils', 'productWallpapers.ts');

  it('1. PosMainLayout component exists and implements Obsidian palette and fixed left geometry', () => {
    assert.ok(fs.existsSync(posMainLayoutPath), 'PosMainLayout.tsx must exist');
    const content = fs.readFileSync(posMainLayoutPath, 'utf8');

    // Obsidian base palette
    assert.ok(content.includes('#0B0E14'), 'PosMainLayout must specify base Obsidian #0B0E14');

    // Cart column fixed geometry w-[330px]
    assert.ok(content.includes('w-[330px]'), 'PosMainLayout must pin cart width to w-[330px]');
    assert.ok(content.includes('top-[72px]'), 'PosMainLayout must pin cart top to top-[72px]');
    assert.ok(content.includes('h-[calc(100vh-90px)]'), 'PosMainLayout must pin cart height to h-[calc(100vh-90px)]');

    // Left pinning in RTL/LTR
    assert.ok(content.includes('order-1 rtl:order-2 ltr:order-1'), 'Cart must be pinned to physical left in both viewports');
    assert.ok(content.includes('flex flex-row'), 'PosMainLayout must enforce permanent side-by-side flex-row layout');
    assert.ok(!content.includes('hidden xl:flex'), 'Cart column must not be hidden on non-desktop viewports');
  });

  it('2. PosCartPanel implements Liquid Glass, centered 100 HICH badge above title, and Crimson CTA', () => {
    assert.ok(fs.existsSync(posCartPanelPath), 'PosCartPanel.tsx must exist');
    const content = fs.readFileSync(posCartPanelPath, 'utf8');

    // Liquid Glass styling
    assert.ok(content.includes('rgba(20,25,36,0.72)'), 'PosCartPanel must use translucent liquid glass rgba(20,25,36,0.72)');
    assert.ok(content.includes('backdrop-blur-[28px]'), 'PosCartPanel must apply backdrop-blur-[28px]');
    assert.ok(content.includes('border-white/10'), 'PosCartPanel must apply border-white/10 hairline');

    // 100 HICH Brand Badge centered strictly above title
    assert.ok(content.includes('100 HICH'), 'PosCartPanel must contain 100 HICH badge text');
    assert.ok(content.includes('dir="ltr"'), 'Brand badge must enforce strict LTR orientation');
    assert.ok(content.includes('#071C3D'), 'Brand badge must use solid navy fill #071C3D');
    assert.ok(content.includes('border-2 border-white'), 'Brand badge must use crisp 2px border-white');
    assert.ok(content.includes('rounded-full'), 'Brand badge must have clean capsule/pill dimensions');

    // Verify badge appears above the live title
    const badgeIdx = content.indexOf('100 HICH');
    const titleIdx = content.indexOf('سفارش جاری بار');
    assert.ok(badgeIdx < titleIdx, '100 HICH badge must be strictly positioned above the order title');

    // Primary action button
    assert.ok(content.includes('ثبت و پرداخت'), 'Primary action button must be labeled "ثبت و پرداخت"');
    assert.ok(content.includes('#D71921'), 'Primary action button must use high-contrast Crimson Red #D71921');
    assert.ok(content.includes('CreditCard'), 'Primary action button must include CreditCard icon');
  });

  it('3. PosView consumes PosMainLayout, PosCartPanel, and pins search input to w-[330px]', () => {
    assert.ok(fs.existsSync(posViewPath), 'PosView.tsx must exist');
    const content = fs.readFileSync(posViewPath, 'utf8');

    assert.ok(content.includes("from './pos'"), 'PosView must import PosMainLayout and PosCartPanel from ./pos');
    assert.ok(content.includes('<PosMainLayout'), 'PosView must render PosMainLayout');
    assert.ok(content.includes('<PosCartPanel'), 'PosView must render PosCartPanel');

    // Pinned search box width w-[330px]
    assert.ok(content.includes('w-[330px] min-w-[330px] max-w-[330px]'), 'Search box must match cart column width w-[330px]');
  });

  it('4. Catalog hierarchy sorts Espresso -> Americano -> Flat White -> Cold Brew -> Latte -> Croissant', () => {
    const mockItems: Partial<MenuItem>[] = [
      { id: 'item-bakery-croissant', nameFa: 'کروسان فرانسوی کره‌ای', categoryId: 'cat-bakery', isAvailable: true },
      { id: 'item-lat-50', nameFa: 'لاته (۵۰/۵۰)', categoryId: 'cat-espresso', isAvailable: true },
      { id: 'item-ice-ame-50', nameFa: 'آیس آمریکانو (۵۰/۵۰)', categoryId: 'cat-iced', isAvailable: true },
      { id: 'item-flw-50', nameFa: 'فلت وایت (۵۰/۵۰)', categoryId: 'cat-espresso', isAvailable: true },
      { id: 'item-ame-50', nameFa: 'آمریکانو (۵۰/۵۰)', categoryId: 'cat-espresso', isAvailable: true },
      { id: 'item-esp-50', nameFa: 'اسپرسو (۵۰/۵۰)', categoryId: 'cat-espresso', isAvailable: true },
    ];

    const sorted = [...mockItems].sort((a, b) => getItemPriorityRank(a as MenuItem) - getItemPriorityRank(b as MenuItem));

    assert.strictEqual(sorted[0].id, 'item-esp-50', 'Slot 1 must be Espresso');
    assert.strictEqual(sorted[1].id, 'item-ame-50', 'Slot 2 must be Americano');
    assert.strictEqual(sorted[2].id, 'item-flw-50', 'Slot 3 must be Flat White');
    assert.strictEqual(sorted[3].id, 'item-ice-ame-50', 'Slot 4 must be Cold/Iced Drink');
    assert.strictEqual(sorted[4].id, 'item-lat-50', 'Slot 5 must be Latte');
    assert.strictEqual(sorted[5].id, 'item-bakery-croissant', 'Slot 6 must be Croissant/Pastry');
  });

  it('5. Dynamic item-specific wallpapers and VisionOS Liquid Glass overlay layer', () => {
    assert.ok(fs.existsSync(wallpaperUtilPath), 'productWallpapers.ts must exist');

    // Test wallpaper resolution per product type
    const espressoWp = getProductWallpaper({ id: 'item-esp-50', nameFa: 'اسپرسو' });
    assert.strictEqual(espressoWp, WALLPAPER_PRESETS.ESPRESSO_CREMA, 'Espresso must resolve rich crema wallpaper');

    const americanoWp = getProductWallpaper({ id: 'item-ame-50', nameFa: 'آمریکانو' });
    assert.strictEqual(americanoWp, WALLPAPER_PRESETS.AMERICANO_HOT, 'Americano must resolve hot coffee wallpaper');

    const flatWhiteWp = getProductWallpaper({ id: 'item-flw-50', nameFa: 'فلت وایت' });
    assert.strictEqual(flatWhiteWp, WALLPAPER_PRESETS.FLAT_WHITE, 'Flat white must resolve flat white art wallpaper');

    const coldBrewWp = getProductWallpaper({ id: 'item-coldbrew-nitro', nameFa: 'کلد برو' });
    assert.strictEqual(coldBrewWp, WALLPAPER_PRESETS.COLD_BREW_ICE, 'Cold brew must resolve cold brew ice wallpaper');

    const croissantWp = getProductWallpaper({ id: 'item-bakery-croissant', nameFa: 'کروسان' });
    assert.strictEqual(croissantWp, WALLPAPER_PRESETS.CROISSANT_FLAKY, 'Croissant must resolve flaky croissant wallpaper');

    const teaWp = getProductWallpaper({ id: 'item-tea-lahijan', nameFa: 'چای لاهیجان' });
    assert.strictEqual(teaWp, WALLPAPER_PRESETS.TEA_LAHJAN, 'Tea must resolve amber tea wallpaper');

    const customWp = getProductWallpaper({ id: 'custom-item', imageUrl: 'https://example.com/custom.jpg' });
    assert.strictEqual(customWp, 'https://example.com/custom.jpg', 'Explicit imageUrl must take precedence');

    // Verify CatalogCard.tsx renders wallpaper and VisionOS Liquid Glass overlay
    assert.ok(fs.existsSync(catalogCardPath), 'CatalogCard.tsx must exist');
    const cardContent = fs.readFileSync(catalogCardPath, 'utf8');

    assert.ok(cardContent.includes('product-card-wallpaper'), 'CatalogCard must render wallpaper layer');
    assert.ok(cardContent.includes('product-card-liquid-glass-overlay'), 'CatalogCard must render liquid glass overlay');
    assert.ok(cardContent.includes('blur(12px) saturate(160%)'), 'CatalogCard must apply blur(12px) saturate(160%)');
    assert.ok(cardContent.includes('rgba(10, 14, 22, 0.40)'), 'CatalogCard must apply 10,14,22 gradient');
    assert.ok(cardContent.includes('rgba(255, 255, 255, 0.35)'), 'CatalogCard must apply inset highlight 255,255,255,0.35');
  });
});
