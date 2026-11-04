/**
 * CAFE OS — Authentication Express Router
 * Module: server/authRoutes.ts
 * Owner: A07-GATEKEEPER (Authentication and Authorization Engineer)
 *
 * Implements:
 * 1. POST /api/v1/auth/login (scrypt password verification + HttpOnly cookie)
 * 2. POST /api/v1/auth/logout (session revocation + cookie clear)
 * 3. GET  /api/v1/auth/me (current session verification)
 * 4. POST /api/v1/auth/verify-session
 */

import { Router, Request, Response } from 'express';
import { AuthService, getAuthService } from './authService';
import { requireAuth, extractSessionToken, AuthenticatedRequest } from './authMiddleware';

export function createAuthRouter(authService: AuthService = getAuthService()): Router {
  const router = Router();

  /**
   * Login endpoint:
   * Verifies username + scrypt password hash.
   * Sets HttpOnly session cookie on success.
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, username, password } = req.body;

      if (!tenantId || !username || !password) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: tenantId, username, and password are required.',
        });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(tenantId, username, password, { ipAddress, userAgent });

      if (!result.success || !result.token) {
        res.status(401).json({
          success: false,
          error: result.error || 'Authentication failed: Invalid credentials or tenant.',
        });
        return;
      }

      // Configure HttpOnly Cookie
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieOptions = [
        `coda_session=${result.token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=28800', // 8 hours
      ];
      if (isProduction) {
        cookieOptions.push('Secure');
      }

      res.setHeader('Set-Cookie', cookieOptions.join('; '));

      res.status(200).json({
        success: true,
        user: result.user,
        csrfToken: result.csrfToken,
      });
    } catch (err: any) {
      console.error('[AuthRouter] Login error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal authentication error.',
      });
    }
  });

  /**
   * Logout endpoint:
   * Revokes session token on server and clears cookie.
   */
  router.post('/logout', (req: Request, res: Response): void => {
    try {
      const token = extractSessionToken(req);
      if (token) {
        authService.revokeSession(token);
      }

      // Clear cookie
      res.setHeader('Set-Cookie', 'coda_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

      res.status(200).json({
        success: true,
        message: 'Session revoked and logged out successfully.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error logging out.' });
    }
  });

  /**
   * Current user session check
   */
  router.get('/me', requireAuth(authService), (req: AuthenticatedRequest, res: Response): void => {
    res.status(200).json({
      success: true,
      authenticated: true,
      user: req.user,
    });
  });

  /**
   * Session verification
   */
  router.post('/verify-session', requireAuth(authService), (req: AuthenticatedRequest, res: Response): void => {
    res.status(200).json({
      success: true,
      valid: true,
      user: req.user,
    });
  });

  return router;
}
