/**
 * SQL function mappings
 * @module functions
 */

export type { SqlFn } from './common';
export { commonFunctions } from './common';
export { postgresFunctions } from './postgres';

import { postgresFunctions } from './postgres';

/**
 * Get function by name (case-insensitive)
 */
export function getFunction(name: string) {
  return postgresFunctions[name.toUpperCase()];
}

/**
 * Check if a function exists
 */
export function hasFunction(name: string): boolean {
  return getFunction(name) !== undefined;
}

/**
 * Get all available function names
 */
export function getFunctionNames(): string[] {
  return Object.keys(postgresFunctions);
}
