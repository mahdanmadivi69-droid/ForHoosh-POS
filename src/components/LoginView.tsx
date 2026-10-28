import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Coffee,
  CheckCircle2,
  Shield,
  KeyRound,
} from 'lucide-react';
import { User, Tenant } from '../types/domain';
import { SmartOrdersStore } from '../services/storage';
import { playPosBeep } from '../services/soundEffects';

interface LoginViewProps {
  tenant: Tenant;
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ tenant, onLoginSuccess }) => {
  const [usernameOrPhone, setUsernameOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const allUsers = SmartOrdersStore.getUsers();

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    playPosBeep('click');
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = SmartOrdersStore.login(usernameOrPhone, password);
      setIsLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'خطا در ورود به سامانه');
      }
    }, 250);
  };

  const handleQuickSelect = (u: User) => {
    playPosBeep('click');
    setUsernameOrPhone(u.username || u.phoneNumber);
    setPassword(u.password || '123');
    setErrorMessage(null);

    // Auto-login on quick select for high-speed POS workflow
    setIsLoading(true);
    setTimeout(() => {
      const res = SmartOrdersStore.login(u.username || u.phoneNumber, u.password || '123');
      setIsLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'خطا در ورود');
      }
    }, 200);
  };

  return (
    <div className="min-h-screen bg-[#081425] text-white flex flex-col justify-center items-center px-4 py-8 relative selection:bg-[#D71921] selection:text-white overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#D71921]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#0F223D] rounded-full blur-[140px] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0F223D]/90 backdrop-blur-xl border border-[#293444] rounded-2xl shadow-2xl p-6 sm:p-8 z-10 transition-all">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 bg-[#081425] border border-[#293444] px-4 py-2.5 rounded-xl shadow-inner mb-4">
            <div className="text-left font-black tracking-tighter leading-none pr-1">
              <span className="text-3xl font-black text-white">100</span>
              <span className="text-[10px] block text-[#D71921] tracking-widest font-black uppercase">
                HICH
              </span>
            </div>
            <div className="h-7 w-[1.5px] bg-[#293444] mx-1"></div>
            <div className="text-right">
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>{tenant.name || 'قهوه‌فروشی صَد هیچ'}</span>
              </h1>
              <span className="text-[11px] text-[#9EACB8]">
                سامانه مدیریت سفارش و صندوق (SmartOrders)
              </span>
            </div>
          </div>

          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-[#D71921]" />
            <span>ورود به پنل سفارش‌گیری</span>
          </h2>
          <p className="text-xs text-[#9EACB8] mt-1">
            جهت دسترسی به صندوق و ثبت سفارش، با حساب پرسنلی خود وارد شوید
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 bg-rose-950/60 border border-rose-800 text-rose-200 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username / Phone */}
          <div>
            <label className="block text-xs font-bold text-[#CAD5E2] mb-1.5 text-right">
              نام کاربری یا شماره همراه
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#9EACB8]">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={usernameOrPhone}
                onChange={(e) => setUsernameOrPhone(e.target.value)}
                placeholder="مثلاً: admin یا ali یا 09120000003"
                dir="ltr"
                className="w-full bg-[#121417] border border-[#293444] focus:border-[#D71921] focus:ring-1 focus:ring-[#D71921] rounded-xl pr-10 pl-3.5 py-2.5 text-sm text-white placeholder:text-[#526071] outline-none transition font-sans text-left"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-[#CAD5E2] mb-1.5 text-right">
              رمز عبور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#9EACB8]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور حساب"
                dir="ltr"
                className="w-full bg-[#121417] border border-[#293444] focus:border-[#D71921] focus:ring-1 focus:ring-[#D71921] rounded-xl pr-10 pl-10 py-2.5 text-sm text-white placeholder:text-[#526071] outline-none transition font-sans text-left"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#9EACB8] hover:text-white transition cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-[#D71921] hover:bg-[#b0131a] active:scale-[0.98] text-white font-black py-3 rounded-xl transition shadow-lg shadow-[#D71921]/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>در حال ورود...</span>
              </span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>ورود به سیستم صندوق</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Logins for Fast Touchscreen Usage */}
        <div className="mt-8 pt-6 border-t border-[#293444]">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-extrabold text-[#CAD5E2] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#F3E9DD]" />
              <span>ورود سریع پرسنل (لمسی):</span>
            </span>
            <span className="text-[10px] text-[#9EACB8]">رمز پیش‌فرض: 123</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {allUsers.map((u) => {
              const isFullAccess = u.role === 'OWNER' || u.role === 'MANAGER';
              const roleTitle =
                u.role === 'OWNER'
                  ? 'مدیر و مالک'
                  : u.role === 'MANAGER'
                  ? 'سرپرست شیفت'
                  : u.role === 'CASHIER'
                  ? 'صندوق‌دار'
                  : 'باریستا';

              const roleColor =
                u.role === 'OWNER'
                  ? 'border-amber-500/40 text-amber-300'
                  : u.role === 'MANAGER'
                  ? 'border-indigo-500/40 text-indigo-300'
                  : u.role === 'CASHIER'
                  ? 'border-emerald-500/40 text-emerald-300'
                  : 'border-rose-500/40 text-rose-300';

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickSelect(u)}
                  className={`bg-[#121417] hover:bg-[#1B222C] border ${roleColor} rounded-xl p-2.5 text-right transition flex flex-col gap-1 cursor-pointer active:scale-95`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">{u.fullName.split(' ')[0]}</span>
                    <span className="text-[9px] font-mono opacity-60">@{u.username}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold opacity-90">{roleTitle}</span>
                  </div>
                  <div className="pt-1 border-t border-[#293444]/60 text-[9px] flex items-center gap-1">
                    {isFullAccess ? (
                      <span className="text-emerald-400 font-medium">✓ دسترسی کامل و تدوین</span>
                    ) : (
                      <span className="text-amber-300/80 font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        <span>فقط ثبت (تدوین قفل)</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role Permissions Information Banner */}
        <div className="mt-5 p-3 rounded-xl bg-[#081425] border border-[#293444] text-[11px] text-[#9EACB8] space-y-1.5">
          <div className="font-bold text-white flex items-center gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>سطوح دسترسی سیستم:</span>
          </div>
          <div className="flex items-start gap-1.5 leading-relaxed">
            <span className="text-emerald-400 font-bold shrink-0">● مالک و مدیر:</span>
            <span>دسترسی آزاد به همه بخش‌ها (ثبت، تدوین و لغو فاکتورها، اعمال تخفیف، مدیریت منو و قیمت، گزارش مالی، حسابرسی).</span>
          </div>
          <div className="flex items-start gap-1.5 leading-relaxed">
            <span className="text-amber-400 font-bold shrink-0">● کاربران عادی (صندوق‌دار/باریستا):</span>
            <span>فقط ثبت سفارش جدید. تدوین سفارش، اعمال تخفیف، لغو فاکتور و تنظیمات منو برای این کاربران کاملاً بسته است.</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-[#526071] flex items-center justify-center gap-1.5">
          <Coffee className="w-3 h-3 text-[#D71921]" />
          <span>نسخه پایلوت ۱۰۰هیچ • طراحی شده برای صندوق‌های لمسی و کیبورد</span>
        </div>
      </div>
    </div>
  );
};
