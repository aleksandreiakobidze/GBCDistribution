<?php

namespace App\Http\Controllers\Api\V1;

use App\Erp\FieldDashboardService;
use App\Erp\FieldWorkService;
use App\Erp\PresellerReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldWorkController extends V1Controller
{
    public function tasks(Request $request, FieldWorkService $field): JsonResponse
    {
        $filters = $this->validatedWithLists($request, [
            'customerId' => ['nullable', 'string', 'max:32'],
            'status' => ['nullable', 'array'],
            'status.*' => ['in:open,done'],
            'salesUserId' => ['nullable', 'array'],
            'salesUserId.*' => ['integer'],
        ], ['status', 'salesUserId']);

        return $this->ok($field->listTasks(
            $this->user($request),
            $filters['customerId'] ?? null,
            $this->stringList($filters, 'status'),
            $this->intList($filters, 'salesUserId'),
        ));
    }

    public function storeTask(Request $request, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'salesUserId' => ['required', 'integer'],
            'customerId' => ['nullable', 'string', 'max:32'],
            'photoId' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:160'],
            'note' => ['nullable', 'string', 'max:300'],
            'dueOn' => ['nullable', 'date_format:Y-m-d'],
        ]);

        return $this->ok($field->createTask($this->user($request), $data), 201);
    }

    public function updateTask(Request $request, int $id, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:complete,check'],
        ]);

        return $this->ok($field->updateTask($this->user($request), $id, (string) $data['action']));
    }

    public function surveys(Request $request, FieldWorkService $field): JsonResponse
    {
        return $this->ok($field->listSurveys(
            $this->user($request),
            $request->query('customerId') ? (string) $request->query('customerId') : null,
        ));
    }

    public function storeSurvey(Request $request, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'visitId' => ['required', 'integer'],
            'shelfStocked' => ['required', 'boolean'],
            'priceVisible' => ['required', 'boolean'],
            'promoPresent' => ['required', 'boolean'],
            'competitorSeen' => ['required', 'boolean'],
        ]);

        return $this->ok($field->saveSurvey($this->user($request), $data), 201);
    }

    public function coaching(Request $request, FieldWorkService $field): JsonResponse
    {
        return $this->ok($field->listCoaching(
            $this->user($request),
            $request->query('customerId') ? (string) $request->query('customerId') : null,
        ));
    }

    public function storeCoaching(Request $request, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'visitId' => ['required', 'integer'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        return $this->ok($field->saveCoaching($this->user($request), $data), 201);
    }

    public function shelf(Request $request, FieldWorkService $field): JsonResponse
    {
        return $this->ok($field->listShelf(
            $this->user($request),
            $request->query('customerId') ? (string) $request->query('customerId') : null,
        ));
    }

    public function storeShelf(Request $request, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['required', 'string', 'max:32'],
            'photoId' => ['nullable', 'integer'],
            'lines' => ['required', 'array', 'min:1', 'max:40'],
            'lines.*.itemId' => ['required', 'string', 'max:32'],
            'lines.*.status' => ['required', 'in:present,missing,low'],
            'lines.*.itemName' => ['nullable', 'string', 'max:160'],
            'lines.*.shelfNo' => ['nullable', 'integer', 'min:1', 'max:20'],
            'lines.*.facings' => ['nullable', 'integer', 'min:0', 'max:40'],
            'lines.*.readPrice' => ['nullable', 'numeric', 'min:0'],
            'lines.*.competitor' => ['nullable', 'boolean'],
            'lines.*.boxX' => ['nullable', 'numeric', 'between:0,1'],
            'lines.*.boxY' => ['nullable', 'numeric', 'between:0,1'],
            'lines.*.boxW' => ['nullable', 'numeric', 'between:0,1'],
            'lines.*.boxH' => ['nullable', 'numeric', 'between:0,1'],
        ]);

        return $this->ok($field->saveShelf($this->user($request), $data), 201);
    }

    public function planograms(Request $request, FieldWorkService $field): JsonResponse
    {
        return $this->ok($field->listPlanogram(
            $this->user($request),
            $request->query('customerId') ? (string) $request->query('customerId') : null,
            $request->query('orgCategoryId') !== null && $request->query('orgCategoryId') !== ''
                ? (int) $request->query('orgCategoryId')
                : null,
            $request->boolean('stored'),
        ));
    }

    public function storePlanogram(Request $request, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'customerId' => ['nullable', 'string', 'max:32', 'required_without:orgCategoryId', 'prohibits:orgCategoryId'],
            'orgCategoryId' => ['nullable', 'integer', 'min:1', 'required_without:customerId', 'prohibits:customerId'],
            'shelfNo' => ['required', 'integer', 'min:1', 'max:20'],
            'position' => ['required', 'integer', 'min:1', 'max:200'],
            'itemId' => ['required', 'string', 'max:32'],
            'itemName' => ['nullable', 'string', 'max:160'],
            'facings' => ['nullable', 'integer', 'min:1', 'max:40'],
            'targetPrice' => ['nullable', 'numeric', 'min:0'],
        ]);

        return $this->ok($field->savePlanogram($this->user($request), $data), 201);
    }

    public function destroyPlanogram(Request $request, FieldWorkService $field, int $id): JsonResponse
    {
        $field->deletePlanogram($this->user($request), $id);

        return $this->ok(['deleted' => true]);
    }

    public function promos(Request $request, FieldWorkService $field): JsonResponse
    {
        $filters = $this->validatedWithLists($request, [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'salesUserId' => ['nullable', 'array'],
            'salesUserId.*' => ['integer'],
            'status' => ['nullable', 'array'],
            'status.*' => ['in:planned,active,done'],
        ], ['salesUserId', 'status']);

        return $this->ok($field->listPromos(
            $this->user($request),
            $filters['from'] ?? null,
            $filters['to'] ?? null,
            $this->intList($filters, 'salesUserId'),
            $this->stringList($filters, 'status'),
        ));
    }

    public function storePromo(Request $request, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'salesUserId' => ['required', 'integer'],
            'customerId' => ['nullable', 'string', 'max:32'],
            'title' => ['required', 'string', 'max:160'],
            'startsOn' => ['required', 'date_format:Y-m-d'],
            'endsOn' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        return $this->ok($field->createPromo($this->user($request), $data), 201);
    }

    public function updatePromo(Request $request, int $id, FieldWorkService $field): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:160'],
            'startsOn' => ['sometimes', 'date_format:Y-m-d'],
            'endsOn' => ['sometimes', 'date_format:Y-m-d'],
            'status' => ['sometimes', 'in:planned,active,done'],
            'customerId' => ['nullable', 'string', 'max:32'],
            'note' => ['nullable', 'string', 'max:300'],
            'photoId' => ['nullable', 'integer'],
        ]);

        return $this->ok($field->updatePromo($this->user($request), $id, $data));
    }

    public function copyPromo(Request $request, int $id, FieldWorkService $field): JsonResponse
    {
        return $this->ok($field->copyPromo($this->user($request), $id), 201);
    }

    public function day(Request $request, FieldWorkService $field): JsonResponse
    {
        $filters = $this->validatedWithLists($request, [
            'salesUserId' => ['nullable', 'array'],
            'salesUserId.*' => ['integer'],
        ], ['salesUserId']);

        return $this->ok($field->day($this->user($request), $this->intList($filters, 'salesUserId')));
    }

    public function dashboard(Request $request, FieldDashboardService $dashboard): JsonResponse
    {
        return $this->ok($dashboard->overview($this->user($request)));
    }

    public function myReports(Request $request, PresellerReportService $reports): JsonResponse
    {
        $days = (int) $request->query('days', 7);

        return $this->ok($reports->forSalesRep($this->user($request), $days));
    }
}
