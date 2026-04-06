import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { InventoryItem, StockAdjustment } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, StockBadge, Badge } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/AuthContext';
import { can } from '@bakery/utils';
import styles from './InventoryPage.module.css';

const UNIT_OPTIONS: SelectOption[] = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'l', label: 'l' },
  { value: 'ml', label: 'ml' },
  { value: 'unit', label: 'unit' },
  { value: 'pack', label: 'pack' },
];

const columns: DataTableColumn<InventoryItem>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'unit', label: 'Unit' },
  { key: 'quantityOnHand', label: 'Stock', sortable: true },
  {
    key: 'lowStockThreshold',
    label: 'Status',
    render: (row) => (
      <StockBadge currentStock={row.quantityOnHand} reorderLevel={row.lowStockThreshold} />
    ),
  },
  { key: 'reorderQuantity', label: 'Reorder Qty' },
];

const EMPTY_FORM = {
  name: '',
  unit: '',
  quantityOnHand: '',
  lowStockThreshold: '',
  reorderQuantity: '',
};

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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'history'>('details');
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit item
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  // Adjust stock
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: InventoryItem[]; total: number }>(
        `/inventory?page=${page}&limit=${limit}`,
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

  // Fetch history when tab switches
  useEffect(() => {
    if (detailTab === 'history' && selectedItem) {
      setHistoryLoading(true);
      api
        .get<StockAdjustment[]>(`/reports/stock-adjustment?itemId=${selectedItem.id}`)
        .then(setAdjustments)
        .catch(() => setAdjustments([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [detailTab, selectedItem]);

  const openAddModal = useCallback(() => {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      // The user wants to create an adjustment or item. 
      // Inventory doesn't have a global "create adjustment" without an item selected,
      // but they can create a new inventory item.
      openAddModal();
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, openAddModal]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.unit) {
      showToast('Name and unit are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/inventory', {
        name: form.name,
        unit: form.unit,
        quantityOnHand: Number(form.quantityOnHand) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
        reorderQuantity: Number(form.reorderQuantity) || 0,
      });
      showToast('Item created', 'success');
      setShowAddModal(false);
      fetchItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to create item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailTab('details');
    setShowAdjustForm(false);
    setShowEditForm(false);
    setAdjustQty('');
    setAdjustReason('');
  };

  const openEditForm = (item: InventoryItem) => {
    setEditForm({
      name: item.name,
      unit: item.unit,
      quantityOnHand: String(item.quantityOnHand),
      lowStockThreshold: String(item.lowStockThreshold),
      reorderQuantity: String(item.reorderQuantity),
    });
    setShowEditForm(true);
    setShowAdjustForm(false);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    if (!editForm.name.trim() || !editForm.unit) {
      showToast('Name and unit are required', 'error');
      return;
    }
    setEditing(true);
    try {
      const updated = await api.patch<InventoryItem>(`/inventory/${selectedItem.id}`, {
        name: editForm.name.trim(),
        unit: editForm.unit,
        lowStockThreshold: Number(editForm.lowStockThreshold) || 0,
        reorderQuantity: Number(editForm.reorderQuantity) || 0,
      });
      showToast('Item updated', 'success');
      setSelectedItem(updated);
      setShowEditForm(false);
      fetchItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to update item', 'error');
    } finally {
      setEditing(false);
    }
  };

  const closeDetail = () => {
    setSelectedItem(null);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`Delete "${selectedItem.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/inventory/${selectedItem.id}`);
      showToast('Item deleted', 'success');
      closeDetail();
      fetchItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete item', 'error');
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
      const updated = await api.post<InventoryItem>(`/inventory/${selectedItem.id}/adjust`, {
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

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Inventory</h1>
        <Button onClick={openAddModal}>Add Item</Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No inventory items found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Inventory Item" size="md">
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={setField('name')} />
          <Select
            label="Unit"
            options={UNIT_OPTIONS}
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            placeholder="Select unit"
          />
          <Input label="Quantity on Hand" type="number" value={form.quantityOnHand === '0' || form.quantityOnHand === '' ? '' : form.quantityOnHand} placeholder="0" onChange={setField('quantityOnHand')} />
          <div title="When stock falls to or below this number, the item is flagged as Low stock — a signal to reorder" style={{ cursor: 'help' }}>
            <Input label="Low Stock Threshold" type="number" value={form.lowStockThreshold === '0' || form.lowStockThreshold === '' ? '' : form.lowStockThreshold} placeholder="0" onChange={setField('lowStockThreshold')} />
          </div>
          <div title="Suggested quantity to order when restocking this item (used as a guide for purchase orders)" style={{ cursor: 'help' }}>
            <Input label="Reorder Quantity" type="number" value={form.reorderQuantity === '0' || form.reorderQuantity === '' ? '' : form.reorderQuantity} placeholder="0" onChange={setField('reorderQuantity')} />
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>

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
                Details
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
                    <div className={styles.detailLabel}>Unit</div>
                    <div className={styles.detailValue}>{selectedItem.unit}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Current Stock</div>
                    <div className={styles.detailValue}>{selectedItem.quantityOnHand}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Status</div>
                    <div className={styles.detailValue}>
                      <StockBadge
                        currentStock={selectedItem.quantityOnHand}
                        reorderLevel={selectedItem.lowStockThreshold}
                      />
                    </div>
                  </div>
                  <div>
                    <div className={styles.detailLabel} title="When stock falls to or below this number, the item is flagged as Low stock — a signal to reorder" style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>Reorder Level</div>
                    <div className={styles.detailValue}>{selectedItem.lowStockThreshold}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel} title="Suggested quantity to order when restocking this item (used as a guide for purchase orders)" style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>Reorder Qty</div>
                    <div className={styles.detailValue}>{selectedItem.reorderQuantity}</div>
                  </div>
                </div>

                {!showAdjustForm && !showEditForm && (
                  <div className={styles.detailActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditForm(selectedItem)}
                      className={styles.actionBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      Edit Item
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowAdjustForm(true)}
                      className={styles.actionBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M12 5v14M5 12h14"/></svg>
                      Adjust Stock
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={handleDelete}
                        className={styles.actionBtn}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )}

                {showEditForm && (
                  <div className={styles.adjustForm}>
                    <Input label="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    <Select
                      label="Unit"
                      options={UNIT_OPTIONS}
                      value={editForm.unit}
                      onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                    />
                    <div title="When stock falls to or below this number, the item is flagged as Low stock — a signal to reorder" style={{ cursor: 'help' }}>
                      <Input label="Low Stock Threshold" type="number" value={editForm.lowStockThreshold} onChange={(e) => setEditForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} />
                    </div>
                    <div title="Suggested quantity to order when restocking this item (used as a guide for purchase orders)" style={{ cursor: 'help' }}>
                      <Input label="Reorder Quantity" type="number" value={editForm.reorderQuantity} onChange={(e) => setEditForm((f) => ({ ...f, reorderQuantity: e.target.value }))} />
                    </div>
                    <div className={styles.actions}>
                      <Button variant="ghost" size="sm" onClick={() => setShowEditForm(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleEdit} loading={editing}>Save Changes</Button>
                    </div>
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
                      placeholder="Reason for adjustment"
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
