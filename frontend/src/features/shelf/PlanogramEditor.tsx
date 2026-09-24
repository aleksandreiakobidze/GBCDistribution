import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Trash2 } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { AsyncCombobox, Button, Card, Input, type ComboboxOption } from '@/components/ui';

function apiMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return null;
}

export function PlanogramEditor({
  customerId,
  orgCategoryId,
  orgCategory,
  salesUserId,
}: {
  customerId: string;
  orgCategoryId: number;
  orgCategory: string | null;
  salesUserId?: number;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'customer' | 'category'>('customer');
  const [item, setItem] = useState<ComboboxOption | null>(null);
  const [shelfNo, setShelfNo] = useState('1');
  const [facings, setFacings] = useState('1');
  const [targetPrice, setTargetPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const categoryReady = orgCategoryId > 0;

  const query = useQuery({
    queryKey: ['erp-planogram-edit', customerId, scope, orgCategoryId],
    queryFn: () =>
      scope === 'customer' || !categoryReady
        ? erpApi.planograms({ customerId, stored: true })
        : erpApi.planograms({ orgCategoryId }),
  });

  const rows = query.data ?? [];
  const nextPosition = useMemo(() => {
    const shelf = Number(shelfNo) || 1;
    const onShelf = rows.filter((row) => row.shelfNo === shelf);
    return onShelf.reduce((max, row) => Math.max(max, row.position), 0) + 1;
  }, [rows, shelfNo]);

  const searchItems = useCallback(
    async (search: string): Promise<ComboboxOption[]> => {
      const page = await erpApi.items({
        customerId: scope === 'customer' ? customerId : undefined,
        salesUserId,
        search: search || undefined,
        limit: 25,
      });
      return page.items.map((product) => ({
        value: product.itemId,
        label: product.name,
        hint: product.prodCode ?? product.itemId,
      }));
    },
    [customerId, salesUserId, scope],
  );

  const save = useMutation({
    mutationFn: () => {
      if (!item) {
        throw new Error('missing');
      }
      return erpApi.savePlanogram({
        customerId: scope === 'customer' ? customerId : undefined,
        orgCategoryId: scope === 'category' ? orgCategoryId : undefined,
        shelfNo: Number(shelfNo) || 1,
        position: nextPosition,
        itemId: item.value,
        itemName: item.label,
        facings: Math.max(1, Number(facings) || 1),
        targetPrice: targetPrice.trim() === '' ? null : Number(targetPrice),
      });
    },
    onSuccess: async () => {
      setError(null);
      setItem(null);
      setTargetPrice('');
      await queryClient.invalidateQueries({ queryKey: ['erp-planogram'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-planogram-edit', customerId] });
    },
    onError: (reason) => setError(apiMessage(reason) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => erpApi.deletePlanogram(id),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['erp-planogram'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-planogram-edit', customerId] });
    },
    onError: (reason) => setError(apiMessage(reason) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')),
  });

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-[var(--color-text-secondary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('shelf.planogram', 'Planogram')}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={scope === 'customer' ? 'primary' : 'outline'} onClick={() => setScope('customer')}>
          {t('shelf.thisCustomer', 'This customer')}
        </Button>
        {categoryReady ? (
          <Button size="sm" variant={scope === 'category' ? 'primary' : 'outline'} onClick={() => setScope('category')}>
            {orgCategory || t('shelf.category', 'Category')}
          </Button>
        ) : null}
      </div>
      <AsyncCombobox
        label={t('shelf.search', 'Search product')}
        queryKey={['planogram-item', customerId, scope]}
        fetchOptions={searchItems}
        value={item?.value ?? null}
        selectedLabel={item?.label ?? null}
        onChange={setItem}
        placeholder={t('shelf.empty', 'Mark a product')}
        searchPlaceholder={t('filters.searchProduct', 'Search product')}
        emptyText={t('filters.noResults', 'No results')}
      />
      <div className="grid grid-cols-3 gap-2">
        <Input label={t('shelf.shelfNo', 'Shelf')} type="number" min={1} max={20} value={shelfNo} onChange={(event) => setShelfNo(event.target.value)} />
        <Input label={t('shelf.facings', 'Facings')} type="number" min={1} max={40} value={facings} onChange={(event) => setFacings(event.target.value)} />
        <Input
          label={t('shelf.targetPrice', 'Target price')}
          type="number"
          min={0}
          step="0.01"
          value={targetPrice}
          onChange={(event) => setTargetPrice(event.target.value)}
        />
      </div>
      <Button variant="primary" size="sm" disabled={!item || save.isPending} onClick={() => save.mutate()}>
        {t('shelf.add', 'Add position')}
      </Button>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)]">{t('shelf.emptyPlan', 'No planogram yet')}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-sm">
              <span className="w-14 shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t('shelf.shelfNo', 'Shelf')} {row.shelfNo}
              </span>
              <span className="min-w-0 flex-1 truncate">{row.itemName || row.itemId}</span>
              <span className="shrink-0 tabular-nums text-xs text-[var(--color-text-secondary)]">×{row.facings}</span>
              <button
                type="button"
                aria-label={t('common.delete', 'Delete')}
                onClick={() => remove.mutate(row.id)}
                className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p> : null}
    </Card>
  );
}
