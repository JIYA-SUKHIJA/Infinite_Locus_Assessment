import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, Location } from 'react-router-dom';
import { LoginPage } from '../../src/routes/login/LoginPage';
import { RegisterPage } from '../../src/routes/register/RegisterPage';
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
      authToken: null,
      user: null
    });
  });

  describe('LoginPage Component', () => {
    it('autofills credentials when clicking demo evaluator preset chip and submits successfully', async () => {
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

      const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

      // Click preset chip for evaluator@blue.org
      const presetBtn = screen.getByRole('button', { name: /evaluator@blue\.org/i });
      act(() => {
        fireEvent.click(presetBtn);
      });

      expect(emailInput.value).toBe('evaluator@blue.org');
      expect(passwordInput.value).toBe('password123');

      // Submit
      act(() => {
        fireEvent.click(submitBtn);
      });

      // Navigated to /students
      await waitFor(() => {
        expect(screen.getByText('Students Dashboard')).toBeDefined();
      });

      const config = getApiConfig();
      expect(config.tenantId).toBe('tenant-blue');
      expect(config.authToken).toBeDefined();
      expect(config.user?.email).toBe('evaluator@blue.org');
      expect(getCurrentLocation()?.pathname).toBe('/students');
    });

    it('displays error banner when submitting invalid credentials', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByLabelText(/^Password/i);
      const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

      act(() => {
        fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByText(/Invalid email or password/i)).toBeDefined();
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

      const presetBtn = screen.getByRole('button', { name: /admin@green\.org/i });
      act(() => {
        fireEvent.click(presetBtn);
      });

      const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
      act(() => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Target Student Detail')).toBeDefined();
      });
      expect(getCurrentLocation()?.pathname).toBe('/students/student-123');
    });
  });

  describe('RegisterPage Component', () => {
    it('validates required fields, email format, and password matching', async () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </MemoryRouter>
      );

      const submitBtn = screen.getByRole('button', { name: /Register & Enter Dashboard/i });

      // Submit empty
      act(() => {
        fireEvent.click(submitBtn);
      });

      expect(screen.getByText('Full name is required')).toBeDefined();
      expect(screen.getByText('Email address is required')).toBeDefined();
      expect(screen.getByText('Password is required')).toBeDefined();

      // Password mismatch
      const passwordInput = screen.getByLabelText(/^Password$/i);
      const confirmInput = screen.getByLabelText(/Confirm Password/i);
      act(() => {
        fireEvent.change(passwordInput, { target: { value: 'secret123' } });
        fireEvent.change(confirmInput, { target: { value: 'different123' } });
        fireEvent.click(submitBtn);
      });

      expect(screen.getByText('Passwords do not match')).toBeDefined();
    });

    it('submits registration successfully and logs user into dashboard', async () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/students" element={<div>Students Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      const nameInput = screen.getByLabelText(/Full Name/i);
      const emailInput = screen.getByLabelText(/Email Address/i);
      const cohortSelect = screen.getByLabelText(/Assigned Cohort/i);
      const passwordInput = screen.getByLabelText(/^Password$/i);
      const confirmInput = screen.getByLabelText(/Confirm Password/i);
      const submitBtn = screen.getByRole('button', { name: /Register & Enter Dashboard/i });

      act(() => {
        fireEvent.change(nameInput, { target: { value: 'Dr. Jane Foster' } });
        fireEvent.change(emailInput, { target: { value: `jane.foster.${Date.now()}@academy.org` } });
        fireEvent.change(cohortSelect, { target: { value: 'tenant-green' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.change(confirmInput, { target: { value: 'password123' } });
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Students Dashboard')).toBeDefined();
      });

      const config = getApiConfig();
      expect(config.tenantId).toBe('tenant-green');
      expect(config.authToken).toBeDefined();
      expect(config.user?.name).toBe('Dr. Jane Foster');
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
        authToken: 'demo-token-blue-admin',
        user: {
          id: 'user-1',
          email: 'admin@blue.org',
          name: 'Admin User',
          tenantId: 'tenant-blue',
          role: 'admin'
        }
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
    it('renders user details and on sign out clears config and navigates to /login', async () => {
      setApiConfig({
        tenantId: 'tenant-amber',
        authToken: 'demo-token-amber-viewer',
        user: {
          id: 'user-3',
          email: 'viewer@amber.org',
          name: 'Elena Rostova',
          tenantId: 'tenant-amber',
          role: 'viewer'
        }
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

      // User info and tenant badge visible
      expect(screen.getByTestId('navbar-user-info')).toBeDefined();
      expect(screen.getByText('Elena Rostova')).toBeDefined();
      expect(screen.getByText('viewer')).toBeDefined();
      expect(screen.getByTestId('navbar-tenant-badge')).toBeDefined();

      const signOutBtn = screen.getByTestId('navbar-sign-out-btn');
      expect(signOutBtn).toBeDefined();

      // Click Sign Out
      act(() => {
        fireEvent.click(signOutBtn);
      });

      // Session cleared (tenantId, authToken, and user cleared, baseUrl preserved)
      const config = getApiConfig();
      expect(config.tenantId).toBeNull();
      expect(config.authToken).toBeNull();
      expect(config.user).toBeNull();
      expect(config.baseUrl).toBe('https://api.test.example.com');

      // Navigates to /login and hides badges
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
      expect(screen.queryByTestId('navbar-user-info')).toBeNull();
      expect(screen.queryByTestId('navbar-tenant-badge')).toBeNull();
      expect(screen.queryByTestId('navbar-sign-out-btn')).toBeNull();
    });
  });

  describe('Full End-to-End Authentication Journey', () => {
    it('unauthenticated -> redirected to login -> use preset -> land on /students with user info -> sign out -> back to login', async () => {
      // Start with clean unauthenticated state
      setApiConfig({
        baseUrl: 'https://api.test.example.com',
        tenantId: null,
        authToken: null,
        user: null
      });

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
      expect(screen.queryByTestId('navbar-user-info')).toBeNull();
      expect(screen.queryByTestId('navbar-tenant-badge')).toBeNull();

      // 2. Select preset
      const presetBtn = screen.getByRole('button', { name: /evaluator@blue\.org/i });
      act(() => {
        fireEvent.click(presetBtn);
      });

      // 3. Submit
      const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
      act(() => {
        fireEvent.click(submitBtn);
      });

      // 4. Lands on /students with navbar tenant & user badge
      await waitFor(() => {
        expect(screen.getByText('Authenticated Student Readiness Dashboard')).toBeDefined();
      });

      expect(screen.getByTestId('navbar-user-info')).toBeDefined();
      expect(screen.getByText('Sarah Chen')).toBeDefined();
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
      expect(screen.queryByTestId('navbar-user-info')).toBeNull();
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
        authToken: null
      });

      await expect(
        fetchApi(z.object({ data: z.array(z.any()) }), '/api/students')
      ).rejects.toThrow('Authentication token is missing or invalid');
    });
  });
});
