import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running in standalone window mode, suppress prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Edge flow with native install prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold px-3 py-1 rounded-md text-xs shadow-md transition-all cursor-pointer active:scale-95"
        title="نصب اپلیکیشن روی دستگاه یا دسکتاپ برای دسترسی آفلاین"
      >
        <Download className="w-3.5 h-3.5" />
        <span>نصب نرم‌افزار (PWA)</span>
      </button>
    );
  }

  // iOS Safari flow (WebKit doesn't fire beforeinstallprompt event)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-750 text-amber-400 border border-stone-700 hover:border-amber-500/40 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer"
          title="راهنمای افزودن به صفحه اصلی آیفون و آیپد"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>نصب در iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-800 p-5 shadow-2xl text-stone-100 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm font-bold">نصب SmartOrders در آیفون / آیپد</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-stone-400 hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed">
                برای استفاده از سامانه صندوق به صورت تمام‌صفحه و آفلاین در سیستم‌عامل iOS مراحل زیر را انجام دهید:
              </p>

              <div className="flex flex-col gap-3 bg-stone-950 p-3.5 rounded-xl border border-stone-800 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                    ۱
                  </span>
                  <div className="flex items-center gap-1.5 text-stone-200">
                    <span>در نوار پایین سافاری روی دکمه</span>
                    <Share2 className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white">Share</span>
                    <span>بزنید.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                    ۲
                  </span>
                  <div className="flex items-center gap-1.5 text-stone-200">
                    <span>به پایین اسکرول کرده و گزینه</span>
                    <PlusSquare className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">Add to Home Screen</span>
                    <span>را انتخاب کنید.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers when beforeinstallprompt has not fired yet (render discreet button)
  return null;
};
