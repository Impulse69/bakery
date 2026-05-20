import { useState } from 'react';
import { Button, Input } from '@bakery/ui';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../Toast';
import { api } from '../../lib/api';
import styles from './ProfileTab.module.css';

/** Profile tab — every signed-in user can change their own password here. */
export function ProfileTab() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Fill both password fields', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords don't match", 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      showToast('Password changed. Please log in with the new password.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Force re-login so the new token reflects the cleared mustChangePassword flag.
      setTimeout(() => logout(), 1000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Change failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <header className={styles.cardHead}>
          <span className={styles.eyebrow}>Account</span>
          <h2 className={styles.title}>Your details</h2>
        </header>
        <dl className={styles.details}>
          <div className={styles.row}>
            <dt>Name</dt>
            <dd>{user?.name ?? '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Email</dt>
            <dd>{user?.email ?? '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Role</dt>
            <dd className={styles.roleVal}>{user?.role ?? '—'}</dd>
          </div>
        </dl>
        <p className={styles.detailsNote}>
          To change your name, email, or role, ask an admin to update your account from Users.
        </p>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHead}>
          <span className={styles.eyebrow}>Security</span>
          <h2 className={styles.title}>Change password</h2>
        </header>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 6 characters"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <div className={styles.formActions}>
            <Button type="submit" loading={saving}>Change password</Button>
          </div>
          <p className={styles.formNote}>
            You&rsquo;ll be logged out after a successful change. Sign back in with the new password.
          </p>
        </form>
      </section>
    </div>
  );
}
