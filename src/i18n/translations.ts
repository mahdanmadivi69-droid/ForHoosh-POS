// src/i18n/translations.ts

export type SupportedLocale = 'en' | 'fa';
export type TextDirection = 'ltr' | 'rtl';

export interface LocaleMetadata {
  code: SupportedLocale;
  label: string;
  nativeName: string;
  dir: TextDirection;
  flag: string;
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleMetadata> = {
  en: { code: 'en', label: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧' },
  fa: { code: 'fa', label: 'Persian', nativeName: 'فارسی', dir: 'rtl', flag: '🇮🇷' },
};

export const dictionary = {
  en: {
    pos: {
      activeTable: 'Active Table',
      scannerReady: 'HID SCANNER READY',
      cartEmpty: 'Cart is empty',
      scanNotice: 'Scanning a table barcode assigns it instantly',
      subtotal: 'Total Amount',
      dispatchOrder: 'Dispatch Order for Table',
      tableAttached: 'Table {table} attached via hardware scanner',
      invalidBarcode: 'Invalid barcode or alien tenant token: {code}',
      notes: 'Notes',
    },
    kds: {
      title: 'Barista KDS Station',
      liveOrders: 'Live Orders',
      completed: 'Completed',
      urgencyNormal: 'Normal',
      urgencyWarning: 'Warning',
      urgencyCritical: 'SLA Breach',
      lanConnected: 'LAN SOCKET LIVE',
      lanDisconnected: 'LAN OFFLINE',
      markDone: 'Mark Complete',
    },
    common: {
      language: 'Language',
      switchTenant: 'Switch Venue',
    },
  },
  fa: {
    pos: {
      activeTable: 'میز فعال',
      scannerReady: 'اسکنر بارکد آماده',
      cartEmpty: 'سبد سفارش خالی است',
      scanNotice: 'اسکن بارکد میز در هر لحظه میز را تغییر میدهد',
      subtotal: 'جمع کل سفارش',
      dispatchOrder: 'ثبت و ارسال سفارش میز',
      tableAttached: 'میز {table} با اسکنر سختافزاری انتخاب شد',
      invalidBarcode: 'بارکد نامعتبر یا متعلق به این کافه نیست: {code}',
      notes: 'یادداشت',
    },
    kds: {
      title: 'سامانه مانیتور بار (KDS)',
      liveOrders: 'سفارشهای جاری',
      completed: 'تکمیلشده',
      urgencyNormal: 'عادی',
      urgencyWarning: 'هشدار زمان',
      urgencyCritical: 'نقض SLA',
      lanConnected: 'سوکت محلی متصل',
      lanDisconnected: 'آفلاین محلی',
      markDone: 'تکمیل سفارش',
    },
    common: {
      language: 'زبان',
      switchTenant: 'تغییر شعبه',
    },
  },
} as const;

export type TranslationSchema = typeof dictionary['en'];
