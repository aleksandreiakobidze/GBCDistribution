<?php

namespace App\Erp\Support;

use App\Erp\Dto\CustomerRecord;

/**
 * Empty filter table (or omitted list) means that dimension matches everyone.
 */
final class PromotionScope
{
    /**
     * @param  array<string, mixed>  $promo
     */
    public static function matches(array $promo, CustomerRecord $customer, \DateTimeInterface $onDate): bool
    {
        if (array_key_exists('Active', $promo) && (int) $promo['Active'] !== 1) {
            return false;
        }

        if ((int) ($promo['IdActionsT'] ?? 0) === -1) {
            return false;
        }

        if (! self::inWindow($promo, $onDate)) {
            return false;
        }

        if (! self::emptyOrHasInt($promo['IdOrgT'] ?? [], $customer->idOrgT)) {
            return false;
        }
        if (! self::emptyOrHasInt($promo['IdQseli'] ?? [], $customer->idQseli)) {
            return false;
        }
        if (! self::emptyOrHasInt($promo['IdReg'] ?? [], $customer->idReg)) {
            return false;
        }
        if (! self::emptyOrHasInt($promo['IdOrgCategory'] ?? [], $customer->idOrgCategory)) {
            return false;
        }
        if (! self::matchesSagad($promo['Sagad'] ?? [], $customer->sagad)) {
            return false;
        }
        if (! self::matchesFg($promo['Fg'] ?? [], $customer->priceGroup)) {
            return false;
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $promo
     */
    public static function inWindow(array $promo, \DateTimeInterface $onDate): bool
    {
        $day = $onDate->format('Y-m-d');
        $from = self::dateOnly($promo['Data'] ?? null);
        $to = self::dateOnly($promo['DataEnd'] ?? null);

        if ($from !== null && $from > $day) {
            return false;
        }
        if ($to !== null && $to < $day) {
            return false;
        }

        return true;
    }

    /**
     * @param  list<mixed>  $values
     */
    public static function emptyOrHasInt(array $values, int $needle): bool
    {
        if ($values === []) {
            return true;
        }

        foreach ($values as $value) {
            if ((int) $value === $needle) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<mixed>  $rows
     */
    public static function matchesSagad(array $rows, ?string $sagad): bool
    {
        if ($rows === []) {
            return true;
        }

        $customerSagad = $sagad ?? '';
        $includes = [];
        foreach ($rows as $row) {
            if (is_array($row)) {
                $value = (string) ($row['Sagad'] ?? '');
                $exclude = (int) ($row['Exclude'] ?? 0) === 1;
            } else {
                $value = (string) $row;
                $exclude = false;
            }

            if ($exclude && $value === $customerSagad) {
                return false;
            }
            if (! $exclude) {
                $includes[] = $value;
            }
        }

        if ($includes === []) {
            return true;
        }

        return in_array($customerSagad, $includes, true);
    }

    /**
     * Compare FG as strings. Do not CAST ActionsFg.Fg to int.
     *
     * @param  list<mixed>  $values
     */
    public static function matchesFg(array $values, int $fg): bool
    {
        if ($values === []) {
            return true;
        }

        $want = (string) $fg;
        foreach ($values as $value) {
            if (trim((string) $value) === $want) {
                return true;
            }
        }

        return false;
    }

    public static function dateOnly(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return substr((string) $value, 0, 10);
    }
}
