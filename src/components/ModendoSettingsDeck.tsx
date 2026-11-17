/**
 * src/components/ModendoSettingsDeck.tsx
 * 
 * Modendo POS — Dedicated Operational Settings Deck
 * Styled with Liquid Glass Emerald Theme (#0b0e12 ground, #1B222C/70 glass cards, #10B981 emerald accent).
 * Strictly isolated from 100 HICH branding.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store,
  Printer,
  Users,
  Database,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  Layers,
  Gamepad2,
  Coffee,
  Sliders,
  QrCode,
  Copy,
  Check,
  Lock,
  Wifi,
} from 'lucide-react';
import { StationRoutingSettings } from '../views/settings/StationRoutingSettings';
import { SettingsRBAC } from '../views/settings/SettingsRBAC';
import { SettingsService, MODENDO_STORE_PROFILE, MODENDO_RECEIPT_TEMPLATE } from '../services/settingsService';
import { StoreProfileConfig, ReceiptTemplateConfig } from '../types/rbac-settings';
import { SmartOrdersStore } from '../services/storage';
import { playPosBeep } from '../services/soundEffects';
import { generateQrSvg } from '../utils/qrCodeGenerator';

interface ModendoSettingsDeckProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserName: string;
}

type SettingsSection = 'venue' | 'printers' | 'visual' | 'staff' | 'backup';

export const PURE_MODENDO_STORE_PROFILE: StoreProfileConfig = {
  name_fa: 'کافه گیمینگ مودندو',
  name_en: 'Modendo Gaming Lounge',
  address: 'تهران، خیابان شریعتی، مجتمع مودندو، منفی ۱',
  phone: '021-88994455',
  tax_registration_no: '14009876543',
};

export const ModendoSettingsDeck: React.FC<ModendoSettingsDeckProps> = ({
  isOpen,
  onClose,
  currentUserName,
}) => {
  if (!isOpen) return null;

  const [activeSection, setActiveSection] = useState<SettingsSection>('venue');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Store Profile State
  const [storeProfile, setStoreProfile] = useState<StoreProfileConfig>(PURE_MODENDO_STORE_PROFILE);

  // Receipt Template State
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateConfig>(MODENDO_RECEIPT_TEMPLATE);

  // Load persisted settings on mount
  useEffect(() => {
    SettingsService.loadSettings('tenant-modendo-01')
      .then((settings) => {
        if (
          settings?.store_profile &&
          !settings.store_profile.name_fa?.includes('۱۰۰') &&
          !settings.store_profile.name_fa?.includes('100')
        ) {
          setStoreProfile(settings.store_profile);
        }
        if (
          settings?.receipt_template &&
          !settings.receipt_template.header_lines?.some(
            (l: string) => l.includes('۱۰۰') || l.includes('100')
          )
        ) {
          setReceiptTemplate(settings.receipt_template);
        }
      })
      .catch((err) => {
        console.warn('[ModendoSettings] Failed loading settings:', err);
      });
  }, []);

  // Visual & Interface Tuning State (Modendo Namespace)
  const [backdropBlur, setBackdropBlur] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('modendo_glass_blur');
      return saved ? parseInt(saved, 10) : 28;
    } catch {
      return 28;
    }
  });

  const [tiltEnabled, setTiltEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('modendo_tilt_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const localMeshIp = 'http://192.168.1.200:3000';

  useEffect(() => {
    document.documentElement.style.setProperty('--glass-blur', `${backdropBlur}px`);
    try {
      localStorage.setItem('modendo_glass_blur', String(backdropBlur));
      localStorage.setItem('modendo_tilt_enabled', String(tiltEnabled));
    } catch {}
  }, [backdropBlur, tiltEnabled]);

  const handleCopyMeshLink = () => {
    try {
      navigator.clipboard.writeText(localMeshIp);
      setIsCopied(true);
      playPosBeep('click');
      setTimeout(() => setIsCopied(false), 2200);
    } catch {}
  };

  const handleSaveVenueSettings = async () => {
    try {
      await SettingsService.saveSettings(
        {
          store_profile: storeProfile,
          receipt_template: receiptTemplate,
        },
        'tenant-modendo-01'
      );
      playPosBeep('success');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('[ModendoSettings] Failed to save settings:', e);
      playPosBeep('delete');
    }
  };

  const handleExportBackup = () => {
    try {
      playPosBeep('click');
      const data = {
        tenant: 'modendo',
        exportedAt: new Date().toISOString(),
        storeProfile,
        receiptTemplate,
        menuItems: SmartOrdersStore.getMenuItems(),
        categories: SmartOrdersStore.getCategories(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Modendo_POS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ModendoSettings] Backup export error:', err);
    }
  };

  const handleResetModendoMenu = () => {
    if (confirm('آیا از بازنشانی منوی مودندو به فهرست ۸۱ قلمی استاندارد کافه و بازی اطمینان دارید؟')) {
      SmartOrdersStore.resetModendoMenuToSeed();
      playPosBeep('success');
      alert('منوی مودندو با موفقیت بازنشانی شد.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[88vh] flex flex-col rounded-3xl bg-[#0f141c]/95 border border-white/10 backdrop-blur-2xl shadow-2xl text-right overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0b0e12]/80 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              playPosBeep('click');
              onClose();
            }}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/30 font-bold">
                  MODENDO SETTINGS
                </span>
                <h2 className="text-base font-black text-white">
                  تنظیمات و پیکربندی کافه بردگیم مودندو
                </h2>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                مسیریابی چاپگرها، مشخصات کافه، فیش حرارتی و کنترل دسترسی پرسنل
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shadow-inner">
              <Gamepad2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Section Tabs Rail */}
        <div className="px-5 py-2.5 border-b border-white/[0.08] bg-[#12161D] flex items-center justify-between overflow-x-auto scrollbar-none gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#0b0e12] p-1 rounded-2xl border border-white/[0.08]">
            <button
              onClick={() => {
                playPosBeep('click');
                setActiveSection('venue');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === 'venue'
                  ? 'bg-white/[0.15] text-white font-black shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-[#10B981]" />
              <span>مشخصات کافه و فیش</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                setActiveSection('printers');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === 'printers'
                  ? 'bg-white/[0.15] text-white font-black shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>چاپگرها و مسیریابی بار/آشپزخانه</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                setActiveSection('visual');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === 'visual'
                  ? 'bg-white/[0.15] text-white font-black shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>رابط بصری و مش محلی</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                setActiveSection('staff');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === 'staff'
                  ? 'bg-white/[0.15] text-white font-black shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>پرسنل و کدهای PIN</span>
            </button>

            <button
              onClick={() => {
                playPosBeep('click');
                setActiveSection('backup');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === 'backup'
                  ? 'bg-white/[0.15] text-white font-black shadow-sm'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>پشتیبان‌گیری و دیتابیس</span>
            </button>
          </div>

          <div className="text-[11px] text-[#94A3B8] font-mono hidden md:block">
            کاربر جاری: <span className="text-white font-bold">{currentUserName}</span>
          </div>
        </div>

        {/* Section Body */}
        <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-6 overscroll-contain">
          {activeSection === 'venue' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-3">
                  <Store className="w-4 h-4 text-[#10B981]" />
                  <span>اطلاعات فروشگاه و شناسنامه کافه مودندو</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">نام رسمی مجموعه (فارسی)</label>
                    <input
                      type="text"
                      value={storeProfile.name_fa}
                      onChange={(e) => setStoreProfile({ ...storeProfile, name_fa: e.target.value })}
                      className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">نام بین‌المللی (انگلیسی)</label>
                    <input
                      type="text"
                      value={storeProfile.name_en}
                      onChange={(e) => setStoreProfile({ ...storeProfile, name_en: e.target.value })}
                      className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#94A3B8] mb-1">آدرس پستی</label>
                    <input
                      type="text"
                      value={storeProfile.address}
                      onChange={(e) => setStoreProfile({ ...storeProfile, address: e.target.value })}
                      className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">شماره تماس</label>
                    <input
                      type="text"
                      value={storeProfile.phone}
                      onChange={(e) => setStoreProfile({ ...storeProfile, phone: e.target.value })}
                      className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">شماره ثبت مالیاتی / کد اقتصادی</label>
                    <input
                      type="text"
                      value={storeProfile.tax_registration_no}
                      onChange={(e) => setStoreProfile({ ...storeProfile, tax_registration_no: e.target.value })}
                      className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Receipt Template */}
              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-3">
                  <Coffee className="w-4 h-4 text-emerald-400" />
                  <span>تنظیمات سربرگ و پانویس فیش حرارتی</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">سطرهای سربرگ فیش (Header Lines)</label>
                    {receiptTemplate.header_lines.map((line, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={line}
                        onChange={(e) => {
                          const updated = [...receiptTemplate.header_lines];
                          updated[idx] = e.target.value;
                          setReceiptTemplate({ ...receiptTemplate, header_lines: updated });
                        }}
                        className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#10B981] outline-none mb-1.5 font-mono"
                      />
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">سطرهای پانویس فیش (Footer Lines)</label>
                    {receiptTemplate.footer_lines.map((line, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={line}
                        onChange={(e) => {
                          const updated = [...receiptTemplate.footer_lines];
                          updated[idx] = e.target.value;
                          setReceiptTemplate({ ...receiptTemplate, footer_lines: updated });
                        }}
                        className="w-full bg-[#0b0e12] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#10B981] outline-none mb-1.5 font-mono"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {saveSuccess && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تنظیمات مودندو با موفقیت ذخیره شد.</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveVenueSettings}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'printers' && (
            <div className="animate-fadeIn">
              <StationRoutingSettings />
            </div>
          )}

          {activeSection === 'visual' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12">
              {/* 1. Liquid Glass & Blur Tuning */}
              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-3">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>تنظیمات نمای شیشه‌ای مایع (Liquid Glass)</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1.5">
                      <span>شدت محوشدگی شیشه پس‌زمینه (Backdrop Blur):</span>
                      <span className="font-mono font-bold text-emerald-400">{backdropBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={48}
                      value={backdropBlur}
                      onChange={(e) => setBackdropBlur(Number(e.target.value))}
                      className="w-full accent-[#10B981] bg-white/10 h-2 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1 font-mono">
                      <span>16px (روشن‌تر / شارپ)</span>
                      <span>28px (استاندارد مودندو)</span>
                      <span>48px (تار عمیق)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div>
                      <span className="text-xs font-bold text-white block">افکت پرسپکتیو ۳ بعدی کارت‌ها (3D Tilt)</span>
                      <span className="text-[11px] text-[#94A3B8]">حرکت ملایم کارت‌های سالن و ماژول‌ها با اسکرول و تعامل</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tiltEnabled}
                        onChange={(e) => setTiltEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981] border border-white/10"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. Locked Terminal ID Lock */}
              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>شناسه پایانه صندوق قفل‌شده (Terminal ID Lock)</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    MODENDO-TERM-01
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#0b0e12]/80 p-3 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[#94A3B8] text-[11px]">شعبه فعال:</span>
                    <p className="text-white font-bold">کافه بردگیم و بیسترو مودندو</p>
                  </div>
                  <div className="bg-[#0b0e12]/80 p-3 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[#94A3B8] text-[11px]">وضعیت قفل سخت‌افزاری:</span>
                    <p className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>قفل‌شده روی پایانه اصلی صندوق</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Local Mesh & QR Sync */}
              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-3">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span>مش محلی و جفت‌سازی تبلت‌های سالن (Local Mesh & Pairing)</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div
                    className="p-3 bg-white rounded-2xl shadow-lg shrink-0"
                    dangerouslySetInnerHTML={{
                      __html: generateQrSvg(
                        JSON.stringify({
                          role: 'table_client',
                          master: localMeshIp,
                          venue: 'modendo-cafe',
                          deviceId: 'MODENDO-TERM-01',
                          token: 'MOD-PAIR-2026',
                        }),
                        { size: 140 }
                      ),
                    }}
                  />

                  <div className="space-y-3 flex-1 text-xs">
                    <p className="text-[#94A3B8] leading-relaxed">
                      برای اتصال تبلت‌های ثبت سفارش بر سر میز یا نمایشگر سالن به این صندوق، کد QR را اسکن کنید یا آدرس سرور محلی زیر را وارد نمایید:
                    </p>

                    <div className="flex items-center gap-2 bg-[#0b0e12] p-2.5 rounded-xl border border-white/10 font-mono text-xs">
                      <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-white truncate flex-1" dir="ltr">{localMeshIp}</span>
                      <button
                        type="button"
                        onClick={handleCopyMeshLink}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#cbd5e1] hover:text-white transition flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'کپی شد' : 'کپی'}</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>اتصال مش محلی آماده پذیرش تبلت‌های سفارش‌گیر شعبه مودندو</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'staff' && (
            <div className="animate-fadeIn">
              <SettingsRBAC />
            </div>
          )}

          {activeSection === 'backup' && (
            <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn">
              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-3">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>پشتیبان‌گیری از داده‌های کافه مودندو</span>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  خروجی یک فایل کامل JSON از تنظیمات، منوی اقلام، دسته‌بندی‌ها و پیکربندی‌های مودندو دریافت کنید. این فایل برای بازیابی آنی در پایانه‌های دیگر یا بازگشت به نقطه امن کاربرد دارد.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>دانلود فایل پشتیبان (JSON)</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#1B222C]/70 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/10 pb-3">
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span>بازنشانی منوی مودندو به بذر اولیه</span>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  منوی مودندو را به ۸۱ قلم استاندارد اولیه (دسته‌های نوشیدنی گرم، سرد، بار باریستا، میان‌وعده و تعرفه PS5) بازنشانی کنید. این عمل قیمت‌ها و فرمول‌های اصلاحی را به نسخه استاندارد بازمی‌گرداند.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResetModendoMenu}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-emerald-300" />
                    <span>بازنشانی منوی ۸۱ قلمی مودندو</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
