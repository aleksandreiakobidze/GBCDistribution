<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Paid = 'paid';
    case Partial = 'partial';
    case Overdue = 'overdue';
}
