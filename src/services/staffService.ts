/**
 * CAFE OS — Multi-Staff Role-Based Access Control (RBAC) & PIN Service
 * Modendo Dedicated Local-First Dexie Storage with Bcrypt Hashing
 */

import bcrypt from 'bcryptjs';
import { db, getCafeDatabase } from '../db/cafeDb';
import type { StaffRecord, StaffRole } from '../db/cafeDb';
import { normalizeDigits } from '../utils/digitNormalizer';

export type { StaffRecord, StaffRole };

export interface StaffRoleDefinition {
  role: StaffRole;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  color: string;
  badgeBg: string;
}

export const STAFF_ROLE_DEFINITIONS: Record<StaffRole, StaffRoleDefinition> = {
  owner: {
    role: 'owner',
    titleFa: 'مالک / ادمین سیستم',
    titleEn: 'Owner & System Administrator',
    descriptionFa: 'دسترسی کامل و نامحدود به تمامی ماژول‌ها، گزارش‌ها، تنظیمات و مدیریت پرسنل',
    color: '#10B981',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  manager: {
    role: 'manager',
    titleFa: 'مدیر داخلی / سرپرست شیفت',
    titleEn: 'Shift Manager',
    descriptionFa: 'دسترسی به تمامی ماژول‌های سالن، صندوق، سفارشات، گزارشات و تنظیمات پرسنل',
    color: '#06B6D4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  cashier: {
    role: 'cashier',
    titleFa: 'صندوق‌دار',
    titleEn: 'Cashier',
    descriptionFa: 'ثبت سفارشات، نقشه سالن، باز/بستن شیفت و تسویه فاکتورها (نقدی و کارتخوان)',
    color: '#F59E0B',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  waiter: {
    role: 'waiter',
    titleFa: 'سالن‌کار',
    titleEn: 'Waiter',
    descriptionFa: 'مشاهده نقشه سالن و ثبت اقلام روی میزها (بدون دسترسی به تسویه و گزارشات)',
    color: '#8B5CF6',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  barista: {
    role: 'barista',
    titleFa: 'باریستا',
    titleEn: 'Barista',
    descriptionFa: 'دسترسی انحصاری به نمایشگر بار و آشپزخانه (KDS)',
    color: '#EC4899',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  },
  cook: {
    role: 'cook',
    titleFa: 'آشپز / بیسترو',
    titleEn: 'Cook',
    descriptionFa: 'دسترسی انحصاری به نمایشگر بار و آشپزخانه (KDS)',
    color: '#EF4444',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};

export const DEFAULT_SEED_STAFF: Array<{
  id: string;
  name: string;
  role: StaffRole;
  pin: string;
}> = [
  { id: 'mod_staff_owner', name: 'مدیر کافه (مالک)', role: 'owner', pin: '1111' },
  { id: 'mod_staff_manager', name: 'مدیر شیفت', role: 'manager', pin: '2222' },
  { id: 'mod_staff_cashier', name: 'صندوق‌دار', role: 'cashier', pin: '3333' },
  { id: 'mod_staff_waiter1', name: 'سالن‌کار ۱', role: 'waiter', pin: '4444' },
];

const LOCKOUT_KEY = 'cafeos_staff_lockout_until';
const FAILED_ATTEMPTS_KEY = 'cafeos_staff_failed_attempts';
const CURRENT_USER_KEY = 'cafeos_current_staff_user';

export class StaffService {
  /**
   * Seeds default staff into Dexie if the staff table is empty.
   */
  public static async seedDefaultStaff(targetDb = db): Promise<void> {
    try {
      const count = await targetDb.staff.count().catch(() => 0);
      if (count === 0) {
        const now = Date.now();
        for (const s of DEFAULT_SEED_STAFF) {
          const pinHash = bcrypt.hashSync(s.pin, 10);
          await targetDb.staff.put({
            id: s.id,
            name: s.name,
            role: s.role,
            pinHash,
            isActive: true,
            createdAt: now,
          });
        }
      }
    } catch (err) {
      console.warn('[StaffService] Seed default staff bypassed or failed:', err);
    }
  }

  /**
   * Retrieves all staff members from Dexie.
   */
  public static async getAllStaff(targetDb = db): Promise<StaffRecord[]> {
    try {
      await this.seedDefaultStaff(targetDb);
      return await targetDb.staff.toArray();
    } catch {
      return [];
    }
  }

  /**
   * Adds a new staff member with a hashed 4-digit PIN.
   */
  public static async addStaff(
    name: string,
    role: StaffRole,
    pin: string,
    targetDb = db
  ): Promise<StaffRecord> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('نام پرسنل نمی‌تواند خالی باشد.');
    }
    const cleanPin = normalizeDigits(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('پین‌کد پرسنل باید دقیقاً ۴ رقم عددی باشد.');
    }

    const pinHash = bcrypt.hashSync(cleanPin, 10);
    const newRecord: StaffRecord = {
      id: `staff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      role,
      pinHash,
      isActive: true,
      createdAt: Date.now(),
    };

    await targetDb.staff.put(newRecord);
    return newRecord;
  }

  /**
   * Updates an existing staff member (change PIN, suspend/activate, role, name).
   */
  public static async updateStaff(
    id: string,
    updates: {
      name?: string;
      role?: StaffRole;
      pin?: string;
      isActive?: boolean;
    },
    targetDb = db
  ): Promise<void> {
    const payload: Partial<StaffRecord> = {};
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error('نام پرسنل نمی‌تواند خالی باشد.');
      payload.name = trimmed;
    }
    if (updates.role !== undefined) {
      payload.role = updates.role;
    }
    if (updates.isActive !== undefined) {
      payload.isActive = updates.isActive;
    }
    if (updates.pin !== undefined) {
      const cleanPin = normalizeDigits(updates.pin).trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        throw new Error('پین‌کد جدید باید دقیقاً ۴ رقم عددی باشد.');
      }
      payload.pinHash = bcrypt.hashSync(cleanPin, 10);
    }

    await targetDb.staff.update(id, payload);
  }

  /**
   * Lockout management
   */
  public static getLockoutRemainingSeconds(): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
      const untilStr = localStorage.getItem(LOCKOUT_KEY);
      if (!untilStr) return 0;
      const until = Number(untilStr);
      const diff = Math.ceil((until - Date.now()) / 1000);
      if (diff <= 0) {
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        return 0;
      }
      return diff;
    } catch {
      return 0;
    }
  }

  public static getFailedAttempts(): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
      return Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0');
    } catch {
      return 0;
    }
  }

  public static resetLockout(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    } catch {}
  }

  /**
   * Authenticates 4-digit PIN against active staff in Dexie.
   * Enforces 3-strike policy with 5-minute cooldown.
   */
  public static async authenticateWithPin(
    pin: string,
    targetDb = db
  ): Promise<{
    success: boolean;
    user?: StaffRecord;
    error?: string;
    status: number;
    errorCode?: number;
    remainingAttempts?: number;
    lockedUntil?: number;
  }> {
    const remainingCooldown = this.getLockoutRemainingSeconds();
    if (remainingCooldown > 0) {
      const mins = Math.floor(remainingCooldown / 60);
      const secs = remainingCooldown % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      return {
        success: false,
        status: 429,
        errorCode: 429,
        error: `ترمینال قفل است. لطفاً ${timeStr} دیگر تلاش کنید.`,
      };
    }

    const cleanPin = normalizeDigits(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return {
        success: false,
        status: 400,
        errorCode: 400,
        error: 'پین‌کد باید ۴ رقم عددی باشد.',
      };
    }

    // Ensure seed data exists
    await this.seedDefaultStaff(targetDb);
    const allStaff = await targetDb.staff.toArray().catch(() => []);
    const activeStaff = allStaff.filter((s) => s.isActive);

    let matchedUser: StaffRecord | undefined;
    for (const member of activeStaff) {
      if (bcrypt.compareSync(cleanPin, member.pinHash)) {
        matchedUser = member;
        break;
      }
    }

    if (matchedUser) {
      // Success: reset strike counter
      this.resetLockout();
      try {
        await targetDb.staff.update(matchedUser.id, { lastLoginAt: Date.now() });
        matchedUser.lastLoginAt = Date.now();
      } catch {}
      this.setCurrentUser(matchedUser);
      return {
        success: true,
        status: 200,
        errorCode: 200,
        user: matchedUser,
      };
    }

    // Failure: record strike
    let currentFails = this.getFailedAttempts() + 1;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(FAILED_ATTEMPTS_KEY, String(currentFails));
      } catch {}
    }

    if (currentFails >= 3) {
      const lockUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(LOCKOUT_KEY, String(lockUntil));
          localStorage.setItem(FAILED_ATTEMPTS_KEY, '3');
        } catch {}
      }
      return {
        success: false,
        status: 429,
        errorCode: 429,
        error: '۳ بار رمز اشتباه وارد شد. ترمینال به مدت ۵ دقیقه قفل گردید.',
        lockedUntil: lockUntil,
        remainingAttempts: 0,
      };
    }

    const remaining = 3 - currentFails;
    return {
      success: false,
      status: 401,
      errorCode: 401,
      error: `پین‌کد نامعتبر است. (${remaining} تلاش باقی‌مانده)`,
      remainingAttempts: remaining,
    };
  }

  /**
   * Session storage helpers
   */
  public static getCurrentUser(): StaffRecord | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static setCurrentUser(user: StaffRecord | null): void {
    if (typeof localStorage === 'undefined') return;
    try {
      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    } catch {}
  }

  public static logout(): void {
    this.setCurrentUser(null);
  }
}
