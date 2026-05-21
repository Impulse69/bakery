import type { Customer, PaymentMethod } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import { CustomerCombobox } from '../customer/CustomerCombobox';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import styles from './PaymentSection.module.css';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: 'cash', label: 'Cash', hint: '₵' },
  { value: 'momo', label: 'MoMo', hint: '📱' },
];

interface PaymentSectionProps {
  customers: Customer[];
  selectedCustomerId: string;
  onCustomerChange: (id: string) => void;
  onCustomersChange?: (customers: Customer[]) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  amountTendered: number;
  onAmountTenderedChange: (amount: number) => void;
  grandTotal: number;
  onCompleteSale: () => void;
  onGenerateInvoice: () => void;
  onPrintLast: () => void;
  onSaveDraft: () => void;
  loading: boolean;
  cartEmpty: boolean;
  hasLastOrder: boolean;
  isInvalid?: boolean;
}

export function PaymentSection({
  customers,
  selectedCustomerId,
  onCustomerChange,
  onCustomersChange,
  paymentMethod,
  onPaymentMethodChange,
  amountTendered,
  onAmountTenderedChange,
  grandTotal,
  onCompleteSale,
  onGenerateInvoice,
  onPrintLast,
  onSaveDraft,
  loading,
  cartEmpty,
  hasLastOrder,
  isInvalid,
}: PaymentSectionProps) {
  const { showToast } = useToast();
  const change = paymentMethod === 'cash' ? amountTendered - grandTotal : 0;
  const isShort = paymentMethod === 'cash' && amountTendered > 0 && amountTendered < grandTotal;
  const isEnough = paymentMethod === 'cash' && amountTendered >= grandTotal && grandTotal > 0;

  const handleAddNewCustomer = async (name: string) => {
    try {
      const created = await api.post<Customer>('/customers', { name });
      onCustomersChange?.([...customers, created]);
      onCustomerChange(created.id);
      showToast(`Customer "${created.name}" created`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create customer', 'error');
    }
  };

  const completeDisabled =
    cartEmpty || loading || (paymentMethod === 'cash' && amountTendered < grandTotal) || isInvalid;

  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Customer</label>
        <div className={styles.comboWrap}>
          <CustomerCombobox
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelect={(c) => onCustomerChange(c?.id ?? '')}
            onAddNew={handleAddNewCustomer}
            label=""
            placeholder="Search or add a customer…"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Payment Method</label>
        <div className={styles.segmented} role="radiogroup" aria-label="Payment method">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={paymentMethod === opt.value}
              className={`${styles.segBtn} ${paymentMethod === opt.value ? styles.segBtnActive : ''}`}
              onClick={() => onPaymentMethodChange(opt.value)}
            >
              <span className={styles.segHint}>{opt.hint}</span>
              <span className={styles.segLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {paymentMethod === 'cash' && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Amount Tendered</label>
          <div className={styles.tenderWrap}>
            <span className={styles.currencyPrefix}>₵</span>
            <input
              type="number"
              className={styles.tenderInput}
              value={amountTendered === 0 ? '' : amountTendered / 100}
              placeholder="0.00"
              onChange={(e) =>
                onAmountTenderedChange(Math.round(Number(e.target.value) * 100))
              }
              step="0.01"
              min="0"
            />
          </div>
          {amountTendered > 0 && (
            <div
              className={`${styles.changeReadout} ${isShort ? styles.changeShort : ''} ${isEnough ? styles.changeOk : ''}`}
            >
              <span className={styles.changeLabel}>
                {isShort ? 'Short by' : 'Change Due'}
              </span>
              <span className={styles.changeAmount}>
                {formatCurrency(isShort ? grandTotal - amountTendered : Math.max(0, change))}
              </span>
            </div>
          )}
        </div>
      )}

      {isInvalid && !cartEmpty && (
        <div className={styles.stockWarning}>
          ⚠️ Insufficient stock for some items
        </div>
      )}

      <div className={styles.dock}>
        <button
          type="button"
          className={styles.primaryCta}
          onClick={onCompleteSale}
          disabled={completeDisabled}
        >
          {loading ? (
            <span className={styles.ctaSpinner} aria-hidden="true" />
          ) : (
            <>
              <span className={styles.ctaLabel}>Complete Sale</span>
              {!cartEmpty && (
                <span className={styles.ctaAmount}>{formatCurrency(grandTotal)}</span>
              )}
            </>
          )}
        </button>

        <button
          type="button"
          className={styles.secondaryCta}
          onClick={onGenerateInvoice}
          disabled={cartEmpty || !selectedCustomerId || loading || isInvalid}
        >
          Bill Customer (Invoice)
        </button>

        <div className={styles.ghostRow}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onSaveDraft}
            disabled={cartEmpty || loading || isInvalid}
          >
            Save as Open
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onPrintLast}
            disabled={!hasLastOrder}
          >
            Re-print
          </button>
        </div>
      </div>
    </div>
  );
}
