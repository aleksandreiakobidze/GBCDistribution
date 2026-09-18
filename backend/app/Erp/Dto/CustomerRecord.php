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
        public readonly ?string $qseli,
        public readonly int $idOrgT,
        public readonly ?string $orgT,
        public readonly int $idReg,
        public readonly int $idOrgCategory,
        public readonly ?string $orgCategory,
        public readonly ?string $latitude,
        public readonly ?string $longitude,
        public readonly bool $useProdList,
        public readonly bool $orgShowPocket,
        public readonly bool $active,
        public readonly ?VisitSchedule $schedule = null,
        /** @var list<KegPocketRecord> */
        public readonly array $kegs = [],
        public readonly ?string $balance = null,
        public readonly bool $canRealHalfComp = false,
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
            'sagad' => $this->sagad,
            'idQseli' => $this->idQseli,
            'qseli' => $this->qseli,
            'idOrgT' => $this->idOrgT,
            'orgT' => $this->orgT,
            'idOrgCategory' => $this->idOrgCategory,
            'orgCategory' => $this->orgCategory,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'useProdList' => $this->useProdList,
            'active' => $this->active,
            'schedule' => $this->schedule?->toArray(),
            'kegs' => array_map(
                static fn (KegPocketRecord $keg) => $keg->toArray(),
                $this->kegs,
            ),
            'balance' => $this->balance,
            'canRealHalfComp' => $this->canRealHalfComp,
        ];
    }
}
