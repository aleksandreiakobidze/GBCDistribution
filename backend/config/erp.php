<?php

return [

    /*
    | ERP_PROVIDER=fmg uses FMG SQL Server views/tables.
    | ERP_PROVIDER=exact is an unimplemented boundary.
    | ERP_PROVIDER=fake is for automated tests only.
    */
    'provider' => env('ERP_PROVIDER', 'fmg'),

    'company' => env('ERP_COMPANY', 'default'),

    'timezone' => env('ERP_TIMEZONE', 'Asia/Tbilisi'),

    'writes_enabled' => env('FMG_WRITES_ENABLED', false),

    'quote_ttl_minutes' => (int) env('ERP_QUOTE_TTL_MINUTES', 30),

    'pagination' => [
        'default' => 100,
        'max' => 500,
    ],

    'order' => [
        'max_lines' => (int) env('ERP_MAX_ORDER_LINES', 200),
        'note_max_length' => 300,
        'username_max_length' => 15,
    ],

    /*
    | Candidate mapping only: OrgView.FG (smallint) -> ProdView.Fasi{N}.
    | Not a confirmed FMG business rule. Invalid/unmapped FG never falls back to Fasi1 or 0.
    */
    'price_group' => [
        'min' => 1,
        'max' => 60,
        'confirmed' => false,
    ],

    'fmg' => [
        'connection' => 'fmg',
        'audit_username' => env('FMG_AUDIT_USERNAME'),
        /*
        | Required OnlineReal1 columns without verified defaults stay unresolved.
        | Do not invent 0 / empty sentinels.
        */
        'unresolved_header_fields' => [
            'IdMdz',
            'Exported',
            'Active',
            'IdRealWayBill1',
            'IdReal1Pocket',
        ],
    ],

];
