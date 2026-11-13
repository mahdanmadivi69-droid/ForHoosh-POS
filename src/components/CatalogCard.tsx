/**
 * src/components/CatalogCard.tsx
 * 
 * KarWand POS — 100 HICH Sensory Lab Interactive 3D Catalog Card
 * 
 * Specifications:
 *  - ±6 deg mouse/gyro 3D tilt matrix (perspective + rotateX/rotateY).
 *  - Dual-bean selector pills (`selectedBean: 'arabica' | 'blend'`).
 *  - Strict Carmine & Deep Navy Palette:
 *      * Carmine: `#8C1318`
 *      * Deep Navy: `#0C1E3C`
 *      * Luminous Sky Blue: `#90D2ED`
 *  - `.liquid-glass` styling and `.glass-sheen` dynamic reflection layer.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Coffee, Plus, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { CatalogMenuItem, SelectedBean } from '../types/catalog';
import { formatToman } from '../services/financialMath';
import { getProductWallpaper, getProductWallpaperStyle } from '../utils/productWallpapers';

interface CatalogCardProps {
  item: CatalogMenuItem;
  onAddToCart: (item: CatalogMenuItem, selectedBean: SelectedBean) => void;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  hotkeyIndex?: number;
}

export const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  onAddToCart,
  isOutOfStock = false,
  isLowStock = false,
  hotkeyIndex,
}) => {
  const [selectedBean, setSelectedBean] = useState<SelectedBean>('arabica');
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Tilt State
  const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number; sheenX: number; sheenY: number; isHovered: boolean }>({
    rotateX: 0,
    rotateY: 0,
    sheenX: 50,
    sheenY: 0,
    isHovered: false,
  });

  // Calculate ±6 deg tilt matrix based on mouse position
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isOutOfStock) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to +0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to +0.5

    // Calibrated ±2.2° to ±5° sensory tilt physics
    const rotateX = Math.max(-5, Math.min(5, -y * 8.8));
    const rotateY = Math.max(-5, Math.min(5, x * 8.8));

    const sheenX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const sheenY = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    setTilt({
      rotateX,
      rotateY,
      sheenX,
      sheenY,
      isHovered: true,
    });
  }, [isOutOfStock]);

  const handleMouseLeave = useCallback(() => {
    setTilt((prev) => ({
      ...prev,
      rotateX: 0,
      rotateY: 0,
      isHovered: false,
    }));
  }, []);

  // Compute active price based on dual-bean selection with resilient fallbacks
  const currentPrice = item.hasDualBean
    ? selectedBean === 'blend'
      ? item.priceBlend ?? item.priceToman ?? item.basePriceToman ?? 0
      : item.priceArabica ?? item.priceToman ?? item.basePriceToman ?? 0
    : item.priceToman ?? item.basePriceToman ?? 0;

  const handleCardClick = () => {
    if (isOutOfStock) return;
    onAddToCart(item, selectedBean);
  };

  const wallpaperUrl = getProductWallpaper(item);

  // Strip parenthetical suffixes already shown by the badge pill (e.g. "(۵۰/۵۰)") — display title only
  const displayNameFa = (() => {
    if (item.badge && item.badge.trim()) {
      const badgeNorm = item.badge.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stripped = item.nameFa.replace(new RegExp(`\\s*\\([^)]*${badgeNorm}[^)]*\\)`, 'gi'), '').trim();
      if (stripped) return stripped;
    }
    return item.hasDualBean ? item.nameFa.replace(/\s*\([^)]*۵۰\/۵۰[^)]*\)/gi, '').trim() : item.nameFa;
  })();

  return (
    <div
      style={{ perspective: '1200px' }}
      className="relative select-none"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCardClick}
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(${tilt.isHovered ? 1.02 : 1}, ${tilt.isHovered ? 1.02 : 1}, 1)`,
          transition: tilt.isHovered ? 'transform 0.08s ease-out' : 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
          ['--sheen-x' as any]: `${tilt.sheenX}%`,
          ['--sheen-y' as any]: `${tilt.sheenY}%`,
          ['--sheen-opacity' as any]: tilt.isHovered ? 1 : 0,
        }}
        className={`liquid-glass catalog-card-tilt relative rounded-2xl overflow-hidden flex flex-col justify-between group p-3.5 transition-all bg-[#0F223D]/70 border border-white/12 shadow-[0_16px_36px_-8px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.18)] hover:border-[#C5A880]/40 ${
          isOutOfStock
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:shadow-[0_20px_40px_-8px_rgba(215,25,33,0.35)]'
        }`}
      >
        {/* Dynamic Item-Specific Full-Bleed Wallpaper */}
        <div
          className="product-card-wallpaper absolute inset-0 bg-cover bg-center z-0 transition-transform duration-500 group-hover:scale-105 pointer-events-none"
          style={getProductWallpaperStyle(item)}
        />

        {/* VisionOS Liquid Glass Legibility Overlay */}
        <div
          className="product-card-liquid-glass-overlay absolute inset-0 z-10 pointer-events-none"
          style={{
            backdropFilter: 'blur(2.5px) saturate(160%)',
            WebkitBackdropFilter: 'blur(2.5px) saturate(160%)',
            background: 'linear-gradient(180deg, rgba(12, 17, 24, 0.10) 0%, rgba(10, 14, 20, 0.28) 55%, rgba(10, 14, 20, 0.62) 100%)',
            boxShadow: 'inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.30)',
          }}
        />

        {/* Glass Sheen Dynamic Light Reflection */}
        <div className="glass-sheen z-15 pointer-events-none" />

        {/* Card Header & Badges */}
        <div className="relative z-20 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {item.roastLevelText && (
                <span className="text-[10px] font-mono font-bold bg-[#0F223D] text-[#90D2ED] border border-white/15 px-2 py-0.5 rounded-lg shadow-inner shrink-0">
                  {item.roastLevelText}
                </span>
              )}

              {item.badge && (
                <span className="text-[10px] font-black bg-[#D71921] text-white border border-white/20 px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-sm shrink-0">
                  {item.badge}
                </span>
              )}
            </div>

            {hotkeyIndex !== undefined && hotkeyIndex < 9 && (
              <span className="text-[10px] font-mono bg-[#0B1524]/90 text-[#F5F5F7]/80 px-1.5 py-0.5 rounded-md border border-white/10 shrink-0">
                کلید {hotkeyIndex + 1}
              </span>
            )}
          </div>

          {/* Stock Alerts */}
          {isOutOfStock ? (
            <div className="bg-rose-950/80 border border-[#D71921]/60 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-[#D71921] shrink-0" />
              <span className="truncate">ناموجود (اتمام سرفصل انبار)</span>
            </div>
          ) : isLowStock ? (
            <div className="bg-amber-950/80 border border-amber-600/50 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">هشدار کسری موجودی دانه</span>
            </div>
          ) : null}

          {/* Item Name & Details */}
          <div>
            <h3 className="font-extrabold text-sm md:text-base text-[#F5F5F7]/92 group-hover:text-white transition-colors leading-snug line-clamp-1 font-sans">
              {displayNameFa}
            </h3>
            {item.description && (
              <p className="text-[11px] text-[#F5F5F7]/70 line-clamp-1 mt-0.5">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* Dual-Bean Selector Pills (100 HICH Sensory Lab) */}
        {item.hasDualBean && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-20 mt-3 p-1 rounded-xl bg-[#0B1524]/90 border border-white/12 grid grid-cols-2 gap-1.5"
          >
            <button
              type="button"
              onClick={() => setSelectedBean('arabica')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center min-w-0 cursor-pointer ${
                selectedBean === 'arabica'
                  ? 'bg-[#D71921] text-white shadow-md border border-white/25'
                  : 'bg-[#0F223D]/60 text-[#F5F5F7]/70 hover:text-white hover:bg-[#0F223D] border border-white/10'
              }`}
            >
              <span className="truncate w-full text-center">عربیکا ۱۰۰٪</span>
              <span className="text-[9px] opacity-90 mt-0.5 font-mono text-[#C5A880] truncate w-full text-center">
                {formatToman(item.priceArabica ?? item.basePriceToman)} ت
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedBean('blend')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center min-w-0 cursor-pointer ${
                selectedBean === 'blend'
                  ? 'bg-[#D71921] text-white shadow-md border border-white/25'
                  : 'bg-[#0F223D]/60 text-[#F5F5F7]/70 hover:text-white hover:bg-[#0F223D] border border-white/10'
              }`}
            >
              <span className="truncate w-full text-center">بلند ۵۰/۵۰</span>
              <span className="text-[9px] opacity-90 mt-0.5 font-mono text-[#C5A880] truncate w-full text-center">
                {formatToman(item.priceBlend ?? item.basePriceToman)} ت
              </span>
            </button>
          </div>
        )}

        {/* Card Footer: Price & Quick Action */}
        <div className="relative z-20 mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-[#F5F5F7]/60 block leading-tight">قیمت نهایی:</span>
            <div className="flex items-baseline gap-1">
              <span className="font-black text-sm md:text-base text-[#C5A880] font-mono tracking-tight truncate">
                {formatToman(currentPrice)}
              </span>
              <span className="text-[10px] font-sans text-[#C5A880]/80 shrink-0">تومان</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            title={isOutOfStock ? 'ناموجود' : 'افزودن به سبد سفارش'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0 ${
              isOutOfStock
                ? 'bg-[#1B222C] text-stone-500 border border-stone-800 cursor-not-allowed'
                : 'bg-[#D71921] hover:bg-[#B8141B] text-white border border-white/20 shadow-[0_0_12px_rgba(215,25,33,0.35)] hover:shadow-[0_0_20px_rgba(215,25,33,0.65)] cursor-pointer'
            }`}
          >
            <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
