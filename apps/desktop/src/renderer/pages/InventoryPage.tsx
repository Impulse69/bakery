import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Product, StockAdjustment } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Badge } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/AuthContext';
import { can } from '@bakery/utils';
import styles from './InventoryPage.module.css';

const columns: DataTableColumn<Product>[] = [
  { key: 'name', label: 'Product Name', sortable: true },
  { key: 'category', label: 'Category' },
  { key: 'stockQuantity', label: 'Current Stock', sortable: true },
  {
    key: 'isAvailable',
    label: 'Status',
    render: (row) => (
      <Badge variant={row.stockQuantity > 0 ? 'success' : 'danger'}>
        {row.stockQuantity > 0 ? 'In Stock' : 'Sold Out'}
      </Badge>
    ),
  },
];

const ADJUSTMENT_TYPE_MAP: Record<string, { variant: 'success' | 'info' | 'danger' | 'warning'; label: string }> = {
  purchase: { variant: 'success', label: 'Purchase' },
  production: { variant: 'info', label: 'Production' },
  waste: { variant: 'danger', label: 'Waste' },
  correction: { variant: 'warning', label: 'Correction' },
};

export function InventoryPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role ? can(user.role, 'inventory:write') : false;
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'history'>('details');
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Adjust stock
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Product[]; total: number }>(
        `/products?page=${page}&limit=${limit}`,
      );
      setItems(res.data);
      setTotal(res.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (detailTab === 'history' && selectedItem) {
      setHistoryLoading(true);
      api
        .get<StockAdjustment[]>(`/reports/stock-adjustment?productId=${selectedItem.id}`)
        .then(setAdjustments)
        .catch(() => setAdjustments([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [detailTab, selectedItem]);

  const openDetail = (item: Product) => {
    setSelectedItem(item);
    setDetailTab('details');
    setShowAdjustForm(false);
    setAdjustQty('');
    setAdjustReason('');
  };

  const closeDetail = () => {
    setSelectedItem(null);
  };

  const handleAdjust = async () => {
    if (!selectedItem) return;
    const qty = Number(adjustQty);
    if (!qty || !adjustReason.trim()) {
      showToast('Quantity and reason are required', 'error');
      return;
    }
    setAdjusting(true);
    try {
      const updated = await api.post<Product>(`/products/${selectedItem.id}/adjust-stock`, {
        quantityChange: qty,
        reason: adjustReason,
      });
      showToast('Stock adjusted', 'success');
      setShowAdjustForm(false);
      setAdjustQty('');
      setAdjustReason('');
      fetchItems();
      setSelectedItem(updated);
    } catch (err: any) {
      showToast(err.message || 'Failed to adjust stock', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Inventory Stock</h1>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No products found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={closeDetail}
        title={selectedItem?.name ?? 'Item'}
        size="lg"
      >
        {selectedItem && (
          <>
            <div className={styles.tabs}>
              <Button
                variant={detailTab === 'details' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setDetailTab('details')}
              >
                Stock Details
              </Button>
              <Button
                variant={detailTab === 'history' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setDetailTab('history')}
              >
                Stock History
              </Button>
            </div>

            {detailTab === 'details' && (
              <>
                <div className={styles.detailGrid}>
                  <div>
                    <div className={styles.detailLabel}>Category</div>
                    <div className={styles.detailValue}>{selectedItem.category}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Current Stock</div>
                    <div className={styles.detailValue}>{selectedItem.stockQuantity}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Status</div>
                    <div className={styles.detailValue}>
                      <Badge variant={selectedItem.stockQuantity > 0 ? 'success' : 'danger'}>
                        {selectedItem.stockQuantity > 0 ? 'In Stock' : 'Sold Out'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {!showAdjustForm && isAdmin && (
                  <div className={styles.detailActions}>
                    <Button
                      size="sm"
                      onClick={() => setShowAdjustForm(true)}
                      className={styles.actionBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M12 5v14M5 12h14"/></svg>
                      Adjust Stock
                    </Button>
                  </div>
                )}

                {showAdjustForm && (
                  <div className={styles.adjustForm}>
                    <Input
                      label="Quantity Change (+/-)"
                      type="number"
                      value={adjustQty === '0' || adjustQty === '' ? '' : adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      placeholder="e.g. 10 or -5"
                    />
                    <Input
                      label="Reason"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="Reason for adjustment (e.g., waste, correction)"
                    />
                    <div className={styles.actions}>
                      <Button variant="ghost" size="sm" onClick={() => setShowAdjustForm(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleAdjust} loading={adjusting}>
                        Submit Adjustment
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {detailTab === 'history' && (
              <>
                {historyLoading ? (
                  <p>Loading history...</p>
                ) : adjustments.length === 0 ? (
                  <p>No stock adjustments found</p>
                ) : (
                  <div className={styles.tableWrapper}>
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Quantity</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((adj) => {
                        const typeInfo = ADJUSTMENT_TYPE_MAP[adj.adjustmentType] ?? { variant: 'neutral' as const, label: adj.adjustmentType };
                        return (
                          <tr key={adj.id}>
                            <td>{new Date(adj.createdAt).toLocaleString()}</td>
                            <td>
                              <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {adj.quantityChange > 0 ? '+' : ''}{adj.quantityChange}
                            </td>
                            <td>{adj.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
