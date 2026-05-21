import { useState, useEffect, useCallback } from 'react';
import { DataTable } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../../lib/api';
import { AuditDrawer } from './AuditDrawer';
import { DateRangePicker, initialRange } from './DateRangePicker';
import type { DateRange } from './DateRangePicker';
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

export function CashierActivity() {
  const [rows, setRows] = useState<CashierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(() => initialRange('7d'));
  const [drawerUser, setDrawerUser] = useState<{ id: string; name: string } | null>(null);

  const { from, to } = range;

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
      <DateRangePicker
        value={range}
        onChange={setRange}
        presets={['today', '7d', '30d', 'custom']}
      />

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
