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

export type ExpensePeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type ExpenseCategorySummary = {
  category: ExpenseCategory;
  total: number;
  count: number;
  percentOfTotal: number;
};

export type ExpenseSummaryResponse = {
  from: string | null;
  to: string | null;
  total: number;
  categories: ExpenseCategorySummary[];
};
