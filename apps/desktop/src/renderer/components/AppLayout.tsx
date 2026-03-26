import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';
import logo from '../assets/logo.png';

const IconMenu = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    {collapsed
      ? <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
      : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
    }
  </svg>
);

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!user) return null;

  const roleLabel =
    user.role === 'admin' ? 'Master Baker' :
    user.role === 'cashier' ? 'Cashier' :
    user.role === 'baker' ? 'Baker' : user.role;

  return (
    <div className={styles.layout}>
      <Sidebar role={user.role} collapsed={sidebarCollapsed} />
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <button
            className={styles.menuToggle}
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconMenu collapsed={sidebarCollapsed} />
          </button>

          {/* Right side */}
          <div className={styles.topbarRight}>
            <button className={styles.iconBtn} title="Notifications">
              <span>🔔</span>
            </button>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
