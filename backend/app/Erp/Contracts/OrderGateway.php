<?php

namespace App\Erp\Contracts;

interface OrderGateway
{
    /**
     * @param  array<string, mixed>  $header
     * @param  list<array<string, mixed>>  $lines
     */
    public function submit(array $header, array $lines): string;

    /**
     * @return array{erpOrderId: string, status: string, message: string}|null
     */
    public function findStatus(int $idGvari, string $erpOrderId): ?array;
}
