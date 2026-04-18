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

  const handleProductChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedProductId(id);
    if (!id) return;

    try {
      const res = await api.get<{ shortage: number }>(
        `/production/targets/previous-shortage?productId=${id}&date=${selectedDate}`
      );
      if (res.shortage > 0) {
        setNotes((prev) => (prev ? `${prev} (Auto-loaded shortage: ${res.shortage})` : `Auto-loaded shortage: ${res.shortage}`));
        showToast(`Previous shortage found: ${res.shortage} units`);
      }
    } catch {
      // Ignore errors for auto-fetch
    }
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

// ─── Daily Run Tab ────────────────────────────────────────────────────────
function DailyRunTab() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [dailyRun, setDailyRun] = useState<{ status: string, items: any[] } | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const fetchDailyRun = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/production/daily-run?date=${selectedDate}`);
      
      let items = [];
      const newEdits: Record<string, number> = {};

      if (res.status === 'not_started') {
        items = res.suggestions;
        items.forEach((i: any) => newEdits[i.productId] = 0);
      } else {
        items = res.targets;
        items.forEach((i: any) => newEdits[i.productId] = res.status === 'in_progress' ? 0 : i.actualQty);
      }
      
      setDailyRun({ status: res.status, items });
      setEdits(newEdits);
    } catch {
      setDailyRun(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchDailyRun(); }, [fetchDailyRun]);

  const handleEditChange = (productId: string, val: string) => {
    setEdits(prev => ({ ...prev, [productId]: Number(val) }));
  };

  const handleStartProduction = async () => {
    setSaving(true);
    try {
      const payload = dailyRun!.items.map(i => ({
        productId: i.productId,
        target: edits[i.productId] || 0,
        carriedOver: i.carriedOverShortage || 0,
      }));
      await api.post(`/production/daily-run?date=${selectedDate}`, payload);
      showToast('Production started for the day', 'success');
      fetchDailyRun();
    } catch (e: any) {
      showToast(e.message || 'Failed to start', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteProduction = async () => {
    setSaving(true);
    try {
      const payload = dailyRun!.items.map(i => ({
        productId: i.productId,
        actual: edits[i.productId] || 0,
      }));
      await api.patch(`/production/daily-run/complete?date=${selectedDate}`, payload);
      showToast('Production marked as completed', 'success');
      fetchDailyRun();
    } catch (e: any) {
      showToast(e.message || 'Failed to complete', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className={styles.filters}>
        <Input label="Target Date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      {loading ? (
        <div className={styles.emptyState}>Loading daily run data…</div>
      ) : !dailyRun ? (
        <div className={styles.emptyState}>Failed to load production data.</div>
      ) : dailyRun.items.length === 0 ? (
        <div className={styles.emptyState}>
          No breads found in the system to process.
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Daily Run: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              <p className={styles.cardHelp}>
                {dailyRun.status === 'not_started' && 'Enter your target quantities for the day, then push them to processing.'}
                {dailyRun.status === 'in_progress' && 'Production is in progress. Enter actual produced amounts to mark completion.'}
                {dailyRun.status === 'completed' && 'Production has been completed for this date.'}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[dailyRun.status] ?? 'neutral'}>{STATUS_LABEL[dailyRun.status] ?? 'Not Started'}</Badge>
          </div>

          <div className={styles.targetGrid}>
            <div className={dailyRun.status === 'not_started' ? styles.gridHeader : styles.actualsHeader}>
              <span>Product</span>
              {dailyRun.status === 'not_started' && <span style={{ textAlign: 'center' }}>Carried Over</span>}
              {dailyRun.status === 'not_started' && <span style={{ textAlign: 'center' }}>Today's Target</span>}
              {dailyRun.status === 'not_started' && <span style={{ textAlign: 'center' }}>Total Goal</span>}
              
              {dailyRun.status !== 'not_started' && <span style={{ textAlign: 'center' }}>Total Target</span>}
              {dailyRun.status !== 'not_started' && <span style={{ textAlign: 'center' }}>Actual Produced</span>}
            </div>

            {dailyRun.items.map(item => {
              const totalGoal = (item.carriedOverShortage || item.carriedOverShortage || 0) + (edits[item.productId] || 0);
              const totalTarget = (item.targetQty || 0) + (item.carriedOverShortage || 0);

              return (
                <div key={item.productId} className={dailyRun.status === 'not_started' ? styles.gridRow : styles.actualsRow}>
                  <span className={styles.productName}>{item.product?.name}</span>
                  
                  {dailyRun.status === 'not_started' && (
                    <span className={styles.carriedOver}>{item.carriedOverShortage > 0 ? `+${item.carriedOverShortage}` : '—'}</span>
                  )}

                  {dailyRun.status === 'not_started' && (
                    <div className={styles.targetInput}>
                      <Input 
                        type="number" 
                        value={edits[item.productId]} 
                        onChange={e => handleEditChange(item.productId, e.target.value)}
                        className={styles.inlineInput}
                      />
                    </div>
                  )}

                  {dailyRun.status === 'not_started' && (
                    <span className={styles.totalToBake}>{totalGoal > 0 ? totalGoal : '—'}</span>
                  )}

                  {dailyRun.status !== 'not_started' && (
                    <span className={styles.targetNum} style={{ textAlign: 'center' }}>{totalTarget}</span>
                  )}

                  {dailyRun.status !== 'not_started' && (
                    <div className={styles.targetInput}>
                      <Input 
                        type="number" 
                        value={edits[item.productId]} 
                        onChange={e => handleEditChange(item.productId, e.target.value)}
                        className={styles.inlineInput}
                        disabled={dailyRun.status === 'completed'}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.modalActions} style={{ padding: '1rem 1.5rem', background: '#fcfcfd' }}>
            {dailyRun.status === 'not_started' && (
              <Button onClick={handleStartProduction} loading={saving}>Push to Processing</Button>
            )}
            {dailyRun.status === 'in_progress' && (
              <Button onClick={handleCompleteProduction} loading={saving} variant="primary">Mark Completion</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ProductionPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'targets'>('targets');
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
            Daily Run
          </button>
        )}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'batches' && <BatchesTab />}
        {activeTab === 'targets' && isAdmin && <DailyRunTab />}
      </div>
    </div>
  );
}
