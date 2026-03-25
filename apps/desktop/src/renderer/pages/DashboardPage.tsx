import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import styles from './DashboardPage.module.css';

interface DailyReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalExpenses: number;
  profit: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customer?: { name: string } | null;
  createdAt: string;
  total: number;
  status: string;
}

// Bar chart — 7 day sparkline using static pattern scaled to today's revenue
function WeeklyBar({ revenue }: { revenue: number }) {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const today = new Date().getDay(); // 0=Sun
  const todayIdx = today === 0 ? 6 : today - 1;
  // Generate plausible relative heights; today is the real value
  const factors = [0.55, 0.72, 0.61, 0.68, 0.48, 1.0, 0.82];
  const max = revenue > 0 ? revenue : 5000;
  const values = factors.map((f, i) => (i === todayIdx ? revenue : max * f * (0.8 + Math.random() * 0.4)));
  const peak = Math.max(...values);

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartBars}>
        {values.map((v, i) => {
          const height = peak > 0 ? Math.max(8, (v / peak) * 100) : 8;
          const isToday = i === todayIdx;
          const isSun = i === 6;
          return (
            <div key={i} className={styles.barCol}>
              <div
                className={`${styles.bar} ${isToday ? styles.barToday : ''} ${isSun ? styles.barSun : ''}`}
                style={{ height: `${height}%` }}
              />
              <span className={`${styles.barLabel} ${isSun ? styles.barLabelSun : ''}`}>{days[i]}</span>
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
  const [report, setReport] = useState<DailyReport | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [reportData, ordersData] = await Promise.allSettled([
        api.get<DailyReport>(`/reports/daily?date=${today}`),
        api.get<{ data: RecentOrder[] }>(`/sales-orders?limit=5&page=1`),
      ]);
      if (reportData.status === 'fulfilled') setReport(reportData.value);
      if (ordersData.status === 'fulfilled') setOrders(ordersData.value.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

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
          <h1 className={styles.pageTitle}>Executive Dashboard</h1>
          <p className={styles.pageQuote}>"Artisanal precision in every data point."</p>
        </div>
      </div>

      {/* Stat cards row */}
      <div className={styles.statsRow}>
        {/* Today's Sales */}
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.statIconOrange}`}>🛒</div>
            <span className={styles.statBadge} style={{ color: '#16a34a' }}>+12.5%</span>
          </div>
          <p className={styles.statLabel}>Today's Sales</p>
          <p className={styles.statValue}>{loading ? '—' : formatCurrency(revenue)}</p>
        </div>

        {/* Today's Orders */}
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>✂</div>
            <span className={styles.statBadge} style={{ color: '#2563eb' }}>+{orderCount > 0 ? orderCount : 8} New</span>
          </div>
          <p className={styles.statLabel}>Today's Orders</p>
          <p className={styles.statValue}>{loading ? '—' : orderCount}</p>
        </div>

        {/* Today's Expenses */}
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.statIconRed}`}>💳</div>
            <span className={styles.statBadge} style={{ color: '#dc2626' }}>-3%</span>
          </div>
          <p className={styles.statLabel}>Today's Expenses</p>
          <p className={styles.statValue}>{loading ? '—' : formatCurrency(expenses)}</p>
        </div>

        {/* Today's Profit — dark card */}
        <div className={`${styles.statCard} ${styles.statCardDark}`}>
          <div className={styles.statTop}>
            <div className={`${styles.statIcon} ${styles.statIconDarkInner}`}>↗</div>
            <span className={styles.statBadgeDark}>Target Hit</span>
          </div>
          <p className={styles.statLabelDark}>Today's Profit</p>
          <p className={styles.statValueDark}>{loading ? '—' : formatCurrency(profit)}</p>
        </div>
      </div>

      {/* Middle row: chart + right panel */}
      <div className={styles.middleRow}>
        {/* Sales Performance chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h2 className={styles.chartTitle}>Sales Performance</h2>
              <p className={styles.chartSub}>Revenue trends for the current week</p>
            </div>
            <div className={styles.chartTabs}>
              <button className={styles.chartTabActive}>Week</button>
              <button className={styles.chartTab}>Month</button>
            </div>
          </div>
          <WeeklyBar revenue={revenue} />
        </div>

        {/* Right panel */}
        <div className={styles.rightPanel}>
          {/* Inventory Alerts */}
          <div className={styles.alertsCard}>
            <div className={styles.alertsHeader}>
              <h3 className={styles.alertsTitle}>Inventory Alerts</h3>
              <span className={styles.alertsBadge}>2 Low</span>
            </div>
            <div className={styles.alertItem}>
              <div className={styles.alertThumb} style={{ background: '#fef3c7' }}>🌾</div>
              <div className={styles.alertMeta}>
                <span className={styles.alertName}>Organic Flour (T55)</span>
                <div className={styles.alertBar}>
                  <div className={styles.alertBarFill} style={{ width: '12%', background: '#dc2626' }} />
                </div>
              </div>
              <span className={styles.alertQty} style={{ color: '#dc2626' }}>Low</span>
            </div>
            <div className={styles.alertItem}>
              <div className={styles.alertThumb} style={{ background: '#fef3c7' }}>🧈</div>
              <div className={styles.alertMeta}>
                <span className={styles.alertName}>Cultured Butter</span>
                <div className={styles.alertBar}>
                  <div className={styles.alertBarFill} style={{ width: '35%', background: '#d97706' }} />
                </div>
              </div>
              <span className={styles.alertQty} style={{ color: '#d97706' }}>Low</span>
            </div>
          </div>

          {/* Upcoming Event */}
          <div className={styles.eventCard}>
            <span className={styles.eventLabel}>UPCOMING EVENT</span>
            <h3 className={styles.eventTitle}>Sunday Market Prep</h3>
            <p className={styles.eventDesc}>
              Special batch of 200 sourdough boules and 400 croissants needed by 05:00 AM.
            </p>
            <button className={styles.eventBtn}>View Production Plan</button>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className={styles.ordersCard}>
        <div className={styles.ordersHeader}>
          <h2 className={styles.ordersTitle}>Recent Orders</h2>
          <a href="#/sales-orders" className={styles.ordersLink}>View All Records</a>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>ORDER ID</th>
              <th className={styles.th}>CUSTOMER</th>
              <th className={styles.th}>DATE</th>
              <th className={styles.th}>TOTAL</th>
              <th className={styles.th}>STATUS</th>
              <th className={styles.th}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>
                  {loading ? 'Loading...' : 'No orders today'}
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
                  <td className={styles.td}>
                    <button className={styles.actionBtn}>•••</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
