<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\CustomerRepository;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Contracts\OrderGateway;
use App\Erp\Contracts\PricingService;
use App\Erp\Contracts\ProductRepository;
use App\Erp\Contracts\PromotionRepository;
use App\Erp\DefaultPricingService;
use App\Erp\Support\PriceGroupMapping;

final class FmgErpProvider implements ErpProvider
{
    public function __construct(
        private readonly FmgCustomerRepository $customers,
        private readonly FmgProductRepository $products,
        private readonly DefaultPricingService $pricing,
        private readonly FmgPromotionRepository $promotions,
        private readonly FmgOrderGateway $orders,
        private readonly FmgConnection $connection,
    ) {
    }

    public static function make(): self
    {
        $connection = new FmgConnection;
        $mapping = PriceGroupMapping::fromConfig();
        $customers = new FmgCustomerRepository($connection);
        $products = new FmgProductRepository($connection, $mapping);
        $promotions = new FmgPromotionRepository($connection);
        $pricing = new DefaultPricingService($products, $promotions);
        $orders = new FmgOrderGateway($connection);

        return new self($customers, $products, $pricing, $promotions, $orders, $connection);
    }

    public function name(): string
    {
        return 'fmg';
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
        if (! $this->connection->configured()) {
            return ['ok' => false, 'detail' => 'unconfigured'];
        }

        return ['ok' => $this->connection->ping(), 'detail' => 'fmg'];
    }
}
