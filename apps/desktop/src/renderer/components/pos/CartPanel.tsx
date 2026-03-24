import { Button, Input } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import type { CartItem } from '../../pages/POSPage';
import styles from './CartPanel.module.css';

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  discount: number;
  onDiscountChange: (value: number) => void;
}

export function CartPanel({
  items,
  onUpdateQuantity,
  onRemoveItem,
  discount,
  onDiscountChange,
}: CartPanelProps) {
  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((s, item) => s + item.tax * item.quantity, 0);
  const grandTotal = subtotal + taxTotal - discount;

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
                <button
                  className={styles.qtyBtn}
                  onClick={() => onUpdateQuantity(index, -1)}
                >
                  -
                </button>
                <span className={styles.qty}>{item.quantity}</span>
                <button
                  className={styles.qtyBtn}
                  onClick={() => onUpdateQuantity(index, 1)}
                >
                  +
                </button>
              </div>
              <span className={styles.lineTotal}>
                {formatCurrency(item.quantity * item.unitPrice)}
              </span>
              <button
                className={styles.removeBtn}
                onClick={() => onRemoveItem(index)}
              >
                x
              </button>
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
          <Input
            label="Discount"
            type="number"
            value={discount / 100}
            onChange={(e) => onDiscountChange(Math.round(Number(e.target.value) * 100))}
          />
        </div>
        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
          <span>Total</span>
          <span>{formatCurrency(Math.max(0, grandTotal))}</span>
        </div>
      </div>
    </div>
  );
}
