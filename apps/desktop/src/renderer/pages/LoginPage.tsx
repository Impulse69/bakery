import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Input } from '@bakery/ui';
import { useAuth } from '../store/AuthContext';
import { api } from '../lib/api';
import styles from './LoginPage.module.css';
import logo from '../assets/logo.png';
import background from '../assets/login-bg.png';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Local admin recovery (offline, loopback-only on the server side).
  const [recoverEmail, setRecoverEmail] = useState('admin@bakery.com');
  const [recoverPassword, setRecoverPassword] = useState('');
  const [recoverConfirm, setRecoverConfirm] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [recoverDone, setRecoverDone] = useState(false);

  const closeRecover = () => {
    setShowForgotModal(false);
    setRecoverError('');
    setRecoverDone(false);
    setRecoverPassword('');
    setRecoverConfirm('');
  };

  const handleRecover = async (e: FormEvent) => {
    e.preventDefault();
    setRecoverError('');
    if (recoverPassword.length < 6) {
      setRecoverError('Password must be at least 6 characters.');
      return;
    }
    if (recoverPassword !== recoverConfirm) {
      setRecoverError('Passwords do not match.');
      return;
    }
    setRecoverLoading(true);
    try {
      await api.post('/auth/recover-admin', {
        email: recoverEmail.trim(),
        newPassword: recoverPassword,
      });
      setRecoverDone(true);
      setEmail(recoverEmail.trim());
      setPassword('');
    } catch (err) {
      setRecoverError(
        err instanceof Error
          ? err.message
          : 'Recovery failed. Make sure you are on the computer running the app.',
      );
    } finally {
      setRecoverLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      {/* Left Side: Login Form */}
      <section className={styles.leftSide}>
        <div className={styles.contentWrapper}>
          <div className={styles.logoContainer}>
            <img src={logo} alt="Bread Faculty" className={styles.logo} />
          </div>

          <div className={styles.textContent}>
            <div className={styles.facultyBadge}>Faculty Access</div>
            <h1 className={styles.title}>Secure Sign-In</h1>
            <p className={styles.subtitle}>Enter your credentials to manage the bakery ecosystem.</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <div className={styles.labelContainer}>
                <label className={styles.label} htmlFor="email">Email Address</label>
              </div>
              <input 
                id="email"
                type="email"
                className={styles.customInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="baker@breadfaculty.com"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <div className={styles.labelContainer}>
                <label className={styles.label} htmlFor="password">Password</label>
                <button
                  type="button"
                  className={styles.forgotPassword}
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot Password
                </button>
              </div>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.customInput} ${styles.customInputPassword}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className={styles.revealBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className={styles.rememberMeContainer}>
               <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                 <input 
                    type="checkbox" 
                    checked={remember} 
                    onChange={e => setRemember(e.target.checked)} 
                    style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', border: '1px solid var(--bui-border-color)'}} 
                 />
                 <span className={styles.checkboxLabel}>Remember Me</span>
               </label>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !email || !password}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className={styles.divider}>
            <div className={styles.dividerLine}></div>
          </div>
        </div>
      </section>

      {/* Right Side: Visual Narrative */}
      <section className={styles.rightSide}>
        <div className={styles.bgImageContainer}>
          <img src={background} alt="Bread Faculty" className={styles.bgImage} />
          <div className={styles.glassOverlay}></div>
        </div>
      </section>

      {/* Admin recovery — local, loopback-only reset for a locked-out owner. */}
      <Modal
        isOpen={showForgotModal}
        onClose={closeRecover}
        title="Recover admin access"
        size="sm"
      >
        {recoverDone ? (
          <div className={styles.forgotBody}>
            <p>
              Your admin password has been reset. Sign in with the email and new password
              you just set.
            </p>
            <div className={styles.forgotActions}>
              <button type="button" className={styles.forgotBtn} onClick={closeRecover}>
                Sign in
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRecover} className={styles.forgotBody}>
            <p className={styles.forgotMuted}>
              Locked out? Because the app runs on this computer, you can set a new admin
              password here — no old password needed.
            </p>
            <Input
              label="Admin email"
              type="email"
              value={recoverEmail}
              onChange={(e) => setRecoverEmail(e.target.value)}
            />
            <Input
              label="New password"
              type="password"
              value={recoverPassword}
              onChange={(e) => setRecoverPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={recoverConfirm}
              onChange={(e) => setRecoverConfirm(e.target.value)}
            />
            {recoverError && <p className={styles.error} style={{ marginBottom: 0 }}>{recoverError}</p>}
            <div className={styles.forgotActions}>
              <button
                type="button"
                className={styles.forgotBtn}
                style={{ background: 'transparent', color: '#131b2e' }}
                onClick={closeRecover}
              >
                Cancel
              </button>
              <button type="submit" className={styles.forgotBtn} disabled={recoverLoading}>
                {recoverLoading ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
