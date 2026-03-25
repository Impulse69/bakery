import { Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';
import logo from '../assets/logo.png';

export function AppLayout() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleLabel =
    user.role === 'admin' ? 'Master Baker' :
    user.role === 'cashier' ? 'Cashier' :
    user.role === 'baker' ? 'Baker' : user.role;

  return (
    <div className={styles.layout}>
      <Sidebar role={user.role} />
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          {/* Search */}
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search orders, products..."
              readOnly
            />
          </div>

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
