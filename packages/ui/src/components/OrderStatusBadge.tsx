import type { SalesOrderStatus } from '@bakery/types';
import { Badge } from './Badge';
import type { BadgeVariant } from './Badge';

export interface OrderStatusBadgeProps {
  status: SalesOrderStatus;
  className?: string;
}

const STATUS_MAP: Record<SalesOrderStatus, { variant: BadgeVariant; label: string }> = {
  draft: { variant: 'neutral', label: 'Open' },
  confirmed: { variant: 'info', label: 'Confirmed' },
  picked: { variant: 'info', label: 'Picked' },
  invoiced: { variant: 'warning', label: 'Invoiced' },
  paid: { variant: 'success', label: 'Paid' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const { variant, label } = STATUS_MAP[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
