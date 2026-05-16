import type { Timestamps, PaymentMethod } from './common';
import type { Customer } from './customer';
import type { Product } from './product';

export type SalesOrderStatus = 'draft' | 'confirmed' | 'picked' | 'invoiced' | 'paid' | 'cancelled';

export type SalesOrder = Timestamps & {
  id: string;
  orderSequence: number;
  orderNumber: string;
  customerId?: string;
  locationId: string;
  processedBy: string;
  status: SalesOrderStatus;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  completedAt?: string;
  /** Set whenever a line item is added/edited/removed after creation. */
  lastModifiedAt?: string | null;
  /** User id of whoever performed the latest line-item modification. */
  lastModifiedBy?: string | null;
  items?: SalesOrderItem[];
  payments?: Payment[];
  customer?: Customer;
};

export type SalesOrderItem = {
  id: string;
  salesOrderId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  /** Selling price snapshot per unit at the time of sale. */
  unitPrice: number;
  /** Cost price snapshot per unit at the time of sale. */
  unitCostPrice?: number;
  tax: number;
  total: number;
  product?: Product;
};

export type Payment = {
  id: string;
  salesOrderId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
};
