<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;

final class FakePromotionRepository implements PromotionRepository
{
    public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array
    {
        $out = [];
        foreach (FakeErpState::$promotions as $promo) {
            $out[] = [
                'id' => (string) ($promo['IdActions'] ?? ''),
                'name' => (string) ($promo['ActionsT'] ?? 'promotion'),
                'state' => 'indicative',
                'reason' => 'FMG_PROMOTION_ALGORITHM_UNRESOLVED',
            ];
        }

        return $out;
    }

    public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool
    {
        return count(FakeErpState::$promotions) > 0;
    }
}
