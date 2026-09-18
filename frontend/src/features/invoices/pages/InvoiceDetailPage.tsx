import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  FileText,
  DollarSign,
  Loader2,
  CheckCircle2,
  User,
  Pencil,
} from 'lucide-react';
import { Button, Card, Modal, Input, Select, Badge } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/shared';
import { invoicesApi } from '@/lib/api/invoices.api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { paymentSchema, type PaymentFormData } from '@/lib/utils/validators';
import type { Payment } from '@/types';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getById(Number(id)),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: 'cash', reference: '' },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) =>
      invoicesApi.recordPayment(Number(id), {
        amount: data.amount,
        method: data.method,
        reference: data.reference || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setPaymentModalOpen(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      invoicesApi.update(Number(id), {
        amount: Number(editAmount),
        due_date: editDueDate,
        status: editStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setEditing(false);
    },
  });

  function onSubmitPayment(data: PaymentFormData) {
    paymentMutation.mutate(data);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">Invoice not found</div>
    );
  }

  const balance = invoice.amount - invoice.paid_amount;
  const paidPercent = invoice.amount > 0 ? (invoice.paid_amount / invoice.amount) * 100 : 0;
  const payments = invoice.payments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.invoice_number}
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (editing) {
                  setEditing(false);
                  return;
                }
                setEditAmount(String(invoice.amount));
                setEditDueDate(invoice.due_date?.slice(0, 10) ?? '');
                setEditStatus(invoice.status);
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editing ? t('common.cancel', 'Cancel') : t('common.edit', 'Edit')}
            </Button>
            {balance > 0 && !editing && (
              <Button
                size="sm"
                onClick={() => {
                  setValue('amount', Math.round(balance * 100) / 100);
                  setPaymentModalOpen(true);
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t('invoices.recordPayment')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.back')}
            </Button>
          </div>
        }
      />

      {/* Invoice Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Invoice Details
          </h3>
          {editing ? (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateMutation.mutate();
              }}
            >
              <Input
                label={t('invoices.amount', 'Amount')}
                type="number"
                step="0.01"
                min="0"
                required
                value={editAmount}
                onChange={(event) => setEditAmount(event.target.value)}
              />
              <Input
                label={t('invoices.dueDate', 'Due Date')}
                type="date"
                required
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
              />
              <Select
                label={t('common.status', 'Status')}
                options={STATUS_OPTIONS}
                value={editStatus}
                onChange={(val) => setEditStatus(val)}
              />
              <div className="flex items-end">
                <Button type="submit" loading={updateMutation.isPending}>
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </form>
          ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <InfoItem icon={FileText} label="Invoice #" value={invoice.invoice_number} />
            <InfoItem icon={User} label="Customer" value={invoice.customer?.name ?? '—'} />
            <InfoItem icon={Calendar} label="Due Date" value={formatDate(invoice.due_date)} />
            <div className="flex items-start gap-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Status</span>
              <StatusBadge status={invoice.status} type="invoice" />
            </div>
          </div>
          )}

          {/* Payment Progress */}
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Payment Progress</span>
              <span className="font-medium text-[var(--color-text)]">
                {Math.round(paidPercent)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-inset)]">
              <div
                className="h-full rounded-full bg-[var(--color-success)] transition-all duration-500"
                style={{ width: `${Math.min(paidPercent, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Financial Summary */}
        <Card className="flex flex-col justify-between p-6">
          <div className="space-y-4">
            <SummaryRow label="Total Amount" value={formatCurrency(invoice.amount)} bold />
            <SummaryRow
              label="Paid Amount"
              value={formatCurrency(invoice.paid_amount)}
              color="text-[var(--color-success)]"
            />
            <div className="border-t border-[var(--color-border)] pt-4">
              <SummaryRow
                label="Balance Due"
                value={formatCurrency(balance)}
                bold
                color={balance > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}
              />
            </div>
          </div>
          {balance <= 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-success-light)] px-4 py-3 text-sm font-medium text-[var(--color-success-fg)]">
              <CheckCircle2 className="h-4 w-4" />
              Fully Paid
            </div>
          )}
        </Card>
      </div>

      {/* Payments List */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Payments ({payments.length})
          </h3>
        </div>

        {payments.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">
            No payments recorded yet
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {payments.map((payment: Payment) => (
              <div key={payment.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-success-light)] text-[var(--color-success)]">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-text)]">
                      {formatCurrency(payment.amount)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <Badge variant="default" size="sm">
                        {payment.method.replace(/_/g, ' ')}
                      </Badge>
                      {payment.reference && <span>Ref: {payment.reference}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {formatDateTime(payment.paid_at)}
                  </p>
                  {payment.received_by && (
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-[var(--color-text-secondary)]">
                      <User className="h-3 w-3" />
                      {payment.received_by.name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          reset();
        }}
        title={t('invoices.recordPayment')}
        description={`Balance due: ${formatCurrency(balance)}`}
      >
        <form onSubmit={handleSubmit(onSubmitPayment)} className="space-y-4">
          <Input
            label={t('invoices.amount')}
            type="number"
            step="0.01"
            error={errors.amount?.message}
            {...register('amount', { valueAsNumber: true })}
          />
          <Select
            label={t('invoices.method')}
            options={METHOD_OPTIONS}
            value={watch('method')}
            onChange={(val) => setValue('method', val as PaymentFormData['method'])}
            error={errors.method?.message}
          />
          <Input
            label="Reference"
            placeholder="Transaction reference (optional)"
            error={errors.reference?.message}
            {...register('reference')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setPaymentModalOpen(false);
                reset();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={paymentMutation.isPending}>
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
      <div>
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
        <p className="text-sm font-medium text-[var(--color-text)]">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={`${bold ? 'text-lg font-bold' : 'text-sm font-medium'} ${color ?? 'text-[var(--color-text)]'}`}>
        {value}
      </span>
    </div>
  );
}
