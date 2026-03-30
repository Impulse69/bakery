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
  icon: React.ReactNode;
}

// ── Icons ──────────────────────────────────────
const IconLayout  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const IconPOS     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="12" width="20" height="8" rx="2"/><path d="M7 15h0M12 15h0M17 15h0M7 18h0M12 18h0M17 18h0"/><path d="M7 2h10l2 10H5L7 2Z"/></svg>;
const IconOrders  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6M16 12H8M10 16H8"/></svg>;
const IconProducts = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.6 7.5-.7 1.1c-.2.4-.1.9.3 1.2l3 3.1c.4.4 1.1.4 1.5 0l2.2-2.3c.4-.4.4-1.1 0-1.5l-6.3-1.6Z"/><path d="m8.4 7.5.7 1.1c.2.4.1.9-.3 1.2l-3 3.1c-.4.4-1.1.4-1.5 0l-2.2-2.3c-.4-.4-.4-1.1 0-1.5l6.3-1.6Z"/><path d="M6 12h12"/><path d="M12 16.5V22l-4-1V5.4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15.6l-4 1V16.5Z"/></svg>;
const IconBox     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
const IconCounts  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13h5"/><path d="M2 18h5"/><path d="M2 8h5"/><path d="m12 19 2 2 4-4"/><path d="m12 9 2 2 4-4"/></svg>;
const IconFactory = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 20 2-2h4v-2l-2-2v-4a6 6 0 0 0-11.41-2.58l-2 2V13l2 2v4a2 2 0 0 0 2 2h5Z"/><path d="M16 10V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5"/></svg>;
const IconTruck   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><circle cx="7" cy="18" r="2"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10h1"/><circle cx="17" cy="18" r="2"/></svg>;
const IconCart    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.56-7.43H5.12"/></svg>;
const IconMoney   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
const IconUsers   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconChart   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;
const IconSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72v.18a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

const MENU_ITEMS: MenuItem[] = [
  { path: '/sales-orders', label: 'Sales',            permission: 'sales:view',     icon: <IconOrders /> },
  { path: '/customers',    label: 'Customers',        permission: 'customers:view', icon: <IconUsers /> },
  { path: '/products',     label: 'Products',         permission: 'products:view',  icon: <IconProducts /> },
  { path: '/inventory',    label: 'Stock',            permission: 'inventory:view', icon: <IconBox /> },
  { path: '/production',   label: 'Online Catalog',   permission: 'production:view', icon: <IconFactory /> },
  { path: '/expenses',     label: 'Accounts Payable', permission: 'expenses:view',  icon: <IconMoney /> },
  { path: '/pos',          label: 'Register',         permission: 'sales:create',   icon: <IconPOS /> },
  { path: '/reports',      label: 'Statistics',       permission: 'reports:view',   icon: <IconChart /> },
  { path: '/settings',     label: 'Help Center',      permission: 'settings:view',  icon: <IconSettings /> },
  { path: '/',             label: 'App',              permission: 'dashboard:view', icon: <IconLayout /> },
];

interface SidebarProps {
  role: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const IconHamburger = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export function Sidebar({ role, collapsed, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const visibleItems = MENU_ITEMS.filter((item) => can(role, item.permission));

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      {/* Brand */}
      <div className={styles.brand}>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconHamburger />
        </button>
        <img src={logo} alt="Bread Faculty" className={styles.brandLogo} />
        <div className={`${styles.brandText} ${collapsed ? styles.hiddenText : ''}`}>
          <span className={styles.brandName}>Bread Faculty</span>
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
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={`${styles.label} ${collapsed ? styles.hiddenText : ''}`}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer user card */}
      {user && (
        <div className={styles.userCard}>
          <div className={styles.userAvatarWrap}>
            <img src={logo} alt={user.name} className={styles.userAvatar} />
          </div>
          <div className={`${styles.userMeta} ${collapsed ? styles.hiddenText : ''}`}>
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
