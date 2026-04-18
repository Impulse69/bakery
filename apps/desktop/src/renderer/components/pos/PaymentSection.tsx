import { Select, Input, Button } from '@bakery/ui';
import type { SelectOption } from '@bakery/ui';
import type { Customer, PaymentMethod } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import { CustomerCombobox } from '../customer/CustomerCombobox';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import styles from './PaymentSection.module.css';

const PAYMENT_METHODS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo', label: 'Mobile Money' },
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
}: PaymentSectionProps) {
  const { showToast } = useToast();
  const change = paymentMethod === 'cash' ? amountTendered - grandTotal : 0;

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

  return (
    <div className={styles.section}>
      <CustomerCombobox
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelect={(c) => onCustomerChange(c?.id ?? '')}
        onAddNew={handleAddNewCustomer}
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
