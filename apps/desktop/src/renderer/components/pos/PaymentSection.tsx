import { Select, SearchableSelect, Input, Button } from '@bakery/ui';
import type { SelectOption } from '@bakery/ui';
import type { Customer, PaymentMethod } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import styles from './PaymentSection.module.css';

const PAYMENT_METHODS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo', label: 'Mobile Money' },
];

interface PaymentSectionProps {
  customers: Customer[];
  selectedCustomerId: string;
  onCustomerChange: (id: string) => void;
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
}

export function PaymentSection({
  customers,
  selectedCustomerId,
  onCustomerChange,
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
}: PaymentSectionProps) {
  const customerOptions: SelectOption[] = [
    { value: '', label: 'Walk-in Customer' },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const change = paymentMethod === 'cash' ? amountTendered - grandTotal : 0;

  return (
    <div className={styles.section}>
      <SearchableSelect
        label="Customer"
        options={customerOptions}
        value={selectedCustomerId}
        onChange={onCustomerChange}
      />

      <Select
        label="Payment Method"
        options={PAYMENT_METHODS}
        value={paymentMethod}
        onChange={(e) => onPaymentMethodChange(e.target.value as PaymentMethod)}
      />

      {paymentMethod === 'cash' && (
        <>
          <Input
            label="Amount Tendered"
            type="number"
            value={amountTendered === 0 ? '' : amountTendered / 100}
            placeholder="0"
            onChange={(e) =>
              onAmountTenderedChange(Math.round(Number(e.target.value) * 100))
            }
          />
          {amountTendered > 0 && (
            <div className={styles.change}>
              Change: {formatCurrency(Math.max(0, change))}
            </div>
          )}
        </>
      )}

      <div className={styles.actions}>
        <Button
          onClick={onCompleteSale}
          loading={loading}
          disabled={cartEmpty || (paymentMethod === 'cash' && amountTendered < grandTotal)}
        >
          Complete Sale
        </Button>
        <Button
          variant="secondary"
          onClick={onGenerateInvoice}
          disabled={cartEmpty || !selectedCustomerId || loading}
        >
          Bill Customer (Invoice)
        </Button>
        <div className={styles.smallActions}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSaveDraft}
            disabled={cartEmpty || loading}
          >
            Save Draft
          </Button>
          <Button
            size="sm"
            variant="ghost" 
            disabled={!hasLastOrder} 
            onClick={onPrintLast}
          >
            Re-print
          </Button>
        </div>
      </div>
    </div>
  );
}
