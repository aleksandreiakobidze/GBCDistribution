import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { erpApi, type MonitoringOrderLine } from '@/lib/api/erp.api';
import { formatCurrency } from '@/lib/utils/format';

function formatQty(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatSavedAt(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function StockLines({ lines }: { lines: MonitoringOrderLine[] }) {
  const { t } = useTranslation();
  if (lines.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">{t('monitoring.emptyStock')}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-[var(--color-border)] md:hidden">
        {lines.map((line, index) => (
          <li key={`${line.idProd ?? 'added'}:${line.name}:${index}`} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium leading-snug text-[var(--color-text)]">{line.name}</p>
              {line.idProd ? (
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{line.idProd}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              {line.systemQty !== null ? (
                <p className="text-xs tabular-nums text-[var(--color-text-secondary)]">{formatQty(line.systemQty)}</p>
              ) : null}
              <p className="font-semibold tabular-nums text-[var(--color-text)]">{formatQty(line.actualQty)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Table containerClassName="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>{t('monitoring.code')}</TableHead>
            <TableHead>{t('monitoring.product')}</TableHead>
            <TableHead className="text-right">{t('monitoring.systemQty')}</TableHead>
            <TableHead className="text-right">{t('monitoring.actualQty')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={`${line.idProd ?? 'added'}:${line.name}:${index}`}>
              <TableCell className="whitespace-nowrap">{line.idProd ?? '—'}</TableCell>
              <TableCell className="whitespace-normal break-words font-medium">{line.name}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {line.systemQty !== null ? formatQty(line.systemQty) : '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                {formatQty(line.actualQty)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

export default function MonitoringOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId = '' } = useParams();
  const orderQuery = useQuery({
    queryKey: ['monitoring-order', orderId],
    queryFn: () => erpApi.monitoringOrder(Number(orderId)),
    enabled: orderId !== '' && Number(orderId) > 0,
  });
  const order = orderQuery.data;
  const systemLines = order?.lines.filter((line) => line.source === 'system') ?? [];
  const addedLines = order?.lines.filter((line) => line.source === 'added') ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit shrink-0"
        onClick={() => navigate('/monitoring/orders')}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>
      {orderQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      ) : null}
      {orderQuery.isError ? (
        <p className="text-sm font-medium text-[var(--color-danger)]">{t('monitoring.loadError')}</p>
      ) : null}
      {order ? (
        <>
          <Card className="shrink-0 !p-4 sm:!p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-lg font-semibold leading-snug text-[var(--color-text)]">{order.orgName}</h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {t('monitoring.savedAt')}: {formatSavedAt(order.savedAt)}
                </p>
                {order.saverName ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('monitoring.saver')}: {order.saverName}
                  </p>
                ) : null}
                {order.salesName ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('monitoring.salesperson')}: {order.salesName}
                  </p>
                ) : null}
                {order.address ? (
                  <p className="break-words text-sm text-[var(--color-text-secondary)]">
                    {t('monitoring.address')}: {order.address}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:shrink-0">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t('monitoring.debt')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(order.systemDebt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t('monitoring.actualDebt')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(order.actualDebt)}</p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="space-y-3 !p-4 sm:!p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('monitoring.stock')}</h2>
            <StockLines lines={systemLines} />
            {addedLines.length > 0 ? (
              <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('monitoring.added')}</h2>
                <StockLines lines={addedLines} />
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
