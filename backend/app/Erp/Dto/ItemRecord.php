<?php

namespace App\Erp\Dto;

final class ItemRecord
{
    public function __construct(
        public readonly string $itemId,
        public readonly string $name,
        public readonly string $unit,
        public readonly ?string $unitName,
        public readonly ?string $prodCode,
        public readonly ?string $category,
        public readonly ?string $prodS,
        public readonly ?string $type,
        public readonly ?string $group,
        public readonly ?string $unitPrice,
        public readonly ?string $priceState,
        public readonly ?string $priceError,
        public readonly bool $active,
        public readonly bool $showInPocket,
        public readonly ?string $compRaod = null,
        public readonly ?bool $canRealHalfComp = null,
    ) {
    }

    public function toArray(): array
    {
        return [
            'itemId' => $this->itemId,
            'name' => $this->name,
            'unit' => $this->unit,
            'unitName' => $this->unitName,
            'prodCode' => $this->prodCode,
            'category' => $this->category,
            'prodS' => $this->prodS,
            'type' => $this->type,
            'group' => $this->group,
            'unitPrice' => $this->unitPrice,
            'priceState' => $this->priceState,
            'priceError' => $this->priceError,
            'active' => $this->active,
            'compRaod' => $this->compRaod,
            'canRealHalfComp' => $this->canRealHalfComp,
        ];
    }
}
