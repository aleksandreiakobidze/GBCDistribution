<?php

namespace App\Erp\Fmg;

final class FmgWarehouseRepository
{
    public function __construct(private readonly FmgConnection $fmg)
    {
    }

    /**
     * Warehouses (Sac) linked to the salesperson in dbo.GvariSacView.
     *
     * @return list<array{id: string, name: string}>
     */
    public function listForGvari(int $idGvari): array
    {
        $sql = 'SELECT gs.IdSac, '.FmgNvarchar::col('gs.Sac', 'Sac')
            .' FROM dbo.GvariSacView AS gs'
            .' WHERE gs.IdGvari = :idGvari'
            .' ORDER BY gs.IdSac';

        $rows = $this->fmg->connection()->select($sql, ['idGvari' => $idGvari]);

        $items = [];
        $seen = [];
        foreach ($rows as $row) {
            $id = (string) ($row->IdSac ?? '');
            if ($id === '' || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $name = FmgNvarchar::decode($row->Sac ?? null);
            $items[] = [
                'id' => $id,
                'name' => $name !== '' ? $name : $id,
            ];
        }

        return $items;
    }
}
