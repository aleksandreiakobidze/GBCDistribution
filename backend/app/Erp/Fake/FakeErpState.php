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
            self::customer('1001', 'Org A', 1, 11),
            self::customer('1002', 'Org B', 2, 11),
            self::customer('2001', 'Org C', 1, 12),
            self::customer('3001', 'Assortment Org', 1, 11, true),
        ];

        // Duplicate assignment rows must not duplicate customers.
        self::$assignments = [
            ['IdOrg' => '1001', 'IdGvari' => 11],
            ['IdOrg' => '1001', 'IdGvari' => 11],
            ['IdOrg' => '1002', 'IdGvari' => 11],
            ['IdOrg' => '2001', 'IdGvari' => 12],
            ['IdOrg' => '3001', 'IdGvari' => 11],
        ];

        self::$products = [
            [
                'IdProd' => '0001',
                'Prod' => 'Water 1.5L',
                'Ert' => 'ცალი',
                'UnitName' => 'ცალი',
                'ProdCode' => 'W001',
                'ProdCategory' => 'Drinks',
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
                'Active' => true,
                'ShowInPocket' => true,
                'Fasi1' => null,
                'Fasi2' => '1.0000',
                'CompRaod' => '1.0000',
                'CanRealHalfComp' => true,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function customer(string $id, string $name, int $fg, int $assignedTo, bool $useProdList = false): array
    {
        return [
            'IdOrg' => $id,
            'Org' => $name,
            'OrgCode' => 'C'.$id,
            'Address' => 'Tbilisi',
            'Phone' => '555',
            'City' => 'Tbilisi',
            'FG' => $fg,
            'Sagad' => '123456789',
            'IdQseli' => 1,
            'IdOrgT' => 1,
            'IdReg' => 1,
            'IdOrgCategory' => 1,
            'Lat' => '41.7151000000',
            'Lon' => '44.8271000000',
            'UseProdList' => $useProdList,
            'OrgShowPocket' => true,
            'Active' => true,
            'schedule' => [
                'MON' => true, 'TUE' => true, 'WED' => true, 'THU' => true,
                'FRI' => true, 'SAT' => false, 'SUN' => false,
                'MONNum' => 1, 'TUENum' => 2, 'WEDNum' => 3, 'THUNum' => 4,
                'FRINum' => 5, 'SATNum' => 0, 'SUNNum' => 0,
            ],
            '_assignedHint' => $assignedTo,
        ];
    }
}
