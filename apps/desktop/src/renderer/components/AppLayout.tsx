import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Sidebar } from './Sidebar';
import { LowStockBell } from './LowStockBell';
import { RoleSwitcher } from './RoleSwitcher';
import { ForceChangePasswordGate } from './ForceChangePasswordGate';
import styles from './AppLayout.module.css';
import logo from '../assets/logo.png';

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!user) return null;

  const roleLabel =
    user.role === 'admin' ? 'Master Baker' :
    user.role === 'cashier' ? 'Cashier' :
    user.role === 'baker' ? 'Baker' : user.role;

  return (
    <div className={styles.layout}>
      <Sidebar
        role={user.role}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          {/* Right side */}
          <div className={styles.topbarRight}>
            <div className={`${styles.statusBadge} ${isOnline ? styles.online : styles.offline}`}>
              <span className={styles.statusDot}></span>
              {isOnline ? 'Online' : 'Offline'}
            </div>

            <RoleSwitcher />

            <LowStockBell />
            <button className={styles.iconBtn} title="Help">
              <span style={{ fontWeight: 700 }}>?</span>
            </button>

            <div className={styles.userChip}>
              <div className={styles.userInfo}>
                <span className={styles.userNameTop}>{user.name}</span>
                <span className={styles.userRoleTop}>{roleLabel}</span>
              </div>
              <div className={styles.avatarWrap}>
                <img src={logo} alt={user.name} className={styles.avatar} />
              </div>
            </div>

            <button className={styles.logoutBtn} onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className={styles.content}>
          <ForceChangePasswordGate>
            <Outlet />
          </ForceChangePasswordGate>
        </main>
      </div>
    </div>
  );
}
