<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;

interface PricingService
{
    /**
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return array{
     *     lines: list<array<string, mixed>>,
     *     subtotal: string,
     *     total: string,
     *     priceState: string,
     *     unresolvedRules: list<string>,
     *     promotions: list<array<string, mixed>>
     * }
     */
    public function quote(int $idGvari, CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array;
}
