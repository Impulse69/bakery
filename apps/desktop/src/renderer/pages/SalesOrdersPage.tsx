import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SalesOrder, SalesOrderStatus } from '@bakery/types';
import { DataTable, Pagination, OrderStatusBadge } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { OrderDetailModal } from '../components/OrderDetailModal';
import styles from './SalesOrdersPage.module.css';

const STATUS_TABS: { label: string; value: SalesOrderStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'draft' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Invoiced', value: 'invoiced' },
  { label: 'Paid', value: 'paid' },
];

const columns: DataTableColumn<SalesOrder>[] = [
  {
    key: 'orderNumber',
    label: 'Order #',
    sortable: true,
    render: (row) => (
      <span className={styles.mono}>
        {row.orderNumber}
        {row.lastModifiedAt && (
          <span className={styles.editedChip} title="This order was modified after creation">
            Edited
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'customer',
    label: 'Customer',
    render: (row) => row.customer?.name || <span className={styles.walkin}>Walk-in</span>,
  },
  {
    key: 'createdAt',
    label: 'Date',
    sortable: true,
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    key: 'total',
    label: 'Total',
    sortable: true,
    render: (row) => <span className={styles.num}>{formatCurrency(row.total)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <OrderStatusBadge status={row.status} />,
  },
  {
    key: 'amountPaid',
    label: 'Paid',
    render: (row) => <span className={styles.numDim}>{formatCurrency(row.amountPaid)}</span>,
  },
  {
    key: 'balanceDue',
    label: 'Balance',
    render: (row) => <span className={styles.num}>{formatCurrency(row.balanceDue)}</span>,
  },
];

export function SalesOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      const res = await api.get<{ data: SalesOrder[]; total: number }>(
        `/sales-orders?page=${page}&limit=${limit}${statusParam}`,
      );
      setOrders(res.data);
      setTotal(res.total);
      if (!statusFilter) {
        const counts: Record<string, number> = { '': res.total };
        res.data.forEach((o) => {
          counts[o.status] = (counts[o.status] ?? 0) + 1;
        });
        setStatusCounts(counts);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleTabChange = (value: SalesOrderStatus | '') => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Sales Ledger</span>
          <h1 className={styles.heading}>Orders &amp; Invoices</h1>
          <p className={styles.heroQuote}>
            <em>Every sale, every shift — the full day&rsquo;s ribbon.</em>
          </p>
        </div>
        <div className={styles.heroAside}>
          <button className={styles.heroAction} onClick={() => navigate('/pos')}>
            <span>＋</span> New Sale
          </button>
        </div>
      </header>

      <div className={styles.ledgerCard}>
        <div className={styles.tabsRow}>
          {STATUS_TABS.map((tab) => {
            const count = tab.value === '' ? total : (statusCounts[tab.value] ?? 0);
            return (
              <button
                key={tab.value}
                className={`${styles.tab} ${statusFilter === tab.value ? styles.tabActive : ''}`}
                onClick={() => handleTabChange(tab.value)}
              >
                <span>{tab.label}</span>
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.tableCard}>
        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          onRowClick={(row) => setSelectedOrderId(row.id)}
          emptyMessage="No orders on the ribbon yet."
        />
      </div>

      {totalPages > 1 && (
        <div className={styles.pagerWrap}>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdate={fetchOrders}
        />
      )}
    </div>
  );
}
