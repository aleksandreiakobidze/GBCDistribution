<?php

namespace App\Erp\Support;

/**
 * Among customer-matching actions that cover the same product and whose quantity
 * window the line satisfies, lower Prioriteti wins. Tie-break: smaller IdActions string.
 *
 * Quantity is part of eligibility, so an action is only a candidate once the line
 * quantity falls inside its window. For display no quantity is known, so each distinct
 * window stays visible as its own tier and Prioriteti only resolves ties within a tier.
 */
final class PromotionPrioriteti
{
    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @return list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>
     */
    public static function winnersForDisplay(array $actions): array
    {
        if ($actions === []) {
            return [];
        }

        $specificIds = self::allSpecificItemIds($actions);
        if ($specificIds === []) {
            $out = [];
            foreach (self::groupByWindow($actions) as $tier) {
                $winner = self::pickMin($tier);
                if ($winner === null) {
                    continue;
                }
                $out[] = [
                    'header' => $winner['header'],
                    'products' => [],
                ];
            }

            return self::sortByPrioriteti($out);
        }

        $byItem = [];
        foreach ($specificIds as $itemId) {
            $covering = [];
            foreach ($actions as $action) {
                if (self::coversItem($action, $itemId)) {
                    $covering[] = $action;
                }
            }

            foreach (self::groupByWindow($covering) as $tier) {
                $winner = self::pickMin($tier);
                if ($winner === null) {
                    continue;
                }
                $actionId = (string) ($winner['header']['IdActions'] ?? '');
                if (! isset($byItem[$actionId])) {
                    $byItem[$actionId] = [
                        'header' => $winner['header'],
                        'products' => [],
                        'seen' => [],
                    ];
                }
                $row = self::productRowFor($winner, $itemId);
                if ($row !== null && ! isset($byItem[$actionId]['seen'][$itemId])) {
                    $byItem[$actionId]['products'][] = $row;
                    $byItem[$actionId]['seen'][$itemId] = true;
                }
            }
        }

        $out = [];
        foreach ($byItem as $entry) {
            unset($entry['seen']);
            $out[] = $entry;
        }

        return self::sortByPrioriteti($out);
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @return array{header: array<string, mixed>, products: list<array<string, mixed>>, product: ?array<string, mixed>}|null
     */
    public static function winnerForItem(array $actions, string $itemId, ?float $qty = null): ?array
    {
        $candidates = [];
        foreach ($actions as $action) {
            if (! self::coversItem($action, $itemId)) {
                continue;
            }
            if ($qty !== null && ! self::qtyEligible($action, $qty)) {
                continue;
            }
            $candidates[] = $action;
        }

        return self::pickMin($candidates);
    }

    /**
     * @param  array{header: array<string, mixed>, products: list<array<string, mixed>>}  $action
     */
    public static function qtyEligible(array $action, float $qty): bool
    {
        $window = PromotionPresenter::qtyWindow($action['header'] ?? []);

        if ($window['min'] > 0 && $qty < $window['min']) {
            return false;
        }

        return $window['max'] === null || $qty <= $window['max'];
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     */
    public static function coversItem(array $action, string $itemId): bool
    {
        $products = $action['products'] ?? [];
        if ($products === []) {
            return true;
        }

        foreach ($products as $row) {
            if ((string) ($row['IdProd'] ?? '') === $itemId) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @return array{header: array<string, mixed>, products: list<array<string, mixed>>}|null
     */
    public static function pickMin(array $actions): ?array
    {
        if ($actions === []) {
            return null;
        }

        usort($actions, function (array $a, array $b): int {
            $pa = (int) ($a['header']['Prioriteti'] ?? 0);
            $pb = (int) ($b['header']['Prioriteti'] ?? 0);
            if ($pa !== $pb) {
                return $pa <=> $pb;
            }

            return strcmp((string) ($a['header']['IdActions'] ?? ''), (string) ($b['header']['IdActions'] ?? ''));
        });

        return $actions[0];
    }

    /**
     * @param  array{header: array<string, mixed>, products: list<array<string, mixed>>}  $action
     * @return array<string, mixed>|null
     */
    public static function productRowFor(array $action, string $itemId): ?array
    {
        foreach ($action['products'] as $row) {
            if ((string) ($row['IdProd'] ?? '') === $itemId) {
                return $row;
            }
        }

        if (($action['products'] ?? []) === []) {
            return ['IdProd' => $itemId, 'Prod' => $itemId];
        }

        return null;
    }

    /**
     * Actions sharing a quantity window compete on Prioriteti; different windows are
     * separate tiers and all survive, since the qualifying quantity is unknown here.
     *
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @return list<list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>>
     */
    private static function groupByWindow(array $actions): array
    {
        $tiers = [];
        foreach ($actions as $action) {
            $window = PromotionPresenter::qtyWindow($action['header'] ?? []);
            $key = $window['min'].':'.($window['max'] ?? '');
            $tiers[$key][] = $action;
        }

        return array_values($tiers);
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $entries
     * @return list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>
     */
    private static function sortByPrioriteti(array $entries): array
    {
        usort($entries, function (array $a, array $b): int {
            $pa = (int) ($a['header']['Prioriteti'] ?? 0);
            $pb = (int) ($b['header']['Prioriteti'] ?? 0);
            if ($pa !== $pb) {
                return $pa <=> $pb;
            }

            return strcmp((string) ($a['header']['IdActions'] ?? ''), (string) ($b['header']['IdActions'] ?? ''));
        });

        return $entries;
    }

    /**
     * @param  list<array{header: array<string, mixed>, products: list<array<string, mixed>>}>  $actions
     * @return list<string>
     */
    private static function allSpecificItemIds(array $actions): array
    {
        $ids = [];
        foreach ($actions as $action) {
            foreach ($action['products'] as $row) {
                $id = (string) ($row['IdProd'] ?? '');
                if ($id !== '') {
                    $ids[$id] = true;
                }
            }
        }

        return array_keys($ids);
    }
}
