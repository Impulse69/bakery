import { NavLink } from 'react-router-dom';
import { can } from '@bakery/utils';
import type { UserRole } from '@bakery/types';
import styles from './Sidebar.module.css';

interface MenuItem {
  path: string;
  label: string;
  permission: string;
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/', label: 'Dashboard', permission: 'dashboard:view' },
  { path: '/pos', label: 'POS / New Sale', permission: 'sales:create' },
  { path: '/sales-orders', label: 'Sales Orders', permission: 'sales:view' },
  { path: '/products', label: 'Products', permission: 'products:view' },
  { path: '/inventory', label: 'Inventory', permission: 'inventory:view' },
  { path: '/inventory-counts', label: 'Inventory Counts', permission: 'inventory:view' },
  { path: '/production', label: 'Production', permission: 'production:view' },
  { path: '/suppliers', label: 'Suppliers', permission: 'suppliers:view' },
  { path: '/purchase-orders', label: 'Purchase Orders', permission: 'purchase-orders:view' },
  { path: '/expenses', label: 'Expenses', permission: 'expenses:view' },
  { path: '/customers', label: 'Customers', permission: 'customers:view' },
  { path: '/reports', label: 'Reports', permission: 'reports:view' },
  { path: '/settings', label: 'Settings', permission: 'settings:view' },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const visibleItems = MENU_ITEMS.filter((item) => can(role, item.permission));

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>Bread Faculty</div>
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
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
