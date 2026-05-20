import { useEffect, useState } from 'react';
import { StatCard } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import styles from './CustomerAnalyticsPanel.module.css';

export interface CustomerAnalytics {
  summary: { activeCustomers: number; avgOrderValue: number; active30d: number; churned: number };
  revenueShare: Array<{ name: string; revenue: number }>;
  ordersPerMonth: Array<{ period: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; quantity: number }>;
}

const PIE_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];
const BAR_COLORS = ['#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#6366f1', '#f43f5e'];
const ORDERS_PRIMARY = '#6366f1';

export function CustomerAnalyticsPanel() {
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<CustomerAnalytics>('/customers/analytics');
        if (alive) setAnalytics(res);
      } catch (err: any) {
        if (alive) showToast(err?.message || 'Failed to load customer analytics', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [showToast]);

  if (loading) return <p>Loading customer analytics…</p>;
  if (!analytics) return <p>No analytics available.</p>;

  return (
    <div className={styles.analyticsGrid}>
      <div className={styles.statsRow}>
        <StatCard label="Active Customers" value={analytics.summary.activeCustomers} />
        <StatCard label="Avg Order Value" value={formatCurrency(analytics.summary.avgOrderValue)} />
        <StatCard label="Active (30d)" value={analytics.summary.active30d} />
        <StatCard label="Churned (>30d)" value={analytics.summary.churned} />
      </div>

      <div className={styles.ledgerCard}>
        <div className={styles.chartTitle}>Revenue Share — Top 5 Customers</div>
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
        <div className={styles.chartTitle}>Orders Per Month (last 6 months)</div>
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
        <div className={styles.chartTitle}>Top Products (by quantity sold)</div>
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
  );
}
