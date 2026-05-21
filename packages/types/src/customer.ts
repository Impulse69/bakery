import type { Timestamps } from './common';
import type { SalesOrder } from './order';

export type Customer = Timestamps & {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  creditBalance: number;
  salesOrders?: SalesOrder[];
};

/**
 * Standard AR-aging buckets (days outstanding) for unpaid invoices.
 * An order contributes when `status = 'invoiced'` and `balanceDue > 0`.
 * Bucket = days(asOf, completedAt ?? createdAt).
 */
export interface AgingBucket {
  count: number;
  amount: number;
}

export interface AgingBuckets {
  bucket_0_30: AgingBucket;
  bucket_31_60: AgingBucket;
  bucket_61_90: AgingBucket;
  bucket_91_180: AgingBucket;
  bucket_181_365: AgingBucket;
  bucket_over_365: AgingBucket;
}

/** Payload for GET /api/customers/:id/statement?from=&to= */
export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    creditBalance: number;
    customerSince: string; // ISO datetime
  };
  range: { from: string; to: string };
  ordersInRange: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    completedAt: string | null;
    status: string;
    itemCount: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
  }>;
  totals: {
    purchased: number;
    paid: number;
    outstanding: number;
    orderCount: number;
  };
  /** Aging for this customer (all-time unpaid invoices, not constrained to range). */
  aging: AgingBuckets;
  topProductsInRange: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

/** Payload for GET /api/customers/aging?asOf= (admin/owner) */
export interface AgingSummary {
  asOf: string; // ISO datetime
  buckets: AgingBuckets;
  totalOutstanding: number;
  totalInvoices: number;
}
