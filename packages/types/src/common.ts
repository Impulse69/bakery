export type UserRole = 'admin' | 'cashier' | 'baker' | 'owner';

export type PaymentMethod = 'cash' | 'card' | 'check' | 'bank_transfer';

export type Timestamps = {
  createdAt: string;
  updatedAt: string;
};
