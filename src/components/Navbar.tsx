import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getApiConfig, subscribeApiConfig } from '../api/config';
import styles from './Navbar.module.css';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isStudentsActive = location.pathname.startsWith('/students');
  const [tenantId, setTenantId] = useState<string | null>(() => getApiConfig().tenantId);

  useEffect(() => {
    return subscribeApiConfig((config) => {
      setTenantId(config.tenantId);
    });
  }, []);

  return (
    <header className={styles.navbar} role="banner">
      <div className={styles.accentLine} aria-hidden="true" />
      <div className={styles.navContainer}>
        <Link to="/students" className={styles.brand} aria-label="Student Readiness Control Center Home">
          <div className={styles.brandIcon} aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div>
            <h1 className={styles.brandTitle}>Student Readiness Control Center</h1>
            <p className={styles.brandSubtitle}>Evaluator Control Plane</p>
          </div>
        </Link>

        <div className={styles.navRight}>
          <div className={styles.envBadge} aria-label="Environment: Evaluation Mode">
            <span className={styles.envDot} aria-hidden="true" />
            <span className={styles.envLabel}>Evaluation Mode</span>
          </div>

          <div className={styles.tenantBadge} data-testid="navbar-tenant-badge">
            <span className={styles.tenantLabel}>Tenant:</span>
            <span className={styles.tenantValue}>{tenantId || 'default'}</span>
          </div>

          <nav className={styles.navLinks} aria-label="Primary navigation">
            <Link
              to="/students"
              className={`${styles.navLink} ${isStudentsActive ? styles.navLinkActive : ''}`}
            >
              Students
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
