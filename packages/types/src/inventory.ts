import type { Timestamps } from './common';

export type StockMovementType = 'purchase' | 'production_deduction' | 'adjustment' | 'sale';

export type InventoryItem = Timestamps & {
  id: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  reorderQuantity: number;
};

export type StockMovement = {
  id: string;
  inventoryItemId: string;
  quantityChange: number;
  movementType: StockMovementType;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
};
