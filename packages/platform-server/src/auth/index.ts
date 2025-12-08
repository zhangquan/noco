/**
 * Authentication Module
 * JWT + Passport.js based authentication with enhanced security
 * @module auth
 */

import { Strategy as JwtStrategy, ExtractJwt, type StrategyOptions } from 'passport-jwt';
import type { PassportStatic } from 'passport';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import type { JwtPayload, ApiRequest, ProjectRole } from '../types/index.js';
import { AuthenticationError, AuthorizationError, Errors } from '../errors/index.js';
import { logAuditEvent } from '../middleware/logging.js';

// ============================================================================
// Configuration
// ============================================================================

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  cookieName?: string;
  cookieDomain?: string;
  cookieSecure?: boolean;
  cookieHttpOnly?: boolean;
  cookieSameSite?: 'strict' | 'lax' | 'none';
  /** Enable refresh token rotation */
  enableRefreshTokenRotation?: boolean;
  /** Blacklist tokens on logout */
  enableTokenBlacklist?: boolean;
}

const DEFAULT_CONFIG: AuthConfig = {
  jwtSecret: process.env.NC_AUTH_JWT_SECRET || 'your-super-secret-key-change-in-production',
  jwtExpiresIn: process.env.NC_JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.NC_JWT_REFRESH_EXPIRES_IN || '7d',
  jwtIssuer: process.env.NC_JWT_ISSUER || 'platform-server',
  jwtAudience: process.env.NC_JWT_AUDIENCE || 'platform-server',
  cookieName: 'token',
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieHttpOnly: true,
  cookieSameSite: 'lax',
  enableRefreshTokenRotation: true,
  enableTokenBlacklist: false,
};

let authConfig: AuthConfig = { ...DEFAULT_CONFIG };

// In-memory token blacklist (use Redis in production)
const tokenBlacklist = new Set<string>();

export function configureAuth(config: Partial<AuthConfig>): void {
  authConfig = { ...authConfig, ...config };
}

export function getAuthConfig(): AuthConfig {
  return { ...authConfig };
}

// ============================================================================
// JWT Functions
// ============================================================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generate a unique token ID for tracking
 */
function generateTokenId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate access token
 */
export function generateToken(user: { id: string; email: string; roles?: string }): string {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    roles: user.roles as any,
  };

  return jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.jwtExpiresIn,
    issuer: authConfig.jwtIssuer,
    audience: authConfig.jwtAudience,
    jwtid: generateTokenId(),
  } as jwt.SignOptions);
}

/**
 * Generate access and refresh token pair
 */
export function generateTokenPair(user: { id: string; email: string; roles?: string }): TokenPair {
  const accessToken = generateToken(user);
  
  const refreshPayload = {
    id: user.id,
    type: 'refresh',
    jti: generateTokenId(),
  };

  const refreshToken = jwt.sign(refreshPayload, authConfig.jwtSecret, {
    expiresIn: authConfig.jwtRefreshExpiresIn,
    issuer: authConfig.jwtIssuer,
    audience: authConfig.jwtAudience,
  } as jwt.SignOptions);

  // Parse expiry from config
  const expiresIn = parseExpiry(authConfig.jwtExpiresIn);

  return { accessToken, refreshToken, expiresIn };
}

/**
 * Parse expiry string to seconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // default 1 hour

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 3600;
  }
}

/**
 * Verify access token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    // Check blacklist
    if (authConfig.enableTokenBlacklist && tokenBlacklist.has(token)) {
      return null;
    }

    const payload = jwt.verify(token, authConfig.jwtSecret, {
      issuer: authConfig.jwtIssuer,
      audience: authConfig.jwtAudience,
    }) as JwtPayload;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token and return new token pair
 */
export async function refreshTokenPair(refreshTokenStr: string): Promise<TokenPair | null> {
  try {
    const payload = jwt.verify(refreshTokenStr, authConfig.jwtSecret, {
      issuer: authConfig.jwtIssuer,
      audience: authConfig.jwtAudience,
    }) as { id: string; type: string; jti: string };

    if (payload.type !== 'refresh') {
      return null;
    }

    // Fetch user to ensure they still exist
    const userRecord = await UserRepository.getById(payload.id);
    if (!userRecord) {
      return null;
    }

    // Blacklist old refresh token if rotation enabled
    if (authConfig.enableRefreshTokenRotation && authConfig.enableTokenBlacklist) {
      tokenBlacklist.add(refreshTokenStr);
    }

    // Log audit event
    logAuditEvent({
      action: 'token.refresh',
      resourceType: 'user',
      resourceId: userRecord.id,
      userId: userRecord.id,
    });

    return generateTokenPair({
      id: userRecord.id,
      email: userRecord.email,
      roles: userRecord.roles,
    });
  } catch {
    return null;
  }
}

/**
 * Refresh token (legacy - returns single token)
 */
export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  return generateToken({ id: payload.id, email: payload.email, roles: payload.roles });
}

/**
 * Blacklist a token (for logout)
 */
export function blacklistToken(token: string): void {
  if (authConfig.enableTokenBlacklist) {
    tokenBlacklist.add(token);
  }
}

/**
 * Clear expired tokens from blacklist (should be called periodically)
 */
export function cleanupBlacklist(): void {
  // In production, this would check expiry in Redis
  // For in-memory, we could track expiry but keeping it simple
  if (tokenBlacklist.size > 10000) {
    tokenBlacklist.clear();
  }
}

// ============================================================================
// Passport Strategy
// ============================================================================

export function configurePassport(passport: PassportStatic): void {
  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderAsBearerToken(),
      (req: Request) => {
        if (req.cookies && req.cookies[authConfig.cookieName || 'token']) {
          return req.cookies[authConfig.cookieName || 'token'];
        }
        return null;
      },
      ExtractJwt.fromUrlQueryParameter('token'),
    ]),
    secretOrKey: authConfig.jwtSecret,
    issuer: authConfig.jwtIssuer,
    audience: authConfig.jwtAudience,
  };

  passport.use(
    new JwtStrategy(options, async (payload: JwtPayload, done) => {
      try {
        const userRecord = await UserRepository.getById(payload.id);
        if (userRecord) {
          const user = new User(userRecord);
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    })
  );
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Require authentication middleware
 */
export function requireAuth(passport: PassportStatic) {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: Error | null, user: User | false) => {
      if (err) return next(err);
      if (!user) {
        return next(Errors.authRequired('Authentication required'));
      }
      (req as ApiRequest).user = user.getData();
      next();
    })(req, res, next);
  };
}

/**
 * Optional authentication middleware
 */
export function optionalAuth(passport: PassportStatic) {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: Error | null, user: User | false) => {
      if (user) {
        (req as ApiRequest).user = user.getData();
      }
      next();
    })(req, res, next);
  };
}

/**
 * Require specific project permission
 */
export function requireProjectPermission(operation: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      return next(Errors.authRequired());
    }

    const projectId = req.params.projectId || apiReq.ncProjectId;
    if (!projectId) {
      return next(Errors.missingField('projectId'));
    }

    try {
      // Super admins bypass permission checks
      if (apiReq.user.roles === 'super') {
        (apiReq as any).projectRole = 'owner';
        return next();
      }

      const role = await ProjectRepository.getUserRole(projectId, apiReq.user.id);
      if (!role) {
        return next(Errors.permissionDenied('access this project'));
      }

      const { PROJECT_ACL } = await import('../types/index.js');
      const permissions = PROJECT_ACL[role];
      if (!permissions || !permissions[operation]) {
        // Log unauthorized access attempt
        logAuditEvent({
          action: 'permission.denied',
          resourceType: 'project',
          resourceId: projectId,
          userId: apiReq.user.id,
          metadata: { operation, role },
        });
        return next(Errors.permissionDenied(operation));
      }

      (apiReq as any).projectRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require specific user role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      return next(Errors.authRequired());
    }
    if (!roles.includes(apiReq.user.roles)) {
      return next(Errors.permissionDenied());
    }
    next();
  };
}

/**
 * API Key authentication middleware
 */
export function requireApiKey(keyValidator: (key: string) => Promise<{ userId: string; scopes: string[] } | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return next(Errors.authRequired('API key required'));
    }

    try {
      const keyData = await keyValidator(apiKey);
      if (!keyData) {
        return next(Errors.tokenInvalid());
      }

      // Load user
      const userRecord = await UserRepository.getById(keyData.userId);
      if (!userRecord) {
        return next(Errors.tokenInvalid());
      }

      (req as ApiRequest).user = userRecord;
      (req as any).apiKeyScopes = keyData.scopes;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Set auth cookies for browser clients
 */
export function setAuthCookies(res: Response, tokens: TokenPair): void {
  const cookieOptions: CookieOptions = {
    httpOnly: authConfig.cookieHttpOnly,
    secure: authConfig.cookieSecure,
    sameSite: authConfig.cookieSameSite,
    domain: authConfig.cookieDomain,
    maxAge: tokens.expiresIn * 1000,
  };

  res.cookie(authConfig.cookieName || 'token', tokens.accessToken, cookieOptions);
  res.cookie('refreshToken', tokens.refreshToken, {
    ...cookieOptions,
    maxAge: parseExpiry(authConfig.jwtRefreshExpiresIn) * 1000,
    path: '/api/v1/db/auth/token/refresh',
  });
}

/**
 * Clear auth cookies
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(authConfig.cookieName || 'token');
  res.clearCookie('refreshToken');
}

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
  maxAge?: number;
  path?: string;
}

export { JwtStrategy };
export default {
  configureAuth,
  getAuthConfig,
  generateToken,
  generateTokenPair,
  verifyToken,
  refreshToken,
  refreshTokenPair,
  blacklistToken,
  cleanupBlacklist,
  configurePassport,
  requireAuth,
  optionalAuth,
  requireProjectPermission,
  requireRole,
  requireApiKey,
  setAuthCookies,
  clearAuthCookies,
};
