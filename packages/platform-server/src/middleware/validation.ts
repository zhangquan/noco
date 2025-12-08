/**
 * Request Validation Middleware
 * Uses zod for schema validation
 * @module middleware/validation
 */

import { z, type ZodSchema, type ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError, type ErrorDetails } from '../errors/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export interface ParsedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
> extends Request {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
  validatedParams?: TParams;
}

// ============================================================================
// Validation Middleware Factory
// ============================================================================

/**
 * Create a validation middleware from zod schemas
 */
export function validate<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = req as ParsedRequest<TBody, TQuery, TParams>;

      if (schemas.body) {
        parsed.validatedBody = await schemas.body.parseAsync(req.body) as TBody;
      }

      if (schemas.query) {
        parsed.validatedQuery = await schemas.query.parseAsync(req.query) as TQuery;
      }

      if (schemas.params) {
        parsed.validatedParams = await schemas.params.parseAsync(req.params) as TParams;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodError(error);
        next(new ValidationError('Request validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate only request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return validate<T, unknown, unknown>({ body: schema });
}

/**
 * Validate only query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return validate<unknown, T, unknown>({ query: schema });
}

/**
 * Validate only path parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return validate<unknown, unknown, T>({ params: schema });
}

// ============================================================================
// Error Formatting
// ============================================================================

function formatZodError(error: ZodError): ErrorDetails[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
    ...(issue.code === 'invalid_type' && {
      received: (issue as any).received,
      expected: (issue as any).expected,
    }),
  }));
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

// ID Schemas
export const IdSchema = z.string().min(1, 'ID is required').max(50);
export const UlidSchema = z.string().length(26, 'Invalid ULID format');

// Pagination Schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(25),
  offset: z.coerce.number().int().min(0).optional(),
});

export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const ListQuerySchema = PaginationSchema.merge(SortSchema);

// Common Field Schemas
export const EmailSchema = z.string().email('Invalid email format').toLowerCase();
export const PasswordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const TitleSchema = z.string().min(1, 'Title is required').max(255);
export const DescriptionSchema = z.string().max(5000).optional();

// ============================================================================
// API Validation Schemas
// ============================================================================

// Auth Schemas
export const SignupSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstname: z.string().max(100).optional(),
  lastname: z.string().max(100).optional(),
});

export const SigninSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

export const PasswordResetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: PasswordSchema,
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
});

// Project Schemas
export const CreateProjectSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema,
  prefix: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Prefix must start with a letter and contain only lowercase letters, numbers, and underscores').optional(),
  org_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const UpdateProjectSchema = z.object({
  title: TitleSchema.optional(),
  description: DescriptionSchema,
  color: z.string().max(50).optional(),
  meta: z.record(z.unknown()).optional(),
});

export const ProjectIdParamsSchema = z.object({
  projectId: IdSchema,
});

// User Schemas
export const UpdateProfileSchema = z.object({
  firstname: z.string().max(100).optional(),
  lastname: z.string().max(100).optional(),
});

export const UpdateUserSchema = z.object({
  firstname: z.string().max(100).optional(),
  lastname: z.string().max(100).optional(),
  roles: z.enum(['super', 'org-level-creator', 'org-level-viewer', 'user', 'guest']).optional(),
  email_verified: z.boolean().optional(),
});

export const InviteUserSchema = z.object({
  email: EmailSchema,
  roles: z.enum(['owner', 'creator', 'editor', 'viewer', 'commenter', 'guest']).default('viewer'),
});

// Reorder Schema
export const ReorderSchema = z.object({
  orders: z.array(z.object({
    id: IdSchema,
    order: z.number().int().min(0),
  })),
});

// Page Schemas
export const CreatePageSchema = z.object({
  title: TitleSchema,
  route: z.string().max(255).regex(/^\/[a-z0-9\-\/]*$/, 'Route must start with / and contain only lowercase letters, numbers, and hyphens').optional(),
  group_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const UpdatePageSchema = z.object({
  title: TitleSchema.optional(),
  route: z.string().max(255).optional(),
  order: z.number().int().min(0).optional(),
  group_id: z.string().nullable().optional(),
  fk_schema_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

// Flow Schemas
export const CreateFlowSchema = z.object({
  title: TitleSchema,
  trigger_type: z.enum(['manual', 'schedule', 'webhook', 'record', 'form']).default('manual'),
  group_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const UpdateFlowSchema = z.object({
  title: TitleSchema.optional(),
  trigger_type: z.enum(['manual', 'schedule', 'webhook', 'record', 'form']).optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  group_id: z.string().nullable().optional(),
  fk_schema_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

// Table Schemas
export const CreateTableSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema,
  columns: z.array(z.object({
    title: TitleSchema,
    uidt: z.string().min(1, 'Column type is required'),
    description: DescriptionSchema,
    rqd: z.boolean().optional(),
    default: z.unknown().optional(),
    options: z.record(z.unknown()).optional(),
  })).optional(),
});

export const UpdateTableSchema = z.object({
  title: TitleSchema.optional(),
  description: DescriptionSchema,
  hints: z.record(z.unknown()).optional(),
});

export const CreateColumnSchema = z.object({
  title: TitleSchema,
  uidt: z.string().min(1, 'Column type is required'),
  description: DescriptionSchema,
  rqd: z.boolean().optional(),
  default: z.unknown().optional(),
  options: z.record(z.unknown()).optional(),
});

export const CreateLinkSchema = z.object({
  sourceTableId: IdSchema,
  targetTableId: IdSchema,
  linkColumnTitle: TitleSchema,
  reverseLinkColumnTitle: TitleSchema.optional(),
  type: z.enum(['hm', 'mm', 'bt']).default('hm'),
});

export const ImportSchemaSchema = z.object({
  schema: z.object({
    tables: z.array(z.unknown()),
  }),
  merge: z.boolean().default(false),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SignupInput = z.infer<typeof SignupSchema>;
export type SigninInput = z.infer<typeof SigninSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreatePageInput = z.infer<typeof CreatePageSchema>;
export type UpdatePageInput = z.infer<typeof UpdatePageSchema>;
export type CreateFlowInput = z.infer<typeof CreateFlowSchema>;
export type UpdateFlowInput = z.infer<typeof UpdateFlowSchema>;
export type ListQueryInput = z.infer<typeof ListQuerySchema>;
