export interface TenantProfile {
  id: '100hich' | 'modendo';
  brandNameFa: string;
  brandNameEn: string;
  palette: {
    primaryBg: string;
    surfaceBg: string;
    accentColor: string;
    accentGlow: string;
    textPrimary: string;
    textMuted: string;
    borderHairline: string;
  };
  workflow: {
    defaultOrderType: 'DINE_IN' | 'TAKEAWAY';
    requireTableNumber: boolean;
    quickTables: string[];
  };
  receipt: {
    logoPath: string;
    headerNoteFa: string;
    printKitchenTicket: boolean;
  };
}

export const TENANT_PROFILES: Record<string, TenantProfile> = {
  '100hich': {
    id: '100hich',
    brandNameFa: 'قهوه‌فروشی ۱۰۰هیچ',
    brandNameEn: '100 Hich Coffee Roasters',
    palette: {
      primaryBg: '#0A0D11',
      surfaceBg: '#0F223D',
      accentColor: '#D71921',
      accentGlow: 'rgba(215, 25, 33, 0.45)',
      textPrimary: '#FFFFFF',
      textMuted: '#9EACB8',
      borderHairline: '#293444',
    },
    workflow: {
      defaultOrderType: 'TAKEAWAY',
      requireTableNumber: false,
      quickTables: [],
    },
    receipt: {
      logoPath: '/karwand-logo.png',
      headerNoteFa: 'کیفیت و اصالت قهوه تخصصی',
      printKitchenTicket: false,
    },
  },
  'modendo': {
    id: 'modendo',
    brandNameFa: 'کافه مودندو',
    brandNameEn: 'Modendo Café',
    palette: {
      primaryBg: '#081813',
      surfaceBg: '#0F2922',
      accentColor: '#005A3E',
      accentGlow: 'rgba(0, 122, 84, 0.45)',
      textPrimary: '#F8EED9',
      textMuted: '#9BB1A8',
      borderHairline: 'rgba(248, 238, 217, 0.15)',
    },
    workflow: {
      defaultOrderType: 'DINE_IN',
      requireTableNumber: true,
      quickTables: ['M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'BAR', 'VIP'],
    },
    receipt: {
      logoPath: '/tenants/modendo/logo.png',
      headerNoteFa: 'لحظاتی خوش و ماندگار در کافه مودندو',
      printKitchenTicket: true,
    },
  },
};

// Map formal tenant-id strings to tenant profiles
TENANT_PROFILES['tenant-100hich-01'] = TENANT_PROFILES['100hich'];
TENANT_PROFILES['tenant-modendo-01'] = TENANT_PROFILES['modendo'];

export function getActiveTenant(): TenantProfile {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlTenant = params.get('tenant');
    if (urlTenant && TENANT_PROFILES[urlTenant]) {
      return TENANT_PROFILES[urlTenant];
    }
  }
  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      const stored = localStorage.getItem('cafeos_active_tenant_id');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && TENANT_PROFILES[parsed]) {
          return TENANT_PROFILES[parsed];
        }
      }
    } catch {
      // ignore
    }
  }
  const envTenant = (import.meta as any).env?.VITE_ACTIVE_TENANT;
  return TENANT_PROFILES[envTenant] || TENANT_PROFILES['100hich'];
}
