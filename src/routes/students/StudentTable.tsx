import React from 'react';
import { StudentSummary } from '../../types/domain';
import { UseStudentsParams } from '../../api/hooks/useStudents';
import { StatusBadge } from './StatusBadge';
import styles from './StudentsView.module.css';

export interface StudentTableProps {
  students: readonly StudentSummary[];
  sortBy: NonNullable<UseStudentsParams['sortBy']>;
  sortOrder: 'asc' | 'desc';
  onSortChange: (column: NonNullable<UseStudentsParams['sortBy']>) => void;
}

interface ColumnConfig {
  id: NonNullable<UseStudentsParams['sortBy']>;
  label: string;
  sortable: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Student', sortable: true },
  { id: 'summaryScore', label: 'Overall Score', sortable: true },
  { id: 'readinessStatus', label: 'Readiness', sortable: true },
  { id: 'lastActiveAt', label: 'Last Active', sortable: true }
];

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

export const StudentTable: React.FC<StudentTableProps> = ({
  students,
  sortBy,
  sortOrder,
  onSortChange
}) => {
  return (
    <div className={styles.tableContainer}>
      {/* Desktop & Tablet Table Layout */}
      <table className={styles.desktopTable} aria-label="Students List Table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const isSorted = sortBy === col.id;
              const ariaSort = isSorted
                ? sortOrder === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none';

              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={ariaSort}
                  className={col.sortable ? styles.sortableTh : ''}
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(col.id)}
                    className={styles.sortHeaderBtn}
                    aria-label={`Sort by ${col.label} ${
                      isSorted
                        ? sortOrder === 'asc'
                          ? 'descending'
                          : 'ascending'
                        : 'ascending'
                    }`}
                  >
                    <span>{col.label}</span>
                    <span className={styles.sortIndicator} aria-hidden="true">
                      {isSorted ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                    </span>
                  </button>
                </th>
              );
            })}
            <th scope="col">Cohort</th>
            <th scope="col">Competencies</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className={styles.tableRow}>
              <td>
                <div className={styles.studentNameCell}>
                  <span className={styles.studentName}>{student.name}</span>
                  <span className={styles.studentEmail}>{student.email}</span>
                </div>
              </td>
              <td>
                <span className={styles.scoreCell}>
                  {student.summaryScore.toFixed(1)}%
                </span>
              </td>
              <td>
                <StatusBadge status={student.readinessStatus} />
              </td>
              <td>
                <span className={styles.dateCell}>{formatDate(student.lastActiveAt)}</span>
              </td>
              <td>
                <span className={styles.cohortBadge}>{student.cohort}</span>
              </td>
              <td>
                <span className={styles.progressCell}>
                  {student.completedCompetenciesCount} / {student.totalCompetenciesCount}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Card Layout (Viewports <= 768px) */}
      <div className={styles.mobileCardList} aria-label="Students Cards">
        {students.map((student) => (
          <div key={student.id} className={styles.studentCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardStudentName}>{student.name}</h3>
                <p className={styles.cardStudentEmail}>{student.email}</p>
              </div>
              <StatusBadge status={student.readinessStatus} />
            </div>

            <div className={styles.cardBody}>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Overall Score</span>
                <span className={styles.scoreCell}>
                  {student.summaryScore.toFixed(1)}%
                </span>
              </div>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Cohort</span>
                <span className={styles.cohortBadge}>{student.cohort}</span>
              </div>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Competencies</span>
                <span className={styles.progressCell}>
                  {student.completedCompetenciesCount} / {student.totalCompetenciesCount}
                </span>
              </div>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Last Active</span>
                <span className={styles.dateCell}>{formatDate(student.lastActiveAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
