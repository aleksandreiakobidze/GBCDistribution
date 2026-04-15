<?php

namespace App\Enums;

enum ReturnCondition: string
{
    case Damaged = 'damaged';
    case Expired = 'expired';
    case WrongItem = 'wrong_item';
    case Other = 'other';
}
