<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\PricingService;
use App\Erp\Contracts\ProductRepository;
use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Support\QuoteLines;

final class FakePricingService implements PricingService
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly PromotionRepository $promotions,
    ) {
    }

    public function quote(int $idGvari, CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array
    {
        return QuoteLines::price($this->products, $this->promotions, $idGvari, $customer, $lines, $onDate);
    }
}
