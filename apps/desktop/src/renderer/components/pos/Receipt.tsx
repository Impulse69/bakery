import type { SalesOrder } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import styles from './Receipt.module.css';

interface ReceiptProps {
  order: SalesOrder;
  onClose?: () => void;
}

export function Receipt({ order, onClose }: ReceiptProps) {
  const dateStr = order.completedAt
    ? new Date(order.completedAt).toLocaleString()
    : new Date(order.createdAt).toLocaleString();

  const handlePrint = () => window.print();

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
          <ReceiptContent order={order} dateStr={dateStr} />
        </div>
      </div>

      {/* Print target — visible only during print */}
      <div className={styles.printOnly}>
        <ReceiptContent order={order} dateStr={dateStr} />
      </div>
    </>
  );
}

function ReceiptContent({ order, dateStr }: { order: SalesOrder; dateStr: string }) {
  const paymentMethod = order.payments?.[0]?.method ?? 'N/A';
  const change = order.amountPaid > order.total ? order.amountPaid - order.total : 0;

  return (
    <div className={styles.receipt}>
      {/* Header */}
      <div className={styles.header}>
        <p className={styles.storeName}>Bread Faculty</p>
        <p className={styles.storeTagline}>The Artisanal Curator</p>
        <p className={styles.storeMeta}>12 Baker Street, Accra</p>
        <p className={styles.storeMeta}>+233 20 000 0000</p>
      </div>

      <div className={styles.divider} />

      {/* Order meta */}
      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span>Receipt #</span><span>{order.orderNumber}</span>
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

      {/* Items */}
      <table className={styles.items}>
        <thead>
          <tr>
            <th className={styles.colQty}>QTY</th>
            <th className={styles.colDesc}>ITEM</th>
            <th className={styles.colPrice}>PRICE</th>
            <th className={styles.colTotal}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item) => (
            <tr key={item.id}>
              <td className={styles.colQty}>{item.quantity}</td>
              <td className={styles.colDesc}>
                {item.product?.name}
                {item.variantId && ' (variant)'}
              </td>
              <td className={styles.colPrice}>{formatCurrency(item.unitPrice)}</td>
              <td className={styles.colTotal}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.divider} />

      {/* Totals */}
      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.taxTotal > 0 && (
          <div className={styles.totalRow}>
            <span>Tax</span><span>{formatCurrency(order.taxTotal)}</span>
          </div>
        )}
        {order.discountTotal > 0 && (
          <div className={styles.totalRow}>
            <span>Discount</span><span>−{formatCurrency(order.discountTotal)}</span>
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

      {/* Footer */}
      <div className={styles.footer}>
        <p>Thank you for your purchase!</p>
        <p>Please come again.</p>
        <p className={styles.footerSmall}>Powered by Bread Faculty POS</p>
      </div>
    </div>
  );
}
