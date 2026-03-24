import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@bakery/ui';
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

export function DashboardPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api.get<DailyReport>(`/reports/daily?date=${today}`);
      setReport(data);
    } catch {
      // Reports endpoint may not be accessible for all roles
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('sale:created', fetchReport);
    return () => {
      socket.off('sale:created', fetchReport);
    };
  }, [fetchReport]);

  if (loading) {
    return <div className={styles.loading}>Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className={styles.heading}>Dashboard</h1>
      <div className={styles.grid}>
        <StatCard
          label="Today's Sales"
          value={report ? formatCurrency(report.totalRevenue) : '--'}
        />
        <StatCard
          label="Today's Orders"
          value={report ? report.totalOrders : '--'}
        />
        <StatCard
          label="Today's Expenses"
          value={report ? formatCurrency(report.totalExpenses) : '--'}
        />
        <StatCard
          label="Today's Profit"
          value={report ? formatCurrency(report.profit) : '--'}
        />
      </div>
    </div>
  );
}
