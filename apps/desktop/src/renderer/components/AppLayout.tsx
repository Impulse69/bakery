import { Outlet } from 'react-router-dom';
import { Badge, Button } from '@bakery/ui';
import { useAuth } from '../store/AuthContext';
import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className={styles.layout}>
      <Sidebar role={user.role} />
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <Badge variant="info">{user.role}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
