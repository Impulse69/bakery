import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductStockAdjustment } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Badge } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/AuthContext';
import { can, formatCurrency } from '@bakery/utils';
import { getSocket } from '../lib/socket';
import styles from './InventoryPage.module.css';

const LOW_STOCK_THRESHOLD = 10;

const stockClass = (qty: number) => {
  if (qty <= 0) return `${styles.num} ${styles.numOut}`;
  if (qty < LOW_STOCK_THRESHOLD) return `${styles.num} ${styles.numLow}`;
  return styles.num;
};

/** Pull selling price from either the new or legacy field. */
function sellingPriceOf(p: Product): number {
  return (p as { sellingPrice?: number; price?: number }).sellingPrice
    ?? (p as { price?: number }).price
    ?? 0;
}

interface InventoryValue {
  totalValue: number;
  totalCostValue: number;
  totalUnits: number;
  productCount: number;
}

const columns: DataTableColumn<Product>[] = [
  { key: 'name', label: 'Product Name', sortable: true },
  { key: 'category', label: 'Category' },
  {
    key: 'stockQuantity',
    label: 'Current Stock',
    sortable: true,
    render: (row) => <span className={stockClass(row.stockQuantity)}>{row.stockQuantity}</span>,
  },
  {
    key: 'sellingPrice',
    label: 'Selling Price',
    render: (row) => (
      <span className={styles.priceCell}>{formatCurrency(sellingPriceOf(row))}</span>
    ),
  },
  {
    key: 'lineValue',
    label: 'Line Value',
    render: (row) => (
      <span className={styles.priceCell}>
        {formatCurrency(Math.round(row.stockQuantity * sellingPriceOf(row)))}
      </span>
    ),
  },
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

export function InventoryPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role ? can(user.role, 'inventory:write') : false;
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Total selling-price worth of all in-stock items (spans every page).
  const [value, setValue] = useState<InventoryValue | null>(null);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'history'>('details');
  const [adjustments, setAdjustments] = useState<ProductStockAdjustment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Adjust stock
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Liquidation (end-of-day write-off — bread expires)
  const [showLiquidate, setShowLiquidate] = useState(false);
  const [liquidateReason, setLiquidateReason] = useState('Shelf life expired — end-of-day liquidation');
  const [liquidating, setLiquidating] = useState(false);

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

  /** Fetch the global stock-value rollup (independent of pagination). */
  const fetchValue = useCallback(async () => {
    try {
      const res = await api.get<InventoryValue>('/inventory/value');
      setValue(res);
    } catch {
      setValue(null);
    }
  }, []);

  useEffect(() => {
    fetchValue();
  }, [fetchValue]);

  // Refresh the total whenever stock changes anywhere in the app (sales, adjusts).
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      fetchValue();
      fetchItems();
    };
    socket.on('inventory:update', refresh);
    socket.on('sale:created', refresh);
    socket.on('sale:updated', refresh);
    return () => {
      socket.off('inventory:update', refresh);
      socket.off('sale:created', refresh);
      socket.off('sale:updated', refresh);
    };
  }, [fetchValue, fetchItems]);

  useEffect(() => {
    if (detailTab === 'history' && selectedItem) {
      setHistoryLoading(true);
      api
        .get<ProductStockAdjustment[]>(`/reports/stock-adjustment?productId=${selectedItem.id}`)
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

  const handleLiquidate = async () => {
    if (!liquidateReason.trim()) {
      showToast('Reason is required', 'error');
      return;
    }
    setLiquidating(true);
    try {
      const res = await api.post<{ productsAffected: number; unitsWrittenOff: number; costWrittenOff: number }>(
        '/inventory/liquidate',
        { reason: liquidateReason.trim() },
      );
      if (res.productsAffected === 0) {
        showToast('Nothing to liquidate — stock is already at zero.', 'success');
      } else {
        showToast(
          `Liquidated ${res.unitsWrittenOff.toLocaleString()} units across ${res.productsAffected} products.`,
          'success',
        );
      }
      setShowLiquidate(false);
      fetchItems();
      fetchValue();
    } catch (err: any) {
      showToast(err.message || 'Liquidation failed', 'error');
    } finally {
      setLiquidating(false);
    }
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
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Inventory Ledger</span>
          <h1 className={styles.heading}>Stock on Hand</h1>
          <p className={styles.heroQuote}>
            <em>Counts, movements, and what&rsquo;s running thin.</em>
          </p>
        </div>
      </header>

      <div className={styles.tableCard}>
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          onRowClick={openDetail}
          emptyMessage="No products on the shelf."
        />
      </div>

      {/* Global stock-value summary — recomputes on every sale via socket. */}
      <section className={styles.valueCard} aria-label="Total inventory value">
        <div className={styles.valueLeft}>
          <span className={styles.valueEyebrow}>Sellable stock value</span>
          <span className={styles.valueAmount}>
            {value ? formatCurrency(value.totalValue) : '—'}
          </span>
          <span className={styles.valueSub}>
            If every unit on the shelf sells today, this is your ceiling.
          </span>
        </div>
        <div className={styles.valueRight}>
          <div className={styles.valueStat}>
            <span className={styles.valueStatLabel}>Units in stock</span>
            <span className={styles.valueStatValue}>
              {value ? value.totalUnits.toLocaleString() : '—'}
            </span>
          </div>
          <div className={styles.valueStat}>
            <span className={styles.valueStatLabel}>Products</span>
            <span className={styles.valueStatValue}>
              {value ? value.productCount : '—'}
            </span>
          </div>
          {isAdmin && value && value.totalCostValue > 0 && (
            <div className={styles.valueStat}>
              <span className={styles.valueStatLabel}>Cost basis</span>
              <span className={styles.valueStatValue}>
                {formatCurrency(value.totalCostValue)}
              </span>
            </div>
          )}
          {isAdmin && (
            <div className={styles.valueAction}>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowLiquidate(true)}
                disabled={!value || value.totalUnits === 0}
              >
                Liquidate Stock
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Liquidation confirm — wipes all in-stock quantities to zero with a written-off audit row per product. */}
      <Modal
        isOpen={showLiquidate}
        onClose={() => !liquidating && setShowLiquidate(false)}
        title="Liquidate Stock"
        size="md"
      >
        <div className={styles.liquidateBody}>
          <p className={styles.liquidateLead}>
            Bread doesn&rsquo;t keep. This zeroes every product&rsquo;s stock and records a write-off
            so the loss shows up in stock history and cost reports.
          </p>
          {value && (
            <div className={styles.liquidateStats}>
              <div>
                <span className={styles.liquidateStatLabel}>Units written off</span>
                <span className={styles.liquidateStatValue}>{value.totalUnits.toLocaleString()}</span>
              </div>
              <div>
                <span className={styles.liquidateStatLabel}>Products affected</span>
                <span className={styles.liquidateStatValue}>{value.productCount}</span>
              </div>
              {value.totalCostValue > 0 && (
                <div>
                  <span className={styles.liquidateStatLabel}>Cost basis lost</span>
                  <span className={styles.liquidateStatValue}>{formatCurrency(value.totalCostValue)}</span>
                </div>
              )}
            </div>
          )}
          <Input
            label="Reason (recorded against every product)"
            value={liquidateReason}
            onChange={(e) => setLiquidateReason(e.target.value)}
            placeholder="e.g. Shelf life expired — end-of-day liquidation"
          />
          <p className={styles.liquidateWarn}>This cannot be undone from the UI.</p>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={() => setShowLiquidate(false)} disabled={liquidating}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleLiquidate} loading={liquidating}>
              Yes, liquidate
            </Button>
          </div>
        </div>
      </Modal>

      {totalPages > 1 && (
        <div className={styles.pagerWrap}>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
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
            <div className={styles.tabsRow}>
              <button
                className={`${styles.tab} ${detailTab === 'details' ? styles.tabActive : ''}`}
                onClick={() => setDetailTab('details')}
              >
                Stock Details
              </button>
              {/* Stock history endpoint is admin/owner-only — hide tab for cashier. */}
              {isAdmin && (
                <button
                  className={`${styles.tab} ${detailTab === 'history' ? styles.tabActive : ''}`}
                  onClick={() => setDetailTab('history')}
                >
                  Stock History
                </button>
              )}
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
                    <div className={styles.detailValue}>
                      <span className={stockClass(selectedItem.stockQuantity)}>{selectedItem.stockQuantity}</span>
                    </div>
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
                          <th>Quantity</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjustments.map((adj) => (
                          <tr key={adj.id}>
                            <td>{new Date(adj.createdAt).toLocaleString()}</td>
                            <td style={{ fontWeight: 700 }}>
                              {adj.quantityChange > 0 ? '+' : ''}{adj.quantityChange}
                            </td>
                            <td>{adj.reason || '—'}</td>
                          </tr>
                        ))}
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
