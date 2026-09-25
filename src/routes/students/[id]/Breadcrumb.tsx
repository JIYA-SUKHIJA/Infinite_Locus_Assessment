import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbProps {
  studentName?: string | null | undefined;
  isLoading?: boolean | undefined;
  backTarget?: string | undefined;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  studentName,
  isLoading = false,
  backTarget = '/students'
}) => {
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb navigation">
      <ol className={styles.list}>
        <li className={styles.item}>
          <Link to="/students" className={styles.link}>
            Dashboard
          </Link>
          <span className={styles.separator} aria-hidden="true">/</span>
        </li>
        <li className={styles.item}>
          <Link to={backTarget} className={styles.link}>
            Students
          </Link>
          <span className={styles.separator} aria-hidden="true">/</span>
        </li>
        <li className={styles.item} aria-current="page">
          {isLoading ? (
            <span className={styles.skeleton} aria-label="Loading student profile">
              Loading...
            </span>
          ) : (
            <span className={styles.current}>{studentName || 'Student Profile'}</span>
          )}
        </li>
      </ol>
    </nav>
  );
};
