<?php

namespace App\Erp\Dto;

final class KegPocketRecord
{
    public function __construct(
        public readonly string $itemId,
        public readonly string $name,
        public readonly string $quantity,
    ) {
    }

    /**
     * @return array{itemId: string, name: string, quantity: string}
     */
    public function toArray(): array
    {
        return [
            'itemId' => $this->itemId,
            'name' => $this->name,
            'quantity' => $this->quantity,
        ];
    }
}
