<?php

namespace App\Filament\Resources;

use App\Enums\ReturnStatus;
use App\Filament\Resources\ReturnResource\Pages;
use App\Models\ReturnOrder;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Schemas\Schema;
use Filament\Resources\Resource;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ReturnResource extends Resource
{
    protected static ?string $model = ReturnOrder::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-arrow-uturn-left';

    protected static string | \UnitEnum | null $navigationGroup = 'Finance';

    protected static ?string $navigationLabel = 'Returns';

    protected static ?string $modelLabel = 'Return';

    protected static ?string $pluralModelLabel = 'Returns';

    protected static ?string $slug = 'returns';

    public static function form(Schema $form): Schema
    {
        return $form
            ->schema([
                Select::make('order_id')
                    ->relationship('order', 'order_number')
                    ->searchable()
                    ->preload()
                    ->required(),
                Textarea::make('reason')
                    ->rows(3),
                Select::make('status')
                    ->options(ReturnStatus::class)
                    ->default(ReturnStatus::Pending)
                    ->required(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('return_number')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('order.order_number')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('customer.name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (ReturnStatus $state): string => match ($state) {
                        ReturnStatus::Pending => 'warning',
                        ReturnStatus::Approved => 'info',
                        ReturnStatus::Processed => 'success',
                        ReturnStatus::Rejected => 'danger',
                    }),
                TextColumn::make('total')
                    ->numeric(decimalPlaces: 2)
                    ->prefix('₾')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(ReturnStatus::class),
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
            'index' => Pages\ListReturns::route('/'),
            'create' => Pages\CreateReturn::route('/create'),
            'edit' => Pages\EditReturn::route('/{record}/edit'),
        ];
    }
}
