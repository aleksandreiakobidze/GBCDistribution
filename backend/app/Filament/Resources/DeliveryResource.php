<?php

namespace App\Filament\Resources;

use App\Enums\DeliveryStatus;
use App\Enums\UserRole;
use App\Filament\Resources\DeliveryResource\Pages;
use App\Models\Delivery;
use App\Models\User;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Schema;
use Filament\Resources\Resource;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class DeliveryResource extends Resource
{
    protected static ?string $model = Delivery::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-truck';

    protected static string | \UnitEnum | null $navigationGroup = 'Sales';

    public static function form(Schema $form): Schema
    {
        return $form
            ->schema([
                Select::make('order_id')
                    ->relationship('order', 'order_number')
                    ->searchable()
                    ->preload()
                    ->required(),
                Select::make('driver_id')
                    ->label('Driver')
                    ->options(User::where('role', UserRole::Driver)->pluck('name', 'id'))
                    ->searchable()
                    ->required(),
                Select::make('status')
                    ->options(DeliveryStatus::class)
                    ->default(DeliveryStatus::Assigned)
                    ->required(),
                DatePicker::make('scheduled_date'),
                Textarea::make('notes')
                    ->rows(3),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('order.order_number')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('order.customer.name')
                    ->label('Customer')
                    ->searchable(),
                TextColumn::make('driver.name')
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (DeliveryStatus $state): string => match ($state) {
                        DeliveryStatus::Pending => 'warning',
                        DeliveryStatus::Assigned => 'gray',
                        DeliveryStatus::Loading => 'warning',
                        DeliveryStatus::InTransit => 'info',
                        DeliveryStatus::Delivered => 'success',
                        DeliveryStatus::Partial => 'warning',
                        DeliveryStatus::Failed => 'danger',
                    }),
                TextColumn::make('scheduled_date')
                    ->date()
                    ->sortable(),
                TextColumn::make('delivered_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(DeliveryStatus::class),
                SelectFilter::make('driver_id')
                    ->label('Driver')
                    ->options(User::where('role', UserRole::Driver)->pluck('name', 'id')),
                Filter::make('scheduled_date')
                    ->form([
                        DatePicker::make('from'),
                        DatePicker::make('until'),
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        return $query
                            ->when($data['from'], fn (Builder $q, $date) => $q->where('scheduled_date', '>=', $date))
                            ->when($data['until'], fn (Builder $q, $date) => $q->where('scheduled_date', '<=', $date));
                    }),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListDeliveries::route('/'),
            'create' => Pages\CreateDelivery::route('/create'),
            'edit' => Pages\EditDelivery::route('/{record}/edit'),
        ];
    }
}
