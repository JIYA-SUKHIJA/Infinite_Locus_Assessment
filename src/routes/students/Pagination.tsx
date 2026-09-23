import React from 'react';
import { PaginationMeta } from '../../types/domain';
import styles from './StudentsView.module.css';

export interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange
}) => {
  const { page, totalPages, totalItems, hasNextPage, hasPrevPage } = pagination;

  const isPrevDisabled = page <= 1 || !hasPrevPage;
  const isNextDisabled = page >= totalPages || !hasNextPage;

  if (totalItems === 0) {
    return null;
  }

  return (
    <nav className={styles.paginationContainer} aria-label="Pagination Navigation">
      <div className={styles.paginationInfo}>
        <span>
          Showing page <strong>{page}</strong> of <strong>{totalPages || 1}</strong> (
          <strong>{totalItems}</strong> {totalItems === 1 ? 'student' : 'students'})
        </span>
      </div>

      <div className={styles.paginationControls}>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={isPrevDisabled}
          className={styles.pageBtn}
          aria-label="Go to previous page"
        >
          ← Previous
        </button>

        <span className={styles.currentPageIndicator} aria-current="page">
          {page}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isNextDisabled}
          className={styles.pageBtn}
          aria-label="Go to next page"
        >
          Next →
        </button>
      </div>
    </nav>
  );
};
