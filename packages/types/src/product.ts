import type { Timestamps } from './common';

export type Product = Timestamps & {
  id: string;
  name: string;
  sku: string;
  category: string;
  /** Selling price in minor units (cents) — what cashier charges at POS. */
  sellingPrice: number;
  /** Cost price in minor units (cents) — what it costs to produce one unit. */
  costPrice: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  isActive: boolean;
  stockQuantity: number;
  variants?: ProductVariant[];
};

export type ProductVariant = Timestamps & {
  id: string;
  productId: string;
  name: string;
  sku: string;
  /** Variant override of the selling price. */
  price: number;
  isActive: boolean;
};
