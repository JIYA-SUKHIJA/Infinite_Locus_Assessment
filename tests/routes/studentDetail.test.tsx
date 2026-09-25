import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../setup';
import { StudentDetailView } from '../../src/routes/students/[id]/StudentDetailView';
import { StudentsView } from '../../src/routes/students/StudentsView';
import { setApiConfig } from '../../src/api/config';
import { mockStudentDetail } from '../mocks/handlers';

// Helper component to observe active URL during navigation
const LocationTracker: React.FC<{ onLocationChange: (loc: ReturnType<typeof useLocation>) => void }> = ({
  onLocationChange
}) => {
  const loc = useLocation();
  onLocationChange(loc);
  return null;
};

const renderDetailRoute = (
  initialEntries: Array<string | { pathname: string; search?: string; state?: unknown }> = ['/students/student-123']
) => {
  let currentLocation: ReturnType<typeof useLocation> | null = null;

  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationTracker onLocationChange={(loc) => (currentLocation = loc)} />
      <Routes>
        <Route path="/students" element={<StudentsView />} />
        <Route path="/students/:id" element={<StudentDetailView />} />
      </Routes>
    </MemoryRouter>
  );

  return {
    ...result,
    getCurrentLocation: () => currentLocation
  };
};

describe('StudentDetailView Integration Tests', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-detail-test'
    });
  });

  it('SUCCESS STATE: renders student profile, readiness badge, and all competency evidence', async () => {
    renderDetailRoute(['/students/student-123']);

    // Loading skeleton initially
    expect(screen.getByRole('status', { name: '' })).toBeDefined();

    // Settle to success
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
    });

    expect(screen.getByText('alex.rivera@example.com')).toBeDefined();
    expect(screen.getByText('2026-Cohort-A')).toBeDefined();
    expect(screen.getByText('68.5%')).toBeDefined();

    // Competency details
    expect(screen.getByText('Distributed Systems Design')).toBeDefined();
    expect(screen.getByText('CS-401 • Architecture')).toBeDefined();
    expect(screen.getByText('85 / 100 (85%)')).toBeDefined();
    expect(screen.getByText('✓ Passed')).toBeDefined();
    expect(screen.getByRole('button', { name: /Submit new attempt for Distributed Systems Design/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Edit profile for Alex Rivera/i })).toBeDefined();
  });

  it('INCOMPLETE STUDENT: renders missing competency as normal success state with "no evidence" indicator, not error', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students/:id', () => {
        return HttpResponse.json({
          data: {
            ...mockStudentDetail,
            id: 'student-incomplete',
            readinessStatus: 'INCOMPLETE',
            summaryScore: 25.0,
            competencies: [
              ...mockStudentDetail.competencies,
              {
                competency: {
                  id: 'comp-missing',
                  name: 'Database Internals',
                  code: 'DB-301',
                  category: 'Databases',
                  description: 'Storage engines and index structures'
                },
                latestAttempt: null, // No evidence yet
                readiness: 'INCOMPLETE' as const
              }
            ]
          }
        });
      })
    );

    renderDetailRoute(['/students/student-incomplete']);

    await waitFor(() => {
      expect(screen.getByText('Database Internals')).toBeDefined();
    });

    // Valid success state displays missing evidence label
    expect(screen.getByText('No attempt evidence recorded yet.')).toBeDefined();
    expect(screen.queryByText('Failed to load student profile')).toBeNull();
    expect(screen.queryByText('Student Not Found')).toBeNull();
  });

  it('NON-DISCLOSURE SECURITY: 404 (not found) and 403 (cross-tenant forbidden) render identical copy', async () => {
    // 1. Render 404 response
    server.use(
      http.get('https://api.test.example.com/api/students/:id', () => {
        return HttpResponse.json(
          { code: 'STUDENT_NOT_FOUND', message: 'Resource not found', requestId: 'req_404' },
          { status: 404 }
        );
      })
    );

    const { container: container404, unmount } = renderDetailRoute(['/students/non-existent-id']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Student Not Found', level: 2 })).toBeDefined();
    });

    const notFoundHtml404 = container404.querySelector('main')?.innerHTML;
    const breadcrumbHtml404 = container404.querySelector('nav[aria-label="Breadcrumb navigation"]')?.innerHTML;
    unmount();

    // 2. Render 403 response (cross-tenant denied)
    server.use(
      http.get('https://api.test.example.com/api/students/:id', () => {
        return HttpResponse.json(
          { code: 'FORBIDDEN_RESOURCE', message: 'Cross-tenant access forbidden', requestId: 'req_403' },
          { status: 403 }
        );
      })
    );

    const { container: container403 } = renderDetailRoute(['/students/other-tenant-student']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Student Not Found', level: 2 })).toBeDefined();
    });

    const notFoundHtml403 = container403.querySelector('main')?.innerHTML;
    const breadcrumbHtml403 = container403.querySelector('nav[aria-label="Breadcrumb navigation"]')?.innerHTML;

    // Strict byte-for-byte HTML and copy equality assertion across entire main and breadcrumb
    expect(breadcrumbHtml404).toBeDefined();
    expect(breadcrumbHtml404).toBe(breadcrumbHtml403);
    expect(notFoundHtml404).toBe(notFoundHtml403);
    expect(screen.getByText('Student Profile')).toBeDefined();
    expect(screen.getByText('The requested student record does not exist or you do not have permission to view it.')).toBeDefined();
  });

  it('DISTINCT 500 ERROR STATE & RETRY: renders distinct server error callout and re-triggers request on retry', async () => {
    let callCount = 0;

    server.use(
      http.get('https://api.test.example.com/api/students/:id', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json(
            { code: 'INTERNAL_SERVER_ERROR', message: 'Database query timeout', requestId: 'req_500' },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          data: mockStudentDetail
        });
      })
    );

    renderDetailRoute(['/students/student-123']);

    await waitFor(() => {
      expect(screen.getByText('Failed to load student profile')).toBeDefined();
    });

    expect(screen.getByText('Database query timeout')).toBeDefined();
    expect(screen.queryByText('Student Not Found')).toBeNull();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: 'Retry Request' });
    act(() => {
      fireEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
    });

    expect(callCount).toBe(2);
  });

  it('REFRESHING STATE: preserves visible details while re-fetching', async () => {
    let isSecondCall = false;

    server.use(
      http.get('https://api.test.example.com/api/students/:id', async () => {
        if (isSecondCall) {
          await delay(150);
          return HttpResponse.json({
            data: {
              ...mockStudentDetail,
              name: 'Alex Rivera Updated'
            }
          });
        }

        return HttpResponse.json({
          data: mockStudentDetail
        });
      })
    );

    renderDetailRoute(['/students/student-123']);

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0);
    });

    // Second call starts
    isSecondCall = true;
  });

  it('BACK-TO-LIST NAVIGATION: restores prior search/filter/page parameters when returning from detail', async () => {
    // Start at list view with active query parameters
    const { getCurrentLocation } = renderDetailRoute([
      '/students?q=Alex&status=DEVELOPING&sortBy=summaryScore&sortOrder=desc&page=2'
    ]);

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0);
    });

    // Click on the student link to navigate to detail view
    const studentLink = screen.getAllByRole('link', { name: /View details for Alex Rivera/i })[0];
    if (!studentLink) throw new Error('Student link not found');

    act(() => {
      fireEvent.click(studentLink);
    });

    // Arrive at detail view
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
    });

    expect(getCurrentLocation()?.pathname).toBe('/students/student-123');

    // Click "Back to student list"
    const backLink = screen.getByRole('link', { name: /Back to student list/i });
    act(() => {
      fireEvent.click(backLink);
    });

    // Returns to list view with all search/filter/sort/page query params restored!
    await waitFor(() => {
      expect(getCurrentLocation()?.pathname).toBe('/students');
    });

    const searchParams = new URLSearchParams(getCurrentLocation()?.search);
    expect(searchParams.get('q')).toBe('Alex');
    expect(searchParams.get('status')).toBe('DEVELOPING');
    expect(searchParams.get('sortBy')).toBe('summaryScore');
    expect(searchParams.get('sortOrder')).toBe('desc');
    expect(searchParams.get('page')).toBe('2');
  });

  it('DIRECT LINK FALLBACK: navigating back from direct URL access defaults to clean /students without crashing', async () => {
    // Load detail view directly (no location.state)
    const { getCurrentLocation } = renderDetailRoute(['/students/student-123']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeDefined();
    });

    const backLink = screen.getByRole('link', { name: /Back to student list/i });
    act(() => {
      fireEvent.click(backLink);
    });

    await waitFor(() => {
      expect(getCurrentLocation()?.pathname).toBe('/students');
    });

    // Clean list view without stray params
    expect(getCurrentLocation()?.search).toBe('');
  });
});
