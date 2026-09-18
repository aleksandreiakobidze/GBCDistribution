<?php

namespace Tests\Unit;

use App\Erp\Support\GeoPoint;
use App\Erp\Support\VisitDay;
use Carbon\Carbon;
use Tests\TestCase;

class VisitRouteSupportTest extends TestCase
{
    public function test_geo_point_rejects_empty_and_zero_zero(): void
    {
        $this->assertFalse(GeoPoint::isPlottable(null, null));
        $this->assertFalse(GeoPoint::isPlottable('', '44.8'));
        $this->assertFalse(GeoPoint::isPlottable('0', '0'));
        $this->assertFalse(GeoPoint::isPlottable('0.0000', '0.0'));
        $this->assertTrue(GeoPoint::isPlottable('41.7151', '44.8271'));
    }

    public function test_tbilisi_wednesday_is_wed(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 08:00:00', 'Asia/Tbilisi'));
        try {
            $this->assertSame('WED', VisitDay::fmgFlag());
            $this->assertSame('today', VisitDay::normalize('today'));
            $this->assertSame('all', VisitDay::normalize('all'));
            $this->assertSame('all', VisitDay::normalize(null));
        } finally {
            Carbon::setTestNow();
        }
    }
}
