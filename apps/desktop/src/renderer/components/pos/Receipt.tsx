import { createPortal } from 'react-dom';
import type { SalesOrder } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import styles from './Receipt.module.css';

interface ReceiptProps {
  order: SalesOrder;
  onClose?: () => void;
  type?: 'receipt' | 'invoice';
}

export function Receipt({ order, onClose, type = 'receipt' }: ReceiptProps) {
  const dateStr = order.completedAt
    ? new Date(order.completedAt).toLocaleString()
    : new Date(order.createdAt).toLocaleString();

  // Use the browser's native (Chromium) print dialog. The @page rule in
  // Receipt.module.css sizes the page to the 80mm thermal roll, so the
  // POS80 printer receives a correctly-scaled receipt.
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Screen overlay (hidden during print) */}
      <div className={styles.overlay}>
        <div className={styles.previewCard}>
          <div className={styles.previewActions}>
            <button className={styles.printBtn} onClick={handlePrint}>🖨 Print</button>
            {onClose && (
              <button className={styles.closeBtn} onClick={onClose}>✕ Close</button>
            )}
          </div>
          <ReceiptContent order={order} dateStr={dateStr} type={type} />
        </div>
      </div>

      {/* Print target — rendered outside the app root via Portal */}
      {createPortal(
        <div className={`${styles.printOnly} ${styles.receiptPage} print-target`}>
          <ReceiptContent order={order} dateStr={dateStr} type={type} />
        </div>,
        document.body
      )}
    </>
  );
}

function ReceiptContent({ order, dateStr, type }: { order: SalesOrder; dateStr: string; type: 'receipt' | 'invoice' }) {
  const paymentMethod = order.payments?.[0]?.method ?? 'N/A';
  const change = order.amountPaid > order.total ? order.amountPaid - order.total : 0;
  const numberLabel = type === 'receipt' ? 'Receipt #' : 'Invoice #';

  return (
    <div className={styles.receipt}>
      <div className={styles.header}>
        <p className={styles.storeName}>Bread Faculty</p>
        <p className={styles.storeMeta}>12 Baker Street, Accra</p>
        <p className={styles.storeMeta}>+233 20 000 0000</p>
      </div>

      <div className={styles.divider} />

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span>{numberLabel}</span><span>{order.orderNumber}</span>
        </div>
        <div className={styles.metaRow}>
          <span>Date</span><span>{dateStr}</span>
        </div>
        <div className={styles.metaRow}>
          <span>Customer</span><span>{order.customer?.name ?? 'Walk-in'}</span>
        </div>
        <div className={styles.metaRow}>
          <span>Cashier</span><span>Staff</span>
        </div>
      </div>

      <div className={styles.divider} />

      <table className={styles.items}>
        <thead>
          <tr>
            <th className={styles.colDesc}>ITEM</th>
            <th className={styles.colQty}>QTY</th>
            <th className={styles.colPrice}>PRICE</th>
            <th className={styles.colTotal}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item) => (
            <tr key={item.id}>
              <td className={styles.colDesc}>
                {item.product?.name ?? `Item #${item.productId?.slice(-6) ?? ''}`}
              </td>
              <td className={styles.colQty}>{item.quantity}</td>
              <td className={styles.colPrice}>{formatCurrency(item.unitPrice)}</td>
              <td className={styles.colTotal}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.divider} />

      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.taxTotal > 0 && (
          <div className={styles.totalRow}>
            <span>Tax</span><span>{formatCurrency(order.taxTotal)}</span>
          </div>
        )}
        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
          <span>TOTAL</span><span>{formatCurrency(order.total)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.totalRow}>
          <span>Payment ({paymentMethod.toUpperCase()})</span>
          <span>{formatCurrency(order.amountPaid)}</span>
        </div>
        {change > 0 && (
          <div className={styles.totalRow}>
            <span>Change</span><span>{formatCurrency(change)}</span>
          </div>
        )}
        {order.balanceDue > 0 && (
          <div className={`${styles.totalRow} ${styles.balanceDue}`}>
            <span>Balance Due</span><span>{formatCurrency(order.balanceDue)}</span>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.footer}>
        <p>Thank you for your purchase!</p>
        <p>Please come again.</p>
        <p className={styles.footerSmall}>Powered by Bread Faculty POS</p>
      </div>
    </div>
  );
}

