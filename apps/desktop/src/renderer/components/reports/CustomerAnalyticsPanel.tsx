import { useEffect, useState, useCallback, useMemo } from 'react';
import { StatCard } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import type { AgingBuckets, AgingSummary } from '@bakery/types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import { DateRangePicker, initialRange } from './DateRangePicker';
import type { DateRange } from './DateRangePicker';
import { CustomerStatementDrawer } from './CustomerStatementDrawer';
import styles from './CustomerAnalyticsPanel.module.css';

export interface CustomerAnalytics {
  summary: { activeCustomers: number; avgOrderValue: number; active30d: number; churned: number };
  revenueShare: Array<{ name: string; revenue: number }>;
  ordersPerMonth: Array<{ period: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; quantity: number }>;
}

interface LeaderboardRow {
  id: string;
  name: string;
  phone?: string;
  totalSpent: number;
  amountPaid: number;
  balanceDueInRange: number;
  outstandingAllTime: number;
  totalOrders: number;
}

type SortKey = 'name' | 'totalSpent' | 'totalOrders' | 'outstandingAllTime';
type SortDir = 'asc' | 'desc';

const PIE_COLORS = ['#e07b3c', '#131b2e', '#c89a3c', '#2f9e6a', '#8b5cf6'];
const BAR_COLORS = ['#e07b3c', '#131b2e', '#c89a3c', '#2f9e6a', '#8b5cf6', '#0ea5e9'];
const ORDERS_PRIMARY = '#e07b3c';

const AGING_LABELS: { key: keyof AgingBuckets; label: string; color: string }[] = [
  { key: 'bucket_0_30',    label: '0–30 d',    color: '#2f9e6a' },
  { key: 'bucket_31_60',   label: '31–60 d',   color: '#5ba36d' },
  { key: 'bucket_61_90',   label: '61–90 d',   color: '#c89a3c' },
  { key: 'bucket_91_180',  label: '91–180 d',  color: '#e07b3c' },
  { key: 'bucket_181_365', label: '181–365 d', color: '#c44545' },
  { key: 'bucket_over_365',label: '> 365 d',   color: '#7a1f1f' },
];

function rangeToParams(range: DateRange): string {
  const params = new URLSearchParams();
  params.set('from', new Date(range.from).toISOString());
  params.set('to', new Date(range.to + 'T23:59:59').toISOString());
  return params.toString();
}

export function CustomerAnalyticsPanel() {
  const { showToast } = useToast();
  const [range, setRange] = useState<DateRange>(() => initialRange('month'));
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [aging, setAging] = useState<AgingSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('totalSpent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, g, lb] = await Promise.all([
        api.get<CustomerAnalytics>(`/customers/analytics?${rangeToParams(range)}`),
        api.get<AgingSummary>('/customers/aging'),
        api.get<LeaderboardRow[]>(`/customers/leaderboard?${rangeToParams(range)}&limit=20`),
      ]);
      setAnalytics(a);
      setAging(g);
      setLeaderboard(Array.isArray(lb) ? lb : []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load customer analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, showToast]);

  const sortedLeaderboard = useMemo(() => {
    const arr = [...leaderboard];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return arr;
  }, [leaderboard, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className={styles.wrap}>
      <DateRangePicker value={range} onChange={setRange} />

      {loading && !analytics ? (
        <p>Loading customer analytics…</p>
      ) : !analytics ? (
        <p>No analytics available.</p>
      ) : (
        <div className={styles.analyticsGrid}>

          <div className={styles.statsRow}>
            <StatCard label="Active customers" value={analytics.summary.activeCustomers} />
            <StatCard label="Avg order value" value={formatCurrency(analytics.summary.avgOrderValue)} />
            <StatCard label="Active (30d)" value={analytics.summary.active30d} />
            <StatCard label="Churned (>30d)" value={analytics.summary.churned} />
          </div>

          {aging && (
            <div className={`${styles.ledgerCard} ${styles.fullWidth}`}>
              <div className={styles.agingHeader}>
                <div>
                  <div className={styles.chartTitle}>Outstanding invoices — aging</div>
                  <div className={styles.agingSub}>
                    {aging.totalInvoices} unpaid invoice{aging.totalInvoices === 1 ? '' : 's'} ·
                    Total outstanding {formatCurrency(aging.totalOutstanding)}
                  </div>
                </div>
                <div className={styles.agingOver1y}>
                  <span className={styles.agingOver1yLabel}>Over 1 year</span>
                  <span className={styles.agingOver1yValue}>
                    {formatCurrency(aging.buckets.bucket_over_365.amount)}
                  </span>
                  <span className={styles.agingOver1yMeta}>
                    {aging.buckets.bucket_over_365.count} invoice
                    {aging.buckets.bucket_over_365.count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <AgingBar buckets={aging.buckets} total={aging.totalOutstanding} />

              <div className={styles.agingLegend}>
                {AGING_LABELS.map((b) => {
                  const bucket = aging.buckets[b.key];
                  return (
                    <div key={b.key} className={styles.agingLegendItem}>
                      <span className={styles.agingDot} style={{ background: b.color }} />
                      <div className={styles.agingLegendCol}>
                        <span className={styles.agingLegendLabel}>{b.label}</span>
                        <span className={styles.agingLegendAmount}>
                          {formatCurrency(bucket.amount)}
                        </span>
                        <span className={styles.agingLegendCount}>
                          {bucket.count} {bucket.count === 1 ? 'invoice' : 'invoices'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.ledgerCard}>
            <div className={styles.chartTitle}>Revenue share — top 5 customers (in range)</div>
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={analytics.revenueShare}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {analytics.revenueShare.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.ledgerCard}>
            <div className={styles.chartTitle}>Orders per month (in range)</div>
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={analytics.ordersPerMonth}>
                  <XAxis dataKey="period" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="orders" fill={ORDERS_PRIMARY} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${styles.ledgerCard} ${styles.fullWidth}`}>
            <div className={styles.chartTitle}>Top products (by quantity, in range)</div>
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={analytics.topProducts} layout="vertical">
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={120} />
                  <Tooltip />
                  <Bar dataKey="quantity" radius={[0, 6, 6, 0]}>
                    {analytics.topProducts.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${styles.ledgerCard} ${styles.fullWidth}`}>
            <div className={styles.chartTitle}>
              Customers (in range) — click any row to open a statement
            </div>
            {sortedLeaderboard.length === 0 ? (
              <p className={styles.tableEmpty}>No customers in this range.</p>
            ) : (
              <div className={styles.customerTableWrap}>
                <table className={styles.customerTbl}>
                  <thead>
                    <tr>
                      <th
                        className={styles.sortable}
                        onClick={() => handleSort('name')}
                      >
                        Customer{sortIndicator('name')}
                      </th>
                      <th
                        className={`${styles.sortable} ${styles.rightTh}`}
                        onClick={() => handleSort('totalOrders')}
                      >
                        Orders{sortIndicator('totalOrders')}
                      </th>
                      <th
                        className={`${styles.sortable} ${styles.rightTh}`}
                        onClick={() => handleSort('totalSpent')}
                      >
                        Revenue{sortIndicator('totalSpent')}
                      </th>
                      <th
                        className={`${styles.sortable} ${styles.rightTh}`}
                        onClick={() => handleSort('outstandingAllTime')}
                      >
                        Outstanding{sortIndicator('outstandingAllTime')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((c) => (
                      <tr
                        key={c.id}
                        className={styles.customerRow}
                        onClick={() => setOpenCustomerId(c.id)}
                      >
                        <td>
                          <div className={styles.customerNameCell}>
                            <span className={styles.customerRowName}>{c.name}</span>
                            {c.phone && <span className={styles.customerRowPhone}>{c.phone}</span>}
                          </div>
                        </td>
                        <td className={styles.right}>{c.totalOrders}</td>
                        <td className={styles.right}>{formatCurrency(c.totalSpent)}</td>
                        <td
                          className={`${styles.right} ${c.outstandingAllTime > 0 ? styles.outstandingHi : styles.outstandingZero}`}
                        >
                          {formatCurrency(c.outstandingAllTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {openCustomerId && (
        <CustomerStatementDrawer
          customerId={openCustomerId}
          initialRange={range}
          onClose={() => setOpenCustomerId(null)}
        />
      )}
    </div>
  );
}

interface AgingBarProps {
  buckets: AgingBuckets;
  total: number;
}

function AgingBar({ buckets, total }: AgingBarProps) {
  if (total <= 0) {
    return <div className={styles.agingEmpty}>No outstanding invoices — all clean.</div>;
  }
  return (
    <div className={styles.agingBar}>
      {AGING_LABELS.map((b) => {
        const seg = buckets[b.key];
        const pct = total > 0 ? (seg.amount / total) * 100 : 0;
        if (pct <= 0) return null;
        return (
          <div
            key={b.key}
            className={styles.agingSeg}
            style={{ flexBasis: `${pct}%`, background: b.color }}
            title={`${b.label}: ${seg.count} invoices · ${pct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}
