export function packSize(compRaod?: string | null): number {
  const n = parseFloat(compRaod ?? '1');
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function piecesFromPacks(packs: number, compRaod?: string | null): number {
  return (Number.isFinite(packs) ? packs : 0) * packSize(compRaod);
}

export function formatPackQty(n: number): string {
  if (!Number.isFinite(n)) {
    return '0';
  }
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function canHalfPack(
  customerCanHalf?: boolean | null,
  productCanHalf?: boolean | null,
): boolean {
  return customerCanHalf === true && productCanHalf === true;
}

export function packStep(allowHalf: boolean): number {
  return allowHalf ? 0.5 : 1;
}
