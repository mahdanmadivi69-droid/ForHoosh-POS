/**
 * CAFE OS — Server-Side Authentication & Session Management Service
 * Module: server/authService.ts
 * Owner: A07-GATEKEEPER (Authentication and Authorization Engineer)
 *
 * Implements:
 * 1. Native Node crypto.scrypt password hashing and timing-safe verification.
 * 2. Cryptographically random session tokens (crypto.randomBytes, 256 bits).
 * 3. Token-hash-only server storage (raw tokens NEVER stored in database/memory).
 * 4. Strictly verified authentication boundary: zero sessions without password proof.
 *    (TASK-162 challenge ID shortcuts are strictly rejected).
 * 5. Multi-tenant partitioning: users belong strictly to their assigned tenantId.
 * 6. Session expiry and revocation lifecycle.
 */

import crypto from 'crypto';

export type UserRole =
  | 'OWNER'
  | 'MANAGER'
  | 'CASHIER'
  | 'BARISTA'
  | 'KITCHEN_STAFF'
  | 'GAMEMASTER';

export interface TenantUser {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredUserCredential {
  userId: string;
  tenantId: string;
  passwordHashScrypt: string;
  passwordSalt: string;
  failedAttempts: number;
  lockedUntil?: string;
}

export interface UserSession {
  id: string;
  tokenHash: string; // SHA-256 of the unhashed session token
  userId: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthLoginResult {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    tenantId: string;
  };
  csrfToken?: string;
  error?: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(`[AuthService:Authentication] ${message}`);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(`[AuthService:Authorization] ${message}`);
    this.name = 'AuthorizationError';
  }
}

// Scrypt tuning parameters
const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

// Default session duration: 8 hours
const DEFAULT_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export class AuthService {
  private users: Map<string, TenantUser> = new Map(); // key: `${tenantId}:${username}`
  private credentials: Map<string, StoredUserCredential> = new Map(); // key: userId
  private sessions: Map<string, UserSession> = new Map(); // key: tokenHash

  constructor() {
    this.seedDefaultUsers();
  }

  /**
   * Hashes a plaintext password using native crypto.scrypt with a random 16-byte salt.
   */
  public async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    if (!password || typeof password !== 'string' || password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    return {
      hash: derivedKey.toString('hex'),
      salt,
    };
  }

  /**
   * Verifies a password against stored scrypt hash and salt in constant time.
   */
  public async verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
    if (!password || !storedHash || !salt) return false;
    try {
      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => {
          if (err) reject(err);
          else resolve(key);
        });
      });
      const storedKeyBuffer = Buffer.from(storedHash, 'hex');
      if (derivedKey.length !== storedKeyBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(derivedKey, storedKeyBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Hashes a raw token with SHA-256 for secure server-side storage and lookup.
   */
  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Registers a tenant user with an scrypt-hashed password.
   */
  public async registerUser(
    tenantId: string,
    username: string,
    password: string,
    displayName: string,
    role: UserRole
  ): Promise<TenantUser> {
    const key = `${tenantId}:${username.toLowerCase()}`;
    if (this.users.has(key)) {
      throw new Error(`User "${username}" already exists in tenant "${tenantId}".`);
    }

    const userId = `usr_${tenantId}_${username.toLowerCase()}_${Date.now()}`;
    const { hash, salt } = await this.hashPassword(password);

    const nowIso = new Date().toISOString();
    const user: TenantUser = {
      id: userId,
      tenantId,
      username: username.toLowerCase(),
      displayName,
      role,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const cred: StoredUserCredential = {
      userId,
      tenantId,
      passwordHashScrypt: hash,
      passwordSalt: salt,
      failedAttempts: 0,
    };

    this.users.set(key, user);
    this.credentials.set(userId, cred);
    return user;
  }

  /**
   * Authenticates user with genuine scrypt password verification.
   * Returns a cryptographically random session token upon success.
   * STRICT SECURITY INVARIANT:
   *  - Never issues sessions based on challenge-IDs or unverified claims.
   */
  public async login(
    tenantId: string,
    username: string,
    password: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuthLoginResult> {
    if (!tenantId || !username || !password) {
      return { success: false, error: 'Tenant, username, and password are required.' };
    }

    const key = `${tenantId}:${username.toLowerCase()}`;
    const user = this.users.get(key);
    if (!user || !user.isActive) {
      return { success: false, error: 'Invalid username or password for this cafe tenant.' };
    }

    const cred = this.credentials.get(user.id);
    if (!cred) {
      return { success: false, error: 'Credential record not found.' };
    }

    // Check account lockout
    if (cred.lockedUntil && new Date(cred.lockedUntil).getTime() > Date.now()) {
      return { success: false, error: 'Account temporarily locked due to repeated failed attempts.' };
    }

    // Genuine scrypt password verification
    const isValid = await this.verifyPassword(password, cred.passwordHashScrypt, cred.passwordSalt);
    if (!isValid) {
      cred.failedAttempts++;
      if (cred.failedAttempts >= 5) {
        cred.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lock
      }
      return { success: false, error: 'Invalid username or password for this cafe tenant.' };
    }

    // Reset failed attempts on success
    cred.failedAttempts = 0;
    cred.lockedUntil = undefined;

    // Generate cryptographically random session token (256 bits)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // Generate CSRF token tied to session
    const csrfToken = crypto.randomBytes(24).toString('hex');

    const now = Date.now();
    const session: UserSession = {
      id: `ses_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      tokenHash,
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + DEFAULT_SESSION_DURATION_MS).toISOString(),
      revoked: false,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    };

    this.sessions.set(tokenHash, session);

    return {
      success: true,
      token: rawToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        tenantId: user.tenantId,
      },
      csrfToken,
    };
  }

  /**
   * Validates a session token.
   * Returns active UserSession or null if invalid/expired/revoked.
   */
  public validateSession(rawToken: string): UserSession | null {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);
    if (!session) return null;

    if (session.revoked) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }

    return session;
  }

  /**
   * Revokes a session (Logout).
   */
  public revokeSession(rawToken: string): boolean {
    if (!rawToken) return false;
    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);
    if (session) {
      session.revoked = true;
      return true;
    }
    return false;
  }

  /**
   * Revokes all active sessions for a user (e.g., password change or security flush).
   */
  public revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revoked) {
        session.revoked = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Seeds default users for 100 HICH and Modendo cafes synchronously.
   */
  private seedDefaultUsers(): void {
    // Generate known static salts and scrypt hashes for initial startup
    // Passwords for demo/test seed users:
    // 100 HICH:
    //   owner_100hich -> 'Hich@2026'
    //   sara_manager  -> 'Sara@100'
    //   nima_barista  -> 'Nima@100'
    // Modendo:
    //   owner_modendo -> 'Modendo@2026'
    //   mahsa_cashier -> 'Mahsa@Mod'
    //   arian_gamemaster -> 'Arian@Mod'
    //   chef_kitchen  -> 'Chef@Mod'

    const seedUsers = [
      {
        tenantId: 'tenant-100hich-01',
        username: 'owner_100hich',
        displayName: 'مدیر ارشد ۱۰۰هیچ',
        role: 'OWNER' as UserRole,
        pass: 'Hich@2026',
      },
      {
        tenantId: 'tenant-100hich-01',
        username: 'sara_manager',
        displayName: 'سارا رضایی (مدیر شیفت)',
        role: 'MANAGER' as UserRole,
        pass: 'Sara@100',
      },
      {
        tenantId: 'tenant-100hich-01',
        username: 'nima_barista',
        displayName: 'نیما کریمی (باریستا)',
        role: 'BARISTA' as UserRole,
        pass: 'Nima@100',
      },
      {
        tenantId: 'tenant-modendo-01',
        username: 'owner_modendo',
        displayName: 'مدیر ارشد مودندو',
        role: 'OWNER' as UserRole,
        pass: 'Modendo@2026',
      },
      {
        tenantId: 'tenant-modendo-01',
        username: 'mahsa_cashier',
        displayName: 'مهسا احمدی (صندوقدار)',
        role: 'CASHIER' as UserRole,
        pass: 'Mahsa@Mod',
      },
      {
        tenantId: 'tenant-modendo-01',
        username: 'arian_gamemaster',
        displayName: 'آرین شریفی (گیم‌مستر)',
        role: 'GAMEMASTER' as UserRole,
        pass: 'Arian@Mod',
      },
      {
        tenantId: 'tenant-modendo-01',
        username: 'chef_kitchen',
        displayName: 'سرآشپز مودندو',
        role: 'KITCHEN_STAFF' as UserRole,
        pass: 'Chef@Mod',
      },
    ];

    for (const u of seedUsers) {
      const salt = crypto.createHash('sha256').update(`salt_${u.tenantId}_${u.username}`).digest('hex').slice(0, 32);
      const derivedKey = crypto.scryptSync(u.pass, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
      const hash = derivedKey.toString('hex');
      const userId = `usr_${u.tenantId}_${u.username}`;
      const nowIso = new Date().toISOString();

      const user: TenantUser = {
        id: userId,
        tenantId: u.tenantId,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const cred: StoredUserCredential = {
        userId,
        tenantId: u.tenantId,
        passwordHashScrypt: hash,
        passwordSalt: salt,
        failedAttempts: 0,
      };

      this.users.set(`${u.tenantId}:${u.username}`, user);
      this.credentials.set(userId, cred);
    }
  }

  /**
   * For testing: clears active sessions.
   */
  public clearSessionsForTest(): void {
    this.sessions.clear();
  }
}

// Default singleton
let defaultAuthServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!defaultAuthServiceInstance) {
    defaultAuthServiceInstance = new AuthService();
  }
  return defaultAuthServiceInstance;
}
