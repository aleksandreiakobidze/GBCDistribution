<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\CustomerRepository;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Contracts\OrderGateway;
use App\Erp\Contracts\PricingService;
use App\Erp\Contracts\ProductRepository;
use App\Erp\Contracts\PromotionRepository;
use App\Erp\Support\PriceGroupMapping;

final class FakeErpProvider implements ErpProvider
{
    public function __construct(
        private readonly FakeCustomerRepository $customers,
        private readonly FakeProductRepository $products,
        private readonly FakePricingService $pricing,
        private readonly FakePromotionRepository $promotions,
        private readonly FakeOrderGateway $orders,
    ) {
    }

    public static function make(): self
    {
        $mapping = PriceGroupMapping::fromConfig();
        $customers = new FakeCustomerRepository;
        $products = new FakeProductRepository($mapping);
        $promotions = new FakePromotionRepository;
        $pricing = new FakePricingService($products, $promotions);

        return new self($customers, $products, $pricing, $promotions, new FakeOrderGateway);
    }

    public function name(): string
    {
        return 'fake';
    }

    public function customers(): CustomerRepository
    {
        return $this->customers;
    }

    public function products(): ProductRepository
    {
        return $this->products;
    }

    public function pricing(): PricingService
    {
        return $this->pricing;
    }

    public function promotions(): PromotionRepository
    {
        return $this->promotions;
    }

    public function orders(): OrderGateway
    {
        return $this->orders;
    }

    public function health(): array
    {
        return ['ok' => true, 'detail' => 'fake'];
    }
}
