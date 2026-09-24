import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { SEEDED_USERS } from '../../mocks/seedIdentities';
import { fetchApi, toApiError } from '../../api/client';
import { AuthResponseSchema } from '../../api/schemas';
import { setApiConfig } from '../../api/config';
import styles from './LoginPage.module.css';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleUsePreset = (presetEmail: string, presetPassword = 'password123') => {
    setEmail(presetEmail);
    setPassword(presetPassword);
    setFieldErrors({});
    setServerError(null);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
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
      const response = await fetchApi(AuthResponseSchema, '/api/auth/login', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          password
        }
      });

      setApiConfig({
        tenantId: response.user.tenantId,
        authToken: response.token,
        user: response.user
      });

      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/students';
      navigate(from, { replace: true });
    } catch (err) {
      const apiErr = toApiError(err);
      setServerError(apiErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.iconWrapper} aria-hidden="true">
            SR
          </div>
          <h1 className={styles.title}>Sign In</h1>
          <p className={styles.subtitle}>Enter your credentials to access the Control Center</p>
        </div>

        {/* Quick Demo Preset Chips for Evaluation */}
        <section className={styles.demoPresets} aria-label="Demo evaluator presets">
          <p className={styles.demoPresetsTitle}>Evaluation Quick-Fill:</p>
          <div className={styles.presetChips}>
            {SEEDED_USERS.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleUsePreset(user.email, user.password || 'password123')}
                className={styles.presetChip}
              >
                <span>Use Demo: <strong>{user.email}</strong></span>
                <span className={styles.presetRole}>{user.role.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </section>

        {serverError && (
          <div className={styles.errorBanner} role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.fieldGroup}>
            <label htmlFor="login-email" className={styles.label}>
              Email Address
            </label>
            <input
              id="login-email"
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. evaluator@blue.org"
              className={styles.input}
              autoComplete="email"
              required
            />
            {fieldErrors.email && <p className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="login-password" className={styles.label}>
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={styles.input}
              autoComplete="current-password"
              required
            />
            {fieldErrors.password && <p className={styles.fieldError}>{fieldErrors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitBtn}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>Don&apos;t have an account?</span>
          <Link to="/register" className={styles.link}>
            Register
          </Link>
        </footer>
      </div>
    </main>
  );
};
