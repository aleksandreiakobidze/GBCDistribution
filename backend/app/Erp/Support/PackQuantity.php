<?php

namespace App\Erp\Support;

use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Exceptions\ErpException;

/**
 * New-order quantity is packs (CompRaod). FMG Raod is pieces = packs × CompRaod.
 * Half a pack (0.5) is allowed only when OrgT.CanRealHalfComp and ProdView.CanRealHalfComp are both 1.
 */
final class PackQuantity
{
    /**
     * @return array{packQuantity: string, pieces: string, compRaod: string}
     */
    public static function resolve(string $packQty, ItemRecord $item, CustomerRecord $customer): array
    {
        try {
            $packs = Decimal::assertRaod($packQty);
        } catch (\InvalidArgumentException) {
            throw new ErpException(
                'INVALID_QUANTITY',
                'რაოდენობა არასწორია ან სცდება FMG Raod ზღვარს.',
                422,
                ['itemId' => $item->itemId],
            );
        }

        if (Decimal::compare($packs, '0', 4) <= 0) {
            throw new ErpException(
                'INVALID_QUANTITY',
                'რაოდენობა არასწორია ან სცდება FMG Raod ზღვარს.',
                422,
                ['itemId' => $item->itemId],
            );
        }

        $compRaod = self::compRaod($item);
        $canHalf = self::allowsHalf($item, $customer);

        if (! self::isAllowedPackQty($packs, $canHalf)) {
            throw new ErpException(
                $canHalf ? 'INVALID_PACK_QUANTITY' : 'HALF_PACK_NOT_ALLOWED',
                $canHalf
                    ? 'შეკვრის რაოდენობა უნდა იყოს მთელი ან ნახევარი (0.5).'
                    : 'ნახევარი შეკვრა ამ პროდუქტზე ან არხზე დაუშვებელია.',
                422,
                [
                    'itemId' => $item->itemId,
                    'canRealHalfComp' => $canHalf,
                ],
            );
        }

        try {
            $pieces = Decimal::assertRaod(Decimal::mul($packs, $compRaod, 4));
        } catch (\InvalidArgumentException) {
            throw new ErpException(
                'INVALID_QUANTITY',
                'რაოდენობა არასწორია ან სცდება FMG Raod ზღვარს.',
                422,
                ['itemId' => $item->itemId],
            );
        }

        return [
            'packQuantity' => $packs,
            'pieces' => $pieces,
            'compRaod' => $compRaod,
        ];
    }

    public static function allowsHalf(ItemRecord $item, CustomerRecord $customer): bool
    {
        return $customer->canRealHalfComp && $item->canRealHalfComp === true;
    }

    public static function compRaod(ItemRecord $item): string
    {
        if ($item->compRaod === null || $item->compRaod === '') {
            return '1.0000';
        }

        try {
            $compRaod = Decimal::normalize($item->compRaod, 4);
        } catch (\InvalidArgumentException) {
            return '1.0000';
        }

        if (Decimal::compare($compRaod, '0', 4) <= 0) {
            return '1.0000';
        }

        return $compRaod;
    }

    private static function isAllowedPackQty(string $packs, bool $canHalf): bool
    {
        if (Decimal::isWhole($packs)) {
            return true;
        }

        if (! $canHalf) {
            return false;
        }

        return Decimal::isWhole(Decimal::mul($packs, '2', 4));
    }
}
