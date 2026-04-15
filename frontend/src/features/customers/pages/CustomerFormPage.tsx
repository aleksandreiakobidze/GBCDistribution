import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { customersApi } from '@/lib/api/customers.api';
import { customerSchema, type CustomerFormData } from '@/lib/utils/validators';
import { PageHeader } from '@/components/shared';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      category: 'B',
      credit_limit: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
  });

  function onSubmit(data: CustomerFormData) {
    createMutation.mutate(data);
  }

  const categoryOptions = [
    { value: 'A', label: `${t('customers.categoryA', 'Category A')} — ${t('customers.premium', 'Premium')}` },
    { value: 'B', label: `${t('customers.categoryB', 'Category B')} — ${t('customers.standard', 'Standard')}` },
    { value: 'C', label: `${t('customers.categoryC', 'Category C')} — ${t('customers.basic', 'Basic')}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/customers')}
        className="self-start"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('customers.backToCustomers', 'Back to Customers')}
      </Button>

      <PageHeader
        title={t('customers.newCustomer', 'New Customer')}
        subtitle={t('customers.newCustomerSubtitle', 'Add a new customer to the system')}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label={t('customers.companyName', 'Company Name') + ' *'}
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label={t('customers.contactPerson', 'Contact Person') + ' *'}
              error={errors.contact_person?.message}
              {...register('contact_person')}
            />
            <Input
              label={t('common.phone', 'Phone') + ' *'}
              type="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label={t('common.email', 'Email')}
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Textarea
                label={t('common.address', 'Address') + ' *'}
                rows={2}
                error={errors.address?.message}
                {...register('address')}
              />
            </div>
            <Input
              label={t('customers.city', 'City') + ' *'}
              error={errors.city?.message}
              {...register('city')}
            />
            <Select
              label={t('products.category', 'Category') + ' *'}
              options={categoryOptions}
              value={watch('category')}
              onChange={(val) => setValue('category', val as 'A' | 'B' | 'C')}
              error={errors.category?.message}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label={t('customers.creditLimit', 'Credit Limit') + ' (₾)'}
              type="number"
              step="0.01"
              error={errors.credit_limit?.message}
              {...register('credit_limit', { valueAsNumber: true })}
            />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-[var(--color-danger)]">
              {t('customers.createError', 'Failed to create customer. Please try again.')}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/customers')}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending}
            >
              {t('customers.createCustomer', 'Create Customer')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
