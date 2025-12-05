/**
 * User Model
 * @module models/User
 */

import bcrypt from 'bcryptjs';
import { CacheScope, MetaTable } from '../types/index.js';
import type { User as UserType, UserRole } from '../types/index.js';
import { getNcMeta } from '../lib/NcMetaIO.js';
import { NocoCache } from '../cache/index.js';
import {
  getById,
  getByCondition,
  listRecords,
  updateRecord,
  deleteRecord,
  type BaseModelOptions,
} from './BaseModel.js';

const CACHE_SCOPE = CacheScope.USER;
const META_TABLE = MetaTable.USERS;

export class User {
  private data: UserType;

  constructor(data: UserType) {
    this.data = data;
  }

  // Getters
  get id(): string { return this.data.id; }
  get email(): string { return this.data.email; }
  get firstname(): string | undefined { return this.data.firstname; }
  get lastname(): string | undefined { return this.data.lastname; }
  get roles(): UserRole { return this.data.roles; }
  get orgSelectedId(): string | undefined { return this.data.org_selected_id; }
  get emailVerified(): boolean { return this.data.email_verified ?? false; }

  get displayName(): string {
    if (this.firstname || this.lastname) {
      return `${this.firstname || ''} ${this.lastname || ''}`.trim();
    }
    return this.email.split('@')[0];
  }

  getData(): UserType { return this.data; }

  toJSON(): UserType { return { ...this.data }; }

  toSafeJSON(): Omit<UserType, 'password' | 'salt'> {
    const { password, salt, ...safeData } = this.data;
    return safeData;
  }

  async verifyPassword(password: string): Promise<boolean> {
    if (!this.data.password) return false;
    return bcrypt.compare(password, this.data.password);
  }

  async update(data: Partial<Pick<UserType, 'firstname' | 'lastname' | 'email' | 'roles' | 'org_selected_id' | 'email_verified'>>): Promise<void> {
    await User.update(this.id, data);
    const updated = await User.get(this.id, { skipCache: true });
    if (updated) {
      this.data = updated.getData();
    }
  }

  // Static methods
  static async get(id: string, options?: BaseModelOptions): Promise<User | null> {
    const data = await getById<UserType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new User(data) : null;
  }

  static async getByEmail(email: string, options?: BaseModelOptions): Promise<User | null> {
    const cache = NocoCache.getInstance();
    const cacheKey = `${CACHE_SCOPE}:email:${email.toLowerCase()}`;

    if (!options?.skipCache) {
      const cachedId = await cache.get<string>(cacheKey);
      if (cachedId) {
        return this.get(cachedId, options);
      }
    }

    const data = await getByCondition<UserType>(META_TABLE, { email: email.toLowerCase() }, options);
    if (!data) return null;

    if (!options?.skipCache) {
      await cache.set(cacheKey, data.id);
    }

    return new User(data);
  }

  static async insert(data: {
    email: string;
    password?: string;
    firstname?: string;
    lastname?: string;
    roles?: UserRole;
    invite_token?: string;
  }, options?: BaseModelOptions): Promise<User> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const now = new Date();

    let hashedPassword: string | undefined;
    let salt: string | undefined;
    if (data.password) {
      salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(data.password, salt);
    }

    const userData: Partial<UserType> = {
      email: data.email.toLowerCase(),
      password: hashedPassword,
      salt,
      firstname: data.firstname,
      lastname: data.lastname,
      roles: data.roles || 'user',
      invite_token: data.invite_token,
      email_verified: false,
      created_at: now,
      updated_at: now,
    };

    const id = await ncMeta.metaInsert(null, null, META_TABLE, userData as Record<string, unknown>);
    const user = await this.get(id, { ...options, skipCache: true });
    if (!user) throw new Error('Failed to create user');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, user.getData());
    }

    return user;
  }

  static async update(id: string, data: Partial<Pick<UserType, 'email' | 'password' | 'firstname' | 'lastname' | 'roles' | 'org_selected_id' | 'email_verified' | 'reset_password_token' | 'reset_password_expires'>>, options?: BaseModelOptions): Promise<void> {
    const updateData: Partial<UserType> = { ...data };

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
      updateData.salt = salt;
    }

    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }

    await updateRecord<UserType>(CACHE_SCOPE, META_TABLE, id, updateData, options);
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const user = await this.get(id, options);
    if (user) {
      const cache = NocoCache.getInstance();
      await cache.del(`${CACHE_SCOPE}:email:${user.email}`);
    }
    return deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
  }

  static async list(options?: BaseModelOptions): Promise<User[]> {
    const data = await listRecords<UserType>(
      CACHE_SCOPE,
      META_TABLE,
      'all',
      { orderBy: { created_at: 'desc' } },
      options
    );
    return data.map(d => new User(d));
  }

  static async count(condition?: Record<string, unknown>): Promise<number> {
    const ncMeta = getNcMeta();
    return ncMeta.metaCount(null, null, META_TABLE, condition);
  }
}

export default User;
