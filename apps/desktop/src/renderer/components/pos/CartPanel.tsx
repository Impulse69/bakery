import { formatCurrency } from '@bakery/utils';
import type { CartItem } from '../../pages/POSPage';
import styles from './CartPanel.module.css';

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onSetQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  discountPct: number;
  onDiscountPctChange: (pct: number) => void;
}

export function CartPanel({
  items,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
  discountPct,
  onDiscountPctChange,
}: CartPanelProps) {
  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((s, item) => s + item.tax * item.quantity, 0);
  const discountAmount = Math.round(subtotal * discountPct / 100);
  const grandTotal = Math.max(0, subtotal + taxTotal - discountAmount);

  const incrementDiscount = () => onDiscountPctChange(Math.min(100, discountPct + 1));
  const decrementDiscount = () => onDiscountPctChange(Math.max(0, discountPct - 1));

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>Cart ({items.length})</h3>

      <div className={styles.items}>
        {items.length === 0 && (
          <p className={styles.empty}>No items in cart</p>
        )}
        {items.map((item, index) => (
          <div key={index} className={styles.item}>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>
                {item.product.name}
                {item.variant && ` (${item.variant.name})`}
              </span>
              <span className={styles.itemPrice}>
                {formatCurrency(item.unitPrice)}
              </span>
            </div>
            <div className={styles.itemActions}>
              <div className={styles.qtyControls}>
                <button className={styles.qtyBtn} onClick={() => onUpdateQuantity(index, -1)}>−</button>
                <input
                  type="number"
                  className={styles.qtyInput}
                  value={item.quantity === 0 ? '' : item.quantity}
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      onSetQuantity(index, val);
                    } else if (e.target.value === '') {
                      onSetQuantity(index, 0);
                    }
                  }}
                  min="0"
                />
                <button className={styles.qtyBtn} onClick={() => onUpdateQuantity(index, 1)}>+</button>
              </div>
              <span className={styles.lineTotal}>
                {formatCurrency(item.quantity * item.unitPrice)}
              </span>
              <button className={styles.removeBtn} onClick={() => onRemoveItem(index)}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {taxTotal > 0 && (
          <div className={styles.totalRow}>
            <span>Tax</span>
            <span>{formatCurrency(taxTotal)}</span>
          </div>
        )}
        <div className={styles.totalRow}>
          <span>Discount</span>
          <div className={styles.discountControl}>
            <button
              className={styles.discountBtn}
              onClick={decrementDiscount}
              disabled={discountPct <= 0}
            >
              −
            </button>
            <div className={styles.discountInputWrapper}>
              <input
                type="number"
                className={styles.discountInput}
                value={discountPct === 0 ? '' : discountPct}
                placeholder="0"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    onDiscountPctChange(Math.max(0, Math.min(100, val)));
                  } else if (e.target.value === '') {
                    onDiscountPctChange(0);
                  }
                }}
                min="0"
                max="100"
              />
              <span className={styles.percentSymbol}>%</span>
            </div>
            <button
              className={styles.discountBtn}
              onClick={incrementDiscount}
              disabled={discountPct >= 100}
            >
              +
            </button>
            {discountAmount > 0 && (
              <span className={styles.discountAmount}>−{formatCurrency(discountAmount)}</span>
            )}
          </div>
        </div>
        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
          <span>Total</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
