import { useState, useEffect, useCallback } from 'react';
import type { SalesOrder } from '@bakery/types';
import { Modal, Button, OrderStatusBadge, Input } from '@bakery/ui';
import { useAuth } from '../store/AuthContext';
import { Receipt } from './pos/Receipt';
import { AddItemPicker } from './sales/AddItemPicker';
import { ReasonPicker } from './sales/ReasonPicker';

import { formatCurrency, can } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from './Toast';
import styles from './OrderDetailModal.module.css';


interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
  onUpdate: () => void;
}

/** Relative-time formatter so the Edited chip reads naturally
 *  ("just now", "12m ago", "3h ago") without dragging in a date library. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

type PendingEdit =
  | { kind: 'qty'; itemId: string; currentQty: number }
  | { kind: 'remove'; itemId: string; itemName: string };

export function OrderDetailModal({ orderId, onClose, onUpdate }: OrderDetailModalProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod] = useState('cash');
  const [showReceipt, setShowReceipt] = useState(false);

  // Single state for the in-flight modification (qty change OR remove).
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');

  // Add-item picker visibility
  const [showAddItem, setShowAddItem] = useState(false);

  const canPrint = user?.role === 'admin' || user?.role === 'cashier';

  /** Cashier may only edit their own orders; admin/owner can edit any. */
  const canEditThisOrder = (() => {
    if (!user || !order) return false;
    if (order.status === 'cancelled') return false;
    if (can(user.role, 'sales:edit')) return true;
    return can(user.role, 'sales:edit-own') && order.processedBy === user.id;
  })();

  const reload = useCallback(async () => {
    try {
      const fresh = await api.get<SalesOrder>(`/sales-orders/${orderId}`);
      setOrder(fresh);
    } catch {
      showToast('Failed to reload order', 'error');
    }
  }, [orderId, showToast]);

  useEffect(() => {
    api
      .get<SalesOrder>(`/sales-orders/${orderId}`)
      .then(setOrder)
      .catch(() => showToast('Failed to load order', 'error'))
      .finally(() => setLoading(false));
  }, [orderId, showToast]);

  const handleStatusChange = async (status: string) => {
    if (status === 'cancelled' && order && order.amountPaid > 0) {
      const confirmed = window.confirm(
        `This order has ${formatCurrency(order.amountPaid)} in payments recorded. Cancelling will not automatically refund the customer. Continue?`,
      );
      if (!confirmed) return;
    }
    setActionLoading(true);
    try {
      const updatedOrder = await api.patch<SalesOrder>(`/sales-orders/${orderId}/status`, { status });
      setOrder(updatedOrder);
      showToast(`Order ${status}`);
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditQty = (itemId: string, currentQty: number) => {
    setPending({ kind: 'qty', itemId, currentQty });
    setEditQty(String(currentQty));
    setEditReason('');
  };

  const startRemove = (itemId: string, itemName: string) => {
    setPending({ kind: 'remove', itemId, itemName });
    setEditQty('');
    setEditReason('');
  };

  const cancelPending = () => {
    setPending(null);
    setEditQty('');
    setEditReason('');
  };

  const saveEditQty = async () => {
    if (!pending || pending.kind !== 'qty') return;
    const qty = parseInt(editQty, 10);
    if (!qty || qty < 1) {
      showToast('Quantity must be at least 1', 'error');
      return;
    }
    if (!editReason.trim()) {
      showToast('Please pick or type a reason', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await api.patch(`/sales-orders/${orderId}/items/${pending.itemId}`, {
        quantity: qty,
        reason: editReason.trim(),
      });
      showToast('Quantity updated');
      cancelPending();
      await reload();
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRemove = async () => {
    if (!pending || pending.kind !== 'remove') return;
    if (!editReason.trim()) {
      showToast('Please pick or type a reason', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await api.delete(
        `/sales-orders/${orderId}/items/${pending.itemId}?reason=${encodeURIComponent(editReason.trim())}`,
      );
      showToast('Item removed');
      cancelPending();
      await reload();
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Remove failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (paymentAmount <= 0) return;
    setActionLoading(true);
    try {
      const result = await api.post<{ payment: any, order: SalesOrder }>(`/sales-orders/${orderId}/payments`, {
        amount: paymentAmount,
        method: paymentMethod,
      });
      setOrder(result.order);
      showToast('Payment recorded');
      onUpdate();
      setShowPayment(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={order ? `Order ${order.orderNumber}` : 'Order Detail'} size="lg">
      {loading || !order ? (
        <p className={styles.loadingMsg}>Loading…</p>
      ) : (
        <div className={styles.content}>
          {/* Header pills */}
          <div className={styles.metaRow}>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>Customer</span>
              <span className={styles.metaValue}>{order.customer?.name || 'Walk-in'}</span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>Date</span>
              <span className={styles.metaValue}>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>Status</span>
              <span className={styles.metaValue}><OrderStatusBadge status={order.status} /></span>
            </div>
            {order.lastModifiedAt && (
              <div className={`${styles.metaCell} ${styles.metaCellEdited}`}>
                <span className={styles.metaLabel}>Edited</span>
                <span
                  className={styles.metaValue}
                  title={new Date(order.lastModifiedAt).toLocaleString()}
                >
                  {relativeTime(order.lastModifiedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Items section */}
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <h4 className={styles.sectionTitle}>Items</h4>
              <span className={styles.sectionCount}>
                {order.items?.length ?? 0} {(order.items?.length ?? 0) === 1 ? 'line' : 'lines'}
              </span>
            </header>

            <div className={styles.itemsList} role="list">
              {order.items?.map((item) => {
                const isPending = pending?.itemId === item.id;
                const isRemoving = isPending && pending?.kind === 'remove';
                const isEditing = isPending && pending?.kind === 'qty';
                return (
                  <article
                    key={item.id}
                    className={`${styles.itemRow} ${isPending ? styles.itemRowActive : ''} ${isRemoving ? styles.itemRowDanger : ''}`}
                    role="listitem"
                  >
                    <div className={styles.itemMain}>
                      <div className={styles.itemNameBlock}>
                        <span className={styles.itemName}>{item.product?.name ?? '—'}</span>
                        {item.variantId && <span className={styles.variantTag}>variant</span>}
                      </div>
                      <div className={styles.itemMeta}>
                        <span><strong>{item.quantity}</strong> × {formatCurrency(item.unitPrice)}</span>
                        {item.tax > 0 && <span className={styles.itemTax}>+ {formatCurrency(item.tax)} tax</span>}
                      </div>
                    </div>

                    <div className={styles.itemTotal}>{formatCurrency(item.total)}</div>

                    {canEditThisOrder && !isPending && (
                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          className={styles.pillBtn}
                          onClick={() => startEditQty(item.id, item.quantity)}
                          disabled={actionLoading}
                          aria-label={`Edit quantity for ${item.product?.name ?? 'item'}`}
                        >
                          Edit qty
                        </button>
                        <button
                          type="button"
                          className={styles.pillBtnDanger}
                          onClick={() => startRemove(item.id, item.product?.name ?? 'item')}
                          disabled={actionLoading}
                          aria-label={`Remove ${item.product?.name ?? 'item'}`}
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {isEditing && (
                      <div className={styles.editPanel}>
                        <div className={styles.editPanelTitle}>
                          Edit quantity — <span className={styles.editPanelHint}>was {pending.kind === 'qty' && pending.currentQty}</span>
                        </div>
                        <div className={styles.editGrid}>
                          <div className={styles.editField}>
                            <label className={styles.editFieldLabel}>New quantity</label>
                            <input
                              type="number"
                              min={1}
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className={styles.qtyInput}
                              autoFocus
                            />
                          </div>
                          <div className={styles.editField}>
                            <label className={styles.editFieldLabel}>Reason</label>
                            <ReasonPicker
                              value={editReason}
                              onChange={setEditReason}
                              variant="compact"
                            />
                          </div>
                        </div>
                        <div className={styles.editActions}>
                          <button
                            type="button"
                            className={styles.pillBtnGhost}
                            onClick={cancelPending}
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={styles.pillBtnPrimary}
                            onClick={saveEditQty}
                            disabled={actionLoading}
                          >
                            {actionLoading ? 'Saving…' : 'Save change'}
                          </button>
                        </div>
                      </div>
                    )}

                    {isRemoving && (
                      <div className={`${styles.editPanel} ${styles.editPanelDanger}`}>
                        <div className={styles.editPanelTitle}>
                          Remove <strong>{pending.kind === 'remove' && pending.itemName}</strong>?
                        </div>
                        <p className={styles.editPanelBody}>
                          Stock will be returned to inventory and the order total will be recalculated.
                        </p>
                        <div className={styles.editField}>
                          <label className={styles.editFieldLabel}>Reason</label>
                          <ReasonPicker
                            value={editReason}
                            onChange={setEditReason}
                            variant="comfy"
                            autoFocus
                          />
                        </div>
                        <div className={styles.editActions}>
                          <button
                            type="button"
                            className={styles.pillBtnGhost}
                            onClick={cancelPending}
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={styles.pillBtnConfirmDanger}
                            onClick={confirmRemove}
                            disabled={actionLoading}
                          >
                            {actionLoading ? 'Removing…' : 'Confirm remove'}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {canEditThisOrder && !showAddItem && (
              <button
                type="button"
                className={styles.addItemBtn}
                onClick={() => setShowAddItem(true)}
                disabled={actionLoading}
              >
                <span className={styles.addItemPlus} aria-hidden="true">＋</span> Add item
              </button>
            )}
            {showAddItem && (
              <AddItemPicker
                orderId={orderId}
                onAdded={async () => {
                  setShowAddItem(false);
                  await reload();
                  onUpdate();
                }}
                onCancel={() => setShowAddItem(false)}
              />
            )}
          </section>

          {/* Totals card */}
          <section className={styles.totalsCard}>
            <div className={styles.totalsCol}>
              <div className={styles.totalsRow}>
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className={styles.totalsRow}>
                <span>Tax</span>
                <span>{formatCurrency(order.taxTotal)}</span>
              </div>
              <div className={`${styles.totalsRow} ${styles.totalsRowBig}`}>
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
            <div className={styles.totalsDivider} aria-hidden="true" />
            <div className={styles.totalsCol}>
              <div className={styles.totalsRow}>
                <span>Paid</span>
                <span>{formatCurrency(order.amountPaid)}</span>
              </div>
              <div className={`${styles.totalsRow} ${styles.totalsRowBig} ${order.balanceDue > 0 ? styles.balanceDue : styles.balanceClear}`}>
                <span>Balance</span>
                <span>{formatCurrency(order.balanceDue)}</span>
              </div>
            </div>
          </section>

          {order.payments && order.payments.length > 0 && (
            <section className={styles.section}>
              <header className={styles.sectionHead}>
                <h4 className={styles.sectionTitle}>Payment History</h4>
                <span className={styles.sectionCount}>
                  {order.payments.length} {order.payments.length === 1 ? 'payment' : 'payments'}
                </span>
              </header>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.date).toLocaleString()}</td>
                      <td>{p.method.toUpperCase()}</td>
                      <td className={styles.tableNum}>{formatCurrency(p.amount)}</td>
                      <td>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {showPayment && (
            <div className={styles.paymentForm}>
              <h4 className={styles.sectionTitle}>Add Payment (Cash)</h4>
              <Input
                label="Amount"
                type="number"
                value={paymentAmount / 100}
                onChange={(e) => setPaymentAmount(Math.round(Number(e.target.value) * 100))}
              />
              <Button onClick={handleAddPayment} loading={actionLoading} size="sm">
                Submit Payment
              </Button>
            </div>
          )}

          <div className={styles.actions}>
            {order.status === 'draft' && (
              <Button onClick={() => handleStatusChange('confirmed')} loading={actionLoading}>
                Confirm
              </Button>
            )}
            {order.status === 'confirmed' && (
              <Button onClick={() => handleStatusChange('picked')} loading={actionLoading}>
                Mark Picked
              </Button>
            )}
            {order.status === 'picked' && (
              <Button onClick={() => handleStatusChange('invoiced')} loading={actionLoading}>
                Generate Invoice
              </Button>
            )}
            {order.status === 'invoiced' && !showPayment && (
              <Button onClick={() => {
                setPaymentAmount(order.balanceDue);
                setShowPayment(true);
              }}>
                Add Payment
              </Button>
            )}
            {canPrint && (
              <Button variant="secondary" onClick={() => setShowReceipt(true)}>
                🖨 {order.status === 'paid' ? 'Print Receipt' : 'Print Invoice'}
              </Button>
            )}
            {!['paid', 'cancelled'].includes(order.status) && (
              <Button
                variant="danger"
                onClick={() => handleStatusChange('cancelled')}
                loading={actionLoading}
              >
                Cancel Order
              </Button>
            )}
          </div>
          {showReceipt && (
            <Receipt
              order={order}
              onClose={() => setShowReceipt(false)}
              type={order.status === 'paid' ? 'receipt' : 'invoice'}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
