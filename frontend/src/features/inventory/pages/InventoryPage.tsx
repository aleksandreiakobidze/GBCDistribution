import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Package, Plus, AlertTriangle } from 'lucide-react';
import { Button, Card, Modal, Select, Input, Textarea, Badge } from '@/components/ui';
import { PageHeader, DataTable, SearchInput, Pagination, type DataTableColumn } from '@/components/shared';
import { inventoryApi } from '@/lib/api/inventory.api';
import { productsApi } from '@/lib/api/products.api';
import apiClient from '@/lib/api/client';
import type { InventoryItem, Warehouse } from '@/types';

export default function InventoryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  const [adjustWarehouse, setAdjustWarehouse] = useState('');
  const [adjustProduct, setAdjustProduct] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Warehouse[] }>('/warehouses');
      return data.data;
    },
  });

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', page, warehouseId],
    queryFn: () =>
      inventoryApi.getAll({
        page,
        warehouse_id: warehouseId ? Number(warehouseId) : undefined,
      }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.getAll({ page: 1 }),
    enabled: adjustModalOpen,
  });

  const adjustMutation = useMutation({
    mutationFn: (payload: Parameters<typeof inventoryApi.adjust>[0]) =>
      inventoryApi.adjust(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeAdjustModal();
    },
  });

  function closeAdjustModal() {
    setAdjustModalOpen(false);
    setAdjustWarehouse('');
    setAdjustProduct('');
    setAdjustQuantity('');
    setAdjustNotes('');
  }

  function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustWarehouse || !adjustProduct || !adjustQuantity) return;
    adjustMutation.mutate({
      warehouse_id: Number(adjustWarehouse),
      product_id: Number(adjustProduct),
      quantity: Number(adjustQuantity),
      notes: adjustNotes || undefined,
    });
  }

  const items = inventoryData?.data ?? [];
  const meta = inventoryData?.meta;

  const filtered = search
    ? items.filter(
        (item) =>
          item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
          item.product?.sku.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const warehouseOptions = (warehouses ?? []).map((w) => ({
    value: String(w.id),
    label: w.name,
  }));

  const productOptions = (productsData?.data ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.name} (${p.sku})`,
  }));

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: 'product',
      header: t('common.name'),
      render: (row) => {
        const isLow = row.quantity < row.min_stock_level;
        return (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isLow
                  ? 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
                  : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              }`}
            >
              {isLow ? <AlertTriangle className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)]">{row.product?.name}</p>
              {isLow && (
                <Badge variant="danger" size="sm">
                  {t('inventory.lowStock')}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'sku',
      header: t('products.sku'),
      render: (row) => (
        <span className="font-mono text-xs text-[var(--color-text-secondary)]">
          {row.product?.sku}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t('common.quantity'),
      render: (row) => {
        const isLow = row.quantity < row.min_stock_level;
        return (
          <span className={`font-semibold ${isLow ? 'text-[var(--color-danger)]' : ''}`}>
            {row.quantity}
          </span>
        );
      },
    },
    {
      key: 'reserved',
      header: t('inventory.reserved'),
      render: (row) => (
        <span className="text-[var(--color-text-secondary)]">{row.reserved_quantity}</span>
      ),
    },
    {
      key: 'available',
      header: t('inventory.available'),
      render: (row) => (
        <span className="font-semibold text-[var(--color-success)]">
          {row.quantity - row.reserved_quantity}
        </span>
      ),
    },
    {
      key: 'min_stock_level',
      header: t('inventory.minStock'),
      render: (row) => (
        <span className="text-[var(--color-text-secondary)]">{row.min_stock_level}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventory.title')}
        action={
          <div className="flex items-center gap-3">
            <Link to="/inventory/movements">
              <Button variant="outline" size="sm">
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                {t('inventory.movements')}
              </Button>
            </Link>
            <Button size="sm" onClick={() => setAdjustModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('inventory.adjust')}
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('common.search')}
            className="flex-1"
          />
          <div className="w-full sm:w-56">
            <Select
              placeholder="All Warehouses"
              options={[{ value: 'all', label: 'All Warehouses' }, ...warehouseOptions]}
              value={warehouseId || 'all'}
              onChange={(val) => {
                setWarehouseId(val === 'all' ? '' : val);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <DataTable<InventoryItem>
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyMessage={t('common.noData')}
        />
      </Card>

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} />
      )}

      <Modal
        open={adjustModalOpen}
        onClose={closeAdjustModal}
        title={t('inventory.adjust')}
        description="Add or remove stock from a warehouse"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <Select
            label="Warehouse"
            placeholder="Select warehouse"
            options={warehouseOptions}
            value={adjustWarehouse}
            onChange={setAdjustWarehouse}
          />
          <Select
            label="Product"
            placeholder="Select product"
            options={productOptions}
            value={adjustProduct}
            onChange={setAdjustProduct}
          />
          <Input
            label="Quantity"
            type="number"
            placeholder="Positive to add, negative to remove"
            value={adjustQuantity}
            onChange={(e) => setAdjustQuantity(e.target.value)}
          />
          <Textarea
            label={t('common.notes')}
            placeholder="Optional notes..."
            rows={3}
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={closeAdjustModal}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={adjustMutation.isPending}
              disabled={!adjustWarehouse || !adjustProduct || !adjustQuantity}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
