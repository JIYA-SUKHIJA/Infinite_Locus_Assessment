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
      <div className={styles.navContainer}>
        <Link to="/students" className={styles.brand} aria-label="Student Readiness Control Center Home">
          <div className={styles.brandIcon} aria-hidden="true">
            SR
          </div>
          <div>
            <h1 className={styles.brandTitle}>Student Readiness Control Center</h1>
            <p className={styles.brandSubtitle}>Competency &amp; Readiness Command Dashboard</p>
          </div>
        </Link>

        <div className={styles.navRight}>
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
