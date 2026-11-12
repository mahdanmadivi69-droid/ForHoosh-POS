/**
 * CAFE OS — SettingsGeneral View (v2.4.0)
 * Manages Store Profile, Fiscal/VAT Rules, Receipt Header/Footer & System Preferences
 * Persists Local-First in IndexedDB (app_settings)
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Store,
  Receipt,
  Percent,
  Sliders,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  QrCode,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  StoreProfileConfig,
  FiscalRulesConfig,
  ReceiptTemplateConfig,
  SystemPreferencesConfig,
  AppSettingsPayload,
} from '../../types/rbac-settings';
import {
  SettingsService,
  DEFAULT_STORE_PROFILE,
  DEFAULT_FISCAL_RULES,
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_SYSTEM_PREFERENCES,
} from '../../services/settingsService';
import { audioFeedback } from '../../services/audioFeedback';

interface SettingsGeneralProps {
  onSaved?: (settings: AppSettingsPayload) => void;
}

export const SettingsGeneral: React.FC<SettingsGeneralProps> = ({ onSaved }) => {
  const [storeProfile, setStoreProfile] = useState<StoreProfileConfig>(DEFAULT_STORE_PROFILE);
  const [fiscalRules, setFiscalRules] = useState<FiscalRulesConfig>(DEFAULT_FISCAL_RULES);
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateConfig>(DEFAULT_RECEIPT_TEMPLATE);
  const [systemPrefs, setSystemPrefs] = useState<SystemPreferencesConfig>(DEFAULT_SYSTEM_PREFERENCES);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    setIsLoading(true);
    try {
      const data = await SettingsService.loadSettings();
      setStoreProfile(data.store_profile);
      setFiscalRules(data.fiscal_rules);
      setReceiptTemplate(data.receipt_template);
      setSystemPrefs(data.system_preferences);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Partial<AppSettingsPayload> = {
        store_profile: storeProfile,
        fiscal_rules: fiscalRules,
        receipt_template: receiptTemplate,
        system_preferences: systemPrefs,
      };

      await SettingsService.saveSettings(payload);
      audioFeedback.playSuccess();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onSaved) {
        onSaved({
          store_profile: storeProfile,
          fiscal_rules: fiscalRules,
          receipt_template: receiptTemplate,
          system_preferences: systemPrefs,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      audioFeedback.playError();
      alert('خطا در ذخیره‌سازی تنظیمات در IndexedDB');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('آیا مطمئن هستید که می‌خواهید تمامی تنظیمات عمومی را به مقادیر پیش‌فرض بازگردانید؟')) {
      setStoreProfile(DEFAULT_STORE_PROFILE);
      setFiscalRules(DEFAULT_FISCAL_RULES);
      setReceiptTemplate(DEFAULT_RECEIPT_TEMPLATE);
      setSystemPrefs(DEFAULT_SYSTEM_PREFERENCES);
      audioFeedback.playTap();
    }
  };

  // Receipt Template Lines Management
  const addHeaderLine = () => {
    setReceiptTemplate({
      ...receiptTemplate,
      header_lines: [...receiptTemplate.header_lines, 'سطر جدید سربرگ'],
    });
    audioFeedback.playTap();
  };

  const updateHeaderLine = (index: number, val: string) => {
    const lines = [...receiptTemplate.header_lines];
    lines[index] = val;
    setReceiptTemplate({ ...receiptTemplate, header_lines: lines });
  };

  const removeHeaderLine = (index: number) => {
    const lines = receiptTemplate.header_lines.filter((_, i) => i !== index);
    setReceiptTemplate({ ...receiptTemplate, header_lines: lines });
    audioFeedback.playTap();
  };

  const addFooterLine = () => {
    setReceiptTemplate({
      ...receiptTemplate,
      footer_lines: [...receiptTemplate.footer_lines, 'سطر جدید پاورقی'],
    });
    audioFeedback.playTap();
  };

  const updateFooterLine = (index: number, val: string) => {
    const lines = [...receiptTemplate.footer_lines];
    lines[index] = val;
    setReceiptTemplate({ ...receiptTemplate, footer_lines: lines });
  };

  const removeFooterLine = (index: number) => {
    const lines = receiptTemplate.footer_lines.filter((_, i) => i !== index);
    setReceiptTemplate({ ...receiptTemplate, footer_lines: lines });
    audioFeedback.playTap();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#9EACB8] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#D71921] border-t-transparent rounded-full animate-spin"></div>
        <span>در حال بارگذاری تنظیمات از IndexedDB...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161A1F] p-4 rounded-xl border border-white/5">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#D71921]" />
            <span>تنظیمات پایه و پیکربندی فیسکال (General Settings)</span>
          </h2>
          <p className="text-xs text-[#9EACB8] mt-0.5">
            پروفایل رسمی کافه، قوانین مالیاتی بر ارزش افزوده و شخصی‌سازی فیش‌های کاغذی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleResetToDefaults}
            className="px-3 py-2 rounded-lg bg-[#1F242C] hover:bg-[#2A313C] text-xs font-bold text-[#9EACB8] hover:text-white border border-white/5 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>پیش‌فرض‌ها</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-[#D71921] hover:bg-[#B3141B] text-xs font-black text-white flex items-center gap-1.5 shadow-[0_0_15px_-2px_rgba(215,25,33,0.5)] transition-all cursor-pointer disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>ذخیره شد!</span>
              </>
            ) : isSaving ? (
              <span>در حال ذخیره...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>ذخیره کلیه تنظیمات</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Store Profile */}
        <div className="bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Store className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">پروفایل و اطلاعات هویتی کافه</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                نام فارسی مجموعه (جهت فیش و نمایش عمومی):
              </label>
              <input
                type="text"
                value={storeProfile.name_fa}
                onChange={(e) => setStoreProfile({ ...storeProfile, name_fa: e.target.value })}
                className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                نام انگلیسی / برند تجاری (Brand Name):
              </label>
              <input
                type="text"
                value={storeProfile.name_en}
                onChange={(e) => setStoreProfile({ ...storeProfile, name_en: e.target.value })}
                className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9EACB8] mb-1">نشانی دقیق فیزیکی شعبه:</label>
              <input
                type="text"
                value={storeProfile.address}
                onChange={(e) => setStoreProfile({ ...storeProfile, address: e.target.value })}
                className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9EACB8] mb-1">تلفن تماس:</label>
                <input
                  type="text"
                  value={storeProfile.phone}
                  onChange={(e) => setStoreProfile({ ...storeProfile, phone: e.target.value })}
                  className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9EACB8] mb-1">کد اقتصادی / شماره ثبت مالیاتی:</label>
                <input
                  type="text"
                  value={storeProfile.tax_registration_no}
                  onChange={(e) => setStoreProfile({ ...storeProfile, tax_registration_no: e.target.value })}
                  className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Fiscal & Tax Rules */}
        <div className="bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Percent className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">قوانین مالیاتی و محاسبات مالی (Fiscal Rules)</h3>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                  درصد مالیات بر ارزش افزوده (VAT):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={fiscalRules.vat_tax_percentage}
                    onChange={(e) =>
                      setFiscalRules({
                        ...fiscalRules,
                        vat_tax_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none pl-8"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                  حق سرویس سالن (Dine-in Service):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={fiscalRules.dine_in_service_charge_percentage}
                    onChange={(e) =>
                      setFiscalRules({
                        ...fiscalRules,
                        dine_in_service_charge_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none pl-8"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                  هزینه بسته‌بندی بیرون‌بر (تومان):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={fiscalRules.takeaway_pack_fee_fixed}
                  onChange={(e) =>
                    setFiscalRules({
                      ...fiscalRules,
                      takeaway_pack_fee_fixed: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9EACB8] mb-1">واحد پولی اصلی سامانه:</label>
                <select
                  value={fiscalRules.currency_display}
                  onChange={(e) =>
                    setFiscalRules({
                      ...fiscalRules,
                      currency_display: e.target.value as any,
                    })
                  }
                  className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#D71921] focus:outline-none"
                >
                  <option value="TOMAN">تومان (Toman - پیشنهادی)</option>
                  <option value="IRR">ریال (IRR)</option>
                  <option value="USD">دلار آمریکا (USD)</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 bg-[#1F242C] rounded-lg border border-white/5 text-[11px] text-[#9EACB8] flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                طبق قانون مالیاتی جدید، نرخ استاندارد ارزش افزوده ۹٪ یا ۱۰٪ می‌باشد و در تمامی محاسبات مالیات به صورت شفاف بر روی ناخالص سفارش لحاظ می‌شود.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Receipt Template Lines */}
        <div className="bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">متن سربرگ و پاورقی فیش چاپی</h3>
            </div>
          </div>

          {/* Header Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300">خطوط سربرگ فیش (Header Lines):</span>
              <button
                type="button"
                onClick={addHeaderLine}
                className="text-[11px] text-[#D71921] hover:text-red-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>افزودن خط سربرگ</span>
              </button>
            </div>
            {receiptTemplate.header_lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => updateHeaderLine(idx, e.target.value)}
                  className="flex-1 bg-[#1F242C] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#D71921] focus:outline-none text-center"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeHeaderLine(idx);
                  }}
                  className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Footer Lines */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300">خطوط پاورقی فیش (Footer Lines):</span>
              <button
                type="button"
                onClick={addFooterLine}
                className="text-[11px] text-[#D71921] hover:text-red-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>افزودن خط پاورقی</span>
              </button>
            </div>
            {receiptTemplate.footer_lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => updateFooterLine(idx, e.target.value)}
                  className="flex-1 bg-[#1F242C] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#D71921] focus:outline-none text-center"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFooterLine(idx);
                  }}
                  className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={receiptTemplate.print_qr_invoice_link}
                onChange={(e) =>
                  setReceiptTemplate({
                    ...receiptTemplate,
                    print_qr_invoice_link: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-[#D71921] bg-[#1F242C] border-white/20 focus:ring-0"
              />
              <span className="text-xs text-gray-300 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-blue-400" />
                <span>چاپ بارکد دو بعدی (QR-Code) لینک فاکتور الکترونیکی مشتری</span>
              </span>
            </label>
          </div>
        </div>

        {/* Section 4: System Preferences & Audio Engine */}
        <div className="bg-[#161A1F] rounded-xl border border-white/5 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Sliders className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">ترجیحات سیستمی و بازخورد صوتی</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#1F242C] rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                {systemPrefs.audio_feedback_enabled ? (
                  <Volume2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">بازخورد صوتی تعاملی (Acoustic Feedback)</div>
                  <div className="text-[11px] text-[#9EACB8]">
                    پخش صدای کلیک عددی (750Hz)، خطا (220Hz) و تایید موفقیت (880Hz)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => audioFeedback.playTap()}
                  className="px-2 py-1 text-[10px] bg-[#161A1F] hover:bg-[#252B34] text-gray-300 rounded border border-white/10"
                >
                  تست صدا
                </button>
                <input
                  type="checkbox"
                  checked={systemPrefs.audio_feedback_enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSystemPrefs({
                      ...systemPrefs,
                      audio_feedback_enabled: enabled,
                    });
                    audioFeedback.setEnabled(enabled);
                    if (enabled) audioFeedback.playSuccess();
                  }}
                  className="w-4 h-4 rounded text-[#D71921] bg-[#1F242C] border-white/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#1F242C] rounded-xl border border-white/5">
              <div>
                <div className="text-xs font-bold text-white">باز شدن خودکار پنجره انتخاب میز پس از تسویه</div>
                <div className="text-[11px] text-[#9EACB8]">سرعت بخشیدن به چرخه سفارش‌گیری میز بعدی</div>
              </div>
              <input
                type="checkbox"
                checked={systemPrefs.auto_open_table_selector_after_settle}
                onChange={(e) =>
                  setSystemPrefs({
                    ...systemPrefs,
                    auto_open_table_selector_after_settle: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-[#D71921] bg-[#1F242C] border-white/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9EACB8] mb-1">
                فاصله آلارم صوتی سفارشات معلق بارتندر/KDS (ثانیه):
              </label>
              <input
                type="number"
                min="10"
                max="180"
                step="5"
                value={systemPrefs.kds_sound_alert_interval_sec}
                onChange={(e) =>
                  setSystemPrefs({
                    ...systemPrefs,
                    kds_sound_alert_interval_sec: parseInt(e.target.value, 10) || 30,
                  })
                }
                className="w-full bg-[#1F242C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-[#D71921] focus:outline-none"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
