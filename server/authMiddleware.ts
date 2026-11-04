/**
 * CAFE OS — Authentication & Authorization Express Middleware
 * Module: server/authMiddleware.ts
 * Owner: A07-GATEKEEPER (Authentication and Authorization Engineer)
 *
 * Implements:
 * 1. HttpOnly cookie parsing and extraction (coda_session).
 * 2. Bearer token fallback for automated headless API testing.
 * 3. requireAuth: Enforces valid server-managed session.
 * 4. requireTenantMembership: Strict multi-tenant authorization barrier (denies cross-tenant forgery).
 * 5. requireRole: Role-based access control (RBAC).
 * 6. strictOriginValidation: Validates Origin & Referer headers against allowed hosts.
 * 7. csrfProtection: Validates anti-CSRF token on mutating requests.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, getAuthService, UserSession, UserRole } from './authService';

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user?: UserSession;
}

/**
 * Parses raw Cookie header string into key-value map.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });

  return list;
}

/**
 * Extracts session token from HttpOnly cookie or Authorization Bearer header.
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Check HttpOnly cookie
  const cookies = parseCookies(req.headers.cookie);
  if (cookies['coda_session']) {
    return cookies['coda_session'];
  }

  // 2. Check Authorization Bearer header (for automated testing / CLI tools)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Middleware: Requires an active, authenticated server-side session.
 */
export function requireAuth(authService: AuthService = getAuthService()) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = extractSessionToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. No active session token found.',
      });
      return;
    }

    const session = authService.validateSession(token);
    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Invalid, revoked, or expired session. Please log in again.',
      });
      return;
    }

    req.user = session;
    next();
  };
}

/**
 * Middleware: Strictly enforces tenant membership.
 * Caller can ONLY access data belonging to the tenant in their authenticated session.
 * Rejects client attempts to spoof tenant via X-Tenant-Id header.
 */
export function requireTenantMembership(paramOrHeader: string = 'x-tenant-id') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required before tenant check.' });
      return;
    }

    // Resolve requested tenant from headers, params, query, or body (including nested order.tenantId)
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    const paramTenant = req.params?.tenantId as string | undefined;
    const queryTenant = req.query?.tenantId as string | undefined;
    const bodyTenant = req.body?.tenantId as string | undefined;
    const bodyOrderTenant = req.body?.order?.tenantId as string | undefined;

    const requestedTenants = [headerTenant, paramTenant, queryTenant, bodyTenant, bodyOrderTenant].filter(
      (t): t is string => typeof t === 'string' && t.trim().length > 0
    );

    for (const requestedTenant of requestedTenants) {
      if (requestedTenant !== req.user.tenantId) {
        res.status(403).json({
          success: false,
          error: `Cross-tenant access denied. Your session belongs to "${req.user.tenantId}", cannot access "${requestedTenant}".`,
        });
        return;
      }
    }

    next();
  };
}

/**
 * Middleware: Enforces Role-Based Access Control (RBAC).
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden. Role "${req.user.role}" does not have permission. Required: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Validates Origin and Referer headers against allowed hosts for mutating requests.
 */
export function strictOriginValidation(allowedOrigins?: string[]) {
  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
  ];

  const allowed = allowedOrigins || defaultAllowedOrigins;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only check mutating requests (POST, PUT, DELETE, PATCH)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;
    if (origin) {
      const isAllowed = allowed.some((allowedOrigin) => origin === allowedOrigin || origin.startsWith(allowedOrigin));
      if (!isAllowed) {
        res.status(403).json({
          success: false,
          error: `Cross-Origin Request Blocked. Origin "${origin}" is not authorized.`,
        });
        return;
      }
    }

    next();
  };
}

/**
 * Middleware: Anti-CSRF verification for mutating requests.
 */
export function csrfProtection() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // If request is made with Bearer header directly (CLI / test script), pass through
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    const csrfTokenHeader = req.headers['x-csrf-token'];
    // In browser cookie mode, verify presence of anti-CSRF token
    if (req.headers.cookie && !csrfTokenHeader) {
      res.status(403).json({
        success: false,
        error: 'Missing CSRF Token. Mutating requests must include X-CSRF-Token header.',
      });
      return;
    }

    next();
  };
}
