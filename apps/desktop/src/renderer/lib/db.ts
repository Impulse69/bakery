import Dexie, { type Table } from 'dexie';
import type { User, Product, Customer, SalesOrder } from '@bakery/types';

export interface SyncOperation {
  id?: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body: unknown;
  status: 'pending' | 'failed';
  error?: string;
  createdAt: number;
}

export interface CachedAuth {
  email: string;
  passwordHash: string; // Stored securely for offline comparison
  token: string;
  user: User;
}

export class BakeryDB extends Dexie {
  users!: Table<CachedAuth, string>; // email is primary key
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  salesOrders!: Table<SalesOrder, string>;
  syncQueue!: Table<SyncOperation, number>; // auto-increment primary key

  constructor() {
    super('BakeryDB');
    this.version(1).stores({
      users: 'email',
      products: 'id, category',
      customers: 'id, name',
      salesOrders: 'id, status',
      syncQueue: '++id, status',
    });
  }
}

export const db = new BakeryDB();
