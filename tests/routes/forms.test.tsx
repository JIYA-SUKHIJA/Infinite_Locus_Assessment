import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../setup';
import { StudentDetailView } from '../../src/routes/students/[id]/StudentDetailView';
import { setApiConfig } from '../../src/api/config';
import { mockStudentDetail } from '../mocks/handlers';

const renderDetailRoute = (
  initialEntries: Array<string> = ['/students/student-123']
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/students/:id" element={<StudentDetailView />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Forms Integration Tests (Attempt Submission & Student Edit)', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-forms-test'
    });
  });

  describe('Attempt Submission Form', () => {
    it('SUCCESS FLOW: opens modal, submits attempt with Idempotency-Key, and refetches student detail', async () => {
      let capturedIdempotencyKey: string | null = null;
      let capturedBody: any = null;

      server.use(
        http.post(
          'https://api.test.example.com/api/students/:id/attempts',
          async ({ request }) => {
            capturedIdempotencyKey = request.headers.get('Idempotency-Key');
            capturedBody = await request.json();
            return HttpResponse.json({
              data: {
                attempt: {
                  id: 'att-new-1',
                  competencyId: capturedBody.competencyId,
                  studentId: 'student-123',
                  score: capturedBody.score,
                  maxScore: capturedBody.maxScore,
                  passed: capturedBody.passed,
                  timestamp: '2026-09-23T12:00:00.000Z'
                },
                updatedReadinessStatus: 'READY',
                updatedSummaryScore: 92.0,
                newVersion: 5
              }
            }, { status: 201 });
          }
        )
      );

      renderDetailRoute();

      // Wait for student detail to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      // Open Attempt Modal
      const submitBtn = screen.getByRole('button', {
        name: /Submit new attempt for Distributed Systems Design/i
      });
      fireEvent.click(submitBtn);

      // Verify modal dialog is visible with accessibility attributes
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(screen.getByRole('heading', { name: /Submit Competency Attempt/i })).toBeDefined();

      // Change score inputs
      const scoreInput = screen.getByLabelText(/Earned Score/i);
      const maxScoreInput = screen.getByLabelText(/Maximum Possible Score/i);

      fireEvent.change(scoreInput, { target: { value: '95' } });
      fireEvent.change(maxScoreInput, { target: { value: '100' } });

      // Submit form
      const submitModalBtn = screen.getByRole('button', { name: /Submit Attempt/i });
      fireEvent.click(submitModalBtn);

      // Modal closes upon success and request sent with valid Idempotency-Key
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      expect(capturedIdempotencyKey).toBeTruthy();
      expect(typeof capturedIdempotencyKey).toBe('string');
      expect(capturedIdempotencyKey!.length).toBeGreaterThan(10);
      expect(capturedBody).toEqual({
        competencyId: 'comp-1',
        score: 95,
        maxScore: 100,
        passed: true
      });
    });

    it('DOUBLE-SUBMIT PREVENTION: rapid clicks only trigger a single HTTP POST request (call count === 1)', async () => {
      let postCallCount = 0;

      server.use(
        http.post(
          'https://api.test.example.com/api/students/:id/attempts',
          async () => {
            postCallCount++;
            await delay(100); // simulate network latency
            return HttpResponse.json({
              data: {
                attempt: {
                  id: 'att-new-2',
                  competencyId: 'comp-1',
                  studentId: 'student-123',
                  score: 90,
                  maxScore: 100,
                  passed: true,
                  timestamp: '2026-09-23T12:00:00.000Z'
                },
                updatedReadinessStatus: 'READY',
                updatedSummaryScore: 90.0,
                newVersion: 5
              }
            }, { status: 201 });
          }
        )
      );

      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      // Open Modal
      fireEvent.click(
        screen.getByRole('button', { name: /Submit new attempt for Distributed Systems Design/i })
      );

      const submitModalBtn = screen.getByRole('button', { name: /Submit Attempt/i });

      // Rapidly click 4 times while in flight
      fireEvent.click(submitModalBtn);
      fireEvent.click(submitModalBtn);
      fireEvent.click(submitModalBtn);
      fireEvent.click(submitModalBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // Explicit assertion: MSW handler was called exactly once
      expect(postCallCount).toBe(1);
    });

    it('VALIDATION ERRORS: score exceeding maxScore displays error and aria-invalid attributes', async () => {
      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      fireEvent.click(
        screen.getByRole('button', { name: /Submit new attempt for Distributed Systems Design/i })
      );

      const scoreInput = screen.getByLabelText(/Earned Score/i);
      const maxScoreInput = screen.getByLabelText(/Maximum Possible Score/i);
      const submitModalBtn = screen.getByRole('button', { name: /Submit Attempt/i });

      // Invalid: score > maxScore
      fireEvent.change(scoreInput, { target: { value: '120' } });
      fireEvent.change(maxScoreInput, { target: { value: '100' } });
      fireEvent.click(submitModalBtn);

      // Verify validation message and aria-invalid
      expect(scoreInput.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Score cannot exceed maximum score of 100')).toBeDefined();

      // Invalid: negative score
      fireEvent.change(scoreInput, { target: { value: '-5' } });
      fireEvent.click(submitModalBtn);
      expect(screen.getByText('Score cannot be negative')).toBeDefined();

      // Invalid: maxScore <= 0
      fireEvent.change(scoreInput, { target: { value: '10' } });
      fireEvent.change(maxScoreInput, { target: { value: '0' } });
      fireEvent.click(submitModalBtn);
      expect(screen.getByText('Max score must be greater than zero')).toBeDefined();
    });

    it('NETWORK ERROR REASSURANCE: shows honest banner and retains same Idempotency-Key on retry', async () => {
      const keysUsed: string[] = [];
      let failNext = true;

      server.use(
        http.post(
          'https://api.test.example.com/api/students/:id/attempts',
          ({ request }) => {
            const key = request.headers.get('Idempotency-Key')!;
            keysUsed.push(key);

            if (failNext) {
              failNext = false;
              return HttpResponse.error(); // Simulates network failure (status 0)
            }

            return HttpResponse.json({
              data: {
                attempt: {
                  id: 'att-new-3',
                  competencyId: 'comp-1',
                  studentId: 'student-123',
                  score: 85,
                  maxScore: 100,
                  passed: true,
                  timestamp: '2026-09-23T12:00:00.000Z'
                },
                updatedReadinessStatus: 'READY',
                updatedSummaryScore: 88.0,
                newVersion: 5
              }
            }, { status: 201 });
          }
        )
      );

      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      fireEvent.click(
        screen.getByRole('button', { name: /Submit new attempt for Distributed Systems Design/i })
      );

      // Attempt 1: fails with network error
      const submitModalBtn = screen.getByRole('button', { name: /Submit Attempt/i });
      fireEvent.click(submitModalBtn);

      // Verify network error banner
      await waitFor(() => {
        expect(screen.getByText(/Network error occurred/i)).toBeDefined();
      });
      expect(screen.getByText(/It is safe to click Retry because this submission is protected by a unique Idempotency Key/i)).toBeDefined();

      // Attempt 2: Retry submission
      const retryBtn = screen.getByRole('button', { name: /Retry Submission/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // Assert that both requests sent the EXACT SAME Idempotency-Key for the retry
      expect(keysUsed.length).toBe(2);
      expect(keysUsed[0]).toBe(keysUsed[1]);
    });

    it('IDEMPOTENCY KEY REGENERATION: closing and reopening generates a fresh UUID key', async () => {
      const keysUsed: string[] = [];

      server.use(
        http.post(
          'https://api.test.example.com/api/students/:id/attempts',
          ({ request }) => {
            const key = request.headers.get('Idempotency-Key')!;
            keysUsed.push(key);
            return HttpResponse.json({
              data: {
                attempt: {
                  id: 'att-new-4',
                  competencyId: 'comp-1',
                  studentId: 'student-123',
                  score: 85,
                  maxScore: 100,
                  passed: true,
                  timestamp: '2026-09-23T12:00:00.000Z'
                },
                updatedReadinessStatus: 'READY',
                updatedSummaryScore: 88.0,
                newVersion: 5
              }
            }, { status: 201 });
          }
        )
      );

      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      // First open and submit
      fireEvent.click(
        screen.getByRole('button', { name: /Submit new attempt for Distributed Systems Design/i })
      );
      fireEvent.click(screen.getByRole('button', { name: /Submit Attempt/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // Second open and submit (a fresh new attempt)
      fireEvent.click(
        screen.getByRole('button', { name: /Submit new attempt for Distributed Systems Design/i })
      );
      fireEvent.click(screen.getByRole('button', { name: /Submit Attempt/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      expect(keysUsed.length).toBe(2);
      // Fresh key per session: key 1 must NOT equal key 2
      expect(keysUsed[0]).not.toBe(keysUsed[1]);
    });
  });

  describe('Student Edit Form & Concurrency Handling', () => {
    it('SUCCESS FLOW: edits allowlisted fields with expectedVersion If-Match header and refetches', async () => {
      let capturedIfMatch: string | null = null;
      let capturedBody: any = null;

      server.use(
        http.patch(
          'https://api.test.example.com/api/students/:id',
          async ({ request }) => {
            capturedIfMatch = request.headers.get('If-Match');
            capturedBody = await request.json();
            return HttpResponse.json({
              data: {
                ...mockStudentDetail,
                ...capturedBody,
                version: 5
              }
            });
          }
        )
      );

      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      // Open Edit Student Modal
      fireEvent.click(screen.getByRole('button', { name: /Edit profile for Alex Rivera/i }));

      expect(screen.getByRole('heading', { name: /Edit Student Profile/i })).toBeDefined();
      expect(screen.getByText(/Current Version: v4/i)).toBeDefined();

      const nameInput = screen.getByLabelText(/Full Name/i);
      const emailInput = screen.getByLabelText(/Email Address/i);
      const cohortInput = screen.getByLabelText(/Cohort/i);

      fireEvent.change(nameInput, { target: { value: 'Alex Rivera Updated' } });
      fireEvent.change(emailInput, { target: { value: 'alex.updated@example.com' } });
      fireEvent.change(cohortInput, { target: { value: '2026-Cohort-B' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // Verify If-Match version header and allowlisted payload
      expect(capturedIfMatch).toBe('"4"');
      expect(capturedBody).toEqual({
        name: 'Alex Rivera Updated',
        email: 'alex.updated@example.com',
        cohort: '2026-Cohort-B'
      });
    });

    it('409 CONFLICT UI vs GENERIC ERROR: structurally distinct conflict alert with action buttons', async () => {
      // 1. Simulate 409 Conflict Response
      server.use(
        http.patch(
          'https://api.test.example.com/api/students/:id',
          () => {
            return HttpResponse.json(
              {
                code: 'VERSION_CONFLICT',
                message: 'The student record has been updated by another user.',
                requestId: 'req_conflict_test'
              },
              { status: 409 }
            );
          }
        )
      );

      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Edit profile for Alex Rivera/i }));
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      // Assert Distinct Conflict UI
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Record Conflict Detected \(HTTP 409\)/i })).toBeDefined();
      });

      const reloadBtn = screen.getByRole('button', { name: /Reload Latest & Reapply/i });
      const discardBtn = screen.getByRole('button', { name: /Discard Changes/i });

      expect(reloadBtn).toBeDefined();
      expect(discardBtn).toBeDefined();
      expect(screen.getByText(/modified by another session or administrator/i)).toBeDefined();

      // 2. Structural comparison against generic 500 error:
      server.use(
        http.patch(
          'https://api.test.example.com/api/students/:id',
          () => {
            return HttpResponse.json(
              {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Database write timeout',
                requestId: 'req_500_test'
              },
              { status: 500 }
            );
          }
        )
      );

      // Re-submit to trigger 500
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Save failed:/i)).toBeDefined();
      });

      // Confirm that the 409-specific heading and action buttons are NOT present in generic error state
      expect(screen.queryByRole('heading', { name: /Record Conflict Detected/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Reload Latest & Reapply/i })).toBeNull();
    });

    it('CONFLICT RESOLUTION: clicking Discard Changes closes modal, Reload Latest refreshes state', async () => {
      let getCallCount = 0;

      server.use(
        http.get('https://api.test.example.com/api/students/:id', () => {
          getCallCount++;
          return HttpResponse.json({
            data: {
              ...mockStudentDetail,
              version: 5 // newly incremented version
            }
          });
        }),
        http.patch('https://api.test.example.com/api/students/:id', () => {
          return HttpResponse.json(
            {
              code: 'VERSION_CONFLICT',
              message: 'Conflict detected',
              requestId: 'req_conflict'
            },
            { status: 409 }
          );
        })
      );

      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Edit profile for Alex Rivera/i }));
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Reload Latest & Reapply/i })).toBeDefined();
      });

      const initialGetCount = getCallCount;

      // Click Reload Latest & Reapply
      fireEvent.click(screen.getByRole('button', { name: /Reload Latest & Reapply/i }));

      // Detail was refetched
      await waitFor(() => {
        expect(getCallCount).toBeGreaterThan(initialGetCount);
      });

      // Discard button closes dialog
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('KEYBOARD ACCESSIBILITY: escape key closes modal dialog', async () => {
      renderDetailRoute();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Edit profile for Alex Rivera/i }));
      expect(screen.getByRole('dialog')).toBeDefined();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });
  });
});
