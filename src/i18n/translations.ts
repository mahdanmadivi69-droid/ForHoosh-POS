// src/i18n/translations.ts

export type SupportedLocale = 'en' | 'de' | 'fa';
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
  de: { code: 'de', label: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇦🇹' },
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
  de: {
    pos: {
      activeTable: 'Aktiver Tisch',
      scannerReady: 'BARCODE-SCANNER BEREIT',
      cartEmpty: 'Warenkorb ist leer',
      scanNotice: 'Tisch-Barcode scannt und weist den Tisch sofort zu',
      subtotal: 'Gesamtbetrag',
      dispatchOrder: 'Bestellung aufgeben für Tisch',
      tableAttached: 'Tisch {table} per Hardware-Scanner erfasst',
      invalidBarcode: 'Ungültiger Barcode oder fremder Tenant-Token: {code}',
      notes: 'Hinweise',
    },
    kds: {
      title: 'Barista KDS Station',
      liveOrders: 'Aktive Bestellungen',
      completed: 'Abgeschlossen',
      urgencyNormal: 'Normal',
      urgencyWarning: 'Warnung',
      urgencyCritical: 'SLA Überschritten',
      lanConnected: 'LOKALER SOCKET VERBUNDEN',
      lanDisconnected: 'LOKAL OFFLINE',
      markDone: 'Als Fertig Markieren',
    },
    common: {
      language: 'Sprache',
      switchTenant: 'Standort wechseln',
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
