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

  // Compute active price based on dual-bean selection
  const currentPrice = item.hasDualBean
    ? selectedBean === 'blend'
      ? item.priceBlend ?? item.basePriceToman
      : item.priceArabica ?? item.basePriceToman
    : item.basePriceToman;

  const handleCardClick = () => {
    if (isOutOfStock) return;
    onAddToCart(item, selectedBean);
  };

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
        className={`liquid-glass relative rounded-2xl overflow-hidden flex flex-col justify-between group p-3.5 transition-all ${
          isOutOfStock
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:shadow-[0_20px_40px_-8px_rgba(140,19,24,0.4)]'
        }`}
      >
        {/* Glass Sheen Dynamic Light Reflection */}
        <div className="glass-sheen" />

        {/* Card Header & Badges */}
        <div className="relative z-20 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.roastLevelText && (
                <span className="text-[10px] font-mono font-bold bg-[#0C1E3C]/90 text-[#90D2ED] border border-[#90D2ED]/30 px-2 py-0.5 rounded-lg shadow-inner">
                  {item.roastLevelText}
                </span>
              )}

              {item.badge && (
                <span className="text-[10px] font-black bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white border border-[#90D2ED]/30 px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-sm">
                  {item.badge}
                </span>
              )}
            </div>

            {hotkeyIndex !== undefined && hotkeyIndex < 9 && (
              <span className="text-[10px] font-mono bg-[#0A0D11]/80 text-[#90D2ED] px-1.5 py-0.5 rounded-md border border-white/10">
                کلید {hotkeyIndex + 1}
              </span>
            )}
          </div>

          {/* Stock Alerts */}
          {isOutOfStock ? (
            <div className="bg-rose-950/70 border border-rose-800 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>ناموجود (اتمام سرفصل انبار)</span>
            </div>
          ) : isLowStock ? (
            <div className="bg-amber-950/70 border border-amber-800 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>هشدار کسری موجودی دانه</span>
            </div>
          ) : null}

          {/* Item Name & Details */}
          <div>
            <h3 className="font-extrabold text-sm md:text-base text-white group-hover:text-[#90D2ED] transition-colors leading-snug">
              {item.nameFa}
            </h3>
            {item.description && (
              <p className="text-[11px] text-[#9EACB8] line-clamp-1 mt-0.5">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* Dual-Bean Selector Pills (100 HICH Sensory Lab) */}
        {item.hasDualBean && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-20 mt-3 p-1 rounded-xl bg-[#081224]/90 border border-[#90D2ED]/20 grid grid-cols-2 gap-1"
          >
            <button
              type="button"
              onClick={() => setSelectedBean('arabica')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center ${
                selectedBean === 'arabica'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] text-white shadow-md border border-[#90D2ED]/40'
                  : 'text-[#9EACB8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span>عربیکا ۱۰۰٪</span>
              <span className="text-[9px] opacity-80 mt-0.5 font-mono">
                {formatToman(item.priceArabica ?? item.basePriceToman)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedBean('blend')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center ${
                selectedBean === 'blend'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#6E0D12] text-white shadow-md border border-[#90D2ED]/40'
                  : 'text-[#9EACB8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span>بلند ۵۰/۵۰</span>
              <span className="text-[9px] opacity-80 mt-0.5 font-mono">
                {formatToman(item.priceBlend ?? item.basePriceToman)}
              </span>
            </button>
          </div>
        )}

        {/* Card Footer: Price & Quick Action */}
        <div className="relative z-20 mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#9EACB8] block">قیمت نهایی:</span>
            <span className="font-black text-sm md:text-base text-white font-mono tracking-tight">
              {formatToman(currentPrice)} <span className="text-[10px] font-sans text-[#90D2ED]">تومان</span>
            </span>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-90 ${
              isOutOfStock
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-br from-[#8C1318] to-[#5a0c10] text-white border border-[#90D2ED]/30 hover:scale-105'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
