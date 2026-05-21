import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { can } from '@bakery/utils';
import type { UserRole, Customer } from '@bakery/types';
import { useAuth } from '../store/AuthContext';
import styles from './Sidebar.module.css';
import logo from '../assets/logo.png';
import { Modal, Input, Button, SearchInput } from '@bakery/ui';
import { api } from '../lib/api';

interface MenuItem {
  path: string;
  label: string;
  permission: string;
  icon: React.ReactNode;
}

// ── Icons ──────────────────────────────────────
const IconPlus = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconCaretRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

const IconLayout = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
const IconPOS = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
const IconOrders = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6"/><path d="M9 16h6"/><path d="M9 8h6"/></svg>;
const IconProducts = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const IconBox = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IconFactory = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>;
const IconMoney = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
const IconUsers = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconChart = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

const MENU_ITEMS: MenuItem[] = [
  { path: '/', label: 'Dashboard', permission: 'dashboard:view', icon: <IconLayout /> },
  { path: '/pos', label: 'Sales Order', permission: 'sales:create', icon: <IconPOS /> },
  { path: '/sales-orders', label: 'Sales Records', permission: 'sales:view', icon: <IconOrders /> },
  { path: '/customers', label: 'Customer List', permission: 'customers:view', icon: <IconUsers /> },
  { path: '/products', label: 'Product List', permission: 'products:view', icon: <IconProducts /> },
  { path: '/inventory', label: 'Inventory Stock', permission: 'inventory:view', icon: <IconBox /> },
  { path: '/production', label: 'Purchase Order', permission: 'production:view', icon: <IconFactory /> },
  { path: '/expenses', label: 'Accounts Payable', permission: 'expenses:view', icon: <IconMoney /> },
  { path: '/reports', label: 'Reports', permission: 'reports:view', icon: <IconChart /> },
  { path: '/settings', label: 'System Setup', permission: 'settings:view', icon: <IconSettings /> },
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
  const navigate = useNavigate();
  const visibleItems = MENU_ITEMS.filter((item) => can(role, item.permission));
  
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Customer selection modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setCreateMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [createMenuRef]);

  useEffect(() => {
    if (showCustomerModal) {
      api.get<{ data: Customer[] }>('/customers?limit=50')
        .then(res => setCustomers(res.data))
        .catch(console.error);
    }
  }, [showCustomerModal]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const handleCreateSalesOrder = () => {
    setCreateMenuOpen(false);
    setShowCustomerModal(true);
  };

  const handleSelectCustomer = (customerId: string) => {
    setShowCustomerModal(false);
    navigate(`/pos?customerId=${customerId}`);
  };

  const handleContinueWithoutCustomer = () => {
    setShowCustomerModal(false);
    navigate('/pos');
  };

  return (
    <>
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
          <div className={`${styles.brandText} ${collapsed ? styles.hiddenText : ''}`}>
            <span className={styles.brandName}>Bread Faculty</span>
            <span className={styles.brandSub}>PREMIUM BAKERY MANAGEMENT</span>
          </div>
        </div>

        {/* Global Create Actions */}
        <div 
          className={styles.createArea} 
          ref={createMenuRef}
          onMouseEnter={() => { if (collapsed) setCreateMenuOpen(true); }}
          onMouseLeave={() => { if (collapsed) setCreateMenuOpen(false); }}
        >
          <button 
            className={styles.createBtn}
            onClick={() => { if (!collapsed) setCreateMenuOpen(!createMenuOpen); }}
            title="Create new"
          >
            <div className={styles.createBtnIcon}><IconPlus /></div>
            <span className={`${styles.createBtnText} ${collapsed ? styles.hiddenText : ''}`}>Create new</span>
            <span className={`${styles.createBtnCaret} ${collapsed ? styles.hiddenText : ''}`}><IconCaretRight /></span>
          </button>
          
          {createMenuOpen && (
            <div className={styles.createMenu}>
              <div className={styles.createMenuHeader}>Create new</div>
              <div className={styles.createMenuGroup}>
                <button onClick={handleCreateSalesOrder} className={styles.createMenuItem}>
                  <IconPOS /> Sales order
                </button>
                <button onClick={() => { setCreateMenuOpen(false); navigate('/customers?action=new'); }} className={styles.createMenuItem}>
                  <IconUsers /> Customer
                </button>
                <button onClick={() => { setCreateMenuOpen(false); navigate('/products?action=new'); }} className={styles.createMenuItem}>
                  <IconProducts /> Product
                </button>
                <button onClick={() => { setCreateMenuOpen(false); navigate('/inventory?action=new'); }} className={styles.createMenuItem}>
                  <IconBox /> Adjustment
                </button>
              </div>
            </div>
          )}
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

      {/* Select Customer Modal */}
      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Select Customer" size="md">
        <div className={styles.customerModalContent}>
          <div className={styles.customerSearchWrap}>
            <SearchInput
              value={customerSearch}
              onChange={setCustomerSearch}
              placeholder="Search by name or phone..."
            />
          </div>
          
          <button 
            className={styles.addCustomerShortcut}
            onClick={() => { setShowCustomerModal(false); navigate('/customers?action=new'); }}
          >
            <div className={styles.shortcutAvatar}>+</div>
            <div className={styles.shortcutText}>
              <strong>Add new customer</strong>
              <span>Create a new customer profile and continue to sales terminal.</span>
            </div>
          </button>

          <div className={styles.customerList}>
            {filteredCustomers.length === 0 ? (
              <div className={styles.noCustomers}>No customers found matching that search.</div>
            ) : (
              filteredCustomers.map(c => (
                <button key={c.id} className={styles.customerListItem} onClick={() => handleSelectCustomer(c.id)}>
                  <div className={styles.listAvatar}>{c.name.charAt(0).toUpperCase()}</div>
                  <div className={styles.listInfo}>
                    <span className={styles.listName}>{c.name}</span>
                    <span className={styles.listPhone}>{c.phone || c.email || 'No contact info'}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className={styles.customerModalFooter}>
            <Button variant="ghost" onClick={handleContinueWithoutCustomer}>Continue without customer</Button>
            <Button variant="ghost" onClick={() => setShowCustomerModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

