import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Truck,
  MapPin,
  User,
  Calendar,
  Clock,
  Camera,
  FileSignature,
  Package,
  Loader2,
  AlertTriangle,
  X,
  MessageSquare,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/shared';
import { deliveriesApi } from '@/lib/api/deliveries.api';
import apiClient from '@/lib/api/client';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils/format';
import type { Delivery } from '@/types';

const statusFlow: Record<string, { next: string; label: string; variant: 'primary' | 'secondary' | 'danger' }[]> = {
  pending: [{ next: 'assigned', label: 'Assign Driver', variant: 'primary' }],
  assigned: [{ next: 'loading', label: 'Start Loading', variant: 'primary' }],
  loading: [{ next: 'in_transit', label: 'Start Delivery', variant: 'primary' }],
  in_transit: [
    { next: 'delivered', label: 'Mark Delivered', variant: 'primary' },
    { next: 'failed', label: 'Mark Failed', variant: 'danger' },
  ],
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showFailModal, setShowFailModal] = useState(false);
  const [failReason, setFailReason] = useState('');

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Delivery }>(
        `/deliveries/${id}`,
      );
      return data.data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      deliveriesApi.updateStatus(Number(id), status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', id] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setShowFailModal(false);
      setFailReason('');
    },
  });

  const podMutation = useMutation({
    mutationFn: (formData: FormData) => deliveriesApi.uploadPod(Number(id), formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', id] });
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, field: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append(field, file);
    podMutation.mutate(formData);
  }

  function handleActionClick(nextStatus: string) {
    if (nextStatus === 'failed') {
      setShowFailModal(true);
    } else {
      statusMutation.mutate({ status: nextStatus });
    }
  }

  function handleFailSubmit() {
    if (!failReason.trim()) return;
    statusMutation.mutate({ status: 'failed', notes: failReason.trim() });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        Delivery not found
      </div>
    );
  }

  const actions = statusFlow[delivery.status] ?? [];
  const orderItems = delivery.order?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Delivery ${delivery.order?.order_number ?? `#${delivery.order_id}`}`}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/deliveries')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        }
      />

      {/* Delivery Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Delivery Information
          </h3>
          <div className="space-y-4">
            <InfoRow icon={Package} label="Order" value={delivery.order?.order_number ?? `#${delivery.order_id}`} />
            <InfoRow icon={User} label="Customer" value={delivery.order?.customer?.name ?? '—'} />
            <InfoRow icon={MapPin} label="Address" value={delivery.order?.customer?.address ?? '—'} />
            <InfoRow icon={Truck} label="Driver" value={delivery.driver?.name ?? t('common.unassigned', 'Unassigned')} />
            <InfoRow icon={Calendar} label="Scheduled" value={formatDate(delivery.scheduled_date)} />
            {delivery.delivered_at && (
              <InfoRow icon={Clock} label="Delivered" value={formatDateTime(delivery.delivered_at)} />
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Status</span>
              <StatusBadge status={delivery.status} type="delivery" />
            </div>
          </div>

          {/* Failure notes */}
          {delivery.status === 'failed' && delivery.notes && (
            <div className="mt-4 flex gap-2.5 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-light)] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
              <div>
                <p className="text-xs font-medium text-[var(--color-danger-fg)]">Failure Reason</p>
                <p className="mt-0.5 text-sm text-[var(--color-danger-fg)]">{delivery.notes}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Status Actions */}
        <div className="space-y-6">
          {actions.length > 0 && (
            <Card className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => (
                  <Button
                    key={action.next}
                    variant={action.variant}
                    loading={statusMutation.isPending && !showFailModal}
                    onClick={() => handleActionClick(action.next)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Proof of Delivery */}
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t('deliveries.proofOfDelivery')}
            </h3>

            {delivery.status === 'delivered' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {delivery.signature_image && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Signature</p>
                    <img
                      src={delivery.signature_image}
                      alt="Signature"
                      className="h-32 w-full rounded-xl border border-[var(--color-border)] bg-white object-contain p-2"
                    />
                  </div>
                )}
                {delivery.delivery_photo && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Photo</p>
                    <img
                      src={delivery.delivery_photo}
                      alt="Delivery"
                      className="h-32 w-full rounded-xl border border-[var(--color-border)] object-cover"
                    />
                  </div>
                )}
                {!delivery.signature_image && !delivery.delivery_photo && (
                  <p className="text-sm text-[var(--color-text-secondary)]">No proof uploaded</p>
                )}
              </div>
            ) : delivery.status === 'in_transit' ? (
              <div className="flex flex-wrap gap-3">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'signature_image')}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    loading={podMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileSignature className="mr-2 h-4 w-4" />
                    Upload Signature
                  </Button>
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="photo-upload"
                    onChange={(e) => handleFileUpload(e, 'delivery_photo')}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    loading={podMutation.isPending}
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Available after delivery starts
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Order Items */}
      {orderItems.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Order Items
            </h3>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {orderItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-text)]">{item.product?.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--color-text)]">
                    {formatCurrency(item.line_total)}
                  </p>
                  {item.discount_percent > 0 && (
                    <Badge variant="warning" size="sm">
                      -{item.discount_percent}%
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fail reason modal */}
      {showFailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-danger-light)]">
                  <AlertTriangle className="h-4.5 w-4.5 text-[var(--color-danger)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  {t('deliveries.failReason', 'Mark as Failed')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowFailModal(false); setFailReason(''); }}
                className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
              {t('deliveries.failReasonDesc', 'Please provide a reason for the failed delivery. This is required.')}
            </p>

            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-[var(--color-text-tertiary)]" />
              <textarea
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder={t('deliveries.failReasonPlaceholder', 'e.g. Customer not available, wrong address, refused delivery...')}
                rows={3}
                autoFocus
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none transition-colors focus:border-[var(--color-danger)] focus:ring-1 focus:ring-[var(--color-danger)]/30"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => { setShowFailModal(false); setFailReason(''); }}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={statusMutation.isPending}
                onClick={handleFailSubmit}
                disabled={!failReason.trim()}
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                {t('deliveries.confirmFail', 'Confirm Failed')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
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
