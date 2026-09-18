<?php

namespace App\Enums;

enum ReturnStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Processed = 'processed';
    case Rejected = 'rejected';
}
