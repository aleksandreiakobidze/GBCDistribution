import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { erpApi } from '@/lib/api/erp.api';
import { formatCurrency } from '@/lib/utils/format';

function formatQty(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function lineKey(line: { idProd: string; name: string }): string {
  return `${line.idProd}\n${line.name}`;
}

function shownQty(line: { idProd: string; name: string; qty: number }, values: Record<string, string>): string {
  return values[lineKey(line)] ?? String(line.qty);
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }
  return fallback;
}

type DraftLine = { id: string; name: string; qty: string };

export default function MonitoringOrgPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId = '', idOrg = '' } = useParams();
  const orgId = decodeURIComponent(idOrg);
  const [actualDebt, setActualDebt] = useState<string | null>(null);
  const [actualQty, setActualQty] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<DraftLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const cardQuery = useQuery({
    queryKey: ['monitoring-card', userId, orgId],
    queryFn: () => erpApi.monitoringOrgCard(orgId, Number(userId)),
    enabled: userId !== '' && orgId !== '',
  });
  const saveMutation = useMutation({
    mutationFn: erpApi.saveMonitoringOrder,
    onSuccess: (order) => navigate(`/monitoring/orders/${order.id}`),
    onError: (error) => setFormError(errorMessage(error, t('monitoring.saveError'))),
  });
  const card = cardQuery.data;

  function save() {
    if (!card) {
      return;
    }
    const debt = parseAmount(actualDebt ?? (card ? String(card.debt) : ''));
    const lines = card.stock.map((line) => {
      const qty = parseAmount(shownQty(line, actualQty));
      return qty === null ? null : { idProd: line.idProd, name: line.name, actualQty: qty };
    });
    const extras: Array<{ name: string; qty: number }> = [];
    for (const row of added) {
      const name = row.name.trim();
      if (name === '' && row.qty.trim() === '') {
        continue;
      }
      const qty = parseAmount(row.qty);
      if (name === '' || qty === null) {
        setFormError(t('monitoring.fillRequired'));
        return;
      }
      extras.push({ name, qty });
    }
    if (debt === null || lines.some((line) => line === null)) {
      setFormError(t('monitoring.fillRequired'));
      return;
    }
    setFormError(null);
    saveMutation.mutate({
      userId: Number(userId),
      idOrg: orgId,
      actualDebt: debt,
      lines: lines.filter((line) => line !== null),
      added: extras,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Button
        variant="ghost"
        size="md"
        className="-ml-2 w-fit shrink-0 rounded-full"
        onClick={() => navigate(`/monitoring?user=${encodeURIComponent(userId)}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>
      <Card className="shrink-0 !p-4 sm:!p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="min-w-0 break-words text-xl font-semibold leading-snug text-[var(--color-text)]">
            {card?.name ?? t('monitoring.organization')}
          </h1>
          {card ? (
            <div className="grid w-full grid-cols-2 items-end gap-3 sm:w-80 sm:shrink-0">
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('monitoring.debt')}
                </p>
                <p className="flex h-9 items-center text-sm font-medium tabular-nums text-[var(--color-text)]">
                  {formatCurrency(card.debt)}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('monitoring.actualDebt')}
                </p>
                <Input
                  value={actualDebt ?? String(card.debt)}
                  inputMode="decimal"
                  className="h-9 tabular-nums"
                  onChange={(event) => setActualDebt(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
      <Card className="flex min-h-0 flex-1 flex-col !p-4 sm:!p-5">
        <h2 className="mb-2 shrink-0 text-sm font-semibold text-[var(--color-text)]">{t('monitoring.stock')}</h2>
        {cardQuery.isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner /></div>
        ) : null}
        {cardQuery.isError ? (
          <p className="text-sm font-medium text-[var(--color-danger)]">{t('monitoring.loadError')}</p>
        ) : null}
        {card ? (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto">
              {card.stock.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">{t('monitoring.emptyStock')}</p>
              ) : (
                <>
                  <ul className="divide-y divide-[var(--color-border)] md:hidden">
                    {card.stock.map((line) => (
                      <li key={lineKey(line)} className="space-y-2 py-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium leading-snug text-[var(--color-text)]">{line.name}</p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{line.idProd}</p>
                        </div>
                        <div className="grid grid-cols-2 items-end gap-3">
                          <div>
                            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{t('monitoring.systemQty')}</p>
                            <p className="flex h-9 items-center text-sm tabular-nums">{formatQty(line.qty)}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">{t('monitoring.actualQty')}</p>
                            <Input
                              value={shownQty(line, actualQty)}
                              inputMode="decimal"
                              className="h-9 tabular-nums"
                              onChange={(event) => setActualQty((current) => ({
                                ...current,
                                [lineKey(line)]: event.target.value,
                              }))}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Table containerClassName="hidden md:block">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="first:static first:left-auto first:z-auto bg-[var(--color-surface-hover)] first:bg-[var(--color-surface-hover)] normal-case tracking-normal">{t('monitoring.code')}</TableHead>
                        <TableHead className="bg-[var(--color-surface-hover)] normal-case tracking-normal">{t('monitoring.product')}</TableHead>
                        <TableHead className="bg-[var(--color-surface-hover)] normal-case tracking-normal text-right">{t('monitoring.systemQty')}</TableHead>
                        <TableHead className="w-28 bg-[var(--color-surface-hover)] normal-case tracking-normal text-right">{t('monitoring.actualQty')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {card.stock.map((line) => (
                        <TableRow key={lineKey(line)}>
                          <TableCell className="whitespace-nowrap first:static first:left-auto first:z-auto first:bg-transparent">{line.idProd}</TableCell>
                          <TableCell className="whitespace-normal break-words font-medium">{line.name}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                            {formatQty(line.qty)}
                          </TableCell>
                          <TableCell className="w-28">
                            <Input
                              value={shownQty(line, actualQty)}
                              inputMode="decimal"
                              className="h-9 text-right text-sm tabular-nums"
                              onChange={(event) => setActualQty((current) => ({
                                ...current,
                                [lineKey(line)]: event.target.value,
                              }))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
              <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">{t('monitoring.addItem')}</h3>
                {added.map((row) => (
                  <div key={row.id} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        value={row.name}
                        placeholder={t('monitoring.itemName')}
                        onChange={(event) => setAdded((current) => current.map((item) => (
                          item.id === row.id ? { ...item, name: event.target.value } : item
                        )))}
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <Input
                        value={row.qty}
                        inputMode="decimal"
                        placeholder={t('monitoring.qty')}
                        className="tabular-nums"
                        onChange={(event) => setAdded((current) => current.map((item) => (
                          item.id === row.id ? { ...item, qty: event.target.value } : item
                        )))}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 shrink-0"
                      aria-label={t('monitoring.remove')}
                      onClick={() => setAdded((current) => current.filter((item) => item.id !== row.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="md"
                  className="rounded-full"
                  onClick={() => setAdded((current) => [...current, { id: crypto.randomUUID(), name: '', qty: '' }])}
                >
                  <Plus className="h-4 w-4" />
                  {t('monitoring.addItem')}
                </Button>
              </div>
            </div>
            {formError ? (
              <p className="mt-3 shrink-0 text-sm font-medium text-[var(--color-danger)]">{formError}</p>
            ) : null}
            <div className="mt-3 flex shrink-0 justify-stretch sm:justify-end">
              <Button className="w-full rounded-full sm:w-auto" loading={saveMutation.isPending} onClick={save}>
                {t('common.save')}
              </Button>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
