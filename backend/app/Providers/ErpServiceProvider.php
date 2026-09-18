<?php

namespace App\Providers;

use App\Erp\Contracts\ErpProvider;
use App\Erp\Exact\ExactErpProvider;
use App\Erp\Fake\FakeErpProvider;
use App\Erp\Fmg\FmgErpProvider;
use App\Erp\OrderApplicationService;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

class ErpServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ErpProvider::class, function () {
            return match (config('erp.provider')) {
                'fmg' => FmgErpProvider::make(),
                'exact' => new ExactErpProvider,
                'fake' => FakeErpProvider::make(),
                default => throw new InvalidArgumentException('Unknown ERP_PROVIDER'),
            };
        });

        $this->app->singleton(OrderApplicationService::class, function ($app) {
            return new OrderApplicationService($app->make(ErpProvider::class));
        });
    }

    public function boot(): void
    {
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}
