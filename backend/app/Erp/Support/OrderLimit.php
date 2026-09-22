<?php

namespace App\Erp\Support;

/**
 * SagadValiBlockView.MinReal / MaxReal are int columns where 0 means the
 * customer has no limit on that side. Missing rows mean no limit either.
 */
final class OrderLimit
{
    public static function normalize(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            $normalized = Decimal::normalize((string) $value, 2);
        } catch (\InvalidArgumentException) {
            return null;
        }

        if (Decimal::compare($normalized, '0', 2) <= 0) {
            return null;
        }

        return $normalized;
    }
}
