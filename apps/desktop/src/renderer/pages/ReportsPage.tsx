import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { CustomerAnalyticsPanel } from '../components/reports/CustomerAnalyticsPanel';
import { CashierActivity } from '../components/reports/CashierActivity';
import { OperationsPanel } from '../components/reports/OperationsPanel';
import styles from './ReportsPage.module.css';

type Tab = 'operations' | 'customers' | 'cashiers';

export function ReportsPage() {
  const { user } = useAuth();
  const canSee = user?.role === 'admin' || user?.role === 'owner';
  const [activeTab, setActiveTab] = useState<Tab>('operations');

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Reports</span>
          <h1 className={styles.heading}>Reports</h1>
          <p className={styles.heroQuote}>
            <em>Sales, stock, customers and cashiers — all in one place.</em>
          </p>
        </div>
      </header>

      <div className={styles.ledgerCard}>
        <div className={styles.tabsRow}>
          {canSee && (
            <button
              className={`${styles.tab} ${activeTab === 'operations' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('operations')}
            >
              Operations
            </button>
          )}
          {canSee && (
            <button
              className={`${styles.tab} ${activeTab === 'customers' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('customers')}
            >
              Customers
            </button>
          )}
          {canSee && (
            <button
              className={`${styles.tab} ${activeTab === 'cashiers' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('cashiers')}
            >
              Cashier Activity
            </button>
          )}
        </div>
      </div>

      {activeTab === 'operations' && canSee && <OperationsPanel />}
      {activeTab === 'customers' && canSee && <CustomerAnalyticsPanel />}
      {activeTab === 'cashiers' && canSee && <CashierActivity />}
    </div>
  );
}
