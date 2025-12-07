/**
 * ID Generator
 * Generates unique IDs using ULID (Universally Unique Lexicographically Sortable Identifier)
 * @module db/IdGenerator
 */

import { ulid, decodeTime } from 'ulid';
import type { IdPrefix } from './types.js';

// ============================================================================
// ID Generator Class
// ============================================================================

/**
 * ID Generator utility class
 * Generates sortable, unique identifiers with optional prefixes
 */
export class IdGenerator {
  /**
   * Generate a new ULID
   */
  static generate(): string {
    return ulid();
  }

  /**
   * Generate a new ID with a prefix
   * Format: {prefix}_{ulid}
   */
  static generateWithPrefix(prefix: IdPrefix | string): string {
    return `${prefix}_${ulid()}`;
  }

  /**
   * Generate a nanoid-style ID (shorter, URL-safe)
   * Uses first 12 characters of ULID for shorter IDs
   */
  static generateShort(): string {
    return ulid().slice(0, 12).toLowerCase();
  }

  /**
   * Generate a nanoid-style ID with prefix
   */
  static generateShortWithPrefix(prefix: IdPrefix | string): string {
    return `${prefix}_${ulid().slice(0, 12).toLowerCase()}`;
  }

  /**
   * Extract timestamp from ULID
   * @param id - ULID string (with or without prefix)
   * @returns Date object or null if invalid
   */
  static extractTimestamp(id: string): Date | null {
    try {
      // Remove prefix if present
      const ulidPart = id.includes('_') ? id.split('_')[1] : id;
      if (!ulidPart || ulidPart.length < 10) return null;
      
      const timestamp = decodeTime(ulidPart);
      return new Date(timestamp);
    } catch {
      return null;
    }
  }

  /**
   * Validate if string is a valid ULID
   */
  static isValidUlid(id: string): boolean {
    // Remove prefix if present
    const ulidPart = id.includes('_') ? id.split('_')[1] : id;
    if (!ulidPart) return false;

    // ULID is 26 characters, base32 encoded
    const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    return ulidRegex.test(ulidPart);
  }

  /**
   * Extract prefix from ID
   * @returns prefix or null if no prefix
   */
  static extractPrefix(id: string): string | null {
    const parts = id.split('_');
    return parts.length > 1 ? parts[0] : null;
  }

  /**
   * Create a batch of IDs
   */
  static generateBatch(count: number, prefix?: IdPrefix | string): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(prefix ? this.generateWithPrefix(prefix) : this.generate());
    }
    return ids;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate a new ULID
 */
export function generateId(): string {
  return IdGenerator.generate();
}

/**
 * Generate a new ID with prefix
 */
export function generateIdWithPrefix(prefix: IdPrefix | string): string {
  return IdGenerator.generateWithPrefix(prefix);
}

/**
 * Generate a migration ID
 */
export function generateMigrationId(): string {
  return IdGenerator.generateWithPrefix('mig');
}

// ============================================================================
// Prefix Constants
// ============================================================================

export const ID_PREFIXES = {
  USER: 'usr',
  PROJECT: 'prj',
  BASE: 'bas',
  APP: 'app',
  PAGE: 'pag',
  FLOW: 'flw',
  FLOW_APP: 'fla',
  SCHEMA: 'sch',
  ORG: 'org',
  MIGRATION: 'mig',
  PROJECT_USER: 'pru',
  ORG_USER: 'oru',
  PUBLISH_STATE: 'pub',
} as const;

export default IdGenerator;
