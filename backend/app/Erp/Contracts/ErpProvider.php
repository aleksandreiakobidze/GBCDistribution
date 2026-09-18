<?php

namespace App\Erp\Contracts;

interface ErpProvider
{
    public function name(): string;

    public function customers(): CustomerRepository;

    public function products(): ProductRepository;

    public function pricing(): PricingService;

    public function promotions(): PromotionRepository;

    public function orders(): OrderGateway;

    /**
     * @return array{ok: bool, detail?: string}
     */
    public function health(): array;
}
