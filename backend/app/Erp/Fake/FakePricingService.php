<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\PricingService;
use App\Erp\Contracts\ProductRepository;
use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\Decimal;

final class FakePricingService implements PricingService
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly PromotionRepository $promotions,
    ) {
    }

    public function quote(int $idGvari, CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array
    {
        if ($lines === []) {
            throw new ErpException('EMPTY_BASKET', 'დაამატეთ მინიმუმ ერთი პროდუქტი.', 422);
        }

        $priced = [];
        $subtotal = '0.0000';

        foreach ($lines as $line) {
            $itemId = (string) ($line['itemId'] ?? '');
            try {
                $qty = Decimal::assertRaod((string) ($line['quantity'] ?? ''));
            } catch (\InvalidArgumentException) {
                throw new ErpException('INVALID_QUANTITY', 'რაოდენობა არასწორია ან სცდება FMG Raod ზღვარს.', 422, ['itemId' => $itemId]);
            }

            $item = $this->products->getForCustomer($idGvari, $customer, $itemId);
            if ($item->unitPrice === null) {
                throw new ErpException(
                    'PRICE_UNAVAILABLE',
                    'პროდუქტის ფასი ამ მომხმარებლისთვის მიუწვდომელია.',
                    422,
                    ['itemId' => $itemId],
                );
            }

            $lineTotal = Decimal::mul($item->unitPrice, $qty, 4);
            $subtotal = Decimal::add($subtotal, $lineTotal, 4);
            $priced[] = [
                'itemId' => $item->itemId,
                'name' => $item->name,
                'unit' => $item->unit,
                'quantity' => $qty,
                'unitPrice' => $item->unitPrice,
                'lineTotal' => $lineTotal,
            ];
        }

        $promos = $this->promotions->listIndicative($customer, $onDate);
        $unresolved = [];
        if ($this->promotions->hasUnresolvedEffect($customer, $lines, $onDate)) {
            $unresolved[] = 'PROMOTION_ALGORITHM_UNRESOLVED';
        }

        $priceState = $unresolved === [] ? 'computed' : 'indicative';

        return [
            'lines' => $priced,
            'subtotal' => $subtotal,
            'total' => $subtotal,
            'priceState' => $priceState,
            'unresolvedRules' => $unresolved,
            'promotions' => $promos,
        ];
    }
}
