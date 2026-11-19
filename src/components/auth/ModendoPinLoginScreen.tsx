/**
 * src/components/auth/ModendoPinLoginScreen.tsx
 * 
 * Modendo Dedicated 4-Digit PIN Authentication Gate.
 * Enforces bcrypt verification, 3-strike 5-minute lockout, and tactile Liquid Glass numpad.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, ShieldAlert, Clock, AlertTriangle, Delete, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StaffService, StaffRecord } from '../../services/staffService';
import { useStaffAuthStore } from '../../stores/useStaffAuthStore';
import { playPosBeep } from '../../services/soundEffects';
import { normalizeDigits } from '../../utils/digitNormalizer';
import { LiquidSurface } from '../liquid/LiquidSurface';

interface ModendoPinLoginScreenProps {
  onLoginSuccess: (user: StaffRecord) => void;
}

export const ModendoPinLoginScreen: React.FC<ModendoPinLoginScreenProps> = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(StaffService.getLockoutRemainingSeconds());

  const setCurrentUser = useStaffAuthStore((s) => s.setCurrentUser);

  // Eager pre-seed default staff on clean profile mount
  useEffect(() => {
    StaffService.seedDefaultStaff().catch(() => {});
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = StaffService.getLockoutRemainingSeconds();
      setLockoutRemaining(remaining);
      if (remaining === 0 && errorMessage?.includes('قفل')) {
        setErrorMessage(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [errorMessage]);

  const handleVerify = useCallback(
    async (pinToVerify: string) => {
      if (isVerifying || lockoutRemaining > 0) return;
      setIsVerifying(true);
      setErrorMessage(null);

      try {
        const result = await StaffService.authenticateWithPin(pinToVerify);
        if (result.success && result.user) {
          playPosBeep('success');
          setCurrentUser(result.user);
          onLoginSuccess(result.user);
        } else {
          playPosBeep('error');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setErrorMessage(result.error || 'پین‌کد وارد شده نامعتبر است.');
          setPin('');
          setLockoutRemaining(StaffService.getLockoutRemainingSeconds());
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'خطا در احراز هویت');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, lockoutRemaining, onLoginSuccess, setCurrentUser]
  );

  const handleKeyPress = useCallback(
    (key: string) => {
      if (lockoutRemaining > 0) return;
      playPosBeep('click');
      setErrorMessage(null);

      if (key === 'CLEAR') {
        setPin('');
        return;
      }

      if (key === 'BACKSPACE') {
        setPin((prev) => prev.slice(0, -1));
        return;
      }

      if (/^\d$/.test(key)) {
        if (pin.length < 4) {
          const nextPin = pin + key;
          setPin(nextPin);
          if (nextPin.length === 4) {
            handleVerify(nextPin);
          }
        }
      }
    },
    [pin, lockoutRemaining, handleVerify]
  );

  // Keyboard hardware listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutRemaining > 0) return;
      const normalized = normalizeDigits(e.key);
      if (/^\d$/.test(normalized)) {
        handleKeyPress(normalized);
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACKSPACE');
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleKeyPress('CLEAR');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, lockoutRemaining]);

  const mins = Math.floor(lockoutRemaining / 60);
  const secs = lockoutRemaining % 60;
  const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-[#06120F] text-white flex flex-col items-center justify-center p-4 select-none font-sans relative overflow-hidden"
    >
      {/* Liquid background aesthetic mesh */}
      <div className="absolute inset-0 bg-radial from-emerald-950/40 via-[#06120F] to-[#040B09] pointer-events-none" />

      {/* Main Container Card */}
      <motion.div
        animate={isShaking ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-sm rounded-3xl p-6 md:p-8 liquid-glass-shell border border-[#16382F] shadow-2xl flex flex-col items-center text-center"
      >
        {/* Brand Header */}
        <div className="relative mb-5 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.25)] mb-3">
            <img
              src="/tenants/modendo/modendo-mark.svg"
              alt="Modendo"
              className="w-9 h-9 object-contain"
            />
          </div>
          <h1 className="text-lg font-black text-white tracking-tight font-fa-sans">
            کافه گیمینگ مودندو
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">
            ورود پرسنل به پایانه فروشگاهی (PIN)
          </p>
        </div>

        {/* Lockout Banner */}
        {lockoutRemaining > 0 ? (
          <div className="w-full mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex flex-col items-center gap-1.5 animate-pulse">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>پایانه به علت ۳ بار ورود اشتباه قفل شد</span>
            </div>
            <div className="font-mono text-xl font-black text-rose-200 mt-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{timeFormatted}</span>
            </div>
          </div>
        ) : (
          /* 4-Digit Dot Indicator */
          <div className="flex items-center justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-emerald-400 shadow-[0_0_12px_#10B981] scale-110'
                      : 'bg-white/10 border border-white/20'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Error Feedback Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="w-full mb-4 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* POS 12-Key Numpad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACKSPACE'].map(
            (keyVal) => {
              const isAction = keyVal === 'CLEAR' || keyVal === 'BACKSPACE';
              const isDisabled = lockoutRemaining > 0 || isVerifying;

              return (
                <LiquidSurface
                  key={keyVal}
                  as="button"
                  disabled={isDisabled}
                  onClick={() => handleKeyPress(keyVal)}
                  className={`h-14 rounded-2xl flex items-center justify-center font-bold text-lg select-none transition-all cursor-pointer ${
                    isDisabled ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    isAction
                      ? 'bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] border border-white/[0.08] text-sm'
                      : 'bg-[#0E2922]/80 hover:bg-[#12382E] text-white border border-[#16382F] hover:border-[#10B981]/50 text-xl font-mono'
                  }`}
                >
                  {keyVal === 'CLEAR' ? (
                    <span className="font-sans font-bold text-xs text-rose-300">C</span>
                  ) : keyVal === 'BACKSPACE' ? (
                    <Delete className="w-5 h-5 text-amber-300" />
                  ) : (
                    keyVal
                  )}
                </LiquidSurface>
              );
            }
          )}
        </div>

        {/* Hint text */}
        <p className="text-[11px] text-[#64748B] mt-6">
          پین‌کد پیش‌فرض: مالک ۱۱۱۱ · مدیر ۲۲۲۲ · صندوق ۳۳۳۳ · سالن ۴۴۴۴
        </p>
      </motion.div>
    </div>
  );
};
