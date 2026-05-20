import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@bakery/ui';
import { useAuth } from '../store/AuthContext';
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
              <input 
                id="password"
                type="password"
                className={styles.customInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
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

      {/* Forgot-password modal — admin-reset path until email is wired up. */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Forgot password?"
        size="sm"
      >
        <div className={styles.forgotBody}>
          <p>
            Self-serve password reset isn&rsquo;t available yet. Please contact your
            shop&rsquo;s admin or owner and ask them to reset your password from
            <strong> Settings → Users</strong>.
          </p>
          <p className={styles.forgotMuted}>
            After they reset it, sign in with the temporary password and you&rsquo;ll be
            prompted to set a new one.
          </p>
          <div className={styles.forgotActions}>
            <button
              type="button"
              className={styles.forgotBtn}
              onClick={() => setShowForgotModal(false)}
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
