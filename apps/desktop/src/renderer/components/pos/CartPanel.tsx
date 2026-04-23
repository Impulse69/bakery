import { formatCurrency } from '@bakery/utils';
import type { CartItem } from '../../pages/POSPage';
import styles from './CartPanel.module.css';

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onSetQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
}

function WheatMark() {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" fill="none" aria-hidden="true">
      <path d="M32 8v48" stroke="#131b2e" strokeWidth="2" strokeLinecap="round" />
      <g stroke="#e07b3c" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M32 18c-5-3-10-3-13 0 3 3 8 3 13 0zM32 18c5-3 10-3 13 0-3 3-8 3-13 0z" />
        <path d="M32 28c-5-3-10-3-13 0 3 3 8 3 13 0zM32 28c5-3 10-3 13 0-3 3-8 3-13 0z" />
        <path d="M32 38c-5-3-10-3-13 0 3 3 8 3 13 0zM32 38c5-3 10-3 13 0-3 3-8 3-13 0z" />
        <path d="M32 48c-5-3-10-3-13 0 3 3 8 3 13 0zM32 48c5-3 10-3 13 0-3 3-8 3-13 0z" />
      </g>
    </svg>
  );
}

export function CartPanel({
  items,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
}: CartPanelProps) {
  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((s, item) => s + item.tax * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal + taxTotal);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const isEmpty = items.length === 0;

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.eyebrow}>Order Ticket</span>
          <h3 className={styles.heading}>Current Sale</h3>
        </div>
        <div className={styles.countBadge} data-empty={isEmpty}>
          <span className={styles.countNum}>{itemCount}</span>
          <span className={styles.countLabel}>{itemCount === 1 ? 'item' : 'items'}</span>
        </div>
      </header>

      <div className={styles.items}>
        {isEmpty && (
          <div className={styles.emptyState}>
            <div className={styles.emptyMark}><WheatMark /></div>
            <p className={styles.emptyTitle}>No items on ticket</p>
            <p className={styles.emptyHint}>Tap a bread from the catalog to start the order.</p>
          </div>
        )}
        {items.map((item, index) => {
          const isInsufficient = item.quantity > (item.product.stockQuantity || 0);
          return (
            <div
              key={index}
              className={`${styles.item} ${isInsufficient ? styles.itemWarning : ''}`}
            >
              <div className={styles.itemHead}>
                <div className={styles.itemTitleBlock}>
                  <span className={styles.itemName}>
                    {item.product.name}
                    {item.variant && <span className={styles.variantTag}>{item.variant.name}</span>}
                  </span>
                  <span className={styles.itemPrice}>{formatCurrency(item.unitPrice)} ea</span>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => onRemoveItem(index)}
                  aria-label={`Remove ${item.product.name}`}
                >
                  ×
                </button>
              </div>
              <div className={styles.itemFoot}>
                <div className={styles.qtyControls}>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => onUpdateQuantity(index, -1)}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className={styles.qtyInput}
                    value={item.quantity === 0 ? '' : item.quantity}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) onSetQuantity(index, val);
                      else if (e.target.value === '') onSetQuantity(index, 0);
                    }}
                    min="0"
                  />
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => onUpdateQuantity(index, 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <span className={styles.lineTotal}>
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
              </div>
              {isInsufficient && (
                <div className={styles.stockError}>
                  Only {item.product.stockQuantity || 0} available in stock
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.totals} data-empty={isEmpty}>
        {taxTotal > 0 && (
          <div className={styles.totalRow}>
            <span>Tax</span>
            <span className={styles.num}>{formatCurrency(taxTotal)}</span>
          </div>
        )}
        <div className={styles.grandRow}>
          <span className={styles.grandLabel}>Total</span>
          <span className={styles.grandAmount}>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
