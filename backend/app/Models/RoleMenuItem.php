<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoleMenuItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'role_name',
        'menu_key',
    ];
}
