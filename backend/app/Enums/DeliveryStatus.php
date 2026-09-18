<?php

namespace App\Enums;

enum DeliveryStatus: string
{
    case Pending = 'pending';
    case Assigned = 'assigned';
    case Loading = 'loading';
    case InTransit = 'in_transit';
    case Delivered = 'delivered';
    case Partial = 'partial';
    case Failed = 'failed';
}
