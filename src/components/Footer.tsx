import React from 'react';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer} role="contentinfo" aria-label="System status and compliance metadata">
      <div className={styles.footerContainer}>
        <div className={styles.complianceBadges}>
          <div className={styles.badgeItem}>
            <span className={styles.staticDot} aria-hidden="true" />
            <span>System Operational (Readiness Engine v1.0)</span>
          </div>
          <span className={styles.separator} aria-hidden="true">•</span>
          <div className={styles.badgeItem}>
            <span>Strict Tenant Isolation Active</span>
          </div>
          <span className={styles.separator} aria-hidden="true">•</span>
          <div className={styles.badgeItem}>
            <span>IEEE Std 830-1998 Specification Compliant</span>
          </div>
        </div>

        <div className={styles.systemInfo}>
          <span>Student Readiness Control Center • Evaluator Interface</span>
        </div>
      </div>
    </footer>
  );
};
