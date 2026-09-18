import type { ErpItem } from '@/types';

export function compareItemsByProdT(a: ErpItem, b: ErpItem): number {
  const type = (a.type ?? '').localeCompare(b.type ?? '', 'ka');
  if (type !== 0) {
    return type;
  }
  const name = a.name.localeCompare(b.name, 'ka');
  if (name !== 0) {
    return name;
  }
  return a.itemId.localeCompare(b.itemId, 'ka');
}
