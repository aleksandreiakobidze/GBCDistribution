<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\VisitPhotoGalleryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class GalleryPhotoController extends V1Controller
{
    public function index(Request $request, VisitPhotoGalleryService $gallery): JsonResponse
    {
        $filters = $this->validatedWithLists($request, [
            'salesUserId' => ['nullable', 'array'],
            'salesUserId.*' => ['integer'],
            'customer' => ['nullable', 'string', 'max:80'],
            'day' => ['nullable', 'date_format:Y-m-d'],
            'tag' => ['nullable', 'array'],
            'tag.*' => ['string', 'max:40'],
            'rating' => ['nullable', 'array'],
            'rating.*' => ['integer', 'between:1,5'],
            'phase' => ['nullable', 'array'],
            'phase.*' => ['in:before,end,survey,shelf'],
            'reviewed' => ['nullable', 'in:0,1'],
            'q' => ['nullable', 'string', 'max:80'],
        ], ['salesUserId', 'tag', 'rating', 'phase']);

        return $this->ok($gallery->list($this->user($request), $filters));
    }

    public function update(Request $request, int $id, VisitPhotoGalleryService $gallery): JsonResponse
    {
        $data = $request->validate([
            'signature' => ['nullable', 'string', 'max:300'],
            'reviewComment' => ['nullable', 'string', 'max:300'],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'rotation' => ['required', 'integer', 'in:0,90,180,270'],
            'reviewed' => ['required', 'boolean'],
        ]);

        return $this->ok($gallery->update($this->user($request), $id, $data));
    }

    public function file(Request $request, int $id, VisitPhotoGalleryService $gallery): BinaryFileResponse
    {
        $row = $gallery->file($this->user($request), $id);

        return response()->file(Storage::disk('local')->path($row->path), [
            'Content-Type' => $row->mime,
            'Content-Disposition' => 'inline; filename="visit-'.$row->id.'"',
        ]);
    }

    public function download(Request $request, VisitPhotoGalleryService $gallery): Response
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['integer'],
        ]);

        $file = $gallery->download($this->user($request), $data['ids']);
        $fallback = str_ends_with($file['filename'], '.zip')
            ? 'visit-photos.zip'
            : 'photo.jpg';

        return response($file['body'], 200, [
            'Content-Type' => $file['mime'],
            'Content-Disposition' => 'attachment; filename="'.$fallback.'"; filename*=UTF-8\'\''.rawurlencode($file['filename']),
        ]);
    }
}
