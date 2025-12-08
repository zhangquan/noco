/**
 * User Repository
 * Data access layer for user operations
 * @module repositories/UserRepository
 */

import bcrypt from 'bcryptjs';
import { BaseRepository, type RepositoryOptions } from './BaseRepository.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { User } from '../types/index.js';
import { generateId } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface UserRecord extends User {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  roles?: User['roles'];
  invite_token?: string;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  roles?: User['roles'];
  org_selected_id?: string;
  email_verified?: boolean;
  reset_password_token?: string;
  reset_password_expires?: Date;
}

// ============================================================================
// User Repository Class
// ============================================================================

class UserRepositoryImpl extends BaseRepository<UserRecord> {
  protected tableName = MetaTable.USERS;
  protected cacheScope = CacheScope.USER;

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get user by email
   */
  async getByEmail(email: string, options?: RepositoryOptions): Promise<UserRecord | null> {
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
   * Get user by reset token
   */
  async getByResetToken(token: string, options?: RepositoryOptions): Promise<UserRecord | null> {
    return this.findOne({ reset_password_token: token }, options);
  }

  /**
   * Get user by invite token
   */
  async getByInviteToken(token: string, options?: RepositoryOptions): Promise<UserRecord | null> {
    return this.findOne({ invite_token: token }, options);
  }

  /**
   * List all users
   */
  async listAll(options?: RepositoryOptions): Promise<UserRecord[]> {
    return this.list('all', {
      ...options,
      orderBy: { created_at: 'desc' },
    });
  }

  // ==========================================================================
  // Create / Update Operations
  // ==========================================================================

  /**
   * Create a new user
   */
  async createUser(data: CreateUserData, options?: RepositoryOptions): Promise<UserRecord> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    let hashedPassword: string | undefined;
    let salt: string | undefined;
    if (data.password) {
      salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(data.password, salt);
    }

    const userData: Partial<UserRecord> = {
      id,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      salt,
      firstname: data.firstname?.trim(),
      lastname: data.lastname?.trim(),
      roles: data.roles || 'user',
      invite_token: data.invite_token,
      email_verified: false,
      created_at: now,
      updated_at: now,
    };

    await db(this.tableName).insert(userData);

    const user = await this.getById(id, { ...options, skipCache: true });
    if (!user) throw new Error('Failed to create user');

    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.set(this.getCacheKey(id), user);
    }

    return user;
  }

  /**
   * Update a user
   */
  async updateUser(id: string, data: UpdateUserData, options?: RepositoryOptions): Promise<void> {
    const updateData: Partial<UserRecord> = { ...data };

    // Hash password if provided
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
      updateData.salt = salt;
    }

    // Normalize email if provided
    if (data.email) {
      updateData.email = data.email.toLowerCase().trim();
    }

    await this.update(id, updateData, options);
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string, options?: RepositoryOptions): Promise<number> {
    const user = await this.getById(id, options);
    if (user) {
      // Clear email cache
      const cache = this.getCache();
      await cache.del(`${this.cacheScope}:email:${user.email}`);
    }
    return this.delete(id, options);
  }

  // ==========================================================================
  // Password Operations
  // ==========================================================================

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return { hash, salt };
  }
}

// Export singleton instance
export const UserRepository = new UserRepositoryImpl();

export default UserRepository;
