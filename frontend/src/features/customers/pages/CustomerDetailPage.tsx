import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { Card, Badge, Button, Spinner } from '@/components/ui';
import { ArrowLeft, MapPin, Phone } from 'lucide-react';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['erp-customer', id],
    queryFn: () => erpApi.customer(id!),
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

  const schedule = customer.schedule;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" onClick={() => navigate('/customers')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('customers.backToCustomers', 'Back to Customers')}
      </Button>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{customer.name}</h1>
            {customer.orgCode && (
              <p className="text-sm text-[var(--color-text-secondary)]">{customer.orgCode}</p>
            )}
          </div>
          <Badge variant={customer.active ? 'success' : 'default'}>
            {customer.active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> {customer.phone ?? '—'}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {[customer.address, customer.city].filter(Boolean).join(', ') || '—'}
          </p>
        </div>
        {schedule && (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">{t('customers.visitSchedule', 'Visit schedule')}</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
                .filter((d) => schedule[d as keyof typeof schedule])
                .join(', ') || '—'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
