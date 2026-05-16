import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { useToast } from './Toast';
import styles from './RoleSwitcher.module.css';

/** Dev-only quick role switcher. Logs in as one of the seed accounts so you
 *  can flip the entire interface (UI gates + JWT + permissions) without
 *  manually logging out. Hidden in production builds. */

interface DevAccount {
  role: 'admin' | 'owner' | 'cashier' | 'baker';
  label: string;
  email: string;
  password: string;
  glyph: string;
}

// These mirror the seed.ts credentials (apps/server/prisma/seed.ts).
const ACCOUNTS: DevAccount[] = [
  { role: 'admin',   label: 'Admin',   email: 'admin@bakery.com',   password: 'admin123',   glyph: '⚙' },
  { role: 'cashier', label: 'Cashier', email: 'cashier@bakery.com', password: 'cashier123', glyph: '🛒' },
  { role: 'baker',   label: 'Baker',   email: 'baker@bakery.com',   password: 'baker123',   glyph: '🥖' },
];

export function RoleSwitcher() {
  // Vite sets `import.meta.env.DEV` true only in `npm run dev`. The switcher
  // disappears entirely in production builds.
  if (!import.meta.env.DEV) return null;

  const { user, login } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const handleSwitch = async (account: DevAccount) => {
    if (account.email === user?.email) return; // already this role
    setBusy(account.email);
    try {
      await login(account.email, account.password);
      showToast(`Switched to ${account.label}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Switch failed';
      showToast(`Couldn't switch to ${account.label}: ${msg}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.wrap} role="group" aria-label="Dev role switcher">
      <span className={styles.devLabel} title="Visible only in development builds">DEV</span>
      <div className={styles.pillRow}>
        {ACCOUNTS.map((account) => {
          const isActive = user?.email === account.email;
          const isBusy = busy === account.email;
          return (
            <button
              key={account.email}
              type="button"
              className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
              onClick={() => handleSwitch(account)}
              disabled={isBusy || isActive}
              title={`${account.label} — ${account.email}`}
            >
              <span className={styles.pillGlyph} aria-hidden="true">{account.glyph}</span>
              <span className={styles.pillLabel}>{isBusy ? '…' : account.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
