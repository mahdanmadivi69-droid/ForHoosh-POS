/**
 * CAFE OS — SettingsPrinters View (v2.4.0)
 * Hardware Device Profiles & Live Diagnostic Dispatcher for USB Serial, RAW 9100, and Spoolers
 * Compliant with CafeOS-RBAC-Settings-Hardware-Handoff
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer,
  Usb,
  Network,
  Cpu,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Zap,
  Radio,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Code2,
  X,
  Play,
  Scissors,
  Layers,
} from 'lucide-react';
import {
  HardwareDeviceProfile,
  PrinterStation,
  PrinterConnectionType,
  RollWidthMm,
} from '../../types/rbac-settings';
import {
  SettingsService,
  DEFAULT_PRINTER_PROFILES,
} from '../../services/settingsService';
import {
  EscPosGenerator,
  PrinterHardwareDispatcher,
  EscPosBinaryOutput,
} from '../../services/escposGenerator';
import { audioFeedback } from '../../services/audioFeedback';
import { StationRoutingSettings } from './StationRoutingSettings';

interface SettingsPrintersProps {
  onSelectedRollChange?: (rollWidth: RollWidthMm) => void;
}

export const SettingsPrinters: React.FC<SettingsPrintersProps> = ({ onSelectedRollChange }) => {
  const [profiles, setProfiles] = useState<HardwareDeviceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [printerSubTab, setPrinterSubTab] = useState<'routing' | 'hardware'>('routing');

  // Diagnostic State
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);
  const [lastTestOutput, setLastTestOutput] = useState<EscPosBinaryOutput | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [showHexModal, setShowHexModal] = useState<boolean>(false);
  const [activeSerialConnected, setActiveSerialConnected] = useState<boolean>(false);

  // Add/Edit Profile Modal
  const [editingProfile, setEditingProfile] = useState<HardwareDeviceProfile | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await SettingsService.getPrinterProfiles();
      const list = data.length > 0 ? data : DEFAULT_PRINTER_PROFILES;
      setProfiles(list);
      if (list.length > 0 && !selectedProfileId) {
        setSelectedProfileId(list[0].id);
        if (onSelectedRollChange) {
          onSelectedRollChange(list[0].paper_width_mm);
        }
      }
    } catch (err) {
      console.error('Failed to load printer profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0];

  const logDiagnostic = (msg: string) => {
    const time = new Date().toLocaleTimeString('fa-IR');
    setDiagnosticLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 30)]);
  };

  // Switch Paper Roll Width
  const handleRollWidthChange = async (width: RollWidthMm) => {
    if (!selectedProfile) return;
    const charWidth = width === 80 ? 42 : 32;
    const updated = {
      ...selectedProfile,
      paper_width_mm: width,
      character_width: charWidth,
    };
    await SettingsService.savePrinterProfile(updated);
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    audioFeedback.playTap();
    logDiagnostic(`عرض رول چاپگر ${selectedProfile.alias} به ${width}mm (${charWidth} کاراکتر در خط) تغییر یافت.`);
    if (onSelectedRollChange) {
      onSelectedRollChange(width);
    }
  };

  // Diagnostic Action 1: Connect USB Serial
  const handleConnectUsbSerial = async () => {
    setIsDispatching(true);
    logDiagnostic('در حال درخواست اتصال به پورت Web Serial...');
    try {
      const result = await PrinterHardwareDispatcher.connectUsbSerial(
        selectedProfile?.baud_rate || 9600
      );
      if (result.success) {
        setActiveSerialConnected(true);
        logDiagnostic(`✓ ${result.message}`);
      } else {
        logDiagnostic(`✗ ${result.message}`);
      }
    } catch (err: any) {
      logDiagnostic(`✗ خطا: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  // Diagnostic Action 2: Disconnect Device
  const handleDisconnectDevice = async () => {
    setIsDispatching(true);
    try {
      const result = await PrinterHardwareDispatcher.disconnectDevice();
      setActiveSerialConnected(false);
      logDiagnostic(`✓ ${result.message}`);
    } catch (err: any) {
      logDiagnostic(`✗ خطا در قطع ارتباط: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  // Diagnostic Action 3: Ping Network Socket
  const handlePingNetwork = async () => {
    if (!selectedProfile) return;
    setIsDispatching(true);
    logDiagnostic(`در حال ارسال پینگ به سوکت شبکه ${selectedProfile.target_address} (Port 9100)...`);
    try {
      const result = await PrinterHardwareDispatcher.pingNetworkSocket(
        selectedProfile.target_address
      );
      if (result.success) {
        logDiagnostic(`✓ ${result.message}`);
        // Update profile in state with lastPingMs
        const updated = { ...selectedProfile, lastPingMs: result.latencyMs, status: 'ONLINE' as const };
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        await SettingsService.savePrinterProfile(updated);
      } else {
        logDiagnostic(`✗ ${result.message}`);
      }
    } catch (err: any) {
      logDiagnostic(`✗ خطا: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  // Diagnostic Action 4: Trigger ESC/POS Test Ticket
  const handleTriggerTestTicket = async () => {
    if (!selectedProfile) return;
    setIsDispatching(true);
    logDiagnostic(`در حال تولید بسته باینری استاندارد ESC/POS برای ${selectedProfile.alias}...`);

    try {
      const result = await PrinterHardwareDispatcher.triggerTestTicket(selectedProfile);
      setLastTestOutput(result.output);
      logDiagnostic(`✓ ${result.message}`);
      logDiagnostic(
        `✓ فرامین ESC/POS تزریق شد: Init [0x1B,0x40], Center [0x1B,0x61,0x01], Cut [0x1D,0x56,0x00]`
      );
    } catch (err: any) {
      logDiagnostic(`✗ خطا در چاپ تستی: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  // Diagnostic Action 5: Trigger Drawer Pulse
  const handleTriggerDrawerPulse = async () => {
    if (!selectedProfile) return;
    setIsDispatching(true);
    logDiagnostic(`ارسال پالس الکترونیکی کشوی پول نقد (ESC p 0 25 250)...`);
    try {
      const result = await PrinterHardwareDispatcher.triggerDrawerPulse(selectedProfile);
      logDiagnostic(`✓ ${result.message}`);
    } catch (err: any) {
      logDiagnostic(`✗ خطا: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  // Profile Management Handlers
  const handleOpenAdd = () => {
    const newProfile: HardwareDeviceProfile = {
      id: `printer-${Date.now()}`,
      alias: 'چاپگر حرارتی جدید',
      station: 'BAR_KDS',
      connection_type: 'WEB_SERIAL',
      target_address: 'COM4',
      paper_width_mm: 80,
      character_width: 42,
      code_page: 'CP1256 (Persian/Arabic Support)',
      auto_cut: true,
      cash_drawer_kick_pulse: false,
      baud_rate: 9600,
      status: 'ONLINE',
    };
    setEditingProfile(newProfile);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (p: HardwareDeviceProfile) => {
    setEditingProfile({ ...p });
    setIsEditorOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    await SettingsService.savePrinterProfile(editingProfile);
    await loadProfiles();
    setIsEditorOpen(false);
    audioFeedback.playSuccess();
    logDiagnostic(`پروفایل چاپگر "${editingProfile.alias}" با موفقیت ذخیره شد.`);
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      alert('حداقل یک پروفایل چاپگر در سیستم الزامی است.');
      return;
    }
    if (confirm('آیا از حذف این پروفایل چاپگر مطمئن هستید؟')) {
      await SettingsService.deletePrinterProfile(id);
      await loadProfiles();
      audioFeedback.playTap();
      logDiagnostic(`پروفایل چاپگر حذف شد.`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#9EACB8] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#D71921] border-t-transparent rounded-full animate-spin"></div>
        <span>در حال بارگذاری پروفایل‌های چاپگر...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Sub-navigation Pill between Station Routing and Hardware Hub */}
      <div className="flex items-center gap-2 bg-[#0F223D]/80 p-1.5 rounded-2xl border border-white/10 w-fit backdrop-blur-md">
        <button
          onClick={() => {
            setPrinterSubTab('routing');
            audioFeedback.playTap();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            printerSubTab === 'routing'
              ? 'bg-[#005A3E] text-[#F8EED9] border border-emerald-400 shadow-[0_0_15px_-3px_rgba(0,90,62,0.6)]'
              : 'text-[#9EACB8] hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 text-[#5cdbb5]" />
          <span>مسیریابی ایستگاه‌ها و آشپزخانه (Station Routing)</span>
        </button>
        <button
          onClick={() => {
            setPrinterSubTab('hardware');
            audioFeedback.playTap();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            printerSubTab === 'hardware'
              ? 'bg-[#1F242C] text-white border border-[#D71921] shadow-[0_0_15px_-3px_rgba(215,25,33,0.5)]'
              : 'text-[#9EACB8] hover:text-white'
          }`}
        >
          <Printer className="w-4 h-4 text-cyan-400" />
          <span>درگاه‌های سخت‌افزاری و عیب‌یابی (Hardware Hub)</span>
        </button>
      </div>

      {printerSubTab === 'routing' ? (
        <StationRoutingSettings />
      ) : (
        <>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161A1F] p-4 rounded-xl border border-white/5">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#D71921]" />
            <span>مدیریت تجهیزات چاپگر و درگاه‌های سخت‌افزاری (Hardware Hub)</span>
          </h2>
          <p className="text-xs text-[#9EACB8] mt-0.5">
            پشتیبانی از Web Serial USB، سوکت شبکه RAW Port 9100، تغییر رول ۵۸/۸۰ میلیمتر و تست ESC/POS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenAdd}
            className="px-3 py-2 rounded-lg bg-[#D71921] hover:bg-[#B3141B] text-xs font-bold text-white flex items-center gap-1.5 shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن چاپگر جدید</span>
          </motion.button>
        </div>
      </div>

      {/* Grid: Profiles List & Live Diagnostic Station */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Device Profiles */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>دستگاه‌های متصل پیکربندی‌شده ({profiles.length}):</span>
            </span>
            <button
              onClick={loadProfiles}
              className="text-[11px] text-[#9EACB8] hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>بازخوانی</span>
            </button>
          </div>

          <div className="space-y-3">
            {profiles.map((profile) => {
              const isSelected = profile.id === selectedProfileId;
              const is80 = profile.paper_width_mm === 80;

              return (
                <div
                  key={profile.id}
                  onClick={() => {
                    setSelectedProfileId(profile.id);
                    audioFeedback.playTap();
                    if (onSelectedRollChange) {
                      onSelectedRollChange(profile.paper_width_mm);
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-[#1F242C] border-[#D71921] shadow-[0_0_20px_-3px_rgba(215,25,33,0.3)]'
                      : 'bg-[#161A1F] hover:bg-[#1C2128] border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          profile.connection_type === 'WEB_SERIAL'
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-600/30'
                            : profile.connection_type === 'NETWORK_RAW_9100'
                            ? 'bg-blue-950/40 text-blue-400 border border-blue-600/30'
                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-600/30'
                        }`}
                      >
                        {profile.connection_type === 'WEB_SERIAL' ? (
                          <Usb className="w-4 h-4" />
                        ) : profile.connection_type === 'NETWORK_RAW_9100' ? (
                          <Network className="w-4 h-4" />
                        ) : (
                          <Cpu className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{profile.alias}</span>
                          {profile.isDefault && (
                            <span className="text-[9px] bg-red-950/80 text-red-300 border border-red-800/50 px-1 py-0.2 rounded font-mono">
                              اصلی
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#9EACB8] font-mono mt-0.5">
                          {profile.target_address}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(profile);
                        }}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(profile.id);
                        }}
                        className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-white/5 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Profile Tags */}
                  <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="bg-[#121417] text-gray-300 px-2 py-0.5 rounded border border-white/5">
                      ایستگاه:{' '}
                      {profile.station === 'BAR_KDS'
                        ? 'بارتندر'
                        : profile.station === 'CASHIER_RECEIPT'
                        ? 'صندوق'
                        : 'آشپزخانه'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold ${
                        is80
                          ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                          : 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                      }`}
                    >
                      {profile.paper_width_mm}mm ({profile.character_width} cols)
                    </span>
                    {profile.cash_drawer_kick_pulse && (
                      <span className="bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>پالس کشو</span>
                      </span>
                    )}
                    {profile.lastPingMs && (
                      <span className="bg-emerald-950/40 text-emerald-400 font-mono px-1.5 py-0.5 rounded">
                        {profile.lastPingMs}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 Cols): Active Device Station & Live Diagnostic Dispatcher */}
        {selectedProfile && (
          <div className="lg:col-span-7 space-y-4">
            {/* Active Device Command Card */}
            <div className="bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-white">
                    میز عیب‌یابی و آزمایش زنده: {selectedProfile.alias}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded">
                    {selectedProfile.connection_type}
                  </span>
                </div>
              </div>

              {/* Roll Width Switcher (58mm vs 80mm) */}
              <div className="bg-[#1F242C] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">تغییر عرض رول کاغذ حرارتی:</div>
                  <div className="text-[11px] text-[#9EACB8]">
                    تنظیم چیدمان کاراکترها و دستورات برش ESC/POS
                  </div>
                </div>

                <div className="flex items-center bg-[#161A1F] p-1 rounded-lg border border-white/5">
                  <button
                    type="button"
                    onClick={() => handleRollWidthChange(58)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedProfile.paper_width_mm === 58
                        ? 'bg-[#D71921] text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ۵۸ میلی‌متر (۳۲ کاراکتر)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRollWidthChange(80)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedProfile.paper_width_mm === 80
                        ? 'bg-[#D71921] text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ۸۰ میلی‌متر (۴۲ کاراکتر)
                  </button>
                </div>
              </div>

              {/* Action Buttons Dispatcher */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-300">
                  فرمان‌های کنترل سخت‌افزاری (Live Dispatch Actions):
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* Connect Serial */}
                  {selectedProfile.connection_type === 'WEB_SERIAL' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleConnectUsbSerial}
                      disabled={isDispatching}
                      className="p-2.5 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] border border-amber-500/30 text-amber-400 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Usb className="w-4 h-4" />
                      <span>اتصال پورت سریال (USB)</span>
                    </motion.button>
                  )}

                  {/* Disconnect Serial */}
                  {activeSerialConnected && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDisconnectDevice}
                      disabled={isDispatching}
                      className="p-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-600/40 text-rose-400 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>قطع اتصال سریال</span>
                    </motion.button>
                  )}

                  {/* Ping Network Socket */}
                  {selectedProfile.connection_type === 'NETWORK_RAW_9100' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePingNetwork}
                      disabled={isDispatching}
                      className="p-2.5 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] border border-blue-500/30 text-blue-400 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Network className="w-4 h-4" />
                      <span>پینگ سوکت شبکه (Port 9100)</span>
                    </motion.button>
                  )}

                  {/* Test Ticket Print */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleTriggerTestTicket}
                    disabled={isDispatching}
                    className="p-2.5 rounded-lg bg-[#D71921] hover:bg-[#B3141B] text-white text-xs font-black flex flex-col items-center justify-center gap-1.5 shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)] transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>چاپ فیش تستی (ESC/POS)</span>
                  </motion.button>

                  {/* Drawer Pulse */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleTriggerDrawerPulse}
                    disabled={isDispatching}
                    className="p-2.5 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] border border-emerald-500/30 text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>پالس باز کردن کشوی پول</span>
                  </motion.button>

                  {/* Raw Hex Inspection */}
                  {lastTestOutput && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowHexModal(true)}
                      className="p-2.5 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] border border-purple-500/30 text-purple-300 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Code2 className="w-4 h-4" />
                      <span>مشاهده باینری Hex ({lastTestOutput.byteLength}B)</span>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Live Terminal Diagnostic Stream */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#9EACB8]">
                  <span className="font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>لاگ کنسول ارتباطی سخت‌افزار (Diagnostic Telemetry):</span>
                  </span>
                  <button
                    onClick={() => setDiagnosticLog([])}
                    className="text-[10px] text-gray-500 hover:text-white"
                  >
                    پاکسازی لاگ
                  </button>
                </div>

                <div className="bg-[#0D0F12] border border-white/5 rounded-lg p-3 font-mono text-[11px] h-[150px] overflow-y-auto space-y-1 text-gray-300" dir="ltr">
                  {diagnosticLog.length === 0 ? (
                    <div className="text-gray-600 text-center py-8">
                      آماده ارسال دستورات به درگاه سخت‌افزاری...
                    </div>
                  ) : (
                    diagnosticLog.map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.includes('✓')
                            ? 'text-emerald-400'
                            : line.includes('✗')
                            ? 'text-[#D71921]'
                            : 'text-gray-400'
                        }
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hex Dump Inspector Modal */}
      <AnimatePresence>
        {showHexModal && lastTestOutput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1F242C] rounded-2xl border border-white/10 p-5 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      تحلیل‌گر بایت‌های باینری استاندارد ESC/POS
                    </h3>
                    <p className="text-[11px] text-[#9EACB8]">
                      حجم کل: {lastTestOutput.byteLength} بایت | پروتکل Init: 0x1B 0x40 | برش: 0x1D 0x56 0x00
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHexModal(false)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="my-3 flex-1 overflow-y-auto space-y-3" dir="ltr">
                <div>
                  <span className="text-[10px] font-mono text-gray-400 block mb-1">
                    HEX DUMP RAW STREAM:
                  </span>
                  <div className="bg-[#0D0F12] p-3 rounded-lg border border-white/5 font-mono text-xs text-emerald-400 break-all leading-relaxed max-h-[140px] overflow-y-auto">
                    {lastTestOutput.hexDump}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-gray-400 block mb-1">
                    PARSED TICKET TEXT PREVIEW:
                  </span>
                  <pre className="bg-[#0D0F12] p-3 rounded-lg border border-white/5 font-mono text-xs text-gray-300 max-h-[160px] overflow-y-auto whitespace-pre-wrap">
                    {lastTestOutput.textPreview}
                  </pre>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setShowHexModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#161A1F] hover:bg-[#2A313C] text-xs font-bold text-white border border-white/10"
                >
                  بستن پنجره
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Profile Modal */}
      <AnimatePresence>
        {isEditorOpen && editingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1F242C] rounded-2xl border border-white/10 p-5 max-w-lg w-full shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#D71921]" />
                  <span>پیکربندی پروفایل چاپگر</span>
                </h3>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#9EACB8] mb-1">نام مستعار چاپگر (Alias):</label>
                  <input
                    type="text"
                    value={editingProfile.alias}
                    onChange={(e) => setEditingProfile({ ...editingProfile, alias: e.target.value })}
                    className="w-full bg-[#161A1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#9EACB8] mb-1">ایستگاه کاری (Station):</label>
                    <select
                      value={editingProfile.station}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, station: e.target.value as PrinterStation })
                      }
                      className="w-full bg-[#161A1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
                    >
                      <option value="BAR_KDS">بارتندر و قهوه (BAR_KDS)</option>
                      <option value="CASHIER_RECEIPT">صندوق و فیش مشتری (CASHIER_RECEIPT)</option>
                      <option value="KITCHEN_KDS">آشپزخانه و غذا (KITCHEN_KDS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9EACB8] mb-1">نوع اتصال (Connection):</label>
                    <select
                      value={editingProfile.connection_type}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          connection_type: e.target.value as PrinterConnectionType,
                        })
                      }
                      className="w-full bg-[#161A1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
                    >
                      <option value="WEB_SERIAL">Web Serial USB (COM Port)</option>
                      <option value="NETWORK_RAW_9100">شبکه TCP RAW (Port 9100)</option>
                      <option value="BROWSER_SPOOLER">اسپولر مرورگر (Spooler)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                    آدرس یا پورت مقصد (Target Address / IP:Port):
                  </label>
                  <input
                    type="text"
                    value={editingProfile.target_address}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, target_address: e.target.value })
                    }
                    placeholder="192.168.1.200:9100 یا COM3"
                    className="w-full bg-[#161A1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#9EACB8] mb-1">عرض رول کاغذ:</label>
                    <select
                      value={editingProfile.paper_width_mm}
                      onChange={(e) => {
                        const w = parseInt(e.target.value, 10) as RollWidthMm;
                        setEditingProfile({
                          ...editingProfile,
                          paper_width_mm: w,
                          character_width: w === 80 ? 42 : 32,
                        });
                      }}
                      className="w-full bg-[#161A1F] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
                    >
                      <option value={80}>۸۰ میلی‌متر (۴۲ کاراکتر)</option>
                      <option value={58}>۵۸ میلی‌متر (۳۲ کاراکتر)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9EACB8] mb-1">کدپیج فونت:</label>
                    <input
                      type="text"
                      disabled
                      value={editingProfile.code_page}
                      className="w-full bg-[#161A1F]/50 border border-white/5 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProfile.auto_cut}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, auto_cut: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#D71921] bg-[#161A1F] border-white/20"
                    />
                    <span className="text-xs text-gray-300">ارسال فرمان برش خودکار کاغذ (Auto-Cut)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProfile.cash_drawer_kick_pulse}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          cash_drawer_kick_pulse: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-[#D71921] bg-[#161A1F] border-white/20"
                    />
                    <span className="text-xs text-gray-300">ارسال پالس باز شدن کشوی پول نقد (Drawer Kick)</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-3 py-2 rounded-lg bg-[#161A1F] text-xs font-bold text-gray-300"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="px-4 py-2 rounded-lg bg-[#D71921] hover:bg-[#B3141B] text-xs font-black text-white"
                >
                  ذخیره مشخصات چاپگر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
};
