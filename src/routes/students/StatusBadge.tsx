import React from 'react';
import { ReadinessStatus } from '../../types/domain';
import styles from './StudentsView.module.css';

export interface StatusBadgeProps {
  status: ReadinessStatus;
}

const STATUS_LABELS: Record<ReadinessStatus, string> = {
  READY: 'Ready',
  NEARLY_READY: 'Nearly Ready',
  DEVELOPING: 'Developing',
  NEEDS_PREPARATION: 'Needs Preparation',
  INCOMPLETE: 'Incomplete'
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const label = STATUS_LABELS[status] ?? status;
  const statusClassName = styles[`status_${status}`] || styles.status_INCOMPLETE;

  return (
    <span className={`${styles.statusBadge} ${statusClassName}`} role="status">
      {label}
    </span>
  );
};
