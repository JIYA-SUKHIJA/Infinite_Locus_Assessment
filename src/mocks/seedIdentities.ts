/**
 * Seeded Demo Identities.
 *
 * NOTE: DEMO-ONLY / SCOPE-LIMITED per DECISIONS.md.
 * This is a stand-in identity picker for local development, integration testing,
 * and live defense demonstrations. It is NOT a real credential store and does NOT
 * represent production authentication or secret management.
 */

export interface SeedIdentity {
  tenantId: string;
  tenantLabel: string;
  userLabel: string;
  role: 'admin' | 'evaluator' | 'viewer';
  authToken: string;
}

export const SEEDED_IDENTITIES: readonly SeedIdentity[] = [
  {
    tenantId: 'tenant-blue',
    tenantLabel: 'Tenant Blue',
    userLabel: 'Admin',
    role: 'admin',
    authToken: 'demo-token-blue-admin'
  },
  {
    tenantId: 'tenant-green',
    tenantLabel: 'Tenant Green',
    userLabel: 'Evaluator',
    role: 'evaluator',
    authToken: 'demo-token-green-eval'
  },
  {
    tenantId: 'tenant-amber',
    tenantLabel: 'Tenant Amber',
    userLabel: 'Viewer',
    role: 'viewer',
    authToken: 'demo-token-amber-viewer'
  }
];
