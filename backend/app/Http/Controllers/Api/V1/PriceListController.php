<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\Exceptions\ErpException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PriceListController extends V1Controller
{
    public function meta(): JsonResponse
    {
        $path = $this->configuredPath();
        $available = $path !== '' && is_file($path) && is_readable($path);

        if (! $available) {
            return $this->ok([
                'available' => false,
                'filename' => null,
                'sizeBytes' => null,
                'updatedAt' => null,
            ]);
        }

        $updatedAt = filemtime($path);

        return $this->ok([
            'available' => true,
            'filename' => basename($path),
            'sizeBytes' => filesize($path) ?: null,
            'updatedAt' => $updatedAt
                ? Carbon::createFromTimestamp($updatedAt, config('erp.timezone'))->toIso8601String()
                : null,
        ]);
    }

    public function file(): BinaryFileResponse
    {
        $path = $this->configuredPath();

        if ($path === '' || ! is_file($path) || ! is_readable($path)) {
            throw new ErpException(
                'PRICE_LIST_UNAVAILABLE',
                'ფასების კატალოგი ამჟამად მიუწვდომელია.',
                404,
            );
        }

        return response()->file($path, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="price-list.pdf"',
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ]);
    }

    /**
     * The catalog path comes from config only, never from the request.
     */
    private function configuredPath(): string
    {
        return trim((string) config('catalog.price_list.path'));
    }
}
