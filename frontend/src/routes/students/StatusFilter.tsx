import React from 'react';
import { ReadinessStatus } from '../../types/domain';
import styles from './StudentsView.module.css';

export interface StatusFilterProps {
  selectedStatus: ReadinessStatus | undefined;
  onChange: (status: ReadinessStatus | 'ALL') => void;
}

interface FilterOption {
  value: ReadinessStatus | 'ALL';
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'READY', label: 'Ready' },
  { value: 'NEARLY_READY', label: 'Nearly Ready' },
  { value: 'DEVELOPING', label: 'Developing' },
  { value: 'NEEDS_PREPARATION', label: 'Needs Prep' },
  { value: 'INCOMPLETE', label: 'Incomplete' }
];

export const StatusFilter: React.FC<StatusFilterProps> = ({
  selectedStatus,
  onChange
}) => {
  const currentSelection = selectedStatus ?? 'ALL';

  return (
    <div
      className={styles.statusFilterGroup}
      role="group"
      aria-label="Filter by readiness status"
    >
      {FILTER_OPTIONS.map((option) => {
        const isSelected = currentSelection === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.filterChip} ${isSelected ? styles.filterChipActive : ''}`}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            aria-label={`Filter by ${option.label}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
