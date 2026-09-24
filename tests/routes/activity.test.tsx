import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { StudentDetailView } from '../../src/routes/students/[id]/StudentDetailView';
import { setApiConfig } from '../../src/api/config';

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

describe('Activity Log Integration Tests', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-activity-test'
    });
  });

  it('SUCCESS STATE: renders all typed activity events with safe metadata rendering (no raw JSON)', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students/:id/activity', () => {
        return HttpResponse.json({
          data: [
            {
              id: 'event-1',
              studentId: 'student-123',
              eventType: 'ATTEMPT_SUBMITTED',
              payload: { score: 95, maxScore: 100, passed: true, competencyId: 'CS-401' },
              actor: 'evaluator-1',
              timestamp: '2026-09-23T10:00:00.000Z'
            },
            {
              id: 'event-2',
              studentId: 'student-123',
              eventType: 'READINESS_UPDATED',
              payload: { previousStatus: 'DEVELOPING', status: 'READY' },
              actor: 'system-evaluator',
              timestamp: '2026-09-23T10:05:00.000Z'
            },
            {
              id: 'event-3',
              studentId: 'student-123',
              eventType: 'PROFILE_UPDATED',
              payload: { changedFields: ['name', 'cohort'] },
              actor: 'admin-user',
              timestamp: '2026-09-23T11:00:00.000Z'
            },
            {
              id: 'event-4',
              studentId: 'student-123',
              eventType: 'STATUS_OVERRIDDEN',
              payload: { reason: 'Exceptional portfolio review' },
              actor: 'lead-instructor',
              timestamp: '2026-09-23T12:00:00.000Z'
            }
          ],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 4,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      })
    );

    renderDetailRoute();

    // Wait for activity events to settle in DOM
    await waitFor(() => {
      expect(screen.getByText(/Competency Attempt Recorded/i)).toBeDefined();
    });

    // Verify Activity Section
    expect(screen.getByRole('heading', { name: /Activity & Audit Log/i })).toBeDefined();

    // Verify Attempt Submitted event
    expect(screen.getByText(/Competency Attempt Recorded/i)).toBeDefined();
    expect(screen.getByText(/Score:/i)).toBeDefined();
    expect(screen.getByText(/95 \/ 100/i)).toBeDefined();
    expect(screen.getByText(/\(Passed\)/i)).toBeDefined();
    expect(screen.getByText(/Logged by: evaluator-1/i)).toBeDefined();

    // Verify Readiness Updated event
    expect(screen.getByText(/Readiness Evaluation Updated/i)).toBeDefined();
    expect(screen.getByText(/From: DEVELOPING →/i)).toBeDefined();

    // Verify Profile Updated event
    expect(screen.getByText(/Student Profile Edited/i)).toBeDefined();
    expect(screen.getByText(/Modified attributes: name, cohort/i)).toBeDefined();

    // Verify Status Overridden event
    expect(screen.getByText(/Readiness Status Overridden/i)).toBeDefined();
    expect(screen.getByText(/Exceptional portfolio review/i)).toBeDefined();
    expect(screen.getByText(/Authorized by: lead-instructor/i)).toBeDefined();

    // CRITICAL: Ensure raw JSON blobs are NOT dumped into the DOM
    expect(screen.queryByText(/\{"score":95/)).toBeNull();
  });

  it('EMPTY STATE: renders clean empty message when student has no audit events', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students/:id/activity', () => {
        return HttpResponse.json({
          data: [],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      })
    );

    renderDetailRoute();

    await waitFor(() => {
      expect(
        screen.getByText('No audit activity recorded for this student yet.')
      ).toBeDefined();
    });
  });

  it('BOUNDED PAGINATION: navigates across pages and respects boundary disabled states', async () => {
    let requestedPage = 1;

    server.use(
      http.get('https://api.test.example.com/api/students/:id/activity', ({ request }) => {
        const url = new URL(request.url);
        requestedPage = parseInt(url.searchParams.get('page') || '1', 10);

        return HttpResponse.json({
          data: [
            {
              id: `event-page-${requestedPage}`,
              studentId: 'student-123',
              eventType: 'ATTEMPT_SUBMITTED',
              payload: { score: 80, maxScore: 100, passed: true },
              actor: 'system',
              timestamp: '2026-09-23T12:00:00.000Z'
            }
          ],
          pagination: {
            page: requestedPage,
            pageSize: 10,
            totalItems: 25,
            totalPages: 3,
            hasNextPage: requestedPage < 3,
            hasPrevPage: requestedPage > 1
          }
        });
      })
    );

    renderDetailRoute();

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 3 \(25 events\)/i)).toBeDefined();
    });

    // Boundary on page 1: prev button is disabled
    expect((screen.getByRole('button', { name: /Previous activity page/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Next activity page/i }) as HTMLButtonElement).disabled).toBe(false);

    // Click Next -> Page 2
    fireEvent.click(screen.getByRole('button', { name: /Next activity page/i }));

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 3 \(25 events\)/i)).toBeDefined();
    });

    expect((screen.getByRole('button', { name: /Previous activity page/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /Next activity page/i }) as HTMLButtonElement).disabled).toBe(false);

    // Click Next -> Page 3 (last page boundary)
    fireEvent.click(screen.getByRole('button', { name: /Next activity page/i }));

    await waitFor(() => {
      expect(screen.getByText(/Page 3 of 3 \(25 events\)/i)).toBeDefined();
    });

    expect((screen.getByRole('button', { name: /Previous activity page/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /Next activity page/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ERROR & RETRY STATE: renders error alert and allows manual retry', async () => {
    let failFirst = true;

    server.use(
      http.get('https://api.test.example.com/api/students/:id/activity', () => {
        if (failFirst) {
          failFirst = false;
          return HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: 'Activity stream connection failed', requestId: 'req_act_err' },
            { status: 500 }
          );
        }
        return HttpResponse.json({
          data: [
            {
              id: 'event-recovered',
              studentId: 'student-123',
              eventType: 'PROFILE_UPDATED',
              payload: { changedFields: ['email'] },
              actor: 'admin',
              timestamp: '2026-09-23T12:00:00.000Z'
            }
          ],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      })
    );

    renderDetailRoute();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load activity log:/i)).toBeDefined();
    });

    // Click Retry
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Modified attributes: email/i)).toBeDefined();
    });
  });
});
