/**
 * src/utils/productWallpapers.ts
 *
 * 100 HICH Dynamic Item-Specific Product Wallpaper Resolver
 * Directives: KW-DIR-ALPHA-2026-11-10-024 & KW-DIR-ALPHA-2026-11-10-024-RESUME
 *
 * Provides high-resolution, curated coffee photography wallpapers with resilient
 * CSS gradient underlays for offline/slow networks.
 * Preserves 100% legibility when paired with the Apple VisionOS Liquid Glass overlay.
 */

import React from 'react';

export interface WallpaperItemSource {
  id?: string;
  nameFa?: string;
  nameEn?: string;
  categoryId?: string;
  imageUrl?: string;
  image?: string;
}

// Curated high-fidelity coffee photography wallpapers (CDN-optimized)
export const WALLPAPER_PRESETS = {
  // 1. Rich espresso with golden crema
  ESPRESSO_CREMA: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80',
  ESPRESSO_SINGLE: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
  CORTADO: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',

  // 2. Deep rich Americano & Brewed Coffee
  AMERICANO_HOT: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80',
  BREWED_POUROVER: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',

  // 3. Flat White & Latte Art
  FLAT_WHITE: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
  LATTE_ART: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
  CAPPUCCINO: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
  CARAMEL_MACCHIATO: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=600&q=80',
  MOCHA: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80',

  // 4. Cold Brew & Iced Coffee
  COLD_BREW_ICE: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
  ICED_LATTE: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
  ESPRESSO_TONIC: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',

  // 5. Bakery & Croissants
  CROISSANT_FLAKY: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
  CARROT_CAKE: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
  CHEESECAKE: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',
  SANDWICH_PANINI: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',

  // 6. Tea & Herbal Infusions
  TEA_LAHJAN: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
  HERBAL_INFUSION: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
  CHAI_MASALA: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',

  // 7. Specialty Whole Beans & Retail
  ROASTED_BEANS: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=600&q=80',
  RETAIL_COFFEE_BAG: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=600&q=80',

  // 8. Refreshers & Mocktails
  COLD_LEMONADE_MINT: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
  COLD_BERRY_MOCKTAIL: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',

  // 9. Hot Chocolate
  HOT_CHOCOLATE: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80',
};

// Rich atmospheric gradients for offline / fallback rendering
export const GRADIENT_FALLBACKS = {
  ESPRESSO: 'linear-gradient(135deg, #3d1c06 0%, #170b02 50%, #090401 100%)',
  AMERICANO: 'linear-gradient(135deg, #24140e 0%, #120906 50%, #080302 100%)',
  MILK_COFFEE: 'linear-gradient(135deg, #42291a 0%, #29180e 50%, #120803 100%)',
  COLD_BREW: 'linear-gradient(135deg, #11202e 0%, #09131d 50%, #04090e 100%)',
  BAKERY: 'linear-gradient(135deg, #472b0c 0%, #2b1804 50%, #120901 100%)',
  TEA: 'linear-gradient(135deg, #2b3314 0%, #171d09 50%, #090c03 100%)',
  BEANS: 'linear-gradient(135deg, #381f0d 0%, #1e0e04 50%, #0a0401 100%)',
  COLD_DRINK: 'linear-gradient(135deg, #1a2a3a 0%, #0e1722 50%, #060a0f 100%)',
};

/**
 * Resolves an individual, item-specific wallpaper URL for a product.
 * Returns product.imageUrl if explicitly set, else determines the best thematic wallpaper.
 */
export function getProductWallpaper(item: WallpaperItemSource): string {
  // 1. Explicit image URL priority
  if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0) {
    return item.imageUrl;
  }
  if (item.image && typeof item.image === 'string' && item.image.trim().length > 0) {
    return item.image;
  }

  const id = (item.id || '').toLowerCase();
  const nameFa = (item.nameFa || '').toLowerCase();
  const nameEn = (item.nameEn || '').toLowerCase();
  const cat = (item.categoryId || '').toLowerCase();

  // Croissants & Pastries
  if (id.includes('croissant') || nameFa.includes('کروسان') || nameFa.includes('کرواسان') || nameEn.includes('croissant')) {
    return WALLPAPER_PRESETS.CROISSANT_FLAKY;
  }
  if (nameFa.includes('هویج') || nameFa.includes('کیک')) {
    return WALLPAPER_PRESETS.CARROT_CAKE;
  }
  if (nameFa.includes('چیزکیک') || nameFa.includes('سباستین') || nameEn.includes('cheesecake')) {
    return WALLPAPER_PRESETS.CHEESECAKE;
  }
  if (cat.includes('food') || nameFa.includes('ساندویچ') || nameFa.includes('پنینی') || nameFa.includes('تست')) {
    return WALLPAPER_PRESETS.SANDWICH_PANINI;
  }

  // Cold Brew & Nitro
  if (id.includes('coldbrew') || nameFa.includes('کلد برو') || nameEn.includes('cold brew') || nameEn.includes('coldbrew')) {
    return WALLPAPER_PRESETS.COLD_BREW_ICE;
  }

  // Iced Coffee Drinks
  if (id.includes('ice-ame') || nameFa.includes('آیس آمریکانو')) {
    return WALLPAPER_PRESETS.COLD_BREW_ICE;
  }
  if (id.includes('ice-ton') || nameFa.includes('آیس تونیک') || nameFa.includes('اسپرسو تونیک')) {
    return WALLPAPER_PRESETS.ESPRESSO_TONIC;
  }
  if (id.includes('ice-lat') || nameFa.includes('آیس لاته')) {
    return WALLPAPER_PRESETS.ICED_LATTE;
  }
  if (id.includes('ice-moc') || nameFa.includes('آیس موکا')) {
    return WALLPAPER_PRESETS.MOCHA;
  }
  if (id.includes('ice-crm') || nameFa.includes('آیس کارامل')) {
    return WALLPAPER_PRESETS.CARAMEL_MACCHIATO;
  }

  // Flat White
  if (id.includes('flw') || nameFa.includes('فلت وایت') || nameEn.includes('flat white')) {
    return WALLPAPER_PRESETS.FLAT_WHITE;
  }

  // Cortado & Macchiato
  if (id.includes('cor') || nameFa.includes('کورتادو') || nameEn.includes('cortado')) {
    return WALLPAPER_PRESETS.CORTADO;
  }
  if (nameFa.includes('کارامل ماکیاتو') || id.includes('crm')) {
    return WALLPAPER_PRESETS.CARAMEL_MACCHIATO;
  }
  if (nameFa.includes('ماکیاتو') || id.includes('mac')) {
    return WALLPAPER_PRESETS.CORTADO;
  }

  // Cappuccino
  if (id.includes('cap') || nameFa.includes('کاپوچینو') || nameEn.includes('cappuccino')) {
    return WALLPAPER_PRESETS.CAPPUCCINO;
  }

  // Mocha
  if (id.includes('moc') || nameFa.includes('موکا') || nameEn.includes('mocha')) {
    return WALLPAPER_PRESETS.MOCHA;
  }

  // Lattes (Flavored and Classic)
  if (nameFa.includes('لاته') || nameEn.includes('latte') || id.includes('lat')) {
    return WALLPAPER_PRESETS.LATTE_ART;
  }

  // Americano & Pourover / Brewed
  if (id.includes('ame') || nameFa.includes('آمریکانو') || nameEn.includes('americano')) {
    return WALLPAPER_PRESETS.AMERICANO_HOT;
  }
  if (id.includes('brew') || nameFa.includes('دمی') || nameFa.includes('v60') || nameFa.includes('کمکس')) {
    return WALLPAPER_PRESETS.BREWED_POUROVER;
  }

  // Teas & Infusions
  if (id.includes('tea-lahijan') || nameFa.includes('لاهیجان') || nameFa.includes('چای سیاه')) {
    return WALLPAPER_PRESETS.TEA_LAHJAN;
  }
  if (id.includes('karak') || id.includes('masala') || nameFa.includes('ماسالا') || nameFa.includes('کرک')) {
    return WALLPAPER_PRESETS.CHAI_MASALA;
  }
  if (nameFa.includes('دمنوش') || nameFa.includes('چای سبز') || cat.includes('tea')) {
    return WALLPAPER_PRESETS.HERBAL_INFUSION;
  }

  // Hot Chocolate / Cocoa
  if (nameFa.includes('هات چاکلت') || nameFa.includes('شکلات') || id.includes('choc')) {
    return WALLPAPER_PRESETS.HOT_CHOCOLATE;
  }

  // Refreshers / Cold mocktails
  if (nameFa.includes('لیموناد') || nameFa.includes('موهیتو')) {
    return WALLPAPER_PRESETS.COLD_LEMONADE_MINT;
  }
  if (nameFa.includes('ردمون') || nameFa.includes('رایپو') || nameFa.includes('نئون') || cat.includes('cold')) {
    return WALLPAPER_PRESETS.COLD_BERRY_MOCKTAIL;
  }

  // Retail Beans & Whole beans bags
  if (id.includes('bean') || id.includes('retail') || nameFa.includes('دان قهوه') || nameFa.includes('بسته')) {
    return WALLPAPER_PRESETS.ROASTED_BEANS;
  }

  // Espresso as default single / double / base
  if (id.includes('esp') || nameFa.includes('اسپرسو') || nameEn.includes('espresso')) {
    return WALLPAPER_PRESETS.ESPRESSO_CREMA;
  }

  return WALLPAPER_PRESETS.ESPRESSO_CREMA;
}

/**
 * Returns a rich thematic CSS linear-gradient fallback matching the product's flavor profile.
 */
export function getProductGradientFallback(item: WallpaperItemSource): string {
  const id = (item.id || '').toLowerCase();
  const nameFa = (item.nameFa || '').toLowerCase();
  const nameEn = (item.nameEn || '').toLowerCase();
  const cat = (item.categoryId || '').toLowerCase();

  if (id.includes('croissant') || nameFa.includes('کروسان') || nameFa.includes('کیک') || cat.includes('pastry')) {
    return GRADIENT_FALLBACKS.BAKERY;
  }
  if (id.includes('coldbrew') || id.includes('ice') || cat.includes('cold') || cat.includes('iced')) {
    return GRADIENT_FALLBACKS.COLD_BREW;
  }
  if (nameFa.includes('لاته') || nameFa.includes('فلت وایت') || nameFa.includes('کاپوچینو') || id.includes('flw') || id.includes('lat')) {
    return GRADIENT_FALLBACKS.MILK_COFFEE;
  }
  if (nameFa.includes('چای') || nameFa.includes('دمنوش') || cat.includes('tea')) {
    return GRADIENT_FALLBACKS.TEA;
  }
  if (id.includes('bean') || id.includes('retail')) {
    return GRADIENT_FALLBACKS.BEANS;
  }
  if (id.includes('ame') || nameFa.includes('آمریکانو') || id.includes('brew')) {
    return GRADIENT_FALLBACKS.AMERICANO;
  }

  return GRADIENT_FALLBACKS.ESPRESSO;
}

/**
 * Returns an inline style object providing both the photography wallpaper and the
 * rich gradient underlay for offline/slow-network resilience.
 */
export function getProductWallpaperStyle(item: WallpaperItemSource): React.CSSProperties {
  const imageUrl = getProductWallpaper(item);
  const gradient = getProductGradientFallback(item);
  return {
    backgroundImage: `url("${imageUrl}"), ${gradient}`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
