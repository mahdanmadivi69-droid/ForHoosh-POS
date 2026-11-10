import { hapticAudio } from '../../services/hapticAudio';
import { normalizeDigits } from '../../utils/digitNormalizer';
/**
 * src/components/auth/PinLockScreen.tsx
 * 
 * KarWand POS — 100 HICH Initial Authentication & PIN Gate
 * Compliant with 100 HICH POS Workflow & Security Directives
 * 
 * Features:
 *  - Default entrypoint on application start and lock.
 *  - PBKDF2/SHA-256 salted PIN authentication for authorized active staff.
 *  - International standard 12-key POS numpad layout (1-2-3, 4-5-6, 7-8-9, C-0-Backspace).
 *  - 3-Strike Admin Lockout: 3 consecutive failed PIN attempts trigger a 30s cooldown
 *    and reveal "Request KarWand Master Recovery" with a 15-minute challenge token and QR modal.
 *  - Tactile Liquid Glass styling (Dark Carmine #8C1318 / Deep Navy #0C1930) with sound effects.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  QrCode,
  RotateCcw,
  AlertTriangle,
  UserCheck,
  Sparkles,
  KeyRound,
  X,
  Clock,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { RBACService } from '../../services/RBACService';
import { AuthUserRecord } from '../../types/rbac-settings';
import { playPosBeep } from '../../services/soundEffects';
import { audioFeedback } from '../../services/audioFeedback';
import { generateQrSvg } from '../../utils/qrCodeGenerator';


interface PinLockScreenProps {
  onUnlockSuccess: (user: AuthUserRecord) => void;
  venueTitle?: string;
  deviceId?: string;
  initialUserId?: string | null;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  onUnlockSuccess,
  venueTitle = 'قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)',
  deviceId = 'TERM-01-MAIN',
  initialUserId,
}) => {
  const [pin, setPin] = useState<string>('');
  const [activeUsers, setActiveUsers] = useState<AuthUserRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId || null);

  useEffect(() => {
    if (initialUserId) {
      setSelectedUserId(initialUserId);
    }
  }, [initialUserId]);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // 3-Strike Lockout State
  const [consecutiveFails, setConsecutiveFails] = useState<number>(0);
  const [lockoutCooldown, setLockoutCooldown] = useState<number>(0);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false);
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [challengeExpiresAt, setChallengeExpiresAt] = useState<number>(0);
  const [masterRecoveryCodeInput, setMasterRecoveryCodeInput] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Timer reference for 30s countdown
  const timerRef = useRef<any>(null);

  // Load and seed users on mount
  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      try {
        await RBACService.initDefaultUsers();
        const users = await RBACService.getAllUsers();
        if (mounted) {
          const filtered = users.filter((u) => u.isActive);
          setActiveUsers(filtered);
          // Respect initialUserId: do NOT overwrite selectedUserId with owner.id if initialUserId is provided
          if (initialUserId && filtered.some((u) => u.id === initialUserId)) {
            setSelectedUserId(initialUserId);
          } else {
            // Default selection to owner if exists, or first active
            const owner = filtered.find((u) => u.role === 'OWNER') || filtered[0];
            if (owner) setSelectedUserId(owner.id);
          }
        }
      } catch (err) {
        console.error('Failed to init users for PIN gate:', err);
      }
    };
    initializeAuth();
    return () => {
      mounted = false;
    };
  }, [initialUserId]);

  // Cooldown countdown effect
  useEffect(() => {
    if (lockoutCooldown > 0) {
      timerRef.current = setInterval(() => {
        setLockoutCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutCooldown]);

  // Keypad keys definitions (Standard 12-key format: 1-2-3 top, 4-5-6, 7-8-9, C-0-Backspace)
  const KEYPAD_ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ];

  // Auto-verify when 4 digits are reached
  useEffect(() => {
    if (pin.length === 4 && !isVerifying && lockoutCooldown === 0) {
      handleVerifyPin(pin);
    }
  }, [pin, isVerifying, lockoutCooldown]);

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRecoveryModalOpen) return;
      if (lockoutCooldown > 0) return;

      const normalizedChar = normalizeDigits(e.key);
      if (/^[0-9]$/.test(normalizedChar)) {
        e.preventDefault();
        handleDigit(normalizedChar);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isVerifying, lockoutCooldown, isRecoveryModalOpen]);

  const handleDigit = (digit: string) => {
    if (lockoutCooldown > 0 || isVerifying) return;
    if (pin.length >= 6) return;

    hapticAudio.playKeyClick();
    hapticAudio.vibrate(15);
    try { audioFeedback.playTap(); } catch { playPosBeep('click'); }

    setErrorMessage(null);
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (lockoutCooldown > 0 || isVerifying) return;
    hapticAudio.playKeyClick();
    hapticAudio.vibrate(12);
    try { audioFeedback.playTap(); } catch { playPosBeep('click'); }
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isVerifying) return;
    hapticAudio.playKeyClick();
    hapticAudio.vibrate(20);
    try { audioFeedback.playTap(); } catch { playPosBeep('click'); }
    setPin('');
    setErrorMessage(null);
  };

  const handleVerifyPin = async (pinAttempt: string) => {
    setIsVerifying(true);
    setErrorMessage(null);
    const cleanAttempt = normalizeDigits(pinAttempt);

    try {
      const res = await RBACService.verifyLoginPin(
        cleanAttempt,
        selectedUserId || undefined
      );

      if (res.success && res.user) {
        // Reset failures
        setConsecutiveFails(0);
        hapticAudio.playSuccessChime();
        hapticAudio.vibrate(50);
        try { audioFeedback.playSuccess(); } catch { playPosBeep('success'); }
        onUnlockSuccess(res.user);
      } else {
        triggerFailedAttempt();
      }
    } catch (err: any) {
      triggerFailedAttempt();
    } finally {
      setIsVerifying(false);
      setPin('');
    }
  };

  const triggerFailedAttempt = () => {
    hapticAudio.playErrorBuzz();
    hapticAudio.vibrate(60);
    try { audioFeedback.playError(); } catch { playPosBeep('delete'); }

    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);

    const nextFails = consecutiveFails + 1;
    setConsecutiveFails(nextFails);

    if (nextFails >= 3) {
      // 3-Strike Admin Lockout Triggered
      setLockoutCooldown(30);
      setErrorMessage('تعداد دفعات ناموفق به ۳ بار رسید. قفل امنیتی ۳۰ ثانیه‌ای فعال گردید.');
      generateRecoveryChallenge();
    } else {
      setErrorMessage(`پین‌کد اشتباه است. (${3 - nextFails} فرصت باقی‌مانده)`);
    }
  };

  // Generate 15-Minute KarWand Challenge Token
  const generateRecoveryChallenge = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let tokenPartA = '';
    let tokenPartB = '';
    for (let i = 0; i < 4; i++) {
      tokenPartA += chars.charAt(Math.floor(Math.random() * chars.length));
      tokenPartB += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const token = `KW-RECOV-${tokenPartA}-${tokenPartB}`;
    setChallengeToken(token);
    setChallengeExpiresAt(Date.now() + 15 * 60 * 1000); // 15 mins
  };

  const handleUnlockWithMasterRecovery = () => {
    const input = masterRecoveryCodeInput.trim();
    if (challengeExpiresAt && Date.now() > challengeExpiresAt) {
      playPosBeep('delete');
      setRecoveryError('مهلت توکن بازیابی منقضی شده است. لطفاً مجدداً تلاش کنید.');
      return;
    }
    // Master emergency verification: strictly matching the dynamic token challenge suffix
    if (challengeToken && input.toUpperCase() === challengeToken.slice(-4)) {
      playPosBeep('success');
      setConsecutiveFails(0);
      setLockoutCooldown(0);
      setIsRecoveryModalOpen(false);
      setErrorMessage(null);
      setMasterRecoveryCodeInput('');
      setRecoveryError(null);
    } else {
      playPosBeep('delete');
      setRecoveryError('کد مستر بازیابی نامعتبر است.');
    }
  };

  const selectedUser = activeUsers.find((u) => u.id === selectedUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#070A0F] text-white select-none overflow-hidden">
      {/* Dynamic Ambient Background Mesh */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#8C1318] blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#0F223D] blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#9E8A5E]/20 blur-[100px]" />
      </div>

      {/* Main Glass Lock Terminal */}
      <div
        className="w-full max-w-md bg-[rgba(12,25,48,0.92)] border border-[rgba(144,210,237,0.32)] rounded-[32px] p-6 sm:p-7 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-[34px] flex flex-col items-center relative z-10"
        style={{
          boxShadow: 'inset 0 1px 1.5px 0 rgba(144,210,237,0.35), 0 24px 60px -15px rgba(0, 0, 0, 0.90)',
        }}
      >
        {/* Terminal Header */}
        <div className="text-center mb-5 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8C1318] to-[#450A0D] border border-[rgba(144,210,237,0.4)] flex items-center justify-center shadow-[0_0_24px_rgba(140,19,24,0.6)] mb-2.5">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 justify-center">
            <span>{venueTitle}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-mono text-[#90D2ED] bg-[rgba(144,210,237,0.1)] px-2 py-0.5 rounded-full border border-[rgba(144,210,237,0.25)]">
              {deviceId}
            </span>
            <span className="text-[11px] text-slate-300 font-medium">قفل امنیتی ترمینال POS</span>
          </div>
        </div>

        {/* Staff Profile Selector Chips - Hard-Contained Liquid Glass Carousel */}
        <div className="w-full max-w-[320px] mx-auto mb-4 relative">
          <div className="overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 flex gap-2 snap-x snap-mandatory">
            {activeUsers.map((u) => {
              const isSelected = selectedUserId === u.id;
              const isOwner = u.role === 'OWNER';
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(u.id);
                    setPin('');
                    setErrorMessage(null);
                  }}
                  className={`shrink-0 w-[95px] h-[48px] rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center p-1 snap-start ${
                    isSelected
                      ? isOwner
                        ? 'bg-gradient-to-r from-[var(--color-brand-primary,#8C1318)] to-[#5e0c10] border-[var(--color-brand-accent,#90D2ED)] text-white shadow-[0_0_16px_var(--color-brand-primary-light,rgba(140,19,24,0.5))] backdrop-blur-md'
                        : 'bg-gradient-to-r from-[var(--color-brand-secondary,#0F2E5A)] to-[#0A1E3B] border-[var(--color-brand-accent,#90D2ED)] text-white shadow-[0_0_16px_var(--color-brand-secondary-light,rgba(15,46,90,0.5))] backdrop-blur-md'
                      : 'bg-white/5 border border-white/10 backdrop-blur-md text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs font-bold truncate w-full text-center">{u.fullName}</span>
                  <span className="text-[10px] opacity-60 truncate w-full text-center">
                    {isOwner ? 'مالک / مدیر' : u.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN Mask Dots Indicator */}
        <div className={`my-3 flex items-center justify-center gap-3.5 ${isShaking ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border transition-all duration-200 ${
                  filled
                    ? 'bg-[#90D2ED] border-[#90D2ED] shadow-[0_0_12px_#90D2ED] scale-110'
                    : 'bg-white/10 border-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Error / Cooldown Banner */}
        {lockoutCooldown > 0 ? (
          <div className="w-full mb-3 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-center animate-pulse">
            <span className="text-xs text-rose-300 font-bold block">
              قفل موقت فعال است: <strong>{lockoutCooldown} ثانیه</strong> صبر کنید
            </span>
          </div>
        ) : errorMessage ? (
          <div className="w-full mb-3 p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-center">
            <span className="text-xs text-rose-300 font-medium block">{errorMessage}</span>
          </div>
        ) : (
          <div className="w-full mb-3 text-center">
            <span className="text-xs text-slate-400 font-medium">پین‌کد ۴ رقمی خود را وارد نمایید</span>
          </div>
        )}

        {/* International Standard 12-Key Numpad */}
        <div dir="ltr" style={{ direction: 'ltr' }} className="w-full max-w-[290px] grid grid-cols-3 gap-2.5 mb-4">
          {KEYPAD_ROWS.flat().map((key) => {
            const isClear = key === 'C';
            const isBackspace = key === '⌫';
            const isDisabled = lockoutCooldown > 0 || isVerifying;

            return (
              <button
                key={key}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (isClear) handleClear();
                  else if (isBackspace) handleBackspace();
                  else handleDigit(key);
                }}
                className={`h-14 rounded-2xl border text-lg sm:text-xl font-bold font-mono transition-all flex items-center justify-center cursor-pointer active:scale-95 select-none ${
                  isDisabled
                    ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-slate-500'
                    : isClear
                    ? 'bg-rose-950/40 border-rose-800/40 text-rose-300 hover:bg-rose-900/50'
                    : isBackspace
                    ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/70'
                    : 'bg-white/8 hover:bg-white/15 border-white/12 text-white shadow-sm hover:border-[rgba(144,210,237,0.3)]'
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* 3-Strike Lockout Recovery Action Button */}
        {consecutiveFails >= 3 && (
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              if (!challengeToken) generateRecoveryChallenge();
              setIsRecoveryModalOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-amber-400/50 shadow-lg hover:brightness-110 transition cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>درخواست بازیابی مستر کاروند (Master Recovery)</span>
          </button>
        )}

        {/* Footer Hint */}
        <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-center gap-3">
          <span>ورود امن با پین‌کد اختصاصی پرسنل</span>
        </div>
      </div>

      {/* KarWand Master Recovery Modal */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="w-full max-w-md bg-[rgba(12,25,48,0.95)] border border-amber-500/50 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-right relative overflow-hidden"
            style={{
              boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25)',
            }}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">بازیابی اضطراری مستر کاروند</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed text-center mb-4">
              به دلیل ۳ بار ورود ناموفق پین، برای بازگشایی آنی یا ریست کردن شمارنده خطا، کیوآرکد زیر را با تبلت پشتیبان اسکن کنید یا مستر کد را وارد نمایید.
            </p>

            {/* Render Crisp SVG QR Code */}
            <div className="p-3 bg-white rounded-2xl shadow-inner mb-3 flex items-center justify-center">
              <div
                dangerouslySetInnerHTML={{
                  __html: generateQrSvg(
                    JSON.stringify({
                      token: challengeToken,
                      deviceId,
                      venue: '100hich-yousefabad',
                      expiresAt: challengeExpiresAt,
                    }),
                    { size: 160 }
                  ),
                }}
              />
            </div>

            {/* Token Badge & Expiry */}
            <div className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-center mb-4">
              <span className="text-[11px] text-slate-400 block mb-0.5">توکن چالش ۱۵ دقیقه‌ای:</span>
              <span className="text-sm font-black font-mono tracking-widest text-[#90D2ED]">
                {challengeToken}
              </span>
            </div>

            {/* Master Recovery Code Input */}
            <div className="w-full space-y-2 mb-4">
              <label className="text-[11px] font-bold text-slate-300 block">
                مستر کد اضطراری کاروند (۴ کاراکتر انتهای توکن چالش):
              </label>
              <input
                type="password"
                maxLength={6}
                value={masterRecoveryCodeInput}
                onChange={(e) => setMasterRecoveryCodeInput(e.target.value)}
                placeholder="کد مستر..."
                className="w-full py-2.5 px-3 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-center text-lg focus:border-amber-400 outline-none"
              />
              {recoveryError && (
                <span className="text-[11px] text-rose-400 font-bold block text-center">
                  {recoveryError}
                </span>
              )}
            </div>

            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={handleUnlockWithMasterRecovery}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition cursor-pointer shadow-md"
              >
                تایید و بازگشایی قفل
              </button>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
