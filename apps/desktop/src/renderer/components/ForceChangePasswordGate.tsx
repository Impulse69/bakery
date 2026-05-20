import { useState, type ReactNode } from 'react';
import { Modal, Button, Input } from '@bakery/ui';
import { useAuth } from '../store/AuthContext';
import { useToast } from './Toast';
import { api } from '../lib/api';
import styles from './ForceChangePasswordGate.module.css';

interface Props {
  children: ReactNode;
}

/**
 * Wraps the authenticated app. When the current user has
 * `mustChangePassword === true` (set after an admin reset), shows a blocking
 * modal that demands a new password before the rest of the UI is reachable.
 */
export function ForceChangePasswordGate({ children }: Props) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const mustChange = !!user?.mustChangePassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Fill both fields', 'error');
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
      showToast('Password changed. Please log in again.', 'success');
      // Force a clean re-login so the new token + cleared flag both come down fresh.
      setTimeout(() => logout(), 800);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Change failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {children}
      {mustChange && (
        <Modal isOpen onClose={() => { /* not dismissible */ }} title="Set a new password" size="sm">
          <div className={styles.body}>
            <p className={styles.intro}>
              An admin has reset your password. Choose a new one before continuing.
            </p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                label="Current (temporary) password"
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
              <div className={styles.actions}>
                <Button type="button" variant="ghost" onClick={logout}>
                  Sign out
                </Button>
                <Button type="submit" loading={saving}>
                  Set password
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
