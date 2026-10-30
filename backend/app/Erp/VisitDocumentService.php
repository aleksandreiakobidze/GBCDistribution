<?php

namespace App\Erp;

use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\Decimal;
use App\Models\ErpCollection;
use App\Models\ErpProductReturn;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class VisitDocumentService
{
    /** @var list<string> */
    public const RETURN_REASONS = ['damaged', 'expired', 'wrong_item', 'other'];

    public function __construct(
        private readonly ErpProvider $erp,
        private readonly WarehouseCatalog $warehouses,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listCollections(User $user, int $idGvari, ?string $customerId = null): array
    {
        $query = ErpCollection::query()
            ->where('user_id', $user->id)
            ->where('id_gvari', $idGvari);

        if ($customerId !== null && $customerId !== '') {
            $this->erp->customers()->getAuthorized($idGvari, $customerId);
            $query->where('customer_id', $customerId);
        }

        return $query
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (ErpCollection $row) => $this->presentCollection($idGvari, $row))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function getCollection(User $user, int $idGvari, int $id): array
    {
        $row = ErpCollection::query()
            ->where('user_id', $user->id)
            ->where('id_gvari', $idGvari)
            ->where('id', $id)
            ->first();

        if (! $row) {
            throw new ErpException('COLLECTION_NOT_FOUND', 'აღება ვერ მოიძებნა.', 404);
        }

        return $this->presentCollection($idGvari, $row);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentCollection(int $idGvari, ErpCollection $row): array
    {
        $arr = $row->toApiArray();
        if (($arr['customerName'] ?? null) === null || $arr['customerName'] === '') {
            try {
                $arr['customerName'] = $this->erp->customers()->getAuthorized($idGvari, (string) $row->customer_id)->name;
            } catch (ErpException) {
            }
        }

        return $arr;
    }

    /**
     * @param  array{customerId: string, amount: string, method?: string, note?: string|null}  $input
     * @return array<string, mixed>
     */
    public function collect(User $user, int $idGvari, array $input): array
    {
        $customerId = (string) $input['customerId'];
        $customer = $this->erp->customers()->getAuthorized($idGvari, $customerId);

        try {
            $amount = Decimal::normalize((string) $input['amount'], 2);
        } catch (\InvalidArgumentException) {
            throw new ErpException('INVALID_AMOUNT', 'თანხა არასწორია.', 422);
        }

        if (bccomp($amount, '0', 2) !== 1) {
            throw new ErpException('INVALID_AMOUNT', 'თანხა უნდა იყოს დადებითი.', 422);
        }

        $method = (string) ($input['method'] ?? 'cash');
        if ($method !== 'cash') {
            throw new ErpException('INVALID_METHOD', 'მხოლოდ ნაღდი ანგარიშსწორებაა დაშვებული.', 422);
        }

        $note = isset($input['note']) ? trim((string) $input['note']) : null;
        if ($note === '') {
            $note = null;
        }
        if ($note !== null && mb_strlen($note) > 300) {
            throw new ErpException('NOTE_TOO_LONG', 'შენიშვნა ძალიან გრძელია.', 422);
        }

        $row = ErpCollection::query()->create([
            'user_id' => $user->id,
            'id_gvari' => $idGvari,
            'customer_id' => $customerId,
            'customer_name' => $customer->name,
            'amount' => $amount,
            'method' => $method,
            'note' => $note,
        ]);

        return $row->toApiArray();
    }

    /**
     * @param  array{amount?: string, method?: string, note?: string|null}  $input
     * @return array<string, mixed>
     */
    public function updateCollection(User $user, int $idGvari, int $id, array $input): array
    {
        $row = ErpCollection::query()
            ->where('user_id', $user->id)
            ->where('id_gvari', $idGvari)
            ->where('id', $id)
            ->first();

        if (! $row) {
            throw new ErpException('COLLECTION_NOT_FOUND', 'აღება ვერ მოიძებნა.', 404);
        }

        $amount = $row->amount;
        if (array_key_exists('amount', $input) && $input['amount'] !== null && $input['amount'] !== '') {
            try {
                $amount = Decimal::normalize((string) $input['amount'], 2);
            } catch (\InvalidArgumentException) {
                throw new ErpException('INVALID_AMOUNT', 'თანხა არასწორია.', 422);
            }
            if (bccomp($amount, '0', 2) !== 1) {
                throw new ErpException('INVALID_AMOUNT', 'თანხა უნდა იყოს დადებითი.', 422);
            }
        }

        $method = (string) ($input['method'] ?? $row->method ?: 'cash');
        if ($method !== 'cash') {
            throw new ErpException('INVALID_METHOD', 'მხოლოდ ნაღდი ანგარიშსწორებაა დაშვებული.', 422);
        }

        $note = $row->note;
        if (array_key_exists('note', $input)) {
            $note = $input['note'] === null ? null : trim((string) $input['note']);
            if ($note === '') {
                $note = null;
            }
            if ($note !== null && mb_strlen($note) > 300) {
                throw new ErpException('NOTE_TOO_LONG', 'შენიშვნა ძალიან გრძელია.', 422);
            }
        }

        $row->update([
            'amount' => $amount,
            'method' => $method,
            'note' => $note,
        ]);

        return $this->presentCollection($idGvari, $row->fresh() ?? $row);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listReturns(User $user, int $idGvari, ?string $customerId = null): array
    {
        $query = ErpProductReturn::query()
            ->with('lines')
            ->where('user_id', $user->id)
            ->where('id_gvari', $idGvari);

        if ($customerId !== null && $customerId !== '') {
            $this->erp->customers()->getAuthorized($idGvari, $customerId);
            $query->where('customer_id', $customerId);
        }

        return $query
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (ErpProductReturn $row) => $this->presentReturn($idGvari, $row))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function getReturn(User $user, int $idGvari, int $id): array
    {
        $row = ErpProductReturn::query()
            ->with('lines')
            ->where('user_id', $user->id)
            ->where('id_gvari', $idGvari)
            ->where('id', $id)
            ->first();

        if (! $row) {
            throw new ErpException('RETURN_NOT_FOUND', 'დაბრუნება ვერ მოიძებნა.', 404);
        }

        return $this->presentReturn($idGvari, $row);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentReturn(int $idGvari, ErpProductReturn $row): array
    {
        $arr = $row->toApiArray();
        if (($arr['customerName'] ?? null) === null || $arr['customerName'] === '') {
            try {
                $arr['customerName'] = $this->erp->customers()->getAuthorized($idGvari, (string) $row->customer_id)->name;
            } catch (ErpException) {
            }
        }

        return $arr;
    }

    /**
     * @param  array{customerId: string, warehouseId: string, note?: string|null, lines: list<array{itemId: string, quantity: string, reason: string}>}  $input
     * @return array<string, mixed>
     */
    public function createReturn(User $user, int $idGvari, array $input): array
    {
        $customerId = (string) $input['customerId'];
        $customer = $this->erp->customers()->getAuthorized($idGvari, $customerId);
        $warehouse = $this->resolveWarehouse($idGvari, (string) ($input['warehouseId'] ?? ''));

        $lines = $input['lines'] ?? [];
        if ($lines === []) {
            throw new ErpException('ITEMS_REQUIRED', 'დაამატეთ მინიმუმ ერთი პროდუქტი.', 422);
        }

        $note = isset($input['note']) ? trim((string) $input['note']) : null;
        if ($note === '') {
            $note = null;
        }
        if ($note !== null && mb_strlen($note) > 300) {
            throw new ErpException('NOTE_TOO_LONG', 'შენიშვნა ძალიან გრძელია.', 422);
        }

        $prepared = $this->prepareReturnLines($lines);

        $return = DB::transaction(function () use ($user, $idGvari, $customer, $customerId, $warehouse, $note, $prepared) {
            $header = ErpProductReturn::query()->create([
                'user_id' => $user->id,
                'id_gvari' => $idGvari,
                'customer_id' => $customerId,
                'customer_name' => $customer->name,
                'warehouse_id' => $warehouse['id'],
                'warehouse_name' => $warehouse['name'],
                'note' => $note,
            ]);
            foreach ($prepared as $line) {
                $header->lines()->create($line);
            }

            return $header->load('lines');
        });

        return $return->toApiArray();
    }

    /**
     * @param  array{customerId?: string, warehouseId?: string, note?: string|null, lines: list<array{itemId: string, quantity: string, reason: string}>}  $input
     * @return array<string, mixed>
     */
    public function updateReturn(User $user, int $idGvari, int $id, array $input): array
    {
        $header = ErpProductReturn::query()
            ->where('user_id', $user->id)
            ->where('id_gvari', $idGvari)
            ->where('id', $id)
            ->first();

        if (! $header) {
            throw new ErpException('RETURN_NOT_FOUND', 'დაბრუნება ვერ მოიძებნა.', 404);
        }

        $customerId = (string) ($input['customerId'] ?? $header->customer_id);
        $customer = $this->erp->customers()->getAuthorized($idGvari, $customerId);
        $warehouseId = array_key_exists('warehouseId', $input)
            ? (string) ($input['warehouseId'] ?? '')
            : (string) ($header->warehouse_id ?? '');
        $warehouse = $this->resolveWarehouse($idGvari, $warehouseId);

        $lines = $input['lines'] ?? [];
        if ($lines === []) {
            throw new ErpException('ITEMS_REQUIRED', 'დაამატეთ მინიმუმ ერთი პროდუქტი.', 422);
        }

        $note = array_key_exists('note', $input)
            ? trim((string) ($input['note'] ?? ''))
            : (string) ($header->note ?? '');
        if ($note === '') {
            $note = null;
        }
        if ($note !== null && mb_strlen($note) > 300) {
            throw new ErpException('NOTE_TOO_LONG', 'შენიშვნა ძალიან გრძელია.', 422);
        }

        $prepared = $this->prepareReturnLines($lines);

        $return = DB::transaction(function () use ($header, $customer, $customerId, $warehouse, $note, $prepared) {
            $header->update([
                'customer_id' => $customerId,
                'customer_name' => $customer->name,
                'warehouse_id' => $warehouse['id'],
                'warehouse_name' => $warehouse['name'],
                'note' => $note,
            ]);
            $header->lines()->delete();
            foreach ($prepared as $line) {
                $header->lines()->create($line);
            }

            return $header->load('lines');
        });

        return $this->presentReturn($idGvari, $return);
    }

    /**
     * @return array{id: string, name: string}
     */
    private function resolveWarehouse(int $idGvari, string $warehouseId): array
    {
        $warehouseId = trim($warehouseId);
        if ($warehouseId === '') {
            throw new ErpException('WAREHOUSE_REQUIRED', 'აირჩიეთ საწყობი.', 422);
        }

        $warehouse = $this->warehouses->findForGvari($idGvari, $warehouseId);
        if ($warehouse === null) {
            throw new ErpException('WAREHOUSE_INVALID', 'საწყობი ვერ მოიძებნა.', 422);
        }

        return $warehouse;
    }

    /**
     * @param  list<array{itemId?: string, quantity?: mixed, reason?: string}>  $lines
     * @return list<array{item_id: string, item_name: string, quantity: string, reason: string}>
     */
    private function prepareReturnLines(array $lines): array
    {
        $prepared = [];
        foreach ($lines as $line) {
            $itemId = (string) ($line['itemId'] ?? '');
            $reason = (string) ($line['reason'] ?? '');
            if ($itemId === '') {
                throw new ErpException('INVALID_ITEM', 'პროდუქტის იდენტიფიკატორი აუცილებელია.', 400);
            }
            if (! in_array($reason, self::RETURN_REASONS, true)) {
                throw new ErpException('INVALID_REASON', 'დაბრუნების მიზეზი არასწორია.', 422);
            }

            try {
                $qty = Decimal::assertRaod((string) ($line['quantity'] ?? ''));
            } catch (\InvalidArgumentException) {
                throw new ErpException('INVALID_QUANTITY', 'რაოდენობა არასწორია ან სცდება FMG Raod ზღვარს.', 422, ['itemId' => $itemId]);
            }
            if (bccomp($qty, '0', 4) !== 1) {
                throw new ErpException('INVALID_QUANTITY', 'რაოდენობა უნდა იყოს დადებითი.', 422, ['itemId' => $itemId]);
            }

            $item = $this->erp->products()->getCatalogItem($itemId);
            $prepared[] = [
                'item_id' => $item->itemId,
                'item_name' => $item->name,
                'quantity' => $qty,
                'reason' => $reason,
            ];
        }

        return $prepared;
    }
}
