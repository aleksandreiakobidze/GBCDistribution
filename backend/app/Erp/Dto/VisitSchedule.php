<?php

namespace App\Erp\Dto;

final class VisitSchedule
{
    public function __construct(
        public readonly bool $mon,
        public readonly bool $tue,
        public readonly bool $wed,
        public readonly bool $thu,
        public readonly bool $fri,
        public readonly bool $sat,
        public readonly bool $sun,
        public readonly int $monNum,
        public readonly int $tueNum,
        public readonly int $wedNum,
        public readonly int $thuNum,
        public readonly int $friNum,
        public readonly int $satNum,
        public readonly int $sunNum,
    ) {
    }

    public function toArray(): array
    {
        return [
            'mon' => $this->mon,
            'tue' => $this->tue,
            'wed' => $this->wed,
            'thu' => $this->thu,
            'fri' => $this->fri,
            'sat' => $this->sat,
            'sun' => $this->sun,
            'monNum' => $this->monNum,
            'tueNum' => $this->tueNum,
            'wedNum' => $this->wedNum,
            'thuNum' => $this->thuNum,
            'friNum' => $this->friNum,
            'satNum' => $this->satNum,
            'sunNum' => $this->sunNum,
        ];
    }
}
