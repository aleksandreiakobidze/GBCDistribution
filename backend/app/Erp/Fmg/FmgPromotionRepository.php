<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Support\PriceGroupMapping;
use App\Erp\Support\PromotionPresenter;
use App\Erp\Support\PromotionPricing;
use App\Erp\Support\PromotionPrioriteti;

final class FmgPromotionRepository implements PromotionRepository
{
    public function __construct(
        private readonly FmgConnection $fmg,
        private readonly PriceGroupMapping $mapping,
        private readonly PromotionPresenter $presenter,
    ) {
    }

    public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array
    {
        $actions = $this->matchedActions($customer, $onDate);
        $winners = PromotionPrioriteti::winnersForDisplay($actions);

        return $this->presentWinners($customer, $winners);
    }

    public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool
    {
        $priced = $this->priceBasket($customer, $lines, $onDate);

        return $priced['unresolvedRules'] !== [];
    }

    /**
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return array{
     *     unitPrices: array<string, string>,
     *     unresolvedRules: list<string>,
     *     promotions: list<array<string, mixed>>
     * }
     */
    public function priceBasket(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array
    {
        $actions = $this->matchedActions($customer, $onDate);
        $actions = $this->enrichApplyAllForLines($actions, $customer, $lines);
        $pricing = new PromotionPricing($this->mapping);
        $result = $pricing->forBasket($customer, $actions, $lines);

        return [
            'unitPrices' => $result['unitPrices'],
            'unresolvedRules' => $result['unresolvedRules'],
            'promotions' => $this->presentWinners($customer, $result['winners']),
        ];
    }

    /**
     * @return list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>
     */
    private function matchedActions(CustomerRecord $customer, \DateTimeInterface $onDate): array
    {
        $headers = $this->matchingHeaders($customer, $onDate);
        if ($headers === []) {
            return [];
        }

        $ids = [];
        foreach ($headers as $header) {
            $id = (string) ($header['IdActions'] ?? '');
            if ($id !== '') {
                $ids[] = $id;
            }
        }
        $productsByAction = $this->productsFor($ids, $customer);

        $actions = [];
        foreach ($headers as $header) {
            $decoded = $this->decodeHeader($header);
            $id = (string) ($decoded['IdActions'] ?? '');
            $actions[] = [
                'header' => $decoded,
                'products' => $productsByAction[$id] ?? [],
            ];
        }

        return $actions;
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>
     */
    private function enrichApplyAllForLines(array $actions, CustomerRecord $customer, array $lines): array
    {
        $need = [];
        foreach ($actions as $action) {
            if ($action['products'] !== []) {
                continue;
            }
            foreach ($lines as $line) {
                $itemId = (string) ($line['itemId'] ?? '');
                if ($itemId !== '') {
                    $need[$itemId] = true;
                }
            }
        }
        if ($need === []) {
            return $actions;
        }

        $fasi = $this->fasiForItems(array_keys($need), $customer);
        foreach ($actions as $i => $action) {
            if ($action['products'] !== []) {
                continue;
            }
            $rows = [];
            foreach (array_keys($need) as $itemId) {
                $row = $fasi[$itemId] ?? ['IdProd' => $itemId, 'Prod' => $itemId];
                $rows[] = $row;
            }
            $actions[$i]['products'] = $rows;
        }

        return $actions;
    }

    /**
     * @param  list<string>  $itemIds
     * @return array<string, array<string, mixed>>
     */
    private function fasiForItems(array $itemIds, CustomerRecord $customer): array
    {
        if ($itemIds === []) {
            return [];
        }

        $placeholders = [];
        $bindings = [];
        foreach ($itemIds as $i => $id) {
            $key = 'pid'.$i;
            $placeholders[] = ':'.$key;
            $bindings[$key] = $id;
        }
        $in = implode(', ', $placeholders);
        $idProd = FmgNvarchar::col('p.IdProd', 'IdProd');
        $prod = FmgNvarchar::col('p.Prod', 'Prod');
        $fgExpr = $this->mapping->isValid($customer->priceGroup)
            ? $this->mapping->sqlCaseExpression('p', ':fg')
            : 'NULL';
        if ($this->mapping->isValid($customer->priceGroup)) {
            $bindings['fg'] = $customer->priceGroup;
        }

        $sql = <<<SQL
SELECT p.Fasi1, p.Fasi59, p.Fasi60, {$fgExpr} AS FasiFg, {$idProd}, {$prod}
FROM dbo.ProdView AS p
WHERE p.IdProd IN ({$in})
SQL;

        try {
            $rows = $this->fmg->connection()->select($sql, $bindings);
        } catch (\Throwable) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            $r = (array) $row;
            $id = FmgNvarchar::decode($r['IdProd'] ?? '');
            $r['IdProd'] = $id;
            $r['Prod'] = FmgNvarchar::decode($r['Prod'] ?? '');
            $out[$id] = $r;
        }

        return $out;
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $winners
     * @return list<array<string, mixed>>
     */
    private function presentWinners(CustomerRecord $customer, array $winners): array
    {
        $out = [];
        foreach ($winners as $winner) {
            $presented = $this->presenter->present($customer, $winner['header'], $winner['products']);
            if ($presented === null) {
                continue;
            }
            $typeId = (int) ($presented['typeId'] ?? 0);
            if ($typeId === 1) {
                $presented['state'] = 'indicative';
                $presented['reason'] = PromotionPresenter::REASON_UNRESOLVED;
            } else {
                $presented['state'] = 'winner';
                $presented['reason'] = null;
            }
            $presented['prioriteti'] = (int) ($winner['header']['Prioriteti'] ?? 0);
            $out[] = $presented;
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function matchingHeaders(CustomerRecord $customer, \DateTimeInterface $onDate): array
    {
        $actionsCol = FmgNvarchar::col('a.Actions', 'Actions');
        $typeCol = FmgNvarchar::col('a.ActionsT', 'ActionsT');
        $sql = <<<SQL
SELECT TOP 50
    a.IdActions, a.IdActionsT, a.Active, a.Data, a.DataEnd, a.Prioriteti,
    a.ActionsPercent, a.FromStandardFasi, a.ActionsRaod1, a.ActionsRaod2, a.ActionsRaod3,
    {$actionsCol}, {$typeCol}
FROM dbo.ActionsView AS a
WHERE a.Active = 1
  AND a.IdActionsT <> -1
  AND a.Data <= :onDate
  AND (a.DataEnd IS NULL OR a.DataEnd >= :onDate2)
  {$this->emptyOrMatch('dbo.ActionsOrgT', 'IdOrgT', 'idOrgT')}
  {$this->emptyOrMatch('dbo.ActionsQseliView', 'IdQseli', 'idQseli')}
  {$this->emptyOrMatch('dbo.ActionsRegView', 'IdReg', 'idReg')}
  {$this->emptyOrMatch('dbo.ActionsOrgCategory', 'IdOrgCategory', 'idOrgCategory')}
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ActionsSagadView s
      WHERE s.IdActions = a.IdActions AND s.Exclude = 1 AND s.Sagad = :sagad
  )
  AND (
      NOT EXISTS (
          SELECT 1 FROM dbo.ActionsSagadView s
          WHERE s.IdActions = a.IdActions AND s.Exclude = 0
      )
      OR EXISTS (
          SELECT 1 FROM dbo.ActionsSagadView s
          WHERE s.IdActions = a.IdActions AND s.Exclude = 0 AND s.Sagad = :sagad2
      )
  )
  AND (
      NOT EXISTS (SELECT 1 FROM dbo.ActionsFg f WHERE f.IdActions = a.IdActions)
      OR EXISTS (
          SELECT 1 FROM dbo.ActionsFg f
          WHERE f.IdActions = a.IdActions
            AND LTRIM(RTRIM(f.Fg)) = CAST(:fg AS NVARCHAR(20))
      )
  )
ORDER BY a.Prioriteti
SQL;

        try {
            $date = $onDate->format('Y-m-d H:i:s');
            $rows = $this->fmg->connection()->select($sql, [
                'onDate' => $date,
                'onDate2' => $date,
                'idOrgT' => $customer->idOrgT,
                'idQseli' => $customer->idQseli,
                'idReg' => $customer->idReg,
                'idOrgCategory' => $customer->idOrgCategory,
                'sagad' => $customer->sagad ?? '',
                'sagad2' => $customer->sagad ?? '',
                'fg' => $customer->priceGroup,
            ]);
        } catch (\Throwable) {
            return [];
        }

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, list<array<string, mixed>>>
     */
    private function productsFor(array $ids, CustomerRecord $customer): array
    {
        if ($ids === []) {
            return [];
        }

        $placeholders = [];
        $bindings = [];
        foreach ($ids as $i => $id) {
            $key = 'aid'.$i;
            $placeholders[] = ':'.$key;
            $bindings[$key] = $id;
        }

        $in = implode(', ', $placeholders);
        $idProd = FmgNvarchar::col('ap.IdProd', 'IdProd');
        $prod = FmgNvarchar::col('ap.Prod', 'Prod');
        $fgExpr = $this->mapping->isValid($customer->priceGroup)
            ? $this->mapping->sqlCaseExpression('p', ':fg')
            : 'NULL';
        if ($this->mapping->isValid($customer->priceGroup)) {
            $bindings['fg'] = $customer->priceGroup;
        }

        $sql = <<<SQL
SELECT ap.IdActions, ap.ActionsFasi, p.Fasi1, p.Fasi59, p.Fasi60,
    {$fgExpr} AS FasiFg,
    {$idProd}, {$prod}
FROM dbo.ActionsProdView AS ap
LEFT JOIN dbo.ProdView AS p ON p.IdProd = ap.IdProd
WHERE ap.IdActions IN ({$in})
ORDER BY ap.IdActions, ap.IdProd
SQL;

        try {
            $rows = $this->fmg->connection()->select($sql, $bindings);
        } catch (\Throwable) {
            return [];
        }

        $grouped = [];
        foreach ($rows as $row) {
            $r = (array) $row;
            $id = (string) ($r['IdActions'] ?? '');
            $r['IdProd'] = FmgNvarchar::decode($r['IdProd'] ?? '');
            $r['Prod'] = FmgNvarchar::decode($r['Prod'] ?? '');
            $grouped[$id][] = $r;
        }

        return $grouped;
    }

    /**
     * @param  array<string, mixed>  $header
     * @return array<string, mixed>
     */
    private function decodeHeader(array $header): array
    {
        $header['Actions'] = FmgNvarchar::decode($header['Actions'] ?? '');
        $header['ActionsT'] = FmgNvarchar::decode($header['ActionsT'] ?? '');

        return $header;
    }

    private function emptyOrMatch(string $table, string $column, string $binding): string
    {
        return <<<SQL
AND (
  NOT EXISTS (SELECT 1 FROM {$table} t WHERE t.IdActions = a.IdActions)
  OR EXISTS (SELECT 1 FROM {$table} t WHERE t.IdActions = a.IdActions AND t.{$column} = :{$binding})
)
SQL;
    }
}
