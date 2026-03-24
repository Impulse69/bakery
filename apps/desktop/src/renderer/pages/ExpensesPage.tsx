import { useState, useEffect, useCallback } from 'react';
import type { Expense, ExpenseCategory, PaymentMethod } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, Badge } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './ExpensesPage.module.css';

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'utilities', label: 'Utilities' },
  { value: 'wages', label: 'Wages' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_OPTIONS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo', label: 'MoMo' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
];

const CATEGORY_VARIANT: Record<string, 'info' | 'warning' | 'danger' | 'success' | 'neutral'> = {
  utilities: 'info',
  wages: 'warning',
  packaging: 'neutral',
  ingredients: 'success',
  maintenance: 'danger',
  other: 'neutral',
};

const columns: DataTableColumn<Expense>[] = [
  { key: 'expenseNumber', label: 'Expense #', sortable: true },
  {
    key: 'category',
    label: 'Category',
    render: (row) => (
      <Badge variant={CATEGORY_VARIANT[row.category] ?? 'neutral'}>
        {row.category.charAt(0).toUpperCase() + row.category.slice(1)}
      </Badge>
    ),
  },
  { key: 'description', label: 'Description' },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (row) => formatCurrency(row.amount),
  },
  {
    key: 'paymentMethod',
    label: 'Payment',
    render: (row) => row.paymentMethod.toUpperCase(),
  },
  {
    key: 'expenseDate',
    label: 'Date',
    sortable: true,
    render: (row) => new Date(row.expenseDate).toLocaleDateString(),
  },
];

function getFirstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

const EMPTY_FORM = {
  category: '' as ExpenseCategory | '',
  description: '',
  amountDisplay: '',
  paymentMethod: '' as PaymentMethod | '',
  expenseDate: getToday(),
  receiptUrl: '',
  notes: '',
};

export function ExpensesPage() {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(getFirstOfMonth());
  const [dateTo, setDateTo] = useState(getToday());
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      let params = `/expenses?page=${page}&limit=${limit}`;
      if (dateFrom) params += `&from=${new Date(dateFrom).toISOString()}`;
      if (dateTo) params += `&to=${new Date(dateTo + 'T23:59:59').toISOString()}`;
      const res = await api.get<{ data: Expense[]; total: number }>(params);
      setExpenses(res.data);
      setTotal(res.total);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  };

  const handleAdd = async () => {
    if (!form.category || !form.description.trim() || !form.paymentMethod) {
      showToast('Category, description, and payment method are required', 'error');
      return;
    }
    const amount = Math.round(Number(form.amountDisplay) * 100);
    if (isNaN(amount) || amount <= 0) {
      showToast('Invalid amount', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/expenses', {
        category: form.category,
        description: form.description,
        amount,
        paymentMethod: form.paymentMethod,
        expenseDate: new Date(form.expenseDate).toISOString(),
        receiptUrl: form.receiptUrl || undefined,
        notes: form.notes || undefined,
      });
      showToast('Expense recorded', 'success');
      setShowAddModal(false);
      fetchExpenses();
    } catch (err: any) {
      showToast(err.message || 'Failed to record expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const pageTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const setSelectField = (field: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Expenses</h1>
        <Button onClick={openAddModal}>Add Expense</Button>
      </div>

      <div className={styles.filters}>
        <Input
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
        />
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        emptyMessage="No expenses found"
      />

      {expenses.length > 0 && (
        <div className={styles.totalRow}>
          Page Total: {formatCurrency(pageTotal)}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Expense" size="md">
        <div className={styles.form}>
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={setSelectField('category')}
            placeholder="Select category"
          />
          <Input label="Description" value={form.description} onChange={setField('description')} />
          <Input
            label="Amount (GH₵)"
            type="number"
            value={form.amountDisplay}
            onChange={setField('amountDisplay')}
            placeholder="0.00"
          />
          <Select
            label="Payment Method"
            options={PAYMENT_OPTIONS}
            value={form.paymentMethod}
            onChange={setSelectField('paymentMethod')}
            placeholder="Select method"
          />
          <Input label="Date" type="date" value={form.expenseDate} onChange={setField('expenseDate')} />
          <Input label="Receipt URL" value={form.receiptUrl} onChange={setField('receiptUrl')} />
          <Input label="Notes" value={form.notes} onChange={setField('notes')} />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
