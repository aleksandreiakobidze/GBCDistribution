<?php

namespace App\Erp;

use App\Erp\Fake\FakeWarehouseRepository;
use App\Erp\Fmg\FmgConnection;
use App\Erp\Fmg\FmgWarehouseRepository;

final class WarehouseCatalog
{
    /**
     * @return list<array{id: string, name: string}>
     */
    public function listForGvari(int $idGvari): array
    {
        return match ((string) config('erp.provider', 'fmg')) {
            'fmg' => (new FmgWarehouseRepository(new FmgConnection))->listForGvari($idGvari),
            'fake' => FakeWarehouseRepository::listForGvari($idGvari),
            default => [],
        };
    }

    /**
     * @return array{id: string, name: string}|null
     */
    public function findForGvari(int $idGvari, string $warehouseId): ?array
    {
        foreach ($this->listForGvari($idGvari) as $item) {
            if ($item['id'] === $warehouseId) {
                return $item;
            }
        }

        return null;
    }
}
