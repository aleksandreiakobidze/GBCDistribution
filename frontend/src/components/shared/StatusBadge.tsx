import { Badge, type BadgeProps } from '@/components/ui/Badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const statusMaps: Record<string, Record<string, BadgeVariant>> = {
  order: {
    pending: 'warning',
    confirmed: 'info',
    picking: 'primary',
    packed: 'primary',
    dispatched: 'info',
    delivered: 'success',
    cancelled: 'danger',
  },
  delivery: {
    pending: 'warning',
    assigned: 'default',
    loading: 'warning',
    in_transit: 'info',
    delivered: 'success',
    partial: 'warning',
    failed: 'danger',
  },
  invoice: {
    draft: 'default',
    sent: 'info',
    paid: 'success',
    partial: 'warning',
    overdue: 'danger',
  },
  return: {
    pending: 'warning',
    approved: 'info',
    processed: 'success',
    rejected: 'danger',
  },
};

export interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'delivery' | 'invoice' | 'return';
}

export function StatusBadge({ status, type = 'order' }: StatusBadgeProps) {
  const map = statusMaps[type] ?? statusMaps.order;
  const variant = map[status] ?? 'default';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return <Badge variant={variant}>{label}</Badge>;
}
