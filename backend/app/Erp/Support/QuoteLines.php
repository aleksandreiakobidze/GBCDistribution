<?php

namespace App\Erp\Support;

use App\Erp\Contracts\ProductRepository;
use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Exceptions\ErpException;

final class QuoteLines
{
    /**
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return array{
     *     lines: list<array<string, mixed>>,
     *     subtotal: string,
     *     total: string,
     *     priceState: string,
     *     unresolvedRules: list<string>,
     *     promoDiscountTotal: string,
     *     promotions: list<array<string, mixed>>
     * }
     */
    public static function price(
        ProductRepository $products,
        PromotionRepository $promotions,
        int $idGvari,
        CustomerRecord $customer,
        array $lines,
        \DateTimeInterface $onDate,
    ): array {
        if ($lines === []) {
            throw new ErpException('EMPTY_BASKET', 'დაამატეთ მინიმუმ ერთი პროდუქტი.', 422);
        }

        $prepared = [];
        foreach ($lines as $line) {
            $itemId = (string) ($line['itemId'] ?? '');
            $item = $products->getForCustomer($idGvari, $customer, $itemId);
            if ($item->unitPrice === null) {
                throw new ErpException(
                    'PRICE_UNAVAILABLE',
                    'პროდუქტის ფასი ამ მომხმარებლისთვის მიუწვდომელია.',
                    422,
                    ['itemId' => $itemId],
                );
            }

            $resolved = PackQuantity::resolve((string) ($line['quantity'] ?? ''), $item, $customer);
            $prepared[] = ['item' => $item, 'resolved' => $resolved];
        }

        $promo = $promotions->priceBasket(
            $customer,
            array_map(
                static fn (array $row) => [
                    'itemId' => $row['item']->itemId,
                    'quantity' => $row['resolved']['pieces'],
                ],
                $prepared,
            ),
            $onDate,
        );

        $priced = [];
        $subtotal = '0.0000';
        $promoDiscountTotal = '0.0000';

        foreach ($prepared as $row) {
            $item = $row['item'];
            $resolved = $row['resolved'];
            $unitPrice = $item->unitPrice;
            $pieces = $resolved['pieces'];
            $lineTotal = Decimal::mul($unitPrice, $pieces, 4);
            $subtotal = Decimal::add($subtotal, $lineTotal, 4);

            $promoLine = PromoInfo::forLine($promo['unitPrices'][$item->itemId] ?? null, $unitPrice, $pieces);
            if ($promoLine['promoDiscount'] !== null) {
                $promoDiscountTotal = Decimal::add($promoDiscountTotal, $promoLine['promoDiscount'], 4);
            }

            $priced[] = [
                'itemId' => $item->itemId,
                'name' => $item->name,
                'unit' => $item->unit,
                'quantity' => $resolved['packQuantity'],
                'packQuantity' => $resolved['packQuantity'],
                'pieces' => $pieces,
                'compRaod' => $resolved['compRaod'],
                'unitPrice' => $unitPrice,
                'lineTotal' => $lineTotal,
                'promoUnitPrice' => $promoLine['promoUnitPrice'],
                'promoDiscount' => $promoLine['promoDiscount'],
            ];
        }

        return [
            'lines' => $priced,
            'subtotal' => $subtotal,
            'total' => $subtotal,
            'priceState' => 'computed',
            'unresolvedRules' => [],
            'promoDiscountTotal' => $promoDiscountTotal,
            'promotions' => $promo['promotions'],
        ];
    }
}
