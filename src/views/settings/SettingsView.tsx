/**
 * CAFE OS — Master Settings View (SettingsView.tsx)
 * 3-Column AutoClaw Industrial Canvas & RBAC Elevation Security Gate
 * Compliant with CafeOS-RBAC-Settings-Hardware-Handoff v2.4.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  Printer,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Zap,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  Radio,
} from 'lucide-react';
import {
  AppUserRole,
  RollWidthMm,
  StoreProfileConfig,
  FiscalRulesConfig,
  ReceiptTemplateConfig,
  SystemPreferencesConfig,
} from '../../types/rbac-settings';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsPrinters } from './SettingsPrinters';
import { SettingsRBAC } from './SettingsRBAC';
import { LiveReceiptPreview } from '../../components/LiveReceiptPreview';
import { PinAuthModal } from '../../components/modals/PinAuthModal';
import {
  SettingsService,
  DEFAULT_STORE_PROFILE,
  DEFAULT_FISCAL_RULES,
  DEFAULT_RECEIPT_TEMPLATE,
} from '../../services/settingsService';
import { ROLE_DEFINITIONS } from '../../services/RBACService';
import { audioFeedback } from '../../services/audioFeedback';

interface SettingsViewProps {
  currentUserRole: AppUserRole;
  currentUserName: string;
  onBackToPos: () => void;
  onRoleSwitch?: (role: AppUserRole) => void;
}

export type SettingsTab = 'general' | 'printers' | 'rbac';

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUserRole,
  currentUserName,
  onBackToPos,
  onRoleSwitch,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [selectedRollWidth, setSelectedRollWidth] = useState<RollWidthMm>(80);

  // Settings State for 3rd Column Live Inspector
  const [storeProfile, setStoreProfile] = useState<StoreProfileConfig>(DEFAULT_STORE_PROFILE);
  const [fiscalRules, setFiscalRules] = useState<FiscalRulesConfig>(DEFAULT_FISCAL_RULES);
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateConfig>(DEFAULT_RECEIPT_TEMPLATE);

  // Elevation State
  const [isElevated, setIsElevated] = useState<boolean>(
    currentUserRole === 'OWNER' || currentUserRole === 'MANAGER'
  );
  const [elevatedBy, setElevatedBy] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);

  // Guard: If BARISTA enters Settings without prior elevation, trigger PIN elevation modal immediately
  useEffect(() => {
    if (currentUserRole === 'BARISTA' && !isElevated) {
      setIsPinModalOpen(true);
    } else if (currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') {
      setIsElevated(true);
    }
  }, [currentUserRole, isElevated]);

  // Load preview data from IndexedDB
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await SettingsService.loadSettings();
        setStoreProfile(data.store_profile);
        setFiscalRules(data.fiscal_rules);
        setReceiptTemplate(data.receipt_template);
      } catch (err) {
        console.error('Failed to load settings preview:', err);
      }
    };
    fetchSettings();
  }, [activeTab]);

  const handleElevationSuccess = (authorizedBy: string) => {
    setIsElevated(true);
    setElevatedBy(authorizedBy);
    setIsPinModalOpen(false);
  };

  const handleElevationCancel = () => {
    setIsPinModalOpen(false);
    if (!isElevated) {
      onBackToPos();
    }
  };

  const roleDef = ROLE_DEFINITIONS[currentUserRole] || ROLE_DEFINITIONS.BARISTA;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0D0F12] text-white p-3 lg:p-5 select-none" dir="rtl">
      {/* 3-Column AutoClaw Industrial Layout */}
      <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 xl:gap-6">
        {/* =========================================================================
            COLUMN 1 (Left in RTL, 2.5 to 3 cols): Navigation Sidebar & Identity Panel
           ========================================================================= */}
        <aside className="lg:col-span-3 xl:col-span-2.5 space-y-4">
          {/* Back to POS Button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onBackToPos}
            className="w-full bg-[#161A1F] hover:bg-[#1F242C] border border-white/5 hover:border-white/20 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#D71921]" />
              <span>بازگشت به صندوق (POS)</span>
            </div>
            <span className="text-[10px] font-mono text-gray-500">ESC</span>
          </motion.button>

          {/* User & Security Status Card */}
          <div className="bg-[#161A1F] border border-white/5 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400">کاربر فعال فعلی:</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${roleDef.badgeBg}`}>
                سطح {roleDef.level} - {currentUserRole}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#1F242C] border border-white/10 flex items-center justify-center text-amber-400 font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-black text-white truncate">{currentUserName}</div>
                <div className="text-[11px] text-[#9EACB8] truncate">{roleDef.titleFa}</div>
              </div>
            </div>

            {/* Elevation Status Badge */}
            <div className="pt-2 border-t border-white/5">
              {isElevated ? (
                <div className="p-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Unlock className="w-3.5 h-3.5" />
                    <span>دسترسی تایید شد</span>
                  </span>
                  {elevatedBy && (
                    <span className="text-[10px] text-gray-300 font-mono truncate max-w-[110px]" title={elevatedBy}>
                      توسط: {elevatedBy}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsPinModalOpen(true)}
                  className="w-full p-2 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/40 rounded-lg flex items-center justify-between text-[11px] text-amber-400 font-bold transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>نیازمند تایید پین مدیر</span>
                  </span>
                  <span className="text-[10px] underline">ورود پین</span>
                </button>
              )}
            </div>

            {/* Quick Role Switcher for Testing */}
            {onRoleSwitch && (
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 block">
                  تغییر نقش آزمایشی سیستم:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  {(['OWNER', 'MANAGER', 'ACCOUNTANT', 'BARISTA'] as AppUserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        audioFeedback.playTap();
                        onRoleSwitch(r);
                        if (r === 'BARISTA') {
                          setIsElevated(false);
                          setElevatedBy(null);
                        } else {
                          setIsElevated(true);
                        }
                      }}
                      className={`px-2 py-1 rounded text-center font-bold transition-all cursor-pointer ${
                        currentUserRole === r
                          ? 'bg-[#D71921] text-white shadow-sm'
                          : 'bg-[#1F242C] hover:bg-[#282F3A] text-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Sidebar Tabs */}
          <nav className="bg-[#161A1F] border border-white/5 rounded-xl p-2 space-y-1">
            <button
              onClick={() => {
                audioFeedback.playTap();
                setActiveTab('general');
              }}
              className={`w-full p-2.5 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.4)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1F242C]'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>تنظیمات عمومی و مالیات</span>
            </button>

            <button
              onClick={() => {
                audioFeedback.playTap();
                setActiveTab('printers');
              }}
              className={`w-full p-2.5 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'printers'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.4)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1F242C]'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>چاپگرها و درگاه سخت‌افزار</span>
            </button>

            <button
              onClick={() => {
                audioFeedback.playTap();
                setActiveTab('rbac');
              }}
              className={`w-full p-2.5 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'rbac'
                  ? 'bg-[#D71921] text-white shadow-[0_0_15px_-3px_rgba(215,25,33,0.4)]'
                  : 'text-[#9EACB8] hover:text-white hover:bg-[#1F242C]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>سطوح دسترسی (RBAC) و پین</span>
            </button>
          </nav>
        </aside>

        {/* =========================================================================
            COLUMN 2 (Center, 6 to 7 cols): Active Settings View Tab
           ========================================================================= */}
        <main className="lg:col-span-6 xl:col-span-6.5">
          {activeTab === 'general' && (
            <SettingsGeneral
              onSaved={(newSettings) => {
                setStoreProfile(newSettings.store_profile);
                setFiscalRules(newSettings.fiscal_rules);
                setReceiptTemplate(newSettings.receipt_template);
              }}
            />
          )}

          {activeTab === 'printers' && (
            <SettingsPrinters
              onSelectedRollChange={(w) => setSelectedRollWidth(w)}
            />
          )}

          {activeTab === 'rbac' && <SettingsRBAC />}
        </main>

        {/* =========================================================================
            COLUMN 3 (Right in RTL, 3 cols): Real-Time Inspector & Live Thermal Receipt Preview
           ========================================================================= */}
        <aside className="lg:col-span-3 xl:col-span-3 space-y-4">
          <div className="bg-[#161A1F] border border-white/5 rounded-xl p-4 sticky top-20 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-black text-white">
                  پیش‌نمایش زنده فیش حرارتی (Live Preview)
                </h3>
              </div>
            </div>

            {/* Roll Width Switcher in Inspector */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[11px]">سایز رول شبیه‌ساز:</span>
              <div className="flex items-center bg-[#1F242C] p-0.5 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedRollWidth(58)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                    selectedRollWidth === 58
                      ? 'bg-[#D71921] text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRollWidth(80)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                    selectedRollWidth === 80
                      ? 'bg-[#D71921] text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* The Live Rendered Receipt Component */}
            <div className="py-2 flex justify-center">
              <LiveReceiptPreview
                storeProfile={storeProfile}
                fiscalRules={fiscalRules}
                receiptTemplate={receiptTemplate}
                rollWidthMm={selectedRollWidth}
              />
            </div>

            <div className="p-2.5 bg-[#0D0F12] rounded-lg border border-white/5 text-[10px] text-gray-400 space-y-1">
              <div className="text-gray-300 font-bold">وضعیت درایور محلی:</div>
              <div className="flex justify-between font-mono">
                <span>ESC/POS Standard:</span>
                <span className="text-emerald-400">READY</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>Code Page:</span>
                <span className="text-blue-400">CP1256 (Persian)</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>Storage Engine:</span>
                <span className="text-amber-400">IndexedDB (Dexie)</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Security Gate PIN Auth Modal */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        action="ACCESS_SETTINGS_PANEL"
        requestedByUser={currentUserName}
        onSuccess={handleElevationSuccess}
        onClose={handleElevationCancel}
      />
    </div>
  );
};
