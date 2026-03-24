import type { Timestamps } from './common';

export type StockAdjustmentType = 'purchase' | 'production' | 'waste' | 'correction';

export type InventoryItem = Timestamps & {
  id: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  reorderQuantity: number;
};

export type StockAdjustment = {
  id: string;
  inventoryItemId: string;
  quantityChange: number;
  adjustmentType: StockAdjustmentType;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
};
