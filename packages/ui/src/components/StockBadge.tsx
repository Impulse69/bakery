import { Badge } from './Badge';
import type { BadgeVariant } from './Badge';

export interface StockBadgeProps {
  currentStock: number;
  reorderLevel: number;
  className?: string;
}

export function StockBadge({ currentStock, reorderLevel, className }: StockBadgeProps) {
  let variant: BadgeVariant;
  let label: string;

  if (currentStock <= 0) {
    variant = 'danger';
    label = 'Out of stock';
  } else if (currentStock <= reorderLevel) {
    variant = 'warning';
    label = 'Low stock';
  } else {
    variant = 'success';
    label = 'In stock';
  }

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
