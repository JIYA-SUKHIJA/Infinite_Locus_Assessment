import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from './setup';
import {
  useStudents,
  useStudentDetail,
  usePatchStudent,
  useSubmitAttempt,
  useStudentActivity
} from '../src/api/hooks';
import { setApiConfig } from '../src/api/config';
import { mockStudentSummary } from './mocks/handlers';

describe('API Hooks (Out-of-Order Race Protection & Discriminated Union States)', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-test-hooks',
      authToken: 'mock-auth-token'
    });
  });

  describe('useStudents - Out-of-Order Response Protection', () => {
    it('initializes in loading then settles to success', async () => {
      const { result } = renderHook(() => useStudents({ page: 1 }));

      expect(result.current.status).toBe('loading');

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      if (result.current.status === 'success') {
        expect(result.current.data.data.length).toBeGreaterThan(0);
        expect(result.current.data.data[0]?.name).toBe('Alex Rivera');
      }
    });

    it('PREVENTS RACE CONDITIONS: supersedes slow in-flight request with fast subsequent request', async () => {
      server.use(
        http.get('https://api.test.example.com/api/students', async ({ request }) => {
          const url = new URL(request.url);
          const page = url.searchParams.get('page');

          if (page === '1') {
            // First slow request takes 120ms
            await delay(120);
            return HttpResponse.json({
              data: [{ ...mockStudentSummary, name: 'Slow Page 1 Student' }],
              pagination: {
                page: 1,
                pageSize: 20,
                totalItems: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
              },
              cohortAverageScore: 50
            });
          }

          if (page === '2') {
            // Second fast request takes 20ms
            await delay(20);
            return HttpResponse.json({
              data: [{ ...mockStudentSummary, name: 'Fast Page 2 Student' }],
              pagination: {
                page: 2,
                pageSize: 20,
                totalItems: 1,
                totalPages: 2,
                hasNextPage: false,
                hasPrevPage: true
              },
              cohortAverageScore: 90
            });
          }

          return HttpResponse.json({
            data: [],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false
            },
            cohortAverageScore: 0
          });
        })
      );

      let currentParams = { page: 1 };
      const { result, rerender } = renderHook((props: { page: number }) => useStudents(props), {
        initialProps: currentParams
      });

      // Immediately trigger page 2 before page 1 resolves
      currentParams = { page: 2 };
      rerender(currentParams);

      // Wait for page 2 to resolve and verify page 1 slow response did not overwrite state
      await waitFor(() => {
        expect(result.current.status).toBe('success');
        if (result.current.status === 'success') {
          expect(result.current.data.data[0]?.name).toBe('Fast Page 2 Student');
        }
      });

      // Wait past slow request duration to ensure page 1 doesn't overwrite
      await new Promise((r) => setTimeout(r, 150));

      expect(result.current.status).toBe('success');
      if (result.current.status === 'success') {
        expect(result.current.data.data[0]?.name).toBe('Fast Page 2 Student');
      }
    });
  });

  describe('useStudentDetail', () => {
    it('stays in idle status when id is null/undefined', () => {
      const { result } = renderHook(() => useStudentDetail(null));
      expect(result.current.status).toBe('idle');
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('fetches student detail and returns required version', async () => {
      const { result } = renderHook(() => useStudentDetail('student-123'));

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      if (result.current.status === 'success') {
        expect(result.current.data.data.id).toBe('student-123');
        expect(result.current.data.data.version).toBe(4);
        expect(result.current.data.data.competencies.length).toBe(1);
      }
    });

    it('handles 404 error cleanly without impossible states', async () => {
      const { result } = renderHook(() => useStudentDetail('not-found'));

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      if (result.current.status === 'error') {
        expect(result.current.data).toBeNull();
        expect(result.current.error.status).toBe(404);
        expect(result.current.error.code).toBe('STUDENT_NOT_FOUND');
      }
    });
  });

  describe('usePatchStudent - Optimistic Concurrency & 409 Conflict Handling', () => {
    it('successfully patches student when expectedVersion matches', async () => {
      const { result } = renderHook(() => usePatchStudent());

      expect(result.current.status).toBe('idle');

      let updatedData = null;
      await act(async () => {
        updatedData = await result.current.patchStudent(
          'student-123',
          { name: 'Alex Rivera Modified' },
          { expectedVersion: 4 }
        );
      });

      expect(result.current.status).toBe('success');
      if (result.current.status === 'success') {
        expect(result.current.data.name).toBe('Alex Rivera Modified');
        expect(result.current.data.version).toBe(5);
      }
      expect(updatedData).not.toBeNull();
    });

    it('surfaces 409 CONFLICT as a distinct discriminated union state', async () => {
      const { result } = renderHook(() => usePatchStudent());

      await act(async () => {
        await result.current.patchStudent(
          'student-123',
          { name: 'Alex Rivera Stale' },
          { expectedVersion: 2 } // Mock current version is 4, so 2 causes 409
        );
      });

      expect(result.current.status).toBe('conflict');
      if (result.current.status === 'conflict') {
        expect(result.current.data).toBeNull();
        expect(result.current.error.status).toBe(409);
        expect(result.current.error.isConflict()).toBe(true);
        expect(result.current.message).toContain('Conflict');
      }
    });
  });

  describe('useSubmitAttempt - Idempotency Enforcement', () => {
    it('submits attempt and returns updated readiness and summary score', async () => {
      const { result } = renderHook(() => useSubmitAttempt());

      await act(async () => {
        await result.current.submitAttempt('student-123', {
          competencyId: 'comp-1',
          score: 95,
          maxScore: 100,
          passed: true
        });
      });

      expect(result.current.status).toBe('success');
      if (result.current.status === 'success') {
        expect(result.current.data.attempt.score).toBe(95);
        expect(result.current.data.updatedReadinessStatus).toBe('READY');
        expect(result.current.data.newVersion).toBe(5);
      }
    });
  });

  describe('useStudentActivity', () => {
    it('fetches paginated Mongo activity log events', async () => {
      const { result } = renderHook(() => useStudentActivity('student-123'));

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      if (result.current.status === 'success') {
        expect(result.current.data.data.length).toBe(1);
        expect(result.current.data.data[0]?.eventType).toBe('ATTEMPT_SUBMITTED');
      }
    });
  });
});
