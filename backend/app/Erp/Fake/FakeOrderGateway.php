<?php

namespace App\Erp\Fake;

use App\Erp\Contracts\OrderGateway;
use App\Erp\Exceptions\ErpException;

final class FakeOrderGateway implements OrderGateway
{
    public function submit(array $header, array $lines): string
    {
        if (FakeErpState::$failNextLineWrite) {
            FakeErpState::$failNextLineWrite = false;
            throw new ErpException('WRITE_FAILED', 'შეკვეთის ჩაწერა ვერ მოხერხდა.', 503);
        }

        $id = (string) FakeErpState::$nextOrderId++;
        FakeErpState::$orders[] = [
            'IdOnlineReal1' => $id,
            'IdOrg' => $header['customerId'],
            'IdGvari' => $header['idGvari'],
            'lines' => $lines,
            'status' => 'received',
        ];

        return $id;
    }

    public function findStatus(int $idGvari, string $erpOrderId): ?array
    {
        foreach (FakeErpState::$orders as $order) {
            if ((string) $order['IdOnlineReal1'] === $erpOrderId && (int) $order['IdGvari'] === $idGvari) {
                return [
                    'erpOrderId' => $erpOrderId,
                    'status' => 'received',
                    'message' => 'შეკვეთა მიღებულია FMG-ში დასამუშავებლად',
                ];
            }
        }

        return null;
    }
}
