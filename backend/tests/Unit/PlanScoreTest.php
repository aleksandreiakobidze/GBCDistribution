<?php

namespace Tests\Unit;

use App\Erp\Plan\PlanScore;
use App\Erp\Plan\PlanWorkbook;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\TestCase;

class PlanScoreTest extends TestCase
{
    public function test_percent_is_empty_when_the_plan_is_zero(): void
    {
        $this->assertNull(PlanScore::percent(12.5, 0));
        $this->assertSame(50.0, PlanScore::percent(5, 10));
    }

    public function test_names_match_after_extra_spaces(): void
    {
        $this->assertSame(
            PlanScore::dimensionKey('ედვარდი წიქარიშვილი', 'KACC', 'CSD', 'RC Cola'),
            PlanScore::dimensionKey('  ედვარდი წიქარიშვილი  ', 'kacc', 'CSD', 'RC Cola'),
        );
    }

    public function test_repeated_key_is_counted_once_in_the_total(): void
    {
        $totals = PlanScore::totals([
            ['plan' => 10, 'factKey' => 'same', 'real' => 8, 'return' => 1],
            ['plan' => 5, 'factKey' => 'same', 'real' => 8, 'return' => 1],
        ]);

        $this->assertSame(15.0, $totals['plan']);
        $this->assertSame(8.0, $totals['real']);
        $this->assertSame(1.0, $totals['return']);
        $this->assertSame(7.0, $totals['net']);
        $this->assertSame(46.7, $totals['percent']);
    }

    public function test_workbook_reads_dates_and_cached_plan(): void
    {
        $book = new Spreadsheet();
        $sheet = $book->getActiveSheet();
        $sheet->setTitle('Sheet2');
        $sheet->fromArray([
            ['Reg', 'Real Super', 'Real Presale', 'Channel', 'Prod Category', 'Brand', 'Presale Brand Plan', null, null],
            ['გორი', 'ზურა', 'გიორგი', 'KACC', 'CSD', 'RC Cola', 100, 46296, 46326],
        ]);

        $path = tempnam(sys_get_temp_dir(), 'plan').'.xlsx';
        (new Xlsx($book))->save($path);
        $rows = (new PlanWorkbook())->read($path);
        unlink($path);

        $this->assertCount(1, $rows);
        $this->assertSame('2026-10-01', $rows[0]['startsOn']);
        $this->assertSame('2026-10-31', $rows[0]['endsOn']);
        $this->assertSame(100.0, $rows[0]['plan']);
        $this->assertSame('RC Cola', $rows[0]['brand']);
    }

    public function test_ranking_keeps_salespeople_whose_channels_intersect(): void
    {
        $rows = [
            $this->line('ანა', 'TT', 100, 80, 0, 'a-tt'),
            $this->line('ანა', 'HoReCa', 50, 10, 0, 'a-horeca'),
            $this->line('ბექა', 'TT', 100, 40, 0, 'b-tt'),
            $this->line('გიორგი', 'HoReCa', 100, 90, 0, 'g-horeca'),
            $this->line('დათო', 'Draft Shop', 100, 100, 0, 'd-draft'),
            $this->line('ეკა', 'TT', 0, 20, 0, 'e-tt'),
        ];

        $tt = PlanScore::ranking($rows, 'ბექა', []);
        $this->assertSame(['ანა', 'ბექა'], array_column($tt, 'presale'));
        $this->assertSame([1, 2], array_column($tt, 'rank'));
        $this->assertTrue($tt[1]['self']);
        $this->assertNotContains('ეკა', array_column($tt, 'presale'));
        $detail = PlanScore::detail($rows, 'ბექა', []);
        $this->assertCount(1, $detail);
        $this->assertSame('ბექა', $detail[0]['presale']);

        $both = PlanScore::ranking($rows, 'ანა', []);
        $this->assertSame(['გიორგი', 'ანა', 'ბექა'], array_column($both, 'presale'));
        $this->assertNotContains('დათო', array_column($both, 'presale'));
        $this->assertNotContains('ეკა', array_column($both, 'presale'));

        $onlyTt = PlanScore::ranking($rows, 'ანა', ['channel' => 'TT']);
        $this->assertSame(['ანა', 'ბექა'], array_column($onlyTt, 'presale'));
        $this->assertSame(80.0, $onlyTt[0]['real']);

        $beer = PlanScore::ranking([
            $this->line('ანა', 'TT', 100, 50, 0, 'a1', 'Beer'),
            $this->line('ბექა', 'TT', 100, 10, 0, 'b1', 'CSD'),
        ], 'ანა', ['brand' => 'Beer']);
        $this->assertSame(['ანა'], array_column($beer, 'presale'));
        $this->assertSame(50.0, $beer[0]['real']);
    }

    public function test_zero_plan_channel_does_not_enter_that_ranking(): void
    {
        $rows = [
            $this->line('გურამი', 'KACC', 0, 10, 0, 'g-kacc'),
            $this->line('გურამი', 'TT', 100, 40, 0, 'g-tt'),
            $this->line('ბექა', 'KACC', 100, 80, 0, 'b-kacc'),
            $this->line('ანა', 'TT', 100, 50, 0, 'a-tt'),
        ];

        $kacc = PlanScore::ranking($rows, 'ბექა', []);
        $this->assertSame(['ბექა'], array_column($kacc, 'presale'));

        $tt = PlanScore::ranking($rows, 'ანა', []);
        $this->assertSame(['ანა', 'გურამი'], array_column($tt, 'presale'));
        $this->assertSame(40.0, $tt[1]['real']);

        $detail = PlanScore::detail($rows, 'გურამი', []);
        $this->assertCount(1, $detail);
        $this->assertSame(100.0, $detail[0]['plan']);
        $this->assertSame(50.0, $detail[0]['real']);
    }

    public function test_several_channels_and_categories_keep_one_salesperson_total(): void
    {
        $rows = [
            $this->line('ანა', 'TT', 100, 80, 0, 'a-tt', 'RC Cola', 'CSD', 'გორი'),
            $this->line('ანა', 'HoReCa', 50, 10, 0, 'a-horeca', 'Natakhtari', 'Beer', 'თბილისი'),
            $this->line('ანა', 'Draft Shop', 40, 40, 0, 'a-draft', 'Water', 'Water', 'გორი'),
            $this->line('ბექა', 'TT', 100, 40, 0, 'b-tt', 'RC Cola', 'CSD', 'გორი'),
            $this->line('გიორგი', 'HoReCa', 100, 90, 0, 'g-horeca', 'Natakhtari', 'Beer', 'გორი'),
            $this->line('დათო', 'Draft Shop', 100, 100, 0, 'd-draft', 'Water', 'Water', 'გორი'),
        ];
        $filters = [
            'channel' => ['TT', 'HoReCa'],
            'category' => ['CSD', 'Beer'],
            'region' => [],
        ];

        $ranked = PlanScore::ranking($rows, 'ანა', $filters);
        $this->assertSame(['გიორგი', 'ანა', 'ბექა'], array_column($ranked, 'presale'));
        $this->assertSame(90.0, $ranked[1]['real']);
        $this->assertSame(150.0, $ranked[1]['plan']);
        $this->assertTrue($ranked[1]['self']);

        $detail = PlanScore::detail($rows, 'ანა', $filters);
        $this->assertSame(['ანა', 'ანა'], array_column($detail, 'presale'));
        $totals = PlanScore::totals(array_map(fn (array $row): array => [
            'plan' => $row['plan'],
            'factKey' => $row['factKey'],
            'real' => $row['real'],
            'return' => $row['return'],
        ], $detail));
        $this->assertSame(150.0, $totals['plan']);
        $this->assertSame(90.0, $totals['real']);
        $this->assertSame($totals['plan'], $ranked[1]['plan']);
        $this->assertSame($totals['real'], $ranked[1]['real']);
        $this->assertNotSame(350.0, $totals['plan']);

        $gori = PlanScore::detail($rows, 'ანა', [
            'channel' => ['TT', 'HoReCa'],
            'category' => ['CSD', 'Beer'],
            'region' => ['გორი'],
        ]);
        $this->assertCount(1, $gori);
        $this->assertSame('გორი', $gori[0]['region']);
    }

    public function test_supervisor_ranking_stays_inside_the_october_team(): void
    {
        $rows = [
            $this->line('ნიკოლოზ კობაიძე', 'TT', 100, 40, 0, 'n-tt', 'Beer', 'CSD', 'გორი', 'ბექა ბაინდურაშვილი'),
            $this->line('გიორგი გოგიაშვილი', 'TT', 100, 80, 0, 'g-tt', 'Beer', 'CSD', 'გორი', 'ბექა ბაინდურაშვილი'),
            $this->line('გიგა გიგაშვილი', 'HoReCa', 100, 50, 0, 'gi-h', 'Beer', 'CSD', 'გორი', 'ბექა ბაინდურაშვილი'),
            $this->line('ნიკა საათაშვილი', 'TT', 100, 70, 0, 's-tt', 'Beer', 'CSD', 'გორი', 'ბექა ბაინდურაშვილი'),
            $this->line('გურამი', 'TT', 100, 90, 0, 'out', 'Beer', 'CSD', 'იმერეთი', 'გიორგი გუგავა'),
        ];

        $team = PlanScore::supervisorRows($rows, '  ბექა   ბაინდურაშვილი ');
        $this->assertSame(
            ['ნიკოლოზ კობაიძე', 'გიორგი გოგიაშვილი', 'გიგა გიგაშვილი', 'ნიკა საათაშვილი'],
            array_column($team, 'presale'),
        );

        $ranked = PlanScore::ranking($team, 'ნიკა საათაშვილი', []);
        $this->assertSame(['გიორგი გოგიაშვილი', 'ნიკა საათაშვილი', 'ნიკოლოზ კობაიძე'], array_column($ranked, 'presale'));
        $this->assertNotContains('გურამი', array_column($ranked, 'presale'));
        $this->assertNotContains('გიგა გიგაშვილი', array_column($ranked, 'presale'));
    }

    public function test_plan_team_keeps_only_the_named_salespeople(): void
    {
        $rows = [
            $this->line('ნიკოლოზ კობაიძე', 'TT', 100, 40, 0, 'n-tt'),
            $this->line('გურამი', 'TT', 100, 90, 0, 'g-tt'),
        ];

        $team = PlanScore::presaleRows($rows, ['  ნიკოლოზ   კობაიძე ']);

        $this->assertSame(['ნიკოლოზ კობაიძე'], array_column($team, 'presale'));
        $this->assertSame([], PlanScore::presaleRows($rows, []));
    }

    public function test_supervisor_filters_apply_to_the_rank_and_the_lines(): void
    {
        $rows = [
            $this->line('ანა', 'HoReCa', 100, 80, 0, 'a-h', 'Guinness', 'Beer'),
            $this->line('ანა', 'TT', 50, 20, 0, 'a-t', 'Szpezi', 'CSD'),
            $this->line('ბექა', 'HoReCa', 100, 40, 0, 'b-h', 'Guinness', 'Beer'),
            $this->line('გიორგი', 'TT', 100, 90, 0, 'g-t', 'Guinness', 'Beer'),
        ];

        $lines = PlanScore::teamLines($rows, []);
        $this->assertSame(['ანა', 'ანა', 'ბექა', 'გიორგი'], array_column($lines, 'presale'));
        $this->assertSame(['Guinness', 'Szpezi', 'Guinness', 'Guinness'], array_column($lines, 'brand'));

        $beer = PlanScore::teamLines($rows, ['brand' => 'Guinness']);
        $this->assertSame(['Guinness', 'Guinness', 'Guinness'], array_column($beer, 'brand'));

        $ranked = PlanScore::teamRanking($rows, ['channel' => 'HoReCa']);
        $this->assertSame(['ანა', 'ბექა'], array_column($ranked, 'presale'));
        $this->assertSame(80.0, $ranked[0]['real']);
        $this->assertSame(40.0, $ranked[1]['real']);

        $chosen = PlanScore::presaleRows($rows, ['ანა', 'გიორგი']);
        $chosenRank = PlanScore::teamRanking($chosen, []);
        $this->assertSame(['გიორგი', 'ანა'], array_column($chosenRank, 'presale'));
        $this->assertEqualsCanonicalizing(
            array_values(array_unique(array_column(PlanScore::teamLines($chosen, []), 'presale'))),
            array_column($chosenRank, 'presale'),
        );
    }

    public function test_channels_sum_in_the_total_and_rank_keeps_the_full_percent(): void
    {
        $rows = [
            $this->line('ანა', 'HoReCa', 100, 80, 10, 'horeca', 'Guinness', 'Beer'),
            $this->line('ანა', 'TT', 0, 30, 0, 'tt', 'Guinness', 'Beer'),
            $this->line('ანა', 'TT', 0, 5, 0, 'szpezi', 'Szpezi', 'CSD'),
            $this->line('ბექა', 'HoReCa', 100, 40, 0, 'b', 'Guinness', 'Beer'),
            $this->line('დათო', 'Draft Shop', 100, 100, 0, 'd', 'Guinness', 'Beer'),
        ];

        $detail = PlanScore::detail($rows, 'ანა', []);
        $this->assertSame(['Guinness', 'Szpezi'], array_column($detail, 'brand'));
        $this->assertSame(100.0, $detail[0]['plan']);
        $this->assertSame(110.0, $detail[0]['real']);
        $this->assertSame(10.0, $detail[0]['return']);
        $this->assertSame(100.0, $detail[0]['net']);

        $horeca = PlanScore::detail($rows, 'ანა', ['channel' => 'HoReCa']);
        $this->assertSame(['Guinness'], array_column($horeca, 'brand'));
        $this->assertSame(100.0, $horeca[0]['plan']);
        $this->assertSame(80.0, $horeca[0]['real']);
        $this->assertSame(70.0, $horeca[0]['net']);

        $ranked = PlanScore::ranking($rows, 'ანა', ['channel' => 'HoReCa', 'brand' => 'Guinness']);
        $this->assertSame(['ანა', 'ბექა'], array_column($ranked, 'presale'));
        $this->assertNotContains('დათო', array_column($ranked, 'presale'));
        $this->assertSame(80.0, $ranked[0]['real']);
        $this->assertSame(10.0, $ranked[0]['return']);
        $this->assertSame(70.0, $ranked[0]['net']);
        $this->assertSame(70.0, $ranked[0]['percent']);
        $this->assertSame(40.0, $ranked[1]['real']);
    }

    /**
     * @return array{presale: string, channel: string, region: string, supervisor: string, category: string, brand: string, plan: float, real: float, return: float, factKey: string}
     */
    private function line(
        string $presale,
        string $channel,
        float $plan,
        float $real,
        float $return,
        string $factKey,
        string $brand = 'Beer',
        string $category = 'CSD',
        string $region = 'გორი',
        string $supervisor = 'ზურა',
    ): array {
        return [
            'presale' => $presale,
            'channel' => $channel,
            'region' => $region,
            'supervisor' => $supervisor,
            'category' => $category,
            'brand' => $brand,
            'plan' => $plan,
            'real' => $real,
            'return' => $return,
            'factKey' => $factKey,
        ];
    }
}
