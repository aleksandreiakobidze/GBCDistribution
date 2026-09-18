<?php

namespace Tests\Feature;

use App\Erp\Exceptions\ErpException;
use App\Erp\Fmg\FmgOrderGateway;
use App\Erp\Fmg\FmgConnection;
use Tests\TestCase;

class FmgWritesDisabledTest extends TestCase
{
    public function test_fmg_gateway_refuses_unresolved_mapping(): void
    {
        config(['erp.writes_enabled' => true]);
        $gateway = new FmgOrderGateway(new FmgConnection);

        try {
            $gateway->submit(['customerId' => '1', 'idGvari' => 1], []);
            $this->fail('Expected ErpException');
        } catch (ErpException $e) {
            $this->assertSame('WRITE_MAPPING_UNRESOLVED', $e->errorCode);
            $this->assertSame(503, $e->httpStatus);
        }
    }

    public function test_fmg_gateway_disabled_by_default(): void
    {
        config(['erp.writes_enabled' => false]);
        $gateway = new FmgOrderGateway(new FmgConnection);

        try {
            $gateway->submit(['customerId' => '1', 'idGvari' => 1], []);
            $this->fail('Expected ErpException');
        } catch (ErpException $e) {
            $this->assertSame('WRITES_DISABLED', $e->errorCode);
        }
    }
}
