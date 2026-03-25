import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button } from '@bakery/ui';
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
    <div className={styles.wrapper} style={{ backgroundImage: `url(${background})` }}>
      <div className={styles.overlay} />
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Bread Faculty" className={styles.logo} />
        </div>
        <h1 className={styles.title}>Bread Faculty</h1>
        <p className={styles.subtitle}>Sign in to your account</p>

        {error && <div className={styles.error}>{error}</div>}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />

        <Button type="submit" loading={loading} disabled={!email || !password}>
          Sign In
        </Button>
      </form>
    </div>
  );
}
