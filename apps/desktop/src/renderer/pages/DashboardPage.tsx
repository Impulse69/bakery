import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/AuthContext';
import styles from './DashboardPage.module.css';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getRoleLine(role: string | undefined): string {
  if (role === 'admin') return 'Executive Ledger';
  if (role === 'cashier') return 'Sales Counter';
  if (role === 'baker') return 'Production Floor';
  if (role === 'owner') return 'Owner\u2019s Ledger';
  return 'Bakery Ledger';
}

function formatLongDate(d = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface DailyReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalExpenses: number;
  marginalProfit: number;
  netProfit: number;
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

// ── Icons (line, small) ─────────────────────────────────
const IconCashIn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);

const IconProfit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
  </svg>
);

const IconExpenses = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

const IconOrders = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1.5" /><circle cx="18" cy="21" r="1.5" />
    <path d="M2.5 2.5h3l2.5 12.5a1.8 1.8 0 0 0 1.8 1.4h9a1.8 1.8 0 0 0 1.77-1.4L22 7H6" />
  </svg>
);

const WheatGlyph = () => (
  <svg width="42" height="42" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M32 10v46" stroke="#131b2e" strokeWidth="2" strokeLinecap="round" />
    <g stroke="#e07b3c" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M32 20c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 20c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
      <path d="M32 30c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 30c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
      <path d="M32 40c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 40c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
      <path d="M32 50c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 50c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
    </g>
  </svg>
);

// ── Bar chart — real 7-day data ─────────────────────────
function WeeklyBar({ weeklyData }: { weeklyData: WeeklyEntry[] }) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todayISO = new Date().toISOString().split('T')[0];
  const peak = Math.max(...weeklyData.map((d) => d.revenue), 1);
  const peakIdx = weeklyData.findIndex((d) => d.revenue === peak);

  return (
    <div className={styles.chartWrap}>
      {/* horizontal ruling lines */}
      <div className={styles.chartRules} aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className={styles.chartBars}>
        {weeklyData.map((entry, i) => {
          const height = Math.max(4, (entry.revenue / peak) * 100);
          const isToday = entry.date === todayISO;
          const dayLabel = days[i];
          const isSun = i === 0;
          const isPeak = i === peakIdx && entry.revenue > 0;
          return (
            <div key={i} className={styles.barCol}>
              {isPeak && (
                <span className={styles.peakTag}>
                  {formatCurrency(entry.revenue)}
                </span>
              )}
              <div
                className={`${styles.bar} ${isToday ? styles.barToday : ''} ${isSun ? styles.barSun : ''}`}
                style={{ height: `${height}%`, animationDelay: `${i * 60}ms` }}
              />
              <span className={`${styles.barLabel} ${isToday ? styles.barLabelToday : ''} ${isSun ? styles.barLabelSun : ''}`}>
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  paid:      { color: '#15803d', bg: 'rgba(21, 128, 61, 0.12)',  label: 'Paid' },
  draft:     { color: '#57534e', bg: 'rgba(87, 83, 78, 0.12)',   label: 'Draft' },
  confirmed: { color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.12)',  label: 'Confirmed' },
  invoiced:  { color: '#b45309', bg: 'rgba(180, 83, 9, 0.14)',   label: 'Invoiced' },
  cancelled: { color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.12)',  label: 'Cancelled' },
  picked:    { color: '#6d28d9', bg: 'rgba(109, 40, 217, 0.12)', label: 'Picked' },
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
  const marginalProfit = report?.marginalProfit ?? 0;
  const orderCount = report?.totalOrders ?? 0;

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const weeklyTotal = weeklyData.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className={styles.page}>
      {/* ╭─ Hero ledger banner ─╮ */}
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>{getRoleLine(role)}</span>
          <h1 className={styles.heading}>
            {getGreeting()}, <span className={styles.headingName}>{firstName}</span>
          </h1>
          <p className={styles.heroQuote}>
            <em>A loaf well counted is a loaf well earned.</em>
          </p>
        </div>
        <div className={styles.heroAside}>
          <div className={styles.datePlate}>
            <span className={styles.dateEyebrow}>Entry for</span>
            <span className={styles.dateText}>{formatLongDate()}</span>
            <span className={styles.datePulse}>
              <span className={styles.pulseDot} />
              Live · updates on every sale
            </span>
          </div>
        </div>
      </header>

      {/* ╭─ Stat ledger row ─╮ */}
      {(canSeeSales || canSeeExpenses) && (
        <div className={styles.statsRow}>
          {canSeeSales && (
            <article className={`${styles.statCard} ${styles.statAccent}`} style={{ animationDelay: '60ms' }}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}><IconCashIn /></span>
                <span className={styles.statTag}>Today</span>
              </div>
              <p className={styles.statLabel}>Total Cash-ins</p>
              <p className={styles.statValue}>{loading ? '—' : formatCurrency(revenue)}</p>
              <p className={styles.statFoot}>Revenue across {orderCount} order{orderCount === 1 ? '' : 's'}</p>
            </article>
          )}

          {canSeeExpenses && (
            <article className={styles.statCard} style={{ animationDelay: '120ms' }}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}><IconProfit /></span>
                <span className={`${styles.statTag} ${marginalProfit >= 0 ? styles.statTagOk : styles.statTagBad}`}>
                  {marginalProfit >= 0 ? 'Positive' : 'Negative'}
                </span>
              </div>
              <p className={styles.statLabel}>Marginal Profit</p>
              <p className={`${styles.statValue} ${marginalProfit < 0 ? styles.statValueBad : ''}`}>
                {loading ? '—' : formatCurrency(marginalProfit)}
              </p>
              <p className={styles.statFoot}>After today's expenses</p>
            </article>
          )}

          {canSeeExpenses && (
            <article className={styles.statCard} style={{ animationDelay: '180ms' }}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}><IconExpenses /></span>
                <span className={styles.statTag}>Out</span>
              </div>
              <p className={styles.statLabel}>Today's Expenses</p>
              <p className={styles.statValue}>{loading ? '—' : formatCurrency(expenses)}</p>
              <p className={styles.statFoot}>Flour, wages, utilities</p>
            </article>
          )}

          {canSeeSales && (
            <article className={styles.statCard} style={{ animationDelay: '240ms' }}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}><IconOrders /></span>
                {orderCount > 0 && <span className={styles.statTag}>+{orderCount}</span>}
              </div>
              <p className={styles.statLabel}>Orders Rung Up</p>
              <p className={styles.statValue}>{loading ? '—' : orderCount}</p>
              <p className={styles.statFoot}>Across POS &amp; invoices</p>
            </article>
          )}
        </div>
      )}

      {/* ╭─ Chart + alerts row ─╮ */}
      <div className={styles.middleRow}>
        {canSeeSales && (
          <section className={styles.chartCard}>
            <header className={styles.chartHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Revenue · 7-day trace</span>
                <h2 className={styles.sectionTitle}>Sales Performance</h2>
              </div>
              <div className={styles.weeklyTotal}>
                <span className={styles.weeklyTotalLabel}>Week to date</span>
                <span className={styles.weeklyTotalValue}>{formatCurrency(weeklyTotal)}</span>
              </div>
            </header>
            {weeklyData.length > 0 ? (
              <WeeklyBar weeklyData={weeklyData} />
            ) : (
              <div className={styles.chartEmpty}>
                <WheatGlyph />
                <p className={styles.chartEmptyTitle}>No sales logged this week</p>
                <p className={styles.chartEmptyHint}>As orders come in, the ledger fills in day by day.</p>
              </div>
            )}
          </section>
        )}

        <aside className={styles.alertsCard}>
          <header className={styles.alertsHeader}>
            <div>
              <span className={styles.sectionEyebrow}>Pantry watch</span>
              <h3 className={styles.sectionTitle}>Inventory Alerts</h3>
            </div>
            {lowStock.length > 0 ? (
              <span className={styles.alertsBadge}>{lowStock.length} low</span>
            ) : (
              <span className={styles.alertsBadgeOk}>All good</span>
            )}
          </header>

          {loading ? (
            <p className={styles.alertsStatus}>Reading shelves…</p>
          ) : lowStock.length === 0 ? (
            <div className={styles.alertsOk}>
              <span className={styles.alertsOkMark}>✓</span>
              <span>Every ingredient is stocked above its threshold.</span>
            </div>
          ) : (
            <ul className={styles.alertList}>
              {lowStock.slice(0, 5).map((item) => {
                const pct = item.lowStockThreshold > 0
                  ? Math.min(100, Math.round((item.quantityOnHand / item.lowStockThreshold) * 100))
                  : 0;
                const critical = pct <= 25;
                return (
                  <li key={item.id} className={styles.alertItem}>
                    <div className={styles.alertMeta}>
                      <div className={styles.alertTop}>
                        <span className={styles.alertName}>{item.name}</span>
                        <span className={`${styles.alertChip} ${critical ? styles.alertChipCrit : styles.alertChipWarn}`}>
                          {critical ? 'Critical' : 'Low'}
                        </span>
                      </div>
                      <div className={styles.alertBar}>
                        <div
                          className={`${styles.alertBarFill} ${critical ? styles.alertBarFillCrit : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={styles.alertQty}>
                        <strong>{item.quantityOnHand}</strong>
                        <span className={styles.alertQtySep}>/</span>
                        <span className={styles.alertQtyOf}>{item.lowStockThreshold}</span>
                        <span className={styles.alertQtyUnit}>{item.unit}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {/* ╭─ Recent orders ─╮ */}
      {canSeeSales && (
        <section className={styles.ordersCard}>
          <header className={styles.ordersHeader}>
            <div>
              <span className={styles.sectionEyebrow}>Counter tape</span>
              <h2 className={styles.sectionTitle}>Recent Orders</h2>
            </div>
            <a href="#/sales-orders" className={styles.ordersLink}>
              View all records
              <span aria-hidden="true">→</span>
            </a>
          </header>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Order №</th>
                  <th className={styles.th}>Customer</th>
                  <th className={styles.th}>Logged</th>
                  <th className={styles.th + ' ' + styles.thRight}>Total</th>
                  <th className={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      {loading ? 'Loading…' : 'No orders on the tape yet — new sales appear here instantly.'}
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const status = STATUS_STYLE[o.status] ?? { color: '#57534e', bg: 'rgba(87,83,78,0.12)', label: o.status };
                    return (
                      <tr key={o.id} className={styles.tr}>
                        <td className={styles.td + ' ' + styles.mono}>{o.orderNumber}</td>
                        <td className={styles.td}>{o.customer?.name ?? <span className={styles.walkin}>Walk-in</span>}</td>
                        <td className={styles.td + ' ' + styles.muted}>
                          {new Date(o.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          <span className={styles.dotSep}>·</span>
                          {new Date(o.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className={`${styles.td} ${styles.totalCell}`}>{formatCurrency(o.total)}</td>
                        <td className={styles.td}>
                          <span className={styles.statusPill} style={{ color: status.color, background: status.bg }}>
                            <span className={styles.statusDot} style={{ background: status.color }} />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
