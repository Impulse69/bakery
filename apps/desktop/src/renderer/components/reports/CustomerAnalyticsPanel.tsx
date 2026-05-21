import { useEffect, useState, useCallback } from 'react';
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
import styles from './CustomerAnalyticsPanel.module.css';

export interface CustomerAnalytics {
  summary: { activeCustomers: number; avgOrderValue: number; active30d: number; churned: number };
  revenueShare: Array<{ name: string; revenue: number }>;
  ordersPerMonth: Array<{ period: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; quantity: number }>;
}

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
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, g] = await Promise.all([
        api.get<CustomerAnalytics>(`/customers/analytics?${rangeToParams(range)}`),
        api.get<AgingSummary>('/customers/aging'),
      ]);
      setAnalytics(a);
      setAging(g);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load customer analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, showToast]);

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

        </div>
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
