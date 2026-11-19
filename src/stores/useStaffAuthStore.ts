/**
 * src/stores/useStaffAuthStore.ts
 * 
 * Zustand State Store for Modendo Multi-Staff Authentication & RBAC Visibility.
 * Synchronizes with localStorage and Dexie for session persistence and fast reactive checks.
 */

import { create } from 'zustand';
import { StaffRecord, StaffRole, StaffService } from '../services/staffService';

export type AccessibleFeature =
  | 'pos'
  | 'floor-plan'
  | 'reports'
  | 'settings'
  | 'staff'
  | 'kds'
  | 'settle'
  | 'shift';

export interface StaffAuthStoreState {
  currentUser: StaffRecord | null;
  isAuthenticated: boolean;
  lockoutSeconds: number;
  
  // Actions
  initialize: () => void;
  setCurrentUser: (user: StaffRecord | null) => void;
  logout: () => void;
  updateLockout: () => number;
  canAccess: (feature: AccessibleFeature) => boolean;
}

export const useStaffAuthStore = create<StaffAuthStoreState>((set, get) => ({
  currentUser: StaffService.getCurrentUser(),
  isAuthenticated: Boolean(StaffService.getCurrentUser()),
  lockoutSeconds: StaffService.getLockoutRemainingSeconds(),

  initialize: () => {
    const user = StaffService.getCurrentUser();
    const lockout = StaffService.getLockoutRemainingSeconds();
    set({
      currentUser: user,
      isAuthenticated: Boolean(user),
      lockoutSeconds: lockout,
    });
  },

  setCurrentUser: (user: StaffRecord | null) => {
    StaffService.setCurrentUser(user);
    set({
      currentUser: user,
      isAuthenticated: Boolean(user),
    });
  },

  logout: () => {
    StaffService.logout();
    set({
      currentUser: null,
      isAuthenticated: false,
    });
  },

  updateLockout: () => {
    const seconds = StaffService.getLockoutRemainingSeconds();
    set({ lockoutSeconds: seconds });
    return seconds;
  },

  canAccess: (feature: AccessibleFeature): boolean => {
    const user = get().currentUser;
    if (!user || !user.isActive) return false;

    const role = user.role;

    // Owner and Manager: Full access to everything
    if (role === 'owner' || role === 'manager') {
      return true;
    }

    // Cashier: POS, Floor Plan, Shift Open/Close, Settle (cash/card)
    if (role === 'cashier') {
      return feature === 'pos' || feature === 'floor-plan' || feature === 'settle' || feature === 'shift';
    }

    // Waiter: Floor Plan ONLY, add orders to tables, NO settle, NO reports, NO pos direct
    if (role === 'waiter') {
      return feature === 'floor-plan';
    }

    // Barista & Cook: KDS view ONLY
    if (role === 'barista' || role === 'cook') {
      return feature === 'kds';
    }

    return false;
  },
}));
