<?php

namespace App\Erp\Support;

use App\Erp\Dto\CustomerRecord;

final class PromotionPresenter
{
    public const REASON_UNRESOLVED = 'FMG_PROMOTION_ALGORITHM_UNRESOLVED';

    public function __construct(private readonly PriceGroupMapping $mapping)
    {
    }

    /**
     * @param  array<string, mixed>  $header
     * @param  list<array<string, mixed>>  $productRows
     * @return array<string, mixed>|null
     */
    public function present(CustomerRecord $customer, array $header, array $productRows): ?array
    {
        $typeId = (int) ($header['IdActionsT'] ?? 0);
        if ($typeId === -1) {
            return null;
        }

        $percent = isset($header['ActionsPercent']) && $header['ActionsPercent'] !== ''
            ? (string) $header['ActionsPercent']
            : null;
        $fromStandard = (int) ($header['FromStandardFasi'] ?? 0) === 1;
        $window = self::qtyWindow($header);

        $products = [];
        foreach ($productRows as $row) {
            $products[] = $this->presentProduct($customer, $typeId, $fromStandard, $percent, $row);
        }

        $name = trim((string) ($header['Actions'] ?? ''));
        $typeName = trim((string) ($header['ActionsT'] ?? ''));

        return [
            'id' => (string) ($header['IdActions'] ?? ''),
            'name' => $name !== '' ? $name : ($typeName !== '' ? $typeName : 'promotion'),
            'typeId' => $typeId,
            'typeName' => $typeName,
            'dateFrom' => PromotionScope::dateOnly($header['Data'] ?? null),
            'dateEnd' => PromotionScope::dateOnly($header['DataEnd'] ?? null),
            'minQty' => $window['min'],
            'maxQty' => $window['max'],
            'fromStandardFasi' => $fromStandard,
            'percent' => $percent,
            'appliesToAllProducts' => $productRows === [],
            'products' => $products,
            'state' => 'indicative',
            'reason' => self::REASON_UNRESOLVED,
        ];
    }

    /**
     * Qualifying quantity window, in selling units, per action type:
     * IdActionsT=3 → Raod >= ActionsRaod3; IdActionsT=2 → ActionsRaod1 <= Raod <= ActionsRaod2.
     * Each type reads only its own columns, and ActionsRaod2 = 0 means no upper bound.
     * Other types (gift) have no window; they never reach pricing anyway.
     *
     * @param  array<string, mixed>  $header
     * @return array{min: int, max: ?int}
     */
    public static function qtyWindow(array $header): array
    {
        $typeId = (int) ($header['IdActionsT'] ?? 0);

        if ($typeId === 3) {
            return ['min' => (int) ($header['ActionsRaod3'] ?? 0), 'max' => null];
        }

        if ($typeId === 2) {
            $max = (int) ($header['ActionsRaod2'] ?? 0);

            return [
                'min' => (int) ($header['ActionsRaod1'] ?? 0),
                'max' => $max > 0 ? $max : null,
            ];
        }

        return ['min' => 0, 'max' => null];
    }

    /**
     * ActionsPercent is a discount off list: pay Fasi × (1 − percent/100).
     * Values in (0, 1] are already fractions. 100% (or more) is not a price.
     */
    public static function percentOfList(string $listPrice, string $percent): ?string
    {
        try {
            $list = Decimal::normalize($listPrice, 4);
            $raw = Decimal::normalize($percent, 4);
        } catch (\InvalidArgumentException) {
            return null;
        }

        $n = (float) $raw;
        if ($n <= 0) {
            return null;
        }

        if ($n <= 1) {
            $discount = $raw;
        } elseif ($n <= 100) {
            $discount = function_exists('bcdiv')
                ? bcdiv($raw, '100', 6)
                : number_format($n / 100, 6, '.', '');
        } else {
            return null;
        }

        try {
            $remaining = Decimal::sub('1', $discount, 6);
            if (Decimal::compare($remaining, '0', 6) <= 0) {
                return null;
            }

            return Decimal::mul($list, $remaining, 4);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }

    public static function standardFasiColumn(int $idOrgT): ?string
    {
        return match ($idOrgT) {
            102, 110 => 'Fasi1',
            106 => 'Fasi60',
            111 => 'Fasi59',
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function presentProduct(
        CustomerRecord $customer,
        int $typeId,
        bool $fromStandard,
        ?string $percent,
        array $row,
    ): array {
        $itemId = (string) ($row['IdProd'] ?? '');
        $name = trim((string) ($row['Prod'] ?? ''));
        $kind = match ($typeId) {
            1 => 'add',
            2 => 'fixed',
            3 => 'percent',
            default => 'unknown',
        };

        $promoPrice = null;
        $basis = null;

        if ($kind === 'fixed') {
            $raw = $row['ActionsFasi'] ?? null;
            if ($raw !== null && $raw !== '') {
                try {
                    $promoPrice = Decimal::normalize((string) $raw, 4);
                } catch (\InvalidArgumentException) {
                    $promoPrice = null;
                }
            }
        }

        if ($kind === 'percent') {
            $list = null;
            if ($fromStandard) {
                $basis = self::standardFasiColumn($customer->idOrgT);
                $list = $basis !== null ? $this->decimalOrNull($row[$basis] ?? null) : null;
            } elseif ($this->mapping->isValid($customer->priceGroup)) {
                $basis = $this->mapping->columnFor($customer->priceGroup);
                $list = $this->decimalOrNull($row['FasiFg'] ?? $row[$basis] ?? null);
            }

            if ($list !== null && $percent !== null) {
                $promoPrice = self::percentOfList($list, $percent);
            }
        }

        if ($promoPrice !== null && (float) $promoPrice <= 0) {
            $promoPrice = null;
        }

        return [
            'itemId' => $itemId,
            'name' => $name !== '' ? $name : $itemId,
            'kind' => $kind,
            'promoPrice' => $promoPrice,
            'basis' => $basis,
            'percent' => $kind === 'percent' ? $percent : null,
        ];
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
