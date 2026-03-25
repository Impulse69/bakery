import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
            <h1 className={styles.title}>Welcome to the Faculty</h1>
            <p className={styles.subtitle}>Manage your artisanal systems and curated inventory.</p>
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
                <a href="#" className={styles.forgotPassword}>Forgot Password</a>
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
            <span className={styles.dividerText}>Artisanal Systems</span>
            <div className={styles.dividerLine}></div>
          </div>
        </div>
      </section>

      {/* Right Side: Visual Narrative */}
      <section className={styles.rightSide}>
        <div className={styles.bgImageContainer}>
          <img src={background} alt="Bread Faculty Boutique" className={styles.bgImage} />
        </div>
      </section>
    </main>
  );
}
