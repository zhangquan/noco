/**
 * User Entity
 * Pure domain entity for user
 * @module models/User
 */

import type { User as UserType, UserRole } from '../types/index.js';

// ============================================================================
// User Entity Class
// ============================================================================

/**
 * User entity class - represents a user in the system
 * Contains only properties and business logic, no data access
 */
export class User {
  private data: UserType;

  constructor(data: UserType) {
    this.data = data;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this.data.id; }
  get email(): string { return this.data.email; }
  get password(): string | undefined { return this.data.password; }
  get salt(): string | undefined { return this.data.salt; }
  get firstname(): string | undefined { return this.data.firstname; }
  get lastname(): string | undefined { return this.data.lastname; }
  get roles(): UserRole { return this.data.roles; }
  get orgSelectedId(): string | undefined { return this.data.org_selected_id; }
  get emailVerified(): boolean { return this.data.email_verified ?? false; }
  get inviteToken(): string | undefined { return this.data.invite_token; }
  get resetPasswordToken(): string | undefined { return this.data.reset_password_token; }
  get resetPasswordExpires(): Date | undefined { return this.data.reset_password_expires; }
  get createdAt(): Date { return this.data.created_at; }
  get updatedAt(): Date { return this.data.updated_at; }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Get user display name
   */
  get displayName(): string {
    if (this.firstname || this.lastname) {
      return `${this.firstname || ''} ${this.lastname || ''}`.trim();
    }
    return this.email.split('@')[0];
  }

  /**
   * Get full name
   */
  get fullName(): string {
    return `${this.firstname || ''} ${this.lastname || ''}`.trim() || this.email;
  }

  /**
   * Check if user is admin
   */
  get isAdmin(): boolean {
    return this.roles === 'super';
  }

  /**
   * Check if password reset is expired
   */
  get isResetTokenExpired(): boolean {
    if (!this.resetPasswordExpires) return true;
    return new Date(this.resetPasswordExpires) < new Date();
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get raw data
   */
  getData(): UserType {
    return this.data;
  }

  /**
   * Convert to JSON
   */
  toJSON(): UserType {
    return { ...this.data };
  }

  /**
   * Convert to safe JSON (without sensitive fields)
   */
  toSafeJSON(): Omit<UserType, 'password' | 'salt'> {
    const { password, salt, ...safeData } = this.data;
    return safeData;
  }

  // ==========================================================================
  // Update Methods
  // ==========================================================================

  /**
   * Update internal data (called after repository update)
   */
  setData(data: UserType): void {
    this.data = data;
  }

  /**
   * Merge partial data
   */
  merge(data: Partial<UserType>): void {
    this.data = { ...this.data, ...data };
  }
}

export default User;
