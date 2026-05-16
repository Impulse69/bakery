import { useState, useEffect, useCallback } from 'react';
import { Input, DataTable } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../../lib/api';
import { AuditDrawer } from './AuditDrawer';
import styles from './CashierActivity.module.css';

interface CashierRow {
  userId: string;
  name: string;
  role: string;
  orderCount: number;
  totalRevenue: number;
  totalMarginalProfit: number;
  modificationsCount: number;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

type Period = '7d' | '30d' | 'today' | 'custom';

const PRESETS: { label: string; value: Period; days: number | null }[] = [
  { label: 'Today', value: 'today', days: 0 },
  { label: '7d', value: '7d', days: 7 },
  { label: '30d', value: '30d', days: 30 },
  { label: 'Custom', value: 'custom', days: null },
];

export function CashierActivity() {
  const [rows, setRows] = useState<CashierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('7d');
  const [from, setFrom] = useState<string>(getDaysAgo(7));
  const [to, setTo] = useState<string>(toISO(new Date()));
  const [drawerUser, setDrawerUser] = useState<{ id: string; name: string } | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('from', new Date(from).toISOString());
      params.set('to', new Date(to + 'T23:59:59').toISOString());
      const data = await api.get<CashierRow[]>(`/reports/cashier-activity?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    if (p === 'today') {
      const today = toISO(new Date());
      setFrom(today);
      setTo(today);
    } else if (p === '7d') {
      setFrom(getDaysAgo(7));
      setTo(toISO(new Date()));
    } else if (p === '30d') {
      setFrom(getDaysAgo(30));
      setTo(toISO(new Date()));
    }
  };

  const columns: DataTableColumn<CashierRow>[] = [
    {
      key: 'name',
      label: 'Cashier',
      render: (row) => (
        <div className={styles.nameCell}>
          <span className={styles.name}>{row.name}</span>
          <span className={styles.role}>{row.role}</span>
        </div>
      ),
    },
    {
      key: 'orderCount',
      label: 'Orders',
      render: (row) => <span className={styles.num}>{row.orderCount}</span>,
    },
    {
      key: 'totalRevenue',
      label: 'Revenue',
      render: (row) => <span className={styles.num}>{formatCurrency(row.totalRevenue)}</span>,
    },
    {
      key: 'totalMarginalProfit',
      label: 'Margin',
      render: (row) => (
        <span className={`${styles.num} ${row.totalMarginalProfit < 0 ? styles.neg : styles.pos}`}>
          {formatCurrency(row.totalMarginalProfit)}
        </span>
      ),
    },
    {
      key: 'modificationsCount',
      label: 'Mods',
      render: (row) =>
        row.modificationsCount > 0 ? (
          <span className={styles.modChip}>{row.modificationsCount}</span>
        ) : (
          <span className={styles.numDim}>0</span>
        ),
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <div className={styles.periodBtns}>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`${styles.periodBtn} ${period === p.value ? styles.periodBtnActive : ''}`}
              onClick={() => handlePeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className={styles.dateRow}>
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPeriod('custom');
            }}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPeriod('custom');
            }}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => setDrawerUser({ id: row.userId, name: row.name })}
        emptyMessage="No cashier activity in this range."
      />

      {drawerUser && (
        <AuditDrawer
          userId={drawerUser.id}
          userName={drawerUser.name}
          from={from}
          to={to}
          onClose={() => setDrawerUser(null)}
        />
      )}
    </div>
  );
}
