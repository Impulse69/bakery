import type { InventoryItem } from './inventory';

export type InventoryCountStatus = 'in_progress' | 'completed' | 'cancelled';

export type InventoryCount = {
  id: string;
  locationId: string;
  status: InventoryCountStatus;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  items?: InventoryCountItem[];
};

export type InventoryCountItem = {
  id: string;
  inventoryCountId: string;
  inventoryItemId: string;
  expectedQuantity: number;
  actualQuantity?: number;
  discrepancy?: number;
  inventoryItem?: InventoryItem;
};
