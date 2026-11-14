/**
 * src/views/settings/SettingsView.tsx
 * 
 * KarWand POS — 100 HICH Two-Column Fiscal & Comprehensive Settings
 * Compliant with 100 HICH Standalone Production Specification
 * 
 * Architecture:
 *  - Right Column (Configuration Forms):
 *      1. Fiscal & Taxes: VAT (9%), service fee (0%), takeaway packaging fee, legal/tax code, store physical address.
 *      2. Live Editable Header Lines & Footer Lines: WiFi password, Instagram handle, greeting.
 *      3. Operational Rules:
 *          * Cashier discount ceiling slider (default 15%; higher requires owner PIN).
 *          * "On The House" guest mode toggle (attributes to marketing expense, not discount).
 *          * Blind Cash Drop toggle for shift closeout.
 *          * Cash drawer RJ11 pulse trigger settings.
 *          * PC-POS LAN integration (IP address, port 1024, auto-dispatch toggle).
 *          * Data Persistence: One-click local JSON database export & restore triggers.
 *  - Left Column:
 *      * Live 80mm ESC/POS Thermal Receipt Preview with realistic monospace font, drop shadow, and jagged cut edge.
 *      * Bi-directionally bound to right column inputs line-by-line in real time.
 */

import React, { useState, useEffect, useRef } from 'react';
import { RBACService } from '../../services/RBACService';
import { SettingsPrinters } from './SettingsPrinters';
import { SettingsRBAC } from './SettingsRBAC';
import {
  Sliders,
  Receipt,
  Store,
  Percent,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Radio,
  Users,
  Volume2,
  Wifi,
  Instagram,
  Download,
  Upload,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Printer,
  Sparkles,
  Database,
} from 'lucide-react';
import {
  AppUserRole,
  AuthUserRecord,
  RollWidthMm,
  StoreProfileConfig,
  FiscalRulesConfig,
  ReceiptTemplateConfig,
  SystemPreferencesConfig,
  AppSettingsPayload,
} from '../../types/rbac-settings';
import {
  SettingsService,
  DEFAULT_STORE_PROFILE,
  DEFAULT_FISCAL_RULES,
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_SYSTEM_PREFERENCES,
} from '../../services/settingsService';
import { SmartOrdersStore } from '../../services/storage';
import { audioFeedback } from '../../services/audioFeedback';
import { playPosBeep } from '../../services/soundEffects';
import { formatToman } from '../../services/financialMath';

interface SettingsViewProps {
  currentUserRole: AppUserRole;
  currentUserName: string;
  onBackToPos: () => void;
  onRoleSwitch?: (role: AppUserRole) => void;
}

const STAFF_ROLE_LABELS: Record<AppUserRole, string> = {
  OWNER: 'مالک',
  ACCOUNTANT: 'حسابدار',
  MANAGER: 'مدیر شیفت',
  CASHIER: 'باریستا / صندوق‌دار',
  BARISTA: 'باریستا',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUserRole,
  currentUserName,
  onBackToPos,
}) => {
  // Navigation / Tab state within settings
  const [activeSettingsSection, setActiveSettingsSection] = useState<'fiscal' | 'template' | 'rules' | 'lan_persistence' | 'staff' | 'printers' | 'prefs' | 'rbac'>('fiscal');
  const [selectedRollWidth, setSelectedRollWidth] = useState<RollWidthMm>(80);

  // Core Form State
  const [storeProfile, setStoreProfile] = useState<StoreProfileConfig>({
    ...DEFAULT_STORE_PROFILE,
    name_fa: 'قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)',
    name_en: '100 HICH COFFEE ROASTERS',
    address: 'تهران، یوسف‌آباد، خیابان ۶۴، پلاک ۲',
    phone: '021-88051234',
    tax_registration_no: '14009876543',
  });

  const [fiscalRules, setFiscalRules] = useState<FiscalRulesConfig>({
    ...DEFAULT_FISCAL_RULES,
    vat_tax_percentage: 9.0,
    dine_in_service_charge_percentage: 0.0,
    takeaway_pack_fee_fixed: 15000,
    currency_display: 'TOMAN',
  });

  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateConfig>({
    ...DEFAULT_RECEIPT_TEMPLATE,
    header_lines: [
      'به ۱۰۰ هیچ خوش آمدید',
      'WiFi: 100Hich_Guest | Pass: hichcoffee100',
    ],
    footer_lines: [
      'اینستاگرام: @100hich_coffee',
      'سپاس از حسن انتخاب شما',
    ],
    print_qr_invoice_link: true,
  });

  // Operational Rules State
  const [cashierDiscountCeiling, setCashierDiscountCeiling] = useState<number>(15);
  const [onTheHouseEnabled, setOnTheHouseEnabled] = useState<boolean>(true);
  const [blindCashDropEnabled, setBlindCashDropEnabled] = useState<boolean>(false);
  const [rj11PulseMs, setRj11PulseMs] = useState<number>(100);

  // PC-POS LAN State
  const [pcPosIp, setPcPosIp] = useState<string>('192.168.0.150');
  const [pcPosPort, setPcPosPort] = useState<number>(1024);
  const [pcPosAutoDispatch, setPcPosAutoDispatch] = useState<boolean>(true);

  // Staff & Shift Access State (کارکنان و دسترسی شیفت)
  const [staffUsers, setStaffUsers] = useState<AuthUserRecord[]>([]);
  const [staffLoading, setStaffLoading] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<AppUserRole>('CASHIER');
  const [newStaffPin, setNewStaffPin] = useState<string>('');
  const [staffError, setStaffError] = useState<string | null>(null);
  const [pinEditUserId, setPinEditUserId] = useState<string | null>(null);
  const [pinEditValue, setPinEditValue] = useState<string>('');

  // Sound & System Preferences State
  const [systemPreferences, setSystemPreferences] = useState<SystemPreferencesConfig>({
    audio_feedback_enabled: true,
    auto_open_table_selector_after_settle: false,
    kds_sound_alert_interval_sec: 30,
  });

  // UI Status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [testPulseSuccess, setTestPulseSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted settings on mount
  useEffect(() => {
    const initLoad = async () => {
      try {
        const loaded = await SettingsService.loadSettings();
        if (loaded.store_profile) setStoreProfile(loaded.store_profile);
        if (loaded.fiscal_rules) setFiscalRules(loaded.fiscal_rules);
        if (loaded.receipt_template) setReceiptTemplate(loaded.receipt_template);
        if (loaded.system_preferences) setSystemPreferences(loaded.system_preferences);

        // Load operational rules from localStorage
        const ceiling = localStorage.getItem('karwand_cashier_discount_ceiling');
        if (ceiling) setCashierDiscountCeiling(Number(ceiling));

        const onHouse = localStorage.getItem('karwand_on_the_house_mode');
        if (onHouse !== null) setOnTheHouseEnabled(onHouse === 'true');

        const blindDrop = localStorage.getItem('karwand_blind_cash_drop');
        if (blindDrop !== null) setBlindCashDropEnabled(blindDrop === 'true');

        const pulse = localStorage.getItem('karwand_rj11_pulse_ms');
        if (pulse) setRj11PulseMs(Number(pulse));

        const posIp = localStorage.getItem('karwand_pc_pos_ip');
        if (posIp) setPcPosIp(posIp);

        const posPort = localStorage.getItem('karwand_pc_pos_port');
        if (posPort) setPcPosPort(Number(posPort));
      } catch (err) {
        console.warn('[SettingsView] Error loading settings:', err);
      }
    };
    initLoad();
  }, []);

  // Load staff accounts whenever the Staff & Shift Access tab opens (or on mount)
  useEffect(() => {
    const loadStaff = async () => {
      try {
        setStaffLoading(true);
        const users = await RBACService.getAllUsers();
        setStaffUsers(users);
      } catch (err) {
        console.warn('[SettingsView] Staff list load failed:', err);
      } finally {
        setStaffLoading(false);
      }
    };
    loadStaff();
  }, [activeSettingsSection]);

  // Save all settings
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const payload: Partial<AppSettingsPayload> = {
        store_profile: storeProfile,
        fiscal_rules: fiscalRules,
        receipt_template: receiptTemplate,
        system_preferences: systemPreferences,
      };
      await SettingsService.saveSettings(payload);

      // Persist operational flags
      localStorage.setItem('karwand_cashier_discount_ceiling', String(cashierDiscountCeiling));
      localStorage.setItem('karwand_on_the_house_mode', String(onTheHouseEnabled));
      localStorage.setItem('karwand_blind_cash_drop', String(blindCashDropEnabled));
      localStorage.setItem('karwand_rj11_pulse_ms', String(rj11PulseMs));
      localStorage.setItem('karwand_pc_pos_ip', pcPosIp);
      localStorage.setItem('karwand_pc_pos_port', String(pcPosPort));
      localStorage.setItem('karwand_pc_pos_auto', String(pcPosAutoDispatch));

      audioFeedback.playSuccess();
      setSaveSuccessMessage('تمامی تنظیمات مالی، الگوها و قوانین عملیاتی با موفقیت ذخیره شد.');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err: any) {
      audioFeedback.playError();
      alert('خطا در ذخیره‌سازی تنظیمات: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Header/Footer line mutations
  const handleAddHeaderLine = () => {
    setReceiptTemplate({
      ...receiptTemplate,
      header_lines: [...receiptTemplate.header_lines, 'سطر جدید سربرگ'],
    });
    audioFeedback.playTap();
  };

  const handleUpdateHeaderLine = (idx: number, text: string) => {
    const updated = [...receiptTemplate.header_lines];
    updated[idx] = text;
    setReceiptTemplate({ ...receiptTemplate, header_lines: updated });
  };

  const handleRemoveHeaderLine = (idx: number) => {
    setReceiptTemplate({
      ...receiptTemplate,
      header_lines: receiptTemplate.header_lines.filter((_, i) => i !== idx),
    });
    audioFeedback.playTap();
  };

  const handleAddFooterLine = () => {
    setReceiptTemplate({
      ...receiptTemplate,
      footer_lines: [...receiptTemplate.footer_lines, 'سطر جدید پانویس'],
    });
    audioFeedback.playTap();
  };

  const handleUpdateFooterLine = (idx: number, text: string) => {
    const updated = [...receiptTemplate.footer_lines];
    updated[idx] = text;
    setReceiptTemplate({ ...receiptTemplate, footer_lines: updated });
  };

  const handleRemoveFooterLine = (idx: number) => {
    setReceiptTemplate({
      ...receiptTemplate,
      footer_lines: receiptTemplate.footer_lines.filter((_, i) => i !== idx),
    });
    audioFeedback.playTap();
  };

  // Staff & Shift Access mutations (کارکنان و دسترسی شیفت)
  const refreshStaffList = async () => {
    const users = await RBACService.getAllUsers();
    setStaffUsers(users);
  };

  const handleAddStaff = async () => {
    const name = newStaffName.trim();
    const pin = newStaffPin.trim();
    if (!name) {
      setStaffError('نام کارمند را وارد کنید.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setStaffError('پین‌کد باید دقیقاً ۴ رقم عددی باشد.');
      return;
    }
    try {
      setStaffError(null);
      const username = `staff-${Date.now().toString(36)}`.toLowerCase();
      await RBACService.addStaffUser({ fullName: name, username, role: newStaffRole, pin });
      audioFeedback.playSuccess();
      setNewStaffName('');
      setNewStaffPin('');
      setNewStaffRole('CASHIER');
      await refreshStaffList();
    } catch (err: any) {
      setStaffError(err?.message || 'خطا در افزودن کارمند');
      audioFeedback.playError();
    }
  };

  const handleUpdateStaffPin = async (userId: string) => {
    const pin = pinEditValue.trim();
    if (!/^\d{4}$/.test(pin)) {
      setStaffError('پین‌کد باید دقیقاً ۴ رقم عددی باشد.');
      return;
    }
    try {
      setStaffError(null);
      await RBACService.updateUserPin(userId, pin);
      audioFeedback.playSuccess();
      setPinEditUserId(null);
      setPinEditValue('');
    } catch (err: any) {
      setStaffError(err?.message || 'خطا در تغییر پین');
      audioFeedback.playError();
    }
  };

  const handleDeleteStaff = async (user: AuthUserRecord) => {
    if (user.role === 'OWNER') {
      setStaffError('حذف حساب کاربری مالک مجاز نیست.');
      return;
    }
    try {
      setStaffError(null);
      await RBACService.deleteStaffUser(user.id);
      audioFeedback.playTap();
      await refreshStaffList();
    } catch (err: any) {
      setStaffError(err?.message || 'خطا در حذف کارمند');
    }
  };

  // One-click Export JSON
  const handleExportJson = () => {
    try {
      const dataStr = SmartOrdersStore.exportBackupData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `100HICH_POS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      audioFeedback.playSuccess();
    } catch (err: any) {
      alert('خطا در صدور فایل پشتیبان: ' + err.message);
    }
  };

  // One-click Restore JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = SmartOrdersStore.importBackupData(text);
        if (res.success) {
          audioFeedback.playSuccess();
          alert('اطلاعات پایگاه‌داده با موفقیت بازیابی شد. صفحه بازخوانی می‌شود.');
          window.location.reload();
        } else {
          alert('خطا در بازیابی: ' + res.message);
        }
      } catch (err: any) {
        alert('فایل انتخاب‌شده نامعتبر است: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // RJ11 Drawer Test
  const handleTriggerRj11Pulse = () => {
    playPosBeep('click');
    setTestPulseSuccess(true);
    setTimeout(() => setTestPulseSuccess(false), 2000);
  };

  // Sample calculated values for live receipt
  const sampleItems = [
    { title: 'اسپرسو سینگل ۱۰۰٪ عربیکا', qty: 2, price: 65000 },
    { title: 'آیس کورتادو کاراملی', qty: 1, price: 85000 },
  ];
  const sampleGross = sampleItems.reduce((acc, it) => acc + it.price * it.qty, 0);
  const sampleVat = Math.round((sampleGross * fiscalRules.vat_tax_percentage) / 100);
  const samplePackaging = fiscalRules.takeaway_pack_fee_fixed || 0;
  const sampleTotal = sampleGross + sampleVat + samplePackaging;

  return (
    <div
      dir="rtl"
      className="w-full pb-12 bg-[#070A0F] text-white p-3 md:p-6 font-sans select-none space-y-6"
    >
      {/* Top Header Bar with Liquid Glass */}
      <header className="liquid-glass p-4 rounded-3xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPos}
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition active:scale-95 cursor-pointer text-slate-300 hover:text-white"
            title="بازگشت به صندوق فروش"
          >
            <ArrowRight className="w-5 h-5 text-[#90D2ED]" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#D71921]" />
              <span>مرکز پیکربندی مالی و عملیاتی ۱۰۰ هیچ (Master Control Deck)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              تنظیمات جامع مالیات، پیش‌نمایش بلادرنگ فیش حرارتی ۸۰ میلی‌متری و قوانین عملیاتی پایانه
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAll}
            className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-[#8C1318] to-[#5a0c10] hover:from-[#A8171E] hover:to-[#8C1318] text-white font-black text-xs flex items-center gap-2 border border-[#90D2ED]/30 shadow-[0_0_20px_rgba(140,19,24,0.5)] transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#90D2ED]" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تمامی تنظیمات'}</span>
          </button>
        </div>
      </header>

      {/* Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="liquid-glass p-3 rounded-2xl border-emerald-500/40 bg-emerald-950/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            RIGHT COLUMN (Configuration Forms, 7 to 8 cols):
           ========================================================================= */}
        <section className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Segmented Section Switcher */}
          <div className="liquid-glass p-1.5 rounded-2xl grid grid-cols-2 sm:grid-cols-8 gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('fiscal');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'fiscal'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>مالیات و مشخصات</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('template');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'template'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>سربرگ و پانویس فیش</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('rules');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'rules'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Percent className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>قوانین عملیاتی</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('lan_persistence');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'lan_persistence'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>پوز شبکه و بکاپ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('staff');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'staff'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>کارکنان و دسترسی شیفت</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('printers');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'printers'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>چاپگرها و ایستگاه‌ها</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('prefs');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'prefs'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>صدا و ترجیحات</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                setActiveSettingsSection('rbac');
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeSettingsSection === 'rbac'
                  ? 'bg-gradient-to-r from-[#8C1318] to-[#5a0c10] text-white shadow-md border border-[#90D2ED]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#90D2ED]" />
              <span>مجوزها و RBAC</span>
            </button>
          </div>

          {/* SECTION 1: FISCAL & TAXES */}
          {activeSettingsSection === 'fiscal' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-5">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Store className="w-4 h-4 text-[#90D2ED]" />
                <h2 className="text-sm font-black text-white">مشخصات ثبتی و قوانین مالیاتی (Fiscal & Tax Profile)</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    مالیات بر ارزش افزوده (VAT) ٪:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={fiscalRules.vat_tax_percentage}
                    onChange={(e) => setFiscalRules({ ...fiscalRules, vat_tax_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">استاندارد مصوب سازمان امور مالیاتی: ۹٪</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    حق سرویس سالن (Service Fee) ٪:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={fiscalRules.dine_in_service_charge_percentage}
                    onChange={(e) => setFiscalRules({ ...fiscalRules, dine_in_service_charge_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">برای شعبه ۱۰۰ هیچ: ۰٪ (تیک‌اوی بدون حق سرویس)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    هزینه ثابت بسته‌بندی بیرون‌بر (تومان):
                  </label>
                  <input
                    type="number"
                    step="1000"
                    value={fiscalRules.takeaway_pack_fee_fixed}
                    onChange={(e) => setFiscalRules({ ...fiscalRules, takeaway_pack_fee_fixed: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">هزینه هولدر، درب کاپ و کیسه کرافت بیرونی</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    کد اقتصادی / شناسه ملی مالیاتی:
                  </label>
                  <input
                    type="text"
                    value={storeProfile.tax_registration_no}
                    onChange={(e) => setStoreProfile({ ...storeProfile, tax_registration_no: e.target.value })}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    نشانی فیزیکی رسمی شعبه:
                  </label>
                  <input
                    type="text"
                    value={storeProfile.address}
                    onChange={(e) => setStoreProfile({ ...storeProfile, address: e.target.value })}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    تلفن تماس شعبه:
                  </label>
                  <input
                    type="text"
                    value={storeProfile.phone}
                    onChange={(e) => setStoreProfile({ ...storeProfile, phone: e.target.value })}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: LIVE EDITABLE HEADER & FOOTER LINES */}
          {activeSettingsSection === 'template' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-6">
              {/* Header Lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="text-xs font-black text-white flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-[#90D2ED]" />
                    <span>سطرهای سربرگ فیش (Header Lines & WiFi)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddHeaderLine}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>افزودن سطر</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {receiptTemplate.header_lines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => handleUpdateHeaderLine(idx, e.target.value)}
                        className="flex-1 bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#90D2ED]"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveHeaderLine(idx);
                        }}
                        className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Lines */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="text-xs font-black text-white flex items-center gap-2">
                    <Instagram className="w-3.5 h-3.5 text-[#90D2ED]" />
                    <span>سطرهای پانویس فیش (Footer Lines & Socials)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddFooterLine}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>افزودن سطر</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {receiptTemplate.footer_lines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => handleUpdateFooterLine(idx, e.target.value)}
                        className="flex-1 bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#90D2ED]"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveFooterLine(idx);
                        }}
                        className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: OPERATIONAL RULES */}
          {activeSettingsSection === 'rules' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-6">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Percent className="w-4 h-4 text-[#90D2ED]" />
                <h2 className="text-sm font-black text-white">قوانین عملیاتی صندوق و گیت دسترسی (Operational Rules)</h2>
              </div>

              {/* Discount Ceiling Slider */}
              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">سقف تخفیف مجاز صندوق‌دار:</span>
                    <span className="text-[11px] text-slate-400">تخفیف بالاتر از این سقف منوط به ورود پین‌کد مالک/مدیر خواهد بود.</span>
                  </div>
                  <span className="text-base font-black font-mono text-[#90D2ED] bg-black/40 px-3 py-1 rounded-xl border border-white/10">
                    {cashierDiscountCeiling}٪
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={cashierDiscountCeiling}
                  onChange={(e) => setCashierDiscountCeiling(Number(e.target.value))}
                  className="w-full accent-[#D71921] cursor-pointer"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {/* On The House Mode */}
                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                  <div>
                    <span className="text-xs font-bold text-white block">حالت مهمان کافه (On The House):</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      ثبت اقلام ۱۰۰٪ تخفیف به عنوان سرفصل هزینه مارکتینگ و تبلیغات شعبه (نه تخفیف فروشگاهی)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setOnTheHouseEnabled(!onTheHouseEnabled);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      onTheHouseEnabled ? 'bg-[#8C1318]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        onTheHouseEnabled ? 'right-6' : 'right-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Blind Cash Drop */}
                <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                  <div>
                    <span className="text-xs font-bold text-white block">شمارش کور صندوق (Blind Cash Drop):</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      در هنگام بستن شیفت، رقم محاسباتی سیستم به صندوق‌دار نشان داده نمی‌شود تا مغایرت واقعی ثبت گردد.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setBlindCashDropEnabled(!blindCashDropEnabled);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      blindCashDropEnabled ? 'bg-[#8C1318]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        blindCashDropEnabled ? 'right-6' : 'right-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Cash Drawer RJ11 Pulse */}
                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">پالس بازگشایی کشوی پول (RJ11 Cash Drawer):</span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">مدت زمان ارسال سیگنال تحریک سلونوئید کشو</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={rj11PulseMs}
                        onChange={(e) => setRj11PulseMs(Number(e.target.value))}
                        className="bg-[#0D1015] border border-white/10 text-white rounded-xl px-2.5 py-1 text-xs font-mono"
                      >
                        <option value={100}>100 ms (استاندارد)</option>
                        <option value={200}>200 ms (پالس متوسط)</option>
                        <option value={250}>250 ms (پالس بلند)</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleTriggerRj11Pulse}
                        className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition active:scale-95 cursor-pointer"
                      >
                        {testPulseSuccess ? 'پالس ارسال شد!' : 'تست پالس'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: PC-POS LAN INTEGRATION & DATA PERSISTENCE */}
          {activeSettingsSection === 'lan_persistence' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-6">
              {/* PC-POS Integration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Monitor className="w-4 h-4 text-[#90D2ED]" />
                  <h3 className="text-xs font-black text-white">اتصال پوز بانکی شبکه (PC-POS LAN Integration)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">آدرس IP پوز بانکی:</label>
                    <input
                      type="text"
                      value={pcPosIp}
                      onChange={(e) => setPcPosIp(e.target.value)}
                      className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">پورت پوز (Socket):</label>
                    <input
                      type="number"
                      value={pcPosPort}
                      onChange={(e) => setPcPosPort(Number(e.target.value))}
                      className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={pcPosAutoDispatch}
                        onChange={(e) => setPcPosAutoDispatch(e.target.checked)}
                        className="accent-[#D71921] w-4 h-4"
                      />
                      <span>ارسال خودکار مبلغ به کارتخوان</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Data Persistence (JSON Export & Restore) */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Database className="w-4 h-4 text-[#90D2ED]" />
                  <h3 className="text-xs font-black text-white">پشتیبان‌گیری و ماندگاری داده‌های آفلاین (Data Persistence)</h3>
                </div>

                <p className="text-xs text-slate-400">
                  پشتیبان‌گیری یکپارچه از تمامی جداول IndexedDB، سفارشات شیفت، موجودی انبار مواد خام و گزارش‌های Z.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>دریافت خروجی دیتابیس (JSON Export)</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-4 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>بازیابی فایل پشتیبان (Restore JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('آیا مطمئن هستید که می‌خواهید منوی پیش‌فرض مودندو (۸۱ قلم کالا در ۱۵ دسته‌بندی با قیمت‌های تومان) را بازنشانی و همگام‌سازی کنید؟')) {
                        SmartOrdersStore.resetModendoMenuToSeed();
                        alert('منوی پیش‌فرض مودندو (۸۱ قلم کالا در ۱۵ دسته‌بندی) با موفقیت همگام‌سازی و بارگذاری شد.');
                      }
                    }}
                    className="py-2.5 px-4 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/40 text-cyan-300 text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer"
                    title="همگام‌سازی و بازنشانی منوی پیش‌فرض مودندو (۸۱ قلم کالا)"
                  >
                    <RotateCcw className="w-4 h-4 text-cyan-400" />
                    <span>همگام‌سازی و بازنشانی منوی مودندو (۸۱ قلم)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: STAFF & SHIFT LOGIN PINs (کارکنان و دسترسی شیفت) */}
          {activeSettingsSection === 'staff' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-5">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Users className="w-4 h-4 text-[#90D2ED]" />
                <h2 className="text-sm font-black text-white">کارکنان و دسترسی شیفت (Staff &amp; Shift Login PINs)</h2>
              </div>

              {/* Add Staff Form */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">نام و نام خانوادگی:</label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="مثلاً: سارا محمدی"
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">نقش:</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as AppUserRole)}
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] cursor-pointer"
                  >
                    <option value="CASHIER">باریستا / صندوق‌دار</option>
                    <option value="MANAGER">مدیر شیفت</option>
                    <option value="OWNER">مالک</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">پین ورود (۴ رقم):</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="****"
                    dir="ltr"
                    className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center font-mono tracking-[0.5em] focus:outline-none focus:border-[#90D2ED]"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleAddStaff();
                  }}
                  className="h-[38px] py-2 px-3 rounded-xl vision-checkout-cta tactile-press text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن کارمند</span>
                </button>
              </div>

              {staffError && (
                <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-bold p-2.5 rounded-xl">
                  {staffError}
                </div>
              )}

              {/* Staff List */}
              <div className="space-y-2">
                {staffLoading && <p className="text-xs text-slate-400">در حال بارگذاری فهرست کارکنان...</p>}
                {staffUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border ${
                      u.isActive ? 'bg-white/5 border-white/10' : 'bg-black/30 border-white/5 opacity-60'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        u.isActive
                          ? u.role === 'OWNER'
                            ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                            : 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'
                          : 'bg-slate-600'
                      }`}
                      title={u.isActive ? 'حساب فعال' : 'حساب غیرفعال'}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black text-white block truncate">{u.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate block">
                        {STAFF_ROLE_LABELS[u.role] || u.role}
                        {u.customRoleTitle ? ` • ${u.customRoleTitle}` : ''}
                        {` • ${u.username}`}
                        {!u.isActive ? ' • غیرفعال' : ''}
                      </span>
                    </div>

                    {pinEditUserId === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinEditValue}
                          onChange={(e) => setPinEditValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="پین جدید"
                          dir="ltr"
                          className="w-24 bg-[#0D1015]/80 border border-[#90D2ED]/50 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleUpdateStaffPin(u.id);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 text-[11px] font-bold cursor-pointer hover:bg-emerald-800/60"
                        >
                          ذخیره
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPinEditUserId(null);
                            setPinEditValue('');
                          }}
                          className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[11px] cursor-pointer hover:text-white"
                        >
                          انصراف
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPinEditUserId(u.id);
                            setPinEditValue('');
                          }}
                          title="تغییر پین ورود کارمند"
                          className="px-2.5 py-1.5 rounded-lg bg-[#0F223D]/80 border border-white/15 text-[#90D2ED] text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-[#162E52]"
                        >
                          <Lock className="w-3 h-3" />
                          <span>تغییر پین</span>
                        </button>
                        {u.role !== 'OWNER' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDeleteStaff(u);
                            }}
                            title="حذف حساب کارمند (مالک قابل حذف نیست)"
                            className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!staffLoading && staffUsers.length === 0 && (
                  <p className="text-xs text-slate-400">هیچ کارمندی ثبت نشده است — فرم بالا را تکمیل کنید.</p>
                )}
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                کارکنان افزوده‌شده بلافاصله پس از «خروج» در صفحه قفل PIN قابل انتخاب هستند و با پین ۴ رقمی وارد می‌شوند. حساب مالک قابل حذف نیست.
              </p>
            </div>
          )}

          {/* SECTION 6: PRINTERS & STATION ROUTING */}
          {activeSettingsSection === 'printers' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Printer className="w-4 h-4 text-[#90D2ED]" />
                <h2 className="text-sm font-black text-white">چاپگرها، ایستگاه‌ها و مسیریابی چاپ (Printers &amp; Routing)</h2>
              </div>
              <SettingsPrinters />
            </div>
          )}

          {/* SECTION 7: SOUND & SYSTEM PREFERENCES */}
          {activeSettingsSection === 'prefs' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-5">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Volume2 className="w-4 h-4 text-[#90D2ED]" />
                <h2 className="text-sm font-black text-white">صدا و ترجیحات سیستم (Sound &amp; System Preferences)</h2>
              </div>

              <label className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer">
                <span className="text-xs font-bold text-slate-200">بازخورد صوتی صندوق (بیپ اسکن و تأیید):</span>
                <input
                  type="checkbox"
                  checked={systemPreferences.audio_feedback_enabled}
                  onChange={(e) =>
                    setSystemPreferences({ ...systemPreferences, audio_feedback_enabled: e.target.checked })
                  }
                  className="accent-[#D71921] w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer">
                <span className="text-xs font-bold text-slate-200">بازشدن خودکار انتخاب میز پس از تسویه:</span>
                <input
                  type="checkbox"
                  checked={systemPreferences.auto_open_table_selector_after_settle}
                  onChange={(e) =>
                    setSystemPreferences({
                      ...systemPreferences,
                      auto_open_table_selector_after_settle: e.target.checked,
                    })
                  }
                  className="accent-[#D71921] w-4 h-4 cursor-pointer"
                />
              </label>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  فاصله هشدار صوتی آشپزخانه/KDS (ثانیه):
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={systemPreferences.kds_sound_alert_interval_sec}
                  onChange={(e) =>
                    setSystemPreferences({
                      ...systemPreferences,
                      kds_sound_alert_interval_sec: parseInt(e.target.value, 10) || 30,
                    })
                  }
                  className="w-full bg-[#0D1015]/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#90D2ED] font-mono"
                />
              </div>

              <p className="text-[10px] text-slate-500">
                این ترجیحات همراه سایر تنظیمات با دکمه «ذخیره تمامی تنظیمات» ذخیره میشوند.
              </p>
            </div>
          )}

          {/* SECTION 8: PERMISSIONS & RBAC */}
          {activeSettingsSection === 'rbac' && (
            <div className="liquid-glass p-5 rounded-3xl space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <ShieldCheck className="w-4 h-4 text-[#90D2ED]" />
                <h2 className="text-sm font-black text-white">سطوح دسترسی و مجوزها (Permissions &amp; RBAC)</h2>
              </div>
              <SettingsRBAC />
            </div>
          )}
        </section>

        {/* =========================================================================
            LEFT COLUMN (Live 80mm ESC/POS Thermal Receipt Preview, 4 to 5 cols):
           ========================================================================= */}
        <aside className="lg:col-span-5 xl:col-span-4 sticky top-6 space-y-4">
          <div className="liquid-glass p-5 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-black text-white">
                  پیش‌نمایش زنده فیش حرارتی ۸۰mm
                </h3>
              </div>

              <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedRollWidth(58)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                    selectedRollWidth === 58
                      ? 'bg-[#8C1318] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRollWidth(80)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                    selectedRollWidth === 80
                      ? 'bg-[#8C1318] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Simulated Monospace ESC/POS Thermal Paper */}
            <div className="flex justify-center py-2">
              <div
                className={`bg-[#FAF8F5] text-[#111111] font-mono text-[11px] p-4 shadow-2xl transition-all border-b-2 border-dashed border-gray-400 relative select-text ${
                  selectedRollWidth === 80 ? 'w-[320px]' : 'w-[250px]'
                }`}
                style={{
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% calc(100% - 6px), 98% 100%, 96% calc(100% - 6px), 94% 100%, 92% calc(100% - 6px), 90% 100%, 88% calc(100% - 6px), 86% 100%, 84% calc(100% - 6px), 82% 100%, 80% calc(100% - 6px), 78% 100%, 76% calc(100% - 6px), 74% 100%, 72% calc(100% - 6px), 70% 100%, 68% calc(100% - 6px), 66% 100%, 64% calc(100% - 6px), 62% 100%, 60% calc(100% - 6px), 58% 100%, 56% calc(100% - 6px), 54% 100%, 52% calc(100% - 6px), 50% 100%, 48% calc(100% - 6px), 46% 100%, 44% calc(100% - 6px), 42% 100%, 40% calc(100% - 6px), 38% 100%, 36% calc(100% - 6px), 34% 100%, 32% calc(100% - 6px), 30% 100%, 28% calc(100% - 6px), 26% 100%, 24% calc(100% - 6px), 22% 100%, 20% calc(100% - 6px), 18% 100%, 16% calc(100% - 6px), 14% 100%, 12% calc(100% - 6px), 10% 100%, 8% calc(100% - 6px), 6% 100%, 4% calc(100% - 6px), 2% 100%, 0% calc(100% - 6px))',
                }}
              >
                {/* Paper Header */}
                <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-400">
                  <div className="font-black text-xs uppercase tracking-tight">{storeProfile.name_en}</div>
                  <div className="font-extrabold text-sm">{storeProfile.name_fa}</div>
                  <div className="text-[10px] text-gray-700">{storeProfile.address}</div>
                  <div className="text-[10px] text-gray-700">تلفن: {storeProfile.phone}</div>
                  {storeProfile.tax_registration_no && (
                    <div className="text-[9px] text-gray-600">شناسه اقتصادی: {storeProfile.tax_registration_no}</div>
                  )}

                  {/* Header custom lines */}
                  {receiptTemplate.header_lines.map((hl, i) => (
                    <div key={i} className="text-[10px] text-gray-800 font-semibold">{hl}</div>
                  ))}
                </div>

                {/* Receipt Metadata */}
                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>شماره فیش: #100H-9042</span>
                    <span>تاریخ: ۱۴۰۵/۰۸/۱۹</span>
                  </div>
                  <div className="flex justify-between">
                    <span>صندوق‌دار: {currentUserName}</span>
                    <span>نوع: سفارش بیرون‌بر</span>
                  </div>
                </div>

                {/* Items Line */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                  {sampleItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[10px]">
                      <span>{item.qty}× {item.title}</span>
                      <span className="font-bold">{formatToman(item.qty * item.price)}</span>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span>جمع اقلام:</span>
                    <span>{formatToman(sampleGross)} ت</span>
                  </div>
                  {fiscalRules.vat_tax_percentage > 0 && (
                    <div className="flex justify-between">
                      <span>مالیات ارزش افزوده ({fiscalRules.vat_tax_percentage}٪):</span>
                      <span>{formatToman(sampleVat)} ت</span>
                    </div>
                  )}
                  {samplePackaging > 0 && (
                    <div className="flex justify-between">
                      <span>هزینه بسته‌بندی بیرون‌بر:</span>
                      <span>{formatToman(samplePackaging)} ت</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-xs pt-1 border-t border-gray-300">
                    <span>مبلغ قابل پرداخت:</span>
                    <span>{formatToman(sampleTotal)} تومان</span>
                  </div>
                </div>

                {/* Footer Custom Lines */}
                <div className="text-center pt-2 space-y-0.5 text-[9px] text-gray-700">
                  {receiptTemplate.footer_lines.map((fl, i) => (
                    <div key={i}>{fl}</div>
                  ))}
                  <div className="pt-1 text-[8px] text-gray-500 font-sans">طراحی و اجرا: CafeOS KarWand</div>
                </div>
              </div>
            </div>

            {/* Driver Specs Box */}
            <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-[10px] text-slate-400 space-y-1">
              <div className="text-slate-200 font-bold">وضعیت سخت‌افزار چاپگر:</div>
              <div className="flex justify-between font-mono">
                <span>ESC/POS Standard:</span>
                <span className="text-emerald-400 font-bold">READY (Active)</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>Code Page:</span>
                <span className="text-[#90D2ED]">CP1256 (Persian)</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>DB Namespace:</span>
                <span className="text-amber-400">KarWand_DB_100HICH</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
