<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;

final class FmgPromotionRepository implements PromotionRepository
{
    public function __construct(private readonly FmgConnection $fmg)
    {
    }

    public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array
    {
        $rows = $this->activeRows($onDate);
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'id' => (string) ($row['IdActions'] ?? ''),
                'name' => (string) ($row['ActionsT'] ?? 'promotion'),
                'state' => 'indicative',
                'reason' => 'FMG_PROMOTION_ALGORITHM_UNRESOLVED',
            ];
        }

        return $out;
    }

    public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool
    {
        // Any in-window promotion may affect the basket; combination rules are unverified.
        return $this->activeRows($onDate) !== [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function activeRows(\DateTimeInterface $onDate): array
    {
        $sql = <<<'SQL'
SELECT TOP 50 IdActions, ActionsT, Active, Data, DataEnd, Prioriteti
FROM dbo.ActionsView
WHERE Active = 1
  AND Data <= :onDate
  AND (DataEnd IS NULL OR DataEnd >= :onDate2)
ORDER BY Prioriteti
SQL;

        try {
            $date = $onDate->format('Y-m-d H:i:s');
            $rows = $this->fmg->connection()->select($sql, [
                'onDate' => $date,
                'onDate2' => $date,
            ]);
        } catch (\Throwable) {
            return [];
        }

        return array_map(fn ($row) => (array) $row, $rows);
    }
}
