import { useState, useEffect, useCallback } from 'react';
import type { ProductionBatch, Product } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, Badge } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/AuthContext';
import styles from './ProductionPage.module.css';

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'danger'> = {
  in_progress: 'info',
  completed: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

interface DailyTarget {
  id: string;
  productId: string;
  date: string;
  targetQty: number;
  actualQty: number;
  carriedOverShortage: number;
  shortage: number;
  product: Product;
}

// ─── Batches Tab ──────────────────────────────────────────────────────────────
function BatchesTab() {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [showNewModal, setShowNewModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('units');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ProductionBatch[]; total: number }>(
        `/production?page=${page}&limit=${limit}&date=${selectedDate}`,
      );
      setBatches(res.data);
      setTotal(res.total);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [page, selectedDate]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => {
    api.get<{ data: Product[] }>('/products?limit=100').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const openNewModal = () => {
    setSelectedProductId(''); setQuantity(''); setQuantityUnit('units'); setNotes('');
    setShowNewModal(true);
  };

  const handleCreateBatch = async () => {
    if (!selectedProductId || !quantity) { showToast('Product and quantity are required', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/production', { productId: selectedProductId, quantityProduced: Number(quantity), quantityUnit, notes: notes || undefined });
      showToast('Production batch created', 'success');
      setShowNewModal(false);
      fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to create batch', 'error');
    } finally { setSaving(false); }
  };

  const breadTypeOptions: SelectOption[] = products
    .filter(p => p.category.toLowerCase().includes('bread'))
    .map(p => ({ value: p.id, label: p.name }));

  const columns: DataTableColumn<ProductionBatch>[] = [
    { key: 'batchNumber', label: 'Batch #', sortable: true },
    { key: 'product', label: 'Product', render: (row: any) => row.product?.name ?? '—' },
    { key: 'quantityProduced', label: 'Quantity', render: (row) => `${row.quantityProduced} ${row.quantityUnit}` },
    { key: 'status', label: 'Status', render: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? 'neutral'}>{STATUS_LABEL[row.status] ?? row.status}</Badge> },
    { key: 'startedAt', label: 'Started', render: (row) => new Date(row.startedAt).toLocaleTimeString() },
    { key: 'completedAt', label: 'Completed', render: (row) => row.completedAt ? new Date(row.completedAt).toLocaleTimeString() : '—' },
    {
      key: 'actions', label: '',
      render: (row) => row.status === 'in_progress' ? (
        <Button size="sm" onClick={(e) => handleComplete(row.id, e)} loading={completing === row.id}>Complete</Button>
      ) : null,
    },
  ];

  const handleComplete = async (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompleting(batchId);
    try {
      await api.patch(`/production/${batchId}/complete`);
      showToast('Batch completed', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete batch', 'error');
    } finally { setCompleting(null); }
  };

  return (
    <div>
      <div className={styles.filters}>
        <Input label="Production Date" type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }} />
        <Button onClick={openNewModal}>+ New Batch</Button>
      </div>

      <DataTable columns={columns} data={batches} loading={loading} emptyMessage="No batches found for this date" />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}

      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Production Batch" size="md">
        <div className={styles.form}>
          <Select 
            label="Bread Type" 
            options={breadTypeOptions} 
            value={selectedProductId} 
            onChange={(e) => setSelectedProductId(e.target.value)} 
            placeholder="Select bread type" 
          />
          <Input label="Quantity Produced" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Unit" value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreateBatch} loading={saving}>Create Batch</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Daily Targets Tab ────────────────────────────────────────────────────────
function DailyTargetsTab() {
  const { showToast } = useToast();
  const [targets, setTargets] = useState<DailyTarget[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DailyTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ productId: '', target: '', actual: '', carriedOver: '', shortage: '' });

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DailyTarget[]; total: number }>(`/production/targets?date=${selectedDate}&limit=50`);
      setTargets(res.data);
    } catch {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);
  useEffect(() => {
    api.get<{ data: Product[] }>('/products?limit=100').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ productId: '', target: '', actual: '', carriedOver: '', shortage: '' });
    setShowModal(true);
  };

  const handleLoadShortage = async () => {
    if (!form.productId) {
      showToast('Select a product first', 'error');
      return;
    }
    try {
      const res = await api.get<{ shortage: number }>(
        `/production/targets/previous-shortage?productId=${form.productId}&date=${selectedDate}`
      );
      setForm((prev) => ({ ...prev, carriedOver: String(res.shortage) }));
      showToast(`Loaded shortage: ${res.shortage} units`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to load shortage', 'error');
    }
  };

  const openEdit = (t: DailyTarget) => {
    setEditTarget(t);
    setForm({ 
      productId: t.productId, 
      target: String(t.targetQty), 
      actual: String(t.actualQty), 
      carriedOver: String(t.carriedOverShortage), 
      shortage: String(t.shortage) 
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.target) { showToast('Product and target are required', 'error'); return; }
    setSaving(true);
    try {
      const targetVal = Number(form.target);
      const actualVal = Number(form.actual || 0);
      const shortageVal = Math.max(0, targetVal - actualVal);

      const payload = {
        productId: form.productId,
        date: selectedDate,
        target: targetVal,
        actual: actualVal,
        carriedOver: Number(form.carriedOver || 0),
        shortage: shortageVal,
      };
      if (editTarget) {
        await api.put(`/production/targets/${editTarget.id}`, { target: payload.target, actual: payload.actual, carriedOver: payload.carriedOver, shortage: payload.shortage });
        showToast('Target updated', 'success');
      } else {
        await api.post('/production/targets', payload);
        showToast('Target set', 'success');
      }
      setShowModal(false);
      fetchTargets();
    } catch (err: any) {
      showToast(err.message || 'Failed to save target', 'error');
    } finally { setSaving(false); }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const productOptions: SelectOption[] = products.map((p) => ({ value: p.id, label: p.name }));

  // Auto-calculate shortage when actual & target are filled
  const computedShortage = form.target && form.actual ? Math.max(0, Number(form.target) - Number(form.actual)) : 0;

  return (
    <div>
      <div className={styles.filters}>
        <Input label="Target Date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        <Button onClick={openAdd}>+ Set Target</Button>
      </div>

      {loading ? (
        <div className={styles.emptyState}>Loading targets…</div>
      ) : targets.length === 0 ? (
        <div className={styles.emptyState}>
          No targets set for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
          <br /><span style={{ color: 'var(--color-primary)' }}>Click "Set Target" to begin.</span>
        </div>
      ) : (
        <div className={styles.targetsGrid}>
          {/* Header */}
          <div className={styles.targetsHeader}>
            <span>Product</span>
            <span style={{ textAlign: 'right' }}>Target</span>
            <span style={{ textAlign: 'right' }}>Actual</span>
            <span style={{ textAlign: 'right' }}>Shortage</span>
            <span style={{ textAlign: 'right' }}>Carry-Over</span>
            <span style={{ textAlign: 'right' }}>Completion</span>
            <span></span>
          </div>

          {targets.map((t) => {
            const pct = t.targetQty > 0 ? Math.min(100, Math.round((t.actualQty / t.targetQty) * 100)) : 0;
            const met = pct >= 100;
            const statusColor = met ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';

            return (
              <div key={t.id} className={styles.targetRow}>
                <div className={styles.targetProduct}>
                  <span className={styles.targetProductName}>{t.product?.name ?? '—'}</span>
                  {t.carriedOverShortage > 0 && (
                    <span className={styles.carryoverBadge}>+{t.carriedOverShortage} carried</span>
                  )}
                </div>
                <span className={styles.targetNum}>{t.targetQty.toLocaleString()}</span>
                <span className={styles.targetNum}>{t.actualQty.toLocaleString()}</span>
                <span className={styles.targetNum} style={{ color: t.shortage > 0 ? '#dc2626' : '#16a34a' }}>
                  {t.shortage > 0 ? `-${t.shortage}` : '✓'}
                </span>
                <span className={styles.targetNum}>{t.carriedOverShortage > 0 ? t.carriedOverShortage.toLocaleString() : '—'}</span>
                <div className={styles.targetProgress}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%`, background: statusColor }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor }}>{pct}%</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Update Target' : 'Set Daily Target'} size="sm">
        <div className={styles.form}>
          {!editTarget && (
            <Select label="Product" options={productOptions} value={form.productId} onChange={setField('productId')} placeholder="Select product" />
          )}
          {editTarget && (
            <div className={styles.editProductLabel}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</span>
              <span style={{ fontWeight: 700 }}>{editTarget.product?.name}</span>
            </div>
          )}
          <Input label="Production Target" type="number" value={form.target} onChange={setField('target')} />
          <Input label="Actual Produced" type="number" value={form.actual} onChange={setField('actual')} />
          <div className={styles.inputGroup}>
            <Input label="Carried Over" type="number" value={form.carriedOver} onChange={setField('carriedOver')} />
            {!editTarget && (
              <Button size="sm" variant="ghost" onClick={handleLoadShortage} className={styles.loadBtn}>Load Prev. Shortage</Button>
            )}
          </div>
          {Number(form.target) > 0 && Number(form.actual) >= 0 && (
            <div className={styles.shortageHint}>
              {computedShortage > 0
                ? <span style={{ color: '#dc2626' }}>⚠ Shortage: {computedShortage} units will carry forward</span>
                : Number(form.actual) > 0
                  ? <span style={{ color: '#16a34a' }}>✓ Target met — no shortfall</span>
                  : null
              }
            </div>
          )}

          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editTarget ? 'Update' : 'Set Target'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ProductionPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'targets'>('batches');
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Production</h1>
          <p className={styles.subheading}>Track batches and manage daily production targets.</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'batches' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          Production Batches
        </button>
        {isAdmin && (
          <button
            className={`${styles.tab} ${activeTab === 'targets' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('targets')}
          >
            Daily Targets
          </button>
        )}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'batches' && <BatchesTab />}
        {activeTab === 'targets' && isAdmin && <DailyTargetsTab />}
      </div>
    </div>
  );
}
