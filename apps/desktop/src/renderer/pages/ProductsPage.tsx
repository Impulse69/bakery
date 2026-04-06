import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Product } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, Badge } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './ProductsPage.module.css';

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'bread', label: 'Bread' },
  { value: 'pastry', label: 'Pastry' },
  { value: 'cake', label: 'Cake' },
  { value: 'snack', label: 'Snack' },
  { value: 'drink', label: 'Drink' },
  { value: 'other', label: 'Other' },
];

const columns: DataTableColumn<Product>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category' },
  { key: 'sku', label: 'SKU' },
  {
    key: 'price',
    label: 'Price',
    sortable: true,
    render: (row) => formatCurrency(row.price),
  },
  {
    key: 'variants',
    label: 'Variants',
    render: (row) => String(row.variants?.length ?? 0),
  },
  {
    key: 'isAvailable',
    label: 'Status',
    render: (row) => (
      <Badge variant={row.isAvailable ? 'success' : 'danger'}>
        {row.isAvailable ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

const EMPTY_FORM = { name: '', sku: '', category: '', priceDisplay: '', description: '' };

export function ProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Product[]; total: number }>(
        `/products?page=${page}&limit=${limit}`,
      );
      setProducts(res.data);
      setTotal(res.total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAddModal();
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, openAddModal]);

  const openEditModal = async (product: Product) => {
    try {
      const full = await api.get<Product>(`/products/${product.id}`);
      setEditingProduct(full);
      setForm({
        name: full.name,
        sku: full.sku,
        category: full.category,
        priceDisplay: (full.price / 100).toFixed(2),
        description: full.description ?? '',
      });
      setShowModal(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to load product', 'error');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.category) {
      showToast('Name, SKU, and category are required', 'error');
      return;
    }
    const price = Math.round(Number(form.priceDisplay) * 100);
    if (isNaN(price) || price < 0) {
      showToast('Invalid price', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        price,
        description: form.description || undefined,
      };
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, body);
        showToast('Product updated', 'success');
      } else {
        await api.post('/products', body);
        showToast('Product created', 'success');
      }
      closeModal();
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!editingProduct) return;
    if (!window.confirm(`Deactivate "${editingProduct.name}"?`)) return;
    setSaving(true);
    try {
      await api.delete(`/products/${editingProduct.id}`);
      showToast('Product deactivated', 'success');
      closeModal();
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate', 'error');
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const setSelectField = (field: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Products</h1>
        <Button onClick={openAddModal}>Add Product</Button>
      </div>

      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        onRowClick={openEditModal}
        emptyMessage="No products found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={setField('name')} />
          <Input label="SKU" value={form.sku} onChange={setField('sku')} />
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={setSelectField('category')}
            placeholder="Select category"
          />
          <Input
            label="Price (GH₵)"
            type="number"
            value={form.priceDisplay}
            onChange={setField('priceDisplay')}
            placeholder="0.00"
          />
          <Input label="Description" value={form.description} onChange={setField('description')} />

          {editingProduct && editingProduct.variants && editingProduct.variants.length > 0 && (
            <>
              <div className={styles.variantsHeading}>
                Variants ({editingProduct.variants.length})
              </div>
              <div className={styles.variantList}>
                <div className={styles.variantRow} style={{ fontWeight: 600 }}>
                  <span>Name</span>
                  <span>SKU</span>
                  <span>Price</span>
                  <span>Status</span>
                </div>
                {editingProduct.variants.map((v) => (
                  <div key={v.id} className={styles.variantRow}>
                    <span>{v.name}</span>
                    <span>{v.sku}</span>
                    <span>{formatCurrency(v.price)}</span>
                    <span>
                      <Badge variant={v.isActive ? 'success' : 'danger'}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.actions}>
            {editingProduct && (
              <Button variant="danger" onClick={handleDeactivate} loading={saving}>
                Deactivate
              </Button>
            )}
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingProduct ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
