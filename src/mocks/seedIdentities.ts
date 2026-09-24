/**
 * Seeded Demo Identities and Auth Store.
 *
 * NOTE: DEMO-ONLY / SCOPE-LIMITED per DECISIONS.md.
 * This is a stand-in identity store for local development, integration testing,
 * and live defense demonstrations. It is NOT a real credential store and does NOT
 * represent production authentication or secret management.
 */

export interface DemoUser {
  id: string;
  email: string;
  password?: string;
  name: string;
  tenantId: string;
  tenantLabel: string;
  role: 'admin' | 'evaluator' | 'viewer';
  authToken: string;
}

export const SEEDED_USERS: DemoUser[] = [
  {
    id: 'user-eval-blue',
    email: 'evaluator@blue.org',
    password: 'password123',
    name: 'Sarah Chen',
    tenantId: 'tenant-blue',
    tenantLabel: 'Cohort Alpha / Tenant Blue',
    role: 'evaluator',
    authToken: 'demo-token-blue-eval'
  },
  {
    id: 'user-admin-green',
    email: 'admin@green.org',
    password: 'password123',
    name: 'Marcus Vance',
    tenantId: 'tenant-green',
    tenantLabel: 'Cohort Beta / Tenant Green',
    role: 'admin',
    authToken: 'demo-token-green-admin'
  },
  {
    id: 'user-viewer-amber',
    email: 'viewer@amber.org',
    password: 'password123',
    name: 'Elena Rostova',
    tenantId: 'tenant-amber',
    tenantLabel: 'Cohort Gamma / Tenant Amber',
    role: 'viewer',
    authToken: 'demo-token-amber-viewer'
  }
];

export const AVAILABLE_COHORTS = [
  { tenantId: 'tenant-blue', label: 'Cohort Alpha / Tenant Blue' },
  { tenantId: 'tenant-green', label: 'Cohort Beta / Tenant Green' },
  { tenantId: 'tenant-amber', label: 'Cohort Gamma / Tenant Amber' }
];

// In-memory registered user storage for dev session lifetime
export const registeredUsersStore: DemoUser[] = [...SEEDED_USERS];
