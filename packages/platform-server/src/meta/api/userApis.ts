/**
 * User & Auth APIs
 * @module meta/api/userApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { User } from '../../models/User.js';
import { generateToken, refreshToken } from '../../auth/index.js';
import type { ApiRequest } from '../../types/index.js';

// ============================================================================
// Auth Handlers
// ============================================================================

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstname, lastname } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const user = await User.insert({ email, password, firstname, lastname });
    const token = generateToken({ id: user.id, email: user.email, roles: user.roles });

    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

export async function signin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.getByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, roles: user.roles });
    res.json({ token, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

export async function tokenRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const newToken = refreshToken(token);
    if (!newToken) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    res.json({ token: newToken });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await User.get(apiReq.user.id);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json(user.toSafeJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { firstname, lastname } = req.body;
    await User.update(apiReq.user.id, { firstname, lastname });

    const updated = await User.get(apiReq.user.id);
    res.json(updated?.toSafeJSON());
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiReq = req as ApiRequest;
    if (!apiReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }

    const user = await User.get(apiReq.user.id);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const isValid = await user.verifyPassword(currentPassword);
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    await User.update(apiReq.user.id, { password: newPassword });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await User.getByEmail(email);
    if (!user) {
      res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
      return;
    }

    const resetToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const resetExpires = new Date(Date.now() + 3600000);

    await User.update(user.id, { reset_password_token: resetToken, reset_password_expires: resetExpires });
    res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    const users = await User.list();
    const user = users.find(u =>
      u.getData().reset_password_token === token &&
      u.getData().reset_password_expires &&
      new Date(u.getData().reset_password_expires!) > new Date()
    );

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    await User.update(user.id, { password: newPassword });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// User Management (Admin)
// ============================================================================

export async function userList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await User.list();
    res.json({ list: users.map(u => u.toSafeJSON()) });
  } catch (error) {
    next(error);
  }
}

export async function userGet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await User.get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user.toSafeJSON());
  } catch (error) {
    next(error);
  }
}

export async function userUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const { firstname, lastname, roles, email_verified } = req.body;

    const user = await User.get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await User.update(userId, { firstname, lastname, roles, email_verified });
    const updated = await User.get(userId);
    res.json(updated?.toSafeJSON());
  } catch (error) {
    next(error);
  }
}

export async function userDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await User.get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await User.delete(userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/signup', signup);
  router.post('/signin', signin);
  router.post('/token/refresh', tokenRefresh);
  router.post('/password/forgot', requestPasswordReset);
  router.post('/password/reset', resetPassword);

  return router;
}

export function createUserRouter(): Router {
  const router = Router();

  router.get('/me', me);
  router.patch('/me', updateProfile);
  router.post('/me/password', changePassword);

  router.get('/', userList);
  router.get('/:userId', userGet);
  router.patch('/:userId', userUpdate);
  router.delete('/:userId', userDelete);

  return router;
}

export default { createAuthRouter, createUserRouter };
