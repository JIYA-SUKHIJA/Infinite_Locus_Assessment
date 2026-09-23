import { describe, it, expect } from 'vitest';
import {
  StudentSummarySchema,
  StudentDetailSchema,
  StudentsListResponseSchema,
  StudentDetailResponseSchema,
  CreateAttemptResponseSchema,
  PatchStudentResponseSchema,
  StudentActivityResponseSchema,
  ApiErrorEnvelopeSchema
} from '../src/api/schemas';
import { mockStudentSummary, mockStudentDetail } from './mocks/handlers';

describe('API Response Schemas (Runtime Fail-Closed Validation)', () => {
  describe('StudentSummarySchema & StudentsListResponseSchema', () => {
    it('validates a correct student summary list response', () => {
      const validResponse = {
        data: [mockStudentSummary],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        cohortAverageScore: 82.5
      };

      const result = StudentsListResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('FAILS CLOSED on unknown fields in StudentSummary', () => {
      const payloadWithUnknownField = {
        ...mockStudentSummary,
        injectedMaliciousField: 'admin_privileges'
      };

      const result = StudentSummarySchema.safeParse(payloadWithUnknownField);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.code).toBe('unrecognized_keys');
      }
    });

    it('rejects invalid readiness status enum values', () => {
      const invalidStatus = {
        ...mockStudentSummary,
        readinessStatus: 'SUPER_READY' // Invalid enum
      };

      const result = StudentSummarySchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe('StudentDetailSchema & Version Concurrency Requirement', () => {
    it('validates a correct student detail response with required version', () => {
      const validDetailResponse = {
        data: mockStudentDetail
      };

      const result = StudentDetailResponseSchema.safeParse(validDetailResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.version).toBe(4);
      }
    });

    it('FAILS CLOSED when version is missing from StudentDetail', () => {
      const { version: _omitted, ...detailWithoutVersion } = mockStudentDetail;

      const result = StudentDetailSchema.safeParse(detailWithoutVersion);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasVersionIssue = result.error.issues.some((issue) =>
          issue.path.includes('version')
        );
        expect(hasVersionIssue).toBe(true);
      }
    });

    it('FAILS CLOSED on unexpected fields in StudentDetail', () => {
      const detailWithExtra = {
        ...mockStudentDetail,
        backendInternalLeak: { secret: '123' }
      };

      const result = StudentDetailSchema.safeParse(detailWithExtra);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateAttemptResponseSchema', () => {
    it('validates attempt submission response', () => {
      const payload = {
        data: {
          attempt: {
            id: 'att-123',
            competencyId: 'comp-1',
            studentId: 'student-123',
            score: 95,
            maxScore: 100,
            passed: true,
            timestamp: '2026-09-23T12:00:00.000Z'
          },
          updatedReadinessStatus: 'READY',
          updatedSummaryScore: 90,
          newVersion: 5
        }
      };

      const result = CreateAttemptResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects attempt with negative score', () => {
      const invalidPayload = {
        data: {
          attempt: {
            id: 'att-123',
            competencyId: 'comp-1',
            studentId: 'student-123',
            score: -10, // Invalid negative
            maxScore: 100,
            passed: false,
            timestamp: '2026-09-23T12:00:00.000Z'
          },
          updatedReadinessStatus: 'NEEDS_PREPARATION',
          updatedSummaryScore: 10,
          newVersion: 5
        }
      };

      const result = CreateAttemptResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('PatchStudentResponseSchema', () => {
    it('validates successful patch response with updated version', () => {
      const payload = {
        data: {
          ...mockStudentDetail,
          version: 5,
          name: 'Alex Rivera Updated'
        }
      };

      const result = PatchStudentResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('StudentActivityResponseSchema', () => {
    it('validates paginated Mongo-sourced audit log events', () => {
      const payload = {
        data: [
          {
            id: 'act-1',
            studentId: 'student-123',
            eventType: 'READINESS_UPDATED',
            payload: { previous: 'DEVELOPING', current: 'READY' },
            actor: 'system_scoring_worker',
            timestamp: '2026-09-23T12:00:00.000Z'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      };

      const result = StudentActivityResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects unsupported eventType values', () => {
      const payload = {
        data: [
          {
            id: 'act-1',
            studentId: 'student-123',
            eventType: 'INVALID_UNKNOWN_EVENT',
            payload: {},
            actor: 'system',
            timestamp: '2026-09-23T12:00:00.000Z'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      };

      const result = StudentActivityResponseSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ApiErrorEnvelopeSchema', () => {
    it('validates a standard backend error envelope with fieldErrors', () => {
      const errorEnvelope = {
        code: 'VALIDATION_FAILED',
        message: 'Request fields failed validation',
        requestId: 'req_err_987',
        fieldErrors: {
          email: ['Invalid email format'],
          score: ['Score must be positive']
        }
      };

      const result = ApiErrorEnvelopeSchema.safeParse(errorEnvelope);
      expect(result.success).toBe(true);
    });
  });
});
