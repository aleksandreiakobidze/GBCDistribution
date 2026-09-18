<?php

namespace App\Erp\Fmg;

use App\Erp\Contracts\OrderGateway;
use App\Erp\Exceptions\ErpException;

final class FmgOrderGateway implements OrderGateway
{
    public function __construct(private readonly FmgConnection $fmg)
    {
    }

    public function submit(array $header, array $lines): string
    {
        if (! config('erp.writes_enabled')) {
            throw new ErpException(
                'WRITES_DISABLED',
                'FMG-ში შეკვეთის ჩაწერა გამორთულია, სანამ სავალდებულო სვეტების mapping არ დადასტურდება.',
                503,
                ['unresolved' => config('erp.fmg.unresolved_header_fields')],
            );
        }

        throw new ErpException(
            'WRITE_MAPPING_UNRESOLVED',
            'OnlineReal1/2 ჩაწერა არ ჩაირთო: IdMdz, Exported/Active და pocket/waybill სენტინელები დაუდგენელია. dummy 0 არ ჩაიწერება.',
            503,
            ['unresolved' => config('erp.fmg.unresolved_header_fields')],
        );
    }

    public function findStatus(int $idGvari, string $erpOrderId): ?array
    {
        try {
            $rows = $this->fmg->connection()->select(
                'SELECT TOP 1 IdOnlineReal1, IdGvari FROM dbo.OnlineReal1 WHERE IdOnlineReal1 = :id AND IdGvari = :gvari',
                ['id' => (int) $erpOrderId, 'gvari' => $idGvari],
            );
        } catch (\Throwable) {
            throw new ErpException('SOURCE_UNAVAILABLE', 'FMG ბაზა ამჟამად მიუწვდომელია.', 503);
        }

        if ($rows === []) {
            return null;
        }

        return [
            'erpOrderId' => (string) ((array) $rows[0])['IdOnlineReal1'],
            'status' => 'received',
            'message' => 'შეკვეთა მიღებულია FMG-ში დასამუშავებლად',
        ];
    }
}
