import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../setup';
import { StudentsView } from '../../src/routes/students/StudentsView';
import { setApiConfig } from '../../src/api/config';

describe('Cross-Tenant Data Leak & Concurrency Tests', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-A',
      authToken: 'mock-auth-token'
    });
  });

  afterEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-test',
      authToken: 'mock-auth-token'
    });
  });

  it('TENANT SWITCH ISOLATION: in-flight request from tenant-A must NOT leak into tenant-B after fast account switch', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students', async ({ request }) => {
        const tenantHeader = request.headers.get('x-tenant-id');

        if (tenantHeader === 'tenant-A') {
          // Slow response for Tenant A
          await delay(200);
          return HttpResponse.json({
            data: [
              {
                id: 'student-tenant-A',
                name: 'Tenant A Confidential Student',
                email: 'confidential@tenant-a.com',
                cohort: 'Tenant-A-Cohort',
                readinessStatus: 'DEVELOPING',
                summaryScore: 50.0,
                completedCompetenciesCount: 1,
                totalCompetenciesCount: 5,
                lastActiveAt: '2026-09-20T10:00:00.000Z'
              }
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false
            },
            cohortAverageScore: 50.0
          });
        }

        if (tenantHeader === 'tenant-B') {
          // Fast response for Tenant B
          return HttpResponse.json({
            data: [
              {
                id: 'student-tenant-B',
                name: 'Tenant B Public Student',
                email: 'public@tenant-b.com',
                cohort: 'Tenant-B-Cohort',
                readinessStatus: 'READY',
                summaryScore: 90.0,
                completedCompetenciesCount: 5,
                totalCompetenciesCount: 5,
                lastActiveAt: '2026-09-20T10:00:00.000Z'
              }
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false
            },
            cohortAverageScore: 90.0
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

    // 1. Mount view under Tenant A (initiates slow Request A)
    render(
      <MemoryRouter initialEntries={['/students']}>
        <Routes>
          <Route path="/students" element={<StudentsView />} />
        </Routes>
      </MemoryRouter>
    );

    // 2. Fast tenant switch to Tenant B while Request A is still in flight
    await act(async () => {
      await delay(30);
      setApiConfig({ tenantId: 'tenant-B' });
    });

    // 3. Wait for all network operations to settle
    await waitFor(() => {
      expect(screen.getAllByText('Tenant B Public Student').length).toBeGreaterThan(0);
    });

    // CRITICAL SECURITY ASSERTION: Tenant A's confidential data must NEVER be visible under Tenant B session
    expect(screen.queryByText('Tenant A Confidential Student')).toBeNull();
  });

  it('RAPID FLIP FLOP (A -> B -> A): older in-flight request from original tenant cannot win race', async () => {
    let callIndex = 0;

    server.use(
      http.get('https://api.test.example.com/api/students', async ({ request }) => {
        callIndex++;
        const currentCall = callIndex;
        const tenantHeader = request.headers.get('x-tenant-id');

        if (tenantHeader === 'tenant-A' && currentCall === 1) {
          // First Request A: very slow (300ms) with stale data
          await delay(300);
          return HttpResponse.json({
            data: [
              {
                id: 'student-A-stale',
                name: 'Tenant A Stale Record',
                email: 'stale@tenant-a.com',
                cohort: 'A-Cohort',
                readinessStatus: 'DEVELOPING',
                summaryScore: 40.0,
                completedCompetenciesCount: 1,
                totalCompetenciesCount: 5,
                lastActiveAt: '2026-09-20T10:00:00.000Z'
              }
            ],
            pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            cohortAverageScore: 40.0
          });
        }

        if (tenantHeader === 'tenant-B') {
          // Request B: intermediate (150ms)
          await delay(150);
          return HttpResponse.json({
            data: [
              {
                id: 'student-B',
                name: 'Tenant B Intermediate',
                email: 'b@tenant-b.com',
                cohort: 'B-Cohort',
                readinessStatus: 'READY',
                summaryScore: 80.0,
                completedCompetenciesCount: 4,
                totalCompetenciesCount: 5,
                lastActiveAt: '2026-09-20T10:00:00.000Z'
              }
            ],
            pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            cohortAverageScore: 80.0
          });
        }

        if (tenantHeader === 'tenant-A' && currentCall >= 3) {
          // Second Request A: fast (40ms) with fresh data
          await delay(40);
          return HttpResponse.json({
            data: [
              {
                id: 'student-A-fresh',
                name: 'Tenant A Fresh Record',
                email: 'fresh@tenant-a.com',
                cohort: 'A-Cohort',
                readinessStatus: 'READY',
                summaryScore: 95.0,
                completedCompetenciesCount: 5,
                totalCompetenciesCount: 5,
                lastActiveAt: '2026-09-20T10:00:00.000Z'
              }
            ],
            pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            cohortAverageScore: 95.0
          });
        }

        return HttpResponse.json({
          data: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
          cohortAverageScore: 0
        });
      })
    );

    // Initial mount on Tenant A
    render(
      <MemoryRouter initialEntries={['/students']}>
        <Routes>
          <Route path="/students" element={<StudentsView />} />
        </Routes>
      </MemoryRouter>
    );

    // Rapid switch to Tenant B
    await act(async () => {
      await delay(20);
      setApiConfig({ tenantId: 'tenant-B' });
    });

    // Rapid switch back to Tenant A
    await act(async () => {
      await delay(20);
      setApiConfig({ tenantId: 'tenant-A' });
    });

    // Wait for all in-flight requests to finish
    await waitFor(() => {
      expect(screen.getAllByText('Tenant A Fresh Record').length).toBeGreaterThan(0);
    });

    // Ensure neither the older Request 1 (stale Tenant A) nor Request 2 (Tenant B) overwrite state
    expect(screen.queryByText('Tenant A Stale Record')).toBeNull();
    expect(screen.queryByText('Tenant B Intermediate')).toBeNull();
  });
});
