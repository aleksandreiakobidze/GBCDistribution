<?php

namespace App\Erp\Exact;

use App\Erp\Contracts\CustomerRepository;
use App\Erp\Contracts\ErpProvider;
use App\Erp\Contracts\OrderGateway;
use App\Erp\Contracts\PricingService;
use App\Erp\Contracts\ProductRepository;
use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Dto\ItemRecord;
use App\Erp\Dto\PageResult;
use App\Erp\Exceptions\ErpException;

final class ExactErpProvider implements ErpProvider
{
    public function name(): string
    {
        return 'exact';
    }

    public function customers(): CustomerRepository
    {
        return new class implements CustomerRepository
        {
            public function listForPreseller(int $idGvari, ?string $search, ?string $cursor, int $limit): PageResult
            {
                ExactErpProvider::unavailable();
            }

            public function getAuthorized(int $idGvari, string $customerId): CustomerRecord
            {
                ExactErpProvider::unavailable();
            }

            public function isAssigned(int $idGvari, string $customerId): bool
            {
                ExactErpProvider::unavailable();
            }

            public function isPresellerActive(int $idGvari): bool
            {
                ExactErpProvider::unavailable();
            }
        };
    }

    public function products(): ProductRepository
    {
        return new class implements ProductRepository
        {
            public function listForCustomer(int $idGvari, CustomerRecord $customer, ?string $search, ?string $cursor, int $limit): PageResult
            {
                ExactErpProvider::unavailable();
            }

            public function getForCustomer(int $idGvari, CustomerRecord $customer, string $itemId): ItemRecord
            {
                ExactErpProvider::unavailable();
            }
        };
    }

    public function pricing(): PricingService
    {
        return new class implements PricingService
        {
            public function quote(int $idGvari, CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array
            {
                ExactErpProvider::unavailable();
            }
        };
    }

    public function promotions(): PromotionRepository
    {
        return new class implements PromotionRepository
        {
            public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array
            {
                ExactErpProvider::unavailable();
            }

            public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool
            {
                ExactErpProvider::unavailable();
            }
        };
    }

    public function orders(): OrderGateway
    {
        return new class implements OrderGateway
        {
            public function submit(array $header, array $lines): string
            {
                ExactErpProvider::unavailable();
            }

            public function findStatus(int $idGvari, string $erpOrderId): ?array
            {
                ExactErpProvider::unavailable();
            }
        };
    }

    public function health(): array
    {
        return ['ok' => false, 'detail' => 'unimplemented'];
    }

    public static function unavailable(): never
    {
        throw new ErpException(
            'CAPABILITY_UNAVAILABLE',
            'Exact პროვაიდერი ჯერ არ არის განხორციელებული.',
            503,
        );
    }
}
