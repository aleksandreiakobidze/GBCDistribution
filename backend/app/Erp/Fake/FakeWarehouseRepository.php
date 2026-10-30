<?php

namespace App\Erp\Fake;

final class FakeWarehouseRepository
{
    /**
     * @return list<array{id: string, name: string}>
     */
    public static function listForGvari(int $idGvari): array
    {
        $items = [];
        foreach (FakeErpState::$warehouses as $row) {
            if ((int) ($row['IdGvari'] ?? 0) !== $idGvari) {
                continue;
            }
            $id = (string) ($row['IdSac'] ?? '');
            if ($id === '') {
                continue;
            }
            $name = (string) ($row['Sac'] ?? $id);
            $items[] = ['id' => $id, 'name' => $name];
        }

        return $items;
    }
}
