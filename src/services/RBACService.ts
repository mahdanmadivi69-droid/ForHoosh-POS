/**
 * CAFE OS — Role-Based Access Control (RBAC) & PIN Elevation Engine (v2.4.0)
 * Local-First IndexedDB Persistence & SHA-256 Hashing
 */

import { db } from '../db/cafeDb';
import {
  AppUserRole,
  Permission,
  ElevationAction,
  RoleDefinition,
  AuthUserRecord,
  ElevationAuditLog,
} from '../types/rbac-settings';
import { CryptoSecurity } from './cryptoSecurity';

export const ROLE_DEFINITIONS: Record<AppUserRole, RoleDefinition> = {
  OWNER: {
    level: 4,
    titleFa: 'مالک / ادمین سیستم',
    titleEn: 'Owner & System Administrator',
    descriptionFa: 'دسترسی کامل و نامحدود به تمامی بخش‌های مالی، فنی، انبارداری و تغییر پین‌کدها',
    permissions: ['ALL'],
    color: '#D71921',
    badgeBg: 'bg-[#D71921]/15 text-[#D71921] border-[#D71921]/30',
  },
  ACCOUNTANT: {
    level: 3,
    titleFa: 'حسابدار ارشد',
    titleEn: 'Senior Accountant',
    descriptionFa: 'دسترسی به دفاتر مالی، گزارش‌های سود و زیان Z-Report، مالیات بر ارزش افزوده و بهای تمام‌شده',
    permissions: [
      'VIEW_FINANCIALS',
      'EXPORT_TAX_LEDGER',
      'VIEW_INVENTORY',
      'EDIT_BOM_COSTS',
      'VIEW_Z_REPORT',
    ],
    color: '#3B82F6',
    badgeBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  MANAGER: {
    level: 2,
    titleFa: 'سرپرست شیفت / مدیر داخلی',
    titleEn: 'Shift Manager',
    descriptionFa: 'مدیریت و تایید سفارشات، اعمال تخفیف‌های ویژه، ابطال آیتم، عیب‌یابی چاپگرها و موجودی انبار',
    permissions: [
      'ORDER_DISPATCH',
      'ORDER_SETTLE',
      'OVERRIDE_DISCOUNT_20',
      'VOID_DISPATCHED_ITEM',
      'EDIT_INVENTORY_STOCK',
      'PRINTER_DIAGNOSTICS',
    ],
    color: '#F59E0B',
    badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  CASHIER: {
    level: 1,
    titleFa: 'صندوق‌دار شیفت',
    titleEn: 'Shift Cashier',
    descriptionFa: 'ثبت سفارشات، دریافت وجه نقد و کارتخوان، صدور فاکتور و مشاهده موجودی منو',
    permissions: [
      'ORDER_DISPATCH',
      'ORDER_SETTLE',
      'VIEW_STOCK_LEVELS',
      'REPRINT_LAST_TICKET',
    ],
    color: '#06B6D4',
    badgeBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  },
  BARISTA: {
    level: 1,
    titleFa: 'باریستا / متصدی بار',
    titleEn: 'Barista & Bartender',
    descriptionFa: 'ثبت و ارسال سفارشات نوشیدنی، تسویه فاکتور مشتریان و مشاهده موجودی دان‌ها و سیروپ‌ها',
    permissions: [
      'ORDER_DISPATCH',
      'ORDER_SETTLE',
      'VIEW_STOCK_LEVELS',
      'REPRINT_LAST_TICKET',
    ],
    color: '#10B981',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
};

export const ELEVATION_POLICY = {
  require_pin_for: [
    'VOID_DISPATCHED_ORDER',
    'CUSTOM_DISCOUNT_ABOVE_ZERO',
    'OPEN_CASH_DRAWER_MANUAL',
    'ACCESS_SETTINGS_PANEL',
    'EDIT_RECIPE_BOM',
  ] as ElevationAction[],
  audit_log_fields: [
    'action_type',
    'requested_by_user',
    'authorized_by_manager',
    'timestamp',
    'metadata',
  ],
};

export const ELEVATION_ACTION_LABELS: Record<ElevationAction, { fa: string; requiredRole: string }> = {
  ACCESS_SETTINGS_PANEL: {
    fa: 'دسترسی به بخش تنظیمات و پیکربندی سخت‌افزار',
    requiredRole: 'مدیر یا مالک سیستم',
  },
  VOID_DISPATCHED_ORDER: {
    fa: 'ابطال سفارش ارسال‌شده به بارتندر یا آشپزخانه',
    requiredRole: 'مدیر شیفت یا مالک',
  },
  CUSTOM_DISCOUNT_ABOVE_ZERO: {
    fa: 'اعمال تخفیف دستی بالاتر از سقف مجاز',
    requiredRole: 'مدیر شیفت یا مالک',
  },
  OPEN_CASH_DRAWER_MANUAL: {
    fa: 'باز کردن دستی کشوی پول نقد (پالس الکترونیکی)',
    requiredRole: 'مدیر شیفت یا حسابدار',
  },
  EDIT_RECIPE_BOM: {
    fa: 'ویرایش فرمولاسیون رسپی و بهای تمام‌شده انبارداری (BOM)',
    requiredRole: 'حسابدار یا مالک سیستم',
  },
  DELETE_PRINTER_PROFILE: {
    fa: 'حذف پروفایل سخت‌افزاری چاپگر',
    requiredRole: 'مدیر یا مالک سیستم',
  },
  RESET_STORE_CONFIG: {
    fa: 'بازنشانی تنظیمات عمومی کافه به پیش‌فرض کارخانه',
    requiredRole: 'مالک سیستم (ادمین)',
  },
};

export class RBACService {
  private static isInitialized = false;

  /**
   * Initializes default local-first auth users in IndexedDB with SHA-256 PBKDF2 hashed PINs
   */
  public static async initDefaultUsers(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const existingCount = await db.authUsers.count();
      if (existingCount === 0) {
        console.log('[RBACService] Seeding default RBAC auth users into IndexedDB...');

        const seedUsers: Array<{
          id: string;
          username: string;
          fullName: string;
          role: AppUserRole;
          pin: string;
        }> = [
          {
            id: 'auth-user-owner',
            username: 'admin',
            fullName: 'مهدان مهدوی',
            role: 'OWNER',
            pin: '1234',
          },
          {
            id: 'auth-user-cashier',
            username: 'cashier',
            fullName: 'صندوقدار شیفت',
            role: 'CASHIER',
            pin: '2222',
          },
          {
            id: 'auth-user-accountant',
            username: 'accountant',
            fullName: 'حسابدار ارشد (دفتر مالی و انبار)',
            role: 'ACCOUNTANT',
            pin: '5678',
          },
          {
            id: 'auth-user-manager',
            username: 'manager',
            fullName: 'سارا رضایی (سرپرست شیفت و مدیر)',
            role: 'MANAGER',
            pin: '1111',
          },
          {
            id: 'auth-user-barista',
            username: 'barista',
            fullName: 'نیما کمالی (باریستا ارشد)',
            role: 'BARISTA',
            pin: '0000',
          },
        ];

        for (const user of seedUsers) {
          const { hash, salt } = await CryptoSecurity.hashPin(user.pin);
          const record: AuthUserRecord = {
            id: user.id,
            tenantId: 'tenant-100hich-01',
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            pinHash: hash,
            salt: salt,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await db.authUsers.put(record);
        }

        console.log('[RBACService] Successfully seeded 4-level RBAC auth users.');
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[RBACService] Error initializing auth users in IndexedDB:', err);
    }
  }

  /**
   * Checks if a given role has a specific permission
   */
  public static hasPermission(role: AppUserRole, permission: Permission): boolean {
    const roleDef = ROLE_DEFINITIONS[role];
    if (!roleDef) return false;
    if (roleDef.permissions.includes('ALL')) return true;
    return roleDef.permissions.includes(permission);
  }

  /**
   * Evaluates if an action requires PIN elevation for a given user role
   */
  public static requiresElevation(action: ElevationAction, role: AppUserRole): boolean {
    // If the action is in the elevation policy:
    if (ELEVATION_POLICY.require_pin_for.includes(action)) {
      // Barista always requires elevation for protected actions
      if (role === 'BARISTA') return true;

      // Settings panel requires MANAGER or OWNER; Accountant requires elevation for Settings
      if (action === 'ACCESS_SETTINGS_PANEL') {
        return role !== 'OWNER' && role !== 'MANAGER';
      }

      // Voiding dispatched items requires Manager or Owner
      if (action === 'VOID_DISPATCHED_ORDER') {
        return role !== 'OWNER' && role !== 'MANAGER';
      }

      // Editing recipe BOM requires Accountant or Owner
      if (action === 'EDIT_RECIPE_BOM') {
        return role !== 'OWNER' && role !== 'ACCOUNTANT';
      }

      // Default: require elevation if not OWNER
      return role !== 'OWNER';
    }
    return false;
  }

  /**
   * Verifies PIN against stored IndexedDB users for elevation.
   * Can accept any active MANAGER or OWNER PIN (or matching user).
   */
  public static async verifyElevationPin(
    enteredPin: string,
    action: ElevationAction,
    requestedByUser: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    authorizedUser?: AuthUserRecord;
    error?: string;
  }> {
    await this.initDefaultUsers();

    if (!enteredPin || enteredPin.trim().length < 4) {
      return { success: false, error: 'پین‌کد باید حداقل ۴ رقم باشد.' };
    }

    try {
      const activeUsers = await db.authUsers.filter((u) => u.isActive).toArray();

      // Find if entered PIN matches any eligible authorizing manager or owner
      for (const user of activeUsers) {
        // Only OWNER, MANAGER (and ACCOUNTANT for BOM edits) can authorize elevations
        const isEligible =
          user.role === 'OWNER' ||
          user.role === 'MANAGER' ||
          (action === 'EDIT_RECIPE_BOM' && user.role === 'ACCOUNTANT');

        if (!isEligible) continue;

        const isMatch = await CryptoSecurity.verifyPin(enteredPin, user.pinHash, user.salt);
        if (isMatch) {
          // Log elevation success in IndexedDB
          const logEntry: ElevationAuditLog = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            action_type: action,
            requested_by_user: requestedByUser,
            authorized_by_manager: `${user.fullName} (${user.role})`,
            timestamp: new Date().toISOString(),
            status: 'GRANTED',
            metadata: {
              ...metadata,
              authorizedRole: user.role,
              authorizedUserId: user.id,
            },
          };
          await db.elevationAuditLogs.put(logEntry);

          return { success: true, authorizedUser: user };
        }
      }

      // If no match found, log DENIED audit attempt
      const failLog: ElevationAuditLog = {
        id: `audit-fail-${Date.now()}`,
        action_type: action,
        requested_by_user: requestedByUser,
        authorized_by_manager: 'نامعتبر (عدم تطابق پین)',
        timestamp: new Date().toISOString(),
        status: 'DENIED',
        metadata: {
          ...metadata,
          reason: 'INVALID_PIN_ATTEMPT',
        },
      };
      await db.elevationAuditLogs.put(failLog);

      return { success: false, error: 'پین‌کد وارد شده نامعتبر است یا سطح دسترسی کافی ندارد.' };
    } catch (err: any) {
      console.error('[RBACService] verifyElevationPin error:', err);
      return { success: false, error: err.message || 'خطای سیستمی در اعتبارسنجی پین‌کد' };
    }
  }

  /**
   * Update an existing user's PIN in IndexedDB
   */
  public static async updateUserPin(userId: string, newPin: string): Promise<boolean> {
    if (!newPin || newPin.length < 4) {
      throw new Error('پین‌کد جدید باید حداقل ۴ رقم باشد.');
    }
    const user = await db.authUsers.get(userId);
    if (!user) throw new Error('کاربر یافت نشد.');

    const { hash, salt } = await CryptoSecurity.hashPin(newPin);
    await db.authUsers.update(userId, {
      pinHash: hash,
      salt: salt,
      updatedAt: Date.now(),
    });
    return true;
  }

  /**
   * Retrieves all users from IndexedDB
   */
  public static async getAllUsers(): Promise<AuthUserRecord[]> {
    await this.initDefaultUsers();
    return db.authUsers.toArray();
  }

  /**
   * Retrieves elevation audit logs from IndexedDB
   */
  public static async getElevationLogs(limit = 100): Promise<ElevationAuditLog[]> {
    try {
      return await db.elevationAuditLogs
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
    } catch {
      return db.elevationAuditLogs.toArray();
    }
  }
  /**
   * Verifies an entered PIN for initial terminal unlock / login.
   * Can check against a specific userId or iterate across all active users.
   */
  public static async verifyLoginPin(
    enteredPin: string,
    selectedUserId?: string
  ): Promise<{
    success: boolean;
    user?: AuthUserRecord;
    error?: string;
  }> {
    await this.initDefaultUsers();

    if (!enteredPin || enteredPin.trim().length < 4) {
      return { success: false, error: 'پین‌کد باید حداقل ۴ رقم باشد.' };
    }

    try {
      const activeUsers = await db.authUsers.filter((u) => u.isActive).toArray();

      if (selectedUserId) {
        const targetUser = activeUsers.find((u) => u.id === selectedUserId);
        if (!targetUser) {
          return { success: false, error: 'کاربر مورد نظر یافت نشد.' };
        }
        const isMatch = await CryptoSecurity.verifyPin(enteredPin, targetUser.pinHash, targetUser.salt);
        if (isMatch) {
          return { success: true, user: targetUser };
        }
        return { success: false, error: 'پین‌کد وارد شده صحیح نمی‌باشد.' };
      }

      // Check all active users
      for (const user of activeUsers) {
        const isMatch = await CryptoSecurity.verifyPin(enteredPin, user.pinHash, user.salt);
        if (isMatch) {
          return { success: true, user };
        }
      }

      return { success: false, error: 'پین‌کد نامعتبر است.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در اعتبارسنجی پین‌کد' };
    }
  }

  /**
   * Adds a new staff user with custom PIN and hashed salt
   */
  public static async addStaffUser(params: {
    fullName: string;
    username: string;
    role: AppUserRole;
    pin: string;
    phoneNumber?: string;
  }): Promise<AuthUserRecord> {
    await this.initDefaultUsers();

    if (!params.pin || params.pin.length < 4) {
      throw new Error('پین‌کد باید حداقل ۴ رقم باشد.');
    }

    const { hash, salt } = await CryptoSecurity.hashPin(params.pin);
    const newRecord: AuthUserRecord = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: 'tenant-100hich-01',
      username: params.username.trim().toLowerCase(),
      fullName: params.fullName.trim(),
      role: params.role,
      phoneNumber: params.phoneNumber?.trim(),
      pinHash: hash,
      salt,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.authUsers.put(newRecord);
    return newRecord;
  }

  /**
   * Toggles active state of a staff user
   */
  public static async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    await db.authUsers.update(userId, {
      isActive,
      updatedAt: Date.now(),
    });
  }
}
