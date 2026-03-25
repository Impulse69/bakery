import { NavLink } from 'react-router-dom';
import { can } from '@bakery/utils';
import type { UserRole } from '@bakery/types';
import { useAuth } from '../store/AuthContext';
import styles from './Sidebar.module.css';
import logo from '../assets/logo.png';

interface MenuItem {
  path: string;
  label: string;
  permission: string;
  icon: string;
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/',                 label: 'Dashboard',         permission: 'dashboard:view',       icon: '▦' },
  { path: '/pos',              label: 'POS / New Sale',    permission: 'sales:create',         icon: '⊟' },
  { path: '/sales-orders',     label: 'Sales Orders',      permission: 'sales:view',           icon: '▤' },
  { path: '/products',         label: 'Products',          permission: 'products:view',        icon: '◫' },
  { path: '/inventory',        label: 'Inventory',         permission: 'inventory:view',       icon: '▣' },
  { path: '/inventory-counts', label: 'Inventory Counts',  permission: 'inventory:view',       icon: '≋' },
  { path: '/production',       label: 'Production',        permission: 'production:view',      icon: '⚙' },
  { path: '/suppliers',        label: 'Suppliers',         permission: 'suppliers:view',       icon: '◎' },
  { path: '/purchase-orders',  label: 'Purchase Orders',   permission: 'purchase-orders:view', icon: '◈' },
  { path: '/expenses',         label: 'Expenses',          permission: 'expenses:view',        icon: '◉' },
  { path: '/customers',        label: 'Customers',         permission: 'customers:view',       icon: '◌' },
  { path: '/reports',          label: 'Reports',           permission: 'reports:view',         icon: '◑' },
  { path: '/settings',         label: 'Settings',          permission: 'settings:view',        icon: '⊕' },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const { user } = useAuth();
  const visibleItems = MENU_ITEMS.filter((item) => can(role, item.permission));

  return (
    <aside className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <img src={logo} alt="Bread Faculty" className={styles.brandLogo} />
        <div className={styles.brandText}>
          <span className={styles.brandName}>The Artisanal Curator</span>
          <span className={styles.brandSub}>PREMIUM BAKERY MANAGEMENT</span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer user card */}
      {user && (
        <div className={styles.userCard}>
          <div className={styles.userAvatarWrap}>
            <img src={logo} alt={user.name} className={styles.userAvatar} />
          </div>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userPlan}>
              {user.role === 'admin' ? 'Premium Plan' : `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`}
            </span>
            <span className={styles.userStatus}>Status: Active Member</span>
          </div>
        </div>
      )}
    </aside>
  );
}
