<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case SalesRep = 'sales_rep';
    case Supervisor = 'supervisor';
    case Manager = 'manager';
    case Warehouse = 'warehouse';
    case Driver = 'driver';
}
