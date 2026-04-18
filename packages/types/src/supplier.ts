import type { Timestamps } from './common';

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'received' | 'cancelled';

export type Supplier = Timestamps & {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  isActive: boolean;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  orderedDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  createdBy: string;
  notes?: string;
  createdAt: string;
  supplier?: Supplier;
  items?: PurchaseOrderLineItem[];
};

export type PurchaseOrderLineItem = {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  unitCost: number;
  lineTotal: number;
  product?: { id: string; name: string };
};
