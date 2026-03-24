import type { Timestamps } from './common';
import type { InventoryItem } from './inventory';

export type Recipe = Timestamps & {
  id: string;
  name: string;
  description?: string;
  yieldQuantity: number;
  yieldUnit: string;
  instructions?: string;
  isActive: boolean;
  ingredients?: RecipeIngredient[];
};

export type RecipeIngredient = {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: string;
  notes?: string;
  inventoryItem?: InventoryItem;
};
