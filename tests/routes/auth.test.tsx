import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, Location } from 'react-router-dom';
import { LoginPage } from '../../src/routes/login/LoginPage';
import { ProtectedRoute } from '../../src/routes/ProtectedRoute';
import { Navbar } from '../../src/components/Navbar';
import { setApiConfig, getApiConfig } from '../../src/api/config';
import { fetchApi } from '../../src/api/client';
import { z } from 'zod';

const DummyProtected = () => <div>Protected Content</div>;

const LocationTracker = ({ onLocationChange }: { onLocationChange: (loc: Location) => void }) => {
  const loc = useLocation();
  onLocationChange(loc);
  return null;
};

describe('Auth & Session Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset config before each test
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: null,
      authToken: null
    });
  });

  describe('LoginPage Component', () => {
    it('disables submit button until an identity is selected, then updates config and navigates', async () => {
      let currentLocation: Location | null = null;
      const getCurrentLocation = () => currentLocation;

      render(
        <MemoryRouter initialEntries={['/login']}>
          <LocationTracker onLocationChange={(loc) => (currentLocation = loc)} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/students" element={<div>Students Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      const select = screen.getByLabelText(/Select Persona & Tenant/i) as HTMLSelectElement;
      const submitBtn = screen.getByRole('button', { name: /Sign In/i });

      // Initially disabled
      expect(submitBtn.hasAttribute('disabled')).toBe(true);

      // Select Tenant Blue
      act(() => {
        fireEvent.change(select, { target: { value: 'tenant-blue' } });
      });

      expect(submitBtn.hasAttribute('disabled')).toBe(false);

      // Submit
      act(() => {
        fireEvent.click(submitBtn);
      });

      // Config updated
      const config = getApiConfig();
      expect(config.tenantId).toBe('tenant-blue');
      expect(config.authToken).toBe('demo-token-blue-admin');

      // Navigated to /students
      await waitFor(() => {
        expect(screen.getByText('Students Dashboard')).toBeDefined();
      });
      expect(getCurrentLocation()?.pathname).toBe('/students');
    });

    it('navigates to original requested route if redirected from protected route', async () => {
      let currentLocation: Location | null = null;
      const getCurrentLocation = () => currentLocation;

      render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: { from: { pathname: '/students/student-123' } }
            }
          ]}
        >
          <LocationTracker onLocationChange={(loc) => (currentLocation = loc)} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/students/:id" element={<div>Target Student Detail</div>} />
          </Routes>
        </MemoryRouter>
      );

      const select = screen.getByLabelText(/Select Persona & Tenant/i);
      act(() => {
        fireEvent.change(select, { target: { value: 'tenant-green' } });
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In/i });
      act(() => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Target Student Detail')).toBeDefined();
      });
      expect(getCurrentLocation()?.pathname).toBe('/students/student-123');
    });
  });

  describe('ProtectedRoute Guard', () => {
    it('redirects unauthenticated users to /login preserving target location in state', async () => {
      let currentLocation: Location | null = null;
      const getCurrentLocation = () => currentLocation;

      render(
        <MemoryRouter initialEntries={['/students/protected-target']}>
          <LocationTracker onLocationChange={(loc) => (currentLocation = loc)} />
          <Routes>
            <Route
              path="/students/protected-target"
              element={
                <ProtectedRoute>
                  <DummyProtected />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Screen')).toBeDefined();
      });

      expect(screen.queryByText('Protected Content')).toBeNull();
      expect(getCurrentLocation()?.pathname).toBe('/login');
      expect((getCurrentLocation()?.state as any)?.from?.pathname).toBe('/students/protected-target');
    });

    it('renders protected child component when user is authenticated', async () => {
      setApiConfig({
        tenantId: 'tenant-blue',
        authToken: 'demo-token-blue-admin'
      });

      render(
        <MemoryRouter initialEntries={['/students']}>
          <Routes>
            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <DummyProtected />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Protected Content')).toBeDefined();
      expect(screen.queryByText('Login Screen')).toBeNull();
    });
  });

  describe('Navbar Sign-Out Flow', () => {
    it('clears session config and navigates to /login on sign out', async () => {
      setApiConfig({
        tenantId: 'tenant-amber',
        authToken: 'demo-token-amber-viewer'
      });

      render(
        <MemoryRouter initialEntries={['/students']}>
          <Navbar />
          <Routes>
            <Route path="/students" element={<div>Students Page</div>} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Badge & Sign out button visible
      expect(screen.getByTestId('navbar-tenant-badge')).toBeDefined();
      const signOutBtn = screen.getByTestId('navbar-sign-out-btn');
      expect(signOutBtn).toBeDefined();

      // Click Sign Out
      act(() => {
        fireEvent.click(signOutBtn);
      });

      // Session cleared (tenantId and authToken cleared, baseUrl preserved)
      const config = getApiConfig();
      expect(config.tenantId).toBeNull();
      expect(config.authToken).toBeNull();
      expect(config.baseUrl).toBe('https://api.test.example.com');

      // Navigates to /login and hides badge
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
      expect(screen.queryByTestId('navbar-tenant-badge')).toBeNull();
      expect(screen.queryByTestId('navbar-sign-out-btn')).toBeNull();
    });
  });

  describe('Full End-to-End Authentication Journey', () => {
    it('unauthenticated -> redirected to login -> select identity -> view dashboard with tenant pill -> sign out -> back to login', async () => {
      // Start with clean unauthenticated state
      setApiConfig({
        baseUrl: 'https://api.test.example.com',
        tenantId: null,
        authToken: null
      });

      // Render actual App root
      render(
        <MemoryRouter initialEntries={['/students']}>
          <Navbar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <div>Authenticated Student Readiness Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // 1. Redirected to /login
      expect(screen.getByRole('heading', { name: /Sign In/i })).toBeDefined();
      expect(screen.queryByTestId('navbar-tenant-badge')).toBeNull();

      // 2. Select persona from seeded list
      const select = screen.getByLabelText(/Select Persona & Tenant/i);
      act(() => {
        fireEvent.change(select, { target: { value: 'tenant-blue' } });
      });

      // 3. Submit login form
      const submitBtn = screen.getByRole('button', { name: /Sign In/i });
      act(() => {
        fireEvent.click(submitBtn);
      });

      // 4. Lands on /students with tenant badge in navbar
      await waitFor(() => {
        expect(screen.getByText('Authenticated Student Readiness Dashboard')).toBeDefined();
      });

      const badge = screen.getByTestId('navbar-tenant-badge');
      expect(badge.textContent).toContain('tenant-blue');

      // 5. Sign out
      const signOutBtn = screen.getByTestId('navbar-sign-out-btn');
      act(() => {
        fireEvent.click(signOutBtn);
      });

      // 6. Redirected back to login
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Sign In/i })).toBeDefined();
      });
      expect(screen.queryByTestId('navbar-tenant-badge')).toBeNull();
      expect(getApiConfig().authToken).toBeNull();
      expect(getApiConfig().baseUrl).toBe('https://api.test.example.com');
    });
  });

  describe('MSW 401 Unauthorized Gate Enforcement', () => {
    it('rejects unauthenticated requests with 401 when Authorization header is missing', async () => {
      setApiConfig({
        baseUrl: 'https://api.test.example.com',
        tenantId: 'tenant-test',
        authToken: null // Explicitly missing
      });

      await expect(
        fetchApi(z.object({ data: z.array(z.any()) }), '/api/students')
      ).rejects.toThrow('Authentication token is missing or invalid');
    });
  });
});
