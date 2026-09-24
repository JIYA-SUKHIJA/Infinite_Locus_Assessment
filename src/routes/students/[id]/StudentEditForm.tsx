import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePatchStudent } from '../../../api/hooks/usePatchStudent';
import styles from './StudentDetailView.module.css';

export interface StudentEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    name: string;
    email: string;
    cohort: string;
    version: number;
  };
  onSuccess: () => void;
  onRefreshLatest: () => void;
}

export const StudentEditForm: React.FC<StudentEditFormProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
  onRefreshLatest
}) => {
  const { status, error, patchStudent, reset } = usePatchStudent();

  const [name, setName] = useState<string>(student.name);
  const [email, setEmail] = useState<string>(student.email);
  const [cohort, setCohort] = useState<string>(student.cohort);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Sync state when modal opens or student prop updates (e.g. after reload)
  useEffect(() => {
    if (isOpen) {
      setName(student.name);
      setEmail(student.email);
      setCohort(student.cohort);
      setValidationErrors({});
      reset();
      isSubmittingRef.current = false;

      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, student.name, student.email, student.cohort, reset]);

  // Sync submitting flag with status
  useEffect(() => {
    isSubmittingRef.current = status === 'loading';
  }, [status]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && status !== 'loading') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, onClose]);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCohort = cohort.trim();

    if (!trimmedName) {
      errors.name = 'Name is required';
    }

    if (!trimmedEmail) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!trimmedCohort) {
      errors.cohort = 'Cohort is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, email, cohort]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || status === 'loading') {
      return;
    }

    if (!validate()) {
      return;
    }

    isSubmittingRef.current = true;

    const result = await patchStudent(
      student.id,
      {
        name: name.trim(),
        email: email.trim(),
        cohort: cohort.trim()
      },
      {
        expectedVersion: student.version
      }
    );

    if (result) {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const isConflict = status === 'conflict';

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-student-title"
    >
      <div className={styles.modalCard}>
        <header className={styles.modalHeader}>
          <div>
            <h2 id="edit-student-title" className={styles.modalTitle}>
              Edit Student Profile
            </h2>
            <p className={styles.modalSubtitle}>
              Current Version: v{student.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'loading'}
            className={styles.modalCloseBtn}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        {/* Distinct 409 Conflict Resolution Callout */}
        {isConflict && (
          <div
            className={styles.conflictAlert}
            role="alert"
            aria-live="assertive"
          >
            <h3 className={styles.conflictAlertTitle}>Record Conflict Detected (HTTP 409)</h3>
            <p className={styles.conflictAlertMessage}>
              This student record was modified by another session or administrator since you opened it (Version mismatch). Your changes were not applied to avoid overwriting recent updates.
            </p>
            <div className={styles.conflictActions}>
              <button
                type="button"
                onClick={() => {
                  reset();
                  onRefreshLatest();
                }}
                className={styles.conflictReloadBtn}
              >
                Reload Latest &amp; Reapply
              </button>
              <button
                type="button"
                onClick={onClose}
                className={styles.conflictDiscardBtn}
              >
                Discard Changes
              </button>
            </div>
          </div>
        )}

        {/* Generic Server Error (non-conflict) */}
        {error && !isConflict && (
          <div
            className={styles.errorAlert}
            role="alert"
            aria-live="assertive"
          >
            <strong>Save failed:</strong> {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="edit-student-name" className={styles.formLabel}>
              Full Name
            </label>
            <input
              id="edit-student-name"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === 'loading'}
              className={`${styles.formInput} ${
                validationErrors.name ? styles.inputError : ''
              }`}
              aria-invalid={Boolean(validationErrors.name)}
              aria-describedby={
                validationErrors.name ? 'edit-student-name-error' : undefined
              }
              required
            />
            {validationErrors.name && (
              <span
                id="edit-student-name-error"
                className={styles.fieldErrorText}
                role="alert"
              >
                {validationErrors.name}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-student-email" className={styles.formLabel}>
              Email Address
            </label>
            <input
              id="edit-student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className={`${styles.formInput} ${
                validationErrors.email ? styles.inputError : ''
              }`}
              aria-invalid={Boolean(validationErrors.email)}
              aria-describedby={
                validationErrors.email ? 'edit-student-email-error' : undefined
              }
              required
            />
            {validationErrors.email && (
              <span
                id="edit-student-email-error"
                className={styles.fieldErrorText}
                role="alert"
              >
                {validationErrors.email}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-student-cohort" className={styles.formLabel}>
              Cohort
            </label>
            <input
              id="edit-student-cohort"
              type="text"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              disabled={status === 'loading'}
              className={`${styles.formInput} ${
                validationErrors.cohort ? styles.inputError : ''
              }`}
              aria-invalid={Boolean(validationErrors.cohort)}
              aria-describedby={
                validationErrors.cohort ? 'edit-student-cohort-error' : undefined
              }
              required
            />
            {validationErrors.cohort && (
              <span
                id="edit-student-cohort-error"
                className={styles.fieldErrorText}
                role="alert"
              >
                {validationErrors.cohort}
              </span>
            )}
          </div>

          <footer className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              disabled={status === 'loading'}
              className={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'loading'}
              className={styles.submitBtn}
            >
              {status === 'loading' ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
