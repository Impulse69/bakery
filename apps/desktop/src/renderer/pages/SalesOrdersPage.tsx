import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SalesOrder, SalesOrderStatus } from '@bakery/types';
import { DataTable, Pagination, OrderStatusBadge, Button } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { OrderDetailModal } from '../components/OrderDetailModal';
import styles from './SalesOrdersPage.module.css';

const STATUS_TABS: { label: string; value: SalesOrderStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Invoiced', value: 'invoiced' },
  { label: 'Paid', value: 'paid' },
];

const columns: DataTableColumn<SalesOrder>[] = [
  { key: 'orderNumber', label: 'Order #', sortable: true },
  {
    key: 'customer',
    label: 'Customer',
    render: (row) => row.customer?.name || 'Walk-in',
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
    render: (row) => formatCurrency(row.total),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <OrderStatusBadge status={row.status} />,
  },
  {
    key: 'amountPaid',
    label: 'Paid',
    render: (row) => formatCurrency(row.amountPaid),
  },
  {
    key: 'balanceDue',
    label: 'Balance',
    render: (row) => formatCurrency(row.balanceDue),
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
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
    const socket = getSocket();
    socket.on('sale:created', fetchOrders);
    socket.on('sale:updated', fetchOrders);
    return () => {
      socket.off('sale:created', fetchOrders);
      socket.off('sale:updated', fetchOrders);
    };
  }, [fetchOrders]);

  const handleTabChange = (value: SalesOrderStatus | '') => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Sales Orders</h1>
        <Button onClick={() => navigate('/pos')}>New Sale</Button>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        onRowClick={(row) => setSelectedOrderId(row.id)}
        emptyMessage="No orders found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
