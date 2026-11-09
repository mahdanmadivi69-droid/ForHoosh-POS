/**
 * CAFE OS — Industrial PIN Elevation Dialer Modal (PinAuthModal)
 * Compliant with CafeOS-RBAC-Settings-Hardware-Handoff v2.4.0
 * 
 * UI Spec:
 *  - Layout: Centered industrial dialer overlay
 *  - Backdrop: backdrop-blur-sm bg-black/70
 *  - Panel Surface: #1F242C
 *  - Keypad Keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ESC"]
 *  - Tactile Spring: stiffness: 500, damping: 30, mass: 0.6
 *  - Acoustic Feedback: Tap (750Hz), Error (220Hz), Success (880Hz)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Lock, CheckCircle2, AlertTriangle, X, KeyRound, Sparkles } from 'lucide-react';
import { ElevationAction } from '../../types/rbac-settings';
import { RBACService, ELEVATION_ACTION_LABELS } from '../../services/RBACService';
import { audioFeedback } from '../../services/audioFeedback';

interface PinAuthModalProps {
  isOpen: boolean;
  action: ElevationAction;
  requestedByUser: string;
  onSuccess: (authorizedBy: string) => void;
  onClose: () => void;
  metadata?: Record<string, any>;
}

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'ESC'];

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  action,
  requestedByUser,
  onSuccess,
  onClose,
  metadata,
}) => {
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showDemoHints, setShowDemoHints] = useState<boolean>(false);

  // Clear state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      setIsShaking(false);
      setIsSuccess(false);
    }
  }, [isOpen]);

  const verifyPinAttempt = useCallback(
    async (pinToVerify: string) => {
      if (pinToVerify.length < 4 || isVerifying) return;
      setIsVerifying(true);
      setErrorMessage(null);

      try {
        const result = await RBACService.verifyElevationPin(
          pinToVerify,
          action,
          requestedByUser,
          metadata
        );

        if (result.success && result.authorizedUser) {
          audioFeedback.playSuccess();
          setIsSuccess(true);
          setTimeout(() => {
            onSuccess(`${result.authorizedUser!.fullName} (${result.authorizedUser!.role})`);
          }, 350);
        } else {
          audioFeedback.playError();
          setIsShaking(true);
          setErrorMessage(result.error || 'پین‌کد وارد شده نامعتبر است.');
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
          }, 500);
        }
      } catch (err: any) {
        audioFeedback.playError();
        setIsShaking(true);
        setErrorMessage(err.message || 'خطا در برقراری ارتباط امنیتی');
        setTimeout(() => setIsShaking(false), 500);
      } finally {
        setIsVerifying(false);
      }
    },
    [action, requestedByUser, metadata, onSuccess, isVerifying]
  );

  const handleKeyPress = useCallback(
    (key: string) => {
      if (isVerifying || isSuccess) return;

      if (key === 'ESC') {
        audioFeedback.playTap();
        onClose();
        return;
      }

      if (key === 'CLR') {
        audioFeedback.playTap();
        setPin('');
        setErrorMessage(null);
        return;
      }

      if (/^\d$/.test(key)) {
        if (pin.length >= 6) return; // Max 6 digits
        audioFeedback.playTap();
        const nextPin = pin + key;
        setPin(nextPin);
        setErrorMessage(null);

        // Auto verify on 4 digits or 6 digits
        if (nextPin.length === 4) {
          // Verify on 4 digits, but allow continuing if user types 5th
          setTimeout(() => {
            verifyPinAttempt(nextPin);
          }, 60);
        }
      }
    },
    [pin, isVerifying, isSuccess, onClose, verifyPinAttempt]
  );

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        audioFeedback.playTap();
        setPin((prev) => prev.slice(0, -1));
        setErrorMessage(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) {
          verifyPinAttempt(pin);
        }
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, handleKeyPress, verifyPinAttempt, onClose]);

  if (!isOpen) return null;

  const actionInfo = ELEVATION_ACTION_LABELS[action] || {
    fa: 'عملیات با حساسیت بالا',
    requiredRole: 'مدیر شیفت یا مالک',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70 select-none">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
            x: isShaking ? [-8, 8, -6, 6, -3, 3, 0] : 0,
          }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
            mass: 0.6,
          }}
          className="relative w-full max-w-[380px] bg-[#1F242C] rounded-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden"
          dir="rtl"
        >
          {/* Header Bar */}
          <div className="bg-[#161A1F] border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D71921]/15 border border-[#D71921]/30 flex items-center justify-center text-[#D71921]">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>گیت امنیتی پین‌کد</span>
                  <span className="text-[10px] bg-red-950/80 text-red-300 border border-red-800/50 px-1.5 py-0.2 rounded font-mono">
                    RBAC GATE
                  </span>
                </h3>
                <p className="text-[11px] text-[#9EACB8]">تایید هویت برای ارتقای دسترسی موقت</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] text-[#9EACB8] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Context Box */}
          <div className="p-4 pb-2">
            <div className="bg-[#161A1F] border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-bold text-gray-200">{actionInfo.fa}</div>
                <div className="text-[11px] text-[#9EACB8] mt-1 flex items-center justify-between">
                  <span>
                    درخواست‌کننده: <strong className="text-white">{requestedByUser}</strong>
                  </span>
                  <span className="text-amber-400 font-medium">مجوز: {actionInfo.requiredRole}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PIN Digit Indicators */}
          <div className="px-4 py-3 flex flex-col items-center">
            <div className="text-xs text-[#9EACB8] mb-2 font-medium flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-gray-400" />
              <span>پین‌کد ۴ تا ۶ رقمی مدیر را وارد کنید:</span>
            </div>

            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const isFilled = index < pin.length;
                return (
                  <motion.div
                    key={index}
                    animate={{
                      scale: isFilled ? [1, 1.25, 1] : 1,
                      backgroundColor: isSuccess
                        ? '#10B981'
                        : isShaking
                        ? '#D71921'
                        : isFilled
                        ? '#D71921'
                        : '#161A1F',
                      borderColor: isSuccess
                        ? '#10B981'
                        : isShaking
                        ? '#D71921'
                        : isFilled
                        ? '#D71921'
                        : 'rgba(255, 255, 255, 0.15)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all shadow-inner ${
                      isFilled ? 'shadow-[0_0_10px_rgba(215,25,33,0.5)]' : ''
                    }`}
                  />
                );
              })}
            </div>

            {/* Error or Success Feedback Message */}
            <div className="h-6 mt-1 flex items-center justify-center text-center">
              {errorMessage ? (
                <span className="text-xs font-bold text-[#D71921] flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{errorMessage}</span>
                </span>
              ) : isSuccess ? (
                <span className="text-xs font-bold text-[#10B981] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>هویت تایید شد. در حال ارتقا دسترسی...</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#9EACB8]/70">
                  {pin.length === 0 ? 'رمز به صورت محلی و با هش SHA-256 پردازش می‌شود' : `تعداد رقم: ${pin.length}`}
                </span>
              )}
            </div>
          </div>

          {/* Keypad Grid (3x4) */}
          <div className="p-4 pt-1">
            <div dir="ltr" style={{ direction: 'ltr' }} className="grid grid-cols-3 gap-2.5">
              {KEYPAD_KEYS.map((key) => {
                const isClear = key === 'CLR';
                const isEsc = key === 'ESC';

                return (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                      mass: 0.6,
                    }}
                    onClick={() => handleKeyPress(key)}
                    disabled={isVerifying || isSuccess}
                    className={`h-12 rounded-xl text-base font-black transition-all flex items-center justify-center border cursor-pointer ${
                      isClear
                        ? 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-600/40 text-amber-400'
                        : isEsc
                        ? 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-600/40 text-rose-400'
                        : 'bg-[#161A1F] hover:bg-[#252B34] active:bg-[#D71921]/20 border-white/5 hover:border-white/20 text-white font-mono shadow-sm'
                    }`}
                  >
                    {isClear ? (
                      <span className="text-xs font-sans font-bold">پاک کردن</span>
                    ) : isEsc ? (
                      <span className="text-xs font-sans font-bold">انصراف</span>
                    ) : (
                      <span className="text-lg font-bold">{key}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Quick Demo Assist Banner */}
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setShowDemoHints(!showDemoHints)}
              className="w-full text-center text-[10px] text-[#9EACB8]/80 hover:text-white flex items-center justify-center gap-1 py-1 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{showDemoHints ? 'مخفی‌سازی پین‌های آزمایشی' : 'نمایش پین‌کدهای پیش‌فرض آزمایشی'}</span>
            </button>

            {showDemoHints && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-1.5 p-2 bg-[#161A1F] rounded-lg border border-white/5 text-[10px] text-gray-300 space-y-1"
              >
                <div className="flex justify-between">
                  <span>مالک (Admin):</span>
                  <code className="text-[#D71921] font-mono font-bold">1234</code>
                </div>
                <div className="flex justify-between">
                  <span>مدیر شیفت (Manager):</span>
                  <code className="text-amber-400 font-mono font-bold">1111</code>
                </div>
                <div className="flex justify-between">
                  <span>حسابدار (Accountant):</span>
                  <code className="text-blue-400 font-mono font-bold">5678</code>
                </div>
                <div className="flex justify-between">
                  <span>باریستا (Barista):</span>
                  <code className="text-emerald-400 font-mono font-bold">0000 (بدون ارتقا)</code>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
