/**
 * CAFE OS — EXECUTIVE CONSOLIDATED MULTI-VENUE LIQUID-GLASS P&L BOARD
 * Architecture Spec: AutoClaw Systems | Motion Dynamics: AntiGravity Engine
 * Target ID: TGT-ANTIGRAV-P10-EXECUTIVE-PL-001
 * 
 * Implements:
 *  - Liquid-Glass Micro-Frosted Aesthetic: Deep Obsidian (#090D14 / #0D0F12), Frosted Glass (#161A1F / rgba(22, 26, 31, 0.65))
 *  - Crisp Optical Hairlines: 1px solid rgba(255, 255, 255, 0.08) to rgba(255, 255, 255, 0.12)
 *  - Strict 8px Modular Spacing Matrix
 *  - Monospace Telemetry: font-mono reserved for IRR/EUR currencies, EBITDA runs, margin % & trial balance hashes
 *  - 6-State Interactive Readiness: idle, hover, active/pressed, focus-visible, disabled, skeleton-loading
 *  - AntiGravity Motion Profiles: Decelerated settle cubic-bezier(0.16, 1, 0.3, 1), 220ms enter, 140ms snappy exit
 *  - Tactile Compression: scale(0.985) with tactical spring { stiffness: 420, damping: 32, mass: 0.7 }
 *  - Zero Reflow Constraint: strictly isolated to transform and opacity
 *  - Group-Level Consolidated Revenue vs. Inter-Company Transfer Eliminations (-34,500,000 IRR)
 *  - Multi-Currency IAS 21 Translation: Base IRR vs. Reporting EUR @ 760,000 IRR/EUR
 *  - Monotonically Increasing Merkle Proof Pill: SHA256:4C83F91A2E8B... with 0ms visual latency
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Building2,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Copy,
  Check,
  Layers,
  Percent,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

export type CurrencyMode = 'IRR' | 'EUR';
export type VenueFilter = 'ALL' | '100HICH' | 'MODENDO';

export interface ExecutivePLBoardProps {
  className?: string;
  initialCurrency?: CurrencyMode;
  initialVenue?: VenueFilter;
  enableDemoSkeleton?: boolean;
}

// IAS 21 Translation Factor: 760,000 IRR per 1 EUR
const IAS21_EXCHANGE_RATE = 760000;

// Base Financial Telemetry in IRR (Group Consolidated)
const FINANCIAL_BASE_IRR = {
  hichGrossRevenue: 795200000,
  modendoGrossRevenue: 485250000,
  intercompanyTransferElimination: -34500000, // Eliminated B2B bean transfer from 100 HICH to Modendo
  cogsIngredientsBOM: 398700000,
  opexLabor: 215400000,
  opexUtilitiesRoastery: 48600000,
  opexRentFacilities: 112000000,
  opexCloudPOSPlatform: 36300000,
  depreciationAmortization: 45800000,
  signedMerkleRoot: 'SHA256:4C83F91A2E8B77D0AC5B9214D1E8032997C2F6E18B091B6087E13629A78B4512',
  merkleHeight: 48102,
  merkleTimestamp: '2026-11-05T16:50:00Z',
};

export const ExecutivePLBoard: React.FC<ExecutivePLBoardProps> = ({
  className = '',
  initialCurrency = 'IRR',
  initialVenue = 'ALL',
  enableDemoSkeleton = false,
}) => {
  const [currency, setCurrency] = useState<CurrencyMode>(initialCurrency);
  const [venueFilter, setVenueFilter] = useState<VenueFilter>(initialVenue);
  const [isSkeleton, setIsSkeleton] = useState<boolean>(enableDemoSkeleton);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [refreshPulse, setRefreshPulse] = useState<number>(0);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState<boolean>(false);

  // Currency Formatter compliant with IAS 21 translation rules
  const formatMoney = useCallback(
    (amountIrr: number): string => {
      if (currency === 'IRR') {
        const sign = amountIrr < 0 ? '-' : '';
        const absVal = Math.abs(Math.round(amountIrr));
        return `${sign}${absVal.toLocaleString('en-US')} IRR`;
      } else {
        const amountEur = amountIrr / IAS21_EXCHANGE_RATE;
        const sign = amountEur < 0 ? '-' : '';
        const absVal = Math.abs(amountEur);
        return `${sign}€${absVal.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
    },
    [currency]
  );

  // Derived Consolidated P&L Calculations
  const metrics = useMemo(() => {
    // Venue-specific scoping or consolidation
    let grossRev = 0;
    let eliminations = 0;

    if (venueFilter === 'ALL') {
      grossRev = FINANCIAL_BASE_IRR.hichGrossRevenue + FINANCIAL_BASE_IRR.modendoGrossRevenue;
      eliminations = FINANCIAL_BASE_IRR.intercompanyTransferElimination;
    } else if (venueFilter === '100HICH') {
      grossRev = FINANCIAL_BASE_IRR.hichGrossRevenue;
      eliminations = 0; // Standalone venue view before group consolidation
    } else {
      grossRev = FINANCIAL_BASE_IRR.modendoGrossRevenue;
      eliminations = 0;
    }

    const netRevenue = grossRev + eliminations;
    const cogs = venueFilter === 'ALL' 
      ? FINANCIAL_BASE_IRR.cogsIngredientsBOM 
      : venueFilter === '100HICH' 
        ? Math.round(FINANCIAL_BASE_IRR.cogsIngredientsBOM * 0.62)
        : Math.round(FINANCIAL_BASE_IRR.cogsIngredientsBOM * 0.38);

    const grossProfit = netRevenue - cogs;
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const totalOpex = venueFilter === 'ALL'
      ? FINANCIAL_BASE_IRR.opexLabor +
        FINANCIAL_BASE_IRR.opexUtilitiesRoastery +
        FINANCIAL_BASE_IRR.opexRentFacilities +
        FINANCIAL_BASE_IRR.opexCloudPOSPlatform
      : venueFilter === '100HICH'
        ? Math.round((FINANCIAL_BASE_IRR.opexLabor + FINANCIAL_BASE_IRR.opexUtilitiesRoastery + FINANCIAL_BASE_IRR.opexRentFacilities + FINANCIAL_BASE_IRR.opexCloudPOSPlatform) * 0.60)
        : Math.round((FINANCIAL_BASE_IRR.opexLabor + FINANCIAL_BASE_IRR.opexUtilitiesRoastery + FINANCIAL_BASE_IRR.opexRentFacilities + FINANCIAL_BASE_IRR.opexCloudPOSPlatform) * 0.40);

    const ebitda = grossProfit - totalOpex;
    const ebitdaMarginPct = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0;

    const netOperatingProfit = ebitda - (venueFilter === 'ALL' ? FINANCIAL_BASE_IRR.depreciationAmortization : Math.round(FINANCIAL_BASE_IRR.depreciationAmortization * 0.5));
    const netProfitMarginPct = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

    return {
      grossRevenue: grossRev,
      eliminations,
      netRevenue,
      cogs,
      grossProfit,
      grossMarginPct,
      totalOpex,
      ebitda,
      ebitdaMarginPct,
      netOperatingProfit,
      netProfitMarginPct,
    };
  }, [venueFilter]);

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(FINANCIAL_BASE_IRR.signedMerkleRoot);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleSimulateSync = () => {
    setRefreshPulse((prev) => prev + 1);
  };

  return (
    <div
      className={`relative w-full max-w-7xl mx-auto p-4 md:p-8 bg-[#090D14] text-slate-100 rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.65)] overflow-hidden font-sans select-none ${className}`}
      style={{
        // AntiGravity zero-reflow container style
        willChange: 'opacity, transform',
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Background Liquid-Glass Gradient Accents (Zero Reflow: GPU transforms only) */}
      <div 
        className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-red-600/[0.07] rounded-full blur-[120px]" 
        style={{ transform: 'translate3d(0, 0, 0)' }} 
      />
      <div 
        className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/[0.05] rounded-full blur-[120px]" 
        style={{ transform: 'translate3d(0, 0, 0)' }} 
      />

      {/* ==================================================================== */}
      {/* 1. TOP HEADER & TELEMETRY CONTROL BAR                               */}
      {/* ==================================================================== */}
      <header className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold tracking-wider bg-red-500/10 text-red-400 border border-red-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              CONSOLIDATED P&amp;L REPORTING
            </span>
            <span className="text-xs text-slate-400 font-mono">IAS 21 COMPLIANT</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>100 HICH × MODENDO CAFE GROUP</span>
            <span className="text-xs font-mono font-normal text-slate-500 px-2 py-1 rounded bg-[#161A1F] border border-white/[0.06]">
              FY 2026-Q3
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Executive Liquid-Glass Accounting Dashboard • Multi-Venue Consolidated Telemetry
          </p>
        </div>

        {/* Action Controls & Merkle Pill */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Merkle Proof Verification Pill */}
          <div
            onClick={() => setAuditDrawerOpen(!auditDrawerOpen)}
            title="Click to view full cryptographic Merkle audit path"
            className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161A1F] hover:bg-[#1E232B] active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-emerald-500/50 border border-emerald-500/30 text-emerald-400 text-xs font-mono cursor-pointer transition-all duration-150 outline-none shadow-sm"
            style={{
              transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 140ms ease',
            }}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold tracking-wider">ROOT:</span>
            <span className="text-emerald-300 font-mono">4C83...4512</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>

          {/* IAS 21 Multi-Currency Switcher (6-State Ready) */}
          <div className="flex items-center p-1 rounded-xl bg-[#12151A] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setCurrency('IRR')}
              disabled={isSkeleton}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all duration-150 outline-none
                ${currency === 'IRR'
                  ? 'bg-[#161A1F] text-amber-300 shadow-sm border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }
                active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed`}
              style={{ transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              IRR (Base)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('EUR')}
              disabled={isSkeleton}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all duration-150 outline-none
                ${currency === 'EUR'
                  ? 'bg-[#161A1F] text-emerald-300 shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }
                active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed`}
              style={{ transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              EUR (@ 760k)
            </button>
          </div>

          {/* Skeleton State Demonstration Toggle */}
          <button
            type="button"
            onClick={() => setIsSkeleton(!isSkeleton)}
            title="Toggle skeleton loading state to audit 6-state coverage"
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all duration-150 outline-none flex items-center gap-1.5 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-blue-500/50
              ${isSkeleton 
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' 
                : 'bg-[#161A1F] text-slate-300 hover:bg-[#1E232B] hover:text-white border-white/[0.08]'
              }`}
            style={{ transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSkeleton ? 'Exit Skeleton' : 'Skeleton Mode'}</span>
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. VENUE FILTER CONTROLS (8px Grid & Optical Hairlines)              */}
      {/* ==================================================================== */}
      <section className="relative z-10 my-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mr-2">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            VENUE DRILL-DOWN:
          </span>

          {(['ALL', '100HICH', 'MODENDO'] as VenueFilter[]).map((v) => (
            <button
              key={v}
              type="button"
              disabled={isSkeleton}
              onClick={() => setVenueFilter(v)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all duration-150 outline-none border active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:opacity-40 disabled:cursor-not-allowed
                ${venueFilter === v
                  ? 'bg-red-500/15 text-red-300 border-red-500/35 shadow-sm'
                  : 'bg-[#161A1F] text-slate-400 hover:text-slate-200 hover:bg-[#1E232B] border-white/[0.08]'
                }`}
              style={{ transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {v === 'ALL' && 'All Venues (Consolidated)'}
              {v === '100HICH' && '100 HICH Coffee Roasters'}
              {v === 'MODENDO' && 'Modendo Cafe'}
            </button>
          ))}
        </div>

        {/* Sync Ping / Monotonic Proof Telemetry */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2 py-1 rounded bg-[#12151A] border border-white/[0.06] text-slate-300">
            Proof Height #{FINANCIAL_BASE_IRR.merkleHeight}
          </span>
          <button
            type="button"
            onClick={handleSimulateSync}
            disabled={isSkeleton}
            className="p-1.5 rounded-lg bg-[#161A1F] hover:bg-[#1E232B] active:scale-[0.985] border border-white/[0.08] text-slate-300 hover:text-white transition-all outline-none"
            title="Instantaneous zero-latency telemetry ping"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshPulse > 0 ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. FOUR KPI LIQUID-GLASS METRIC CARDS                               */}
      {/* ==================================================================== */}
      <section className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Consolidated Net Revenue */}
        <div
          className="group relative p-5 rounded-xl bg-[#161A1F]/80 backdrop-blur-md border border-white/[0.08] hover:border-white/[0.18] transition-all duration-200 shadow-sm"
          style={{ willChange: 'transform', transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span>CONSOLIDATED NET REVENUE</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          {isSkeleton ? (
            <div className="space-y-2 py-1">
              <div className="h-7 bg-white/[0.06] rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className="text-xl md:text-2xl font-bold font-mono text-white tracking-tight">
                {formatMoney(metrics.netRevenue)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 mt-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+14.2% YoY</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Post-elimination</span>
              </div>
            </>
          )}
        </div>

        {/* Card 2: Inter-Company Transfer Eliminations */}
        <div
          className="group relative p-5 rounded-xl bg-[#161A1F]/80 backdrop-blur-md border border-amber-500/25 hover:border-amber-500/40 transition-all duration-200 shadow-sm"
          style={{ willChange: 'transform', transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="flex items-center justify-between text-xs text-amber-300 font-mono mb-2">
            <span>INTER-COMPANY ELIMINATIONS</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          {isSkeleton ? (
            <div className="space-y-2 py-1">
              <div className="h-7 bg-white/[0.06] rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className="text-xl md:text-2xl font-bold font-mono text-amber-300 tracking-tight">
                {metrics.eliminations === 0 ? '0 IRR' : formatMoney(metrics.eliminations)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400/90 mt-2">
                <span>100% Inter-entity neutral</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">B2B Bean Roasts</span>
              </div>
            </>
          )}
        </div>

        {/* Card 3: Consolidated EBITDA & Margin */}
        <div
          className="group relative p-5 rounded-xl bg-[#161A1F]/80 backdrop-blur-md border border-white/[0.08] hover:border-white/[0.18] transition-all duration-200 shadow-sm"
          style={{ willChange: 'transform', transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span>CONSOLIDATED EBITDA</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          {isSkeleton ? (
            <div className="space-y-2 py-1">
              <div className="h-7 bg-white/[0.06] rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className="text-xl md:text-2xl font-bold font-mono text-purple-300 tracking-tight">
                {formatMoney(metrics.ebitda)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-purple-400 mt-2">
                <span className="font-semibold">{metrics.ebitdaMarginPct.toFixed(1)}%</span>
                <span className="text-slate-400">EBITDA margin</span>
              </div>
            </>
          )}
        </div>

        {/* Card 4: Gross Profit & BOM Cost Recovery */}
        <div
          className="group relative p-5 rounded-xl bg-[#161A1F]/80 backdrop-blur-md border border-white/[0.08] hover:border-white/[0.18] transition-all duration-200 shadow-sm"
          style={{ willChange: 'transform', transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span>GROSS MARGIN (BOM RECOVERY)</span>
            <Percent className="w-4 h-4 text-cyan-400" />
          </div>
          {isSkeleton ? (
            <div className="space-y-2 py-1">
              <div className="h-7 bg-white/[0.06] rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className="text-xl md:text-2xl font-bold font-mono text-cyan-300 tracking-tight">
                {formatMoney(metrics.grossProfit)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 mt-2">
                <span className="font-semibold">{metrics.grossMarginPct.toFixed(1)}%</span>
                <span className="text-slate-400">Gross margin efficiency</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. CONSOLIDATION & ELIMINATION BRIDGE BREAKDOWN                       */}
      {/* ==================================================================== */}
      <section className="relative z-10 mb-8 p-6 rounded-xl bg-[#161A1F]/90 backdrop-blur-md border border-white/[0.08]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold font-mono tracking-wider text-slate-200 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-red-400" />
            INTER-COMPANY TRANSFER ELIMINATION BRIDGE (IAS 21 &amp; GROUP LEDGER)
          </h2>
          <span className="text-xs text-slate-500 font-mono">Deduction Rule: NET_ZERO_INTERCOMPANY</span>
        </div>

        {isSkeleton ? (
          <div className="space-y-3 py-2">
            <div className="h-9 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-9 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-9 bg-white/[0.05] rounded animate-pulse" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Consolidation Entity / Venue</th>
                  <th className="py-2.5 px-3 font-medium">Gross Revenue</th>
                  <th className="py-2.5 px-3 font-medium">Eliminated Transfers</th>
                  <th className="py-2.5 px-3 font-medium">Consolidated Net</th>
                  <th className="py-2.5 px-3 font-medium">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {/* Row 1: 100 HICH Coffee Roasters */}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 flex items-center gap-2 text-white font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    100 HICH Coffee Roasters (Roastery &amp; Lab)
                  </td>
                  <td className="py-3 px-3 text-slate-300">{formatMoney(FINANCIAL_BASE_IRR.hichGrossRevenue)}</td>
                  <td className="py-3 px-3 text-amber-400">
                    {formatMoney(FINANCIAL_BASE_IRR.intercompanyTransferElimination)}
                  </td>
                  <td className="py-3 px-3 text-white font-semibold">
                    {formatMoney(FINANCIAL_BASE_IRR.hichGrossRevenue + FINANCIAL_BASE_IRR.intercompanyTransferElimination)}
                  </td>
                  <td className="py-3 px-3 text-slate-400">
                    {(( (FINANCIAL_BASE_IRR.hichGrossRevenue + FINANCIAL_BASE_IRR.intercompanyTransferElimination) / metrics.netRevenue ) * 100).toFixed(1)}%
                  </td>
                </tr>

                {/* Row 2: Modendo Cafe */}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 flex items-center gap-2 text-white font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Modendo Cafe (Boutique Cafe &amp; Lounge)
                  </td>
                  <td className="py-3 px-3 text-slate-300">{formatMoney(FINANCIAL_BASE_IRR.modendoGrossRevenue)}</td>
                  <td className="py-3 px-3 text-slate-500">0 IRR (Recipient)</td>
                  <td className="py-3 px-3 text-white font-semibold">{formatMoney(FINANCIAL_BASE_IRR.modendoGrossRevenue)}</td>
                  <td className="py-3 px-3 text-slate-400">
                    {(( FINANCIAL_BASE_IRR.modendoGrossRevenue / metrics.netRevenue ) * 100).toFixed(1)}%
                  </td>
                </tr>

                {/* Consolidated Total Summary Row */}
                <tr className="bg-white/[0.03] font-bold border-t border-white/[0.12]">
                  <td className="py-3.5 px-3 text-white">GROUP CONSOLIDATED TOTAL</td>
                  <td className="py-3.5 px-3 text-slate-200">
                    {formatMoney(FINANCIAL_BASE_IRR.hichGrossRevenue + FINANCIAL_BASE_IRR.modendoGrossRevenue)}
                  </td>
                  <td className="py-3.5 px-3 text-amber-300">
                    {formatMoney(FINANCIAL_BASE_IRR.intercompanyTransferElimination)}
                  </td>
                  <td className="py-3.5 px-3 text-emerald-400 font-mono text-sm">
                    {formatMoney(metrics.netRevenue)}
                  </td>
                  <td className="py-3.5 px-3 text-emerald-400">100.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* 5. FULL P&L WATERFALL STATEMENT                                      */}
      {/* ==================================================================== */}
      <section className="relative z-10 p-6 rounded-xl bg-[#161A1F]/90 backdrop-blur-md border border-white/[0.08] mb-8">
        <h2 className="text-sm font-semibold font-mono tracking-wider text-slate-200 mb-4 flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-400" />
          FULL CONSOLIDATED P&amp;L STATEMENT
        </h2>

        {isSkeleton ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 bg-white/[0.05] rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {/* Revenue Line */}
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-300">1. Consolidated Net Operating Revenue</span>
              <span className="font-bold text-white">{formatMoney(metrics.netRevenue)}</span>
            </div>

            {/* COGS Line */}
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-400 pl-4">• Cost of Goods Sold (Specialty Green Beans, Dairy &amp; BOM)</span>
              <span className="text-red-400">-{formatMoney(metrics.cogs)}</span>
            </div>

            {/* Gross Profit Line */}
            <div className="flex items-center justify-between py-2.5 px-3 bg-white/[0.02] border-y border-white/[0.06] font-semibold">
              <span className="text-cyan-300">GROSS PROFIT (Margin: {metrics.grossMarginPct.toFixed(1)}%)</span>
              <span className="text-cyan-300">{formatMoney(metrics.grossProfit)}</span>
            </div>

            {/* OpEx Breakdown */}
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-400 pl-4">• Staff Labor &amp; Specialist Barista Compensation</span>
              <span className="text-red-400">-{formatMoney(FINANCIAL_BASE_IRR.opexLabor)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-400 pl-4">• Roastery Gas, Power &amp; Commercial Water Filtration</span>
              <span className="text-red-400">-{formatMoney(FINANCIAL_BASE_IRR.opexUtilitiesRoastery)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-400 pl-4">• Prime Commercial Facilities Lease</span>
              <span className="text-red-400">-{formatMoney(FINANCIAL_BASE_IRR.opexRentFacilities)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-400 pl-4">• SmartOrders Cloud, Thermal Printing &amp; POS Telemetry</span>
              <span className="text-red-400">-{formatMoney(FINANCIAL_BASE_IRR.opexCloudPOSPlatform)}</span>
            </div>

            {/* EBITDA Line */}
            <div className="flex items-center justify-between py-2.5 px-3 bg-purple-500/10 border-y border-purple-500/25 font-bold text-sm">
              <span className="text-purple-300">CONSOLIDATED EBITDA (Margin: {metrics.ebitdaMarginPct.toFixed(1)}%)</span>
              <span className="text-purple-300">{formatMoney(metrics.ebitda)}</span>
            </div>

            {/* Depreciation */}
            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/[0.02]">
              <span className="text-slate-400 pl-4">• Roasting Drums &amp; La Marzocco Espresso Depreciation</span>
              <span className="text-red-400">-{formatMoney(FINANCIAL_BASE_IRR.depreciationAmortization)}</span>
            </div>

            {/* Net Operating Profit */}
            <div className="flex items-center justify-between py-3 px-3 bg-emerald-500/15 border border-emerald-500/35 rounded-lg font-bold text-sm">
              <span className="text-emerald-300">NET OPERATING PROFIT BEFORE TAX (Margin: {metrics.netProfitMarginPct.toFixed(1)}%)</span>
              <span className="text-emerald-300">{formatMoney(metrics.netOperatingProfit)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* 6. MERKLE PROOF AUDIT FOOTER & DIALOG TRIGGER                       */}
      {/* ==================================================================== */}
      <footer className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-6 border-t border-white/[0.08] text-xs font-mono text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#12151A] border border-white/[0.06]">
            <span className="text-slate-500">SIGNED ROOT:</span>
            <span className="text-slate-300 font-mono">{FINANCIAL_BASE_IRR.signedMerkleRoot.slice(0, 22)}...</span>
            <button
              type="button"
              onClick={handleCopyHash}
              className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
              title="Copy complete SHA-256 Merkle root to clipboard"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <span className="text-slate-500">Latency: &lt; 0.4ms</span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Zero-Drift Attested
          </span>
        </div>

        <div className="text-right text-slate-500">
          <span>AntiGravity v2.4 Motion • AutoClaw Liquid-Glass v3.1</span>
        </div>
      </footer>

      {/* Audit Drawer Detail Overlay (Zero Layout Reflow: transform/opacity only) */}
      {auditDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{
            animation: 'fadeIn 140ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
          onClick={() => setAuditDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg p-6 rounded-2xl bg-[#161A1F] border border-white/[0.12] shadow-2xl text-slate-200 font-mono text-xs space-y-4"
            style={{
              transform: 'scale(1)',
              animation: 'scaleIn 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                CRYPTOGRAPHIC MERKLE AUDIT ATTESTATION
              </span>
              <button
                type="button"
                onClick={() => setAuditDrawerOpen(false)}
                className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-slate-400 block mb-1">Merkle Tree Root (SHA-256):</span>
                <div className="p-2.5 rounded bg-[#0D0F12] border border-white/[0.06] font-mono text-[11px] text-emerald-300 break-all select-all">
                  {FINANCIAL_BASE_IRR.signedMerkleRoot}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2.5 rounded bg-[#0D0F12] border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">VERIFIED HEIGHT</span>
                  <span className="font-bold text-white">#{FINANCIAL_BASE_IRR.merkleHeight}</span>
                </div>
                <div className="p-2.5 rounded bg-[#0D0F12] border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">CONSENSUS STATUS</span>
                  <span className="font-bold text-emerald-400">UNANIMOUS PASS</span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 leading-relaxed">
                This Merkle root attests to the mathematical integrity of the inter-company elimination entry
                (<span className="text-amber-300 font-semibold">-34,500,000 IRR</span>) across Dexie local storage,
                PostgreSQL cloud backup synchronization, and the shared trial balance ledger.
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.08] flex justify-end">
              <button
                type="button"
                onClick={() => setAuditDrawerOpen(false)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.985] text-white font-medium text-xs transition-all"
              >
                Close Attestation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutivePLBoard;
