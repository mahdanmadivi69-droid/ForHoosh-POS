/**
 * src/views/staff/StaffManagementView.tsx
 * 
 * Modendo Multi-Staff Management View (Owner & Manager Only).
 * Local-First Dexie Storage with bcrypt hashed 4-digit PINs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowRight,
  Check,
  X,
  Edit2,
  Lock,
  UserX,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StaffService,
  StaffRecord,
  StaffRole,
  STAFF_ROLE_DEFINITIONS,
} from '../../services/staffService';
import { useStaffAuthStore } from '../../stores/useStaffAuthStore';
import { playPosBeep } from '../../services/soundEffects';
import { LiquidSurface } from '../../components/liquid/LiquidSurface';

interface StaffManagementViewProps {
  onBack: () => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({ onBack }) => {
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<StaffRecord | null>(null);

  // Form states for Add Staff
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<StaffRole>('waiter');
  const [newPin, setNewPin] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for Edit PIN
  const [editPin, setEditPin] = useState<string>('');
  const [editPinError, setEditPinError] = useState<string | null>(null);

  const currentUser = useStaffAuthStore((s) => s.currentUser);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await StaffService.getAllStaff();
      setStaffList(records);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (!newName.trim()) {
        throw new Error('لطفاً نام پرسنل را وارد کنید.');
      }
      if (!/^\d{4}$/.test(newPin.trim())) {
        throw new Error('پین‌کد ورود باید دقیقاً ۴ رقم عددی باشد.');
      }

      await StaffService.addStaff(newName, newRole, newPin);
      playPosBeep('success');
      setNewName('');
      setNewPin('');
      setNewRole('waiter');
      setIsAddModalOpen(false);
      await loadStaff();
    } catch (err: any) {
      playPosBeep('error');
      setFormError(err.message || 'خطا در ثبت پرسنل');
    }
  };

  const handleToggleSuspend = async (staff: StaffRecord) => {
    playPosBeep('click');
    const newStatus = !staff.isActive;
    const actionText = newStatus ? 'فعال‌سازی' : 'تعلیق';

    if (staff.id === currentUser?.id) {
      alert('شما نمی‌توانید حساب کاربری جاری خود را تعلیق کنید.');
      return;
    }

    try {
      await StaffService.updateStaff(staff.id, { isActive: newStatus });
      await loadStaff();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت پرسنل');
    }
  };

  const handleUpdatePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditPinError(null);

    try {
      if (!/^\d{4}$/.test(editPin.trim())) {
        throw new Error('پین‌کد جدید باید دقیقاً ۴ رقم عددی باشد.');
      }

      await StaffService.updateStaff(editTarget.id, { pin: editPin });
      playPosBeep('success');
      setEditTarget(null);
      setEditPin('');
      await loadStaff();
    } catch (err: any) {
      playPosBeep('error');
      setEditPinError(err.message || 'خطا در بروزرسانی پین');
    }
  };

  const formatLastLogin = (ts?: number) => {
    if (!ts) return 'هنوز وارد نشده';
    const date = new Date(ts);
    return `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  return (
    <div
      dir="rtl"
      className="min-h-full w-full bg-[#06120F] text-white p-4 md:p-8 select-none font-sans relative overflow-y-auto"
    >
      <div className="max-w-6xl w-full mx-auto space-y-6 pb-20">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl liquid-glass-shell border border-[#16382F] shadow-xl">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                playPosBeep('click');
                onBack();
              }}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
              title="بازگشت"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white">
                مدیریت پرسنل و دسترسی‌های پایانه
              </h1>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                تعریف پرسنل، پین‌کد ۴ رقمی ورود (هش‌شده با Bcrypt) و سطح دسترسی نقش‌ها
              </p>
            </div>
          </div>

          <LiquidSurface
            as="button"
            magnetic={true}
            onClick={() => {
              playPosBeep('click');
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="h-11 px-5 rounded-2xl bg-[#005A3E] hover:bg-[#007A54] text-white font-bold text-xs flex items-center gap-2 border border-emerald-400/40 shadow-lg cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-200" />
            <span>افزودن پرسنل جدید</span>
          </LiquidSurface>
        </div>

        {/* Staff Cards Grid */}
        {isLoading ? (
          <div className="text-center py-16 text-[#94A3B8] text-sm animate-pulse">
            در حال بارگذاری لیست پرسنل از پایگاه داده محلی...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffList.map((member) => {
              const def = STAFF_ROLE_DEFINITIONS[member.role] || STAFF_ROLE_DEFINITIONS.waiter;
              const isCurrent = member.id === currentUser?.id;

              return (
                <div
                  key={member.id}
                  className={`rounded-3xl p-5 liquid-glass-card border flex flex-col justify-between transition-all ${
                    member.isActive
                      ? 'border-[#16382F] hover:border-emerald-500/40'
                      : 'border-rose-950/40 opacity-75 bg-rose-950/10'
                  }`}
                >
                  {/* Top: Name + Role Badge + Status */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            member.isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {member.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-white text-sm">{member.name}</h2>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                                شما
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block mt-1 ${def.badgeBg}`}
                          >
                            {def.titleFa}
                          </span>
                        </div>
                      </div>

                      {/* Active/Suspended Tag */}
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          member.isActive
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {member.isActive ? 'فعال' : 'معلق'}
                      </span>
                    </div>

                    <p className="text-xs text-[#94A3B8] my-3 leading-relaxed">
                      {def.descriptionFa}
                    </p>
                  </div>

                  {/* Bottom: Last Login & Action Buttons */}
                  <div className="pt-3 border-t border-[#16382F] space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-white/40" />
                        <span>آخرین ورود:</span>
                      </span>
                      <span className="font-mono text-white/90">
                        {formatLastLogin(member.lastLoginAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playPosBeep('click');
                          setEditTarget(member);
                          setEditPin('');
                          setEditPinError(null);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                        <span>تغییر PIN</span>
                      </button>

                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => handleToggleSuspend(member)}
                        className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                          isCurrent
                            ? 'opacity-30 cursor-not-allowed border-white/5 text-white/40'
                            : member.isActive
                            ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/30 text-rose-200 cursor-pointer'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/30 text-emerald-200 cursor-pointer'
                        }`}
                      >
                        {member.isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5 text-rose-300" />
                            <span>تعلیق</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                            <span>فعال‌سازی</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL 1: ADD NEW STAFF
         ===================================================================== */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl p-6 liquid-glass-shell border border-[#16382F] shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#16382F] mb-4">
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">تعریف پرسنل جدید</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddStaffSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    نام و نام خانوادگی پرسنل:
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: علیرضا حسینی"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#092219] border border-[#16382F] focus:border-emerald-400 text-white text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">نقش کاربری:</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as StaffRole)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#092219] border border-[#16382F] focus:border-emerald-400 text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="owner" className="bg-[#092219] text-white">
                      مالک / ادمین سیستم (دسترسی کامل)
                    </option>
                    <option value="manager" className="bg-[#092219] text-white">
                      مدیر شیفت (دسترسی کامل)
                    </option>
                    <option value="cashier" className="bg-[#092219] text-white">
                      صندوق‌دار (صندوق + تسویه + سالن)
                    </option>
                    <option value="waiter" className="bg-[#092219] text-white">
                      سالن‌کار (فقط ثبت سفارش میز / بدون تسویه)
                    </option>
                    <option value="barista" className="bg-[#092219] text-white">
                      باریستا (فقط KDS)
                    </option>
                    <option value="cook" className="bg-[#092219] text-white">
                      آشپز (فقط KDS)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    پین‌کد ۴ رقمی ورود (PIN):
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="۴ رقم عددی (مثلاً ۵۵۵۵)"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#092219] border border-[#16382F] focus:border-emerald-400 text-white text-center font-mono text-base tracking-widest outline-none"
                  />
                  <span className="text-[10px] text-[#64748B] block mt-1">
                    پین‌کد مستقیماً با سالت و Bcrypt هش شده و در پایگاه محلی ذخیره می‌شود.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg cursor-pointer"
                  >
                    ثبت و ذخیره پرسنل
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODAL 2: CHANGE STAFF PIN
         ===================================================================== */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 liquid-glass-shell border border-[#16382F] shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#16382F] mb-4">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">
                    تغییر پین‌کد: {editTarget.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editPinError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-bold">
                  {editPinError}
                </div>
              )}

              <form onSubmit={handleUpdatePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    پین‌کد جدید ۴ رقمی:
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    autoFocus
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="۴ رقم"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#092219] border border-[#16382F] focus:border-amber-400 text-white text-center font-mono text-lg tracking-widest outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg cursor-pointer"
                  >
                    بروزرسانی پین‌کد
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
