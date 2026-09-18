<?php

namespace App\Erp\Contracts;

use App\Erp\Dto\CustomerRecord;

interface PromotionRepository
{
    /**
     * Prioriteti-winning promotions for this customer (losers omitted).
     *
     * @return list<array<string, mixed>>
     */
    public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array;

    /**
     * True when a basket line still cannot be priced (e.g. gift ActionsT=1).
     *
     * @param  list<array{itemId: string, quantity: string}>  $lines
     */
    public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool;

    /**
     * Apply Prioriteti winners to basket lines (T=2 / T=3).
     *
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return array{
     *     unitPrices: array<string, string>,
     *     unresolvedRules: list<string>,
     *     promotions: list<array<string, mixed>>
     * }
     */
    public function priceBasket(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array;
}
