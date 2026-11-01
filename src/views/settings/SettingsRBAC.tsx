/**
 * CAFE OS — SettingsRBAC View (v2.4.0)
 * 4-Level Role Matrix Visualizer, User PIN Management & Real-Time Security Audit Logs
 * Compliant with CafeOS-RBAC-Settings-Hardware-Handoff
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  KeyRound,
  Users,
  History,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  ShieldAlert,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  AppUserRole,
  AuthUserRecord,
  ElevationAuditLog,
} from '../../types/rbac-settings';
import {
  RBACService,
  ROLE_DEFINITIONS,
  ELEVATION_POLICY,
} from '../../services/RBACService';
import { audioFeedback } from '../../services/audioFeedback';

export const SettingsRBAC: React.FC = () => {
  const [users, setUsers] = useState<AuthUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<ElevationAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Change PIN modal state
  const [selectedUserForPin, setSelectedUserForPin] = useState<AuthUserRecord | null>(null);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState<boolean>(false);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await RBACService.initDefaultUsers();
      const userList = await RBACService.getAllUsers();
      const logs = await RBACService.getElevationLogs(50);
      setUsers(userList);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading RBAC users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    if (!selectedUserForPin) return;
    if (newPinInput.length < 4) {
      setPinChangeError('پین‌کد باید حداقل ۴ رقم باشد.');
      audioFeedback.playError();
      return;
    }

    try {
      await RBACService.updateUserPin(selectedUserForPin.id, newPinInput);
      audioFeedback.playSuccess();
      setPinChangeSuccess(true);
      setTimeout(() => {
        setPinChangeSuccess(false);
        setSelectedUserForPin(null);
        setNewPinInput('');
        loadData();
      }, 1000);
    } catch (err: any) {
      setPinChangeError(err.message || 'خطا در تغییر پین‌کد');
      audioFeedback.playError();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#9EACB8] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#D71921] border-t-transparent rounded-full animate-spin"></div>
        <span>در حال بارگذاری اطلاعات دسترسی و کاربران...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161A1F] p-4 rounded-xl border border-white/5">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#D71921]" />
            <span>مدیریت سطوح دسترسی (RBAC) و گیت امنیتی پین‌کد</span>
          </h2>
          <p className="text-xs text-[#9EACB8] mt-0.5">
            سیستم امنیتی ۴ سطحی (ادمین، حسابدار، مدیر، باریستا) با ذخیره‌سازی محلی SHA-256 در IndexedDB
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-2 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] text-xs font-bold text-[#9EACB8] hover:text-white border border-white/5 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>بازخوانی لاگ‌ها</span>
        </button>
      </div>

      {/* Role Level Cards (4 Levels) */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-300">سطوح دسترسی ۴ گانه تعریف‌شده در سیستم:</span>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(['OWNER', 'ACCOUNTANT', 'MANAGER', 'BARISTA'] as AppUserRole[]).map((roleKey) => {
            const role = ROLE_DEFINITIONS[roleKey];
            return (
              <div
                key={roleKey}
                className="bg-[#161A1F] p-3.5 rounded-xl border border-white/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded border ${role.badgeBg}`}
                    >
                      سطح {role.level} - {roleKey}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-400">
                      L{role.level}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">{role.titleFa}</h4>
                  <p className="text-[11px] text-[#9EACB8] leading-relaxed mb-3">
                    {role.descriptionFa}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <div className="text-[10px] text-gray-400 font-bold mb-1">مجوزهای کلیدی:</div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-[9px] bg-[#1F242C] text-gray-300 font-mono px-1.5 py-0.5 rounded border border-white/5"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users & PIN Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">کاربران احراز هویت‌شده و پین‌کدهای محلی</h3>
            </div>
            <span className="text-[10px] text-gray-400">IndexedDB: auth_users</span>
          </div>

          <div className="space-y-2.5">
            {users.map((user) => {
              const roleDef = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.BARISTA;

              return (
                <div
                  key={user.id}
                  className="bg-[#1F242C] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{user.fullName}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${roleDef.badgeBg}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#9EACB8] mt-1 flex items-center gap-2 font-mono">
                      <span>کاربری: {user.username}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-sans">
                        هش امنیتی: SHA-256 (Salted)
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedUserForPin(user);
                      setNewPinInput('');
                      setPinChangeError(null);
                      audioFeedback.playTap();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#161A1F] hover:bg-[#252B34] text-xs font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>تغییر پین</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-[#1F242C]/60 rounded-xl border border-white/5 text-[11px] text-[#9EACB8] space-y-1">
            <div className="font-bold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>پین‌های پیش‌فرض تست سریع سیستم:</span>
            </div>
            <div className="text-[10px] grid grid-cols-2 gap-1 text-gray-400 font-mono">
              <div>مالک (admin): <strong className="text-white">1234</strong></div>
              <div>مدیر (manager): <strong className="text-white">1111</strong></div>
              <div>حسابدار (accountant): <strong className="text-white">5678</strong></div>
              <div>باریستا (barista): <strong className="text-white">0000</strong></div>
            </div>
          </div>
        </div>

        {/* Real-time Elevation Audit Logs */}
        <div className="lg:col-span-6 bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">لاگ امنیتی ارتقای مقام و پین‌کد (Audit Trail)</h3>
            </div>
            <span className="text-[10px] text-gray-400">IndexedDB: elevation_audit_logs</span>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-500">
                هنوز هیچ درخواست ارتقای پین‌کدی ثبت نشده است.
              </div>
            ) : (
              auditLogs.map((log) => {
                const isGranted = log.status === 'GRANTED';
                const timeStr = new Date(log.timestamp).toLocaleTimeString('fa-IR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const dateStr = new Date(log.timestamp).toLocaleDateString('fa-IR');

                return (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      isGranted
                        ? 'bg-[#1F242C] border-emerald-500/20 text-gray-200'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        {isGranted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D71921]" />
                        )}
                        <span>{log.action_type}</span>
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {dateStr} {timeStr}
                      </span>
                    </div>

                    <div className="mt-1.5 text-[11px] text-[#9EACB8] flex items-center justify-between">
                      <span>درخواست: {log.requested_by_user}</span>
                      <span className={isGranted ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
                        {isGranted ? `تاییدکننده: ${log.authorized_by_manager}` : 'تایید نشد'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Change PIN Modal */}
      <AnimatePresence>
        {selectedUserForPin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1F242C] rounded-2xl border border-white/10 p-5 max-w-sm w-full shadow-2xl"
              dir="rtl"
            >
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>تغییر پین‌کد کاربر: {selectedUserForPin.fullName}</span>
              </h3>
              <p className="text-[11px] text-[#9EACB8] mb-4">
                پین‌کد جدید با استفاده از سالت اختصاصی و الگوریتم SHA-256 هش خواهد شد.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    پین‌کد ۴ تا ۶ رقمی جدید:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPinInput}
                    onChange={(e) => {
                      if (/^\d*$/.test(e.target.value)) {
                        setNewPinInput(e.target.value);
                      }
                    }}
                    placeholder="****"
                    className="w-full bg-[#161A1F] border border-white/10 rounded-lg px-3 py-2 text-center text-lg tracking-widest text-white font-mono focus:border-[#D71921] focus:outline-none"
                    dir="ltr"
                  />
                </div>

                {pinChangeError && (
                  <div className="text-xs text-[#D71921] font-bold">{pinChangeError}</div>
                )}
                {pinChangeSuccess && (
                  <div className="text-xs text-[#10B981] font-bold">پین‌کد با موفقیت به‌روزرسانی شد.</div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserForPin(null)}
                    className="px-3 py-1.5 rounded-lg bg-[#161A1F] text-xs font-bold text-gray-300"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdatePin}
                    className="px-4 py-1.5 rounded-lg bg-[#D71921] hover:bg-[#B3141B] text-xs font-black text-white"
                  >
                    ذخیره پین‌کد
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
