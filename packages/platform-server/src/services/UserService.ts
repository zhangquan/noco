/**
 * User Service
 * Business logic for user management and authentication
 * @module services/UserService
 */

import bcrypt from 'bcryptjs';
import { BaseService, type ServiceOptions } from './BaseService.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { User, UserRole } from '../types/index.js';
import { Errors, ConflictError, AuthenticationError, ValidationError } from '../errors/index.js';
import { generateToken, refreshToken as refreshAuthToken, type TokenPair, generateTokenPair } from '../auth/index.js';

// ============================================================================
// Types
// ============================================================================

export interface CreateUserInput {
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  roles?: UserRole;
  invite_token?: string;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  roles?: UserRole;
  org_selected_id?: string;
  email_verified?: boolean;
}

export interface SignupInput {
  email: string;
  password: string;
  firstname?: string;
  lastname?: string;
}

export interface SigninInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
  refreshToken?: string;
}

export type SafeUser = Omit<User, 'password' | 'salt'>;

// ============================================================================
// User Service Class
// ============================================================================

class UserServiceImpl extends BaseService<User> {
  protected tableName = MetaTable.USERS;
  protected cacheScope = CacheScope.USER;
  protected entityName = 'User';

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get user by email
   */
  async getByEmail(email: string, options?: ServiceOptions): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const cache = this.getCache();
    const emailCacheKey = `${this.cacheScope}:email:${normalizedEmail}`;

    // Check email cache
    if (!options?.skipCache) {
      const cachedId = await cache.get<string>(emailCacheKey);
      if (cachedId) {
        return this.getById(cachedId, options);
      }
    }

    const user = await this.findOne({ email: normalizedEmail }, options);
    
    if (user && !options?.skipCache) {
      await cache.set(emailCacheKey, user.id);
    }

    return user;
  }

  /**
   * Get user by email or throw
   */
  async getByEmailOrFail(email: string, options?: ServiceOptions): Promise<User> {
    const user = await this.getByEmail(email, options);
    if (!user) {
      throw Errors.userNotFound();
    }
    return user;
  }

  /**
   * Get all users (admin only)
   */
  async listAll(options?: ServiceOptions): Promise<SafeUser[]> {
    const users = await this.findMany({
      ...options,
      orderBy: { created_at: 'desc' },
    });
    return users.map(this.toSafeUser);
  }

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  /**
   * Sign up a new user
   */
  async signup(input: SignupInput, options?: ServiceOptions): Promise<AuthResult> {
    // Validate input
    this.validateEmail(input.email);
    this.validatePassword(input.password);

    const normalizedEmail = input.email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await this.getByEmail(normalizedEmail, options);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const { hash, salt } = await this.hashPassword(input.password);

    // Create user
    const user = await this.create({
      email: normalizedEmail,
      password: hash,
      salt,
      firstname: input.firstname?.trim(),
      lastname: input.lastname?.trim(),
      roles: 'user',
      email_verified: false,
    } as Partial<User>, options);

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      roles: user.roles,
    });

    return {
      user: this.toSafeUser(user),
      token,
    };
  }

  /**
   * Sign in a user
   */
  async signin(input: SigninInput, options?: ServiceOptions): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Get user
    const user = await this.getByEmail(normalizedEmail, options);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Verify password
    const isValid = await this.verifyPassword(input.password, user.password || '');
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      roles: user.roles,
    });

    return {
      user: this.toSafeUser(user),
      token,
    };
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(token: string): Promise<{ token: string } | null> {
    const newToken = refreshAuthToken(token);
    if (!newToken) {
      return null;
    }
    return { token: newToken };
  }

  /**
   * Verify password for a user
   */
  async verifyUserPassword(userId: string, password: string, options?: ServiceOptions): Promise<boolean> {
    const user = await this.getById(userId, options);
    if (!user || !user.password) {
      return false;
    }
    return this.verifyPassword(password, user.password);
  }

  // ============================================================================
  // User Management Methods
  // ============================================================================

  /**
   * Create a new user (admin operation)
   */
  async createUser(input: CreateUserInput, options?: ServiceOptions): Promise<SafeUser> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await this.getByEmail(normalizedEmail, options);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    let hash: string | undefined;
    let salt: string | undefined;

    if (input.password) {
      this.validatePassword(input.password);
      const hashed = await this.hashPassword(input.password);
      hash = hashed.hash;
      salt = hashed.salt;
    }

    const user = await this.create({
      email: normalizedEmail,
      password: hash,
      salt,
      firstname: input.firstname?.trim(),
      lastname: input.lastname?.trim(),
      roles: input.roles || 'user',
      invite_token: input.invite_token,
      email_verified: false,
    } as Partial<User>, options);

    return this.toSafeUser(user);
  }

  /**
   * Update a user
   */
  async updateUser(id: string, input: UpdateUserInput, options?: ServiceOptions): Promise<SafeUser> {
    const updateData: Partial<User> = {};

    if (input.email !== undefined) {
      const normalizedEmail = input.email.toLowerCase().trim();
      this.validateEmail(normalizedEmail);
      
      // Check if email is taken by another user
      const existingUser = await this.getByEmail(normalizedEmail, options);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictError('Email is already in use');
      }
      
      updateData.email = normalizedEmail;
    }

    if (input.password !== undefined) {
      this.validatePassword(input.password);
      const { hash, salt } = await this.hashPassword(input.password);
      updateData.password = hash;
      updateData.salt = salt;
    }

    if (input.firstname !== undefined) updateData.firstname = input.firstname.trim();
    if (input.lastname !== undefined) updateData.lastname = input.lastname.trim();
    if (input.roles !== undefined) updateData.roles = input.roles;
    if (input.org_selected_id !== undefined) updateData.org_selected_id = input.org_selected_id;
    if (input.email_verified !== undefined) updateData.email_verified = input.email_verified;

    const user = await this.update(id, updateData, options);
    return this.toSafeUser(user);
  }

  /**
   * Update current user's profile
   */
  async updateProfile(
    userId: string,
    input: Pick<UpdateUserInput, 'firstname' | 'lastname'>,
    options?: ServiceOptions
  ): Promise<SafeUser> {
    return this.updateUser(userId, input, options);
  }

  /**
   * Change user's password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    options?: ServiceOptions
  ): Promise<boolean> {
    // Verify current password
    const isValid = await this.verifyUserPassword(userId, currentPassword, options);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Validate and update new password
    this.validatePassword(newPassword);
    const { hash, salt } = await this.hashPassword(newPassword);

    await this.update(userId, {
      password: hash,
      salt,
      reset_password_token: undefined,
      reset_password_expires: undefined,
    } as Partial<User>, options);

    return true;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string, options?: ServiceOptions): Promise<string | null> {
    const user = await this.getByEmail(email, options);
    if (!user) {
      // Don't reveal if user exists
      return null;
    }

    const resetToken = this.generateResetToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.update(user.id, {
      reset_password_token: resetToken,
      reset_password_expires: resetExpires,
    } as Partial<User>, options);

    return resetToken;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string, options?: ServiceOptions): Promise<boolean> {
    this.validatePassword(newPassword);

    const user = await this.findOne({
      reset_password_token: token,
    }, options);

    if (!user || !user.reset_password_expires || new Date(user.reset_password_expires) < new Date()) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const { hash, salt } = await this.hashPassword(newPassword);

    await this.update(user.id, {
      password: hash,
      salt,
      reset_password_token: undefined,
      reset_password_expires: undefined,
    } as Partial<User>, options);

    return true;
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string, options?: ServiceOptions): Promise<boolean> {
    const user = await this.getById(id, options);
    if (!user) {
      return false;
    }

    // Clear email cache
    const cache = this.getCache();
    await cache.del(`${this.cacheScope}:email:${user.email}`);

    return this.delete(id, options);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert user to safe user (without sensitive fields)
   */
  toSafeUser(user: User): SafeUser {
    const { password, salt, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return { hash, salt };
  }

  /**
   * Verify password
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
  }

  /**
   * Generate reset token
   */
  private generateResetToken(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
}

// Export singleton instance
export const UserService = new UserServiceImpl();

export default UserService;
