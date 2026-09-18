<?php

namespace App\Erp\Support;

use App\Erp\Dto\CustomerRecord;

/**
 * Apply Prioriteti-winning T=2 / T=3 prices to basket lines.
 */
final class PromotionPricing
{
    public function __construct(private readonly PriceGroupMapping $mapping)
    {
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return array{
     *     unitPrices: array<string, string>,
     *     unresolvedRules: list<string>,
     *     winners: list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>
     * }
     */
    public function forBasket(CustomerRecord $customer, array $actions, array $lines): array
    {
        $displayWinners = PromotionPrioriteti::winnersForDisplay($actions);
        $unitPrices = [];
        $unresolved = [];

        foreach ($lines as $line) {
            $itemId = (string) ($line['itemId'] ?? '');
            if ($itemId === '') {
                continue;
            }

            $qtyRaw = (string) ($line['quantity'] ?? '0');
            try {
                $qty = Decimal::normalize($qtyRaw, 4);
            } catch (\InvalidArgumentException) {
                continue;
            }

            $winner = PromotionPrioriteti::winnerForItem($actions, $itemId, (float) $qty);
            if ($winner === null) {
                continue;
            }

            $typeId = (int) ($winner['header']['IdActionsT'] ?? 0);

            if ($typeId === 1) {
                $unresolved[] = 'PROMOTION_GIFT_UNRESOLVED';
                continue;
            }

            if ($typeId !== 2 && $typeId !== 3) {
                $unresolved[] = 'PROMOTION_ALGORITHM_UNRESOLVED';
                continue;
            }

            $productRow = PromotionPrioriteti::productRowFor($winner, $itemId) ?? ['IdProd' => $itemId];
            $price = $this->promoUnitPrice($customer, $winner['header'], $productRow);
            if ($price === null) {
                $unresolved[] = 'PROMOTION_PRICE_UNRESOLVED';
                continue;
            }

            $unitPrices[$itemId] = $price;
        }

        return [
            'unitPrices' => $unitPrices,
            'unresolvedRules' => array_values(array_unique($unresolved)),
            'winners' => $displayWinners,
        ];
    }

    /**
     * @param  array<string, mixed>  $header
     * @param  array<string, mixed>  $productRow
     */
    public function promoUnitPrice(CustomerRecord $customer, array $header, array $productRow): ?string
    {
        $typeId = (int) ($header['IdActionsT'] ?? 0);
        $percent = isset($header['ActionsPercent']) && $header['ActionsPercent'] !== ''
            ? (string) $header['ActionsPercent']
            : null;
        $fromStandard = (int) ($header['FromStandardFasi'] ?? 0) === 1;

        if ($typeId === 2) {
            return $this->positiveOrNull($productRow['ActionsFasi'] ?? null);
        }

        if ($typeId !== 3) {
            return null;
        }

        $list = null;
        if ($fromStandard) {
            $basis = PromotionPresenter::standardFasiColumn($customer->idOrgT);
            if ($basis === null) {
                return null;
            }
            $list = $this->decimalOrNull($productRow[$basis] ?? null);
        } elseif ($this->mapping->isValid($customer->priceGroup)) {
            $col = $this->mapping->columnFor($customer->priceGroup);
            $list = $this->decimalOrNull($productRow['FasiFg'] ?? $productRow[$col] ?? null);
        }

        if ($list === null || $percent === null) {
            return null;
        }

        $price = PromotionPresenter::percentOfList($list, $percent);

        return $price !== null && (float) $price > 0 ? $price : null;
    }

    /**
     * Live FMG has T=2 rows with ActionsFasi = 0; those are not free goods, so
     * they must stay unresolved rather than becoming a zero unit price.
     */
    private function positiveOrNull(mixed $raw): ?string
    {
        $value = $this->decimalOrNull($raw);

        return $value !== null && (float) $value > 0 ? $value : null;
    }

    private function decimalOrNull(mixed $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        try {
            return Decimal::normalize((string) $raw, 4);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }
}
