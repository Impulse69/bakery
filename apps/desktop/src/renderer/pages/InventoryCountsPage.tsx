import { useState, useEffect, useCallback } from 'react';
import type { InventoryCount, InventoryCountItem } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Badge } from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './InventoryCountsPage.module.css';

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'neutral'> = {
  in_progress: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function InventoryCountsPage() {
  const { showToast } = useToast();
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedCount, setSelectedCount] = useState<InventoryCount | null>(null);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: InventoryCount[]; total: number }>(
        `/inventory-counts?page=${page}&limit=${limit}`,
      );
      setCounts(res.data);
      setTotal(res.total);
    } catch {
      setCounts([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const openDetail = async (count: InventoryCount) => {
    try {
      const full = await api.get<InventoryCount>(`/inventory-counts/${count.id}`);
      setSelectedCount(full);
      // Initialize edited quantities from existing data
      const quantities: Record<string, string> = {};
      for (const item of full.items ?? []) {
        quantities[item.id] = item.actualQuantity != null ? String(item.actualQuantity) : '';
      }
      setEditedQuantities(quantities);
    } catch (err: any) {
      showToast(err.message || 'Failed to load count', 'error');
    }
  };

  const handleStartNew = async () => {
    setStarting(true);
    try {
      const created = await api.post<InventoryCount>('/inventory-counts', { locationId: 'default' });
      showToast('Inventory count started', 'success');
      fetchCounts();
      // Open the newly created count
      setSelectedCount(created);
      const quantities: Record<string, string> = {};
      for (const item of created.items ?? []) {
        quantities[item.id] = '';
      }
      setEditedQuantities(quantities);
    } catch (err: any) {
      showToast(err.message || 'Failed to start count', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!selectedCount) return;
    const items = Object.entries(editedQuantities)
      .filter(([, qty]) => qty !== '')
      .map(([id, qty]) => ({ id, actualQuantity: Number(qty) }));
    if (items.length === 0) {
      showToast('No quantities entered', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<InventoryCount>(`/inventory-counts/${selectedCount.id}`, { items });
      showToast('Progress saved', 'success');
      setSelectedCount(updated);
      // Re-sync edited quantities
      const quantities: Record<string, string> = {};
      for (const item of updated.items ?? []) {
        quantities[item.id] = item.actualQuantity != null ? String(item.actualQuantity) : '';
      }
      setEditedQuantities(quantities);
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedCount) return;
    if (!window.confirm('Complete this count? Stock adjustments will be created for all discrepancies.')) return;
    setCompleting(true);
    try {
      const updated = await api.post<InventoryCount>(`/inventory-counts/${selectedCount.id}/complete`);
      showToast('Count completed', 'success');
      setSelectedCount(updated);
      fetchCounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete count', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const columns: DataTableColumn<InventoryCount>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'neutral'}>
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'createdBy',
      label: 'Created By',
      render: (row: any) => row.user?.name ?? '—',
    },
    {
      key: 'items',
      label: 'Items',
      render: (row: any) => String(row._count?.items ?? row.items?.length ?? 0),
    },
  ];

  const getDiscrepancy = (item: InventoryCountItem): number | null => {
    const actual = editedQuantities[item.id];
    if (actual === '' || actual == null) return null;
    return Number(actual) - item.expectedQuantity;
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Inventory Counts</h1>
        <Button onClick={handleStartNew} loading={starting}>Start New Count</Button>
      </div>

      <DataTable
        columns={columns}
        data={counts}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No inventory counts found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal
        isOpen={!!selectedCount}
        onClose={() => setSelectedCount(null)}
        title="Inventory Count"
        size="lg"
      >
        {selectedCount && (
          <>
            <div className={styles.meta}>
              <div>
                <span className={styles.metaLabel}>Status: </span>
                <Badge variant={STATUS_VARIANT[selectedCount.status] ?? 'neutral'}>
                  {STATUS_LABEL[selectedCount.status] ?? selectedCount.status}
                </Badge>
              </div>
              <div>
                <span className={styles.metaLabel}>Started: </span>
                {new Date(selectedCount.createdAt).toLocaleString()}
              </div>
              {selectedCount.completedAt && (
                <div>
                  <span className={styles.metaLabel}>Completed: </span>
                  {new Date(selectedCount.completedAt).toLocaleString()}
                </div>
              )}
            </div>

            <table className={styles.countTable}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {(selectedCount.items ?? []).map((item) => {
                  const disc = getDiscrepancy(item);
                  return (
                    <tr key={item.id}>
                      <td>{item.inventoryItem?.name ?? item.inventoryItemId}</td>
                      <td>{item.expectedQuantity}</td>
                      <td>
                        {selectedCount.status === 'in_progress' ? (
                          <input
                            className={styles.countInput}
                            type="number"
                            value={editedQuantities[item.id] ?? ''}
                            onChange={(e) =>
                              setEditedQuantities((q) => ({ ...q, [item.id]: e.target.value }))
                            }
                          />
                        ) : (
                          item.actualQuantity ?? '—'
                        )}
                      </td>
                      <td>
                        {disc != null ? (
                          <span
                            className={`${styles.discrepancy} ${
                              disc > 0 ? styles.discrepancyPositive : disc < 0 ? styles.discrepancyNegative : ''
                            }`}
                          >
                            {disc > 0 ? '+' : ''}{disc}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedCount.status === 'in_progress' && (
              <div className={styles.actions}>
                <Button variant="secondary" onClick={handleSaveProgress} loading={saving}>
                  Save Progress
                </Button>
                <Button onClick={handleComplete} loading={completing}>
                  Complete Count
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
