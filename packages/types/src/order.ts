import type { Timestamps, PaymentMethod } from './common';

export type OrderStatus = 'open' | 'completed' | 'voided' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type Order = Timestamps & {
  id: string;
  orderNumber: string;
  customerName?: string;
  items: OrderLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  processedBy: string;
  completedAt?: string;
};

export type OrderLineItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
