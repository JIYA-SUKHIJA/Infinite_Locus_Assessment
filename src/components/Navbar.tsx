import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/hooks/useAuth';
import { setApiConfig } from '../api/config';
import styles from './Navbar.module.css';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, tenantId, user } = useAuth();
  const isStudentsActive = location.pathname.startsWith('/students');

  const handleSignOut = () => {
    setApiConfig({ tenantId: null, authToken: null, user: null });
    navigate('/login', { replace: true });
  };

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

        {isAuthenticated && (
          <div className={styles.navRight}>
            {user && (
              <div className={styles.userInfo} data-testid="navbar-user-info">
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.roleBadge}>{user.role}</span>
              </div>
            )}

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

            <button
              type="button"
              onClick={handleSignOut}
              className={styles.signOutBtn}
              data-testid="navbar-sign-out-btn"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
