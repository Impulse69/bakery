import { useState, useEffect, useCallback, useMemo } from 'react';
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

const CATEGORY_GLYPH: Record<string, string> = {
  Bread: '🍞',
  Pastry: '🥐',
  Cake: '🎂',
  Snack: '🍪',
  Drink: '🥤',
  Other: '📦',
};

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

  const columns: DataTableColumn<Product>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (row) => (
        <div className={styles.productCell}>
          <span className={styles.productGlyph} aria-hidden="true">
            {CATEGORY_GLYPH[row.category] ?? '📦'}
          </span>
          <div className={styles.productText}>
            <span className={styles.productName}>{row.name}</span>
            {row.description && (
              <span className={styles.productDesc}>{row.description}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => <span className={styles.categoryChip}>{row.category}</span>,
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (row) => <span className={styles.mono}>{row.sku}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (row) => <span className={styles.priceCell}>{formatCurrency(row.price)}</span>,
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
  ], []);

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
    if (!window.confirm(`Deactivate "${editingProduct.name}"? It will be hidden from the POS but kept on record.`)) return;
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

  const handlePermanentDelete = async () => {
    if (!editingProduct) return;
    const first = window.confirm(
      `Permanently delete "${editingProduct.name}"?\n\nThis removes it from the catalog entirely. It can only succeed if the product has never appeared on a sales or purchase order.`,
    );
    if (!first) return;
    const second = window.prompt(`Type the product name to confirm deletion:`);
    if (second !== editingProduct.name) {
      if (second !== null) showToast('Name did not match — deletion cancelled', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.delete(`/products/${editingProduct.id}?permanent=true`);
      showToast('Product permanently deleted', 'success');
      closeModal();
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
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

  const activeCount = products.filter((p) => p.isAvailable).length;
  const categoryCount = new Set(products.map((p) => p.category)).size;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Catalog</span>
          <h1 className={styles.heading}>Products</h1>
          <p className={styles.sub}>
            Manage what's available on the terminal and the production sheet.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Button onClick={openAddModal}>＋ Add Product</Button>
        </div>
      </header>

      <div className={styles.kpiStrip}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Total on Page</span>
          <span className={styles.kpiValue}>{products.length}</span>
          <span className={styles.kpiFoot}>of {total} across catalog</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Active</span>
          <span className={styles.kpiValue}>{activeCount}</span>
          <span className={styles.kpiFoot}>listed on POS</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Categories</span>
          <span className={styles.kpiValue}>{categoryCount}</span>
          <span className={styles.kpiFoot}>on this page</span>
        </div>
      </div>

      <div className={styles.tableCard}>
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          onRowClick={openEditModal}
          emptyMessage="No products yet — add your first SKU to get started."
        />
      </div>

      {totalPages > 1 && (
        <div className={styles.pagerWrap}>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
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

          <div className={styles.actions}>
            {editingProduct && (
              <>
                <Button variant="ghost" onClick={handlePermanentDelete} loading={saving}>
                  Delete permanently
                </Button>
                <Button variant="danger" onClick={handleDeactivate} loading={saving}>
                  Deactivate
                </Button>
              </>
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
