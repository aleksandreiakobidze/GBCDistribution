<?php

namespace App\Erp\Support;

final class PriceGroupMapping
{
    public function __construct(
        private readonly int $min = 1,
        private readonly int $max = 60,
    ) {
    }

    public static function fromConfig(): self
    {
        return new self(
            (int) config('erp.price_group.min', 1),
            (int) config('erp.price_group.max', 60),
        );
    }

    public function isValid(int $fg): bool
    {
        return $fg >= $this->min && $fg <= $this->max;
    }

    public function columnFor(int $fg): string
    {
        if (! $this->isValid($fg)) {
            throw new \InvalidArgumentException('Unmapped price group');
        }

        return 'Fasi'.$fg;
    }

    /**
     * Bound CASE mapping so FG never becomes a SQL identifier.
     */
    public function sqlCaseExpression(string $alias, string $placeholder = '?'): string
    {
        $parts = [];
        for ($i = $this->min; $i <= $this->max; $i++) {
            $parts[] = "WHEN {$i} THEN {$alias}.Fasi{$i}";
        }

        return '(CASE '.$placeholder.' '.implode(' ', $parts).' ELSE NULL END)';
    }

    /**
     * @param  array<string, mixed>  $product
     */
    public function unitPriceFromProduct(array $product, int $fg): string
    {
        $column = $this->columnFor($fg);
        if (! array_key_exists($column, $product) || $product[$column] === null || $product[$column] === '') {
            throw new \InvalidArgumentException('NULL price');
        }

        return Decimal::normalize((string) $product[$column], 4);
    }
}
