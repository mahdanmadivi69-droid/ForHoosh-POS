/**
 * src/components/SensoryLabView.tsx
 * 
 * KarWand POS — 100 HICH Sensory Lab & Espresso Calibration Deck
 * 
 * Features:
 * - Liquid Glass VisionOS styling with Obsidian / Hwei Dark Palette.
 * - Espresso Calibration Metrics:
 *    1. Dose in (وزن دان ورودی - گرم)
 *    2. Yield out (وزن عصاره خروجی - گرم)
 *    3. Extraction time (زمان عصاره‌گیری - ثانیه)
 *    4. Brew Ratio calculated automatically (۱:۲.۰۵ و...)
 *    5. Grind size setting (درجه آسیاب)
 *    6. Roast profile & origin selector (بلند ۱۰۰ هیچ، کلمبیا هویلا، اتیوپی یرگاچف و...)
 *    7. Tasting notes & balance rating (Sweetness, Acidity, Body, Finish)
 * - Saved calibrations session history with local persistence.
 * - Header with venue identity and clean back button to Launcher Hub.
 */

import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Coffee,
  Sliders,
  Clock,
  Scale,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Bookmark,
  RotateCcw,
  Flame,
  Award,
  ChevronLeft,
} from 'lucide-react';
import { playPosBeep } from '../services/soundEffects';

export interface CalibrationRecord {
  id: string;
  timestamp: number;
  origin: string;
  doseInGrams: number;
  yieldOutGrams: number;
  timeSeconds: number;
  grindSize: string;
  shotsRequired: number;
  brewRatio: string;
  roastDate?: string;
  tastingNotes: string;
  baristaName: string;
}

interface SensoryLabViewProps {
  onBackToLauncher: () => void;
  baristaName?: string;
}

const ROAST_PROFILES = [
  { id: '100hich-signature', name: 'بلند اختصاصی ۱۰۰ هیچ (۵۰/۵۰ Signature)', type: 'Blend', roastLevel: 'Medium-Dark' },
  { id: 'colombia-huila', name: 'کلمبیا اویلا (۱۰۰٪ عربیکا تخصصی)', type: 'Single Origin', roastLevel: 'Medium' },
  { id: 'ethiopia-yirgacheffe', name: 'اتیوپی یرگاچف گرید ۱ (شسته)', type: 'Single Origin', roastLevel: 'Light-Medium' },
  { id: 'brazil-cerrado', name: 'برزیل سرادو نچرال (شکلاتی / آجیلی)', type: 'Single Origin', roastLevel: 'Medium' },
  { id: 'costa-rica-tarrazu', name: 'کاستاریکا تارازو (عسلی / مرکباتی)', type: 'Single Origin', roastLevel: 'Medium' },
];

export const SensoryLabView: React.FC<SensoryLabViewProps> = ({
  onBackToLauncher,
  baristaName = 'مهدان مهدوی',
}) => {
  const [selectedRoast, setSelectedRoast] = useState<string>(ROAST_PROFILES[0].id);
  const [doseInGrams, setDoseInGrams] = useState<number>(19.5);
  const [yieldOutGrams, setYieldOutGrams] = useState<number>(40.0);
  const [timeSeconds, setTimeSeconds] = useState<number>(28);
  const [grindSize, setGrindSize] = useState<string>('3.4');
  const [shotsRequired, setShotsRequired] = useState<number>(2);
  const [tastingNotes, setTastingNotes] = useState<string>('اسیدیته شفاف سیب سرخ، بادی کرمی، شکلات تلخ و فینیش تمیز');
  const [savedRecords, setSavedRecords] = useState<CalibrationRecord[]>([]);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Load saved calibrations from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('100hich_calibration_records');
      if (stored) {
        setSavedRecords(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Compute brew ratio (e.g. 1:2.05)
  const ratio = doseInGrams > 0 ? (yieldOutGrams / doseInGrams).toFixed(2) : '0';

  const handleSaveCalibration = () => {
    playPosBeep('success');
    const selectedObj = ROAST_PROFILES.find((r) => r.id === selectedRoast);
    const newRecord: CalibrationRecord = {
      id: `calib-${Date.now()}`,
      timestamp: Date.now(),
      origin: selectedObj ? selectedObj.name : selectedRoast,
      doseInGrams,
      yieldOutGrams,
      timeSeconds,
      grindSize,
      shotsRequired,
      brewRatio: `1:${ratio}`,
      tastingNotes,
      baristaName,
    };

    const updated = [newRecord, ...savedRecords].slice(0, 20);
    setSavedRecords(updated);
    try {
      localStorage.setItem('100hich_calibration_records', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleResetDefaults = () => {
    playPosBeep('click');
    setDoseInGrams(19.5);
    setYieldOutGrams(40.0);
    setTimeSeconds(28);
    setGrindSize('3.4');
    setTastingNotes('اسیدیته شفاف، بادی کرمی، شکلات تلخ');
  };

  return (
    <div className="h-full flex flex-col bg-[#070A0F] text-white select-none overflow-y-auto no-scrollbar relative font-sans">
      {/* Apple VisionOS Ambient Luminous Mesh Underlay */}
      <div className="vision-ambient-mesh" aria-hidden="true">
        <div className="vision-ambient-orb vision-orb-gold" />
        <div className="vision-ambient-orb vision-orb-carmine" />
        <div className="vision-ambient-orb vision-orb-navy" />
      </div>

      {/* Header */}
      <header className="vision-glass-slab bg-[#0F223D]/90 border-b border-white/12 sticky top-0 z-30 px-4 md:px-6 py-3.5 flex items-center justify-between backdrop-blur-2xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              playPosBeep('click');
              onBackToLauncher();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B1524]/80 hover:bg-[#162E52] text-[#90D2ED] hover:text-white border border-white/15 text-xs font-bold transition cursor-pointer shadow-inner active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            <span>بازگشت به لانچر (Hub)</span>
          </button>

          <div className="h-5 w-[1px] bg-white/15 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9E8A5E]/50 to-[#423924] border border-[#9E8A5E]/60 flex items-center justify-center shadow-[0_0_15px_rgba(158,138,94,0.4)]">
              <FlaskConical className="w-4 h-4 text-[#F5E8D0]" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-1.5 leading-none">
                <span>سنسوری لب و کالیبراسیون عصاره‌گیری</span>
                <span className="text-[10px] bg-[#9E8A5E]/40 text-[#F5E8D0] border border-[#9E8A5E]/50 px-1.5 py-0.5 rounded-md font-mono font-bold">
                  DIAL-IN DECK
                </span>
              </h1>
              <p className="text-[10px] text-[#F5F5F7]/60 mt-1">
                ثبت دقیق متغیرهای اسپرسو، نسبت دم‌آوری (Brew Ratio) و تطبیق با پروفایل روست ۱۰۰ هیچ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#C5A880] font-bold hidden md:inline">باریستا: {baristaName}</span>
          <span className="w-2 h-2 rounded-full bg-[#005A3E] border border-emerald-400 animate-pulse"></span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6 z-10">
        {/* Top Grid: Origin Selector & Dial-In Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Column 1: Roast Profile & Origin */}
          <div className="bg-[rgba(20,25,36,0.72)] backdrop-blur-[28px] border border-white/12 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-[#90D2ED] uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#D71921]" />
                  انتخاب پروفایل روست و خاستگاه
                </span>
                <span className="text-[10px] text-[#F5F5F7]/50 font-mono">STEP 1</span>
              </div>

              <div className="space-y-2">
                {ROAST_PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      playPosBeep('click');
                      setSelectedRoast(profile.id);
                    }}
                    className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedRoast === profile.id
                        ? 'bg-[#0F223D] border-[#90D2ED] shadow-[0_0_20px_rgba(144,210,237,0.25)]'
                        : 'bg-[#0B1524]/60 border-white/8 hover:border-white/20 text-[#F5F5F7]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#F5F5F7]">{profile.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 font-bold text-[#C5A880]">
                        {profile.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#F5F5F7]/60">درجه روست: {profile.roastLevel}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-[#F5F5F7]/60 flex items-center justify-between">
              <span>سیلو دان فعال:</span>
              <span className="font-bold text-emerald-400">سیلو ۱ - کالیبره شده</span>
            </div>
          </div>

          {/* Column 2 & 3: Extraction Dial-In Numeric Controls */}
          <div className="lg:col-span-2 bg-[rgba(20,25,36,0.72)] backdrop-blur-[28px] border border-white/12 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-[#90D2ED] uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#90D2ED]" />
                  متغیرهای فیزیکی عصاره‌گیری (Extraction Metrics)
                </span>
                <span className="text-[10px] text-[#F5F5F7]/50 font-mono">STEP 2</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Metric 1: Dose In */}
                <div className="bg-[#0B1524]/80 border border-white/10 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-[#F5F5F7]/70 mb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Scale className="w-3.5 h-3.5 text-[#C5A880]" />
                      وزن دان ورودی (Dose In)
                    </span>
                    <span className="text-[10px] text-[#C5A880] font-mono">گرم</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDoseInGrams((prev) => Math.max(14, +(prev - 0.5).toFixed(1)))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setDoseInGrams((prev) => Math.min(24, +(prev + 0.5).toFixed(1)))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-2xl font-black text-[#F5F5F7] font-mono num-heavy">
                      {doseInGrams.toFixed(1)} g
                    </span>
                  </div>
                </div>

                {/* Metric 2: Yield Out */}
                <div className="bg-[#0B1524]/80 border border-white/10 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-[#F5F5F7]/70 mb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Coffee className="w-3.5 h-3.5 text-[#D71921]" />
                      وزن عصاره خروجی (Yield Out)
                    </span>
                    <span className="text-[10px] text-[#D71921] font-mono">گرم</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setYieldOutGrams((prev) => Math.max(20, +(prev - 1).toFixed(1)))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setYieldOutGrams((prev) => Math.min(60, +(prev + 1).toFixed(1)))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-2xl font-black text-[#C5A880] font-mono num-heavy">
                      {yieldOutGrams.toFixed(1)} g
                    </span>
                  </div>
                </div>

                {/* Metric 3: Extraction Time */}
                <div className="bg-[#0B1524]/80 border border-white/10 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-[#F5F5F7]/70 mb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Clock className="w-3.5 h-3.5 text-[#90D2ED]" />
                      زمان عصاره‌گیری (Time)
                    </span>
                    <span className="text-[10px] text-[#90D2ED] font-mono">ثانیه</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTimeSeconds((prev) => Math.max(18, prev - 1))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeSeconds((prev) => Math.min(45, prev + 1))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-2xl font-black text-[#90D2ED] font-mono num-heavy">
                      {timeSeconds}s
                    </span>
                  </div>
                </div>

                {/* Metric 4: Universal Grind Size Setting */}
                <div className="bg-[#0B1524]/80 border border-white/10 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-[#F5F5F7]/70 mb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      درجه آسیاب (Grind Size Step)
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">Step</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const curr = parseFloat(grindSize) || 3.0;
                          setGrindSize(Math.max(1.0, +(curr - 0.1).toFixed(1)).toString());
                        }}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = parseFloat(grindSize) || 3.0;
                          setGrindSize(Math.min(12.0, +(curr + 0.1).toFixed(1)).toString());
                        }}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-2xl font-black text-amber-300 font-mono num-heavy">
                      {grindSize}
                    </span>
                  </div>
                </div>

                {/* Metric 5: Calibration Attempts Required */}
                <div className="bg-[#0B1524]/80 border border-white/10 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-[#F5F5F7]/70 mb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      تعداد تست تا کالیبره شدن (Dial-In Shots)
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono">تعداد شات</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShotsRequired((prev) => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setShotsRequired((prev) => Math.min(10, prev + 1))}
                        className="w-8 h-8 rounded-lg bg-[#0F223D] hover:bg-[#D71921] text-white font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-2xl font-black text-rose-300 font-mono num-heavy">
                      {shotsRequired}
                    </span>
                  </div>
                </div>
              </div>

              {/* Calculated Ratio Pill Banner */}
              <div className="mt-4 p-3 rounded-2xl bg-[#0F223D]/90 border border-white/15 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#C5A880]" />
                  <div>
                    <span className="text-xs font-bold text-[#F5F5F7]">نسبت محاسبه‌شده دم‌آوری (Brew Ratio):</span>
                    <span className="text-[10px] text-[#F5F5F7]/60 block">استاندارد اسپرسو دبل شات مدرن (۱:۲.۰۰ تا ۱:۲.۲)</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#C5A880] font-mono tracking-tight">1:{ratio}</span>
                </div>
              </div>

              {/* Tasting Notes Input */}
              <div className="mt-4">
                <label className="text-xs font-bold text-[#F5F5F7]/80 block mb-1">
                  توصیف طعمی و یادداشت ارزیابی حسی (Sensory Notes):
                </label>
                <input
                  type="text"
                  value={tastingNotes}
                  onChange={(e) => setTastingNotes(e.target.value)}
                  placeholder="مثال: اسیدیته شفاف، بادی کرمی، شکلات تلخ و فینیش تمیز..."
                  className="w-full bg-[#0B1524]/90 border border-white/12 text-[#F5F5F7] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#90D2ED] transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[#F5F5F7] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی پیش‌فرض</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCalibration}
                className="px-6 py-2.5 rounded-xl bg-[#D71921] hover:bg-[#B8141B] active:scale-95 text-white text-xs font-black flex items-center gap-2 shadow-[0_0_20px_rgba(215,25,33,0.6)] transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{savedSuccess ? 'کالیبراسیون ثبت شد!' : 'ثبت و ذخیره کالیبراسیون'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section: Calibration History Log */}
        <div className="bg-[rgba(20,25,36,0.72)] backdrop-blur-[28px] border border-white/12 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-[#90D2ED] uppercase tracking-wider flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-[#C5A880]" />
              تاریخچه کالیبراسیون‌های اخیر باریستا (Dial-In History)
            </span>
            <span className="text-[10px] text-[#F5F5F7]/50 font-mono">
              {savedRecords.length} کالیبراسیون ثبت‌شده
            </span>
          </div>

          {savedRecords.length === 0 ? (
            <div className="py-8 text-center text-[#F5F5F7]/40 text-xs">
              هنوز کالیبراسیونی برای شیفت جاری ثبت نشده است. پس از تست شات، دکمه «ثبت و ذخیره کالیبراسیون» را لمس کنید.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[#F5F5F7]/60 text-[11px]">
                    <th className="py-2 px-3">زمان ثبت</th>
                    <th className="py-2 px-3">خاستگاه قهوه</th>
                    <th className="py-2 px-3">ورودی (Dose)</th>
                    <th className="py-2 px-3">خروجی (Yield)</th>
                    <th className="py-2 px-3">نسبت (Ratio)</th>
                    <th className="py-2 px-3">زمان</th>
                    <th className="py-2 px-3">درجه آسیاب</th>
                    <th className="py-2 px-3">تعداد تست</th>
                    <th className="py-2 px-3">یادداشت طعمی</th>
                    <th className="py-2 px-3">باریستا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {savedRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#90D2ED]">
                        {new Date(rec.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#F5F5F7]">{rec.origin}</td>
                      <td className="py-2.5 px-3 font-mono text-[#F5F5F7]">{rec.doseInGrams}g</td>
                      <td className="py-2.5 px-3 font-mono text-[#C5A880] font-bold">{rec.yieldOutGrams}g</td>
                      <td className="py-2.5 px-3 font-mono text-[#C5A880] font-bold">{rec.brewRatio}</td>
                      <td className="py-2.5 px-3 font-mono text-[#90D2ED]">{rec.timeSeconds}s</td>
                      <td className="py-2.5 px-3 font-mono text-amber-300 font-bold">{rec.grindSize}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-300 font-bold">{rec.shotsRequired || 1} شات</td>
                      <td className="py-2.5 px-3 text-[#F5F5F7]/70 max-w-xs truncate">{rec.tastingNotes}</td>
                      <td className="py-2.5 px-3 text-[#F5F5F7]/60">{rec.baristaName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SensoryLabView;
