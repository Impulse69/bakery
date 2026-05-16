import type { Timestamps } from './common';

// PurchaseOrder + PurchaseOrderLineItem types removed — the concept was
// retired in favour of the "Purchase Order" sidebar entry now pointing at
// the production page. Supplier type retained on the off-chance the client
// adds a supplier workflow later.

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
