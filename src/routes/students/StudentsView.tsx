import React from 'react';
import { useStudents } from '../../api/hooks/useStudents';
import { useStudentsQueryParams } from './useStudentsQueryParams';
import { SearchInput } from './SearchInput';
import { StatusFilter } from './StatusFilter';
import { StudentTable } from './StudentTable';
import { Pagination } from './Pagination';
import { EmptyState } from '../../components/EmptyState';
import styles from './StudentsView.module.css';

export const StudentsView: React.FC = () => {
  const {
    params,
    useStudentsParams,
    setQuery,
    setStatus,
    toggleSort,
    setPage,
    resetAll
  } = useStudentsQueryParams();

  const queryResult = useStudents(useStudentsParams);
  const { status, data, error, refetch } = queryResult;

  return (
    <main className={styles.container}>
      {/* Header & Server Summary Metrics */}
      <header className={styles.headerSection}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Student Readiness Control Center</h1>
          {data && (
            <div className={styles.cohortStatBadge}>
              Cohort Average Readiness Score:{' '}
              <strong>{data.cohortAverageScore.toFixed(1)}%</strong>
            </div>
          )}
        </div>
      </header>

      {/* Controls Bar: Search & Status Filters */}
      <section className={styles.controlsBar} aria-label="Student filters and search">
        <SearchInput value={params.query} onChange={setQuery} />
        <StatusFilter selectedStatus={params.readinessStatus} onChange={setStatus} />
      </section>

      {/* Refreshing Status Banner (Non-blocking: visible rows remain displayed) */}
      {status === 'refreshing' && (
        <div
          className={styles.refreshingIndicator}
          role="status"
          aria-live="polite"
        >
          <span>Updating student list...</span>
        </div>
      )}

      {/* Initial / First Load State */}
      {status === 'loading' && (
        <div className={styles.stateContainer} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <h2 className={styles.stateTitle}>Loading students...</h2>
          <p className={styles.stateDescription}>
            Fetching verified readiness data from the server.
          </p>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div
          className={styles.errorCallout}
          role="alert"
          aria-live="assertive"
        >
          <h2 className={styles.errorTitle}>Failed to load student data</h2>
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

      {/* Success / Refreshing State with Data */}
      {(status === 'success' || status === 'refreshing') && data && (
        <>
          {data.data.length === 0 ? (
            (() => {
              const hasActiveFilters = Boolean(
                params.query.trim() !== '' ||
                params.readinessStatus !== undefined
              );

              return hasActiveFilters ? (
                <EmptyState
                  title="No students found"
                  description="No students match your active search query or status filter."
                  action={{
                    label: 'Reset All Filters',
                    onClick: resetAll
                  }}
                />
              ) : (
                <EmptyState
                  title="No students yet"
                  description="No student readiness records exist for this cohort yet."
                />
              );
            })()
          ) : (
            <>
              <StudentTable
                students={data.data}
                sortBy={params.sortBy}
                sortOrder={params.sortOrder}
                onSortChange={toggleSort}
              />
              <Pagination
                pagination={data.pagination}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </main>
  );
};
