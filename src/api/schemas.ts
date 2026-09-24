import { z } from 'zod';

/**
 * Shared API Error Envelope Schema.
 * Every error response from the backend conforms to this structure.
 */
export const ApiErrorEnvelopeSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional()
  })
  .strict();

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

/**
 * Readiness Status Enum
 */
export const ReadinessStatusSchema = z.enum([
  'READY',
  'NEARLY_READY',
  'DEVELOPING',
  'NEEDS_PREPARATION',
  'INCOMPLETE'
]);

/**
 * Competency Schema
 */
export const CompetencySchema = z
  .object({
    id: z.string().uuid().or(z.string().min(1)),
    name: z.string().min(1),
    code: z.string().min(1),
    category: z.string().min(1),
    description: z.string()
  })
  .strict();

/**
 * Attempt Schema
 */
export const AttemptSchema = z
  .object({
    id: z.string().uuid().or(z.string().min(1)),
    competencyId: z.string().min(1),
    studentId: z.string().min(1),
    score: z.number().min(0),
    maxScore: z.number().positive(),
    passed: z.boolean(),
    timestamp: z.string().datetime({ offset: true }).or(z.string().datetime()),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

/**
 * Competency With Latest Attempt Schema (for StudentDetail)
 */
export const CompetencyWithLatestAttemptSchema = z
  .object({
    competency: CompetencySchema,
    latestAttempt: AttemptSchema.nullable(),
    readiness: ReadinessStatusSchema
  })
  .strict();

/**
 * StudentSummary Schema (List View Shape)
 */
export const StudentSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    cohort: z.string().min(1),
    readinessStatus: ReadinessStatusSchema,
    summaryScore: z.number().min(0).max(100),
    completedCompetenciesCount: z.number().int().nonnegative(),
    totalCompetenciesCount: z.number().int().nonnegative(),
    lastActiveAt: z.string().datetime({ offset: true }).or(z.string().datetime())
  })
  .strict();

/**
 * StudentDetail Schema (Detail View Shape)
 * Note: version is strictly REQUIRED for optimistic concurrency.
 */
export const StudentDetailSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    cohort: z.string().min(1),
    readinessStatus: ReadinessStatusSchema,
    summaryScore: z.number().min(0).max(100),
    competencies: z.array(CompetencyWithLatestAttemptSchema),
    version: z.number().int().nonnegative(),
    createdAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    updatedAt: z.string().datetime({ offset: true }).or(z.string().datetime())
  })
  .strict();

/**
 * Pagination Metadata Schema
 */
export const PaginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean()
  })
  .strict();

/**
 * GET /api/students Response Schema
 */
export const StudentsListResponseSchema = z
  .object({
    data: z.array(StudentSummarySchema),
    pagination: PaginationMetaSchema,
    cohortAverageScore: z.number().min(0).max(100)
  })
  .strict();

export type StudentsListResponse = z.infer<typeof StudentsListResponseSchema>;

/**
 * GET /api/students/:id Response Schema
 */
export const StudentDetailResponseSchema = z
  .object({
    data: StudentDetailSchema
  })
  .strict();

export type StudentDetailResponse = z.infer<typeof StudentDetailResponseSchema>;

/**
 * POST /api/students/:id/attempts Response Schema
 */
export const CreateAttemptResponseSchema = z
  .object({
    data: z
      .object({
        attempt: AttemptSchema,
        updatedReadinessStatus: ReadinessStatusSchema,
        updatedSummaryScore: z.number().min(0).max(100),
        newVersion: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict();

export type CreateAttemptResponse = z.infer<typeof CreateAttemptResponseSchema>;

/**
 * PATCH /api/students/:id Response Schema
 */
export const PatchStudentResponseSchema = z
  .object({
    data: StudentDetailSchema
  })
  .strict();

export type PatchStudentResponse = z.infer<typeof PatchStudentResponseSchema>;

/**
 * Activity Event Schema (Mongo-sourced append-only log)
 */
export const ActivityEventSchema = z
  .object({
    id: z.string().min(1),
    studentId: z.string().min(1),
    eventType: z.enum([
      'ATTEMPT_SUBMITTED',
      'READINESS_UPDATED',
      'PROFILE_UPDATED',
      'STATUS_OVERRIDDEN'
    ]),
    payload: z.record(z.string(), z.unknown()),
    actor: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }).or(z.string().datetime())
  })
  .strict();

/**
 * GET /api/students/:id/activity Response Schema
 */
export const StudentActivityResponseSchema = z
  .object({
    data: z.array(ActivityEventSchema),
    pagination: PaginationMetaSchema
  })
  .strict();

export type StudentActivityResponse = z.infer<typeof StudentActivityResponseSchema>;
