<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\VisitPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class VisitPhotoController extends V1Controller
{
    public function index(Request $request, VisitPhotoService $photos): JsonResponse
    {
        $customerId = (string) $request->query('customerId', '');
        if ($customerId === '') {
            return $this->ok([]);
        }

        return $this->ok($photos->list($this->presellerUserId($request), $customerId));
    }

    public function store(Request $request, VisitPhotoService $photos): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string'],
            'phase' => ['required', 'string'],
            'comment' => ['nullable', 'string', 'max:300'],
            'tags' => ['nullable', 'string', 'max:200'],
            'latitude' => ['nullable'],
            'longitude' => ['nullable'],
            'photo' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:8192'],
        ]);

        return $this->ok($photos->store(
            $this->user($request),
            $this->presellerUserId($request),
            $this->idGvari($request),
            $data,
            $request->file('photo'),
        ), 201);
    }

    public function file(Request $request, int $id, VisitPhotoService $photos): BinaryFileResponse
    {
        $row = $photos->file($this->presellerUserId($request), $id);

        return response()->file(Storage::disk('local')->path($row->path), [
            'Content-Type' => $row->mime,
            'Content-Disposition' => 'inline; filename="visit-'.$row->id.'"',
        ]);
    }
}
