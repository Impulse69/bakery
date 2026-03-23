import type { PaymentMethod } from './common';

export type ExpenseCategory = 'utilities' | 'wages' | 'packaging' | 'ingredients' | 'maintenance' | 'other';

export type Expense = {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: string;
  recordedBy: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
};
