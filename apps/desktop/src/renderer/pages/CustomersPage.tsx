import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Customer, SalesOrder, Payment } from '@bakery/types';
import {
  DataTable, Pagination, Button, Modal, Input, SearchInput, Card, OrderStatusBadge,
} from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './CustomersPage.module.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const columns: DataTableColumn<Customer>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  {
    key: 'creditBalance',
    label: 'Credit Balance',
    render: (row) => formatCurrency(row.creditBalance),
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
];

const orderColumns: DataTableColumn<SalesOrder>[] = [
  { key: 'orderNumber', label: 'Order #' },
  {
    key: 'createdAt',
    label: 'Date',
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    key: 'total',
    label: 'Total',
    render: (row) => formatCurrency(row.total),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <OrderStatusBadge status={row.status} />,
  },
];

const paymentColumns: DataTableColumn<Payment>[] = [
  {
    key: 'date',
    label: 'Date',
    render: (row) => new Date(row.date).toLocaleDateString(),
  },
  {
    key: 'method',
    label: 'Method',
    render: (row) => row.method.toUpperCase(),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (row) => formatCurrency(row.amount),
  },
];

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

interface CustomerStats {
  totalSpent: number;
  totalOrders: number;
  lastOrderDate: string;
  weekStreak: number;
  periodic: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  topProducts: Array<{ name: string; quantity: number }>;
}

export function CustomersPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'leaderboard'>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedStats, setSelectedCustomerStats] = useState<CustomerStats | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'orders' | 'payments'>('overview');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAddModal();
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'all') {
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
        const res = await api.get<{ data: Customer[]; total: number }>(
          `/customers?page=${page}&limit=${limit}${searchParam}`,
        );
        setCustomers(res.data);
        setTotal(res.total);
      } else {
        const res = await api.get<any[]>('/customers/leaderboard');
        setLeaderboard(res);
      }
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeTab]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/customers', form);
      showToast('Customer created', 'success');
      setShowAddModal(false);
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (customer: Customer) => {
    try {
      const [full, stats] = await Promise.all([
        api.get<Customer>(`/customers/${customer.id}`),
        api.get<CustomerStats>(`/customers/${customer.id}/stats`)
      ]);
      setSelectedCustomer(full);
      setSelectedCustomerStats(stats);
      setDetailTab('overview');
    } catch (err: any) {
      showToast(err.message || 'Failed to load customer details', 'error');
    }
  };

  const handleDeactivate = async () => {
    if (!selectedCustomer) return;
    if (!confirm(`Are you sure you want to deactivate ${selectedCustomer.name}?`)) return;
    try {
      await api.delete(`/customers/${selectedCustomer.id}`);
      showToast('Customer deactivated', 'success');
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate customer', 'error');
    }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Customers</h1>
          <p className={styles.subheading}>Manage customer relationships and track buying history.</p>
        </div>
        <Button onClick={openAddModal}>+ New Customer</Button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Customers
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Top Spenders
        </button>
      </div>

      {activeTab === 'all' ? (
        <>
          <div className={styles.search}>
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by name or phone..."
            />
          </div>

          <DataTable
            columns={columns}
            data={customers}
            loading={loading}
            onRowClick={openDetail}
            emptyMessage="No customers found"
          />

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Customer' },
            { key: 'phone', label: 'Phone' },
            { key: 'totalOrders', label: 'Orders', render: (row: any) => (row.totalOrders || 0).toLocaleString() },
            { key: 'totalSpent', label: 'Total Revenue', render: (row: any) => formatCurrency(row.totalSpent || 0) },
          ]}
          data={leaderboard}
          loading={loading}
          onRowClick={openDetail}
        />
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Customer" size="md">
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={setField('name')} />
          <Input label="Phone" value={form.phone} onChange={setField('phone')} />
          <Input label="Email" type="email" value={form.email} onChange={setField('email')} />
          <Input label="Address" value={form.address} onChange={setField('address')} />
          <Input label="Notes" value={form.notes} onChange={setField('notes')} />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => { setSelectedCustomer(null); setSelectedCustomerStats(null); }}
        title={selectedCustomer?.name ?? 'Customer Details'}
        size="lg"
      >
        {selectedCustomer && (
          <div className={styles.detailContainer}>
            <div className={styles.modalHeaderActions}>
              <Button size="sm" onClick={() => navigate(`/pos?customerId=${selectedCustomer.id}`)}>
                Create Sales Order
              </Button>
              <Button size="sm" variant="danger" onClick={handleDeactivate}>
                Deactivate
              </Button>
            </div>
            <div className={styles.detailTabs}>
              <button
                className={`${styles.tab} ${detailTab === 'overview' ? styles.tabActive : ''}`}
                onClick={() => setDetailTab('overview')}
              >
                Overview
              </button>
              <button
                className={`${styles.tab} ${detailTab === 'orders' ? styles.tabActive : ''}`}
                onClick={() => setDetailTab('orders')}
              >
                Order History
              </button>
              <button
                className={`${styles.tab} ${detailTab === 'payments' ? styles.tabActive : ''}`}
                onClick={() => setDetailTab('payments')}
              >
                Payment History
              </button>
            </div>

            {detailTab === 'overview' && (
              <>
                <div className={styles.detailGrid}>
              <Card className={styles.infoCard}>
                <div className={styles.detailLabel}>Contact Information</div>
                <div className={styles.infoRow}><span>Phone:</span> <strong>{selectedCustomer.phone || '—'}</strong></div>
                <div className={styles.infoRow}><span>Email:</span> <strong>{selectedCustomer.email || '—'}</strong></div>
                <div className={styles.infoRow}><span>Address:</span> <strong>{selectedCustomer.address || '—'}</strong></div>
                <div className={styles.infoRow}><span>Credit:</span> <strong style={{ color: 'var(--color-danger)' }}>{formatCurrency(selectedCustomer.creditBalance)}</strong></div>
              </Card>

              {selectedStats && (
                <Card className={styles.statsCard}>
                  <div className={styles.detailLabel}>Buying Statistics</div>
                  <div className={styles.streakBadge}>
                    <span className={styles.streakIcon}>🔥</span>
                    <span><strong>{selectedStats.weekStreak} Week</strong> Purchase Streak</span>
                  </div>
                  <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={[
                          { period: 'Day', revenue: selectedStats.periodic.daily / 100 },
                          { period: 'Week', revenue: selectedStats.periodic.weekly / 100 },
                          { period: 'Month', revenue: selectedStats.periodic.monthly / 100 },
                          { period: 'Year', revenue: selectedStats.periodic.yearly / 100 },
                        ]}
                      >
                        <XAxis dataKey="period" fontSize={12} />
                        <YAxis tickFormatter={(val) => `GH₵${val}`} fontSize={12} />
                        <Tooltip formatter={(val: number) => `GH₵${val.toFixed(2)}`} />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </div>

            {selectedStats && selectedStats.topProducts.length > 0 && (
              <div className={styles.reorderSection}>
                <h4 className={styles.sectionTitle}>Most Reordered Items</h4>
                <div style={{ height: 200, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={selectedStats.topProducts}
                        dataKey="quantity"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {selectedStats.topProducts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
              </>
            )}

            {detailTab === 'orders' && (
              <div className={styles.ordersContainer}>
                <DataTable
                  columns={orderColumns}
                  data={selectedCustomer.salesOrders ?? []}
                  emptyMessage="No orders yet"
                />
              </div>
            )}

            {detailTab === 'payments' && (
              <div className={styles.ordersContainer}>
                <DataTable
                  columns={paymentColumns}
                  data={(selectedCustomer.salesOrders ?? []).flatMap(o => o.payments ?? [])}
                  emptyMessage="No payments yet"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
