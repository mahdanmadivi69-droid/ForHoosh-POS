/**
 * CAFE OS — DYNAMIC SAAS TENANT INTAKE & CONFIG BUILDER
 * Architecture Spec: AutoClaw Systems | Motion Dynamics: AntiGravity Engine
 * Target ID: AG-13.1
 * 
 * Provides:
 *  1. Multi-step Sales & Marketing Intake Form for rapid venue onboarding
 *  2. Venue identity, dual-currency selection (IRR/EUR), hardware thermal routing & floor sections
 *  3. Live Liquid-Glass theme palette customizer with real-time UI preview
 *  4. Direct integration with TenantProvisioner (IndexedDB cold-start + HMAC QR token generation)
 *  5. Local SQLite mesh schema compilation payload generation
 */

import React, { useState, useId, useMemo } from 'react';
import {
  Building2,
  Printer,
  Layers,
  Palette,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  FileCode,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import {
  TenantManifest,
  TenantProvisioner,
  ProvisioningResult,
  OperationalSection,
  PrinterEndpointConfig,
  TenantThemeConfig,
} from '../services/TenantProvisioner';
import { useTenantTheme } from './TenantThemeProvider';

export interface TenantConfigBuilderProps {
  className?: string;
  onProvisionComplete?: (result: ProvisioningResult) => void;
  onClose?: () => void;
}

const THEME_PRESETS: { name: string; primary: string; secondary: string; accent: string }[] = [
  { name: '100 HICH Crimson', primary: '#D71921', secondary: '#0F223D', accent: '#F59E0B' },
  { name: 'Modendo Emerald', primary: '#059669', secondary: '#0B1E19', accent: '#3B82F6' },
  { name: 'Obsidian Cyan', primary: '#06B6D4', secondary: '#0B1D28', accent: '#F43F5E' },
  { name: 'Royal Velvet Purple', primary: '#8B5CF6', secondary: '#1A0B2E', accent: '#10B981' },
  { name: 'Artisan Amber Gold', primary: '#D97706', secondary: '#241403', accent: '#EC4899' },
];

export const TenantConfigBuilder: React.FC<TenantConfigBuilderProps> = ({
  className = '',
  onProvisionComplete,
  onClose,
}) => {
  const { switchTenant } = useTenantTheme();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionResult, setProvisionResult] = useState<ProvisioningResult | null>(null);
  const [compiledMeshPayload, setCompiledMeshPayload] = useState<Record<string, any> | null>(null);
  const [copiedQrUrl, setCopiedQrUrl] = useState<string | null>(null);

  // Form State
  const [brandNameEn, setBrandNameEn] = useState<string>('Aurora Specialty Coffee');
  const [brandNameFa, setBrandNameFa] = useState<string>('کافه تخصصی آرورا');
  const [tenantSlug, setTenantSlug] = useState<string>('tenant-aurora-01');
  const [taglineFa, setTaglineFa] = useState<string>('برشته‌کاری موج سوم و بار اسپرسو تخصصی');
  const [currency, setCurrency] = useState<'IRR' | 'EUR'>('IRR');
  const [taxInclusive, setTaxInclusive] = useState<boolean>(true);

  // Operational Sections
  const [sections, setSections] = useState<OperationalSection[]>([
    { id: 'sec_bar', nameEn: 'Main Espresso Bar', nameFa: 'بار اسپرسو اصلی', tableCount: 6, tablePrefix: 'B-' },
    { id: 'sec_salon', nameEn: 'Central Salon', nameFa: 'سالن مرکزی', tableCount: 12, tablePrefix: 'T-' },
    { id: 'sec_patio', nameEn: 'Outdoor Terrace', nameFa: 'تراس و فضای باز', tableCount: 8, tablePrefix: 'P-' },
  ]);

  // Hardware Printers
  const [printers, setPrinters] = useState<PrinterEndpointConfig[]>([
    {
      id: 'prn_bar',
      alias: 'Bar Thermal Printer',
      station: 'BAR',
      ipAddress: '192.168.1.201',
      port: 9100,
      paperWidth: '80mm',
      enableBuzzer: true,
      enableCutter: true,
      isDefault: true,
    },
    {
      id: 'prn_kitchen',
      alias: 'Kitchen Ticket Printer',
      station: 'KITCHEN',
      ipAddress: '192.168.1.202',
      port: 9100,
      paperWidth: '80mm',
      enableBuzzer: true,
      enableCutter: true,
      isDefault: false,
    },
  ]);

  // Theme Config
  const [theme, setTheme] = useState<TenantThemeConfig>({
    primaryColor: '#06B6D4',
    secondaryColor: '#0B1D28',
    accentColor: '#F43F5E',
    surfaceBase: '#090D14',
    surfaceCard: '#161A1F',
  });

  const handleSlugify = (val: string) => {
    const slug = 'tenant-' + val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setTenantSlug(slug || 'tenant-custom-01');
  };

  const handleAddSection = () => {
    const nextIdx = sections.length + 1;
    const newSec: OperationalSection = {
      id: `sec_custom_${Date.now()}`,
      nameEn: `Section ${nextIdx}`,
      nameFa: `بخش ${nextIdx}`,
      tableCount: 6,
      tablePrefix: `S${nextIdx}-`,
    };
    setSections([...sections, newSec]);
  };

  const handleRemoveSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((s) => s.id !== id));
  };

  const handleUpdateSection = (id: string, updates: Partial<OperationalSection>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Build Final Manifest Object
  const currentManifest = useMemo<TenantManifest>(() => {
    return {
      tenantId: tenantSlug,
      brandNameEn,
      brandNameFa,
      taglineFa,
      currency,
      taxInclusive,
      sections,
      printers,
      theme,
      hmacSecret: `sec_${tenantSlug.replace('tenant-', '')}_${Math.random().toString(36).substring(2, 10)}`,
      createdAt: new Date().toISOString(),
      version: 'v13.0',
    };
  }, [tenantSlug, brandNameEn, brandNameFa, taglineFa, currency, taxInclusive, sections, printers, theme]);

  const handleProvisionSubmit = async () => {
    setIsProvisioning(true);
    try {
      // 1. Compile SQLite Mesh Schema payload
      const compiled = TenantProvisioner.compileTenantMeshSchema(currentManifest);
      setCompiledMeshPayload(compiled);

      // 2. Execute IndexedDB cold-start & HMAC QR token creation
      const res = await TenantProvisioner.provisionTenant(currentManifest);
      setProvisionResult(res);

      if (res.success && onProvisionComplete) {
        onProvisionComplete(res);
      }
    } catch (err) {
      console.error('[TenantConfigBuilder] Error during submission:', err);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleActivateTenantNow = () => {
    if (provisionResult && provisionResult.success) {
      TenantProvisioner.setActiveTenant(provisionResult.tenantId);
      switchTenant(provisionResult.tenantId);
      if (onClose) onClose();
    }
  };

  return (
    <div
      className={`relative w-full max-w-5xl mx-auto p-6 md:p-8 bg-[#090D14] text-slate-100 rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.7)] select-none ${className}`}
      style={{ willChange: 'transform, opacity', transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Background Ambient Glow */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px]"
        style={{ backgroundColor: `${theme.primaryColor}15` }}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              PHASE 13 • DYNAMIC SAAS ENGINE
            </span>
            <span className="text-xs text-slate-400 font-mono">SQLite WAL Mesh Ready</span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            <span>SaaS Venue Intake &amp; Config Builder</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure identity, currency, ESC/POS hardware, floor sections, and Liquid-Glass branding.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-[#161A1F] hover:bg-[#1E232B] text-slate-400 hover:text-white border border-white/[0.08] text-xs font-mono transition-all"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Stepper Navigation */}
      {!provisionResult && (
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.06] overflow-x-auto text-xs font-mono">
          {[
            { step: 1, label: 'Identity & Slug' },
            { step: 2, label: 'Currency & Tax' },
            { step: 3, label: 'Hardware Routing' },
            { step: 4, label: 'Floor Sections' },
            { step: 5, label: 'Branding & Theme' },
            { step: 6, label: 'Review & Provision' },
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => setCurrentStep(item.step)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all outline-none border
                ${currentStep === item.step
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35 font-bold shadow-sm'
                  : currentStep > item.step
                    ? 'text-emerald-400 border-transparent hover:bg-white/[0.02]'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === item.step ? 'bg-cyan-500 text-black' : currentStep > item.step ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06]'
              }`}>
                {currentStep > item.step ? '✓' : item.step}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 1: VENUE IDENTITY & SLUG                                        */}
      {/* ==================================================================== */}
      {currentStep === 1 && !provisionResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-2">Venue Brand Name (English)</label>
              <input
                type="text"
                value={brandNameEn}
                onChange={(e) => {
                  setBrandNameEn(e.target.value);
                  handleSlugify(e.target.value);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12151A] border border-white/[0.08] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-white text-sm outline-none font-sans"
                placeholder="e.g. Aurora Specialty Coffee"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-2">نام برند به فارسی (Farsi)</label>
              <input
                type="text"
                dir="rtl"
                value={brandNameFa}
                onChange={(e) => setBrandNameFa(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12151A] border border-white/[0.08] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-white text-sm outline-none font-sans"
                placeholder="مثال: کافه تخصصی آرورا"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-2">Generated Tenant ID (Isolated DB Slug)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#12151A] border border-white/[0.08] font-mono text-sm text-cyan-300 outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                Maps directly to IndexedDB: <code className="text-slate-400">CafeOS_LocalDB_{tenantSlug}</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-2">شعار تبلیغاتی (Tagline)</label>
              <input
                type="text"
                dir="rtl"
                value={taglineFa}
                onChange={(e) => setTaglineFa(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12151A] border border-white/[0.08] text-white text-sm outline-none font-sans"
                placeholder="شعار برند..."
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: ACCOUNTING & CURRENCY (IAS 21 COMPLIANT)                     */}
      {/* ==================================================================== */}
      {currentStep === 2 && !provisionResult && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-[#161A1F] border border-white/[0.08]">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              Base Functional Currency &amp; Precision Standard
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select the primary transactional accounting standard. Multi-currency IAS 21 conversions apply automatically.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCurrency('IRR')}
                className={`p-4 rounded-xl text-left border transition-all ${
                  currency === 'IRR'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-[#12151A] border-white/[0.08] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-sm font-bold font-mono">IRR (Iranian Rial / Toman)</div>
                <div className="text-xs text-slate-400 mt-1">Integer precision math • Compliant with Iranian tax ledger</div>
              </button>

              <button
                type="button"
                onClick={() => setCurrency('EUR')}
                className={`p-4 rounded-xl text-left border transition-all ${
                  currency === 'EUR'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'bg-[#12151A] border-white/[0.08] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-sm font-bold font-mono">EUR (Euro Standard @ 760,000)</div>
                <div className="text-xs text-slate-400 mt-1">IAS 21 compliant translation • Cent-level decimal support</div>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#161A1F] border border-white/[0.08] flex items-center justify-between">
            <div>
              <span className="font-semibold text-white text-sm block">Tax Inclusive Pricing Standard</span>
              <span className="text-xs text-slate-400">Net * 9 / 109 Value-Added Tax standard formula</span>
            </div>
            <input
              type="checkbox"
              checked={taxInclusive}
              onChange={(e) => setTaxInclusive(e.target.checked)}
              className="w-5 h-5 accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: HARDWARE ROUTING & ESC/POS PRINTER ENDPOINTS                 */}
      {/* ==================================================================== */}
      {currentStep === 3 && !provisionResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-cyan-400" />
              ESC/POS RAW TCP NETWORK ENDPOINTS (PORT 9100)
            </span>
          </div>

          <div className="space-y-4">
            {printers.map((prn, idx) => (
              <div key={prn.id} className="p-4 rounded-xl bg-[#161A1F] border border-white/[0.08] grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">STATION ROLE</label>
                  <select
                    value={prn.station}
                    onChange={(e) => {
                      const st = e.target.value as any;
                      setPrinters(printers.map((p, i) => (i === idx ? { ...p, station: st } : p)));
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono outline-none"
                  >
                    <option value="BAR">BAR (Espresso &amp; Brew)</option>
                    <option value="KITCHEN">KITCHEN (Food &amp; Bakery)</option>
                    <option value="CASHIER">CASHIER (Customer Bill)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">IP ADDRESS</label>
                  <input
                    type="text"
                    value={prn.ipAddress}
                    onChange={(e) => {
                      const ip = e.target.value;
                      setPrinters(printers.map((p, i) => (i === idx ? { ...p, ipAddress: ip } : p)));
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono outline-none"
                    placeholder="192.168.1.xxx"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">PAPER WIDTH</label>
                  <select
                    value={prn.paperWidth}
                    onChange={(e) => {
                      const pw = e.target.value as any;
                      setPrinters(printers.map((p, i) => (i === idx ? { ...p, paperWidth: pw } : p)));
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono outline-none"
                  >
                    <option value="80mm">80mm (Standard)</option>
                    <option value="58mm">58mm (Compact)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 md:pt-0">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                    <input
                      type="checkbox"
                      checked={prn.enableBuzzer}
                      onChange={(e) => {
                        const bz = e.target.checked;
                        setPrinters(printers.map((p, i) => (i === idx ? { ...p, enableBuzzer: bz } : p)));
                      }}
                      className="accent-cyan-500"
                    />
                    Buzzer
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                    <input
                      type="checkbox"
                      checked={prn.enableCutter}
                      onChange={(e) => {
                        const ct = e.target.checked;
                        setPrinters(printers.map((p, i) => (i === idx ? { ...p, enableCutter: ct } : p)));
                      }}
                      className="accent-cyan-500"
                    />
                    Auto-Cut
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 4: OPERATIONAL FLOOR SECTIONS                                   */}
      {/* ==================================================================== */}
      {currentStep === 4 && !provisionResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              FLOOR PLAN TOPOLOGY &amp; SECTION CAPACITY
            </span>
            <button
              type="button"
              onClick={handleAddSection}
              className="px-3 py-1.5 rounded-lg bg-[#161A1F] hover:bg-[#1E232B] text-cyan-400 border border-cyan-500/30 text-xs font-mono flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Section</span>
            </button>
          </div>

          <div className="space-y-3">
            {sections.map((sec) => (
              <div key={sec.id} className="p-4 rounded-xl bg-[#161A1F] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">SECTION (EN)</label>
                  <input
                    type="text"
                    value={sec.nameEn}
                    onChange={(e) => handleUpdateSection(sec.id, { nameEn: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono outline-none"
                  />
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">نام بخش (FA)</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={sec.nameFa}
                    onChange={(e) => handleUpdateSection(sec.id, { nameFa: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-sans outline-none"
                  />
                </div>

                <div className="w-24">
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">TABLES</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sec.tableCount}
                    onChange={(e) => handleUpdateSection(sec.id, { tableCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono outline-none"
                  />
                </div>

                <div className="w-24">
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">PREFIX</label>
                  <input
                    type="text"
                    value={sec.tablePrefix}
                    onChange={(e) => handleUpdateSection(sec.id, { tablePrefix: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSection(sec.id)}
                  disabled={sections.length <= 1}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all mt-4"
                  title="Remove section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 5: BRANDING & LIQUID-GLASS THEME CUSTOMIZATION                   */}
      {/* ==================================================================== */}
      {currentStep === 5 && !provisionResult && (
        <div className="space-y-6">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-2">QUICK THEME PALETTE PRESETS</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    setTheme({
                      ...theme,
                      primaryColor: preset.primary,
                      secondaryColor: preset.secondary,
                      accentColor: preset.accent,
                    })
                  }
                  className="p-3 rounded-xl bg-[#161A1F] border border-white/[0.08] hover:border-white/[0.2] text-left transition-all group"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.secondary }} />
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.accent }} />
                  </div>
                  <span className="text-[11px] font-mono text-slate-300 block truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Primary Color (Action Buttons)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Secondary Color (Header Shell)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Accent Highlight (Badges/Badges)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#12151A] border border-white/[0.08] text-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Live Liquid-Glass Preview Card */}
          <div className="p-6 rounded-2xl bg-[#161A1F]/90 backdrop-blur-md border border-white/[0.12] space-y-4">
            <span className="text-[11px] font-mono text-slate-400 block">LIVE LIQUID-GLASS RUNTIME TOKEN PREVIEW</span>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl" style={{ backgroundColor: theme.secondaryColor }}>
              <div>
                <span className="text-lg font-bold text-white block">{brandNameEn}</span>
                <span className="text-xs text-slate-300 font-sans">{brandNameFa}</span>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-white shadow-md transition-all active:scale-[0.985]"
                style={{ backgroundColor: theme.primaryColor }}
              >
                ORDER DISPATCH • 120,000 T
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 6: REVIEW & PROVISION (Mesh Schema Compilation)                 */}
      {/* ==================================================================== */}
      {currentStep === 6 && !provisionResult && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#161A1F] border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              CONFIRM SAAS ONBOARDING MANIFEST
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#12151A] border border-white/[0.04]">
                <span className="text-slate-500 block">TENANT ID</span>
                <span className="font-bold text-cyan-300">{tenantSlug}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#12151A] border border-white/[0.04]">
                <span className="text-slate-500 block">CURRENCY</span>
                <span className="font-bold text-amber-300">{currency}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#12151A] border border-white/[0.04]">
                <span className="text-slate-500 block">SECTIONS</span>
                <span className="font-bold text-white">{sections.length} Areas</span>
              </div>
              <div className="p-3 rounded-lg bg-[#12151A] border border-white/[0.04]">
                <span className="text-slate-500 block">PRINTERS</span>
                <span className="font-bold text-white">{printers.length} Endpoints</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Submitting this manifest will automatically create an isolated IndexedDB catalog (
              <code className="text-cyan-300">CafeOS_LocalDB_{tenantSlug}</code>), seed initial specialty coffee items,
              configure network ESC/POS thermal printers on port 9100, and generate cryptographically signed HMAC QR table tokens.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isProvisioning}
              onClick={handleProvisionSubmit}
              className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.985] text-white font-mono font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isProvisioning ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Compiling Mesh Schema &amp; Seeding...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Tenant Provisioning</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUCCESS RESULT SCREEN (QR Tokens & Mesh Payload)                     */}
      {/* ==================================================================== */}
      {provisionResult && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold font-mono">TENANT PROVISIONING SUCCESSFUL</h3>
                <span className="text-xs text-emerald-400/80 font-mono">
                  Database &amp; Mesh Schema compiled for: {provisionResult.tenantId}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
              <div>Tables Seeded: {provisionResult.tablesSeededCount}</div>
              <div>Menu Items: {provisionResult.menuItemsSeededCount}</div>
              <div>Database: {provisionResult.dbName}</div>
              <div>HMAC Tokens: {Object.keys(provisionResult.qrTokensGenerated).length} Generated</div>
            </div>
          </div>

          {/* Signed Table QR Codes */}
          <div className="p-5 rounded-2xl bg-[#161A1F] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400" />
                CRYPTOGRAPHICALLY SIGNED TABLE ACCESS QR URLS
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">Tamper-Proof HMAC-SHA256</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {Object.entries(provisionResult.qrTokensGenerated).map(([tableId, url]) => (
                <div key={tableId} className="flex items-center justify-between p-2 rounded-lg bg-[#12151A] border border-white/[0.04] text-xs font-mono">
                  <span className="font-bold text-cyan-300 w-16">{tableId}</span>
                  <span className="text-slate-400 truncate flex-1 mx-2 text-[11px]">{url}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(url);
                      setCopiedQrUrl(tableId);
                      setTimeout(() => setCopiedQrUrl(null), 2000);
                    }}
                    className="p-1 rounded hover:bg-white/[0.08] text-slate-400 hover:text-white"
                    title="Copy QR URL"
                  >
                    {copiedQrUrl === tableId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Compiled SQLite Mesh Schema Payload */}
          {compiledMeshPayload && (
            <div className="p-5 rounded-2xl bg-[#161A1F] border border-white/[0.08] space-y-2">
              <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-purple-400" />
                COMPILED SQLITE MESH SCHEMA PAYLOAD (v13.0)
              </h4>
              <pre className="p-3 rounded-lg bg-[#0D0F12] border border-white/[0.06] text-[11px] font-mono text-slate-400 max-h-36 overflow-y-auto">
                {JSON.stringify(compiledMeshPayload, null, 2)}
              </pre>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setProvisionResult(null);
                setCurrentStep(1);
              }}
              className="px-4 py-2 rounded-xl bg-[#161A1F] hover:bg-[#1E232B] text-slate-300 text-xs font-mono"
            >
              ← Onboard Another Venue
            </button>

            <button
              type="button"
              onClick={handleActivateTenantNow}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.985] text-white font-mono font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <span>Activate &amp; Re-skin PWA Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stepper Footer Controls */}
      {!provisionResult && (
        <div className="flex items-center justify-between pt-6 border-t border-white/[0.08] mt-8">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="px-4 py-2 rounded-xl bg-[#161A1F] hover:bg-[#1E232B] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(6, prev + 1))}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.985] text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TenantConfigBuilder;
