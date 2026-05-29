import { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SalesOrder } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import styles from './Receipt.module.css';

interface ReceiptProps {
  order: SalesOrder;
  onClose?: () => void;
  type?: 'receipt' | 'invoice';
}

// CSS px → microns (1in = 96px = 25400µm)
const PX_TO_MICRONS = 25400 / 96;

export function Receipt({ order, onClose, type = 'receipt' }: ReceiptProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const dateStr = order.completedAt
    ? new Date(order.completedAt).toLocaleString()
    : new Date(order.createdAt).toLocaleString();

  const handlePrint = async () => {
    const api = window.electronAPI;

    // Measure the visible (on-screen) receipt so the thermal PDF is generated
    // at the exact content height — no blank tail, no clipping. The receipt is
    // styled at 80mm width, matching the 80mm roll (72mm printable).
    let heightMicrons: number | undefined;
    const el = overlayRef.current?.querySelector<HTMLElement>('[data-receipt-root]');
    if (el) {
      heightMicrons = Math.round(el.offsetHeight * PX_TO_MICRONS) + 5000; // +5mm tail buffer
    }
    const opts = { kind: 'receipt' as const, heightMicrons };

    if (api?.printPreview) {
      try {
        await api.printPreview(opts);
        return;
      } catch (err) {
        console.warn('In-app PDF preview failed, falling back to system viewer', err);
        try {
          await api.printSystemPreview?.(opts);
          return;
        } catch (err2) {
          console.warn('System PDF preview failed, falling back to window.print', err2);
        }
      }
    }
    window.print();
  };

  return (
    <>
      {/* Screen overlay (hidden during print) */}
      <div className={styles.overlay}>
        <div className={styles.previewCard} ref={overlayRef}>
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
        <div className={`${styles.printOnly} print-target`}>
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
    <div className={styles.receipt} data-receipt-root>
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

