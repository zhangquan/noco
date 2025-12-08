/**
 * Access Control List (ACL) Type Definitions
 * @module types/acl
 */

import type { ProjectRole } from './enums.js';

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Available operations for ACL
 */
export type AclOperation =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'invite'
  | 'settings';

/**
 * Permission mapping for a single role
 * Allows string indexing for dynamic operation checks
 */
export type AclPermission = Record<AclOperation, boolean> & {
  [key: string]: boolean | undefined;
};

/**
 * ACL configuration for all roles
 */
export type Acl<R extends string = string> = Record<R, AclPermission>;

// ============================================================================
// Project ACL
// ============================================================================

/**
 * Project-level ACL configuration
 */
export const PROJECT_ACL: Acl<ProjectRole> = {
  owner: {
    read: true,
    create: true,
    update: true,
    delete: true,
    publish: true,
    invite: true,
    settings: true,
  },
  creator: {
    read: true,
    create: true,
    update: true,
    delete: true,
    publish: true,
    invite: false,
    settings: false,
  },
  editor: {
    read: true,
    create: true,
    update: true,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
  viewer: {
    read: true,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
  commenter: {
    read: true,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
  guest: {
    read: true,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
} as const;

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: ProjectRole,
  operation: AclOperation
): boolean {
  return PROJECT_ACL[role]?.[operation] ?? false;
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: ProjectRole): AclPermission {
  return PROJECT_ACL[role] ?? {
    read: false,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  };
}

/**
 * Check if role can perform any write operation
 */
export function canWrite(role: ProjectRole): boolean {
  const perms = PROJECT_ACL[role];
  return perms?.create || perms?.update || perms?.delete || false;
}

/**
 * Check if role is at least as privileged as the target role
 */
export function isRoleAtLeast(role: ProjectRole, target: ProjectRole): boolean {
  const roleOrder: ProjectRole[] = ['owner', 'creator', 'editor', 'commenter', 'viewer', 'guest'];
  const roleIndex = roleOrder.indexOf(role);
  const targetIndex = roleOrder.indexOf(target);
  return roleIndex !== -1 && targetIndex !== -1 && roleIndex <= targetIndex;
}
