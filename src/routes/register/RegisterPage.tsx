import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AVAILABLE_COHORTS } from '../../mocks/seedIdentities';
import { fetchApi, toApiError } from '../../api/client';
import { AuthResponseSchema } from '../../api/schemas';
import { setApiConfig } from '../../api/config';
import styles from './RegisterPage.module.css';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantId, setTenantId] = useState(AVAILABLE_COHORTS[0]?.tenantId || 'tenant-blue');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!tenantId) {
      errors.tenantId = 'Please select a cohort';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetchApi(AuthResponseSchema, '/api/auth/register', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          tenantId
        }
      });

      setApiConfig({
        tenantId: response.user.tenantId,
        authToken: response.token,
        user: response.user
      });

      navigate('/students', { replace: true });
    } catch (err) {
      const apiErr = toApiError(err);
      setServerError(apiErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper} aria-hidden="true">
            SR
          </div>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.subtitle}>Register to access the Student Readiness Control Center</p>
        </div>

        {serverError && (
          <div className={styles.errorBanner} role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.fieldGroup}>
            <label htmlFor="register-name" className={styles.label}>
              Full Name
            </label>
            <input
              id="register-name"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Alex Morgan"
              className={styles.input}
              autoComplete="name"
              required
            />
            {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-email" className={styles.label}>
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alex.morgan@academy.org"
              className={styles.input}
              autoComplete="email"
              required
            />
            {fieldErrors.email && <p className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-cohort" className={styles.label}>
              Assigned Cohort / Tenant
            </label>
            <select
              id="register-cohort"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className={styles.select}
              required
            >
              {AVAILABLE_COHORTS.map((c) => (
                <option key={c.tenantId} value={c.tenantId}>
                  {c.label}
                </option>
              ))}
            </select>
            {fieldErrors.tenantId && <p className={styles.fieldError}>{fieldErrors.tenantId}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-password" className={styles.label}>
              Password
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className={styles.input}
              autoComplete="new-password"
              required
            />
            {fieldErrors.password && <p className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="register-confirm-password" className={styles.label}>
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className={styles.input}
              autoComplete="new-password"
              required
            />
            {fieldErrors.confirmPassword && (
              <p className={styles.fieldError}>{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitBtn}
          >
            {isSubmitting ? 'Creating Account...' : 'Register & Enter Dashboard'}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>Already have an account?</span>
          <Link to="/login" className={styles.link}>
            Sign In
          </Link>
        </footer>
      </div>
    </main>
  );
};
