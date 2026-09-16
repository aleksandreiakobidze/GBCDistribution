<?php

namespace App\Erp\Dto;

final class CustomerRecord
{
    public function __construct(
        public readonly string $customerId,
        public readonly string $name,
        public readonly ?string $orgCode,
        public readonly ?string $address,
        public readonly ?string $phone,
        public readonly ?string $city,
        public readonly int $priceGroup,
        public readonly ?string $sagad,
        public readonly int $idQseli,
        public readonly int $idOrgT,
        public readonly int $idReg,
        public readonly int $idOrgCategory,
        public readonly ?string $latitude,
        public readonly ?string $longitude,
        public readonly bool $useProdList,
        public readonly bool $orgShowPocket,
        public readonly bool $active,
        public readonly ?VisitSchedule $schedule = null,
    ) {
    }

    public function toArray(): array
    {
        return [
            'customerId' => $this->customerId,
            'name' => $this->name,
            'orgCode' => $this->orgCode,
            'address' => $this->address,
            'phone' => $this->phone,
            'city' => $this->city,
            'priceGroup' => $this->priceGroup,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'useProdList' => $this->useProdList,
            'active' => $this->active,
            'schedule' => $this->schedule?->toArray(),
        ];
    }
}
