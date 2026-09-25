import React from 'react';
import { StudentsListResponse } from '../../api/schemas';
import styles from './StatsSummary.module.css';

export interface StatsSummaryProps {
  data: StudentsListResponse;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ data }) => {
  const readyOnPage = data.data.filter((s) => s.readinessStatus === 'READY').length;
  const inProgressOnPage = data.data.filter(
    (s) => s.readinessStatus === 'DEVELOPING' || s.readinessStatus === 'NEARLY_READY'
  ).length;

  return (
    <section className={styles.statsGrid} aria-label="Cohort and page readiness summary statistics">
      {/* Total Students (True Cohort Metric) */}
      <article className={styles.statCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Total Students</span>
          <div className={`${styles.cardIconWrapper} ${styles.iconPrimary}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        </div>
        <div className={styles.cardBody}>
          <span className={styles.statValue}>{data.pagination.totalItems}</span>
        </div>
        <span className={styles.cardFooter}>Enrolled in active cohort</span>
      </article>

      {/* Cohort Average Readiness Score (True Cohort Metric) */}
      <article className={styles.statCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Cohort Avg Score</span>
          <div className={`${styles.cardIconWrapper} ${styles.iconTeal}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
        </div>
        <div className={styles.cardBody}>
          <span className={`${styles.statValue} ${styles.statValueAccent}`}>
            {data.cohortAverageScore.toFixed(1)}%
          </span>
        </div>
        <span className={styles.cardFooter}>Server-verified cohort mean</span>
      </article>

      {/* Ready Count (Explicitly This Page) */}
      <article className={styles.statCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Ready (this page)</span>
          <div className={`${styles.cardIconWrapper} ${styles.iconReady}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>
        <div className={styles.cardBody}>
          <span className={styles.statValue}>{readyOnPage}</span>
        </div>
        <span className={styles.cardFooter}>Fully qualified on current view</span>
      </article>

      {/* In Progress Count (Explicitly This Page) */}
      <article className={styles.statCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>In Progress (this page)</span>
          <div className={`${styles.cardIconWrapper} ${styles.iconOrange}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>
        <div className={styles.cardBody}>
          <span className={styles.statValue}>{inProgressOnPage}</span>
        </div>
        <span className={styles.cardFooter}>Developing / Nearly Ready</span>
      </article>
    </section>
  );
};
