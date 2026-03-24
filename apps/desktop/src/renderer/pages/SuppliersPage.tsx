import { useState, useEffect, useCallback } from 'react';
import type { Supplier } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, FormSection } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './SuppliersPage.module.css';

const columns: DataTableColumn<Supplier>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'paymentTerms', label: 'Payment Terms' },
];

const EMPTY_FORM = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: '',
  paymentTerms: '',
};

export function SuppliersPage() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Supplier[]; total: number }>(
        `/suppliers?page=${page}&limit=${limit}`,
      );
      setSuppliers(res.data);
      setTotal(res.total);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      city: supplier.city ?? '',
      postalCode: supplier.postalCode ?? '',
      country: supplier.country ?? '',
      paymentTerms: supplier.paymentTerms ?? '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, form);
        showToast('Supplier updated', 'success');
      } else {
        await api.post('/suppliers', form);
        showToast('Supplier created', 'success');
      }
      closeModal();
      fetchSuppliers();
    } catch (err: any) {
      showToast(err.message || 'Failed to save supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Suppliers</h1>
        <Button onClick={openAddModal}>Add Supplier</Button>
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        onRowClick={openEditModal}
        emptyMessage="No suppliers found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        size="md"
      >
        <div className={styles.form}>
          <FormSection title="Contact Information">
            <Input label="Name" value={form.name} onChange={setField('name')} />
            <Input label="Contact Person" value={form.contactPerson} onChange={setField('contactPerson')} />
            <Input label="Email" type="email" value={form.email} onChange={setField('email')} />
            <Input label="Phone" value={form.phone} onChange={setField('phone')} />
          </FormSection>
          <FormSection title="Address">
            <Input label="Address" value={form.address} onChange={setField('address')} />
            <Input label="City" value={form.city} onChange={setField('city')} />
            <Input label="Postal Code" value={form.postalCode} onChange={setField('postalCode')} />
            <Input label="Country" value={form.country} onChange={setField('country')} />
          </FormSection>
          <Input label="Payment Terms" value={form.paymentTerms} onChange={setField('paymentTerms')} />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingSupplier ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
