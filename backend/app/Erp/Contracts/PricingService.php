<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;

interface PricingService
{
    /**
     * Lines carry the list price. promoUnitPrice/promoDiscount and promoDiscountTotal
     * are informational: the total is the full list amount and promotions never make
     * priceState indicative or fill unresolvedRules.
     *
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
    public function quote(int $idGvari, CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array;
}
