import { useState, useEffect, useCallback } from 'react';
import type { Customer, SalesOrder } from '@bakery/types';
import {
  DataTable, Pagination, Button, Modal, Input, SearchInput, Card, OrderStatusBadge,
} from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './CustomersPage.module.css';

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

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

export function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await api.get<{ data: Customer[]; total: number }>(
        `/customers?page=${page}&limit=${limit}${searchParam}`,
      );
      setCustomers(res.data);
      setTotal(res.total);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

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
      const full = await api.get<Customer>(`/customers/${customer.id}`);
      setSelectedCustomer(full);
    } catch (err: any) {
      showToast(err.message || 'Failed to load customer', 'error');
    }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Customers</h1>
        <Button onClick={openAddModal}>Add Customer</Button>
      </div>

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
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name ?? 'Customer'}
        size="lg"
      >
        {selectedCustomer && (
          <>
            <div className={styles.detailGrid}>
              <div>
                <div className={styles.detailLabel}>Phone</div>
                <div className={styles.detailValue}>{selectedCustomer.phone || '—'}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Email</div>
                <div className={styles.detailValue}>{selectedCustomer.email || '—'}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Address</div>
                <div className={styles.detailValue}>{selectedCustomer.address || '—'}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Credit Balance</div>
                <div className={styles.detailValue}>{formatCurrency(selectedCustomer.creditBalance)}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Notes</div>
                <div className={styles.detailValue}>{selectedCustomer.notes || '—'}</div>
              </div>
            </div>

            <h3 className={styles.ordersHeading}>Recent Orders</h3>
            <DataTable
              columns={orderColumns}
              data={selectedCustomer.salesOrders ?? []}
              emptyMessage="No orders yet"
            />
          </>
        )}
      </Modal>
    </div>
  );
}
