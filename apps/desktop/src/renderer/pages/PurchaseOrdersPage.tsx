import { useState, useEffect, useCallback } from 'react';
import type { PurchaseOrder, PurchaseOrderStatus, Supplier, InventoryItem } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, Badge, FormSection } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './PurchaseOrdersPage.module.css';

const STATUS_TABS: { label: string; value: PurchaseOrderStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  draft: 'neutral',
  submitted: 'info',
  received: 'success',
  cancelled: 'danger',
};

interface LineItem {
  inventoryItemId: string;
  quantityOrdered: string;
  unit: string;
  unitCostDisplay: string;
}

const EMPTY_LINE: LineItem = { inventoryItemId: '', quantityOrdered: '', unit: '', unitCostDisplay: '' };

const columns: DataTableColumn<PurchaseOrder>[] = [
  { key: 'poNumber', label: 'PO #', sortable: true },
  {
    key: 'supplier',
    label: 'Supplier',
    render: (row) => (row as any).supplier?.name ?? '—',
  },
  {
    key: 'totalAmount',
    label: 'Total',
    sortable: true,
    render: (row) => formatCurrency(row.totalAmount),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <Badge variant={STATUS_VARIANT[row.status] ?? 'neutral'}>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'orderedDate',
    label: 'Ordered',
    render: (row) => new Date(row.orderedDate).toLocaleDateString(),
  },
  {
    key: 'expectedDeliveryDate',
    label: 'Expected',
    render: (row) => row.expectedDeliveryDate ? new Date(row.expectedDeliveryDate).toLocaleDateString() : '—',
  },
];

export function PurchaseOrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');

  // Dropdowns
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // New PO modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      const res = await api.get<{ data: PurchaseOrder[]; total: number }>(
        `/purchase-orders?page=${page}&limit=${limit}${statusParam}`,
      );
      setOrders(res.data);
      setTotal(res.total);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch dropdowns once
  useEffect(() => {
    api.get<{ data: Supplier[] }>('/suppliers?limit=100').then((r) => setSuppliers(r.data)).catch(() => {});
    api.get<{ data: InventoryItem[] }>('/inventory?limit=100').then((r) => setInventoryItems(r.data)).catch(() => {});
  }, []);

  const supplierOptions: SelectOption[] = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const itemOptions: SelectOption[] = inventoryItems.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));

  const handleTabChange = (value: PurchaseOrderStatus | '') => {
    setStatusFilter(value);
    setPage(1);
  };

  // Line item management
  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((items) => items.map((li, i) => {
      if (i !== index) return li;
      const updated = { ...li, [field]: value };
      // Auto-fill unit from inventory item
      if (field === 'inventoryItemId') {
        const item = inventoryItems.find((inv) => inv.id === value);
        if (item) updated.unit = item.unit;
      }
      return updated;
    }));
  };

  const addLineItem = () => setLineItems((items) => [...items, { ...EMPTY_LINE }]);
  const removeLineItem = (index: number) => setLineItems((items) => items.filter((_, i) => i !== index));

  const grandTotal = lineItems.reduce((sum, li) => {
    const qty = Number(li.quantityOrdered) || 0;
    const cost = Math.round(Number(li.unitCostDisplay) * 100);
    return sum + qty * cost;
  }, 0);

  const openNewModal = () => {
    setSupplierId('');
    setExpectedDate('');
    setPoNotes('');
    setLineItems([{ ...EMPTY_LINE }]);
    setShowNewModal(true);
  };

  const handleCreate = async () => {
    if (!supplierId) {
      showToast('Supplier is required', 'error');
      return;
    }
    const validItems = lineItems.filter((li) => li.inventoryItemId && Number(li.quantityOrdered) > 0);
    if (validItems.length === 0) {
      showToast('At least one line item is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        supplierId,
        expectedDeliveryDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
        notes: poNotes || undefined,
        items: validItems.map((li) => ({
          inventoryItemId: li.inventoryItemId,
          quantityOrdered: Number(li.quantityOrdered),
          unit: li.unit,
          unitCost: Math.round(Number(li.unitCostDisplay) * 100),
        })),
      });
      showToast('Purchase order created', 'success');
      setShowNewModal(false);
      fetchOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to create PO', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (order: PurchaseOrder) => {
    // The list response includes supplier but may not include full items
    // Use the order as-is since API includes supplier and _count
    setSelectedOrder(order);
  };

  const handleStatusChange = async (newStatus: PurchaseOrderStatus) => {
    if (!selectedOrder) return;
    setStatusChanging(true);
    try {
      const updated = await api.patch<PurchaseOrder>(`/purchase-orders/${selectedOrder.id}/status`, { status: newStatus });
      showToast(`PO ${newStatus}`, 'success');
      setSelectedOrder(updated);
      fetchOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setStatusChanging(false);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Purchase Orders</h1>
        <Button onClick={openNewModal}>New Purchase Order</Button>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No purchase orders found"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* New PO Modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Purchase Order" size="lg">
        <div className={styles.form}>
          <Select
            label="Supplier"
            options={supplierOptions}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="Select supplier"
          />
          <Input
            label="Expected Delivery Date"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
          <Input
            label="Notes"
            value={poNotes}
            onChange={(e) => setPoNotes(e.target.value)}
          />

          <FormSection title="Line Items">
            {lineItems.map((li, i) => (
              <div key={i} className={styles.lineItem}>
                <Select
                  label={i === 0 ? 'Item' : undefined}
                  options={itemOptions}
                  value={li.inventoryItemId}
                  onChange={(e) => updateLineItem(i, 'inventoryItemId', e.target.value)}
                  placeholder="Select item"
                />
                <Input
                  label={i === 0 ? 'Qty' : undefined}
                  type="number"
                  value={li.quantityOrdered}
                  onChange={(e) => updateLineItem(i, 'quantityOrdered', e.target.value)}
                />
                <Input
                  label={i === 0 ? 'Unit' : undefined}
                  value={li.unit}
                  onChange={(e) => updateLineItem(i, 'unit', e.target.value)}
                />
                <Input
                  label={i === 0 ? 'Cost (GH₵)' : undefined}
                  type="number"
                  value={li.unitCostDisplay}
                  onChange={(e) => updateLineItem(i, 'unitCostDisplay', e.target.value)}
                  placeholder="0.00"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeLineItem(i)}
                  disabled={lineItems.length === 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addLineItem}>+ Add Item</Button>
          </FormSection>

          <div className={styles.grandTotal}>
            Total: {formatCurrency(grandTotal)}
          </div>

          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `PO ${selectedOrder.poNumber}` : 'Purchase Order'}
        size="lg"
      >
        {selectedOrder && (
          <>
            <div className={styles.detailGrid}>
              <div>
                <div className={styles.detailLabel}>Supplier</div>
                <div className={styles.detailValue}>{selectedOrder.supplier?.name ?? '—'}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Status</div>
                <div className={styles.detailValue}>
                  <Badge variant={STATUS_VARIANT[selectedOrder.status] ?? 'neutral'}>
                    {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                  </Badge>
                </div>
              </div>
              <div>
                <div className={styles.detailLabel}>Total</div>
                <div className={styles.detailValue}>{formatCurrency(selectedOrder.totalAmount)}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Ordered</div>
                <div className={styles.detailValue}>{new Date(selectedOrder.orderedDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div className={styles.detailLabel}>Expected</div>
                <div className={styles.detailValue}>
                  {selectedOrder.expectedDeliveryDate
                    ? new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString()
                    : '—'}
                </div>
              </div>
              <div>
                <div className={styles.detailLabel}>Received</div>
                <div className={styles.detailValue}>
                  {selectedOrder.receivedDate
                    ? new Date(selectedOrder.receivedDate).toLocaleDateString()
                    : '—'}
                </div>
              </div>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty Ordered</th>
                    <th>Qty Received</th>
                    <th>Unit</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.inventoryItemId}</td>
                      <td>{item.quantityOrdered}</td>
                      <td>{item.quantityReceived}</td>
                      <td>{item.unit}</td>
                      <td>{formatCurrency(item.unitCost)}</td>
                      <td>{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'right' }}>Total</td>
                    <td>{formatCurrency(selectedOrder.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {selectedOrder.notes && <p>{selectedOrder.notes}</p>}

            <div className={styles.actions}>
              {selectedOrder.status === 'draft' && (
                <Button onClick={() => handleStatusChange('submitted')} loading={statusChanging}>
                  Submit
                </Button>
              )}
              {selectedOrder.status === 'submitted' && (
                <Button onClick={() => handleStatusChange('received')} loading={statusChanging}>
                  Mark Received
                </Button>
              )}
              {!['received', 'cancelled'].includes(selectedOrder.status) && (
                <Button
                  variant="danger"
                  onClick={() => handleStatusChange('cancelled')}
                  loading={statusChanging}
                >
                  Cancel Order
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
