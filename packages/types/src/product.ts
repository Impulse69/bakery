import type { Timestamps } from './common';

export type Product = Timestamps & {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  stockQuantity: number;
  variants?: ProductVariant[];
};

export type ProductVariant = Timestamps & {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  isActive: boolean;
};
