import React, { useState } from 'react';
import { useStudentActivity } from '../../../api/hooks/useStudentActivity';
import { ActivityEvent } from '../../../types/domain';
import { StatusBadge } from '../StatusBadge';
import { EmptyState } from '../../../components/EmptyState';
import styles from './StudentDetailView.module.css';

export interface ActivityLogProps {
  studentId: string;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

function renderSafeEventDetails(event: ActivityEvent): React.ReactNode {
  const { eventType, payload, actor } = event;

  switch (eventType) {
    case 'ATTEMPT_SUBMITTED': {
      const score = typeof payload.score === 'number' ? payload.score : null;
      const maxScore = typeof payload.maxScore === 'number' ? payload.maxScore : null;
      const passed = typeof payload.passed === 'boolean' ? payload.passed : null;
      const competencyId = typeof payload.competencyId === 'string' ? payload.competencyId : null;

      return (
        <div className={styles.eventDetails}>
          <p className={styles.eventSummary}>
            <strong>Competency Attempt Recorded</strong>
            {competencyId && <span className={styles.eventMeta}> ({competencyId})</span>}
          </p>
          {score !== null && maxScore !== null && (
            <p className={styles.eventDetailText}>
              Score: <strong>{score} / {maxScore}</strong>
              {passed !== null && (
                <span className={passed ? styles.passedBadge : styles.failedBadge}>
                  {passed ? ' (Passed)' : ' (Failed)'}
                </span>
              )}
            </p>
          )}
          <span className={styles.eventActor}>Logged by: {actor}</span>
        </div>
      );
    }

    case 'READINESS_UPDATED': {
      const status = typeof payload.status === 'string' ? payload.status : null;
      const previousStatus = typeof payload.previousStatus === 'string' ? payload.previousStatus : null;

      return (
        <div className={styles.eventDetails}>
          <p className={styles.eventSummary}>
            <strong>Readiness Evaluation Updated</strong>
          </p>
          <div className={styles.eventStatusTransition}>
            {previousStatus && <span className={styles.eventMeta}>From: {previousStatus} → </span>}
            {status && <StatusBadge status={status as any} />}
          </div>
          <span className={styles.eventActor}>Logged by: {actor}</span>
        </div>
      );
    }

    case 'PROFILE_UPDATED': {
      const changedFields = Array.isArray(payload.changedFields)
        ? payload.changedFields.filter((f): f is string => typeof f === 'string')
        : null;

      return (
        <div className={styles.eventDetails}>
          <p className={styles.eventSummary}>
            <strong>Student Profile Edited</strong>
          </p>
          {changedFields && changedFields.length > 0 && (
            <p className={styles.eventDetailText}>
              Modified attributes: {changedFields.join(', ')}
            </p>
          )}
          <span className={styles.eventActor}>Modified by: {actor}</span>
        </div>
      );
    }

    case 'STATUS_OVERRIDDEN': {
      const reason = typeof payload.reason === 'string' ? payload.reason : null;

      return (
        <div className={styles.eventDetails}>
          <p className={styles.eventSummary}>
            <strong>Readiness Status Overridden</strong>
          </p>
          {reason && (
            <p className={styles.eventDetailText}>
              Override reason: <em>"{reason}"</em>
            </p>
          )}
          <span className={styles.eventActor}>Authorized by: {actor}</span>
        </div>
      );
    }

    default: {
      // Safe fallback: never dump raw JSON
      return (
        <div className={styles.eventDetails}>
          <p className={styles.eventSummary}>
            <strong>System Audit Event</strong>
          </p>
          <span className={styles.eventActor}>Recorded by: {actor}</span>
        </div>
      );
    }
  }
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ studentId }) => {
  const [page, setPage] = useState<number>(1);
  const pageSize = 10; // Bounded page size

  const { status, data, error, refetch } = useStudentActivity(studentId, {
    page,
    pageSize
  });

  return (
    <section className={styles.activitySection} aria-labelledby="activity-heading">
      <div className={styles.activitySectionHeader}>
        <h2 id="activity-heading" className={styles.sectionTitle}>
          Activity &amp; Audit Log
        </h2>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={status === 'loading'}
          className={styles.refreshActivityBtn}
          aria-label="Refresh activity log"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className={styles.activityStateBox} role="status" aria-live="polite">
          <div className={styles.miniSpinner} aria-hidden="true" />
          <p>Loading activity audit events...</p>
        </div>
      )}

      {/* Error Callout */}
      {status === 'error' && (
        <div className={styles.errorAlert} role="alert" aria-live="assertive">
          <strong>Failed to load activity log:</strong> {error.message}
          <button
            type="button"
            onClick={() => void refetch()}
            className={styles.miniRetryBtn}
          >
            Retry
          </button>
        </div>
      )}

      {/* Success or Refreshing State with Data */}
      {(status === 'success' || status === 'refreshing') && data && (
        <div>
          {status === 'refreshing' && (
            <div className={styles.activityRefreshingBanner} role="status" aria-live="polite">
              <span>Updating audit log...</span>
            </div>
          )}

          {data.data.length === 0 ? (
            <EmptyState
              title="No activity recorded"
              description="No audit activity recorded for this student yet."
            />
          ) : (
            <ul className={styles.timelineList} aria-label="Student activity history">
              {data.data.map((event) => (
                <li key={event.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} aria-hidden="true" />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                      <span className={styles.timelineBadge}>{event.eventType}</span>
                      <time className={styles.timelineTimestamp} dateTime={event.timestamp}>
                        {formatTimestamp(event.timestamp)}
                      </time>
                    </div>
                    {renderSafeEventDetails(event)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Bounded Pagination Controls */}
          {data.pagination.totalPages > 1 && (
            <nav className={styles.activityPagination} aria-label="Activity pagination">
              <span className={styles.paginationInfoText}>
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalItems} events)
              </span>
              <div className={styles.paginationBtnGroup}>
                <button
                  type="button"
                  disabled={!data.pagination.hasPrevPage}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className={styles.miniPageBtn}
                  aria-label="Previous activity page"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={!data.pagination.hasNextPage}
                  onClick={() => setPage((prev) => Math.min(data.pagination.totalPages, prev + 1))}
                  className={styles.miniPageBtn}
                  aria-label="Next activity page"
                >
                  Next →
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </section>
  );
};
