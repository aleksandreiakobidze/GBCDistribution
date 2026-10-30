<?php

namespace App\Erp\Plan;

use App\Erp\Exceptions\ErpException;
use DateTimeImmutable;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;

/**
 * Reads the visible plan sheet (october target Sheet2): columns A–G plus dates in H and I.
 */
final class PlanWorkbook
{
    /**
     * @return list<array{
     *     region: string,
     *     supervisor: string,
     *     presale: string,
     *     channel: string,
     *     category: string,
     *     brand: string,
     *     plan: float,
     *     startsOn: string,
     *     endsOn: string
     * }>
     */
    public function read(string $path): array
    {
        $sheetName = $this->planSheetName($path);
        $sheet = $this->loadSheet($path, $sheetName, 'I');
        $rows = $this->rowsFromSheet($sheet, false);
        $missing = false;
        foreach ($rows as $row) {
            if ($row['plan'] === null) {
                $missing = true;
                break;
            }
        }
        if ($missing) {
            $sums = $this->detailSums($path);
            foreach ($rows as $index => $row) {
                if ($row['plan'] === null) {
                    $rows[$index]['plan'] = $sums[$row['detailKey']] ?? 0.0;
                }
            }
        }

        $clean = [];
        foreach ($rows as $row) {
            unset($row['detailKey']);
            $row['plan'] = round((float) ($row['plan'] ?? 0), 4);
            $clean[] = $row;
        }
        if ($clean === []) {
            throw new ErpException('PLAN_EMPTY', 'ფაილში გეგმის ხაზი ვერ მოიძებნა.', 422);
        }

        return $clean;
    }

    private function planSheetName(string $path): string
    {
        $names = IOFactory::createReader('Xlsx')->listWorksheetNames($path);
        if (in_array('Sheet2', $names, true)) {
            return 'Sheet2';
        }
        foreach ($names as $name) {
            if ($name !== 'Presale Brand Plan') {
                return $name;
            }
        }

        throw new ErpException('PLAN_SHEET', 'გეგმის ფურცელი ვერ მოიძებნა.', 422);
    }

    /**
     * @return array<string, float>
     */
    private function detailSums(string $path): array
    {
        $names = IOFactory::createReader('Xlsx')->listWorksheetNames($path);
        if (! in_array('Presale Brand Plan', $names, true)) {
            return [];
        }
        $sheet = $this->loadSheet($path, 'Presale Brand Plan', 'G');
        $sums = [];
        foreach ($this->rowsFromSheet($sheet, true) as $row) {
            $sums[$row['detailKey']] = ($sums[$row['detailKey']] ?? 0) + (float) ($row['plan'] ?? 0);
        }

        return $sums;
    }

    private function loadSheet(string $path, string $sheetName, string $lastColumn): Worksheet
    {
        try {
            $reader = IOFactory::createReader('Xlsx');
            $reader->setReadDataOnly(false);
            $reader->setReadEmptyCells(false);
            $reader->setLoadSheetsOnly([$sheetName]);
            $reader->setReadFilter(new class($sheetName, $lastColumn) implements IReadFilter
            {
                public function __construct(private string $sheet, private string $last) {}

                public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
                {
                    if ($worksheetName !== '' && $worksheetName !== $this->sheet) {
                        return false;
                    }
                    $column = strtoupper($columnAddress);

                    return strlen($column) === 1 && $column >= 'A' && $column <= $this->last;
                }
            });
            $book = $reader->load($path);
        } catch (Throwable) {
            throw new ErpException('PLAN_FILE', 'Excel ფაილი ვერ წაიკითხა.', 422);
        }
        $sheet = $book->getSheetByName($sheetName);
        if (! $sheet) {
            throw new ErpException('PLAN_SHEET', 'გეგმის ფურცელი ვერ მოიძებნა.', 422);
        }

        return $sheet;
    }

    /**
     * @return list<array{
     *     region: string,
     *     supervisor: string,
     *     presale: string,
     *     channel: string,
     *     category: string,
     *     brand: string,
     *     plan: float|null,
     *     startsOn: string,
     *     endsOn: string,
     *     detailKey: string
     * }>
     */
    private function rowsFromSheet(Worksheet $sheet, bool $detail): array
    {
        $headerRow = $this->headerRow($sheet);
        $map = $this->headerMap($sheet, $headerRow);
        foreach (['presale', 'channel', 'category', 'brand'] as $required) {
            if (! isset($map[$required])) {
                throw new ErpException('PLAN_COLUMNS', 'ფაილში Real Presale, Channel, Prod Category და Brand სვეტები სჭირდება.', 422);
            }
        }
        if (! isset($map['plan'])) {
            $map['plan'] = 'G';
        }
        $highest = (int) $sheet->getHighestDataRow();
        $rows = [];
        for ($row = $headerRow + 1; $row <= $highest; $row++) {
            $presale = $this->text($sheet, $map['presale'], $row);
            $channel = $this->text($sheet, $map['channel'], $row);
            $category = $this->text($sheet, $map['category'], $row);
            $brand = $this->text($sheet, $map['brand'], $row);
            if ($presale === '' && $channel === '' && $category === '' && $brand === '') {
                continue;
            }
            $region = isset($map['region']) ? $this->text($sheet, $map['region'], $row) : '';
            $supervisor = isset($map['supervisor']) ? $this->text($sheet, $map['supervisor'], $row) : '';
            $plan = isset($map['plan']) ? $this->number($sheet->getCell($map['plan'].$row)) : 0.0;
            if ($detail) {
                $starts = '1970-01-01';
                $ends = '1970-01-01';
            } else {
                $starts = $this->date($sheet->getCell('H'.$row));
                $ends = $this->date($sheet->getCell('I'.$row));
                if ($starts === null || $ends === null || $starts > $ends) {
                    throw new ErpException('PLAN_DATES', 'სვეტებში H და I თარიღი სჭირდება. ხაზი '.$row.'.', 422);
                }
            }
            if ($presale === '') {
                throw new ErpException('PLAN_PRESALE', 'Real Presale ცარიელია. ხაზი '.$row.'.', 422);
            }
            $rows[] = [
                'region' => $region,
                'supervisor' => $supervisor,
                'presale' => $presale,
                'channel' => $channel,
                'category' => $category,
                'brand' => $brand,
                'plan' => $plan,
                'startsOn' => $starts,
                'endsOn' => $ends,
                'detailKey' => PlanScore::detailKey($region, $supervisor, $presale, $channel, $category, $brand),
            ];
        }

        return $rows;
    }

    private function headerRow(Worksheet $sheet): int
    {
        $highest = min(5, (int) $sheet->getHighestDataRow());
        for ($row = 1; $row <= $highest; $row++) {
            for ($col = 1; $col <= 9; $col++) {
                $text = $this->text($sheet, Coordinate::stringFromColumnIndex($col), $row);
                if (strcasecmp($text, 'Real Presale') === 0) {
                    return $row;
                }
            }
        }

        throw new ErpException('PLAN_COLUMNS', 'ფაილში Real Presale სვეტი ვერ მოიძებნა.', 422);
    }

    /**
     * @return array<string, string>
     */
    private function headerMap(Worksheet $sheet, int $headerRow): array
    {
        $map = [];
        for ($col = 1; $col <= 9; $col++) {
            $letter = Coordinate::stringFromColumnIndex($col);
            $label = strtolower($this->text($sheet, $letter, $headerRow));
            $key = match ($label) {
                'reg' => 'region',
                'real super' => 'supervisor',
                'real presale' => 'presale',
                'channel' => 'channel',
                'prod category' => 'category',
                'brand' => 'brand',
                'presale brand plan' => 'plan',
                default => null,
            };
            if ($key !== null && ! isset($map[$key])) {
                $map[$key] = $letter;
            }
        }

        return $map;
    }

    private function text(Worksheet $sheet, string $column, int $row): string
    {
        $value = $sheet->getCell($column.$row)->getValue();
        if ($value === null) {
            return '';
        }
        if (is_string($value) && str_starts_with($value, '=')) {
            $cached = $sheet->getCell($column.$row)->getOldCalculatedValue();
            if (is_scalar($cached) && ! is_bool($cached)) {
                return trim((string) $cached);
            }

            return '';
        }

        return trim((string) $value);
    }

    private function number(Cell $cell): ?float
    {
        $value = $cell->getValue();
        if (is_numeric($value)) {
            return (float) $value;
        }
        $cached = $cell->getOldCalculatedValue();
        if (is_numeric($cached)) {
            return (float) $cached;
        }
        if (is_string($value) && str_starts_with(trim($value), '=')) {
            return null;
        }
        if (is_string($value) && is_numeric(str_replace([',', ' '], ['', ''], $value))) {
            return (float) str_replace([',', ' '], ['', ''], $value);
        }

        return 0.0;
    }

    private function date(Cell $cell): ?string
    {
        $value = $cell->getValue();
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_string($value) && str_starts_with(trim($value), '=')) {
            $value = $cell->getOldCalculatedValue();
        }
        if (is_numeric($value)) {
            try {
                return Date::excelToDateTimeObject((float) $value)->format('Y-m-d');
            } catch (Throwable) {
                return null;
            }
        }
        if (is_string($value) && trim($value) !== '') {
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', trim($value))
                ?: DateTimeImmutable::createFromFormat('!d.m.Y', trim($value))
                ?: DateTimeImmutable::createFromFormat('!d/m/Y', trim($value));

            return $parsed ? $parsed->format('Y-m-d') : null;
        }

        return null;
    }
}
