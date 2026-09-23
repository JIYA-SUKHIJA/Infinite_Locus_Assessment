import React from 'react';
import { CompetencyWithLatestAttempt } from '../../../types/domain';
import { StatusBadge } from '../StatusBadge';
import styles from './StudentDetailView.module.css';

export interface CompetencyListProps {
  competencies: readonly CompetencyWithLatestAttempt[];
  onOpenAttemptModal?: (competencyId: string) => void;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

export const CompetencyList: React.FC<CompetencyListProps> = ({
  competencies,
  onOpenAttemptModal
}) => {
  return (
    <section aria-labelledby="competencies-heading">
      <h2 id="competencies-heading" className={styles.sectionTitle}>
        Competency Readiness &amp; Evidence
      </h2>

      <div className={styles.competencyGrid}>
        {competencies.map((item) => {
          const { competency, latestAttempt, readiness } = item;

          return (
            <article
              key={competency.id}
              className={styles.competencyCard}
              aria-labelledby={`comp-title-${competency.id}`}
            >
              <div>
                <header className={styles.competencyCardHeader}>
                  <div>
                    <h3
                      id={`comp-title-${competency.id}`}
                      className={styles.competencyName}
                    >
                      {competency.name}
                    </h3>
                    <span className={styles.competencyCode}>
                      {competency.code} • {competency.category}
                    </span>
                  </div>
                  <StatusBadge status={readiness} />
                </header>

                <p className={styles.competencyDescription}>
                  {competency.description}
                </p>
              </div>

              {/* Latest Attempt Evidence Section */}
              <div className={styles.evidenceBox}>
                {latestAttempt ? (
                  <>
                    <div className={styles.evidenceRow}>
                      <span className={styles.evidenceLabel}>Latest Score</span>
                      <span className={styles.evidenceValue}>
                        {latestAttempt.score} / {latestAttempt.maxScore} (
                        {((latestAttempt.score / latestAttempt.maxScore) * 100).toFixed(0)}%)
                      </span>
                    </div>

                    <div className={styles.evidenceRow}>
                      <span className={styles.evidenceLabel}>Result</span>
                      <span
                        className={
                          latestAttempt.passed ? styles.passedBadge : styles.failedBadge
                        }
                      >
                        {latestAttempt.passed ? '✓ Passed' : '✗ Needs Improvement'}
                      </span>
                    </div>

                    <div className={styles.evidenceRow}>
                      <span className={styles.evidenceLabel}>Attempt Date</span>
                      <span className={styles.evidenceValue}>
                        {formatDate(latestAttempt.timestamp)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className={styles.noEvidenceText}>
                    No attempt evidence recorded yet.
                  </p>
                )}
              </div>

              {/* Phase 4 Entry Point Stub */}
              <button
                type="button"
                className={styles.submitAttemptBtn}
                onClick={() => {
                  /* TODO (Phase 4): Wire to attempt submission modal/flow */
                  onOpenAttemptModal?.(competency.id);
                }}
                aria-label={`Submit new attempt for ${competency.name}`}
              >
                + Submit New Attempt
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
};
