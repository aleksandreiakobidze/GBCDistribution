<?php

namespace App\Erp\Dto;

final class PageResult
{
    /**
     * @param  list<mixed>  $items
     */
    public function __construct(
        public readonly array $items,
        public readonly bool $hasMore,
        public readonly ?string $nextCursor,
        public readonly ?int $todayTotal = null,
        public readonly ?int $allTotal = null,
    ) {
    }

    public function toArray(): array
    {
        $payload = [
            'items' => array_map(
                fn ($item) => is_object($item) && method_exists($item, 'toArray') ? $item->toArray() : $item,
                $this->items,
            ),
            'hasMore' => $this->hasMore,
            'nextCursor' => $this->nextCursor,
        ];

        if ($this->todayTotal !== null) {
            $payload['todayTotal'] = $this->todayTotal;
            $payload['allTotal'] = $this->allTotal;
        }

        return $payload;
    }
}
