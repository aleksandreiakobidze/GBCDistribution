import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customersApi } from '@/lib/api/customers.api';
import { ordersApi } from '@/lib/api/orders.api';
import { Card, Badge, Button, Spinner } from '@/components/ui';
import { StatusBadge } from '@/components/shared';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ArrowLeft, Pencil, MapPin, Phone, Mail, User } from 'lucide-react';

const categoryVariants = {
  A: 'success',
  B: 'warning',
  C: 'danger',
} as const;

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getById(Number(id)),
    enabled: !!id,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: () => ordersApi.getAll({ page: 1 }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-[var(--color-text-secondary)]">
          {t('customers.customerNotFound', 'Customer not found')}
        </p>
        <Button variant="ghost" onClick={() => navigate('/customers')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('customers.backToCustomers', 'Back to Customers')}
        </Button>
      </div>
    );
  }

  const customerOrders = recentOrders?.data.slice(0, 5) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/customers')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('customers.backToCustomers', 'Back to Customers')}
        </Button>
        <Link to={`/customers/${id}/edit`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit', 'Edit')}
          </Button>
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {customer.name}
            </h1>
            <Badge
              variant={customer.is_active ? 'success' : 'default'}
              size="md"
              className="mt-2"
            >
              {customer.is_active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
            </Badge>
          </div>
          <Badge variant={categoryVariants[customer.category]} size="md">
            {t('products.category', 'Category')} {customer.category}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {t('customers.contactInfo', 'Contact Information')}
            </h2>

            <InfoItem icon={<User className="h-4 w-4" />} label={t('customers.contactPerson', 'Contact Person')} value={customer.contact_person} />
            <InfoItem icon={<Phone className="h-4 w-4" />} label={t('common.phone', 'Phone')} value={customer.phone} />
            <InfoItem icon={<Mail className="h-4 w-4" />} label={t('common.email', 'Email')} value={customer.email || '—'} />
            <InfoItem icon={<MapPin className="h-4 w-4" />} label={t('common.address', 'Address')} value={customer.address} />
            <InfoItem icon={null} label={t('customers.city', 'City')} value={customer.city} />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {t('customers.businessInfo', 'Business Information')}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <StatCard label={t('customers.creditLimit', 'Credit Limit')} value={formatCurrency(customer.credit_limit)} />
              <StatCard
                label={t('customers.outstandingBalance', 'Outstanding Balance')}
                value={formatCurrency(customer.outstanding_balance)}
                warning={customer.outstanding_balance > 0}
              />
            </div>

            {customer.assigned_sales_rep && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {t('orders.salesRep', 'Assigned Sales Rep')}
                </span>
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {customer.assigned_sales_rep.name}
                </span>
              </div>
            )}

            {(customer.latitude && customer.longitude) && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {t('customers.gpsCoords', 'GPS Coordinates')}
                </span>
                <span className="text-sm font-mono text-[var(--color-text)]">
                  {customer.latitude.toFixed(6)}, {customer.longitude.toFixed(6)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          {t('dashboard.recentOrders', 'Recent Orders')}
        </h2>
        {customerOrders.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            {t('customers.noRecentOrders', 'No recent orders')}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {customerOrders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between py-3 transition-colors duration-150 hover:bg-[var(--color-surface-hover)] -mx-6 px-6"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {order.order_number}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatDate(order.ordered_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {formatCurrency(order.total)}
                  </span>
                  <StatusBadge status={order.status} type="order" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="mt-0.5 text-[var(--color-text-secondary)]">{icon}</span>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="text-sm text-[var(--color-text)]">{value}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold ${
          warning ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
