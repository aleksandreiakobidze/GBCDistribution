<?php

namespace App\Erp\Support;

/**
 * Promotions are display-only for now: the order is charged at list price and the
 * winning promo is reported as what would have come off. Reverting to applied
 * pricing means feeding these values back into the line price instead.
 */
final class PromoInfo
{
    /**
     * @return array{promoUnitPrice: ?string, promoDiscount: ?string}
     */
    public static function forLine(?string $promoUnitPrice, string $listUnitPrice, string $quantity): array
    {
        $none = ['promoUnitPrice' => null, 'promoDiscount' => null];

        if ($promoUnitPrice === null || $promoUnitPrice === '') {
            return $none;
        }

        try {
            if (Decimal::compare($promoUnitPrice, $listUnitPrice) >= 0) {
                return $none;
            }

            $listTotal = Decimal::mul($listUnitPrice, $quantity, 4);
            $promoTotal = Decimal::mul($promoUnitPrice, $quantity, 4);

            return [
                'promoUnitPrice' => Decimal::normalize($promoUnitPrice, 4),
                'promoDiscount' => Decimal::sub($listTotal, $promoTotal, 4),
            ];
        } catch (\InvalidArgumentException) {
            return $none;
        }
    }
}
