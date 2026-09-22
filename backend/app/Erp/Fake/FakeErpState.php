<?php

namespace App\Erp\Fake;

final class FakeErpState
{
    /** @var list<array<string, mixed>> */
    public static array $customers = [];

    /** @var list<array<string, mixed>> */
    public static array $assignments = [];

    /** @var list<array<string, mixed>> */
    public static array $presellers = [];

    /** @var list<array<string, mixed>> */
    public static array $products = [];

    /** @var list<array<string, mixed>> */
    public static array $promotions = [];

    /** @var list<array<string, mixed>> */
    public static array $orders = [];

    public static bool $failNextLineWrite = false;

    public static int $nextOrderId = 1000;

    public static function reset(): void
    {
        self::$customers = [];
        self::$assignments = [];
        self::$presellers = [];
        self::$products = [];
        self::$promotions = [];
        self::$orders = [];
        self::$failNextLineWrite = false;
        self::$nextOrderId = 1000;
    }

    public static function seedDefault(): void
    {
        self::reset();

        self::$presellers = [
            ['IdGvari' => 11, 'Gvari' => 'Nino', 'IsPreseller' => true, 'GvariActive' => true],
            ['IdGvari' => 12, 'Gvari' => 'Davit', 'IsPreseller' => true, 'GvariActive' => true],
        ];

        self::$customers = [
            self::customer('1001', 'Org A', 1, 11, false, [
                'kegs' => [
                    ['IdProd' => '1025', 'Prod' => 'Keg 50L', 'Raod' => '6.000'],
                ],
                'Tanxa' => '125.5000',
            ]),
            self::customer('1002', 'Org B', 2, 11, false, [
                'Lat' => '0',
                'Lon' => '0',
                'CanRealHalfComp' => false,
                'schedule' => self::days(['WED' => true], ['WEDNum' => 1]),
            ]),
            self::customer('2001', 'Org C', 1, 12),
            self::customer('3001', 'Assortment Org', 1, 11, true, [
                'schedule' => self::days(['MON' => true], ['MONNum' => 1]),
            ]),
            self::customer('1005', 'Hidden pocket', 1, 11, false, [
                'OrgShowPocket' => false,
            ]),
        ];

        // Duplicate assignment rows must not duplicate customers.
        self::$assignments = [
            ['IdOrg' => '1001', 'IdGvari' => 11],
            ['IdOrg' => '1001', 'IdGvari' => 11],
            ['IdOrg' => '1002', 'IdGvari' => 11],
            ['IdOrg' => '2001', 'IdGvari' => 12],
            ['IdOrg' => '3001', 'IdGvari' => 11],
            ['IdOrg' => '1005', 'IdGvari' => 11],
        ];

        self::$products = [
            [
                'IdProd' => '0001',
                'Prod' => 'Water 1.5L',
                'Ert' => 'ცალი',
                'UnitName' => 'ცალი',
                'ProdCode' => 'W001',
                'ProdCategory' => 'Drinks',
                'ProdS' => 'Drinks',
                'ProdT' => 'Beverages',
                'ProdG' => 'Water',
                'Active' => true,
                'ShowInPocket' => true,
                'Fasi1' => '1.5000',
                'Fasi2' => '2.5000',
                'CompRaod' => '1.0000',
                'CanRealHalfComp' => true,
            ],
            [
                'IdProd' => '0002',
                'Prod' => 'Juice',
                'Ert' => 'ცალი',
                'UnitName' => 'ცალი',
                'ProdCode' => 'J001',
                'ProdCategory' => 'Drinks',
                'ProdS' => 'Drinks',
                'ProdT' => 'Beverages',
                'ProdG' => 'Juice',
                'Active' => true,
                'ShowInPocket' => true,
                'Fasi1' => '3.0000',
                'Fasi2' => '4.0000',
                'CompRaod' => '1.0000',
                'CanRealHalfComp' => true,
            ],
            [
                'IdProd' => '0003',
                'Prod' => 'Null price item',
                'Ert' => 'ცალი',
                'UnitName' => 'ცალი',
                'ProdCode' => 'N001',
                'ProdCategory' => 'Drinks',
                'ProdS' => 'Drinks',
                'ProdT' => 'Beverages',
                'ProdG' => 'Other',
                'Active' => true,
                'ShowInPocket' => true,
                'Fasi1' => null,
                'Fasi2' => '1.0000',
                'CompRaod' => '1.0000',
                'CanRealHalfComp' => true,
            ],
            [
                'IdProd' => '0004',
                'Prod' => 'Warehouse only',
                'Ert' => 'ცალი',
                'UnitName' => 'ცალი',
                'ProdCode' => 'H001',
                'ProdCategory' => 'Hidden',
                'ProdS' => 'Warehouse',
                'ProdT' => 'Warehouse',
                'ProdG' => 'Stock',
                'Active' => true,
                'ShowInPocket' => false,
                'Fasi1' => '9.0000',
                'Fasi2' => '9.0000',
                'CompRaod' => '1.0000',
                'CanRealHalfComp' => false,
            ],
            [
                'IdProd' => '0005',
                'Prod' => 'Inactive pocket item',
                'Ert' => 'ცალი',
                'UnitName' => 'ცალი',
                'ProdCode' => 'I001',
                'ProdCategory' => 'Drinks',
                'ProdS' => 'Drinks',
                'ProdT' => 'Beverages',
                'ProdG' => 'Other',
                'Active' => false,
                'ShowInPocket' => true,
                'Fasi1' => '1.0000',
                'Fasi2' => '1.0000',
                'CompRaod' => '1.0000',
                'CanRealHalfComp' => true,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public static function customer(string $id, string $name, int $fg, int $assignedTo, bool $useProdList = false, array $overrides = []): array
    {
        return array_merge([
            'IdOrg' => $id,
            'Org' => $name,
            'OrgCode' => 'C'.$id,
            'Address' => 'Tbilisi',
            'Phone' => '555',
            'City' => 'Tbilisi',
            'FG' => $fg,
            'Sagad' => '123456789',
            'IdQseli' => 1,
            'Qseli' => 'West',
            'IdOrgT' => 1,
            'OrgT' => 'Retail',
            'IdReg' => 1,
            'IdOrgCategory' => 1,
            'OrgCategory' => 'Standard',
            'Lat' => '41.7151000000',
            'Lon' => '44.8271000000',
            'UseProdList' => $useProdList,
            'OrgShowPocket' => true,
            'CanRealHalfComp' => true,
            'MinReal' => 0,
            'MaxReal' => 0,
            'Active' => true,
            'schedule' => self::days(
                ['MON' => true, 'TUE' => true, 'WED' => true, 'THU' => true, 'FRI' => true],
                ['MONNum' => 1, 'TUENum' => 2, 'WEDNum' => 3, 'THUNum' => 4, 'FRINum' => 5],
            ),
            '_assignedHint' => $assignedTo,
        ], $overrides);
    }

    /**
     * @param  array<string, bool>  $flags
     * @param  array<string, int>  $nums
     * @return array<string, mixed>
     */
    public static function days(array $flags = [], array $nums = []): array
    {
        return array_merge([
            'MON' => false, 'TUE' => false, 'WED' => false, 'THU' => false,
            'FRI' => false, 'SAT' => false, 'SUN' => false,
            'MONNum' => 0, 'TUENum' => 0, 'WEDNum' => 0, 'THUNum' => 0,
            'FRINum' => 0, 'SATNum' => 0, 'SUNNum' => 0,
        ], $flags, $nums);
    }
}
