<?php

namespace App\Erp;

use App\Erp\Contracts\ErpProvider;
use App\Erp\Exceptions\ErpException;
use App\Erp\Support\Decimal;
use App\Models\ErpOrderReceipt;
use App\Models\ErpQuote;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OrderApplicationService
{
    public function __construct(private readonly ErpProvider $erp)
    {
    }

    /**
     * @param  list<array{itemId: string, quantity: string}>  $lines
     * @return array<string, mixed>
     */
    public function quote(User $user, string $customerId, array $lines): array
    {
        $idGvari = $this->idGvari($user);
        $onDate = now(config('erp.timezone'));
        $customer = $this->erp->customers()->getAuthorized($idGvari, $customerId);
        $priced = $this->erp->pricing()->quote($idGvari, $customer, $this->normalizeLines($lines), $onDate);

        $payloadHash = $this->lineHash($customerId, $priced['lines']);
        $quoteId = (string) Str::uuid();
        $ttl = (int) config('erp.quote_ttl_minutes', 30);

        ErpQuote::query()->create([
            'quote_id' => $quoteId,
            'user_id' => $user->id,
            'customer_id' => $customerId,
            'payload_hash' => $payloadHash,
            'quote_json' => $priced,
            'expires_at' => now()->addMinutes($ttl),
        ]);

        return array_merge($priced, [
            'quoteId' => $quoteId,
            'customerId' => $customerId,
            'expiresAt' => now()->addMinutes($ttl)->toIso8601String(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function submit(User $user, array $input): array
    {
        $idGvari = $this->idGvari($user);
        $externalId = (string) $input['externalId'];
        $customerId = (string) $input['customerId'];
        $quoteId = (string) $input['quoteId'];
        $lines = $this->normalizeLines($input['lines'] ?? []);
        $payloadHash = $this->requestHash($input);

        $existing = ErpOrderReceipt::query()
            ->where('provider', $this->erp->name())
            ->where('company', config('erp.company'))
            ->where('user_id', $user->id)
            ->where('external_id', $externalId)
            ->first();

        if ($existing) {
            if ($existing->payload_hash !== $payloadHash) {
                throw new ErpException(
                    'IDEMPOTENCY_CONFLICT',
                    'იგივე შეკვეთის იდენტიფიკატორი სხვა შიგთავსით უკვე არსებობს.',
                    409,
                );
            }

            return $existing->result_json ?? [
                'externalId' => $externalId,
                'erpOrderId' => $existing->erp_order_id,
                'status' => $existing->status,
                'message' => 'შეკვეთა მიღებულია FMG-ში დასამუშავებლად',
            ];
        }

        $quote = ErpQuote::query()
            ->where('quote_id', $quoteId)
            ->where('user_id', $user->id)
            ->first();

        if (! $quote || $quote->expires_at->isPast()) {
            throw new ErpException('QUOTE_EXPIRED', 'ფასების შეთავაზება ვადაგასულია. განაახლეთ quote.', 409);
        }

        $this->erp->customers()->getAuthorized($idGvari, $customerId);
        if (! $this->erp->customers()->isAssigned($idGvari, $customerId)) {
            throw new ErpException('CUSTOMER_NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა.', 404);
        }

        $fresh = $this->quote($user, $customerId, $lines);

        if (($quote->quote_json['total'] ?? null) !== $fresh['total']
            || ! $this->linesMatch($quote->quote_json['lines'] ?? [], $fresh['lines'])) {
            throw new ErpException(
                'PRICE_CHANGED',
                'ფასი შეიცვალა. დაადასტურეთ ახალი შეთავაზება.',
                409,
                ['quote' => $fresh],
            );
        }

        if (($fresh['unresolvedRules'] ?? []) !== []) {
            throw new ErpException(
                'PRICING_RULE_UNRESOLVED',
                'შეკვეთა ვერ გაიგზავნება: FMG პრომო/ფასის წესი დაუდგენელია.',
                422,
                ['unresolvedRules' => $fresh['unresolvedRules']],
            );
        }

        if ($this->erp->name() !== 'fake' && ! config('erp.writes_enabled')) {
            throw new ErpException(
                'WRITES_DISABLED',
                'FMG-ში შეკვეთის ჩაწერა გამორთულია, სანამ სავალდებულო სვეტების mapping არ დადასტურდება.',
                503,
            );
        }

        $maxLines = (int) config('erp.order.max_lines', 200);
        if (count($lines) > $maxLines) {
            throw new ErpException('TOO_MANY_LINES', 'ხაზების რაოდენობა სცდება დასაშვებ ზღვარს.', 422);
        }

        $note = isset($input['note']) ? (string) $input['note'] : null;
        if ($note !== null && mb_strlen($note) > (int) config('erp.order.note_max_length', 300)) {
            throw new ErpException('NOTE_TOO_LONG', 'შენიშვნა ძალიან გრძელია.', 422);
        }

        try {
            return DB::transaction(function () use ($user, $idGvari, $externalId, $customerId, $quoteId, $payloadHash, $fresh, $note, $input) {
                $receipt = ErpOrderReceipt::query()->create([
                    'provider' => $this->erp->name(),
                    'company' => config('erp.company'),
                    'user_id' => $user->id,
                    'external_id' => $externalId,
                    'payload_hash' => $payloadHash,
                    'customer_id' => $customerId,
                    'id_gvari' => $idGvari,
                    'quote_id' => $quoteId,
                    'status' => 'pending',
                ]);

                $erpOrderId = $this->erp->orders()->submit(
                    [
                        'customerId' => $customerId,
                        'idGvari' => $idGvari,
                        'note' => $note,
                        'location' => $input['location'] ?? null,
                        'externalId' => $externalId,
                    ],
                    $fresh['lines'],
                );

                $result = [
                    'externalId' => $externalId,
                    'erpOrderId' => $erpOrderId,
                    'status' => 'received',
                    'message' => 'შეკვეთა მიღებულია FMG-ში დასამუშავებლად',
                ];

                $receipt->update([
                    'erp_order_id' => $erpOrderId,
                    'status' => 'received',
                    'result_json' => $result,
                ]);

                return $result;
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if (! str_contains(strtolower($e->getMessage()), 'unique')) {
                throw $e;
            }

            $replay = ErpOrderReceipt::query()
                ->where('provider', $this->erp->name())
                ->where('company', config('erp.company'))
                ->where('user_id', $user->id)
                ->where('external_id', $externalId)
                ->first();

            if ($replay && $replay->payload_hash === $payloadHash) {
                return $replay->result_json ?? [
                    'externalId' => $externalId,
                    'erpOrderId' => $replay->erp_order_id,
                    'status' => $replay->status,
                    'message' => 'შეკვეთა მიღებულია FMG-ში დასამუშავებლად',
                ];
            }

            throw new ErpException(
                'IDEMPOTENCY_CONFLICT',
                'იგივე შეკვეთის იდენტიფიკატორი სხვა შიგთავსით უკვე არსებობს.',
                409,
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function status(User $user, string $erpOrderId): array
    {
        $idGvari = $this->idGvari($user);

        $local = ErpOrderReceipt::query()
            ->where('user_id', $user->id)
            ->where('erp_order_id', $erpOrderId)
            ->first();

        if ($local) {
            return [
                'erpOrderId' => $erpOrderId,
                'status' => $local->status === 'received' ? 'received' : $local->status,
                'message' => 'შეკვეთა მიღებულია FMG-ში დასამუშავებლად',
            ];
        }

        $remote = $this->erp->orders()->findStatus($idGvari, $erpOrderId);
        if (! $remote) {
            throw new ErpException('ORDER_NOT_FOUND', 'შეკვეთა ვერ მოიძებნა.', 404);
        }

        return $remote;
    }

    private function idGvari(User $user): int
    {
        if ($user->id_gvari === null) {
            throw new ErpException('UNMAPPED_PRESELLER', 'თქვენი ანგარიში არ არის მიბმული პრისელერზე.', 403);
        }

        return (int) $user->id_gvari;
    }

    /**
     * @param  list<array{itemId?: string, quantity?: string}>  $lines
     * @return list<array{itemId: string, quantity: string}>
     */
    private function normalizeLines(array $lines): array
    {
        $out = [];
        foreach ($lines as $line) {
            $itemId = (string) ($line['itemId'] ?? '');
            if ($itemId === '') {
                throw new ErpException('INVALID_ITEM', 'პროდუქტის იდენტიფიკატორი აუცილებელია.', 400);
            }
            $out[] = [
                'itemId' => $itemId,
                'quantity' => (string) ($line['quantity'] ?? ''),
            ];
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $pricedLines
     */
    private function lineHash(string $customerId, array $pricedLines): string
    {
        $canonical = [
            'customerId' => $customerId,
            'lines' => array_map(fn ($l) => [
                'itemId' => $l['itemId'],
                'quantity' => Decimal::normalize((string) $l['quantity'], 4),
                'unitPrice' => Decimal::normalize((string) $l['unitPrice'], 4),
            ], $pricedLines),
        ];

        return hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE));
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function requestHash(array $input): string
    {
        $canonical = [
            'customerId' => (string) $input['customerId'],
            'quoteId' => (string) $input['quoteId'],
            'note' => $input['note'] ?? null,
            'location' => $input['location'] ?? null,
            'lines' => $this->normalizeLines($input['lines'] ?? []),
        ];

        return hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE));
    }

    /**
     * @param  list<array<string, mixed>>  $a
     * @param  list<array<string, mixed>>  $b
     */
    private function linesMatch(array $a, array $b): bool
    {
        if (count($a) !== count($b)) {
            return false;
        }

        foreach ($a as $i => $line) {
            if (($line['itemId'] ?? '') !== ($b[$i]['itemId'] ?? '')) {
                return false;
            }
            if (! Decimal::equals((string) ($line['quantity'] ?? '0'), (string) ($b[$i]['quantity'] ?? '0'))) {
                return false;
            }
            if (! Decimal::equals((string) ($line['unitPrice'] ?? '0'), (string) ($b[$i]['unitPrice'] ?? '0'))) {
                return false;
            }
        }

        return true;
    }
}
