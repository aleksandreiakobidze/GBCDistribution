import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info, Tag } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { ErpErrorAlert, SearchInput } from '@/components/shared';
import { formatCurrency } from '@/lib/utils/format';
import type { ErpPromotion, ErpPromotionProduct } from '@/types';

interface PromoProductRow {
  key: string;
  itemId: string;
  name: string;
  minQty: number;
  promoPrice: string | null;
  kind: ErpPromotionProduct['kind'];
  percent: string | null;
  showCode?: boolean;
}

function flattenPromotions(items: ErpPromotion[]): PromoProductRow[] {
  const byKey = new Map<string, PromoProductRow>();

  for (const promo of items) {
    if (promo.appliesToAllProducts && promo.products.length === 0) {
      const key = `__all__:${promo.id}`;
      byKey.set(key, {
        key,
        itemId: '',
        name: '',
        minQty: promo.minQty,
        promoPrice: null,
        kind: promo.typeId === 1 ? 'add' : promo.typeId === 3 ? 'percent' : 'fixed',
        percent: promo.percent,
      });
      continue;
    }

    for (const product of promo.products) {
      const key = `${product.itemId || `${promo.id}:${product.name}`}:${promo.minQty}`;
      if (byKey.has(key)) {
        continue;
      }
      byKey.set(key, {
        key,
        itemId: product.itemId,
        name: product.name,
        minQty: promo.minQty,
        promoPrice: product.promoPrice,
        kind: product.kind,
        percent: product.percent,
      });
    }
  }

  const usable = [...byKey.values()].filter(
    (row) => row.promoPrice != null || row.percent != null || row.kind === 'add',
  );

  const bySignature = new Map<string, PromoProductRow>();
  for (const row of usable) {
    const signature = [row.name, row.promoPrice ?? '', row.minQty, row.percent ?? '', row.kind].join(
      '|',
    );
    if (!bySignature.has(signature)) {
      bySignature.set(signature, row);
    }
  }

  const deduped = [...bySignature.values()];
  const nameCounts = new Map<string, number>();
  for (const row of deduped) {
    const key = `${row.name}:${row.minQty}`;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  return deduped
    .map((row) => ({ ...row, showCode: (nameCounts.get(`${row.name}:${row.minQty}`) ?? 0) > 1 }))
    .sort((a, b) => {
      const an = a.name || '\uffff';
      const bn = b.name || '\uffff';
      return (
        an.localeCompare(bn, 'ka') || a.minQty - b.minQty || a.itemId.localeCompare(b.itemId)
      );
    });
}

function groupPromoRows(rows: PromoProductRow[]): PromoProductRow[][] {
  const groups = new Map<string, PromoProductRow[]>();
  for (const row of rows) {
    const key = row.showCode && row.itemId ? `id:${row.itemId}` : `name:${row.name || row.key}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => a.minQty - b.minQty || a.itemId.localeCompare(b.itemId)),
  );
}

function formatPercent(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }
  return String(num);
}

export default function CustomerPromotionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const customerId = id ?? '';
  const backTo = `/customers/${encodeURIComponent(customerId)}`;
  const [search, setSearch] = useState('');

  const customerQuery = useQuery({
    queryKey: ['erp-customer', customerId],
    queryFn: () => erpApi.customer(customerId),
    enabled: customerId !== '',
    retry: false,
  });

  const promotionsQuery = useQuery({
    queryKey: ['erp-promotions', customerId],
    queryFn: () => erpApi.promotions(customerId),
    enabled: customerId !== '',
    retry: false,
  });

  const rows = useMemo(
    () => flattenPromotions(promotionsQuery.data?.items ?? []),
    [promotionsQuery.data?.items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === '') {
      return rows;
    }
    return rows.filter((row) => {
      const name = row.name || t('customers.allProductsOnPromo', 'All products');
      return name.toLowerCase().includes(q) || row.itemId.toLowerCase().includes(q);
    });
  }, [rows, search, t]);

  const groups = useMemo(() => groupPromoRows(filtered), [filtered]);
  const productCount = useMemo(() => groupPromoRows(rows).length, [rows]);

  if (customerQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('customers.backToCustomers', 'Back to Customers')}
        </Button>
        <ErpErrorAlert
          error={customerQuery.error}
          fallback={t('customers.customerNotFound', 'Customer not found')}
        />
      </div>
    );
  }

  if (customerQuery.isLoading || !customerQuery.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Button variant="ghost" className="self-start -ml-2" onClick={() => navigate(backTo)}>
        <ArrowLeft className="h-4 w-4" />
        {customerQuery.data.name}
      </Button>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)]">
            {t('customers.promotionsTitle', 'Today promotions')}
          </h1>
          {rows.length > 0 ? (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {t('customers.promoCount', '{{count}} products', { count: productCount })}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--color-info-light)] px-3.5 py-2.5 text-sm text-[var(--color-info-fg)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t(
              'customers.promotionsHint',
              'Not applied to the order yet — it is sent at full list price.',
            )}
          </p>
        </div>
      </div>

      {promotionsQuery.isError && (
        <ErpErrorAlert
          error={promotionsQuery.error}
          fallback={t('customers.promotionsLoadError', 'Promotions could not be loaded.')}
        />
      )}

      {promotionsQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!promotionsQuery.isLoading && !promotionsQuery.isError && rows.length === 0 && (
        <EmptyState
          icon={Tag}
          title={t('customers.noPromotions', 'No promotions match this customer today')}
        />
      )}

      {rows.length > 0 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('customers.searchPromoProducts', 'Search products...')}
        />
      )}

      {rows.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Tag}
          title={t('products.noProductsFound', 'No products found')}
        />
      )}

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <ProductPromoCard key={group[0]?.key ?? group.map((row) => row.key).join('|')} rows={group} />
        ))}
      </div>
    </div>
  );
}

function ProductPromoCard({ rows }: { rows: PromoProductRow[] }) {
  const { t } = useTranslation();
  const first = rows[0];
  const name = first.name || t('customers.allProductsOnPromo', 'All products');

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold leading-snug text-[var(--color-text)]">{name}</p>
        {first.showCode && first.itemId !== '' ? (
          <p className="mt-1 text-xs tabular-nums text-[var(--color-text-secondary)]">#{first.itemId}</p>
        ) : null}
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map((row) => (
          <PromoTierRow key={row.key} row={row} />
        ))}
      </ul>
    </Card>
  );
}

function PromoTierRow({ row }: { row: PromoProductRow }) {
  const { t } = useTranslation();
  const qtyLabel =
    row.minQty > 0
      ? t('customers.fromQty', '{{count}} ცალიდან', { count: row.minQty })
      : t('customers.anyQty', 'ნებისმიერი რაოდენობა');
  const kindLabel =
    row.kind === 'percent' && row.percent
      ? `−${formatPercent(row.percent)}%`
      : row.kind === 'add'
        ? t('customers.promoAdd', 'Add product')
        : row.kind === 'fixed'
          ? t('customers.promoFixed', 'Fixed price')
          : null;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)]">{qtyLabel}</p>
        {kindLabel ? (
          <div className="mt-1.5">
            <Badge variant={row.kind === 'percent' ? 'success' : row.kind === 'add' ? 'info' : 'default'}>
              {kindLabel}
            </Badge>
          </div>
        ) : null}
      </div>
      {row.promoPrice != null ? (
        <span className="shrink-0 text-lg font-bold tabular-nums tracking-tight text-[var(--color-primary)]">
          {formatCurrency(row.promoPrice)}
        </span>
      ) : null}
    </li>
  );
}
