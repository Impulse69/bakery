import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { can } from '@bakery/utils';
import { UsersTab } from '../components/settings/UsersTab';
import { ProfileTab } from '../components/settings/ProfileTab';
import { DevToolsCard } from '../components/settings/DevToolsCard';
import styles from './SettingsPage.module.css';

type Tab = 'users' | 'profile' | 'shop';

export function SettingsPage() {
  const { user } = useAuth();
  const canManageUsers = user ? can(user.role, 'users:create') || can(user.role, 'users:edit') : false;
  // Default tab: admin/owner land on Users, everyone else on Profile.
  const [tab, setTab] = useState<Tab>(canManageUsers ? 'users' : 'profile');

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Settings</span>
          <h1 className={styles.heading}>Settings</h1>
          <p className={styles.heroQuote}>
            <em>Accounts, passwords, and the shop&rsquo;s standing instructions.</em>
          </p>
        </div>
      </header>

      <div className={styles.tabsCard}>
        <div className={styles.tabsRow}>
          {canManageUsers && (
            <button
              type="button"
              className={`${styles.tab} ${tab === 'users' ? styles.tabActive : ''}`}
              onClick={() => setTab('users')}
            >
              Users
            </button>
          )}
          <button
            type="button"
            className={`${styles.tab} ${tab === 'profile' ? styles.tabActive : ''}`}
            onClick={() => setTab('profile')}
          >
            My Profile
          </button>
          {canManageUsers && (
            <button
              type="button"
              className={`${styles.tab} ${tab === 'shop' ? styles.tabActive : ''}`}
              onClick={() => setTab('shop')}
            >
              Shop
            </button>
          )}
        </div>
      </div>

      {tab === 'users' && canManageUsers && <UsersTab currentUserId={user?.id ?? ''} />}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'shop' && canManageUsers && (
        <div>
          <div className={styles.placeholder}>
            <p>Shop settings (name, address, tax rate, receipt header) coming soon.</p>
          </div>
          {import.meta.env.DEV && user?.role === 'admin' && <DevToolsCard />}
        </div>
      )}
    </div>
  );
}
