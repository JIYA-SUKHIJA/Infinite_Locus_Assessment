import React from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useStudentDetail } from '../../../api/hooks/useStudentDetail';
import { StatusBadge } from '../StatusBadge';
import { CompetencyList } from './CompetencyList';
import styles from './StudentDetailView.module.css';

export interface StudentDetailViewProps {
  onEditStudent?: (studentId: string, currentVersion: number) => void;
  onSubmitAttempt?: (studentId: string, competencyId: string) => void;
}

export const StudentDetailView: React.FC<StudentDetailViewProps> = ({
  onEditStudent,
  onSubmitAttempt
}) => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const queryResult = useStudentDetail(id);
  const { status, data, error, refetch } = queryResult;

  // Safe fallback: Return to list with prior query parameters if available, else root /students
  const backTarget =
    location.state && typeof location.state === 'object' && 'from' in location.state
      ? `/students${(location.state as { from?: string }).from ?? ''}`
      : '/students';

  // Security non-disclosure helper: Treat 404 and 403 identically to prevent cross-tenant ID enumeration
  const isNotFoundOrForbidden =
    error &&
    (error.status === 404 ||
      error.status === 403 ||
      error.code === 'STUDENT_NOT_FOUND' ||
      error.code === 'FORBIDDEN_RESOURCE' ||
      error.code === 'NOT_FOUND');

  return (
    <main className={styles.container} aria-label="Student Detail View">
      {/* Back Navigation preserving list query state */}
      <nav className={styles.backNav} aria-label="Breadcrumb navigation">
        <Link to={backTarget} className={styles.backLink}>
          ← Back to student list
        </Link>
      </nav>

      {/* Refreshing Indicator (Non-blocking: visible details stay displayed) */}
      {status === 'refreshing' && (
        <div
          className={styles.refreshingIndicator}
          role="status"
          aria-live="polite"
        >
          <span>Updating student details...</span>
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {status === 'loading' && (
        <div className={styles.stateContainer} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <h2 className={styles.stateTitle}>Loading student profile...</h2>
          <p className={styles.stateDescription}>
            Retrieving competencies, readiness ratings, and verified attempt evidence.
          </p>
        </div>
      )}

      {/* Non-Disclosure Not-Found / Forbidden Generic State */}
      {status === 'error' && isNotFoundOrForbidden && (
        <div className={styles.stateContainer} role="status" aria-live="polite">
          <h2 className={styles.stateTitle}>Student Not Found</h2>
          <p className={styles.stateDescription}>
            The requested student record does not exist or you do not have permission to view it.
          </p>
          <Link to="/students" className={styles.actionBtn}>
            Return to Student List
          </Link>
        </div>
      )}

      {/* Generic Server / Network Error Callout */}
      {status === 'error' && !isNotFoundOrForbidden && (
        <div
          className={styles.errorCallout}
          role="alert"
          aria-live="assertive"
        >
          <h2 className={styles.errorTitle}>Failed to load student profile</h2>
          <p className={styles.errorMessage}>{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className={styles.retryBtn}
          >
            Retry Request
          </button>
        </div>
      )}

      {/* Success / Refreshing Detail View */}
      {(status === 'success' || status === 'refreshing') && data && (
        <div data-version={data.data.version}>
          {/* Header Card with Profile Information & Phase 4 Edit Entry Point */}
          <header className={styles.headerCard}>
            <div className={styles.profileInfo}>
              <h1 className={styles.studentName}>{data.data.name}</h1>
              <div className={styles.studentMeta}>
                <span>{data.data.email}</span>
                <span>•</span>
                <span className={styles.cohortBadge}>{data.data.cohort}</span>
              </div>
            </div>

            <div className={styles.headerActions}>
              <StatusBadge status={data.data.readinessStatus} />

              <div className={styles.scoreBadgeContainer}>
                <span className={styles.scoreLabel}>Overall Score</span>
                <span className={styles.scoreValue}>
                  {data.data.summaryScore.toFixed(1)}%
                </span>
              </div>

              {/* Phase 4 Entry Point Stub: version is threaded directly */}
              <button
                type="button"
                className={styles.editStudentBtn}
                data-version={data.data.version}
                onClick={() => {
                  /* TODO (Phase 4): Open edit student modal */
                  onEditStudent?.(data.data.id, data.data.version);
                }}
                aria-label={`Edit profile for ${data.data.name}`}
              >
                Edit Student
              </button>
            </div>
          </header>

          {/* Competency Evidence List */}
          <CompetencyList
            competencies={data.data.competencies}
            onOpenAttemptModal={(competencyId) => {
              /* TODO (Phase 4): Open attempt submission modal */
              onSubmitAttempt?.(data.data.id, competencyId);
            }}
          />
        </div>
      )}
    </main>
  );
};
