/**
 * Authentication Module
 * JWT + Passport.js based authentication
 * @module auth
 */

import { Strategy as JwtStrategy, ExtractJwt, type StrategyOptions } from 'passport-jwt';
import type { PassportStatic } from 'passport';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import type { JwtPayload, ApiRequest, ProjectRole } from '../types/index.js';
import { Project } from '../models/Project.js';

// ============================================================================
// Configuration
// ============================================================================

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  cookieName?: string;
  cookieDomain?: string;
  cookieSecure?: boolean;
}

const DEFAULT_CONFIG: AuthConfig = {
  jwtSecret: process.env.NC_AUTH_JWT_SECRET || 'your-super-secret-key-change-in-production',
  jwtExpiresIn: process.env.NC_JWT_EXPIRES_IN || '10h',
  jwtIssuer: process.env.NC_JWT_ISSUER || 'nocodb',
  jwtAudience: process.env.NC_JWT_AUDIENCE || 'nocodb',
  cookieName: 'token',
  cookieSecure: process.env.NODE_ENV === 'production',
};

let authConfig: AuthConfig = { ...DEFAULT_CONFIG };

export function configureAuth(config: Partial<AuthConfig>): void {
  authConfig = { ...authConfig, ...config };
}

export function getAuthConfig(): AuthConfig {
  return authConfig;
}

// ============================================================================
// JWT Functions
// ============================================================================

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
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, authConfig.jwtSecret, {
      issuer: authConfig.jwtIssuer,
      audience: authConfig.jwtAudience,
    }) as JwtPayload;
  } catch {
    return null;
  }
}

export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  return generateToken({ id: payload.id, email: payload.email, roles: payload.roles });
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
        const user = await User.get(payload.id);
        if (user) {
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

export function requireAuth(passport: PassportStatic) {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: Error | null, user: User | false) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }
      (req as ApiRequest).user = user.getData();
      next();
    })(req, res, next);
  };
}

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

export function requireProjectPermission(operation: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const projectId = req.params.projectId || apiReq.ncProjectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
    }

    try {
      if (apiReq.user.roles === 'super') return next();

      const role = await Project.getUserRole(projectId, apiReq.user.id);
      if (!role) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this project' });
      }

      const { PROJECT_ACL } = await import('../types/index.js');
      const permissions = PROJECT_ACL[role];
      if (!permissions || !permissions[operation]) {
        return res.status(403).json({ error: 'Forbidden', message: `You do not have permission to ${operation} in this project` });
      }

      (apiReq as any).projectRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    if (!roles.includes(apiReq.user.roles)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient privileges' });
    }
    next();
  };
}

export { JwtStrategy };
export default {
  configureAuth,
  getAuthConfig,
  generateToken,
  verifyToken,
  refreshToken,
  configurePassport,
  requireAuth,
  optionalAuth,
  requireProjectPermission,
  requireRole,
};
