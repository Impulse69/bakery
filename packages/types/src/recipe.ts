import type { Timestamps } from './common';

export type Recipe = Timestamps & {
  id: string;
  name: string;
  description?: string;
  yieldQuantity: number;
  yieldUnit: string;
  instructions?: string;
  isActive: boolean;
};

export type RecipeIngredient = {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: string;
  notes?: string;
};
