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

  if (type === 'invoice') {
    return (
      <div className={styles.invoiceA4}>
        <div className={styles.invoiceHeader}>
          <div className={styles.brandSection}>
            <h1 className={styles.brandName}>Bread Faculty</h1>
            <p className={styles.brandSub}>Premium Bakery & Confectionery</p>
            <div className={styles.brandDetails}>
              <p>12 Baker Street, Accra, Ghana</p>
              <p>+233 20 000 0000 | billing@breadfaculty.com</p>
            </div>
          </div>
          <div className={styles.invoiceMeta}>
            <h2 className={styles.docTitle}>INVOICE</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaLabel}>Invoice #</div><div className={styles.metaValue}>{order.orderNumber}</div>
              <div className={styles.metaLabel}>Date</div><div className={styles.metaValue}>{new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div className={styles.metaLabel}>Status</div><div className={styles.metaValue}><span className={styles.statusText}>{order.status.toUpperCase()}</span></div>
            </div>
          </div>
        </div>

        <div className={styles.billingSection}>
          <div className={styles.billTo}>
            <h3 className={styles.sectionHeading}>BILL TO</h3>
            <p className={styles.customerName}>{order.customer?.name ?? 'Walk-in Customer'}</p>
            <p>{order.customer?.phone ?? 'N/A'}</p>
            <p>{order.customer?.email ?? ''}</p>
            <p>{order.customer?.address ?? ''}</p>
          </div>
        </div>

        <table className={styles.invoiceTable}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>DESCRIPTION</th>
              <th style={{ textAlign: 'center' }}>QTY</th>
              <th style={{ textAlign: 'right' }}>UNIT PRICE</th>
              <th style={{ textAlign: 'right' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className={styles.itemName}>{item.product?.name}</div>
                  {item.variantId && <div className={styles.itemSub}>Standard Variant</div>}
                </td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.invoiceFooterSection}>
          <div className={styles.notesSection}>
            <h3 className={styles.sectionHeading}>NOTES & INSTRUCTIONS</h3>
            <p>Please quote the invoice number in all correspondence.</p>
            <p>Goods sold are not returnable.</p>
            <div className={styles.paymentInfo}>
              <strong>Payment Method:</strong> {paymentMethod.toUpperCase()}
            </div>
          </div>
          <div className={styles.invoiceTotals}>
            <div className={styles.invTotalRow}>
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.taxTotal > 0 && (
              <div className={styles.invTotalRow}>
                <span>VAT (Inclusive)</span>
                <span>{formatCurrency(order.taxTotal)}</span>
              </div>
            )}
            <div className={styles.invGrandTotal}>
              <span>TOTAL DUE</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            <div className={styles.amountPaidRow}>
              <span>Amount Paid</span>
              <span>{formatCurrency(order.amountPaid)}</span>
            </div>
            {order.balanceDue > 0 && (
              <div className={styles.balanceDueRow}>
                <span>Balance Due</span>
                <span>{formatCurrency(order.balanceDue)}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footerBranding}>
          <p>Thank you for your business!</p>
          <div className={styles.footerLine} />
          <p className={styles.copyright}>© {new Date().getFullYear()} Bread Faculty Bakery Management System</p>
        </div>
      </div>
    );
  }

  // Fallback to standard thermal receipt for POS
  return (
    <div className={styles.receipt}>
      {/* Header */}
      <div className={styles.header}>
        <p className={styles.storeName}>Bread Faculty</p>
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
            <th className={styles.colDesc}>ITEM</th>
            <th className={styles.colQty}>QTY</th>
            <th className={styles.colPrice}>PRICE</th>
            <th className={styles.colTotal}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item) => (
            <tr key={item.id}>
              <td className={styles.colDesc}>{item.product?.name}</td>
              <td className={styles.colQty}>{item.quantity}</td>
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
