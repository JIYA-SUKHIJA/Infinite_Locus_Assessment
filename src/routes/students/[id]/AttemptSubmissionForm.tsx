import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSubmitAttempt } from '../../../api/hooks/useSubmitAttempt';
import styles from './StudentDetailView.module.css';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface AttemptSubmissionFormProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  competency: {
    id: string;
    name: string;
    code: string;
  } | null;
  onSuccess: () => void;
}

export const AttemptSubmissionForm: React.FC<AttemptSubmissionFormProps> = ({
  isOpen,
  onClose,
  studentId,
  competency,
  onSuccess
}) => {
  const { status, error, submitAttempt, reset } = useSubmitAttempt();

  // Form field state
  const [score, setScore] = useState<string>('85');
  const [maxScore, setMaxScore] = useState<string>('100');
  const [passed, setPassed] = useState<boolean>(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Idempotency Key Lifecycle:
  // - A fresh UUID is generated whenever the modal opens for a new attempt.
  // - Retained across retries of THE SAME submission if a network error occurs.
  const idempotencyKeyRef = useRef<string>(generateUUID());

  // Focus management refs
  const scoreInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // When the modal opens: generate a fresh idempotency key and reset state
  useEffect(() => {
    if (isOpen) {
      idempotencyKeyRef.current = generateUUID(); // Fresh key per open/attempt cycle
      setScore('85');
      setMaxScore('100');
      setPassed(true);
      setValidationErrors({});
      reset();
      isSubmittingRef.current = false;

      // Focus the first interactive field
      setTimeout(() => {
        scoreInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, reset]);

  // Keep isSubmittingRef in sync with status to guard against double-clicks/double-enters
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
    const parsedScore = parseFloat(score);
    const parsedMaxScore = parseFloat(maxScore);

    if (isNaN(parsedScore)) {
      errors.score = 'Score is required and must be a number';
    } else if (parsedScore < 0) {
      errors.score = 'Score cannot be negative';
    }

    if (isNaN(parsedMaxScore)) {
      errors.maxScore = 'Max score is required and must be a number';
    } else if (parsedMaxScore <= 0) {
      errors.maxScore = 'Max score must be greater than zero';
    } else if (!isNaN(parsedScore) && parsedScore > parsedMaxScore) {
      errors.score = `Score cannot exceed maximum score of ${parsedMaxScore}`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [score, maxScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against double-submits
    if (isSubmittingRef.current || status === 'loading') {
      return;
    }

    if (!validate() || !competency) {
      return;
    }

    isSubmittingRef.current = true;

    const result = await submitAttempt(
      studentId,
      {
        competencyId: competency.id,
        score: parseFloat(score),
        maxScore: parseFloat(maxScore),
        passed
      },
      {
        idempotencyKey: idempotencyKeyRef.current // Reuses same key on retry of same attempt
      }
    );

    if (result) {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen || !competency) {
    return null;
  }

  const isNetworkError =
    error && (error.code === 'NETWORK_ERROR' || error.status === 0);

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attempt-form-title"
    >
      <div className={styles.modalCard}>
        <header className={styles.modalHeader}>
          <div>
            <h2 id="attempt-form-title" className={styles.modalTitle}>
              Submit Competency Attempt
            </h2>
            <p className={styles.modalSubtitle}>
              {competency.name} ({competency.code})
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

        {/* Network failure honest reassurance banner */}
        {isNetworkError && (
          <div
            className={styles.networkErrorBanner}
            role="alert"
            aria-live="assertive"
          >
            <strong>Network error occurred.</strong>
            <p>
              We cannot confirm if the server received your attempt. It is safe to click Retry
              because this submission is protected by a unique Idempotency Key.
            </p>
          </div>
        )}

        {/* Server 4xx error message */}
        {error && !isNetworkError && (
          <div
            className={styles.errorAlert}
            role="alert"
            aria-live="assertive"
          >
            <strong>Submission failed:</strong> {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="attempt-score" className={styles.formLabel}>
              Earned Score
            </label>
            <input
              id="attempt-score"
              ref={scoreInputRef}
              type="number"
              step="any"
              min="0"
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                const s = parseFloat(e.target.value);
                const m = parseFloat(maxScore);
                if (!isNaN(s) && !isNaN(m) && m > 0) {
                  setPassed(s >= m * 0.7);
                }
              }}
              disabled={status === 'loading'}
              className={`${styles.formInput} ${
                validationErrors.score ? styles.inputError : ''
              }`}
              aria-invalid={Boolean(validationErrors.score)}
              aria-describedby={
                validationErrors.score ? 'attempt-score-error' : undefined
              }
              required
            />
            {validationErrors.score && (
              <span id="attempt-score-error" className={styles.fieldErrorText} role="alert">
                {validationErrors.score}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="attempt-max-score" className={styles.formLabel}>
              Maximum Possible Score
            </label>
            <input
              id="attempt-max-score"
              type="number"
              step="any"
              min="1"
              value={maxScore}
              onChange={(e) => {
                setMaxScore(e.target.value);
                const s = parseFloat(score);
                const m = parseFloat(e.target.value);
                if (!isNaN(s) && !isNaN(m) && m > 0) {
                  setPassed(s >= m * 0.7);
                }
              }}
              disabled={status === 'loading'}
              className={`${styles.formInput} ${
                validationErrors.maxScore ? styles.inputError : ''
              }`}
              aria-invalid={Boolean(validationErrors.maxScore)}
              aria-describedby={
                validationErrors.maxScore ? 'attempt-max-score-error' : undefined
              }
              required
            />
            {validationErrors.maxScore && (
              <span
                id="attempt-max-score-error"
                className={styles.fieldErrorText}
                role="alert"
              >
                {validationErrors.maxScore}
              </span>
            )}
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={passed}
                onChange={(e) => setPassed(e.target.checked)}
                disabled={status === 'loading'}
                className={styles.checkboxInput}
              />
              <span>Mark Attempt as Passed (Achieved Competency Benchmark)</span>
            </label>
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
              {status === 'loading'
                ? 'Submitting Attempt...'
                : error
                ? 'Retry Submission'
                : 'Submit Attempt'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
