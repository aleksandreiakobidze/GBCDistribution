<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case SalesRep = 'sales_rep';
    case Warehouse = 'warehouse';
    case Driver = 'driver';
}
