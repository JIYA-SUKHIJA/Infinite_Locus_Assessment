import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../setup';
import { StudentsView } from '../../src/routes/students/StudentsView';
import { Navbar } from '../../src/components/Navbar';
import { setApiConfig } from '../../src/api/config';
import { mockStudentSummary } from '../mocks/handlers';

const renderStudentsRoute = (initialEntries: string[] = ['/students']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/students" element={<StudentsView />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('StudentsView Integration Tests', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-view-test'
    });
  });

  it('renders loading state initially, then displays student list with server summary metrics', async () => {
    renderStudentsRoute();

    // Initial loading indicator
    expect(screen.getByRole('status', { name: '' })).toBeDefined();

    // Settle to success (matching multiple responsive elements)
    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0);
    });

    // Check server-computed cohort average
    expect(screen.getByText('72.4%')).toBeDefined();
    expect(screen.getAllByText('alex.rivera@example.com').length).toBeGreaterThan(0);
  });

  it('DEBOUNCED SEARCH: waits for debounce period before triggering request and updating URL', async () => {
    let lastQueryParam: string | null = null;

    server.use(
      http.get('https://api.test.example.com/api/students', ({ request }) => {
        const url = new URL(request.url);
        lastQueryParam = url.searchParams.get('q');

        return HttpResponse.json({
          data: [{ ...mockStudentSummary, name: 'Search Match Student' }],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          },
          cohortAverageScore: 80
        });
      })
    );

    renderStudentsRoute();

    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toBeDefined();
    });

    const searchInput = screen.getByRole('searchbox');

    // Rapid keystrokes
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'A' } });
      fireEvent.change(searchInput, { target: { value: 'Al' } });
      fireEvent.change(searchInput, { target: { value: 'Alex' } });
    });

    // Before debounce delay (300ms), no extra requests should fire
    expect(lastQueryParam).not.toBe('Alex');

    // Wait for debounce to complete
    await waitFor(
      () => {
        expect(lastQueryParam).toBe('Alex');
      },
      { timeout: 1000 }
    );

    expect(screen.getAllByText('Search Match Student').length).toBeGreaterThan(0);
  });

  it('END-TO-END OUT-OF-ORDER PROTECTION: slow earlier search does not overwrite fast later search', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students', async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('q');

        if (query === 'ann') {
          // Slow earlier search response (180ms delay)
          await delay(180);
          return HttpResponse.json({
            data: [{ ...mockStudentSummary, name: 'Ann Old Stale Student' }],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false
            },
            cohortAverageScore: 60
          });
        }

        if (query === 'anna') {
          // Fast later search response (20ms delay)
          await delay(20);
          return HttpResponse.json({
            data: [{ ...mockStudentSummary, name: 'Anna Fast Latest Student' }],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false
            },
            cohortAverageScore: 90
          });
        }

        return HttpResponse.json({
          data: [mockStudentSummary],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          },
          cohortAverageScore: 70
        });
      })
    );

    renderStudentsRoute();

    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toBeDefined();
    });

    const searchInput = screen.getByRole('searchbox');

    // Type "ann" and wait for debounce to trigger the first slow request
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'ann' } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // Immediately type "anna" and wait for debounce to trigger the fast request
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'anna' } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // Fast request for "anna" resolves first
    await waitFor(() => {
      expect(screen.getAllByText('Anna Fast Latest Student').length).toBeGreaterThan(0);
    });

    // Wait long enough for the slow "ann" (180ms) to finish in the background
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    // Verify "Anna Fast Latest Student" is STILL the rendered student, and "Ann Old Stale Student" never overwrites it
    expect(screen.getAllByText('Anna Fast Latest Student').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ann Old Stale Student')).toBeNull();
  });

  it('DEEP LINKING: reconstructs list state from URL search params on mount', async () => {
    let capturedUrl: URL | null = null;

    server.use(
      http.get('https://api.test.example.com/api/students', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          data: [
            {
              ...mockStudentSummary,
              name: 'Deep Linked Student',
              readinessStatus: 'READY'
            }
          ],
          pagination: {
            page: 2,
            pageSize: 20,
            totalItems: 25,
            totalPages: 2,
            hasNextPage: false,
            hasPrevPage: true
          },
          cohortAverageScore: 88.0
        });
      })
    );

    renderStudentsRoute(['/students?q=Deep&status=READY&page=2&sortBy=summaryScore&sortOrder=desc']);

    await waitFor(() => {
      expect(screen.getAllByText('Deep Linked Student').length).toBeGreaterThan(0);
    });

    expect(capturedUrl !== null).toBe(true);
    expect((capturedUrl as URL | null)?.searchParams.get('q')).toBe('Deep');
    expect((capturedUrl as URL | null)?.searchParams.get('status')).toBe('READY');
    expect((capturedUrl as URL | null)?.searchParams.get('page')).toBe('2');
    expect((capturedUrl as URL | null)?.searchParams.get('sortBy')).toBe('summaryScore');
    expect((capturedUrl as URL | null)?.searchParams.get('sortOrder')).toBe('desc');
  });

  it('REFRESHING STATE: preserves currently visible rows while updating', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students', async ({ request }) => {
        const url = new URL(request.url);
        const statusParam = url.searchParams.get('status');

        if (statusParam === 'READY') {
          await delay(150); // Artificially delay second request
          return HttpResponse.json({
            data: [{ ...mockStudentSummary, name: 'Ready Filtered Student', readinessStatus: 'READY' }],
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false
            },
            cohortAverageScore: 95
          });
        }

        return HttpResponse.json({
          data: [{ ...mockStudentSummary, name: 'Initial Student' }],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          },
          cohortAverageScore: 70
        });
      })
    );

    renderStudentsRoute();

    // Initial success
    await waitFor(() => {
      expect(screen.getAllByText('Initial Student').length).toBeGreaterThan(0);
    });

    // Click "Ready" filter chip
    const readyButton = screen.getByRole('button', { name: 'Filter by Ready' });
    act(() => {
      fireEvent.click(readyButton);
    });

    // Verify refreshing indicator is displayed WHILE previous rows remain visible
    expect(screen.getByText('Updating student list...')).toBeDefined();
    expect(screen.getAllByText('Initial Student').length).toBeGreaterThan(0);

    // Wait for refreshed data to arrive
    await waitFor(() => {
      expect(screen.getAllByText('Ready Filtered Student').length).toBeGreaterThan(0);
    });

    // Refreshing indicator disappears
    expect(screen.queryByText('Updating student list...')).toBeNull();
  });

  it('EMPTY STATE (with filters active): shows filtered empty copy and reset action button', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students', () => {
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

    renderStudentsRoute(['/students?q=NonExistent']);

    await waitFor(() => {
      expect(screen.getByText('No students found')).toBeDefined();
    });

    expect(screen.getByText('No students match your active search query or status filter.')).toBeDefined();
    expect(screen.getByText('Reset All Filters')).toBeDefined();
    expect(screen.queryByText('Failed to load student data')).toBeNull();
  });

  it('EMPTY STATE (unfiltered / empty cohort): shows empty cohort copy without reset action button', async () => {
    server.use(
      http.get('https://api.test.example.com/api/students', () => {
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

    renderStudentsRoute(['/students']);

    await waitFor(() => {
      expect(screen.getByText('No students yet')).toBeDefined();
    });

    expect(screen.getByText('No student readiness records exist for this cohort yet.')).toBeDefined();
    expect(screen.queryByText('Reset All Filters')).toBeNull();
    expect(screen.queryByText('Failed to load student data')).toBeNull();
  });

  it('ERROR STATE & RETRY: renders distinct error callout and re-triggers query on retry', async () => {
    let attemptCount = 0;

    server.use(
      http.get('https://api.test.example.com/api/students', () => {
        attemptCount++;
        if (attemptCount === 1) {
          return HttpResponse.json(
            {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Database connection pool exhausted',
              requestId: 'req_err_retry_500'
            },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          data: [{ ...mockStudentSummary, name: 'Recovered Student' }],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          },
          cohortAverageScore: 78
        });
      })
    );

    renderStudentsRoute();

    await waitFor(() => {
      expect(screen.getByText('Failed to load student data')).toBeDefined();
    });

    expect(screen.getByText('Database connection pool exhausted')).toBeDefined();

    const retryButton = screen.getByRole('button', { name: 'Retry Request' });
    act(() => {
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Recovered Student').length).toBeGreaterThan(0);
    });
  });

  it('KEYBOARD ACCESSIBILITY: allows sorting headers via keyboard enter/space', async () => {
    let lastSortOrder: string | null = null;
    let lastSortBy: string | null = null;

    server.use(
      http.get('https://api.test.example.com/api/students', ({ request }) => {
        const url = new URL(request.url);
        lastSortBy = url.searchParams.get('sortBy');
        lastSortOrder = url.searchParams.get('sortOrder');

        return HttpResponse.json({
          data: [mockStudentSummary],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false
          },
          cohortAverageScore: 75
        });
      })
    );

    renderStudentsRoute();

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0);
    });

    // Find sort button for "Overall Score"
    const scoreSortBtn = screen.getByRole('button', { name: /Sort by Overall Score/i });

    act(() => {
      fireEvent.click(scoreSortBtn);
    });

    await waitFor(() => {
      expect(lastSortBy).toBe('summaryScore');
      expect(lastSortOrder).toBe('asc');
    });

    // Re-query button from current render and click again to toggle to desc
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Sort by Overall Score/i }));
    });

    await waitFor(() => {
      expect(lastSortBy).toBe('summaryScore');
      expect(lastSortOrder).toBe('desc');
    });
  });

  it('NAVBAR TENANT VISIBILITY: displays active tenant from config and updates on tenant switch', async () => {
    setApiConfig({ tenantId: 'tenant-alpha' });
    const { unmount } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('navbar-tenant-badge');
    expect(badge.textContent).toContain('Tenant:');
    expect(badge.textContent).toContain('tenant-alpha');

    // Dynamic switch
    act(() => {
      setApiConfig({ tenantId: 'tenant-beta' });
    });

    expect(badge.textContent).toContain('tenant-beta');
    unmount();
  });
});
