/**
 * Domain types for Student Readiness Control Center
 * Strict typed contract without conflating list and detail shapes.
 */

export type ReadinessStatus =
  | 'READY'
  | 'NEARLY_READY'
  | 'DEVELOPING'
  | 'NEEDS_PREPARATION'
  | 'INCOMPLETE';

export interface Competency {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly category: string;
  readonly description: string;
}

export interface Attempt {
  readonly id: string;
  readonly competencyId: string;
  readonly studentId: string;
  readonly score: number;
  readonly maxScore: number;
  readonly passed: boolean;
  readonly timestamp: string; // ISO 8601 date string
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface CompetencyWithLatestAttempt {
  readonly competency: Competency;
  readonly latestAttempt: Attempt | null;
  readonly readiness: ReadinessStatus;
}

/**
 * StudentSummary: Minimal representation for paginated list views.
 */
export interface StudentSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly cohort: string;
  readonly readinessStatus: ReadinessStatus;
  readonly summaryScore: number; // 0 - 100 aggregate score calculated server-side
  readonly completedCompetenciesCount: number;
  readonly totalCompetenciesCount: number;
  readonly lastActiveAt: string; // ISO 8601
}

/**
 * StudentDetail: Deep representation for detail views.
 * The `version` field is REQUIRED on any updatable entity to support optimistic concurrency.
 */
export interface StudentDetail {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly cohort: string;
  readonly readinessStatus: ReadinessStatus;
  readonly summaryScore: number;
  readonly competencies: readonly CompetencyWithLatestAttempt[];
  readonly version: number; // Required entity version for concurrency control (If-Match)
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Student updatable payload fields for PATCH
 */
export interface StudentPatchInput {
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly cohort?: string | undefined;
}

/**
 * Attempt submission payload for POST /api/students/:id/attempts
 */
export interface CreateAttemptInput {
  readonly competencyId: string;
  readonly score: number;
  readonly maxScore: number;
  readonly passed: boolean;
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Mongo-sourced append-only activity audit log event.
 */
export interface ActivityEvent {
  readonly id: string;
  readonly studentId: string;
  readonly eventType: 'ATTEMPT_SUBMITTED' | 'READINESS_UPDATED' | 'PROFILE_UPDATED' | 'STATUS_OVERRIDDEN';
  readonly payload: Record<string, unknown>;
  readonly actor: string;
  readonly timestamp: string; // ISO 8601
}

/**
 * Pagination metadata contract
 */
export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
}
