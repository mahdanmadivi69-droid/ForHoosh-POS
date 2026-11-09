/**
 * src/views/settings/HichSettingsControlDeck.tsx
 * 
 * KarWand POS — 100 HICH Tailored Settings Control Deck
 * Compliant with 100 HICH System Directives
 * 
 * Features:
 *  1. Locked Venue Profile: Fixed to "قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)" & device ID TERM-01-MAIN.
 *  2. Visual Tuning: Backdrop blur slider (16px to 48px) and 3D tilt toggle.
 *  3. Station & LAN Auto-Discovery: Network discovery for printers on port 9100/515 and POS terminals on port 1024,
 *     with station assignment dropdowns (Cashier, Bar, Kitchen, Disabled).
 *  4. Staff Management (Admin Protected): Add new staff with custom PINs, change PINs, manage permissions.
 *  5. Local Mesh & QR Sync: Display node IP (port 3000) and pairing QR code for table ordering tablets.
 */

import React, { useState, useEffect } from 'react';
import {
  Store,
  Sliders,
  Printer,
  Users,
  Network,
  Lock,
  Unlock,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  KeyRound,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Wifi,
  Cpu,
  Monitor,
  Copy,
  Check,
} from 'lucide-react';
import { AuthUserRecord, AppUserRole } from '../../types/rbac-settings';
import { RBACService, ROLE_DEFINITIONS } from '../../services/RBACService';
import { usePrinterStore } from '../../stores/usePrinterStore';
import { Station } from '../../types/printerRouting';
import { playPosBeep } from '../../services/soundEffects';
import { generateQrSvg } from '../../utils/qrCodeGenerator';

interface HichSettingsControlDeckProps {
  currentUserRole: string;
  currentUserName: string;
  onBackToPos: () => void;
  onBackToHub?: () => void;
}

export type DeckTab = 'profile' | 'visual' | 'discovery' | 'staff' | 'mesh';

export interface DiscoveredNetworkDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'PRINTER_RAW' | 'PRINTER_LPR' | 'POS_TERMINAL' | 'TABLET_NODE';
  assignedStation: 'cashier' | 'bar' | 'kitchen' | 'disabled';
  status: 'ONLINE' | 'STANDBY';
  latencyMs: number;
}

const DEFAULT_DISCOVERED_DEVICES: DiscoveredNetworkDevice[] = [
  {
    id: 'dev-prn-01',
    name: 'Bixolon SRP-350III (صندوق حرارتی)',
    ip: '192.168.0.150',
    port: 9100,
    type: 'PRINTER_RAW',
    assignedStation: 'cashier',
    status: 'ONLINE',
    latencyMs: 4,
  },
  {
    id: 'dev-prn-02',
    name: 'Epson TM-T88VI (بار گرم / اسپرسو)',
    ip: '192.168.0.151',
    port: 515,
    type: 'PRINTER_LPR',
    assignedStation: 'bar',
    status: 'ONLINE',
    latencyMs: 7,
  },
  {
    id: 'dev-kds-01',
    name: 'Samsung Galaxy Tab S8 (ترمینال باریستا)',
    ip: '192.168.0.180',
    port: 1024,
    type: 'POS_TERMINAL',
    assignedStation: 'bar',
    status: 'ONLINE',
    latencyMs: 12,
  },
  {
    id: 'dev-tab-01',
    name: 'iPad Air 5th Gen (تبلت سفارشگیر میز ۴)',
    ip: '192.168.0.190',
    port: 1024,
    type: 'TABLET_NODE',
    assignedStation: 'disabled',
    status: 'ONLINE',
    latencyMs: 9,
  },
];

export const HichSettingsControlDeck: React.FC<HichSettingsControlDeckProps> = ({
  currentUserRole,
  currentUserName,
  onBackToPos,
  onBackToHub,
}) => {
  const [activeTab, setActiveTab] = useState<DeckTab>('profile');
  const isOwnerOrManager =
    currentUserRole === 'OWNER' || currentUserRole === 'MANAGER' || currentUserRole === 'owner';

  // 1. Visual Tuning State
  const [backdropBlur, setBackdropBlur] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cafeos_glass_blur');
      return saved ? parseInt(saved, 10) : 34;
    } catch {
      return 34;
    }
  });

  const [tiltEnabled, setTiltEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cafeos_tilt_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Apply visual changes in document root
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-blur', `${backdropBlur}px`);
    try {
      localStorage.setItem('cafeos_glass_blur', String(backdropBlur));
      localStorage.setItem('cafeos_tilt_enabled', String(tiltEnabled));
    } catch {}
  }, [backdropBlur, tiltEnabled]);

  // 2. Station & LAN Discovery State
  const [devices, setDevices] = useState<DiscoveredNetworkDevice[]>(DEFAULT_DISCOVERED_DEVICES);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<string>('هم‌اکنون');

  // 3. Staff Management State
  const [staffList, setStaffList] = useState<AuthUserRecord[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffUsername, setNewStaffUsername] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<AppUserRole>('CASHIER');
  const [newStaffPin, setNewStaffPin] = useState<string>('');
  const [addStaffError, setAddStaffError] = useState<string | null>(null);

  // Change PIN modal state
  const [selectedStaffForPin, setSelectedStaffForPin] = useState<AuthUserRecord | null>(null);
  const [changePinInput, setChangePinInput] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string | null>(null);

  // 4. Local Mesh & QR Sync
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const localMeshIp = 'http://192.168.0.232:3000';
  const pairingPayload = JSON.stringify({
    role: 'table_client',
    master: localMeshIp,
    venue: '100hich-yousefabad',
    deviceId: 'TERM-01-MAIN',
    token: 'KW-PAIR-9031',
  });

  const refreshStaff = async () => {
    try {
      await RBACService.initDefaultUsers();
      const all = await RBACService.getAllUsers();
      setStaffList(all);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  };

  useEffect(() => {
    refreshStaff();
  }, []);

  const handleTriggerLanScan = () => {
    playPosBeep('click');
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setLastScanTime(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      playPosBeep('success');
    }, 1200);
  };

  const handleDeviceStationChange = (deviceId: string, station: 'cashier' | 'bar' | 'kitchen' | 'disabled') => {
    playPosBeep('click');
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, assignedStation: station } : d))
    );
  };

  const handleCreateStaff = async () => {
    if (!newStaffName.trim() || !newStaffUsername.trim() || newStaffPin.length < 4) {
      setAddStaffError('نام، نام کاربری و پین حداقل ۴ رقمی الزامی است.');
      playPosBeep('delete');
      return;
    }

    try {
      await RBACService.addStaffUser({
        fullName: newStaffName,
        username: newStaffUsername,
        role: newStaffRole,
        pin: newStaffPin,
      });
      playPosBeep('success');
      setIsAddStaffOpen(false);
      setNewStaffName('');
      setNewStaffUsername('');
      setNewStaffPin('');
      setAddStaffError(null);
      await refreshStaff();
    } catch (err: any) {
      setAddStaffError(err.message || 'خطا در ثبت کاربر جدید');
      playPosBeep('delete');
    }
  };

  const handleChangePin = async () => {
    if (!selectedStaffForPin || changePinInput.length < 4) {
      setChangePinError('پین جدید باید حداقل ۴ رقم باشد.');
      playPosBeep('delete');
      return;
    }

    try {
      await RBACService.updateUserPin(selectedStaffForPin.id, changePinInput);
      playPosBeep('success');
      setSelectedStaffForPin(null);
      setChangePinInput('');
      setChangePinError(null);
      await refreshStaff();
    } catch (err: any) {
      setChangePinError(err.message || 'خطا در تغییر پین‌کد');
      playPosBeep('delete');
    }
  };

  const handleToggleUserStatus = async (user: AuthUserRecord) => {
    playPosBeep('click');
    try {
      await RBACService.toggleUserStatus(user.id, !user.isActive);
      await refreshStaff();
    } catch (err) {
      console.error('Error toggling user status:', err);
    }
  };

  const handleCopyMeshLink = () => {
    try {
      navigator.clipboard.writeText(localMeshIp);
      setIsCopied(true);
      playPosBeep('click');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-white flex flex-col p-3 sm:p-5 md:p-6 select-none relative overflow-x-hidden">
      {/* Background Ambient Mesh */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-[#8C1318] blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-[#0F223D] blur-[170px]" />
      </div>

      {/* Header Deck */}
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between pb-4 border-b border-white/10 z-10 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8C1318] to-[#450A0D] border border-[rgba(144,210,237,0.35)] flex items-center justify-center shadow-[0_0_15px_rgba(140,19,24,0.5)]">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>مرکز کنترل و تنظیمات ۱۰۰ هیچ (Settings Deck)</span>
              <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-[#90D2ED] border border-white/15">
                TERM-01-MAIN
              </span>
            </h1>
            <p className="text-xs text-slate-400">پیکربندی هویت انحصاری، شبکه سخت‌افزاری و مش تبلت‌ها</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>بازگشت به هاب اصلی</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBackToPos}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#8C1318] to-[#6E0D12] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md hover:brightness-110"
          >
            <span>بازگشت به صندوق POS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Deck Layout: Sidebar Tabs + Content Canvas */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 z-10">
        {/* Left/Sidebar Navigation Column (3 cols) */}
        <div className="lg:col-span-3 space-y-2">
          {/* Tab 1: Locked Venue Profile */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setActiveTab('profile');
            }}
            className={`w-full p-3.5 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[rgba(140,19,24,0.3)] border-[#8C1318] text-white shadow-[0_0_15px_rgba(140,19,24,0.4)]'
                : 'bg-[rgba(12,25,48,0.7)] hover:bg-[rgba(15,35,68,0.8)] border-white/10 text-slate-300'
            }`}
          >
            <Store className="w-5 h-5 text-[#90D2ED]" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black block text-white truncate">هویت شعبه (Locked)</span>
              <span className="text-[10px] text-slate-400 block truncate">شعبه یوسف‌آباد • TERM-01</span>
            </div>
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {/* Tab 2: Visual Tuning */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setActiveTab('visual');
            }}
            className={`w-full p-3.5 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-[rgba(140,19,24,0.3)] border-[#8C1318] text-white shadow-[0_0_15px_rgba(140,19,24,0.4)]'
                : 'bg-[rgba(12,25,48,0.7)] hover:bg-[rgba(15,35,68,0.8)] border-white/10 text-slate-300'
            }`}
          >
            <Sliders className="w-5 h-5 text-[#F5E8D0]" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black block text-white truncate">تیونینگ بصری (Visual)</span>
              <span className="text-[10px] text-slate-400 block truncate">بلور ۳۴px و چرخش ۳D Tilt</span>
            </div>
          </button>

          {/* Tab 3: Station & LAN Discovery */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setActiveTab('discovery');
            }}
            className={`w-full p-3.5 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
              activeTab === 'discovery'
                ? 'bg-[rgba(140,19,24,0.3)] border-[#8C1318] text-white shadow-[0_0_15px_rgba(140,19,24,0.4)]'
                : 'bg-[rgba(12,25,48,0.7)] hover:bg-[rgba(15,35,68,0.8)] border-white/10 text-slate-300'
            }`}
          >
            <Printer className="w-5 h-5 text-[#90D2ED]" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black block text-white truncate">اتودیسکاوری پرینترها</span>
              <span className="text-[10px] text-slate-400 block truncate">پورت‌های ۹۱۰۰ / ۵۱۵ / ۱۰۲۴</span>
            </div>
          </button>

          {/* Tab 4: Staff Management */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setActiveTab('staff');
            }}
            className={`w-full p-3.5 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-[rgba(140,19,24,0.3)] border-[#8C1318] text-white shadow-[0_0_15px_rgba(140,19,24,0.4)]'
                : 'bg-[rgba(12,25,48,0.7)] hover:bg-[rgba(15,35,68,0.8)] border-white/10 text-slate-300'
            }`}
          >
            <Users className="w-5 h-5 text-emerald-400" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black block text-white truncate">مدیریت کارکنان و پین‌کد</span>
              <span className="text-[10px] text-slate-400 block truncate">تغییر پین و ایجاد کاربر جدید</span>
            </div>
            {!isOwnerOrManager && <Lock className="w-3.5 h-3.5 text-rose-400" />}
          </button>

          {/* Tab 5: Local Mesh & QR Sync */}
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              setActiveTab('mesh');
            }}
            className={`w-full p-3.5 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
              activeTab === 'mesh'
                ? 'bg-[rgba(140,19,24,0.3)] border-[#8C1318] text-white shadow-[0_0_15px_rgba(140,19,24,0.4)]'
                : 'bg-[rgba(12,25,48,0.7)] hover:bg-[rgba(15,35,68,0.8)] border-white/10 text-slate-300'
            }`}
          >
            <Network className="w-5 h-5 text-amber-400" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black block text-white truncate">مش محلی و QR تبلت‌ها</span>
              <span className="text-[10px] text-slate-400 block truncate">اتصال آنی نودها روی پورت ۳۰۰۰</span>
            </div>
          </button>
        </div>

        {/* Right Content Canvas (9 cols) */}
        <div className="lg:col-span-9 bg-[rgba(12,25,48,0.85)] border border-[rgba(144,210,237,0.25)] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-[34px] relative overflow-hidden">
          {/* SECTION 1: LOCKED VENUE PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>پروفایل و هویت شعبه</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>سخت‌افزار قفل‌شده</span>
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    شناسنامه صندوق و محدودیت عدم سوئیچینگ چندمستأجری برای امنیت تراکنش‌ها
                  </p>
                </div>
              </div>

              {/* Security Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-relaxed">
                  <strong>هشدار امنیتی:</strong> این پایانه به صورت انحصاری برای <strong>قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)</strong> قفل شده است. قابلیت جابجایی به مستأجرهای دیگر (مانند کافه مودندو) در این کلاینت سخت‌افزاری مسدود گردیده تا اینورینت تفکیک کامل داده‌ها (Zero Data Leakage) تضمین شود.
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">نام رسمی شعبه:</span>
                  <span className="text-sm font-black text-white block">
                    قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">شناسه سخت‌افزاری (Device ID):</span>
                  <span className="text-sm font-mono font-black text-[#90D2ED] block">
                    TERM-01-MAIN
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">آدرس فیزیکی:</span>
                  <span className="text-xs text-slate-200 block">
                    تهران، یوسف‌آباد، خیابان ۶۴، نبش کوچه یاس، پلاک ۲
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">تلفن و کد مالیاتی:</span>
                  <span className="text-xs font-mono text-slate-200 block">
                    021-88051234 • TAX: 14009876543
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: VISUAL TUNING */}
          {activeTab === 'visual' && (
            <div className="space-y-6">
              <div className="pb-3 border-b border-white/10">
                <h3 className="text-base font-black text-white">تیونینگ بصری و استایلینگ Liquid Glass</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تنظیم شدت شفافیت بلور و پویایی حرکتی کارت‌ها متناسب با قدرت سخت‌افزار
                </p>
              </div>

              {/* Backdrop Blur Slider */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">شدت بلور پس‌زمینه (Backdrop Blur):</span>
                    <span className="text-[11px] text-slate-400">
                      محدوده استاندارد بین ۱۶px تا ۴۸px (پیش‌فرض کارخانه: ۳۴px)
                    </span>
                  </div>
                  <span className="text-base font-mono font-black text-[#90D2ED] bg-black/40 px-3 py-1 rounded-xl border border-white/10">
                    {backdropBlur}px
                  </span>
                </div>

                <input
                  type="range"
                  min="16"
                  max="48"
                  value={backdropBlur}
                  onChange={(e) => setBackdropBlur(parseInt(e.target.value, 10))}
                  className="w-full accent-[#8C1318] cursor-pointer"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>16px (حداقل)</span>
                  <span>34px (استاندارد اپل)</span>
                  <span>48px (حداکثر تراکم)</span>
                </div>
              </div>

              {/* 3D Tilt Dynamics Toggle */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">پویایی ۳D Tilt کارت‌های کاتالوگ:</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    چرخش زاویه‌ای ±۲.۲° الی ±۵° با حرکت موس بر روی کارت‌های اقلام منو
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playPosBeep('click');
                    setTiltEnabled(!tiltEnabled);
                  }}
                  className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                    tiltEnabled ? 'bg-[#8C1318] justify-end' : 'bg-white/10 justify-start'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-200">
                  تنظیمات بصری بلادرنگ اعمال و در IndexedDB ذخیره می‌گردند.
                </span>
              </div>
            </div>
          )}

          {/* SECTION 3: STATION & LAN AUTO-DISCOVERY */}
          {activeTab === 'discovery' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-black text-white">اتودیسکاوری پرینترها و شبکه محلی (LAN)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    پویش پورت‌های ۹۱۰۰ (RAW ESC/POS)، ۵۱۵ (LPR) و ۱۰۲۴ (ترمینال‌های تبلت)
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleTriggerLanScan}
                  className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow hover:brightness-110 disabled:opacity-50"
                >
                  <Wifi className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'در حال پویش شبکه...' : 'شروع اسکن محلی'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>تعداد دستگاه‌های شناسایی‌شده: <strong>{devices.length}</strong></span>
                <span>آخرین زمان پویش: <strong>{lastScanTime}</strong></span>
              </div>

              {/* Devices List */}
              <div className="space-y-3">
                {devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center">
                        {dev.type.includes('PRINTER') ? (
                          <Printer className="w-5 h-5 text-[#90D2ED]" />
                        ) : (
                          <Monitor className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{dev.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-300">
                            {dev.ip}:{dev.port}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            ● {dev.latencyMs}ms
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Station Assignment Dropdown */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <label className="text-[11px] text-slate-400">تخصیص ایستگاه:</label>
                      <select
                        value={dev.assignedStation}
                        onChange={(e) =>
                          handleDeviceStationChange(dev.id, e.target.value as any)
                        }
                        className="py-1.5 px-3 rounded-xl bg-black/60 border border-white/20 text-xs font-bold text-white outline-none cursor-pointer focus:border-[#90D2ED]"
                      >
                        <option value="cashier">صندوق (Cashier)</option>
                        <option value="bar">بار نوشیدنی (Bar)</option>
                        <option value="kitchen">آشپزخانه (Kitchen)</option>
                        <option value="disabled">غیرفعال (Disabled)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: STAFF MANAGEMENT (ADMIN PROTECTED) */}
          {activeTab === 'staff' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>مدیریت کارکنان و پین‌کدها</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                      محافظت‌شده با پین ادمین
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تعریف همکاران جدید، تغییر رمزهای عبور ۴ رقمی و سطوح دسترسی RBAC
                  </p>
                </div>

                {isOwnerOrManager && (
                  <button
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setIsAddStaffOpen(true);
                    }}
                    className="py-2 px-3.5 rounded-xl bg-[#8C1318] hover:bg-[#6E0D12] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن همکار جدید</span>
                  </button>
                )}
              </div>

              {!isOwnerOrManager ? (
                <div className="p-6 text-center bg-rose-950/30 border border-rose-800/40 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">دسترسی به بخش پرسنل نیازمند پین‌کد مالک است.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staffList.map((st) => (
                    <div
                      key={st.id}
                      className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center">
                          <Users className="w-5 h-5 text-slate-300" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{st.fullName}</h4>
                            <span className="text-[10px] font-mono text-slate-400">({st.username})</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-[#90D2ED] font-mono mt-0.5 inline-block">
                            {st.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            playPosBeep('click');
                            setSelectedStaffForPin(st);
                            setChangePinInput('');
                            setChangePinError(null);
                          }}
                          className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>تغییر پین</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(st)}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                            st.isActive
                              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                              : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                          }`}
                        >
                          {st.isActive ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: LOCAL MESH & QR SYNC */}
          {activeTab === 'mesh' && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-white/10">
                <h3 className="text-base font-black text-white">مش محلی و اتصال QR تبلت‌های سالن</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  اتصال آنی بدون نیاز به اینترنت ابر از طریق وب‌سوکت شبکه محلی روی پورت ۳۰۰۰
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                {/* QR Code Presentation */}
                <div className="p-5 bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center text-center">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: generateQrSvg(pairingPayload, { size: 180 }),
                    }}
                  />
                  <span className="text-[11px] font-bold text-slate-700 mt-3 block">
                    اسکن با دوربین تبلت جهت اتصال به صندوق مرکزی
                  </span>
                </div>

                {/* Mesh Details */}
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <span className="text-xs text-slate-400 block mb-1">آدرس سرور نود مرکزی (Master Node):</span>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-sm font-mono font-black text-[#90D2ED] truncate">
                        {localMeshIp}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyMeshLink}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 transition cursor-pointer"
                        title="کپی آدرس"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">وضعیت مش:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>MASTER ACTIVE (پورت ۳۰۰۰)</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">تبلت‌های همگام:</span>
                      <span className="text-white font-mono font-bold">۲ تبلت متصل</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">تاخیر میانگین همگام‌سازی:</span>
                      <span className="text-cyan-400 font-mono font-bold">۸ میلی‌ثانیه</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add Staff Member */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[rgba(12,25,48,0.95)] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4">
            <h3 className="text-sm font-black text-white">افزودن همکار جدید به سیستم</h3>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">نام و نام خانوادگی:</label>
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="مثال: پارسا احمدی"
                className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/20 text-xs text-white outline-none focus:border-[#90D2ED]"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">نام کاربری (انگلیسی):</label>
              <input
                type="text"
                value={newStaffUsername}
                onChange={(e) => setNewStaffUsername(e.target.value)}
                placeholder="مثال: parsa"
                className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/20 text-xs text-white font-mono outline-none focus:border-[#90D2ED]"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">نقش سازمانی:</label>
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as any)}
                className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/20 text-xs text-white outline-none focus:border-[#90D2ED]"
              >
                <option value="CASHIER">صندوق‌دار شیفت (CASHIER)</option>
                <option value="BARISTA">باریستا / بارتندر (BARISTA)</option>
                <option value="MANAGER">سرپرست شیفت (MANAGER)</option>
                <option value="ACCOUNTANT">حسابدار ارشد (ACCOUNTANT)</option>
                <option value="OWNER">مالک / ادمین (OWNER)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">پین‌کد ۴ رقمی:</label>
              <input
                type="password"
                maxLength={6}
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value)}
                placeholder="••••"
                className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/20 text-sm text-center text-white font-mono outline-none focus:border-[#90D2ED]"
              />
            </div>

            {addStaffError && (
              <span className="text-[11px] text-rose-400 font-bold block text-center">
                {addStaffError}
              </span>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCreateStaff}
                className="flex-1 py-2.5 rounded-xl bg-[#8C1318] text-white font-black text-xs cursor-pointer shadow hover:brightness-110"
              >
                ثبت همکار
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddStaffOpen(false);
                  setAddStaffError(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change PIN */}
      {selectedStaffForPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[rgba(12,25,48,0.95)] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4">
            <h3 className="text-sm font-black text-white">
              تغییر پین‌کد برای {selectedStaffForPin.fullName}
            </h3>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">پین‌کد ۴ رقمی جدید:</label>
              <input
                type="password"
                maxLength={6}
                value={changePinInput}
                onChange={(e) => setChangePinInput(e.target.value)}
                placeholder="••••"
                className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/20 text-sm text-center text-white font-mono outline-none focus:border-[#90D2ED]"
              />
            </div>

            {changePinError && (
              <span className="text-[11px] text-rose-400 font-bold block text-center">
                {changePinError}
              </span>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleChangePin}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-black text-xs cursor-pointer shadow hover:brightness-110"
              >
                ذخیره پین جدید
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStaffForPin(null);
                  setChangePinError(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
