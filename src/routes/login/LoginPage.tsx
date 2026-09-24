import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SEEDED_IDENTITIES, SeedIdentity } from '../../mocks/seedIdentities';
import { setApiConfig } from '../../api/config';
import styles from './LoginPage.module.css';

export const LoginPage: React.FC = () => {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const selectRef = useRef<HTMLSelectElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) return;

    const identity = SEEDED_IDENTITIES.find((id) => id.tenantId === selectedTenantId);
    if (!identity) return;

    setApiConfig({
      tenantId: identity.tenantId,
      authToken: identity.authToken
    });

    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/students';
    navigate(from, { replace: true });
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.iconWrapper} aria-hidden="true">
            SR
          </div>
          <h1 className={styles.title}>Sign In</h1>
          <p className={styles.subtitle}>Select a seeded identity to access the Control Center</p>
        </div>

        <aside className={styles.noticeBanner} role="note">
          <strong>Demo Mode:</strong> Select a seeded persona to simulate authenticated multi-tenant session context.
        </aside>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.fieldGroup}>
            <label htmlFor="identity-select" className={styles.label}>
              Select Persona &amp; Tenant
            </label>
            <select
              id="identity-select"
              ref={selectRef}
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className={styles.select}
              aria-required="true"
            >
              <option value="">-- Choose an identity --</option>
              {SEEDED_IDENTITIES.map((identity: SeedIdentity) => (
                <option key={identity.tenantId} value={identity.tenantId}>
                  {identity.tenantLabel} &mdash; {identity.userLabel}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!selectedTenantId}
            className={styles.submitBtn}
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
};
