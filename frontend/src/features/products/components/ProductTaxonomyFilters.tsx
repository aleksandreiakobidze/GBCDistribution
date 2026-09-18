import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/cn';
import type { ErpProductTaxonomyGroup } from '@/types';

interface ProductTaxonomyFiltersProps {
  taxonomy: ErpProductTaxonomyGroup[];
  prodS: string | null;
  prodT: string | null;
  onChange: (next: { prodS: string | null; prodT: string | null }) => void;
}

function Chip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 shrink-0 rounded-full px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors',
        active
          ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
          : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
      )}
    >
      {label}
      {count != null ? <span className="ml-1 opacity-70">{count}</span> : null}
    </button>
  );
}

export function ProductTaxonomyFilters({
  taxonomy,
  prodS,
  prodT,
  onChange,
}: ProductTaxonomyFiltersProps) {
  const { t } = useTranslation();
  if (taxonomy.length === 0) return null;

  const selected = taxonomy.find((g) => g.name === prodS) ?? null;
  const types = selected?.types ?? [];

  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <div className="flex flex-wrap gap-1">
        <Chip
          active={prodS === null}
          label={t('products.allProdS', 'All')}
          onClick={() => onChange({ prodS: null, prodT: null })}
        />
        {taxonomy.map((group) => {
          const label = group.name || t('products.ungrouped', 'Other');
          return (
            <Chip
              key={group.name || '__empty-prods'}
              active={prodS === group.name}
              label={label}
              count={group.count}
              onClick={() =>
                onChange({
                  prodS: prodS === group.name ? null : group.name,
                  prodT: null,
                })
              }
            />
          );
        })}
      </div>

      {selected && types.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Chip
            active={prodT === null}
            label={t('products.allProdT', 'All')}
            onClick={() => onChange({ prodS, prodT: null })}
          />
          {types.map((type) => {
            const label = type.name || t('products.ungrouped', 'Other');
            return (
              <Chip
                key={type.name || '__empty-prodt'}
                active={prodT === type.name}
                label={label}
                count={type.count}
                onClick={() =>
                  onChange({
                    prodS,
                    prodT: prodT === type.name ? null : type.name,
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
