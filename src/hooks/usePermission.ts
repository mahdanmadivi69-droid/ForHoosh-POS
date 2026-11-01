/**
 * Custom React Hook for Role-Based Access Control and PIN Elevation
 * AutoClaw & AntiGravity Elite UI/UX Specification
 */

import { useState, useCallback } from 'react';
import { AppUserRole, Permission, ElevationAction } from '../types/rbac-settings';
import { RBACService, ROLE_DEFINITIONS } from '../services/RBACService';

export interface UsePermissionOptions {
  userRole: AppUserRole;
  userName: string;
}

export function usePermission({ userRole, userName }: UsePermissionOptions) {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ElevationAction | null>(null);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);
  const [onFailureCallback, setOnFailureCallback] = useState<((err?: string) => void) | null>(null);

  /**
   * Directly test if current user role has static permission
   */
  const can = useCallback(
    (permission: Permission): boolean => {
      return RBACService.hasPermission(userRole, permission);
    },
    [userRole]
  );

  /**
   * Check if action requires elevation
   */
  const requiresElevation = useCallback(
    (action: ElevationAction): boolean => {
      return RBACService.requiresElevation(action, userRole);
    },
    [userRole]
  );

  /**
   * Execute an action with automatic PIN elevation if required
   */
  const executeWithElevation = useCallback(
    (
      action: ElevationAction,
      onGranted: () => void,
      onDenied?: (err?: string) => void
    ) => {
      const needsElevation = RBACService.requiresElevation(action, userRole);

      if (!needsElevation) {
        // Direct execution without PIN
        onGranted();
        return;
      }

      // Open PIN modal and register callbacks
      setPendingAction(action);
      setOnSuccessCallback(() => onGranted);
      setOnFailureCallback(() => onDenied || null);
      setIsPinModalOpen(true);
    },
    [userRole]
  );

  const handlePinSuccess = useCallback(
    (authorizedManagerName: string) => {
      setIsPinModalOpen(false);
      setPendingAction(null);
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
    [onSuccessCallback]
  );

  const handlePinCancel = useCallback(() => {
    setIsPinModalOpen(false);
    setPendingAction(null);
    if (onFailureCallback) {
      onFailureCallback('درخواست توسط کاربر لغو شد.');
    }
  }, [onFailureCallback]);

  return {
    userRole,
    roleDefinition: ROLE_DEFINITIONS[userRole] || ROLE_DEFINITIONS.BARISTA,
    can,
    requiresElevation,
    executeWithElevation,
    isPinModalOpen,
    pendingAction,
    handlePinSuccess,
    handlePinCancel,
    requestedByUser: userName,
  };
}
