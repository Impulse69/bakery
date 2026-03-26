import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/AuthContext';
import styles from './DashboardPage.module.css';

function getDashboardTitle(role: string | undefined): string {
  if (role === 'admin')   return 'Executive Dashboard';
  if (role === 'cashier') return 'Sales Dashboard';
  if (role === 'baker')   return 'Production Dashboard';
  if (role === 'owner')   return 'Owner Dashboard';
  return 'Dashboard';
}

interface DailyReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalExpenses: number;
  profit: number;
}

interface WeeklyEntry {
  date: string;
  revenue: number;
}

interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customer?: { name: string } | null;
  createdAt: string;
  total: number;
  status: string;
}

// ── Icons ──────────────────────────────────────
const IconSales = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e07b3c' }}>
    <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.56-7.43H5.12"/>
  </svg>
);

const IconOrders = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#2563eb' }}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2v0a5 5 0 0 0-5 5v8c0 1.1.9 2 2 2h1a2 2 0 0 0 2-2z"/>
    <path d="M18 17v5"/>
  </svg>
);

const IconExpenses = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#dc2626' }}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);

const IconProfit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fbd5b5' }}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);

// Bar chart — real 7-day data
function WeeklyBar({ weeklyData }: { weeklyData: WeeklyEntry[] }) {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const todayISO = new Date().toISOString().split('T')[0];
  const peak = Math.max(...weeklyData.map((d) => d.revenue), 1);

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartBars}>
        {weeklyData.map((entry, i) => {
          const height = Math.max(4, (entry.revenue / peak) * 100);
          const isToday = entry.date === todayISO;
          const dayLabel = days[new Date(entry.date + 'T12:00:00').getDay() === 0 ? 6 : new Date(entry.date + 'T12:00:00').getDay() - 1];
          const isSun = new Date(entry.date + 'T12:00:00').getDay() === 0;
          return (
            <div key={i} className={styles.barCol}>
              <div
                className={`${styles.bar} ${isToday ? styles.barToday : ''} ${isSun ? styles.barSun : ''}`}
                style={{ height: `${height}%` }}
              />
              <span className={`${styles.barLabel} ${isSun ? styles.barLabelSun : ''}`}>{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  paid: '#16a34a',
  draft: '#6b7280',
  confirmed: '#2563eb',
  invoiced: '#d97706',
  cancelled: '#dc2626',
  picked: '#7c3aed',
};

export function DashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyEntry[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const role = user?.role;
  const canSeeSales = role === 'admin' || role === 'owner' || role === 'cashier';
  const canSeeExpenses = role === 'admin' || role === 'owner';

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const calls: Promise<unknown>[] = [api.get<LowStockItem[]>('/inventory/low-stock')];
      if (canSeeSales) {
        calls.push(
          api.get<DailyReport>(`/reports/daily?date=${today}`),
          api.get<WeeklyEntry[]>(`/reports/weekly?endDate=${today}`),
          api.get<{ data: RecentOrder[] }>('/sales-orders?limit=5&page=1'),
        );
      } else if (canSeeExpenses) {
        calls.push(api.get<DailyReport>(`/reports/daily?date=${today}`));
      }
      const results = await Promise.allSettled(calls);
      const lowStockRes = results[0];
      if (lowStockRes.status === 'fulfilled') setLowStock(lowStockRes.value as LowStockItem[]);
      if (canSeeSales) {
        const [, reportRes, weeklyRes, ordersRes] = results as PromiseSettledResult<unknown>[];
        if (reportRes?.status === 'fulfilled') setReport(reportRes.value as DailyReport);
        if (weeklyRes?.status === 'fulfilled') setWeeklyData(weeklyRes.value as WeeklyEntry[]);
        if (ordersRes?.status === 'fulfilled') setOrders((ordersRes.value as { data: RecentOrder[] }).data ?? []);
      } else if (canSeeExpenses) {
        const reportRes = results[1];
        if (reportRes?.status === 'fulfilled') setReport(reportRes.value as DailyReport);
      }
    } finally {
      setLoading(false);
    }
  }, [canSeeSales, canSeeExpenses]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('sale:created', fetchData);
    return () => { socket.off('sale:created', fetchData); };
  }, [fetchData]);

  const revenue = report?.totalRevenue ?? 0;
  const expenses = report?.totalExpenses ?? 0;
  const profit = report?.profit ?? 0;
  const orderCount = report?.totalOrders ?? 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{getDashboardTitle(user?.role)}</h1>
          <p className={styles.pageQuote}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stat cards row */}
      {(canSeeSales || canSeeExpenses) && (
        <div className={styles.statsRow}>
          {canSeeSales && (
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <div className={`${styles.statIcon} ${styles.statIconOrange}`}><IconSales /></div>
              </div>
              <p className={styles.statLabel}>Today's Sales</p>
              <p className={styles.statValue}>{loading ? '—' : formatCurrency(revenue)}</p>
            </div>
          )}

          {canSeeSales && (
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <div className={`${styles.statIcon} ${styles.statIconBlue}`}><IconOrders /></div>
                {orderCount > 0 && (
                  <span className={styles.statBadge} style={{ color: '#2563eb' }}>+{orderCount} Today</span>
                )}
              </div>
              <p className={styles.statLabel}>Today's Orders</p>
              <p className={styles.statValue}>{loading ? '—' : orderCount}</p>
            </div>
          )}

          {canSeeExpenses && (
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <div className={`${styles.statIcon} ${styles.statIconRed}`}><IconExpenses /></div>
              </div>
              <p className={styles.statLabel}>Today's Expenses</p>
              <p className={styles.statValue}>{loading ? '—' : formatCurrency(expenses)}</p>
            </div>
          )}

          {canSeeExpenses && (
            <div className={`${styles.statCard} ${styles.statCardDark}`}>
              <div className={styles.statTop}>
                <div className={`${styles.statIcon} ${styles.statIconDarkInner}`}><IconProfit /></div>
              </div>
              <p className={styles.statLabelDark}>Today's Profit</p>
              <p className={styles.statValueDark}>{loading ? '—' : formatCurrency(profit)}</p>
            </div>
          )}
        </div>
      )}

      {/* Middle row: chart + right panel */}
      <div className={styles.middleRow}>
        {/* Sales Performance chart */}
        {canSeeSales && (
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>Sales Performance</h2>
                <p className={styles.chartSub}>Revenue trends for the past 7 days</p>
              </div>
            </div>
            {weeklyData.length > 0
              ? <WeeklyBar weeklyData={weeklyData} />
              : <div style={{ padding: '2rem', color: '#9ca3af', fontSize: '0.875rem' }}>No sales data yet</div>
            }
          </div>
        )}

        {/* Right panel — Inventory Alerts only */}
        <div className={styles.rightPanel}>
          <div className={styles.alertsCard}>
            <div className={styles.alertsHeader}>
              <h3 className={styles.alertsTitle}>Inventory Alerts</h3>
              {lowStock.length > 0 && (
                <span className={styles.alertsBadge}>{lowStock.length} Low</span>
              )}
            </div>
            {loading ? (
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', padding: '0.5rem 0' }}>Loading...</p>
            ) : lowStock.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: '#16a34a', padding: '0.5rem 0' }}>All items sufficiently stocked</p>
            ) : (
              lowStock.slice(0, 5).map((item) => {
                const pct = item.lowStockThreshold > 0
                  ? Math.min(100, Math.round((item.quantityOnHand / item.lowStockThreshold) * 100))
                  : 0;
                const color = pct <= 25 ? '#dc2626' : '#d97706';
                return (
                  <div key={item.id} className={styles.alertItem}>
                    <div className={styles.alertMeta}>
                      <span className={styles.alertName}>{item.name}</span>
                      <div className={styles.alertBar}>
                        <div className={styles.alertBarFill} style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {item.quantityOnHand} / {item.lowStockThreshold} {item.unit}
                      </span>
                    </div>
                    <span className={styles.alertQty} style={{ color }}>Low</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      {canSeeSales && <div className={styles.ordersCard}>
        <div className={styles.ordersHeader}>
          <h2 className={styles.ordersTitle}>Recent Orders</h2>
          <a href="#/sales-orders" className={styles.ordersLink}>View All Records</a>
        </div>
        <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>ORDER ID</th>
              <th className={styles.th}>CUSTOMER</th>
              <th className={styles.th}>DATE</th>
              <th className={styles.th}>TOTAL</th>
              <th className={styles.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>
                  {loading ? 'Loading...' : 'No orders yet'}
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className={styles.tr}>
                  <td className={styles.td}>{o.orderNumber}</td>
                  <td className={styles.td}>{o.customer?.name ?? 'Walk-in'}</td>
                  <td className={styles.td}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className={styles.td}>{formatCurrency(o.total)}</td>
                  <td className={styles.td}>
                    <span
                      className={styles.statusPill}
                      style={{ color: STATUS_COLORS[o.status] ?? '#6b7280', background: `${STATUS_COLORS[o.status] ?? '#6b7280'}18` }}
                    >
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>}
    </div>
  );
}
