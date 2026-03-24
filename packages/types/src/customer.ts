import type { Timestamps } from './common';
import type { SalesOrder } from './order';

export type Customer = Timestamps & {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  creditBalance: number;
  salesOrders?: SalesOrder[];
};
