<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\PromotionRepository;
use App\Erp\Dto\CustomerRecord;
use App\Erp\Support\PriceGroupMapping;
use App\Erp\Support\PromotionPresenter;
use App\Erp\Support\PromotionPricing;
use App\Erp\Support\PromotionPrioriteti;
use App\Erp\Support\PromotionScope;

final class FakePromotionRepository implements PromotionRepository
{
    public function __construct(private readonly ?PriceGroupMapping $mapping = null)
    {
    }

    public function listIndicative(CustomerRecord $customer, \DateTimeInterface $onDate): array
    {
        $actions = $this->matchedActions($customer, $onDate);
        $winners = PromotionPrioriteti::winnersForDisplay($actions);

        return $this->presentWinners($customer, $winners);
    }

    public function hasUnresolvedEffect(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): bool
    {
        return $this->priceBasket($customer, $lines, $onDate)['unresolvedRules'] !== [];
    }

    public function priceBasket(CustomerRecord $customer, array $lines, \DateTimeInterface $onDate): array
    {
        $actions = $this->matchedActions($customer, $onDate);
        $pricing = new PromotionPricing($this->mapping ?? new PriceGroupMapping);
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
        $actions = [];
        foreach (FakeErpState::$promotions as $promo) {
            if (! PromotionScope::matches($promo, $customer, $onDate)) {
                continue;
            }
            $header = $promo;
            if (! isset($header['Prioriteti'])) {
                $header['Prioriteti'] = 100;
            }
            $actions[] = [
                'header' => $header,
                'products' => $this->productRows($promo, $customer),
            ];
        }

        return $actions;
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $winners
     * @return list<array<string, mixed>>
     */
    private function presentWinners(CustomerRecord $customer, array $winners): array
    {
        $presenter = $this->presenter();
        $out = [];
        foreach ($winners as $winner) {
            $presented = $presenter->present($customer, $winner['header'], $winner['products']);
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
     * @param  array<string, mixed>  $promo
     * @return list<array<string, mixed>>
     */
    private function productRows(array $promo, CustomerRecord $customer): array
    {
        $lines = $promo['products'] ?? [];
        $out = [];
        foreach ($lines as $line) {
            $itemId = (string) ($line['IdProd'] ?? '');
            $prod = $this->findProduct($itemId);
            $fgCol = 'Fasi'.$customer->priceGroup;
            $out[] = [
                'IdProd' => $itemId,
                'Prod' => (string) ($prod['Prod'] ?? $line['Prod'] ?? $itemId),
                'ActionsFasi' => $line['ActionsFasi'] ?? null,
                'Fasi1' => $prod['Fasi1'] ?? null,
                'Fasi59' => $prod['Fasi59'] ?? null,
                'Fasi60' => $prod['Fasi60'] ?? null,
                'FasiFg' => $prod[$fgCol] ?? null,
            ];
        }

        return $out;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findProduct(string $itemId): ?array
    {
        foreach (FakeErpState::$products as $product) {
            if ((string) ($product['IdProd'] ?? '') === $itemId) {
                return $product;
            }
        }

        return null;
    }

    private function presenter(): PromotionPresenter
    {
        return new PromotionPresenter($this->mapping ?? new PriceGroupMapping);
    }
}
