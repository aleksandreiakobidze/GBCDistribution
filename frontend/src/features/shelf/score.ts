export type ShelfBox = { x: number; y: number; w: number; h: number };

export type ShelfMark = {
  key: string;
  itemId: string | null;
  itemName: string;
  own: boolean;
  shelfNo: number;
  facings: number;
  readPrice: number | null;
  catalogPrice: number | null;
  box: ShelfBox;
};

export type PlanSlot = {
  itemId: string;
  itemName: string | null;
  shelfNo: number;
  facings: number;
  targetPrice: number | null;
};

export type ScoreRow = {
  key: string;
  name: string;
  tone: 'ok' | 'bad';
  priority: 'high' | 'medium' | 'ok';
  kind: 'ok' | 'missing' | 'move' | 'price' | 'low';
  fromShelf?: number;
  toShelf?: number;
};

export type ShelfScore = {
  assessment: number;
  planogram: number;
  share: number;
  rows: ScoreRow[];
};

export type AuditLineDraft = {
  itemId: string;
  status: 'present' | 'missing' | 'low';
  shelfNo: number | null;
  facings: number;
  readPrice: number | null;
  competitor: boolean;
  itemName: string | null;
  boxX: number | null;
  boxY: number | null;
  boxW: number | null;
  boxH: number | null;
};

function pricesMatch(read: number | null, target: number | null): boolean {
  if (read == null || target == null || target === 0) {
    return true;
  }
  return Math.abs(read - target) / Math.abs(target) <= 0.02;
}

function priceTarget(slot: PlanSlot | undefined, mark: ShelfMark | undefined): number | null {
  if (slot?.targetPrice != null) {
    return slot.targetPrice;
  }
  return mark?.catalogPrice ?? null;
}

export function scoreShelf(marks: ShelfMark[], plan: PlanSlot[]): ShelfScore {
  const own = marks.filter((mark) => mark.own && mark.itemId);
  const totalFacings = marks.reduce((sum, mark) => sum + Math.max(0, mark.facings), 0);
  const ownFacings = own.reduce((sum, mark) => sum + Math.max(0, mark.facings), 0);
  const expected = plan.reduce((sum, slot) => sum + Math.max(1, slot.facings), 0);
  let found = 0;
  let priceSlots = 0;
  let priceOk = 0;
  const rows: ScoreRow[] = [];

  for (const slot of plan) {
    const onShelf = own.filter((mark) => mark.itemId === slot.itemId && mark.shelfNo === slot.shelfNo);
    const seen = onShelf.reduce((sum, mark) => sum + mark.facings, 0);
    found += Math.min(seen, slot.facings);
    const elsewhere = own.filter((mark) => mark.itemId === slot.itemId && mark.shelfNo !== slot.shelfNo);
    const name = slot.itemName || onShelf[0]?.itemName || elsewhere[0]?.itemName || slot.itemId;

    if (seen === 0 && elsewhere.length > 0) {
      rows.push({
        key: `move-${slot.itemId}-${slot.shelfNo}`,
        name,
        tone: 'bad',
        priority: 'high',
        kind: 'move',
        fromShelf: elsewhere[0].shelfNo,
        toShelf: slot.shelfNo,
      });
      continue;
    }
    if (seen === 0) {
      rows.push({
        key: `miss-${slot.itemId}-${slot.shelfNo}`,
        name,
        tone: 'bad',
        priority: 'high',
        kind: 'missing',
      });
      continue;
    }

    const priced = onShelf.find((mark) => mark.readPrice != null);
    const target = priceTarget(slot, priced ?? onShelf[0]);
    const priceBad = target != null && priced != null && !pricesMatch(priced.readPrice, target);
    if (target != null && priced != null) {
      priceSlots += 1;
      if (!priceBad) {
        priceOk += 1;
      }
    }
    if (priceBad) {
      rows.push({ key: `price-${slot.itemId}-${slot.shelfNo}`, name, tone: 'bad', priority: 'medium', kind: 'price' });
    } else if (seen < slot.facings) {
      rows.push({ key: `low-${slot.itemId}-${slot.shelfNo}`, name, tone: 'bad', priority: 'medium', kind: 'low' });
    } else {
      rows.push({ key: `ok-${slot.itemId}-${slot.shelfNo}`, name, tone: 'ok', priority: 'ok', kind: 'ok' });
    }
  }

  const planogram = expected === 0 ? 100 : Math.round((found / expected) * 100);
  const share = totalFacings === 0 ? 0 : Math.round((ownFacings / totalFacings) * 100);
  const assessment = priceSlots === 0 ? planogram : Math.round((planogram + Math.round((priceOk / priceSlots) * 100)) / 2);
  const rank = { high: 0, medium: 1, ok: 2 };
  rows.sort((a, b) => rank[a.priority] - rank[b.priority] || a.name.localeCompare(b.name));

  return { assessment, planogram, share, rows };
}

export function boxTone(mark: ShelfMark, plan: PlanSlot[]): 'ok' | 'bad' | 'open' {
  if (!mark.own) {
    return 'bad';
  }
  if (!mark.itemId) {
    return 'open';
  }
  const slot = plan.find((row) => row.itemId === mark.itemId);
  if (!slot || slot.shelfNo !== mark.shelfNo) {
    return 'bad';
  }
  const onShelf = plan.filter((row) => row.itemId === mark.itemId && row.shelfNo === mark.shelfNo);
  const target = priceTarget(onShelf[0], mark);
  if (!pricesMatch(mark.readPrice, target)) {
    return 'bad';
  }
  return 'ok';
}

export function auditLines(marks: ShelfMark[], plan: PlanSlot[]): AuditLineDraft[] {
  const lines: AuditLineDraft[] = [];
  for (const mark of marks) {
    if (mark.own && !mark.itemId) {
      continue;
    }
    const slot = plan.find((row) => row.itemId === mark.itemId && row.shelfNo === mark.shelfNo);
    let status: AuditLineDraft['status'] = 'present';
    if (mark.own && slot && mark.facings < slot.facings) {
      status = 'low';
    }
    lines.push({
      itemId: mark.own ? (mark.itemId as string) : 'competitor',
      status,
      shelfNo: mark.shelfNo,
      facings: mark.facings,
      readPrice: mark.readPrice,
      competitor: !mark.own,
      itemName: mark.itemName || null,
      boxX: mark.box.x,
      boxY: mark.box.y,
      boxW: mark.box.w,
      boxH: mark.box.h,
    });
  }

  for (const slot of plan) {
    const placed = marks.some((mark) => mark.own && mark.itemId === slot.itemId);
    if (placed) {
      continue;
    }
    lines.push({
      itemId: slot.itemId,
      status: 'missing',
      shelfNo: slot.shelfNo,
      facings: 0,
      readPrice: null,
      competitor: false,
      itemName: slot.itemName,
      boxX: null,
      boxY: null,
      boxW: null,
      boxH: null,
    });
  }

  return lines;
}
