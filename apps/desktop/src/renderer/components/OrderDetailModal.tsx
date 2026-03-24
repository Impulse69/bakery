import { useState, useEffect } from 'react';
import type { SalesOrder, PaymentMethod } from '@bakery/types';
import { Modal, Button, OrderStatusBadge, Input, Select } from '@bakery/ui';
import type { SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from './Toast';
import styles from './OrderDetailModal.module.css';

const PAYMENT_METHODS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
];

interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function OrderDetailModal({ orderId, onClose, onUpdate }: OrderDetailModalProps) {
  const { showToast } = useToast();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    api
      .get<SalesOrder>(`/sales-orders/${orderId}`)
      .then(setOrder)
      .catch(() => showToast('Failed to load order', 'error'))
      .finally(() => setLoading(false));
  }, [orderId, showToast]);

  const handleStatusChange = async (status: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/sales-orders/${orderId}/status`, { status });
      showToast(`Order ${status}`);
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (paymentAmount <= 0) return;
    setActionLoading(true);
    try {
      await api.post(`/sales-orders/${orderId}/payments`, {
        amount: paymentAmount,
        method: paymentMethod,
      });
      showToast('Payment recorded');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={order ? `Order ${order.orderNumber}` : 'Order Detail'} size="lg">
      {loading || !order ? (
        <p>Loading...</p>
      ) : (
        <div className={styles.content}>
          <div className={styles.infoRow}>
            <div>
              <strong>Customer:</strong> {order.customer?.name || 'Walk-in'}
            </div>
            <div>
              <strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}
            </div>
            <div>
              <strong>Status:</strong> <OrderStatusBadge status={order.status} />
            </div>
          </div>

          <h4 className={styles.sectionTitle}>Items</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name}{item.variantId ? ` (variant)` : ''}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatCurrency(item.discount)}</td>
                  <td>{formatCurrency(item.tax)}</td>
                  <td>{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.totalsGrid}>
            <div>Subtotal: {formatCurrency(order.subtotal)}</div>
            <div>Tax: {formatCurrency(order.taxTotal)}</div>
            <div>Discount: {formatCurrency(order.discountTotal)}</div>
            <div className={styles.bold}>Total: {formatCurrency(order.total)}</div>
            <div>Paid: {formatCurrency(order.amountPaid)}</div>
            <div className={styles.bold}>Balance: {formatCurrency(order.balanceDue)}</div>
          </div>

          {order.payments && order.payments.length > 0 && (
            <>
              <h4 className={styles.sectionTitle}>Payment History</h4>
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
                      <td>{p.method}</td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>{p.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {showPayment && (
            <div className={styles.paymentForm}>
              <h4 className={styles.sectionTitle}>Add Payment</h4>
              <Input
                label="Amount"
                type="number"
                value={paymentAmount / 100}
                onChange={(e) => setPaymentAmount(Math.round(Number(e.target.value) * 100))}
              />
              <Select
                label="Method"
                options={PAYMENT_METHODS}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
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
        </div>
      )}
    </Modal>
  );
}
