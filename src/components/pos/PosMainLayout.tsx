import React, { ReactNode } from 'react';

export interface PosMainLayoutProps {
  catalog: ReactNode;
  cart: ReactNode;
  className?: string;
}

/**
 * PosMainLayout — 100 HICH Obsidian Liquid Glass POS Main Layout Shell
 *
 * Geometric & Design Invariants:
 * - Base Palette: Pure Obsidian (#0B0E14)
 * - Order Cart Column: Permanently pinned to the physical LEFT side in both RTL and LTR viewports.
 * - Cart Width: Fixed w-[330px] (min-w-[330px], max-w-[330px]).
 * - Cart Height: sticky top-[72px] h-[calc(100vh-90px)].
 */
export const PosMainLayout: React.FC<PosMainLayoutProps> = ({
  catalog,
  cart,
  className = '',
}) => {
  return (
    <div
      className={`h-screen max-h-screen overflow-hidden bg-[#0B0E14] text-white select-none flex flex-col ${className}`}
    >
      <div className="flex-1 min-h-0 flex flex-row gap-4 p-3 md:p-4 max-w-[1720px] mx-auto w-full h-[calc(100vh-64px)] overflow-hidden relative">
        {/* ================= CATALOG SECTION ================= */}
        {/*
          In RTL (dir="rtl"): flex starts on right. order-1 renders at start (RIGHT).
          In LTR (dir="ltr"): flex starts on left. order-2 renders at end (RIGHT).
          Result: Catalog is permanently on the RIGHT.
        */}
        <section className="flex-1 min-h-0 flex flex-col min-w-0 h-full overflow-hidden order-2 rtl:order-1 ltr:order-2">
          {catalog}
        </section>

        {/* ================= ORDER CART COLUMN ================= */}
        {/*
          In RTL (dir="rtl"): order-2 renders at end (LEFT).
          In LTR (dir="ltr"): order-1 renders at start (LEFT).
          Result: Cart column is permanently pinned to the physical LEFT in both RTL and LTR viewports.
        */}
        <aside
          id="pos-cart-panel"
          className="flex flex-col w-[330px] min-w-[330px] max-w-[330px] shrink-0 h-full overflow-hidden order-1 rtl:order-2 ltr:order-1"
        >
          {cart}
        </aside>
      </div>
    </div>
  );
};

export default PosMainLayout;
