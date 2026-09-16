<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;

interface PromotionRepository
{
    /**
     * Indicative promotion rows that may apply. Algorithm is unresolved unless documented.
     *
     * @return list<array<string, mixed>>
     */
    public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array;

    /**
     * True when any unresolved promotion rule might affect this customer/basket.
     *
     * @param  list<array{itemId: string, quantity: string}>  $lines
     */
    public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool;
}
